export const dynamic = 'force-dynamic'

/**
 * GET /api/agents/suggestions
 * Returns pending agent suggestions for the user's workspace.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { filterCurrentAgentSuggestions } from '@/lib/currentAgentSuggestions'
import { getWorkspaceExecutionTruthByWorkspaceId } from '@/lib/executionTruthService'

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
    const requestedLimit = Number(searchParams.get('limit') || '20')
    const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(100, requestedLimit)) : 20
    const statusFilter = status.toLowerCase() === 'all' ? {} : { status }

    const where = {
      workspaceId: workspace.id,
      ...statusFilter,
      ...(status.toLowerCase() === 'all'
        ? {}
        : { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }),
    }
    const candidates = await (prisma as any).agentSuggestion.findMany({
      where,
      orderBy: [
        { priority: 'asc' },
        { createdAt: 'desc' },
      ],
      // The first 200 are filtered against current execution truth below. This
      // prevents a superseded monitor suggestion from replacing today's action.
      take: Math.max(limit, 200),
    })

    let currentSuggestions = candidates
    if (status.toUpperCase() === 'PENDING') {
      const truth = await getWorkspaceExecutionTruthByWorkspaceId(workspace.id)
      currentSuggestions = filterCurrentAgentSuggestions(candidates, truth)
    }

    const suggestions = currentSuggestions.slice(0, limit)
    const total = currentSuggestions.length

    return NextResponse.json({ suggestions, total })
  } catch (err: any) {
    console.error('[api/agents/suggestions]', err)
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
