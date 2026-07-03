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

import type { ContentIntensity } from './strategyOrder'

/** User-friendly post-per-month band per intensity (display only). */
export const INTENSITY_RANGE_LABEL: Record<ContentIntensity, string> = {
  light: '8–10',
  standard: '12–16',
  growth: '20–25',
  daily: '30',
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

/**
 * Subscription tier → monthly post quota. Mirrors planContext.ts TIER_CONFIGS.
 * Returns undefined for an unknown/loading tier so the caller can omit planContext
 * (no cap applied) rather than guessing.
 */
const TIER_POSTS_PER_MONTH: Record<string, number> = {
  free: 3,
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
