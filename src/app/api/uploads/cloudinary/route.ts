import { NextResponse } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'
import { getServerUserId } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { createUploadError, getMediaTypeFromMime, getSafeFileName, isValidUploadMime, validateUploadSize } from '@/lib/uploadValidation'
import { createRateLimiter } from '@/lib/rateLimiter'

const perUserRateLimit = createRateLimiter(60 * 1000, 20)
const perIpRateLimit = createRateLimiter(60 * 1000, 50)

if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  })
}

async function getUserId(req: Request) {
  return getServerUserId(req)
}

function getClientIp(req: Request) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
}

async function readFormWithTimeout(req: Request, ms = 15_000): Promise<FormData> {
  const result = await Promise.race([
    // @ts-ignore
    req.formData(),
    new Promise((_, rej) => setTimeout(() => rej(new Error('Form parse timeout')), ms)),
  ])
  return result as FormData
}

export async function POST(req: Request) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // If Cloudinary not configured, tell client to fallback to local
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    return NextResponse.json({ fallback: true })
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

  try {
    const form = await readFormWithTimeout(req as any, 15_000)
    const file = form.get('file') as any
    const workspaceId = form.get('workspaceId') as string | null
    if (!file) return NextResponse.json(createUploadError(400, 'File required', 'MISSING_FILE'), { status: 400 })

    let finalWorkspaceId = workspaceId
    if (!finalWorkspaceId) {
      const defaultWorkspace = await prisma.workspace.findFirst({ where: { ownerId: userId } })
      if (!defaultWorkspace) {
        return NextResponse.json(createUploadError(400, 'Workspace required', 'WORKSPACE_REQUIRED'), { status: 400 })
      }
      finalWorkspaceId = defaultWorkspace.id
    }

    const mime = file.type || 'application/octet-stream'
    if (!isValidUploadMime(mime)) {
      return NextResponse.json(createUploadError(415, 'Unsupported file type', 'UNSUPPORTED_TYPE'), { status: 415 })
    }

    const size = typeof file.size === 'number' ? file.size : null
    if (size) {
      const sizeCheck = validateUploadSize(mime, size)
      if (!sizeCheck.valid) {
        return NextResponse.json(createUploadError(413, sizeCheck.message || 'File too large', 'FILE_TOO_LARGE'), { status: 413 })
      }
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const sizeCheck = validateUploadSize(mime, buffer.length)
    if (!sizeCheck.valid) {
      return NextResponse.json(createUploadError(413, sizeCheck.message || 'File too large', 'FILE_TOO_LARGE'), { status: 413 })
    }

    const folder = `nexus/${finalWorkspaceId}`
    const b64 = buffer.toString('base64')
    const dataUri = `data:${mime};base64,${b64}`

    const res = await cloudinary.uploader.upload(dataUri, { folder, resource_type: 'auto' })

    const mimeType = res.resource_type === 'video' ? 'video/mp4' : `image/${res.format}`
    const mediaType = getMediaTypeFromMime(mimeType)
    const safeFileName = res.original_filename || res.public_id

    const media = await prisma.media.create({ data: {
      workspaceId: finalWorkspaceId,
      fileName: safeFileName,
      type: mediaType,
      mimeType,
      url: res.secure_url,
      cloudinaryId: res.public_id,
      size: res.bytes || 0,
      duration: res.duration || null,
    }})

    if (media.type === 'VIDEO') {
      try {
        await import('@/lib/uploadProcessor').then((m) => m.scheduleProcessingForMedia(media.id))
      } catch (err) {
        console.warn('Failed to schedule processing for media', err)
      }
    }

    return NextResponse.json({ media })
  } catch (err) {
    console.error('Cloudinary upload error', err)
    return NextResponse.json(createUploadError(500, 'Upload failed', 'UPLOAD_FAILED'), { status: 500 })
  }
}

