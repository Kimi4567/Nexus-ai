import { describe, expect, it } from 'vitest'
import {
  normalizePaidPlanningPlatform,
  normalizePaidPlanningRationale,
  selectSinglePaidPlanningAccount,
} from '@/lib/paidPlanningSuggestion'

describe('paid planning suggestion truth guards', () => {
  it('normalizes supported platforms and fails closed to a known planning path', () => {
    expect(normalizePaidPlanningPlatform(' google ')).toBe('GOOGLE')
    expect(normalizePaidPlanningPlatform('invented-network')).toBe('META')
  })

  it('replaces a rationale that names platforms other than the selected platform', () => {
    const rationale = normalizePaidPlanningRationale({
      platform: 'GOOGLE',
      rationale: 'Using META and LINKEDIN will reach broad and professional audiences.',
      locale: 'en',
    })

    expect(rationale).toContain('Google Ads is the suggested execution channel')
    expect(rationale).not.toMatch(/META|LINKEDIN/i)
  })

  it('preserves a rationale that is coherent with the selected platform', () => {
    expect(normalizePaidPlanningRationale({
      platform: 'GOOGLE',
      rationale: 'Google Ads supports a search-led planning test for this brief.',
    })).toBe('Google Ads supports a search-led planning test for this brief.')
  })

  it('replaces a rationale that contradicts the approved objective', () => {
    const rationale = normalizePaidPlanningRationale({
      platform: 'GOOGLE',
      objective: 'LEAD_GENERATION',
      rationale: 'Google Ads should optimize purchases and checkout sales.',
    })
    expect(rationale).toContain('for Lead generation')
    expect(rationale).not.toMatch(/purchases|checkout sales/i)
  })

  it('auto-selects only one active account for the suggested platform', () => {
    const googleAccount = { id: 'google-1', platform: 'GOOGLE', status: 'ACTIVE', currency: 'AED' }
    expect(selectSinglePaidPlanningAccount([googleAccount], 'GOOGLE')).toEqual(googleAccount)
    expect(selectSinglePaidPlanningAccount([
      googleAccount,
      { id: 'google-2', platform: 'GOOGLE', status: 'ACTIVE', currency: 'AED' },
    ], 'GOOGLE')).toBeNull()
    expect(selectSinglePaidPlanningAccount([
      { id: 'google-3', platform: 'GOOGLE', status: 'DISCONNECTED', currency: 'AED' },
    ], 'GOOGLE')).toBeNull()
  })
})
