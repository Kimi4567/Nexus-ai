import { describe, expect, it } from 'vitest'
import {
  deriveCampaignEngineState,
  resolveSavedStrategyContractContext,
} from '@/lib/campaign-engine'
import { SENTINEL_REVIEW_POLICY_VERSION } from '@/lib/sentinelReviewPolicy'

describe('campaign engine saved strategy contract', () => {
  it('keeps the original organic direction count during a rebuild', () => {
    expect(resolveSavedStrategyContractContext({
      strategyType: 'organic',
      organicPostCount: 10,
      strategyDeliverables: { organicPostCount: 10, paidAdVariationCount: 0 },
    })).toEqual({
      strategyType: 'organic',
      organicPostCount: 10,
      strategyDeliverables: { organicPostCount: 10, paidAdVariationCount: 0 },
    })
  })

  it('recovers the binding count from saved deliverables for older campaigns', () => {
    expect(resolveSavedStrategyContractContext({
      strategyType: 'full',
      strategyDeliverables: { organicPostCount: 16, paidAdVariationCount: 4 },
    })).toMatchObject({
      strategyType: 'full',
      organicPostCount: 16,
    })
  })

  it('defaults invalid legacy values to a safe organic contract', () => {
    expect(resolveSavedStrategyContractContext({
      strategyType: 'unknown',
      organicPostCount: 0,
      strategyDeliverables: [],
    })).toEqual({
      strategyType: 'organic',
      organicPostCount: null,
      strategyDeliverables: null,
    })
  })

  it('does not treat an old Sentinel pass as current execution evidence', () => {
    const stale = deriveCampaignEngineState({
      status: 'DRAFT',
      aiOutput: {
        strategy: { positioning: 'Reviewed direction' },
        creativeBrief: { direction: 'Reviewable visual concept' },
        calendarItems: [{ topic: 'Reviewable topic' }],
        qualityGate: { schemaVersion: 1, status: 'passed', blockers: [] },
        sentinelReview: { status: 'passed' },
      },
    })
    const current = deriveCampaignEngineState({
      status: 'DRAFT',
      aiOutput: {
        strategy: { positioning: 'Reviewed direction' },
        creativeBrief: { direction: 'Reviewable visual concept' },
        calendarItems: [{ topic: 'Reviewable topic' }],
        qualityGate: { schemaVersion: 1, status: 'passed', blockers: [] },
        sentinelReview: {
          status: 'passed',
          policyVersion: SENTINEL_REVIEW_POLICY_VERSION,
        },
      },
    })

    expect(stale.steps.find((step) => step.key === 'sentinel')?.status).toBe('pending')
    expect(stale.steps.find((step) => step.key === 'approval')?.status).toBe('blocked')
    expect(current.steps.find((step) => step.key === 'sentinel')?.status).toBe('done')
    expect(current.steps.find((step) => step.key === 'approval')?.status).toBe('pending')
  })
})
