import { describe, expect, it } from 'vitest'
import {
  buildOrganicPartialBrief,
  canPreserveOrganicFromFull,
  organicPartialStrategy,
} from '../strategyPartialDelivery'
import type { BusinessBrief, StrategyOutput } from '@/lib/agents/strategist'
import type { StrategyQualityFailureDiagnostics } from '../strategyQualityPipeline'

function fullBrief(): BusinessBrief {
  return {
    companyName: 'Luma',
    businessType: 'Coffee',
    targetAudience: 'Dubai subscribers',
    monthlyBudget: 0,
    strategyType: 'full',
    language: 'ar',
    organicPostCount: 3,
    strategyOrder: {
      strategyType: 'full',
      durationPreset: '30',
      durationDays: 30,
      contentIntensity: 'light',
      customOrganicPostCount: 7,
      goal: 'leads',
      language: 'ar',
    },
    strategyDeliverables: {
      supported: true,
      planningHorizonDays: 30,
      detailedCalendarDays: 30,
      roadmapMonths: 1,
      organicPostCount: 3,
      requestedOrganicPostCount: 7,
      planCappedOrganicPostCount: 3,
      planCapApplied: true,
      platformVariantCount: 3,
      paidAdAngleCount: 4,
      paidAdVariationCount: 9,
      creativeBriefCount: 4,
      audienceHypothesisCount: 3,
      includedDeliverables: [],
      excludedDeliverables: [],
      userExplanation: '',
      generationInstructions: '',
    },
  }
}

function diagnostics(paths: string[]): StrategyQualityFailureDiagnostics {
  return {
    stage: 'strategy_contract',
    mode: 'full',
    issueCodes: paths.map(path => `weak:${path}`),
    affectedPaths: paths,
    outputCounts: {
      contentDirections: 3,
      weeklyDeliverables: 3,
      audienceHypotheses: 3,
      adAngles: 4,
      adCopies: 8,
      creativeBriefs: 4,
    },
  }
}

describe('Full strategy partial delivery boundary', () => {
  it('preserves organic output only when every failure belongs to paidPlanning', () => {
    expect(canPreserveOrganicFromFull(fullBrief(), diagnostics([
      'paidPlanning.adCopyVariations',
      'strategy.paidPlanning.creativeBriefs[2].cta',
    ]))).toBe(true)

    expect(canPreserveOrganicFromFull(fullBrief(), diagnostics([
      'paidPlanning.adCopyVariations',
      'weeklyExecutionPlan',
    ]))).toBe(false)
  })

  it('rebuilds an organic contract while preserving the existing plan cap', () => {
    const fallback = buildOrganicPartialBrief(fullBrief())
    expect(fallback.strategyType).toBe('organic')
    expect(fallback.strategyOrder?.strategyType).toBe('organic')
    expect(fallback.strategyDeliverables).toMatchObject({
      organicPostCount: 3,
      requestedOrganicPostCount: 7,
      planCappedOrganicPostCount: 3,
      planCapApplied: true,
      paidAdAngleCount: 0,
      paidAdVariationCount: 0,
      creativeBriefCount: 0,
      audienceHypothesisCount: 0,
    })
  })

  it('removes the rejected paid package without mutating the generated document', () => {
    const strategy = { campaignName: 'Full', paidPlanning: { planningOnly: true } } as unknown as StrategyOutput
    const fallback = organicPartialStrategy(strategy)
    expect(fallback.paidPlanning).toBeNull()
    expect(strategy.paidPlanning).toEqual({ planningOnly: true })
  })
})
