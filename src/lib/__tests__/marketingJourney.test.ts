import { describe, expect, it } from 'vitest'
import {
  MARKETING_JOURNEY,
  getMarketingJourneyStage,
  resolveMarketingJourneyStage,
} from '@/lib/marketingJourney'

describe('marketing journey operating spine', () => {
  it('keeps exactly five ordered user-facing stages', () => {
    expect(MARKETING_JOURNEY.map(stage => stage.id)).toEqual([
      'brand',
      'strategy',
      'production',
      'execution',
      'results',
    ])
    expect(MARKETING_JOURNEY.map(stage => stage.step)).toEqual([1, 2, 3, 4, 5])
  })

  it('opens execution on the decision queue rather than a passive calendar', () => {
    expect(getMarketingJourneyStage('execution').href).toBe('/calendar?tab=queue')
  })

  it.each([
    ['/brand/evidence', 'brand'],
    ['/campaigns/campaign-1?tab=creative', 'strategy'],
    ['/campaigns/campaign-1/content-hub', 'production'],
    ['/studio', 'production'],
    ['/media', 'production'],
    ['/publish', 'execution'],
    ['/automation', 'execution'],
    ['/operations', 'execution'],
    ['/learning', 'results'],
  ] as const)('maps specialist surface %s back to %s', (pathname, expected) => {
    expect(resolveMarketingJourneyStage(pathname)).toBe(expected)
  })

  it('does not pretend cross-cutting account pages are journey stages', () => {
    expect(resolveMarketingJourneyStage('/connections')).toBeNull()
    expect(resolveMarketingJourneyStage('/billing')).toBeNull()
    expect(resolveMarketingJourneyStage('/settings')).toBeNull()
  })
})
