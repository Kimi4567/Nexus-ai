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
export type DashboardPublishingState = 'live' | 'scheduled' | 'pending' | 'none' | null | undefined
export type DashboardStrategyCtaState = 'create_first_strategy' | 'review_draft_strategy' | 'review_content_plan'

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

export interface EarlyOperatingModeInputs {
  /** Real published content count from /api/dashboard/stats. */
  publishedPostsTotal?: number | null
  /** Existing Operating Brief publishing state. `scheduled` and `live` count as execution. */
  publishingState?: DashboardPublishingState
  /** Current campaign statuses already loaded for the dashboard list. */
  campaignStatuses?: Array<string | null | undefined> | null
}

export interface DashboardStrategyCtaInputs {
  /** Real campaign count from /api/dashboard/stats. */
  campaignCount?: number | null
  /** Real SocialPost row count from /api/dashboard/stats. */
  contentPostsTotal?: number | null
}

export interface DashboardStrategyCta {
  state: DashboardStrategyCtaState
  label: string
  labelAr: string
  reason: string
  reasonAr: string
  href: string
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

/**
 * D1.1 — Early Operating Mode.
 *
 * Campaign records alone do not prove the product is operating. Draft/test
 * campaigns can exist while there is still no real marketing execution. Keep the
 * dashboard in a calm, guided mode until we see execution evidence:
 * published content, scheduled content, or an ACTIVE campaign.
 */
export function isEarlyOperatingMode({
  publishedPostsTotal,
  publishingState,
  campaignStatuses,
}: EarlyOperatingModeInputs): boolean {
  const hasPublishedContent = Math.max(0, Math.trunc(publishedPostsTotal ?? 0)) > 0
  const hasScheduledOrLiveContent = publishingState === 'scheduled' || publishingState === 'live'
  const hasActiveCampaign = (campaignStatuses ?? []).some(status => status === 'ACTIVE')

  return !hasPublishedContent && !hasScheduledOrLiveContent && !hasActiveCampaign
}

/**
 * OP-D1.1 — Dashboard → Strategy CTA contract.
 *
 * This intentionally uses only dashboard data we can trust:
 * - campaign count proves a strategy/campaign record exists;
 * - SocialPost row count proves a generated content plan exists.
 *
 * It does not infer scheduled/published/live state.
 */
export function getDashboardStrategyCta({
  campaignCount,
  contentPostsTotal,
}: DashboardStrategyCtaInputs): DashboardStrategyCta {
  const campaigns = Math.max(0, Math.trunc(campaignCount ?? 0))
  const contentPosts = Math.max(0, Math.trunc(contentPostsTotal ?? 0))

  if (campaigns > 0 && contentPosts > 0) {
    return {
      state: 'review_content_plan',
      label: 'Review content plan',
      labelAr: 'راجع خطة المحتوى',
      reason: 'Content plan rows exist. Review the plan before scheduling or publishing.',
      reasonAr: 'توجد صفوف خطة محتوى. راجع الخطة قبل الجدولة أو النشر.',
      href: '/content-hub',
    }
  }

  if (campaigns > 0) {
    return {
      state: 'review_draft_strategy',
      label: 'Review draft strategy',
      labelAr: 'راجع الاستراتيجية المسودة',
      reason: 'A strategy or campaign draft already exists. Review it before generating or scheduling content.',
      reasonAr: 'توجد استراتيجية أو حملة مسودة. راجعها قبل إنشاء المحتوى أو جدولته.',
      href: '/strategy',
    }
  }

  return {
    state: 'create_first_strategy',
    label: 'Create first strategy',
    labelAr: 'أنشئ أول استراتيجية',
    reason: 'Start with a first marketing strategy. NEXUS will ask for approval before any execution.',
    reasonAr: 'ابدأ بأول استراتيجية تسويقية. سيطلب NEXUS موافقتك قبل أي تنفيذ.',
    href: '/dashboard?runStrategy=1',
  }
}
