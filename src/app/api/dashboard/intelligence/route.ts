import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { buildMarketingIntelligenceBrief } from '@/lib/marketing-intelligence'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const brief = await buildMarketingIntelligenceBrief(userId)
    return NextResponse.json({ brief })
  } catch (err) {
    console.error('[dashboard/intelligence]', err)
    return NextResponse.json({ error: 'Failed to load marketing intelligence' }, { status: 500 })
  }
}

function suggestionSpec(actionId: string): {
  agent: 'STRATEGIST' | 'CONTENT_DIRECTOR' | 'CAMPAIGN_MANAGER' | 'REPORTING'
  type: 'STRATEGY' | 'CONTENT_SWAP' | 'BUDGET_CHANGE' | 'AUDIENCE_SHIFT' | 'PLATFORM_ADD' | 'PLATFORM_PAUSE' | 'CAMPAIGN_PAUSE' | 'CAMPAIGN_LAUNCH'
  priority: 1 | 2 | 3
} {
  switch (actionId) {
    case 'complete-brand-brain':
    case 'capture-learning':
      return { agent: 'STRATEGIST', type: 'STRATEGY', priority: 1 }
    case 'launch-first-campaign':
      return { agent: 'STRATEGIST', type: 'CAMPAIGN_LAUNCH', priority: 1 }
    case 'generate-content-plan':
    case 'schedule-drafts':
    case 'create-ab-test':
      return { agent: 'CONTENT_DIRECTOR', type: 'CONTENT_SWAP', priority: 2 }
    case 'connect-platforms':
      return { agent: 'CAMPAIGN_MANAGER', type: 'PLATFORM_ADD', priority: 2 }
    case 'inspect-analytics':
    case 'review-suggestions':
    default:
      return { agent: 'REPORTING', type: 'CONTENT_SWAP', priority: 3 }
  }
}

export async function POST(req: NextRequest) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })
    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

    const brief = await buildMarketingIntelligenceBrief(userId)
    const selected = brief.nextBestAction
    const spec = suggestionSpec(selected.id)
    const db = prisma as any

    const existing = await db.agentSuggestion.findFirst({
      where: {
        workspaceId: workspace.id,
        status: 'PENDING',
        title: selected.title,
      },
      select: { id: true },
    })

    if (existing) {
      return NextResponse.json({ ok: true, created: false, suggestionId: existing.id })
    }

    const agentRun = await db.agentRun.create({
      data: {
        workspaceId: workspace.id,
        agent: spec.agent,
        status: 'COMPLETED',
        triggeredBy: 'dashboard-intelligence',
        inputData: { source: 'marketing-operating-brief', actionId: selected.id },
        outputData: {
          maturityScore: brief.maturityScore,
          stage: brief.stage,
          loop: brief.loop,
          nextBestAction: selected,
        },
        completedAt: new Date(),
      },
      select: { id: true },
    })

    const suggestion = await db.agentSuggestion.create({
      data: {
        workspaceId: workspace.id,
        agentRunId: agentRun.id,
        agent: spec.agent,
        type: spec.type,
        status: 'PENDING',
        priority: spec.priority,
        title: selected.title,
        reasoning: selected.reason,
        impact: `Expected: improve NEXUS operating maturity from ${brief.maturityScore}/100 by closing the next weakest loop.`,
        payload: {
          source: 'marketing-operating-brief',
          actionId: selected.id,
          href: selected.href,
          titleAr: selected.titleAr,
          reasonAr: selected.reasonAr,
          maturityScore: brief.maturityScore,
          loop: brief.loop,
        },
        expiresAt: new Date(Date.now() + 7 * 86_400_000),
      },
      select: { id: true },
    })

    return NextResponse.json({ ok: true, created: true, suggestionId: suggestion.id })
  } catch (err) {
    console.error('[dashboard/intelligence POST]', err)
    return NextResponse.json({ error: 'Failed to create intelligence recommendation' }, { status: 500 })
  }
}
