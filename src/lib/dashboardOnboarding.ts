/**
 * Dashboard onboarding consolidation (Trust Sprint #7).
 *
 * The dashboard previously rendered up to three onboarding/next-step surfaces at
 * once — the Welcome banner (gated only on a localStorage flag), the full
 * OnboardingChecklist, and the MarketingJourneyBar — none of which keyed off the
 * user's real state. An established user (campaigns + brand) on a fresh browser
 * saw all three beginner prompts, which felt cluttered and amateur. It also
 * flickered: brand readiness loads from a separate request, so the surfaces could
 * briefly render a new-user state before the brand fetch resolved.
 *
 * This module derives a single dashboard stage from real signals and decides,
 * deterministically, which onboarding surface(s) to show:
 *
 *  - `established` (has campaigns): no beginner welcome, no full checklist — at
 *    most the compact journey bar (which itself hides once the funnel is done).
 *    Decided purely from campaign count, which is available as soon as stats
 *    load — so established users never flash new-user onboarding.
 *  - `activating` (brand set up, no campaigns yet): one compact next-step surface
 *    (the journey bar), no welcome banner, no full checklist.
 *  - `new` (no brand, no campaigns): full onboarding guidance.
 *  - `loading` (brand state not yet known and not established): show nothing
 *    onboarding-related yet, to avoid flashing a new-user state mid-load.
 */

export type DashboardStage = 'loading' | 'new' | 'activating' | 'established'

export interface OnboardingInputs {
  /** stats.campaigns > 0 — the strongest signal of a returning user. */
  hasCampaigns: boolean
  /** brandReadiness.ready */
  brandReady: boolean
  /** a brand name exists (brand was set up even if readiness is partial) */
  hasBrandName: boolean
  /** the /api/brand fetch has resolved (success or failure). */
  brandLoaded: boolean
}

export interface OnboardingVisibility {
  stage: DashboardStage
  /** First-login beginner welcome banner. */
  showWelcome: boolean
  /** Full "Quick Start Guide" checklist. */
  showChecklist: boolean
  /** Compact, data-driven Marketing Journey bar (self-hides when funnel complete). */
  showJourneyBar: boolean
}

/**
 * Derive the dashboard stage. Campaigns decide `established` immediately (no
 * dependency on the slower brand fetch), which is what prevents the established
 * flicker. When there are no campaigns and brand state is still unknown, we stay
 * in `loading` rather than assuming a brand-new user.
 */
export function getDashboardStage({
  hasCampaigns,
  brandReady,
  hasBrandName,
  brandLoaded,
}: OnboardingInputs): DashboardStage {
  if (hasCampaigns) return 'established'
  if (!brandLoaded) return 'loading'
  if (brandReady || hasBrandName) return 'activating'
  return 'new'
}

/** Decide which onboarding surfaces the dashboard should render for this user. */
export function getOnboardingVisibility(inputs: OnboardingInputs): OnboardingVisibility {
  const stage = getDashboardStage(inputs)
  return {
    stage,
    // Beginner welcome + full checklist are ONLY for genuinely brand-new users.
    showWelcome: stage === 'new',
    showChecklist: stage === 'new',
    // The compact journey bar is the single next-action surface for activating +
    // established users (and part of full guidance for new ones). It already
    // self-hides once every funnel step is complete. Hidden during `loading` so
    // we never briefly render step 1 for someone who's further along.
    showJourneyBar: stage !== 'loading',
  }
}
