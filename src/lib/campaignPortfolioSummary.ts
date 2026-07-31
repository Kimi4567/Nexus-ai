import { resolveStrategyScope, type StrategyScopeType } from '@/lib/strategy/strategyScope'
import { isCurrentSentinelReview } from '@/lib/sentinelReviewPolicy'

export interface CampaignPortfolioSummary {
  strategyType: StrategyScopeType | null
  organicPostCount: number | null
  language: 'ar' | 'en' | 'bilingual' | null
  qualityState: 'passed' | 'needs_attention' | 'not_reviewed'
  deliveryState: 'complete' | 'organic_partial' | null
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

export function buildCampaignPortfolioSummary(aiOutput: unknown): CampaignPortfolioSummary {
  const output = record(aiOutput)
  const order = record(output.strategyOrder)
  const deliverables = record(output.strategyDeliverables)
  const rawType = order.strategyType ?? output.strategyType
  const hasSavedScope = rawType === 'organic' || rawType === 'paid' || rawType === 'full'
  const rawCount = output.organicPostCount ?? deliverables.organicPostCount
  const rawLanguage = String(output.language ?? order.language ?? '').toLowerCase()
  const sentinel = record(output.sentinelReview)
  const fulfillment = record(output.strategyFulfillment)

  return {
    strategyType: hasSavedScope ? resolveStrategyScope(output).type : null,
    organicPostCount: typeof rawCount === 'number' && Number.isFinite(rawCount) && rawCount >= 0
      ? Math.floor(rawCount)
      : null,
    language: rawLanguage.startsWith('ar')
      ? 'ar'
      : rawLanguage.startsWith('en')
        ? 'en'
        : rawLanguage === 'bilingual' || rawLanguage === 'both'
          ? 'bilingual'
          : null,
    qualityState: isCurrentSentinelReview(sentinel) && sentinel.status === 'passed'
      ? 'passed'
      : isCurrentSentinelReview(sentinel) && sentinel.status === 'needs_attention'
        ? 'needs_attention'
        : 'not_reviewed',
    deliveryState: fulfillment.status === 'partial'
      && fulfillment.requestedStrategyType === 'full'
      && fulfillment.deliveredStrategyType === 'organic'
      ? 'organic_partial'
      : fulfillment.status === 'complete'
        ? 'complete'
        : null,
  }
}
