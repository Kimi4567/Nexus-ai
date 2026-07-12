/**
 * Brand learning proposal helper.
 *
 * Durable Brand Brain memory is intentionally conservative:
 * - platform performance is handled by performanceEvidence + fetch-analytics;
 * - generated strategies, generated content, Sentinel output, news, and trends
 *   are not evidence and therefore cannot become "winning" memory;
 * - an explicit A/B draft selection can become a reviewable creative-preference
 *   note, never an audience-performance claim.
 *
 * This helper performs no model call and creates no uncovered background COGS.
 */

import { prisma } from '@/lib/prisma'
import { extractOpeningHook } from '@/lib/performanceEvidence'

export interface BrainLearningParams {
  workspaceId: string
  campaignId?: string
  trigger:
    | 'strategy'
    | 'approved_content'
    | 'post_performance'
    | 'ab_winner'
    | 'sentinel_insight'
    | 'competitor_monitor'
    | 'industry_trend'
  payload: Record<string, unknown>
}

type Variant = {
  caption?: unknown
  platform?: unknown
  variantLabel?: unknown
}

function asVariant(value: unknown): Variant | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Variant
    : null
}

function cleanText(value: unknown, max = 120): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

/**
 * Returns the number of reviewable proposals actually created.
 */
export async function runBrainLearning(params: BrainLearningParams): Promise<number> {
  if (params.trigger !== 'ab_winner') {
    // Performance proposals have their own provenance-enforced path. All other
    // inputs are operational or generated context, not durable evidence.
    return 0
  }

  const winner = asVariant(params.payload.winner)
  const loser = asVariant(params.payload.loser)
  const winnerCaption = cleanText(winner?.caption, 800)
  const loserCaption = cleanText(loser?.caption, 800)
  if (!winnerCaption || !loserCaption) return 0

  const selectedHook = extractOpeningHook(winnerCaption)
  const otherHook = extractOpeningHook(loserCaption)
  if (!selectedHook || !otherHook || selectedHook.toLocaleLowerCase() === otherHook.toLocaleLowerCase()) {
    return 0
  }

  const platform = cleanText(winner?.platform, 30) || 'UNKNOWN'
  const selectedVariant = cleanText(winner?.variantLabel, 10) || 'A'
  const otherVariant = cleanText(loser?.variantLabel, 10) || 'B'
  const note = `Creative preference (not performance evidence): selected variant ${selectedVariant} opening “${selectedHook}” over variant ${otherVariant} opening “${otherHook}” for ${platform}.`

  try {
    await (prisma.brainLearning as any).create({
      data: {
        workspaceId: params.workspaceId,
        campaignId: params.campaignId ?? null,
        trigger: 'ab_winner',
        field: 'strategicNotes',
        displayName: 'Creative preference note',
        icon: '🧪',
        current: null,
        proposed: note,
        reason: 'You selected one draft over another. This records your creative preference for review; it does not claim audience, conversion, or revenue performance.',
        status: 'pending',
      },
    })
    return 1
  } catch (error) {
    console.error('[brain-learning] preference proposal failed:', error)
    return 0
  }
}
