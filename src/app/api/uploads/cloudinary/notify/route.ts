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
    const { fileName, mimeType, secureUrl, publicId, bytes, resourceType, sessionToken, category, workspaceId: bodyWorkspaceId } = body

    // Core fields always required
    if (!secureUrl || !publicId) {
      return NextResponse.json(createUploadError(400, 'Missing required upload metadata', 'MISSING_FIELDS'), { status: 400 })
    }

    const mediaType = getMediaTypeFromMime(mimeType || 'image/jpeg')
    const url = secureUrl
    const safeFileName = fileName || publicId

    // ── Session-based path (from UploadPanel with sessionToken) ──────────────
    if (sessionToken) {
      const session = await lookupUploadSession(sessionToken)
      if (!session || session.userId !== userId) {
        await logUploadEvent({ userId, eventType: 'INVALID_CLOUDINARY_NOTIFY', severity: 'WARN', metadata: { sessionToken, publicId } })
        return NextResponse.json(createUploadError(403, 'Invalid upload session', 'INVALID_SESSION'), { status: 403 })
      }

      if (session.status !== 'PENDING' || session.expiresAt < new Date()) {
        await logUploadEvent({ userId, workspaceId: session.workspaceId ?? undefined, projectId: session.projectId ?? undefined, sessionId: session.id, eventType: 'EXPIRED_CLOUDINARY_NOTIFY', severity: 'WARN' })
        return NextResponse.json(createUploadError(410, 'Upload session expired', 'SESSION_EXPIRED'), { status: 410 })
      }

      const media = await prisma.media.create({
        data: {
          workspaceId: session.workspaceId,
          projectId: session.projectId,
          campaignId: session.campaignId,
          uploadSessionId: session.id,
          fileName: safeFileName,
          type: mediaType,
          mimeType: mimeType || 'image/jpeg',
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
    }

    // ── Sessionless path (from Media Library page — no sessionToken) ─────────
    // Look up workspace from userId — use provided workspaceId or fallback to default
    let resolvedWorkspaceId: string | null = bodyWorkspaceId || null
    if (!resolvedWorkspaceId) {
      const defaultWorkspace = await prisma.workspace.findFirst({
        where: { ownerId: userId },
      })
      if (!defaultWorkspace) {
        return NextResponse.json(createUploadError(400, 'Workspace required', 'WORKSPACE_REQUIRED'), { status: 400 })
      }
      resolvedWorkspaceId = defaultWorkspace.id
    }

    const media = await prisma.media.create({
      data: {
        workspaceId: resolvedWorkspaceId,
        fileName: safeFileName,
        type: mediaType,
        mimeType: mimeType || 'image/jpeg',
        url,
        cloudinaryId: publicId,
        size: Number(bytes) || 0,
        category: category || 'upload',
      },
    })

    await logUploadEvent({
      userId,
      workspaceId: resolvedWorkspaceId,
      eventType: 'CLOUDINARY_UPLOAD_RECORDED',
      metadata: { mediaId: media.id, url, sessionless: true },
    })

    return NextResponse.json({ media })
  } catch (err) {
    console.error('Cloudinary notify failed', err)
    return NextResponse.json(createUploadError(500, 'Failed to register uploaded media', 'REGISTER_FAILED'), { status: 500 })
  }
}
