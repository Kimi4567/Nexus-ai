/**
 * PR-J — Brand Brain separated readiness indicators (single source of truth).
 *
 * Before PR-J the product showed conflicting "Brand Brain" numbers:
 *   • Brand page          → calculateBrandMaturity() blended score (e.g. 45/100)
 *   • Campaign panel      → an ad-hoc filled/8-fields ratio (e.g. 88%)
 *   • getBrandBrainReadiness() → required70 + recommended30 (e.g. 88)
 * Same label, three formulas → the user could not trust either number, and a
 * high blended score could make an unready brand *look* strategy- or paid-ready.
 *
 * PR-J replaces that single blended figure with FOUR honest, separate concepts,
 * computed in ONE place and rendered identically on every surface:
 *
 *   1. brandCompleteness — core durable, user-confirmed identity fields only.
 *      (Does NOT include learned hooks/angles; AI suggestions never inflate it
 *      because only saved profile data reaches this function.)
 *   2. organicReadiness  — whether the minimum Organic strategy set is present.
 *   3. paidReadiness      — paid prerequisites; honest "planning only" until met.
 *   4. memoryRichness     — what NEXUS has *learned* (hooks/angles/learnings).
 *      Deliberately separate so it can never read as strategy/paid readiness.
 *
 * Pure + framework-free (no I/O, no network) → deterministically unit-testable.
 * Reuses calculateBrandMaturity() and getStrategyCapabilities() so the numbers
 * can never drift from the rest of the app.
 */

import { calculateBrandMaturity } from './brandMaturity'
import { getStrategyCapabilities, type StrategyProfileLike } from './brandReadiness'

export type IndicatorLevel = 'none' | 'low' | 'medium' | 'high'

export interface CompletenessIndicator {
  /** 0-100, share of core durable fields the user has filled. */
  score: number
  /** Stable field keys still missing (UI localizes them). */
  missingKeys: string[]
  level: IndicatorLevel
}

export interface ReadinessIndicator {
  /** true only when every prerequisite field is present. */
  ready: boolean
  /** 0-100 share of prerequisites present (for a calm progress bar). */
  score: number
  /** Stable field keys still missing (UI localizes them). */
  missingKeys: string[]
}

export interface PaidReadinessIndicator extends ReadinessIndicator {
  /**
   * false unless every paid prerequisite is present. Even when true, paid ads
   * are still planning-only by product policy and never auto-launch — the UI
   * must continue to require explicit approval before any spend.
   */
  launchReady: boolean
  /** 'planning_only' until prerequisites exist, then 'ready' (still approval-gated). */
  note: 'planning_only' | 'ready'
}

export interface MemoryRichnessIndicator {
  /** 0-100, how much NEXUS has learned (hooks/angles/pain points/learnings). */
  score: number
  level: IndicatorLevel
  /** count of distinct learned-memory signals present (for honest empty states). */
  signals: number
}

export interface BrandIndicators {
  brandCompleteness: CompletenessIndicator
  organicReadiness: ReadinessIndicator
  paidReadiness: PaidReadinessIndicator
  memoryRichness: MemoryRichnessIndicator
}

/** Superset profile shape covering every field the four indicators read. */
export type BrandIndicatorProfile = StrategyProfileLike & {
  primaryOffer?: string | null
  audienceAge?: string | null
  audiencePainPoints?: string[] | null
  winningHooks?: string[] | null
  winningAngles?: string[] | null
  failedAngles?: string[] | null
  toneKeywords?: string[] | null
  uniqueAdvantages?: string[] | null
  contentSamples?: string[] | null
  verifiedProof?: string[] | null
  acceptedLearningCount?: number | null
}

const hasStr = (v: unknown): boolean => typeof v === 'string' && v.trim().length > 0
const hasArr = (v: unknown): boolean => Array.isArray(v) && v.length > 0
const filled = (v: unknown): boolean => (Array.isArray(v) ? v.length > 0 : hasStr(v))

function levelFromScore(score: number): IndicatorLevel {
  if (score <= 0) return 'none'
  if (score < 40) return 'low'
  if (score < 80) return 'medium'
  return 'high'
}

/**
 * Minimum Organic strategy set (the fields needed to plan organic content with
 * confidence). Superset of the existing content gate, with the additions the
 * product spec calls for: description, primary offer, pain points, business goal.
 */
const ORGANIC_FIELDS: { key: string; ok: (p: BrandIndicatorProfile) => boolean }[] = [
  { key: 'brandName',         ok: p => hasStr(p.brandName) },
  { key: 'industry',          ok: p => hasStr(p.industry) },
  { key: 'description',       ok: p => hasStr(p.description) },
  { key: 'primaryOffer',      ok: p => hasStr(p.primaryOffer) },
  { key: 'targetAudience',    ok: p => hasStr(p.targetAudience) },
  { key: 'audiencePainPoints',ok: p => hasArr(p.audiencePainPoints) },
  { key: 'businessGoal',      ok: p => hasStr(p.businessGoal) },
  { key: 'topPlatforms',      ok: p => hasArr(p.topPlatforms) },
]

