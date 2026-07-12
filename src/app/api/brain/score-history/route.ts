/**
 * GET /api/brain/score-history
 * Returns the last 30 BrainScoreSnapshot records for the user's primary workspace.
 * Used to render the score sparkline on the Brand Brain page.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/apiAuth'

export const dynamic = 'force-dynamic'

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
    let updates: Array<{
      id: string
      field: string
      displayName: string
      icon: string | null
      trigger: string
      proposed: unknown
      reason: string
      status: string
      updatedAt: Date
    }> = []
    try {
      snapshots = await db.brainScoreSnapshot.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: { score: true, createdAt: true },
      })
      updates = await db.brainLearning.findMany({
        where: {
          workspaceId: workspace.id,
          status: { in: ['accepted', 'dismissed'] },
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
        select: {
          id: true,
          field: true,
          displayName: true,
          icon: true,
          trigger: true,
          proposed: true,
          reason: true,
          status: true,
          updatedAt: true,
        },
      })
    } catch { /* model may not exist yet — return empty */ }

    return NextResponse.json({ snapshots: snapshots.reverse(), updates })
  } catch (error) {
    console.error('GET /api/brain/score-history error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
