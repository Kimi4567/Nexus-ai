import { describe, expect, it } from 'vitest'
import {
  buildStrategyEvalBrief,
  STRATEGY_QUALITY_CASES,
} from '@/lib/strategy/evals/strategyQualityCases'
import { prepareStrategyGenerationContext } from '@/lib/strategy/strategyQualityPipeline'

describe('strategy quality evaluation corpus', () => {
  it('contains 30 unique cases with the intended language and mode coverage', () => {
    expect(STRATEGY_QUALITY_CASES).toHaveLength(30)
    expect(new Set(STRATEGY_QUALITY_CASES.map(testCase => testCase.id)).size).toBe(30)

    const count = (predicate: (id: (typeof STRATEGY_QUALITY_CASES)[number]) => boolean) =>
      STRATEGY_QUALITY_CASES.filter(predicate).length

    expect(count(testCase => testCase.order.language === 'en')).toBe(15)
    expect(count(testCase => testCase.order.language === 'ar')).toBe(15)
    expect(count(testCase => testCase.order.strategyType === 'organic')).toBe(18)
    expect(count(testCase => testCase.order.strategyType === 'paid')).toBe(6)
    expect(count(testCase => testCase.order.strategyType === 'full')).toBe(6)
  })

  it.each(STRATEGY_QUALITY_CASES)('$id is truth-consistent and generation-ready', testCase => {
    const brief = buildStrategyEvalBrief(testCase)
    const context = prepareStrategyGenerationContext(testCase.brand)

    expect(brief.strategyDeliverables?.supported).toBe(true)
    expect(brief.currentPlatforms).toEqual(testCase.brand.topPlatforms)
    expect(context.capabilities.contentStrategy.ready).toBe(true)
    expect(context.brandContext).toContain(String(testCase.brand.brandName))
    if (testCase.order.strategyType !== 'organic') {
      expect(context.capabilities.paidStrategy.ready).toBe(true)
    }
  })
})
