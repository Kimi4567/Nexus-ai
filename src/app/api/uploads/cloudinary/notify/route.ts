import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import { createUploadError, getMediaTypeFromMime } from '@/lib/uploadValidation'
import { logUploadEvent } from '@/lib/auditLogger'

async function lookupUploadSession(sessionToken: string) {
  return prisma.uploadSession.findUnique({ where: { token: sessionToken } })
}

export async function POST(req: Request) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json(createUploadError(401, 'Unauthorized', 'UNAUTHORIZED'), { status: 401 })

  try {
    const body = await req.json()
    const { fileName, mimeType, secureUrl, publicId, bytes, resourceType, sessionToken, category } = body

    if (!fileName || !mimeType || !secureUrl || !publicId || !sessionToken) {
      return NextResponse.json(createUploadError(400, 'Missing required upload metadata', 'MISSING_FIELDS'), { status: 400 })
    }

    const session = await lookupUploadSession(sessionToken)
    if (!session || session.userId !== userId) {
      await logUploadEvent({ userId, eventType: 'INVALID_CLOUDINARY_NOTIFY', severity: 'WARN', metadata: { sessionToken, publicId } })
      return NextResponse.json(createUploadError(403, 'Invalid upload session', 'INVALID_SESSION'), { status: 403 })
    }

    if (session.status !== 'PENDING' || session.expiresAt < new Date()) {
      await logUploadEvent({ userId, workspaceId: session.workspaceId ?? undefined, projectId: session.projectId ?? undefined, sessionId: session.id, eventType: 'EXPIRED_CLOUDINARY_NOTIFY', severity: 'WARN' })
      return NextResponse.json(createUploadError(410, 'Upload session expired', 'SESSION_EXPIRED'), { status: 410 })
    }

    const mediaType = getMediaTypeFromMime(mimeType)
    const url = secureUrl

    const media = await prisma.media.create({
      data: {
        workspaceId: session.workspaceId,
        projectId: session.projectId,
        campaignId: session.campaignId,
        uploadSessionId: session.id,
        fileName,
        type: mediaType,
        mimeType,
        url,
        cloudinaryId: publicId,
        size: Number(bytes) || 0,
        category: category || 'upload',
      },
    })

    await prisma.uploadSession.update({
      where: { id: session.id },
      data: { status: 'COMPLETED', usedAt: new Date() },
    })

    await logUploadEvent({
      userId,
      workspaceId: session.workspaceId,
      projectId: session.projectId ?? undefined,
      sessionId: session.id,
      eventType: 'CLOUDINARY_UPLOAD_RECORDED',
      metadata: { mediaId: media.id, url },
    })

    return NextResponse.json({ media })
  } catch (err) {
    console.error('Cloudinary notify failed', err)
    return NextResponse.json(createUploadError(500, 'Failed to register uploaded media', 'REGISTER_FAILED'), { status: 500 })
  }
}
