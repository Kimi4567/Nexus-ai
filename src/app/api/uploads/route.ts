import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import fs from 'fs'
import path from 'path'
import {
  createUploadError,
  getMediaTypeFromMime,
  getSafeFileName,
  isValidUploadMime,
  validateUploadSize,
  MAX_IMAGE_SIZE_BYTES,
} from '@/lib/uploadValidation'
import { createRateLimiter } from '@/lib/dbRateLimit'
import { assertWorkspaceAccess, assertProjectInWorkspace } from '@/lib/workspaceAccess'

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

  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      createUploadError(503, 'Local uploads are disabled in production; use the signed Cloudinary flow', 'CLOUDINARY_REQUIRED'),
      { status: 503 },
    )
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
  try {
    await assertWorkspaceAccess(finalWorkspaceId, userId)
    if (projectId) await assertProjectInWorkspace(projectId, finalWorkspaceId, userId)
  } catch {
    return NextResponse.json(createUploadError(403, 'Upload scope access denied', 'ACCESS_DENIED'), { status: 403 })
  }

  if (!isValidUploadMime(mimeType)) {
    return NextResponse.json(createUploadError(415, 'Unsupported file type', 'UNSUPPORTED_TYPE'), { status: 415 })
  }
  if (mimeType.startsWith('video/')) {
    return NextResponse.json(createUploadError(400, 'Videos require signed direct upload', 'DIRECT_UPLOAD_REQUIRED'), { status: 400 })
  }
  if (typeof dataBase64 !== 'string' || dataBase64.length > Math.ceil(MAX_IMAGE_SIZE_BYTES * 4 / 3) + 8) {
    return NextResponse.json(createUploadError(413, 'Image payload too large', 'FILE_TOO_LARGE'), { status: 413 })
  }
  const normalizedBase64 = dataBase64.replace(/\s/g, '')
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalizedBase64) || normalizedBase64.length % 4 === 1) {
    return NextResponse.json(createUploadError(400, 'Invalid file payload', 'INVALID_PAYLOAD'), { status: 400 })
  }

  let buffer: Buffer
  try {
    buffer = Buffer.from(normalizedBase64, 'base64')
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

    return NextResponse.json({ media })
  } catch (err) {
    console.error('Upload failed during DB create', err)
    return NextResponse.json(createUploadError(500, 'Upload failed', 'DB_FAILED'), { status: 500 })
  }
}
