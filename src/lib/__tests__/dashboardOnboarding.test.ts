/**
 * Trust Sprint #7 — dashboard onboarding consolidation.
 *
 * The dashboard used to show the Welcome banner + full OnboardingChecklist +
 * MarketingJourneyBar at once, none keyed off real user state, so established
 * users saw beginner clutter and the surfaces flickered while the brand fetch
 * loaded. These tests pin the state machine that now governs which onboarding
 * surface (if any) shows.
 */

import { describe, it, expect } from 'vitest'
import { getDashboardStage, getDashboardStrategyCta, getOnboardingVisibility, isEarlyOperatingMode } from '@/lib/dashboardOnboarding'

const NEW = { hasCampaigns: false, brandReady: false, hasBrandName: false, brandLoaded: true }
const ACTIVATING = { hasCampaigns: false, brandReady: true, hasBrandName: true, brandLoaded: true }
const ESTABLISHED = { hasCampaigns: true, brandReady: true, hasBrandName: true, brandLoaded: true }

const surfaceCount = (v: { showWelcome: boolean; showChecklist: boolean; showJourneyBar: boolean }) =>
  [v.showWelcome, v.showChecklist, v.showJourneyBar].filter(Boolean).length

describe('getDashboardStage', () => {
  it('campaigns ⇒ established, decided immediately (even before brand loads)', () => {
    expect(getDashboardStage(ESTABLISHED)).toBe('established')
    expect(getDashboardStage({ hasCampaigns: true, brandReady: false, hasBrandName: false, brandLoaded: false }))
      .toBe('established')
  })

  it('brand set up + no campaigns ⇒ activating', () => {
    expect(getDashboardStage(ACTIVATING)).toBe('activating')
    expect(getDashboardStage({ hasCampaigns: false, brandReady: false, hasBrandName: true, brandLoaded: true }))
      .toBe('activating')
  })

  it('no brand + no campaigns + brand loaded ⇒ new', () => {
    expect(getDashboardStage(NEW)).toBe('new')
  })

  it('no campaigns + brand not yet loaded ⇒ loading (NOT assumed new)', () => {
    expect(getDashboardStage({ hasCampaigns: false, brandReady: false, hasBrandName: false, brandLoaded: false }))
      .toBe('loading')
  })
})

describe('getOnboardingVisibility', () => {
  it('1. brand-new user (no brand/no campaigns) sees one welcome next action', () => {
    const v = getOnboardingVisibility(NEW)
    expect(v.stage).toBe('new')
    expect(v.showWelcome).toBe(true)
    expect(v.showChecklist).toBe(false)
    expect(v.showJourneyBar).toBe(false)
    expect(surfaceCount(v)).toBe(1)
  })

  it('2. brand-but-no-campaigns sees ONE next-step surface only (journey bar), no welcome/checklist', () => {
    const v = getOnboardingVisibility(ACTIVATING)
    expect(v.stage).toBe('activating')
    expect(v.showWelcome).toBe(false)
    expect(v.showChecklist).toBe(false)
    expect(v.showJourneyBar).toBe(true)
    expect(surfaceCount(v)).toBe(1)
  })

  it('3. user with campaigns does NOT see the beginner welcome banner', () => {
    expect(getOnboardingVisibility(ESTABLISHED).showWelcome).toBe(false)
  })

  it('4. user with campaigns does NOT see multiple onboarding surfaces (at most the compact journey bar)', () => {
    const v = getOnboardingVisibility(ESTABLISHED)
    expect(v.showWelcome).toBe(false)
    expect(v.showChecklist).toBe(false)
    expect(surfaceCount(v)).toBeLessThanOrEqual(1)
  })

  it('5. loading state does not flash new-user onboarding for established users (or anyone)', () => {
    // Established user, brand still loading — never shows beginner surfaces.
    const est = getOnboardingVisibility({ hasCampaigns: true, brandReady: false, hasBrandName: false, brandLoaded: false })
    expect(est.stage).toBe('established')
    expect(est.showWelcome).toBe(false)
    expect(est.showChecklist).toBe(false)

    // Not-yet-known user (no campaigns, brand pending) — show nothing onboarding yet.
    const mid = getOnboardingVisibility({ hasCampaigns: false, brandReady: false, hasBrandName: false, brandLoaded: false })
    expect(mid.stage).toBe('loading')
    expect(mid.showWelcome).toBe(false)
    expect(mid.showChecklist).toBe(false)
    expect(mid.showJourneyBar).toBe(false)
  })
})

describe('isEarlyOperatingMode', () => {
  it('1. zero campaigns + no published/scheduled execution ⇒ early operating mode', () => {
    expect(isEarlyOperatingMode({
      publishedPostsTotal: 0,
      publishingState: 'none',
      campaignStatuses: [],
    })).toBe(true)
  })

  it('2. draft campaigns only + no published/scheduled execution ⇒ early operating mode', () => {
    expect(isEarlyOperatingMode({
      publishedPostsTotal: 0,
      publishingState: 'none',
      campaignStatuses: ['DRAFT', 'DRAFT'],
    })).toBe(true)
  })

  it('3. published or scheduled content exists ⇒ normal dashboard behavior', () => {
    expect(isEarlyOperatingMode({
      publishedPostsTotal: 1,
      publishingState: 'live',
      campaignStatuses: ['DRAFT'],
    })).toBe(false)

    expect(isEarlyOperatingMode({
      publishedPostsTotal: 0,
      publishingState: 'scheduled',
      campaignStatuses: ['DRAFT'],
    })).toBe(false)
  })

  it('4. active campaign exists ⇒ normal dashboard behavior even before publication', () => {
    expect(isEarlyOperatingMode({
      publishedPostsTotal: 0,
      publishingState: 'none',
      campaignStatuses: ['DRAFT', 'ACTIVE'],
    })).toBe(false)
  })
})

describe('getDashboardStrategyCta', () => {
  it('1. no campaign ⇒ Create first strategy through the Strategy entry point', () => {
    const cta = getDashboardStrategyCta({ campaignCount: 0, contentPostsTotal: 0 })

    expect(cta.state).toBe('create_first_strategy')
    expect(cta.label).toBe('Create first strategy')
    expect(cta.labelAr).toBe('أنشئ أول استراتيجية')
    expect(cta.href).toBe('/strategy')
  })

  it('2. draft/generated campaign exists without real content rows ⇒ Review draft strategy', () => {
    const cta = getDashboardStrategyCta({ campaignCount: 1, contentPostsTotal: 0 })

    expect(cta.state).toBe('review_draft_strategy')
    expect(cta.label).toBe('Review draft strategy')
    expect(cta.labelAr).toBe('راجع الاستراتيجية المسودة')
    expect(cta.href).toBe('/strategy')
  })

  it('3. real content plan rows exist ⇒ Review content plan', () => {
    const cta = getDashboardStrategyCta({ campaignCount: 2, contentPostsTotal: 8 })

    expect(cta.state).toBe('review_content_plan')
    expect(cta.label).toBe('Review content plan')
    expect(cta.labelAr).toBe('راجع خطة المحتوى')
    expect(cta.href).toBe('/content-hub')
  })

  it('4. does not claim content exists from campaign count alone', () => {
    const cta = getDashboardStrategyCta({ campaignCount: 3, contentPostsTotal: 0 })

    expect(cta.label).not.toMatch(/content/i)
    expect(cta.href).toBe('/strategy')
  })
})
