import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'

async function getUserId(req: Request) {
  return getServerUserId(req)
}

export async function GET(req: Request) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const uploads = await prisma.uploadAudit.findMany({
      where: {
        OR: [
          { userId },
          { workspaceId: { in: await prisma.workspace.findMany({ where: { ownerId: userId }, select: { id: true } }).then((items: { id: string }[]) => items.map((item) => item.id)) } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    return NextResponse.json({ uploads })
  } catch (err) {
    console.error('Upload activity failed', err)
    return NextResponse.json({ error: 'Unable to load activity' }, { status: 500 })
  }
}
