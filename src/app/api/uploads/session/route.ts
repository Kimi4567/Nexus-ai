import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import { assertWorkspaceAccess, assertProjectInWorkspace, assertCampaignInWorkspace } from '@/lib/workspaceAccess'
import { createUploadError } from '@/lib/uploadValidation'
import { logUploadEvent } from '@/lib/auditLogger'

export async function POST(req: Request) {
  const userId = await getServerUserId(req)
  if (!userId) {
    return NextResponse.json(createUploadError(401, 'Unauthorized', 'UNAUTHORIZED'), { status: 401 })
  }

  const body = await req.json()
  let { workspaceId, projectId, campaignId, resourceType, fileName } = body

  if (!workspaceId) {
    if (projectId) {
      const project = await prisma.project.findUnique({ where: { id: projectId } })
      if (project) workspaceId = project.workspaceId
    }

    if (!workspaceId && campaignId) {
      const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } })
      if (campaign) workspaceId = campaign.workspaceId
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
}
