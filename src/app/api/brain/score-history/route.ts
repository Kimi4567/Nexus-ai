/**
 * GET /api/brain/score-history
 * Returns the last 30 BrainScoreSnapshot records for the user's primary workspace.
 * Used to render the score sparkline on the Brand Brain page.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/apiAuth'

const db = prisma as any // eslint-disable-line @typescript-eslint/no-explicit-any

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'asc' },
    })

    if (!workspace) {
      return NextResponse.json({ snapshots: [] })
    }

    let snapshots: Array<{ score: number; createdAt: Date }> = []
    try {
      snapshots = await db.brainScoreSnapshot.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: { score: true, createdAt: true },
      })
    } catch { /* model may not exist yet — return empty */ }

    return NextResponse.json({ snapshots: snapshots.reverse() })
  } catch (error) {
    console.error('GET /api/brain/score-history error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
