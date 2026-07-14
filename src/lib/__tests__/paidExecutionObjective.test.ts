import { describe, expect, it } from 'vitest'
import {
  googleSearchBiddingMode,
  paidOptimizationGoal,
  paidPlatformSupportsObjective,
} from '@/lib/paidExecutionObjective'

describe('paid execution objective contract', () => {
  it('limits the current Google automation path to Search-compatible objectives', () => {
    expect(paidPlatformSupportsObjective('GOOGLE', 'TRAFFIC')).toBe(true)
    expect(paidPlatformSupportsObjective('GOOGLE', 'LEAD_GENERATION')).toBe(true)
    expect(paidPlatformSupportsObjective('GOOGLE', 'CONVERSIONS')).toBe(true)
    expect(paidPlatformSupportsObjective('GOOGLE', 'BRAND_AWARENESS')).toBe(false)
    expect(paidPlatformSupportsObjective('GOOGLE', 'ENGAGEMENT')).toBe(false)
    expect(paidPlatformSupportsObjective('META', 'ENGAGEMENT')).toBe(true)
  })

  it('maps strategy objectives to matching optimization and Google bidding modes', () => {
    expect(paidOptimizationGoal('LEAD_GENERATION')).toBe('LEAD_GENERATION')
    expect(paidOptimizationGoal('CONVERSIONS')).toBe('CONVERSIONS')
    expect(paidOptimizationGoal('BRAND_AWARENESS')).toBe('REACH')
    expect(googleSearchBiddingMode('TRAFFIC')).toBe('MAXIMIZE_CLICKS')
    expect(googleSearchBiddingMode('LEAD_GENERATION')).toBe('MAXIMIZE_CONVERSIONS')
    expect(googleSearchBiddingMode('BRAND_AWARENESS')).toBeNull()
  })
})
