import { describe, expect, it } from 'vitest'
import { getCampaignLimit, getPlannedPostLimit, getWorkspaceLimit, PUBLIC_PAID_PLANS } from '@/lib/commercialPlans'

describe('commercial plan contract', () => {
  it('exposes exactly two paid plans', () => {
    expect(PUBLIC_PAID_PLANS.map((plan) => [plan.name, plan.priceUsd])).toEqual([
      ['Growth', 49],
      ['Autopilot', 99],
    ])
  })

  it('enforces workspace allowances for public and legacy statuses', () => {
    expect(getWorkspaceLimit('FREE')).toBe(1)
    expect(getWorkspaceLimit('STARTER')).toBe(1)
    expect(getWorkspaceLimit('PRO')).toBe(3)
    expect(getWorkspaceLimit('BUSINESS')).toBe(10)
    expect(getWorkspaceLimit('FREE', 'ADMIN')).toBe(999)
  })

  it('enforces the advertised monthly campaign allowances', () => {
    expect(getCampaignLimit('FREE')).toBe(1)
    expect(getCampaignLimit('STARTER')).toBe(2)
    expect(getCampaignLimit('PRO')).toBe(10)
    expect(getCampaignLimit('BUSINESS')).toBe(999)
    expect(getCampaignLimit('FREE', 'ADMIN')).toBe(999)
  })

  it('enforces the advertised monthly AI-planned-post allowances', () => {
    expect(getPlannedPostLimit('FREE')).toBe(3)
    expect(getPlannedPostLimit('STARTER')).toBe(10)
    expect(getPlannedPostLimit('PRO')).toBe(25)
    expect(getPlannedPostLimit('BUSINESS')).toBe(60)
    expect(getPlannedPostLimit('FREE', 'ADMIN')).toBe(999)
  })
})
