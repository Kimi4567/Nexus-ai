import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'

export async function GET(req: Request) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const workspaces = await prisma.workspace.findMany({
      where: { ownerId: userId },
      select: { id: true },
    })
    const workspaceIds = workspaces.map((w: { id: string }) => w.id)

    const uploads = await prisma.uploadAudit.findMany({
      where: {
        OR: [
          { userId },
          ...(workspaceIds.length > 0 ? [{ workspaceId: { in: workspaceIds } }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    return NextResponse.json({ uploads })
  } catch (err: any) {
    // DB tables may not exist yet — return empty state gracefully
    console.warn('[analytics/activity] DB query failed, returning empty:', err?.message)
    return NextResponse.json({ uploads: [] })
  }
}
