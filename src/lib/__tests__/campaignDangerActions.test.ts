import { describe, expect, it } from 'vitest'
import {
  deriveEngineRebuildAvailability,
  ENGINE_REBUILD_CREDIT_COST,
  hasProgressedCampaignPosts,
  isEngineRebuildConfirmationComplete,
} from '../campaignDangerActions'

const confirmed = {
  explicitEngineRebuildConfirmed: true,
  acknowledgedCreditCost: ENGINE_REBUILD_CREDIT_COST,
  acknowledgedOutputOverwrite: true,
}

describe('campaignDangerActions', () => {
  it('locks engine rebuild when scheduled or published posts exist', () => {
    expect(hasProgressedCampaignPosts(['DRAFT', 'SCHEDULED'])).toBe(true)
    expect(hasProgressedCampaignPosts(['PUBLISHED'])).toBe(true)

    const result = deriveEngineRebuildAvailability({
      postStatuses: ['DRAFT', 'SCHEDULED'],
      ...confirmed,
    })

    expect(result.available).toBe(false)
    expect(result.reason).toBe('LOCKED_BY_PROGRESS')
  })

  it('locks engine rebuild when approved posts exist', () => {
    const result = deriveEngineRebuildAvailability({
      postStatuses: ['APPROVED'],
      ...confirmed,
    })

    expect(result.available).toBe(false)
    expect(result.reason).toBe('LOCKED_BY_PROGRESS')
  })

  it('requires explicit confirmation for early campaigns without progressed posts', () => {
    const result = deriveEngineRebuildAvailability({
      postStatuses: ['DRAFT'],
    })

    expect(result.available).toBe(false)
    expect(result.reason).toBe('CONFIRMATION_REQUIRED')
  })

  it('allows rebuild only when there are no progressed posts and all acknowledgements are present', () => {
    const result = deriveEngineRebuildAvailability({
      postStatuses: ['DRAFT'],
      ...confirmed,
    })

    expect(result.available).toBe(true)
    expect(result.reason).toBe('READY')
  })

  it('requires the exact 8-credit acknowledgement', () => {
    expect(isEngineRebuildConfirmationComplete({
      ...confirmed,
      acknowledgedCreditCost: 7,
    })).toBe(false)

    expect(isEngineRebuildConfirmationComplete({
      ...confirmed,
      acknowledgedCreditCost: '8',
    })).toBe(false)
  })
})
