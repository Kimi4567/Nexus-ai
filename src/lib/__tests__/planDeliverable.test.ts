/**
 * Trust Sprint #4 — content-plan count honesty.
 *
 * The wizard must promise the PER-CAMPAIGN deliverable (what one content-plan run
 * generates), not the monthly quota. getCampaignDeliverable must stay in sync with
 * the backend slot count (PLAN_QUOTAS.postsPerCampaign + videoSlotsPerMonth).
 */

import { describe, it, expect } from 'vitest'
import { getCampaignDeliverable } from '@/lib/planDeliverable'
import { PLAN_QUOTAS } from '@/lib/stripe'

describe('getCampaignDeliverable', () => {
  it('1. per-campaign total matches the backend slot count (postsPerCampaign + videoSlots) for each plan', () => {
    for (const key of ['free', 'starter', 'pro', 'business', 'agency']) {
      const q = PLAN_QUOTAS[key]
      const d = getCampaignDeliverable(key)
      expect(d.imagePosts).toBe(q.postsPerCampaign)
      expect(d.videoSlots).toBe(q.videoSlotsPerMonth)
      expect(d.total).toBe(q.postsPerCampaign + q.videoSlotsPerMonth)
    }
  })

  it('promises the honest per-campaign count, NOT the monthly quota (Growth: 18 generated vs 25/mo)', () => {
    expect(getCampaignDeliverable('GROWTH').total).toBe(18)            // 16 posts + 2 video
    expect(PLAN_QUOTAS['pro'].postsPerMonth).toBe(25)                  // the monthly quota is a different number
    expect(getCampaignDeliverable('GROWTH').total).not.toBe(PLAN_QUOTAS['pro'].postsPerMonth)
  })

  it('display aliases resolve to their canonical plan deliverable', () => {
    expect(getCampaignDeliverable('GROWTH')).toEqual(getCampaignDeliverable('pro'))      // Growth = Pro
    expect(getCampaignDeliverable('AGENCY')).toEqual(getCampaignDeliverable('business')) // Agency = Business
  })

  it('is case-insensitive and falls back safely for unknown plans', () => {
    expect(getCampaignDeliverable('Pro').total).toBe(18)
    expect(getCampaignDeliverable(undefined).total).toBeGreaterThan(0)
    expect(getCampaignDeliverable('mystery-plan').total).toBeGreaterThan(0)
  })
})
