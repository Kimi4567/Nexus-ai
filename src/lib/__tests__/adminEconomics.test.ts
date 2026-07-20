import { describe, expect, it } from 'vitest'
import { summarizeProviderEconomics } from '@/lib/adminEconomics'

describe('summarizeProviderEconomics', () => {
  it('includes measured refunded provider loss but excludes it from commercial value', () => {
    const summary = summarizeProviderEconomics([
      { action: 'VIDEO_GENERATION', status: 'SETTLED', creditCost: 18, providerCostUsd: '3.44' },
      { action: 'RUN_FULL_STRATEGY', status: 'SETTLED', creditCost: 24, providerCostUsd: 0.1 },
      { action: 'CONTENT_PLAN_GENERATION', status: 'SETTLED', creditCost: 6, providerCostUsd: null },
      { action: 'VIDEO_GENERATION', status: 'REFUNDED', creditCost: 18, providerCostUsd: 3.44 },
      { action: 'VIDEO_GENERATION', status: 'RESERVED', creditCost: 18, providerCostUsd: 3.44 },
      { action: 'REFUND', status: 'SETTLED', creditCost: 0, providerCostUsd: 9 },
    ])

    expect(summary.billableOperations).toBe(3)
    expect(summary.meteredOperations).toBe(3)
    expect(summary.unmeteredOperations).toBe(1)
    expect(summary.meterCoveragePercent).toBe(75)
    expect(summary.refundedOperations).toBe(1)
    expect(summary.meteredRefundedOperations).toBe(1)
    expect(summary.settledCredits).toBe(48)
    expect(summary.meteredCredits).toBe(42)
    expect(summary.settledProviderCostUsd).toBe(3.54)
    expect(summary.failedProviderCostUsd).toBe(3.44)
    expect(summary.providerCostUsd).toBe(6.98)
    expect(summary.commercialValueFloorUsd).toBe(23.1)
    expect(summary.contributionBufferUsd).toBe(16.12)
    expect(summary.breakdown[0]).toEqual(expect.objectContaining({
      action: 'VIDEO_GENERATION',
      providerCostUsd: 6.88,
      failedProviderCostUsd: 3.44,
      refundedOperations: 1,
    }))
  })

  it('reports complete coverage and no invented margin when no billable work exists', () => {
    const summary = summarizeProviderEconomics([])
    expect(summary.meterCoveragePercent).toBe(100)
    expect(summary.contributionMarginPercent).toBeNull()
  })
})
