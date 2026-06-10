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

    const suggestions = raw.map((s: any) => ({
      id:           s.id,
      agent:        s.agent,
      type:         s.type,
      status:       s.status,
      priority:     s.priority,
      title:        s.title,
      reasoning:    s.reasoning,
      impact:       s.impact ?? null,
      campaignId:   s.campaignId ?? null,
      campaignName: s.campaignId ? (campaignMap[s.campaignId] ?? null) : null,
      approvedAt:   s.approvedAt ?? null,
      rejectedAt:   s.rejectedAt ?? null,
      executedAt:   s.executedAt ?? null,
      expiresAt:    s.expiresAt ?? null,
      createdAt:    s.createdAt,
    }))

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

/**
 * Apply Brand Brain learning when a suggestion is APPROVED.
 * Returns which BrandProfile fields were updated (empty = no-op).
 *
 * Supported:
 *  STRATEGY        → winningAngles (contentPillars), winningHooks (campaign.topHooks),
 *                    topPlatforms (channelMix), aiInsights (positioning + contentPillars)
 *  Any other type  → winningHooks / winningAngles if explicitly in payload.hooks / payload.angles
 */
async function applyBrandBrainLearning(
  workspaceId: string,
  suggestion: { type: string; payload: unknown; campaignId: string | null }
): Promise<{ brandBrainUpdated: boolean; updatedFields: string[] }> {
  const updatedFields: string[] = []

  try {
    const brandProfile = await prisma.brandProfile.findUnique({ where: { workspaceId } })
    if (!brandProfile) return { brandBrainUpdated: false, updatedFields: [] }

    const payload = suggestion.payload && typeof suggestion.payload === 'object'
      ? suggestion.payload as Record<string, unknown>
      : {}

    // ── Accumulated update object ───────────────────────────────────────────
    let newWinningHooks:  string[] | undefined
    let newWinningAngles: string[] | undefined
    let newTopPlatforms:  string[] | undefined
    let newAiInsights:    ReturnType<typeof mergeAiInsights> | undefined

    if (suggestion.type === 'STRATEGY') {
      const strategy = payload.strategy && typeof payload.strategy === 'object'
        ? payload.strategy as Record<string, unknown>
        : null

      if (strategy) {
        // 1. winningAngles ← strategy.contentPillars
        const pillars = Array.isArray(strategy.contentPillars)
          ? (strategy.contentPillars as string[]).filter(Boolean)
          : []
        if (pillars.length > 0) {
          newWinningAngles = mergeArraySafe(brandProfile.winningAngles, pillars, 20)
          updatedFields.push('winningAngles')
        }

        // 2. topPlatforms ← strategy.channelMix[].platform
        if (Array.isArray(strategy.channelMix)) {
          const platforms = (strategy.channelMix as Array<Record<string, unknown>>)
            .map(c => String(c.platform || '').trim())
            .filter(Boolean)
          if (platforms.length > 0) {
            newTopPlatforms = mergeArraySafe(brandProfile.topPlatforms, platforms, 8)
            updatedFields.push('topPlatforms')
          }
        }

        // 3. aiInsights ← positioning + contentPillars
        const positioning = typeof strategy.positioning === 'string' ? strategy.positioning : ''
        if (positioning || pillars.length > 0) {
          newAiInsights = mergeAiInsights(brandProfile.aiInsights, positioning, pillars)
          updatedFields.push('aiInsights')
        }
      }

      // 4. winningHooks ← Campaign.aiOutput.topHooks (if campaignId present)
      if (suggestion.campaignId) {
        const campaign = await db.campaign.findUnique({
          where: { id: suggestion.campaignId },
          select: { aiOutput: true },
        })
        const aiOutput = campaign?.aiOutput && typeof campaign.aiOutput === 'object'
          ? campaign.aiOutput as Record<string, unknown>
          : null
        const topHooks = Array.isArray(aiOutput?.topHooks)
          ? (aiOutput!.topHooks as string[]).filter(Boolean)
          : []
        if (topHooks.length > 0) {
          newWinningHooks = mergeArraySafe(brandProfile.winningHooks, topHooks, 20)
          updatedFields.push('winningHooks')
        }
      }
    } else {
      // Generic: extract hooks/angles if the payload exposes them explicitly
      if (Array.isArray(payload.hooks)) {
        const hooks = (payload.hooks as unknown[]).map(String).filter(Boolean)
        if (hooks.length > 0) {
          newWinningHooks = mergeArraySafe(brandProfile.winningHooks, hooks, 20)
          updatedFields.push('winningHooks')
        }
      }
      if (Array.isArray(payload.angles)) {
        const angles = (payload.angles as unknown[]).map(String).filter(Boolean)
        if (angles.length > 0) {
          newWinningAngles = mergeArraySafe(brandProfile.winningAngles, angles, 20)
          updatedFields.push('winningAngles')
        }
      }
    }

    if (updatedFields.length === 0) return { brandBrainUpdated: false, updatedFields: [] }

    // ── Single atomic BrandProfile update ───────────────────────────────────
    await prisma.brandProfile.update({
      where: { workspaceId },
      data: {
        ...(newWinningHooks  !== undefined ? { winningHooks:  newWinningHooks  } : {}),
        ...(newWinningAngles !== undefined ? { winningAngles: newWinningAngles } : {}),
        ...(newTopPlatforms  !== undefined ? { topPlatforms:  newTopPlatforms  } : {}),
        ...(newAiInsights    !== undefined ? { aiInsights:    newAiInsights    } : {}),
      },
    })

    return { brandBrainUpdated: true, updatedFields }
  } catch (err) {
    console.error('[applyBrandBrainLearning]', err)
    // Never let a learning error block the approval itself
    return { brandBrainUpdated: false, updatedFields: [] }
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

    // 2. If APPROVED → apply Brand Brain learning (non-blocking on failure)
    let brandBrainUpdated = false
    let updatedFields: string[] = []

    if (status === 'APPROVED') {
      const learning = await applyBrandBrainLearning(workspace.id, {
        type:       existing.type,
        payload:    existing.payload,
        campaignId: existing.campaignId ?? null,
      })
      brandBrainUpdated = learning.brandBrainUpdated
      updatedFields     = learning.updatedFields
    }

    return NextResponse.json({
      ok:                  true,
      suggestionStatus:    updated.status,
      brandBrainUpdated,
      updatedFields,
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
