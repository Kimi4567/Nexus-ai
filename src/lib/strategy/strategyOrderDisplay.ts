/**
 * PR-S1b — Strategy Order display helpers (pure, presentational).
 *
 * Small UI-facing helpers used by the Strategy Order Review:
 *  - user-friendly intensity RANGES (the contract uses band-top numbers
 *    internally — light 10 / standard 16 / growth 25 / daily 30 — but the UI
 *    shows the friendly band, e.g. "12–16").
 *  - subscription tier → monthly post quota (mirrors lib/agents/planContext.ts
 *    TIER_CONFIGS) so the modal can pass planContext into getStrategyDeliverables
 *    without importing the server agent module.
 *
 * Pure, framework-free, no I/O. Does NOT change pricing or generation.
 */

import type { ContentIntensity, StrategyType } from './strategyOrder'
import { FREE_TRIAL_POSTS } from '@/lib/commercialPlans'

/** User-friendly post-per-month band per intensity (display only). */
export const INTENSITY_RANGE_LABEL: Record<ContentIntensity, string> = {
  light: '8–10',
  standard: '12–16',
  growth: '20–25',
  daily: '30',
}

/** Paid planning uses the same pricing tiers, but must not imply organic post counts. */
export const PAID_PLANNING_DEPTH_LABEL: Record<ContentIntensity, { ar: string; en: string }> = {
  light: { ar: 'أساسي', en: 'Lean' },
  standard: { ar: 'متوازن', en: 'Balanced' },
  growth: { ar: 'موسع', en: 'Expanded' },
  daily: { ar: 'أعلى تفصيل', en: 'Deep' },
}

/** Localized intensity name. */
export function intensityLabel(intensity: ContentIntensity, locale?: string): string {
  const ar = locale === 'ar'
  return {
    light: ar ? 'خفيفة' : 'Light',
    standard: ar ? 'قياسية' : 'Standard',
    growth: ar ? 'نمو' : 'Growth',
    daily: ar ? 'يومية' : 'Daily',
  }[intensity]
}

export function strategyIntensitySectionLabel(strategyType: StrategyType, locale?: string): string {
  const ar = locale === 'ar'
  if (strategyType === 'paid') return ar ? 'عمق التخطيط' : 'Planning depth'
  return ar ? 'كثافة المحتوى' : 'Content intensity'
}

export function strategyIntensitySecondaryLabel(
  intensity: ContentIntensity,
  strategyType: StrategyType,
  locale?: string,
): string {
  if (strategyType === 'paid') {
    const label = PAID_PLANNING_DEPTH_LABEL[intensity]
    return locale === 'ar' ? label.ar : label.en
  }
  return INTENSITY_RANGE_LABEL[intensity]
}

export function strategyIntensityHelperCopy(strategyType: StrategyType, locale?: string): string {
  const ar = locale === 'ar'
  if (strategyType === 'paid') {
    return ar
      ? 'يحدد مستوى تفصيل بريف التخطيط المدفوع فقط. لا ينشئ منشورات عضوية ولا يطلق إعلانات.'
      : 'Sets the paid planning brief depth only. It does not create organic posts or launch ads.'
  }
  return ar
    ? 'اتجاهات منشورات عضوية لأول 30 يوم (قد تُقيَّد حسب خطتك).'
    : 'Organic post directions for the first 30 days (may be capped by your plan).'
}

/**
 * Subscription tier → monthly post quota. Mirrors planContext.ts TIER_CONFIGS.
 * Returns undefined for an unknown/loading tier so the caller can omit planContext
 * (no cap applied) rather than guessing.
 */
const TIER_POSTS_PER_MONTH: Record<string, number> = {
  // The trial promises the same small sample that the monthly execution gate
  // can actually save.
  free: FREE_TRIAL_POSTS,
  starter: 10,
  pro: 25,
  growth: 25,
  active: 25,
  business: 60,
  agency: 60,
}

export function tierToPostsPerMonth(plan: string | null | undefined): number | undefined {
  if (!plan) return undefined
  return TIER_POSTS_PER_MONTH[plan.toLowerCase()]
}
