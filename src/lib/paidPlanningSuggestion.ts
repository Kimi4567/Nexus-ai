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

export function normalizePaidPlanningPlatform(value: unknown): PaidPlanningPlatform {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return PAID_PLANNING_PLATFORMS.includes(normalized as PaidPlanningPlatform)
    ? normalized as PaidPlanningPlatform
    : 'META'
}

export function normalizePaidPlanningRationale(input: {
  platform: PaidPlanningPlatform
  rationale: unknown
  locale?: 'ar' | 'en'
}): string {
  const rationale = typeof input.rationale === 'string'
    ? input.rationale.trim().replace(/\s+/g, ' ').slice(0, 600)
    : ''
  const mentionsAnotherPlatform = PAID_PLANNING_PLATFORMS.some(platform => (
    platform !== input.platform && PLATFORM_ALIASES[platform].test(rationale)
  ))

  if (rationale && !mentionsAnotherPlatform) return rationale

  if (input.locale === 'ar') {
    return `${PLATFORM_LABELS[input.platform]} هي منصة التخطيط المقترحة وفق سياق Brand Brain. راجع الوجهة والجمهور والعملة والميزانية قبل إنشاء أي مسودة على المنصة.`
  }
  return `${PLATFORM_LABELS[input.platform]} is the suggested planning channel from the Brand Brain context. Confirm the destination, audience, currency, and budget before creating any platform draft.`
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
