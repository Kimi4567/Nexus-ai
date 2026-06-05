/**
 * Campaign Memory — Cross-campaign AI learning system
 * ─────────────────────────────────────────────────────────────────────────────
 * Extracts distilled learnings from each campaign's AI output and stores them
 * so future campaigns in the same workspace can build on what worked.
 *
 * Design decisions:
 * - No pgvector at this stage: text-based filtering is enough until we have
 *   hundreds of memories per workspace. Vectors can be added later.
 * - Non-blocking saves: memory writes never slow down the generation pipeline.
 * - Lightweight retrieval: fetch latest 8 memories → filter by goal/tone match.
 * - Graceful degradation: any failure returns empty array, never crashes generation.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { prisma } from '@/lib/prisma'
import type { StrategyOutput } from '@/lib/agents/strategist'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CampaignLearnings {
  topHooks: string[]
  contentAngles: string[]
  keyMessage: string
  positioning: string
  contentPillars: string[]
  winningCTAs: string[]
  audienceInsights: string[]
}

export interface RelevantMemory {
  campaignId?: string
  goal?: string
  tone?: string
  audienceHint?: string
  learnings: CampaignLearnings
  createdAt: Date
}

// ── Save ───────────────────────────────────────────────────────────────────────

/**
 * Extract key learnings from a strategy output and persist them.
 * Called after every successful campaign generation.
 * Non-blocking — errors are swallowed so they never affect the user.
 */
export async function saveCampaignMemory(params: {
  workspaceId: string
  campaignId: string
  goal?: string
  tone?: string
  industry?: string
  audienceHint?: string
  strategy: StrategyOutput
}): Promise<void> {
  try {
    const learnings: CampaignLearnings = {
      topHooks: (params.strategy.topHooks ?? []).slice(0, 5),
      contentAngles: (params.strategy.contentAngles ?? [])
        .concat(
          (params.strategy.contentAnglesDetailed ?? []).map(
            (a: any) => a.angle ?? a.title ?? ''
          )
        )
        .filter(Boolean)
        .slice(0, 8),
      keyMessage: params.strategy.keyMessage ?? '',
      positioning: params.strategy.positioning ?? '',
      contentPillars: (params.strategy.contentPillars ?? []).slice(0, 5),
      winningCTAs: (params.strategy.ctaVariations ?? []).slice(0, 4),
      audienceInsights: (params.strategy.audienceSegments ?? [])
        .concat(
          (params.strategy.audienceSegmentsDetailed ?? []).map(
            (s: any) => s.description ?? s.segment ?? ''
          )
        )
        .filter(Boolean)
        .slice(0, 4),
    }

    // Only save if there's something meaningful
    const hasMeaningfulContent =
      learnings.topHooks.length > 0 ||
      learnings.contentAngles.length > 0 ||
      learnings.positioning.length > 10

    if (!hasMeaningfulContent) return

    await (prisma as any).campaignMemory.create({
      data: {
        workspaceId: params.workspaceId,
        campaignId: params.campaignId,
        goal: params.goal ?? null,
        tone: params.tone ?? null,
        industry: params.industry ?? null,
        audienceHint: params.audienceHint ?? null,
        learnings,
      },
    })

    // Keep memory table lean: delete oldest records if workspace has > 20
    const count = await (prisma as any).campaignMemory.count({
      where: { workspaceId: params.workspaceId },
    })
    if (count > 20) {
      const oldest = await (prisma as any).campaignMemory.findMany({
        where: { workspaceId: params.workspaceId },
        orderBy: { createdAt: 'asc' },
        take: count - 20,
        select: { id: true },
      })
      await (prisma as any).campaignMemory.deleteMany({
        where: { id: { in: oldest.map((m: any) => m.id) } },
      })
    }
  } catch {
    // Non-fatal — memory should never block generation
  }
}

// ── Retrieve ───────────────────────────────────────────────────────────────────

/**
 * Fetch the most relevant past learnings for a new campaign.
 * Returns up to 5 memories, prioritising same goal + tone matches.
 * Returns empty array if no memories exist yet (first campaign, new workspace).
 */
export async function getRelevantMemories(params: {
  workspaceId: string
  goal?: string
  tone?: string
  limit?: number
}): Promise<RelevantMemory[]> {
  try {
    const { workspaceId, goal, tone, limit = 5 } = params

    // Fetch latest 12 memories for this workspace
    const all = await (prisma as any).campaignMemory.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 12,
    })

    if (all.length === 0) return []

    // Score each memory by relevance
    const scored = all.map((m: any) => {
      let score = 0
      if (goal && m.goal === goal) score += 3
      if (tone && m.tone === tone) score += 2
      // Recency bonus: last 3 get +1
      return { ...m, score }
    })

    // Sort: same-goal first, then recency
    scored.sort((a: any, b: any) => b.score - a.score || 0)

    return scored.slice(0, limit).map((m: any) => ({
      campaignId: m.campaignId ?? undefined,
      goal: m.goal ?? undefined,
      tone: m.tone ?? undefined,
      audienceHint: m.audienceHint ?? undefined,
      learnings: m.learnings as CampaignLearnings,
      createdAt: m.createdAt,
    }))
  } catch {
    return []
  }
}

// ── Format for prompt injection ────────────────────────────────────────────────

/**
 * Convert retrieved memories into a concise string for the strategist prompt.
 * Keeps it tight — the AI doesn't need the full JSON, just the key signals.
 */
export function formatMemoriesForPrompt(memories: RelevantMemory[]): string {
  if (memories.length === 0) return ''

  const lines: string[] = [
    '## Past campaign learnings for this brand (build on what worked):',
    '',
  ]

  memories.forEach((m, i) => {
    const label = m.goal ? `Campaign #${i + 1} (${m.goal})` : `Campaign #${i + 1}`
    lines.push(`### ${label}`)

    if (m.learnings.positioning) {
      lines.push(`- Positioning: ${m.learnings.positioning}`)
    }
    if (m.learnings.keyMessage) {
      lines.push(`- Key message: ${m.learnings.keyMessage}`)
    }
    if (m.learnings.topHooks.length > 0) {
      lines.push(`- Top hooks used: ${m.learnings.topHooks.slice(0, 3).join(' | ')}`)
    }
    if (m.learnings.contentAngles.length > 0) {
      lines.push(`- Content angles: ${m.learnings.contentAngles.slice(0, 3).join(' | ')}`)
    }
    if (m.learnings.winningCTAs.length > 0) {
      lines.push(`- CTAs used: ${m.learnings.winningCTAs.slice(0, 2).join(' | ')}`)
    }
    lines.push('')
  })

  lines.push(
    'Use these as a reference to build on strengths and avoid repetition. Evolve — don\'t copy.'
  )

  return lines.join('\n')
}
