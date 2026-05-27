/**
 * GET /api/agents/suggestions
 * Returns pending agent suggestions for the user's workspace.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'asc' },
    })
    if (!workspace) return NextResponse.json({ suggestions: [] })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'PENDING'
    const limit = Number(searchParams.get('limit') || '20')

    const suggestions = await (prisma as any).agentSuggestion.findMany({
      where: {
        workspaceId: workspace.id,
        status,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: [
        { priority: 'asc' },
        { createdAt: 'desc' },
      ],
      take: limit,
    })

    return NextResponse.json({ suggestions })
  } catch (err: any) {
    console.error('[api/agents/suggestions]', err)
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
