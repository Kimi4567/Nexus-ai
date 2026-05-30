export const dynamic = 'force-dynamic'

/**
 * GET /api/agents/history
 * Returns the last N agent runs for the user's workspace.
 * Used by the dashboard "Agent Activity" widget.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

// Agent display names — must stay in sync with AGENT_SHORT in dashboard/page.tsx
const AGENT_LABELS: Record<string, string> = {
  STRATEGIST:       '🧠 SAGE',
  CONTENT_DIRECTOR: '🎨 MUSE',
  CAMPAIGN_MANAGER: '⚡ PULSE',
  REPORTING:        '📊 PRISM',
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'asc' },
    })
    if (!workspace) return NextResponse.json({ runs: [] })

    const { searchParams } = new URL(req.url)
    const limit = Number(searchParams.get('limit') || '15')

    const runs = await (prisma as any).agentRun.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        agent: true,
        status: true,
        triggeredBy: true,
        durationMs: true,
        error: true,
        createdAt: true,
        completedAt: true,
        _count: {
          select: {
            suggestions: true,
            reports: true,
          },
        },
      },
    })

    const formatted = runs.map((run: any) => ({
      id: run.id,
      agent: run.agent,
      agentLabel: AGENT_LABELS[run.agent] || run.agent,
      status: run.status,
      triggeredBy: run.triggeredBy || 'system',
      durationMs: run.durationMs || (
        run.completedAt
          ? new Date(run.completedAt).getTime() - new Date(run.createdAt).getTime()
          : null
      ),
      error: run.error,
      suggestionsCreated: run._count?.suggestions || 0,
      reportsCreated: run._count?.reports || 0,
      createdAt: run.createdAt,
      completedAt: run.completedAt,
    }))

    return NextResponse.json({ runs: formatted })
  } catch (err: any) {
    console.error('[api/agents/history]', err)
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
