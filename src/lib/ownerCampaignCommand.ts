import type { CampaignGoal } from '@prisma/client'

export const OWNER_CAMPAIGN_OUTCOMES = [
  'LEADS',
  'SALES',
  'AWARENESS',
  'TRAFFIC',
] as const satisfies readonly CampaignGoal[]

export type OwnerCampaignOutcome = typeof OWNER_CAMPAIGN_OUTCOMES[number]

export function isOwnerCampaignOutcome(value: unknown): value is OwnerCampaignOutcome {
  return typeof value === 'string'
    && (OWNER_CAMPAIGN_OUTCOMES as readonly string[]).includes(value.toUpperCase())
}

export function ownerCampaignName(input: {
  outcome: OwnerCampaignOutcome
  brandName: string
  language: 'ar' | 'en'
}): string {
  const labels: Record<OwnerCampaignOutcome, { ar: string; en: string }> = {
    LEADS: { ar: 'زيادة العملاء المحتملين', en: 'Lead generation' },
    SALES: { ar: 'زيادة المبيعات', en: 'Sales growth' },
    AWARENESS: { ar: 'بناء الوعي بالعلامة', en: 'Brand awareness' },
    TRAFFIC: { ar: 'زيادة الزيارات', en: 'Traffic growth' },
  }
  const label = labels[input.outcome][input.language]
  return input.language === 'ar'
    ? `${label} — ${input.brandName}`.slice(0, 120)
    : `${input.brandName} — ${label}`.slice(0, 120)
}
