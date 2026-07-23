import { NextResponse } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import {
  createUploadError,
  getMediaTypeFromMime,
  isValidUploadMime,
  normalizeMediaMetric,
  validateUploadSize,
  validateVideoDuration,
} from '@/lib/uploadValidation'
import { logUploadEvent } from '@/lib/auditLogger'

if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  })
}

function mimeFromAsset(resourceType: string, format: string): string {
  if (resourceType === 'video') {
    if (format === 'mov') return 'video/quicktime'
    if (format === 'm4v') return 'video/x-m4v'
    return `video/${format}`
  }
  return `image/${format === 'jpg' ? 'jpeg' : format}`
}

function getVerifiedVideoDuration(asset: any): unknown {
  return asset?.duration
    ?? asset?.media_metadata?.duration
    ?? asset?.media_metadata?.Duration
    ?? asset?.video?.duration
    ?? asset?.metadata?.duration
}

export async function POST(req: Request) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json(createUploadError(401, 'Unauthorized', 'UNAUTHORIZED'), { status: 401 })

  if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET || !process.env.CLOUDINARY_CLOUD_NAME) {
    return NextResponse.json(createUploadError(503, 'Cloudinary not configured', 'CLOUDINARY_DISABLED'), { status: 503 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const sessionToken = typeof body.sessionToken === 'string' ? body.sessionToken : ''
    const publicId = typeof body.publicId === 'string' ? body.publicId : ''
    if (!sessionToken || !publicId) {
      return NextResponse.json(createUploadError(400, 'sessionToken and publicId are required', 'MISSING_FIELDS'), { status: 400 })
    }

    const session = await prisma.uploadSession.findUnique({ where: { token: sessionToken } })
    if (!session || session.userId !== userId) {
      await logUploadEvent({ userId, sessionId: session?.id, eventType: 'INVALID_CLOUDINARY_NOTIFY', severity: 'WARN' })
      return NextResponse.json(createUploadError(403, 'Invalid upload session', 'INVALID_SESSION'), { status: 403 })
    }
    if (session.status !== 'PENDING' || session.expiresAt < new Date()) {
      return NextResponse.json(createUploadError(410, 'Upload session expired or already used', 'SESSION_EXPIRED'), { status: 410 })
    }

    const expectedPublicId = `nexus/${session.workspaceId}/${session.id}`
    if (publicId !== expectedPublicId) {
      await logUploadEvent({
        userId,
        workspaceId: session.workspaceId,
        sessionId: session.id,
        eventType: 'CLOUDINARY_ASSET_SCOPE_MISMATCH',
        severity: 'WARN',
        metadata: { publicId },
      })
      return NextResponse.json(createUploadError(403, 'Cloudinary asset is outside the upload workspace', 'ASSET_SCOPE_MISMATCH'), { status: 403 })
    }

    const expectedResourceType = session.resourceType === 'video' ? 'video' : 'image'
    let asset: any
    try {
      asset = await cloudinary.api.resource(publicId, {
        resource_type: expectedResourceType,
        ...(expectedResourceType === 'video' ? { media_metadata: true, image_metadata: true } : {}),
      })
    } catch {
      return NextResponse.json(createUploadError(400, 'Cloudinary asset could not be verified', 'ASSET_NOT_VERIFIED'), { status: 400 })
    }

    const secureUrl = typeof asset?.secure_url === 'string' ? asset.secure_url : ''
    const format = typeof asset?.format === 'string' ? asset.format.toLowerCase() : ''
    const bytes = Number(asset?.bytes || 0)
    if (!secureUrl.startsWith('https://res.cloudinary.com/') || !format || !Number.isFinite(bytes) || bytes <= 0) {
      return NextResponse.json(createUploadError(400, 'Cloudinary asset metadata is invalid', 'INVALID_ASSET_METADATA'), { status: 400 })
    }

    const mimeType = mimeFromAsset(expectedResourceType, format)
    if (!isValidUploadMime(mimeType)) {
      return NextResponse.json(createUploadError(415, 'Unsupported file type', 'UNSUPPORTED_TYPE'), { status: 415 })
    }
    const sizeCheck = validateUploadSize(mimeType, bytes)
    if (!sizeCheck.valid) {
      return NextResponse.json(createUploadError(413, sizeCheck.message || 'File too large', 'FILE_TOO_LARGE'), { status: 413 })
    }

    const durationCheck = expectedResourceType === 'video' ? validateVideoDuration(getVerifiedVideoDuration(asset)) : null
    if (durationCheck && !durationCheck.valid) {
      return NextResponse.json(
        createUploadError(422, durationCheck.message || 'Invalid video duration', 'INVALID_VIDEO_DURATION'),
        { status: 422 },
      )
    }

    const fileName = session.fileName || String(asset.original_filename || publicId.split('/').pop() || 'upload')
    const mediaType = getMediaTypeFromMime(mimeType)
    const media = await prisma.$transaction(async (tx) => {
      const claimed = await tx.uploadSession.updateMany({
        where: {
          id: session.id,
          userId,
          status: 'PENDING',
          expiresAt: { gt: new Date() },
        },
        data: { status: 'COMPLETED', usedAt: new Date() },
      })
      if (claimed.count !== 1) throw new Error('UPLOAD_SESSION_ALREADY_USED')

      return tx.media.create({
        data: {
          workspaceId: session.workspaceId,
          projectId: session.projectId,
          campaignId: session.campaignId,
          uploadSessionId: session.id,
          fileName,
          type: mediaType,
          mimeType,
          url: secureUrl,
          cloudinaryId: publicId,
          size: bytes,
          width: normalizeMediaMetric(asset.width, 'dimension'),
          height: normalizeMediaMetric(asset.height, 'dimension'),
          duration: durationCheck?.duration ?? null,
          category: typeof body.category === 'string' ? body.category.slice(0, 50) : 'upload',
        },
      })
    })

    await logUploadEvent({
      userId,
      workspaceId: session.workspaceId,
      projectId: session.projectId ?? undefined,
      sessionId: session.id,
      eventType: 'CLOUDINARY_UPLOAD_RECORDED',
      metadata: { mediaId: media.id, publicId, bytes, verified: true },
    })
    return NextResponse.json({ media })
  } catch (error) {
    if (error instanceof Error && error.message === 'UPLOAD_SESSION_ALREADY_USED') {
      return NextResponse.json(createUploadError(409, 'Upload session already used', 'SESSION_ALREADY_USED'), { status: 409 })
    }
    console.error('Cloudinary notify failed', error)
    return NextResponse.json(createUploadError(500, 'Failed to register uploaded media', 'REGISTER_FAILED'), { status: 500 })
  }
}
