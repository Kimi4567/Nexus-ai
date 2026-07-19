export const PAID_EXECUTION_OBJECTIVES = [
  'TRAFFIC',
  'CONVERSIONS',
  'LEAD_GENERATION',
  'BRAND_AWARENESS',
  'ENGAGEMENT',
] as const

export type PaidExecutionObjective = typeof PAID_EXECUTION_OBJECTIVES[number]
export type PaidExecutionPlatform = 'META' | 'GOOGLE' | 'TIKTOK' | 'LINKEDIN'

const GOOGLE_SEARCH_OBJECTIVES = new Set<PaidExecutionObjective>([
  'TRAFFIC',
  'CONVERSIONS',
  'LEAD_GENERATION',
])

export function normalizePaidExecutionObjective(value: unknown): PaidExecutionObjective | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toUpperCase()
  return PAID_EXECUTION_OBJECTIVES.includes(normalized as PaidExecutionObjective)
    ? normalized as PaidExecutionObjective
    : null
}

/**
 * Compatibility reflects what NEXUS can actually execute today, not every
 * objective a provider may support across products that are not implemented.
 * Google automation is Search-only, so awareness and engagement are excluded.
 */
export function paidPlatformSupportsObjective(
  platform: unknown,
  objective: unknown,
): boolean {
  const normalizedObjective = normalizePaidExecutionObjective(objective)
  if (!normalizedObjective || typeof platform !== 'string') return false
  const normalizedPlatform = platform.trim().toUpperCase()
  // Paid API draft creation is implemented only for Meta and Google Search.
  // TikTok and LinkedIn stay planning/export-only until their adapters exist.
  if (!['META', 'GOOGLE'].includes(normalizedPlatform)) return false
  return normalizedPlatform !== 'GOOGLE' || GOOGLE_SEARCH_OBJECTIVES.has(normalizedObjective)
}

export function paidOptimizationGoal(objective: unknown): string | null {
  const normalized = normalizePaidExecutionObjective(objective)
  if (!normalized) return null
  if (normalized === 'TRAFFIC') return 'LINK_CLICKS'
  if (normalized === 'CONVERSIONS') return 'CONVERSIONS'
  if (normalized === 'LEAD_GENERATION') return 'LEAD_GENERATION'
  if (normalized === 'BRAND_AWARENESS') return 'REACH'
  return 'POST_ENGAGEMENT'
}

export function googleSearchBiddingMode(
  objective: unknown,
): 'MAXIMIZE_CLICKS' | 'MAXIMIZE_CONVERSIONS' | null {
  const normalized = normalizePaidExecutionObjective(objective)
  if (!normalized || !GOOGLE_SEARCH_OBJECTIVES.has(normalized)) return null
  return normalized === 'TRAFFIC' ? 'MAXIMIZE_CLICKS' : 'MAXIMIZE_CONVERSIONS'
}
