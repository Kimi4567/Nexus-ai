import { describe, it, expect } from 'vitest'
import { resolveCampaignCounts } from '../campaignSummary'

describe('resolveCampaignCounts', () => {
  it('uses authoritative API counts when present (the launch bug fix)', () => {
    // Regression: cards must reflect TRUE workspace totals from the API,
    // not the filtered/limited rows array.
    const data = {
      campaigns: [{ status: 'ACTIVE' }], // only 1 row returned (filtered)
      counts: { total: 10, active: 2, draft: 8 },
    }
    expect(resolveCampaignCounts(data)).toEqual({ total: 10, active: 2, draft: 8 })
  })

  it('does not collapse totals to the filtered/paginated row count', () => {
    const data = {
      campaigns: [{ status: 'DRAFT' }, { status: 'DRAFT' }],
      counts: { total: 47, active: 12, draft: 35 },
    }
    expect(resolveCampaignCounts(data).total).toBe(47)
  })

  it('falls back to deriving from rows when API omits counts (older deploys)', () => {
    const data = {
      campaigns: [
        { status: 'ACTIVE' },
        { status: 'ACTIVE' },
        { status: 'DRAFT' },
        { status: 'COMPLETED' },
      ],
    }
    expect(resolveCampaignCounts(data)).toEqual({ total: 4, active: 2, draft: 1 })
  })

  it('returns zeros (never blank/NaN) for empty or missing data', () => {
    expect(resolveCampaignCounts({ campaigns: [], counts: { total: 0, active: 0, draft: 0 } }))
      .toEqual({ total: 0, active: 0, draft: 0 })
    expect(resolveCampaignCounts(null)).toEqual({ total: 0, active: 0, draft: 0 })
    expect(resolveCampaignCounts(undefined)).toEqual({ total: 0, active: 0, draft: 0 })
    expect(resolveCampaignCounts({})).toEqual({ total: 0, active: 0, draft: 0 })
  })

  it('sanitizes malformed count values to safe non-negative integers', () => {
    const data = { counts: { total: 12.9, active: -3, draft: NaN } as any }
    expect(resolveCampaignCounts(data)).toEqual({ total: 12, active: 0, draft: 0 })
  })
})
