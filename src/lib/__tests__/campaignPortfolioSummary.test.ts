import { describe, expect, it } from 'vitest'
import { buildCampaignPortfolioSummary } from '@/lib/campaignPortfolioSummary'

describe('campaign portfolio summary', () => {
  it('uses the reviewed order and preserves exact saved count, language, and quality state', () => {
    expect(buildCampaignPortfolioSummary({
      strategyType: 'organic',
      strategyOrder: { strategyType: 'full', language: 'bilingual' },
      strategyDeliverables: { organicPostCount: 16 },
      sentinelReview: { status: 'needs_attention' },
    })).toEqual({
      strategyType: 'full',
      organicPostCount: 16,
      language: 'bilingual',
      qualityState: 'needs_attention',
      deliveryState: null,
    })
  })

  it('does not invent scope or language for legacy records without a saved contract', () => {
    expect(buildCampaignPortfolioSummary({})).toEqual({
      strategyType: null,
      organicPostCount: null,
      language: null,
      qualityState: 'not_reviewed',
      deliveryState: null,
    })
  })

  it('exposes an organic-only partial delivery from a requested Full run', () => {
    expect(buildCampaignPortfolioSummary({
      strategyOrder: { strategyType: 'organic', language: 'ar' },
      strategyDeliverables: { organicPostCount: 3 },
      strategyFulfillment: {
        status: 'partial',
        requestedStrategyType: 'full',
        deliveredStrategyType: 'organic',
      },
    })).toMatchObject({
      strategyType: 'organic',
      organicPostCount: 3,
      deliveryState: 'organic_partial',
    })
  })
})
