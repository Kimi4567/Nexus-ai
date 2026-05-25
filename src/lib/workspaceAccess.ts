import { prisma } from '@/lib/prisma'

export async function getWorkspaceForUser(workspaceId: string, userId: string) {
  return prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } },
      ],
    },
  })
}

export async function assertWorkspaceAccess(workspaceId: string, userId: string) {
  const workspace = await getWorkspaceForUser(workspaceId, userId)
  if (!workspace) {
    throw new Error('Workspace not found or access denied')
  }
  return workspace
}

export async function assertProjectInWorkspace(projectId: string, workspaceId: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      workspaceId,
      workspace: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
        ],
      },
    },
  })
  if (!project) throw new Error('Project not found or access denied')
  return project
}

export async function assertCampaignInWorkspace(campaignId: string, workspaceId: string, userId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: {
      id: campaignId,
      workspaceId,
      workspace: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
        ],
      },
    },
  })
  if (!campaign) throw new Error('Campaign not found or access denied')
  return campaign
}

export function workspaceAccessFilter(userId: string) {
  return {
    OR: [
      { ownerId: userId },
      { members: { some: { userId } } },
    ],
  }
}
