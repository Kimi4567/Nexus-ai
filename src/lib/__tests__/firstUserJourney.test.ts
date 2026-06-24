import { describe, it, expect } from 'vitest'
import { getFirstUserJourneyStep } from '../firstUserJourney'

describe('getFirstUserJourneyStep', () => {
  it('no Brand Brain → complete Brand Brain', () => {
    const step = getFirstUserJourneyStep({
      brandBrainReady: false,
      strategyState: 'none',
      hasCampaignOrContent: false,
      hasContent: false,
      contentApproved: false,
    })
    expect(step.id).toBe('COMPLETE_BRAND_BRAIN')
  })

  it('Brand Brain ready + no strategy → create first strategy', () => {
    const step = getFirstUserJourneyStep({
      brandBrainReady: true,
      strategyState: 'none',
      hasCampaignOrContent: false,
      hasContent: false,
      contentApproved: false,
    })
    expect(step.id).toBe('CREATE_FIRST_STRATEGY')
  })

  it('draft strategy → review draft strategy', () => {
    const step = getFirstUserJourneyStep({
      brandBrainReady: true,
      strategyState: 'draft',
      hasCampaignOrContent: true,
      hasContent: false,
      contentApproved: false,
    })
    expect(step.id).toBe('REVIEW_DRAFT_STRATEGY')
  })

  it('approved strategy + no campaign/content → create campaign/content plan', () => {
    const step = getFirstUserJourneyStep({
      brandBrainReady: true,
      strategyState: 'approved',
      hasCampaignOrContent: false,
      hasContent: false,
      contentApproved: false,
    })
    expect(step.id).toBe('CREATE_CAMPAIGN_CONTENT_PLAN')
  })

  it('content not approved → review and approve content', () => {
    const step = getFirstUserJourneyStep({
      brandBrainReady: true,
      strategyState: 'approved',
      hasCampaignOrContent: true,
      hasContent: true,
      contentApproved: false,
    })
    expect(step.id).toBe('REVIEW_APPROVE_CONTENT')
  })

  it('approved content → check publish readiness', () => {
    const step = getFirstUserJourneyStep({
      brandBrainReady: true,
      strategyState: 'approved',
      hasCampaignOrContent: true,
      hasContent: true,
      contentApproved: true,
    })
    expect(step.id).toBe('CHECK_PUBLISH_READINESS')
  })
})
