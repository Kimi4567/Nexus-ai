/**
 * /api/suggestions
 *
 * GET  — list AgentSuggestion records for the current user's workspace
 * PATCH — update a suggestion status (APPROVED or REJECTED)
 *
 * No schema change required.
 * Brand Brain update on APPROVE is deferred to Sprint C (suggestion only
 * changes status for now — the foundation is in place).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

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
    const showAll = url.searchParams.get('status') === 'all'
    const statusFilter = showAll
      ? undefined
      : { status: 'PENDING' }

    // Fetch suggestions ordered by priority then date
    // Over-fetch so we can deduplicate before trimming to limit
    const rawAll = await db.agentSuggestion.findMany({
      where: {
        workspaceId: workspace.id,
        ...statusFilter,
        ...(!showAll ? { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } : {}),
      },
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
      const payload = s.payload && typeof s.payload === 'object' && !Array.isArray(s.payload)
        ? s.payload as Record<string, unknown>
        : {}
      const isResearch = ['market-research-monitor', 'industry-research-monitor'].includes(String(payload.source ?? ''))
      const researchItems = isResearch && Array.isArray(payload.items)
        ? payload.items.slice(0, 15).flatMap((item) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) return []
            const record = item as Record<string, unknown>
            const url = typeof record.url === 'string' && /^https:\/\//i.test(record.url) ? record.url : ''
            const title = typeof record.title === 'string' ? record.title.slice(0, 200) : ''
            if (!title || !url) return []
            return [{
              title,
              url,
              source: typeof record.source === 'string' ? record.source.slice(0, 100) : '',
              publishedAt: typeof record.publishedAt === 'string' ? record.publishedAt : '',
            }]
          })
        : []
      return {
        id:           s.id,
        agent:        s.agent,
        type:         s.type,
        status:       s.status,
        priority:     s.priority,
        title:        s.title,
        titleAr:      typeof payload.titleAr === 'string' ? payload.titleAr : null,
        reasoning:    s.reasoning,
        reasoningAr:  typeof payload.reasoningAr === 'string'
          ? payload.reasoningAr
          : typeof payload.reasonAr === 'string' ? payload.reasonAr : null,
        impact:       s.impact ?? null,
        campaignId:   s.campaignId ?? null,
        campaignName: s.campaignId ? (campaignMap[s.campaignId] ?? null) : null,
        approvedAt:   s.approvedAt ?? null,
        rejectedAt:   s.rejectedAt ?? null,
        executedAt:   s.executedAt ?? null,
        expiresAt:    s.expiresAt ?? null,
        createdAt:    s.createdAt,
        research: isResearch ? {
          kind: payload.researchKind === 'competitor' ? 'competitor' : 'industry',
          items: researchItems,
          autoLearningApplied: false,
        } : null,
      }
    })

    return NextResponse.json({ suggestions })
  } catch (err: any) {
    console.error('[GET /api/suggestions]', err)
    return NextResponse.json({ error: 'Failed to load suggestions' }, { status: 500 })
  }
}

// ── Brand Brain learning helpers ─────────────────────────────────────────────

/**
 * Merge incoming strings into an existing array.
 * Deduplicates (case-insensitive trim), preserves order (newest first),
 * and caps at `max` items to keep the Brain lean.
 */
function mergeArraySafe(existing: string[], incoming: string[], max = 20): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of [...incoming, ...existing]) {
    const key = String(item).trim().toLowerCase()
    if (!key) continue
    if (seen.has(key)) continue
    seen.add(key)
    result.push(String(item).trim())
  }
  return result.slice(0, max)
}

/**
 * Merge new summary + recommendations into the existing aiInsights JSON blob.
 * Preserves old summary if no new one; deduplicates recommendations; stamps timestamp.
 */
function mergeAiInsights(
  existing: unknown,
  newSummary: string,
  newRecommendations: string[]
): { summary: string; recommendations: string[]; lastUpdated: string } {
  const ex = existing && typeof existing === 'object' ? existing as Record<string, unknown> : {}
  const existingRecs = Array.isArray(ex.recommendations)
    ? (ex.recommendations as string[])
    : []
  return {
    summary:         newSummary || (typeof ex.summary === 'string' ? ex.summary : ''),
    recommendations: mergeArraySafe(existingRecs, newRecommendations, 10),
    lastUpdated:     new Date().toISOString(),
  }
}

function getSuggestionExecutionTarget(payload: unknown): { nextHref?: string; executionLabel?: string } {
  const p = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
  if (!['marketing-operating-brief', 'execution-monitor'].includes(String(p.source ?? ''))) return {}

  const href = typeof p.href === 'string' && p.href.trim() ? p.href : undefined
  if (p.source === 'execution-monitor') {
    const actionKind = typeof p.actionKind === 'string' ? p.actionKind : 'recommended workflow'
    return { nextHref: href, executionLabel: `Open ${actionKind.toLowerCase().replace(/_/g, ' ')}` }
  }
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

/**
 * AgentSuggestion approval is an operational decision, never performance
 * evidence. Strategy drafts, monitor reminders, and research alerts therefore
 * cannot write "winning" Brand Brain fields. Verified learning uses the
 * BrainLearning proposal route, whose producer enforces platform provenance.
 */
async function applyBrandBrainLearning(
  _workspaceId: string,
  _suggestion: { type: string; payload: unknown; campaignId: string | null }
): Promise<{ brandBrainUpdated: boolean; updatedFields: string[] }> {
  return { brandBrainUpdated: false, updatedFields: [] }
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

    // 2. If APPROVED → apply Brand Brain learning (non-blocking on failure)
    let brandBrainUpdated = false
    let updatedFields: string[] = []
    let nextHref: string | undefined
    let executionLabel: string | undefined

    if (status === 'APPROVED') {
      const learning = await applyBrandBrainLearning(workspace.id, {
        type:       existing.type,
        payload:    existing.payload,
        campaignId: existing.campaignId ?? null,
      })
      brandBrainUpdated = learning.brandBrainUpdated
      updatedFields     = learning.updatedFields

      const target = getSuggestionExecutionTarget(existing.payload)
      nextHref = target.nextHref
      executionLabel = target.executionLabel
    }

    return NextResponse.json({
      ok:                  true,
      suggestionStatus:    updated.status,
      brandBrainUpdated,
      updatedFields,
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
