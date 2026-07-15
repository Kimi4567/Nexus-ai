/**
 * /api/suggestions
 *
 * GET  — list AgentSuggestion records for the current user's workspace
 * PATCH — update a suggestion status (APPROVED or REJECTED)
 *
 * No schema change required.
 * Approval records the suggestion workflow decision only. Suggestions must not
 * write performance/winning fields into Brand Brain without analytics-backed evidence.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { getBrandBrainLearningCopy } from '@/lib/brandBrainLearningContract'
import { getResearchSuggestionView, isResearchMonitorPayload } from '@/lib/researchSuggestion'

const db = prisma as any

// ── GET /api/suggestions ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })
    if (!workspace) return NextResponse.json({ suggestions: [] })

    const url = new URL(req.url)
    const limit = Math.min(Number(url.searchParams.get('limit') || '10'), 20)
    // By default show only PENDING (the inbox model — acted-on items disappear)
    // Pass ?status=all to see everything
    const statusFilter = url.searchParams.get('status') === 'all'
      ? undefined
      : { status: 'PENDING' }

    // Fetch suggestions ordered by priority then date
    // Over-fetch so we can deduplicate before trimming to limit
    const rawAll = await db.agentSuggestion.findMany({
      where: { workspaceId: workspace.id, ...statusFilter },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      take: limit * 5, // over-fetch for deduplication
    })

    if (!rawAll.length) return NextResponse.json({ suggestions: [] })

    // Deduplicate: keep only one suggestion per (campaignId + agent) pair.
    // For suggestions without a campaign, keep only one per (agent + title) pair.
    // Always keeps the most recent (already sorted by createdAt desc above).
    const seen = new Set<string>()
    const raw = rawAll.filter((s: any) => {
      const dedupeKey = s.campaignId
        ? `${s.campaignId}:${s.agent}`
        : `nocamp:${s.agent}:${(s.title || '').slice(0, 40)}`
      if (seen.has(dedupeKey)) return false
      seen.add(dedupeKey)
      return true
    }).slice(0, limit)

    // Batch-fetch campaign names for suggestions that have a campaignId
    const campaignIds = [...new Set(
      raw.map((s: any) => s.campaignId).filter(Boolean)
    )] as string[]

    const campaigns = campaignIds.length
      ? await db.campaign.findMany({
          where: { id: { in: campaignIds } },
          select: { id: true, name: true },
        })
      : []

    const campaignMap = Object.fromEntries(
      campaigns.map((c: { id: string; name: string }) => [c.id, c.name])
    )

    const suggestions = raw.map((s: any) => {
      const researchView = getResearchSuggestionView(s.payload)
      return {
        id:           s.id,
        agent:        s.agent,
        type:         s.type,
        status:       s.status,
        priority:     s.priority,
        title:        s.title,
        titleAr:      researchView.titleAr,
        reasoning:    s.reasoning,
        reasoningAr:  researchView.reasoningAr,
        research:     researchView.research,
        impact:       s.impact ?? null,
        campaignId:   s.campaignId ?? null,
        campaignName: s.campaignId ? (campaignMap[s.campaignId] ?? null) : null,
        approvedAt:   s.approvedAt ?? null,
        rejectedAt:   s.rejectedAt ?? null,
        executedAt:   s.executedAt ?? null,
        expiresAt:    s.expiresAt ?? null,
        createdAt:    s.createdAt,
      }
    })

    return NextResponse.json({ suggestions })
  } catch (err: any) {
    console.error('[GET /api/suggestions]', err)
    return NextResponse.json({ error: 'Failed to load suggestions' }, { status: 500 })
  }
}

function getBriefExecutionTarget(payload: unknown): { nextHref?: string; executionLabel?: string } {
  const p = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
  if (p.source !== 'marketing-operating-brief') return {}

  const href = typeof p.href === 'string' && p.href.trim() ? p.href : undefined
  const actionId = typeof p.actionId === 'string' ? p.actionId : ''

  const labelMap: Record<string, string> = {
    'complete-brand-brain': 'Open Brand Brain completion flow',
    'capture-learning': 'Open Brand Brain learning flow',
    'run-full-strategy': 'Open campaign strategy workflow',
    'launch-first-campaign': 'Open campaign creation flow',
    'generate-content-plan': 'Open content plan workflow',
    'schedule-drafts': 'Open scheduling workflow',
    'connect-platforms': 'Open platform connections',
    'create-ab-test': 'Open campaign experiments',
    'inspect-analytics': 'Open analytics',
    'review-suggestions': 'Review agent recommendations',
  }

  return {
    nextHref: href,
    executionLabel: labelMap[actionId] ?? 'Continue recommended workflow',
  }
}

// ── PATCH /api/suggestions ───────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { id, status } = body as { id?: string; status?: string }

    if (!id || !['APPROVED', 'REJECTED'].includes(status ?? '')) {
      return NextResponse.json(
        { error: 'id and status (APPROVED | REJECTED) are required' },
        { status: 400 }
      )
    }

    // Verify ownership via workspace
    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })
    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

    const existing = await db.agentSuggestion.findFirst({
      where: { id, workspaceId: workspace.id },
    })
    if (!existing) return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 })

    const now = new Date()

    // 1. Update suggestion status
    const updated = await db.agentSuggestion.update({
      where: { id },
      data: {
        status,
        approvedAt: status === 'APPROVED' ? now : existing.approvedAt,
        rejectedAt: status === 'REJECTED' ? now : existing.rejectedAt,
      },
    })

    // 2. If APPROVED → expose next action only. Suggestions approval is a
    // reviewed workflow signal; it does not write analytics/performance fields.
    let brandBrainUpdated = false
    let updatedFields: string[] = []
    let signalLabel: string | undefined
    let signalDescription: string | undefined
    let nextHref: string | undefined
    let executionLabel: string | undefined

    if (status === 'APPROVED') {
      if (isResearchMonitorPayload(existing.payload)) {
        signalLabel = 'Research alert marked reviewed'
        signalDescription = 'No Brand Brain update or automatic learning was applied.'
        executionLabel = 'Research reviewed — no automatic learning applied'
      } else {
        const signalCopy = getBrandBrainLearningCopy('approval')
        signalLabel = 'Suggestion approved as a reviewed workflow input'
        signalDescription = `${signalCopy.description} Needs analytics before performance learning.`

        const target = getBriefExecutionTarget(existing.payload)
        nextHref = target.nextHref
        executionLabel = target.executionLabel
      }
    }

    return NextResponse.json({
      ok:                  true,
      suggestionStatus:    updated.status,
      brandBrainUpdated,
      updatedFields,
      signalLabel,
      signalDescription,
      nextHref,
      executionLabel,
      suggestion: { id: updated.id, status: updated.status },
    })
  } catch (err: any) {
    console.error('[PATCH /api/suggestions]', err)
    return NextResponse.json({ error: 'Failed to update suggestion' }, { status: 500 })
  }
}

// ── DELETE /api/suggestions?id=<id> ─────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })
    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

    // Verify ownership before deleting
    const existing = await db.agentSuggestion.findFirst({
      where: { id, workspaceId: workspace.id },
      select: { id: true },
    })
    if (!existing) return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 })

    await db.agentSuggestion.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[DELETE /api/suggestions]', err)
    return NextResponse.json({ error: 'Failed to delete suggestion' }, { status: 500 })
  }
}