/**
 * Compute the four separated Brand Brain indicators.
 *
 * @param profile saved Brand Brain profile (Prisma row or /api/brand response).
 *   Pass null for a zeroed result.
 * @param opts.hasPixel  whether a Meta Pixel / tracking source is connected.
 *   It informs retargeting capability, never paid planning readiness; tracking
 *   is enforced later at the launch boundary.
 * @param opts.acceptedLearningCount  count of accepted brain-learning events
 *   (memory richness). Falls back to profile.acceptedLearningCount, then 0.
 */
export function getBrandIndicators(
  profile: BrandIndicatorProfile | null | undefined,
  opts: { hasPixel?: boolean; acceptedLearningCount?: number } = {},
): BrandIndicators {
  const p: BrandIndicatorProfile = profile ?? {}
  const hasPixel = Boolean(opts.hasPixel)
  const acceptedLearningCount = Math.max(
    0,
    opts.acceptedLearningCount ?? (typeof p.acceptedLearningCount === 'number' ? p.acceptedLearningCount : 0),
  )

  // Reuse the maturity engine so completeness/memory math never drifts from the
  // Brand Brain page. breakdown.completeness is out of 30; memoryDepth out of 50;
  // learningActivity out of 20.
  const maturity = calculateBrandMaturity(p, { acceptedLearningCount, locale: 'en' })

  // ── 1. Core identity coverage ── never an overall readiness percentage ──
  const COMPLETENESS_MAX = 30
  const completenessScore = Math.round((maturity.breakdown.completeness / COMPLETENESS_MAX) * 100)
  const completenessMissingKeys = ([
    'brandName', 'industry', 'description', 'primaryOffer',
    'targetAudience', 'audienceAge', 'audienceLocation', 'topPlatforms',
  ] as const).filter(k => !filled((p as Record<string, unknown>)[k]))
  const brandCompleteness: CompletenessIndicator = {
    score: completenessScore,
    missingKeys: completenessMissingKeys,
    level: levelFromScore(completenessScore),
  }

  // ── 2. Organic strategy readiness ── minimum organic set present ──
  const organicMissing = ORGANIC_FIELDS.filter(f => !f.ok(p)).map(f => f.key)
  const organicReadiness: ReadinessIndicator = {
    ready: organicMissing.length === 0,
    score: Math.round(((ORGANIC_FIELDS.length - organicMissing.length) / ORGANIC_FIELDS.length) * 100),
    missingKeys: organicMissing,
  }

  // ── 3. Paid readiness ── reuse capability gate + tracking; honest planning-only ──
  const caps = getStrategyCapabilities(p, { hasPixel })
  const paidMissing = [...caps.paidStrategy.missingKeys]
  // Eight professional organic fields + seven paid-review inputs: budget,
  // destination, location, lead handling, price position, differentiation,
  // and objections. Proof is tracked separately and constrains claims; it is
  // not required to create a planning-only package. Tracking belongs to launch readiness.
  // This denominator matches the runtime paid-planning gate.
  const uniquePaidMissing = Array.from(new Set(paidMissing))
  const paidPrereqTotal = 15
  const paidReady = uniquePaidMissing.length === 0
  const paidReadiness: PaidReadinessIndicator = {
    ready: paidReady,
    launchReady: false,                          // paid never auto-launches; always approval-gated
    score: Math.max(0, Math.round(((paidPrereqTotal - Math.min(uniquePaidMissing.length, paidPrereqTotal)) / paidPrereqTotal) * 100)),
    missingKeys: uniquePaidMissing,
    note: paidReady ? 'ready' : 'planning_only',
  }

  // ── 4. Memory richness ── learned hooks/angles/learnings — separate from readiness ──
  const MEMORY_MAX = 70 // memoryDepth(50) + learningActivity(20)
  const memoryScore = Math.round(((maturity.breakdown.memoryDepth + maturity.breakdown.learningActivity) / MEMORY_MAX) * 100)
  const signals =
    (hasArr(p.winningHooks) ? 1 : 0) +
    (hasArr(p.winningAngles) ? 1 : 0) +
    (hasArr(p.failedAngles) ? 1 : 0) +
    (hasArr(p.audiencePainPoints) ? 1 : 0) +
    (hasArr(p.contentSamples) ? 1 : 0) +
    (hasArr(p.verifiedProof) ? 1 : 0) +
    (acceptedLearningCount > 0 ? 1 : 0)
  const memoryRichness: MemoryRichnessIndicator = {
    score: memoryScore,
    level: levelFromScore(memoryScore),
    signals,
  }

  return { brandCompleteness, organicReadiness, paidReadiness, memoryRichness }
}
