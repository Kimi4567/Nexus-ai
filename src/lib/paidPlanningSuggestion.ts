export const PAID_PLANNING_PLATFORMS = ['META', 'GOOGLE', 'TIKTOK', 'LINKEDIN'] as const

export type PaidPlanningPlatform = typeof PAID_PLANNING_PLATFORMS[number]

const PLATFORM_ALIASES: Record<PaidPlanningPlatform, RegExp> = {
  META: /\b(meta|facebook|instagram)\b/i,
  GOOGLE: /\bgoogle(?:\s+ads)?\b/i,
  TIKTOK: /\btik\s*tok\b/i,
  LINKEDIN: /\blinked\s*in\b/i,
}

const PLATFORM_LABELS: Record<PaidPlanningPlatform, string> = {
  META: 'Meta Ads',
  GOOGLE: 'Google Ads',
  TIKTOK: 'TikTok Ads',
  LINKEDIN: 'LinkedIn Ads',
}

const OBJECTIVE_ALIASES: Record<string, RegExp> = {
  TRAFFIC: /\b(traffic|website visits?|link clicks?)\b/i,
  CONVERSIONS: /\b(conversions?|purchases?|sales?|checkouts?|sign[ -]?ups?)\b/i,
  LEAD_GENERATION: /\b(leads?|lead generation|inquir(?:y|ies)|form fills?)\b/i,
  BRAND_AWARENESS: /\b(awareness|reach|brand recall)\b/i,
  ENGAGEMENT: /\b(engagement|likes?|comments?|shares?)\b/i,
}

const OBJECTIVE_LABELS: Record<string, string> = {
  TRAFFIC: 'Traffic',
  CONVERSIONS: 'Conversions',
  LEAD_GENERATION: 'Lead generation',
  BRAND_AWARENESS: 'Brand awareness',
  ENGAGEMENT: 'Engagement',
}

export function normalizePaidPlanningPlatform(value: unknown): PaidPlanningPlatform {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return PAID_PLANNING_PLATFORMS.includes(normalized as PaidPlanningPlatform)
    ? normalized as PaidPlanningPlatform
    : 'META'
}

export function normalizePaidPlanningRationale(input: {
  platform: PaidPlanningPlatform
  objective?: string
  rationale: unknown
  locale?: 'ar' | 'en'
}): string {
  const rationale = typeof input.rationale === 'string'
    ? input.rationale.trim().replace(/\s+/g, ' ').slice(0, 600)
    : ''
  const mentionsAnotherPlatform = PAID_PLANNING_PLATFORMS.some(platform => (
    platform !== input.platform && PLATFORM_ALIASES[platform].test(rationale)
  ))
  const normalizedObjective = typeof input.objective === 'string' ? input.objective.toUpperCase() : ''
  const mentionsAnotherObjective = normalizedObjective
    ? Object.entries(OBJECTIVE_ALIASES).some(([objective, pattern]) => (
        objective !== normalizedObjective && pattern.test(rationale)
      ))
    : false

  if (rationale && !mentionsAnotherPlatform && !mentionsAnotherObjective) return rationale

  const objectiveLabel = OBJECTIVE_LABELS[normalizedObjective]
  const objectiveSuffix = objectiveLabel ? ` for ${objectiveLabel}` : ''

  if (input.locale === 'ar') {
    return `${PLATFORM_LABELS[input.platform]} هي قناة التنفيذ المقترحة للهدف المعتمد${objectiveLabel ? ` (${objectiveLabel})` : ''}. راجع الوجهة والحساب والعملة والميزانية قبل إنشاء أي مسودة على المنصة.`
  }
  return `${PLATFORM_LABELS[input.platform]} is the suggested execution channel${objectiveSuffix} in the approved strategy. Confirm the destination, account, currency, and budget before creating any platform draft.`
}

export function selectSinglePaidPlanningAccount<T extends {
  id: string
  platform: string
  status: string
  currency?: string | null
}>(accounts: T[], platform: PaidPlanningPlatform): T | null {
  const matching = accounts.filter(account => (
    account.platform === platform && account.status === 'ACTIVE'
  ))
  return matching.length === 1 ? matching[0] : null
}
