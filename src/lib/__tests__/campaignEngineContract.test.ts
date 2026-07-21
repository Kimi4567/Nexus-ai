import { describe, expect, it } from 'vitest'
import { resolveSavedStrategyContractContext } from '@/lib/campaign-engine'

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
})
