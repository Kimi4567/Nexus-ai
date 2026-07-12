import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import { assertWorkspaceAccess, assertProjectInWorkspace, assertCampaignInWorkspace } from '@/lib/workspaceAccess'
import { createUploadError } from '@/lib/uploadValidation'
import { logUploadEvent } from '@/lib/auditLogger'
import { uploadSessionRateLimitDb } from '@/lib/dbRateLimit'

export async function POST(req: Request) {
  const userId = await getServerUserId(req)
  if (!userId) {
    return NextResponse.json(createUploadError(401, 'Unauthorized', 'UNAUTHORIZED'), { status: 401 })
  }
  const rateLimit = await uploadSessionRateLimitDb(userId)
  if (!rateLimit.ok) {
    return NextResponse.json(createUploadError(429, rateLimit.message, 'RATE_LIMITED'), { status: 429 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    let { workspaceId, projectId, campaignId, resourceType, fileName } = body
    workspaceId = typeof workspaceId === 'string' ? workspaceId : ''
    projectId = typeof projectId === 'string' ? projectId : ''
    campaignId = typeof campaignId === 'string' ? campaignId : ''
    resourceType = ['auto', 'image', 'video'].includes(resourceType) ? resourceType : 'auto'
    fileName = typeof fileName === 'string' ? fileName.trim().slice(0, 255) : null

    if (!workspaceId) {
      if (projectId) {
        const project = await prisma.project.findFirst({
          where: {
            id: projectId,
            workspace: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
          },
          select: { workspaceId: true },
        })
        if (!project) {
          return NextResponse.json(createUploadError(403, 'Project access denied', 'ACCESS_DENIED'), { status: 403 })
        }
        workspaceId = project.workspaceId
      }

      if (!workspaceId && campaignId) {
        const campaign = await prisma.campaign.findFirst({
          where: {
            id: campaignId,
            workspace: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
          },
          select: { workspaceId: true },
        })
        if (!campaign) {
          return NextResponse.json(createUploadError(403, 'Campaign access denied', 'ACCESS_DENIED'), { status: 403 })
        }
        workspaceId = campaign.workspaceId
      }
    }

    if (!workspaceId) {
      const defaultWorkspace = await prisma.workspace.findFirst({ where: { ownerId: userId } })
      if (!defaultWorkspace) {
        return NextResponse.json(createUploadError(400, 'Workspace required for upload session', 'WORKSPACE_REQUIRED'), { status: 400 })
      }
      workspaceId = defaultWorkspace.id
    }

    const workspace = await assertWorkspaceAccess(workspaceId, userId)

    if (projectId) {
      await assertProjectInWorkspace(projectId, workspaceId, userId)
    }

    if (campaignId) {
      await assertCampaignInWorkspace(campaignId, workspaceId, userId)
    }

    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000) // 2 minutes

    const session = await prisma.uploadSession.create({
      data: {
        token,
        userId,
        workspaceId,
        projectId: projectId || null,
        campaignId: campaignId || null,
        resourceType: resourceType || 'auto',
        fileName: fileName || null,
        expiresAt,
      },
    })

    await logUploadEvent({
      userId,
      workspaceId,
      projectId,
      sessionId: session.id,
      eventType: 'UPLOAD_SESSION_CREATED',
      metadata: { expiresAt: expiresAt.toISOString() },
    })

    return NextResponse.json({ sessionToken: token, expiresAt: expiresAt.toISOString() })
  } catch (err: unknown) {
    console.error('[uploads/session POST]', err)
    if (err instanceof Error && /access denied|not found/i.test(err.message)) {
      return NextResponse.json(createUploadError(403, 'Upload scope access denied', 'ACCESS_DENIED'), { status: 403 })
    }
    return NextResponse.json(createUploadError(500, 'Failed to create upload session', 'SERVER_ERROR'), { status: 500 })
  }
}
