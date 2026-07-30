import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'

export async function getOrCreateProjectInWorkspace(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  projectName = 'My Project',
): Promise<string> {
  await tx.$executeRawUnsafe(
    'SELECT pg_advisory_xact_lock(hashtext($1))',
    `default-project:${workspaceId}`,
  )
  const existing = await tx.project.findFirst({
    where: { workspaceId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (existing) return existing.id

  const project = await tx.project.create({
    data: {
      name: projectName.trim().slice(0, 120) || 'My Project',
      workspaceId,
    },
    select: { id: true },
  })
  return project.id
}

export async function getOrCreateDefaultProjectForOwner(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<{ workspaceId: string; projectId: string }> {
  await tx.$executeRawUnsafe(
    'SELECT pg_advisory_xact_lock(hashtext($1))',
    `workspace-limit:${userId}`,
  )
  let workspace = await tx.workspace.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: 'asc' },
  })
  if (!workspace) {
    workspace = await tx.workspace.create({
      data: {
        name: 'My Workspace',
        slug: `workspace-${userId.slice(0, 8)}-${randomUUID().slice(0, 8)}`,
        ownerId: userId,
      },
    })
  }
  const projectId = await getOrCreateProjectInWorkspace(tx, workspace.id)
  return { workspaceId: workspace.id, projectId }
}
