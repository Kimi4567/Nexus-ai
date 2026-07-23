import { describe, expect, it } from 'vitest'
import { getCampaignLimit, getPlannedPostLimit, getWorkspaceLimit, PUBLIC_PAID_PLANS } from '@/lib/commercialPlans'

describe('commercial plan contract', () => {
  it('exposes exactly two paid plans', () => {
    expect(PUBLIC_PAID_PLANS.map((plan) => [plan.name, plan.priceUsd])).toEqual([
      ['Growth', 49],
      ['Autopilot', 99],
    ])
    expect(PUBLIC_PAID_PLANS.map((plan) => ({
      credits: plan.monthlyCredits,
      posts: plan.postsPerMonth,
      postsPerCampaign: plan.postsPerCampaign,
      videoSlots: plan.videoSlotsPerMonth,
      workspaces: plan.workspaces,
      campaigns: plan.campaignLimit,
    }))).toEqual([
      { credits: 60, posts: 16, postsPerCampaign: 16, videoSlots: 2, workspaces: 2, campaigns: 4 },
      { credits: 180, posts: 40, postsPerCampaign: 20, videoSlots: 5, workspaces: 5, campaigns: 12 },
    ])
  })

  it('enforces workspace allowances for public and legacy statuses', () => {
    expect(getWorkspaceLimit('FREE')).toBe(1)
    expect(getWorkspaceLimit('STARTER')).toBe(1)
    expect(getWorkspaceLimit('PRO')).toBe(2)
    expect(getWorkspaceLimit('BUSINESS')).toBe(5)
    expect(getWorkspaceLimit('FREE', 'ADMIN')).toBe(999)
  })

  it('enforces the advertised monthly campaign allowances', () => {
    expect(getCampaignLimit('FREE')).toBe(1)
    expect(getCampaignLimit('STARTER')).toBe(2)
    expect(getCampaignLimit('PRO')).toBe(4)
    expect(getCampaignLimit('BUSINESS')).toBe(12)
    expect(getCampaignLimit('FREE', 'ADMIN')).toBe(999)
  })

  it('enforces the advertised monthly AI-planned-post allowances', () => {
    expect(getPlannedPostLimit('FREE')).toBe(3)
    expect(getPlannedPostLimit('STARTER')).toBe(10)
    expect(getPlannedPostLimit('PRO')).toBe(16)
    expect(getPlannedPostLimit('BUSINESS')).toBe(40)
    expect(getPlannedPostLimit('FREE', 'ADMIN')).toBe(999)
  })
})
