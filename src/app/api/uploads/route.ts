import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import fs from 'fs'
import path from 'path'
import { scheduleProcessingForMedia } from '@/lib/uploadProcessor'
import {
  createUploadError,
  getMediaTypeFromMime,
  getSafeFileName,
  isValidUploadMime,
  validateUploadSize,
} from '@/lib/uploadValidation'
import { createRateLimiter } from '@/lib/dbRateLimit'

// Use /tmp on Vercel (read-only FS outside /tmp), local .storage otherwise.
// Lazy-initialised inside each request to avoid module-level crash on cold start.
function getStorageDir(): string | null {
  try {
    const dir = process.env.VERCEL
      ? '/tmp/nexus_uploads'
      : path.resolve(process.cwd(), '.storage', 'uploads')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    return dir
  } catch {
    return null
  }
}

const perUserRateLimit = createRateLimiter(60 * 1000, 20)
const perIpRateLimit = createRateLimiter(60 * 1000, 50)

async function readJsonWithTimeout(req: NextRequest, ms = 10_000) {
  return await Promise.race([
    req.json(),
    new Promise((_, rej) => setTimeout(() => rej(new Error('Request body read timeout')), ms)),
  ])
}

function getClientIp(req: NextRequest) {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
  )
}

async function getUserId(req: NextRequest) {
  return getServerUserId(req)
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) {
    return NextResponse.json(createUploadError(401, 'Unauthorized', 'UNAUTHORIZED'), { status: 401 })
  }

  const ip = getClientIp(req)
  const userLimit = perUserRateLimit(userId)
  if (!userLimit.ok) {
    return NextResponse.json({ error: userLimit.message, errorCode: 'RATE_LIMIT_USER' }, { status: userLimit.status })
  }

  const ipLimit = perIpRateLimit(ip)
  if (!ipLimit.ok) {
    return NextResponse.json({ error: ipLimit.message, errorCode: 'RATE_LIMIT_IP' }, { status: ipLimit.status })
  }

  let body: any
  try {
    body = await readJsonWithTimeout(req, 15_000)
  } catch (err) {
    console.error('Request body read timeout or invalid JSON', err)
    return NextResponse.json(createUploadError(400, 'Invalid or slow payload', 'INVALID_PAYLOAD'), { status: 400 })
  }

  const { fileName, mimeType, dataBase64, workspaceId, projectId, category } = body
  if (!fileName || !mimeType || !dataBase64) {
    return NextResponse.json(createUploadError(400, 'Missing required fields', 'MISSING_FIELDS'), { status: 400 })
  }

  let finalWorkspaceId = workspaceId
  if (!finalWorkspaceId) {
    const defaultWorkspace = await prisma.workspace.findFirst({ where: { ownerId: userId } })
    if (!defaultWorkspace) {
      return NextResponse.json(createUploadError(400, 'Workspace required', 'WORKSPACE_REQUIRED'), { status: 400 })
    }
    finalWorkspaceId = defaultWorkspace.id
  }

  if (!isValidUploadMime(mimeType)) {
    return NextResponse.json(createUploadError(415, 'Unsupported file type', 'UNSUPPORTED_TYPE'), { status: 415 })
  }

  let buffer: Buffer
  try {
    buffer = Buffer.from(dataBase64, 'base64')
  } catch (err) {
    console.error('Invalid base64 payload', err)
    return NextResponse.json(createUploadError(400, 'Invalid file payload', 'INVALID_PAYLOAD'), { status: 400 })
  }

  const sizeCheck = validateUploadSize(mimeType, buffer.length)
  if (!sizeCheck.valid) {
    return NextResponse.json(createUploadError(413, sizeCheck.message || 'File too large', 'FILE_TOO_LARGE'), { status: 413 })
  }

  // Resolve writable storage dir (safe on Vercel + local)
  const STORAGE_DIR = getStorageDir()
  if (!STORAGE_DIR) {
    return NextResponse.json(
      createUploadError(503, 'Local storage unavailable. Please configure Cloudinary.', 'STORAGE_UNAVAILABLE'),
      { status: 503 }
    )
  }

  const id = crypto.randomUUID()
  const safeName = getSafeFileName(fileName, id)
  const outPath = path.join(STORAGE_DIR, safeName)

  try {
    fs.writeFileSync(outPath, buffer)
  } catch (err) {
    console.error('Failed to write upload to disk', err)
    return NextResponse.json(createUploadError(500, 'Failed to save file', 'SAVE_FAILED'), { status: 500 })
  }

  const mediaType = getMediaTypeFromMime(mimeType)
  const duration: number | null = null

  try {
    const media = await prisma.media.create({
      data: {
        workspaceId: finalWorkspaceId,
        projectId: projectId || null,
        fileName,
        type: mediaType as any,
        mimeType,
        url: `/api/storage/uploads/${safeName}`,
        size: buffer.length,
        duration,
        category: category || 'upload',
      },
    })

    if (mediaType === 'VIDEO') {
      scheduleProcessingForMedia(media.id).catch((err) => console.warn('scheduleProcessing failed', err))
    }
    return NextResponse.json({ media })
  } catch (err) {
    console.error('Upload failed during DB create', err)
    return NextResponse.json(createUploadError(500, 'Upload failed', 'DB_FAILED'), { status: 500 })
  }
}

