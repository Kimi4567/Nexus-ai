import { prisma } from '@/lib/prisma'

export function leadWorkspaceAccessFilter(userId: string) {
  return {
    OR: [
      { ownerId: userId },
      { members: { some: { userId, joinedAt: { not: null } } } },
    ],
  }
}

export async function findPrimaryLeadWorkspace(userId: string) {
  return prisma.workspace.findFirst({
    where: leadWorkspaceAccessFilter(userId),
    orderBy: { createdAt: 'asc' },
    select: { id: true, ownerId: true, name: true },
  })
}

export async function listLeadOperators(workspaceId: string, userId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, ...leadWorkspaceAccessFilter(userId) },
    select: {
      ownerId: true,
      members: {
        where: { joinedAt: { not: null } },
        select: { userId: true, role: true },
      },
    },
  })
  if (!workspace) return []

  const memberRoles = new Map(workspace.members.map(member => [member.userId, member.role]))
  const userIds = [...new Set([workspace.ownerId, ...workspace.members.map(member => member.userId)])]
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
  })

  return users.map(user => ({
    ...user,
    role: user.id === workspace.ownerId ? 'OWNER' : memberRoles.get(user.id) ?? 'MEMBER',
  }))
}

export async function isLeadOperator(workspaceId: string, userId: string, candidateId: string): Promise<boolean> {
  if (!candidateId) return false
  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, ...leadWorkspaceAccessFilter(userId) },
    select: {
      ownerId: true,
      members: {
        where: { userId: candidateId, joinedAt: { not: null } },
        select: { id: true },
        take: 1,
      },
    },
  })
  return Boolean(workspace && (workspace.ownerId === candidateId || workspace.members.length > 0))
}
