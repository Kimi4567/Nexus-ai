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
import { getDashboardStage, getOnboardingVisibility } from '@/lib/dashboardOnboarding'

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
  it('1. brand-new user (no brand/no campaigns) sees full onboarding', () => {
    const v = getOnboardingVisibility(NEW)
    expect(v.stage).toBe('new')
    expect(v.showWelcome).toBe(true)
    expect(v.showChecklist).toBe(true)
    expect(v.showJourneyBar).toBe(true)
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
