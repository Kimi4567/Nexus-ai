import { describe, it, expect } from 'vitest'
import { getFirstRunJourney, getFirstUserJourneyStep } from '../firstUserJourney'

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

describe('getFirstRunJourney', () => {
  it('no workspace -> onboarding', () => {
    const decision = getFirstRunJourney({
      hasWorkspace: false,
      brandBrainReady: false,
    })

    expect(decision.state).toBe('no_workspace')
    expect(decision.href).toBe('/onboarding')
  })

  it('workspace but no brand profile -> Brand Brain setup', () => {
    const decision = getFirstRunJourney({
      hasWorkspace: true,
      hasBrandProfile: false,
      brandBrainReady: false,
    })

    expect(decision.state).toBe('brand_missing')
    expect(decision.href).toBe('/brand')
  })

  it('brand profile but readiness false -> continue Brand Brain', () => {
    const decision = getFirstRunJourney({
      hasWorkspace: true,
      hasBrandProfile: true,
      brandBrainReady: false,
    })

    expect(decision.state).toBe('brand_partial')
    expect(decision.href).toBe('/brand')
  })

  it('brand ready + no strategy/campaign -> initial Strategy entry', () => {
    const decision = getFirstRunJourney({
      hasWorkspace: true,
      hasBrandProfile: true,
      brandBrainReady: true,
      strategyState: 'none',
      hasCampaignOrContent: false,
      hasContent: false,
      contentApproved: false,
    })

    expect(decision.state).toBe('brand_ready_for_initial_strategy')
    expect(decision.href).toBe('/strategy')
  })

  it('draft strategy -> review draft strategy', () => {
    const decision = getFirstRunJourney({
      hasWorkspace: true,
      hasBrandProfile: true,
      brandBrainReady: true,
      strategyState: 'draft',
      hasCampaignOrContent: true,
      hasContent: false,
      contentApproved: false,
    })

    expect(decision.state).toBe('strategy_draft_ready')
    expect(decision.href).toBe('/strategy')
  })

  it('approved strategy but no content -> content plan', () => {
    const decision = getFirstRunJourney({
      hasWorkspace: true,
      hasBrandProfile: true,
      brandBrainReady: true,
      strategyState: 'approved',
      hasCampaignOrContent: true,
      hasContent: false,
      contentApproved: false,
    })

    expect(decision.state).toBe('content_plan_missing')
    expect(decision.href).toBe('/content-hub')
  })

  it('content exists but is not approved -> content review, not publishing readiness', () => {
    const decision = getFirstRunJourney({
      hasWorkspace: true,
      hasBrandProfile: true,
      brandBrainReady: true,
      strategyState: 'approved',
      hasCampaignOrContent: true,
      hasContent: true,
      contentApproved: false,
    })

    expect(decision.state).toBe('content_review_needed')
    expect(decision.href).toBe('/content-hub')
    expect(decision.title).toBe('Review content plan')
    expect(decision.blockedBy).toEqual(['content_review'])
  })

  it('content approved -> execution readiness later', () => {
    const decision = getFirstRunJourney({
      hasWorkspace: true,
      hasBrandProfile: true,
      brandBrainReady: true,
      strategyState: 'approved',
      hasCampaignOrContent: true,
      hasContent: true,
      contentApproved: true,
    })

    expect(decision.state).toBe('execution_ready_later')
    expect(decision.href).toBe('/connections')
  })
})
