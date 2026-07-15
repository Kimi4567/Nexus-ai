import { describe, expect, it } from 'vitest'
import { hasSavedStrategyContract } from '@/lib/marketing-intelligence'

describe('hasSavedStrategyContract', () => {
  it('ignores failed or metadata-only aiOutput rows', () => {
    expect(hasSavedStrategyContract({ nexusEngine: { status: 'failed' } })).toBe(false)
    expect(hasSavedStrategyContract({ generatedAt: new Date().toISOString() })).toBe(false)
    expect(hasSavedStrategyContract({ strategyOrder: { strategyType: 'organic' } })).toBe(false)
    expect(hasSavedStrategyContract(null)).toBe(false)
  })

  it('accepts a nested strategy with actionable contract evidence', () => {
    expect(hasSavedStrategyContract({ strategy: { contentPillars: ['Proof'] } })).toBe(true)
    expect(hasSavedStrategyContract({ strategy: { measurementPlan: { events: ['lead'] } } })).toBe(true)
  })

  it('accepts a legacy direct strategy shape but rejects unrelated metadata', () => {
    expect(hasSavedStrategyContract({ keyMessage: 'Make the next step clear' })).toBe(true)
    expect(hasSavedStrategyContract({ strategyType: 'organic', language: 'ar' })).toBe(false)
  })
})
