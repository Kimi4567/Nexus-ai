import { describe, expect, it } from 'vitest'
import {
  getStrategyToDraftsJourneyCost,
  STRATEGY_PRICING_DISPLAY_TRUTH,
} from '@/lib/strategy/strategyPricingDisplayTruth'
import { CREDIT_COSTS } from '@/lib/credits'

describe('strategy pricing display truth', () => {
  it('derives Billing examples from the server pricing resolver', () => {
    expect(STRATEGY_PRICING_DISPLAY_TRUTH.trialActivation.cost).toBe(12)
    expect(STRATEGY_PRICING_DISPLAY_TRUTH.paidStandard90.cost).toBe(32)
    expect(STRATEGY_PRICING_DISPLAY_TRUTH.fullStandard90.cost).toBe(46)
    expect(STRATEGY_PRICING_DISPLAY_TRUTH.range).toEqual({ minimum: 12, maximum: 96 })
  })

  it('uses the same review and content-plan costs as the ledger catalog', () => {
    expect(getStrategyToDraftsJourneyCost(
      STRATEGY_PRICING_DISPLAY_TRUTH.trialActivation.cost,
      CREDIT_COSTS.SENTINEL_REVIEW,
      CREDIT_COSTS.CONTENT_PLAN_GENERATION,
    )).toBe(21)
    expect(getStrategyToDraftsJourneyCost(
      STRATEGY_PRICING_DISPLAY_TRUTH.fullStandard90.cost,
      CREDIT_COSTS.SENTINEL_REVIEW,
      CREDIT_COSTS.CONTENT_PLAN_GENERATION,
    )).toBe(55)
  })
})
