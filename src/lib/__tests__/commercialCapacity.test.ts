import { describe, expect, it } from 'vitest'
import { PUBLIC_PAID_PLANS } from '@/lib/commercialPlans'
import {
  FULL_STANDARD_90_DRAFTS,
  FULL_STANDARD_90_TO_DRAFTS_COST,
  quoteFullStandard90DraftCapacity,
} from '@/lib/commercialCapacity'

describe('commercial workflow capacity', () => {
  it('respects credits, campaign allowance, and planned-post allowance together', () => {
    const growth = quoteFullStandard90DraftCapacity(PUBLIC_PAID_PLANS[0])
    const autopilot = quoteFullStandard90DraftCapacity(PUBLIC_PAID_PLANS[1])

    expect(FULL_STANDARD_90_TO_DRAFTS_COST).toBe(55)
    expect(FULL_STANDARD_90_DRAFTS).toBe(16)
    expect(growth.workflows).toBe(1)
    expect(autopilot.capacityByCredits).toBe(3)
    expect(autopilot.capacityByPlannedPosts).toBe(2)
    expect(autopilot.workflows).toBe(2)
    expect(autopilot.limitingConstraints).toContain('planned_posts')
  })
})
