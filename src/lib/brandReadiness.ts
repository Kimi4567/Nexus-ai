/**
 * Brand Brain Readiness
 * Single source of truth for checking whether a brand profile has enough
 * information to produce quality AI output.
 *
 * Works in both client components and server-side API routes (pure function).
 *
 * Usage:
 *   import { getBrandBrainReadiness } from '@/lib/brandReadiness'
 *   const readiness = getBrandBrainReadiness(brandProfile)
 *   if (!readiness.ready) showGate(readiness.missingRequired)
 */

// -- Types ------------------------------------------------------------------

export type RequiredFieldKey =
  | 'brandName'
  | 'industry'
  | 'description'
  | 'targetAudience'
  | 'topPlatforms'

export type RecommendedFieldKey =
  | 'competitorNotes'
  | 'writingStyle'
  | 'avoidKeywords'
  | 'audienceLocation'
  | 'primaryOffer'

export interface BrandReadinessResult {
  /** true when ALL required fields are present */
  ready: boolean
  /** 0-100. Required = 70% weight, recommended = 30% */
  score: number
  /** Keys of missing required fields */
  missingRequired: RequiredFieldKey[]
  /** Keys of missing recommended fields */
  missingRecommended: RecommendedFieldKey[]
  /** English summary message */
  message: string
}

/**
 * Minimal brand profile shape.
 * Compatible with both the Prisma BrandProfile model and the /api/brand response.
 */
export type BrandProfileLike = {
  brandName?: string | null
  industry?: string | null
  description?: string | null
  targetAudience?: string | null
  topPlatforms?: string[] | null
  competitorNotes?: string | null
  writingStyle?: string | null
  avoidKeywords?: string[] | null
  audienceLocation?: string | null
  primaryOffer?: string | null
}

// -- Field definitions -------------------------------------------------------

const REQUIRED: { key: RequiredFieldKey; check: (p: BrandProfileLike) => boolean }[] = [
  { key: 'brandName',      check: p => Boolean(p.brandName?.trim()) },
  { key: 'industry',       check: p => Boolean(p.industry?.trim()) },
  { key: 'description',    check: p => Boolean(p.description?.trim()) },
  { key: 'targetAudience', check: p => Boolean(p.targetAudience?.trim()) },
  { key: 'topPlatforms',   check: p => Boolean(p.topPlatforms?.length) },
]

const RECOMMENDED: { key: RecommendedFieldKey; check: (p: BrandProfileLike) => boolean }[] = [
  { key: 'competitorNotes', check: p => Boolean(p.competitorNotes?.trim()) },
  { key: 'writingStyle',    check: p => Boolean(p.writingStyle?.trim()) },
  { key: 'avoidKeywords',   check: p => Boolean(p.avoidKeywords?.length) },
  { key: 'audienceLocation',check: p => Boolean(p.audienceLocation?.trim()) },
  { key: 'primaryOffer',    check: p => Boolean(p.primaryOffer?.trim()) },
]

// -- Core helper -------------------------------------------------------------

/**
 * Evaluate whether a brand profile is ready for high-value AI actions.
 *
 * @param brandProfile  The brand profile object from /api/brand or Prisma.
 *                      Pass null/undefined to get a zero-score result.
 */
export function getBrandBrainReadiness(
  brandProfile: BrandProfileLike | null | undefined,
): BrandReadinessResult {
  if (!brandProfile) {
    return {
      ready: false,
      score: 0,
      missingRequired: REQUIRED.map(f => f.key),
      missingRecommended: RECOMMENDED.map(f => f.key),
      message: 'Brand Brain is empty. Complete your brand profile to enable AI features.',
    }
  }

  const missingRequired    = REQUIRED.filter(f => !f.check(brandProfile)).map(f => f.key)
  const missingRecommended = RECOMMENDED.filter(f => !f.check(brandProfile)).map(f => f.key)

  // Score: required fields = 70 pts total (14 each), recommended = 30 pts (6 each)
  const reqScore = ((REQUIRED.length - missingRequired.length) / REQUIRED.length) * 70
  const recScore = ((RECOMMENDED.length - missingRecommended.length) / RECOMMENDED.length) * 30
  const score    = Math.round(reqScore + recScore)

  const ready = missingRequired.length === 0

  return {
    ready,
    score,
    missingRequired,
    missingRecommended,
    message: ready
      ? `Brand Brain complete (score: ${score}/100).`
      : `Missing ${missingRequired.length} required field(s): ${missingRequired.join(', ')}.`,
  }
}

// ════════════════════════════════════════════════════════════════════════════
// PR-2A — Capability-based strategy readiness
//
// Tells NEXUS (and the user) which kinds of strategy it has enough data to
// produce reliably, and what's missing for the rest. This is ADVISORY: it drives
// calm "missing data" warnings in the UI. It does NOT gate or change generation,
// and it does NOT alter getBrandBrainReadiness() above (the organic gate).
// ════════════════════════════════════════════════════════════════════════════

/** Confidence a capability can be produced with, given current data. */
export type CapabilityConfidence = 'high' | 'low' | 'none'

export type StrategyCapabilityId =
  | 'contentStrategy'
  | 'fullStrategy'
  | 'paidStrategy'
  | 'kpiBudget'
  | 'funnel'
  | 'competitorAnalysis'
  | 'retargeting'

export interface StrategyCapability {
  /** stable id, e.g. 'paidStrategy' */
  id: StrategyCapabilityId
  /** true when all inputs this capability needs are present */
  ready: boolean
  /**
   * Stable, locale-agnostic field KEYS still missing for this capability
   * (e.g. ['marketingBudget','conversionDestination']). The UI translates these
   * to localized labels/messages — this library returns NO user-facing prose,
   * so non-English UIs never show mixed-language text. Invariant: when `ready`
   * is false this is ALWAYS non-empty (the UI can never render "add ." empty).
   */
  missingKeys: string[]
  /** high = fully supported · low = partial/assumption-heavy · none = cannot do yet */
  confidence: CapabilityConfidence
}

export interface StrategyCapabilities {
  contentStrategy: StrategyCapability
  fullStrategy: StrategyCapability
  paidStrategy: StrategyCapability
  kpiBudget: StrategyCapability
  funnel: StrategyCapability
  competitorAnalysis: StrategyCapability
  retargeting: StrategyCapability
}

/** Superset of BrandProfileLike including the PR-2A capture fields. All optional. */
export type StrategyProfileLike = BrandProfileLike & {
  uniqueAdvantages?: string[] | null
  competitors?: string[] | null
  businessGoal?: string | null
  marketingBudget?: string | null
  conversionDestination?: string | null
  leadHandling?: string | null
  customerObjections?: string[] | null
}

const hasStr = (v: unknown): boolean => typeof v === 'string' && v.trim().length > 0
const hasArr = (v: unknown): boolean => Array.isArray(v) && v.length > 0

/** Return the stable KEYS (not labels) of checks that fail against the profile. */
function missingKeysOf(
  p: StrategyProfileLike,
  checks: { key: string; ok: (p: StrategyProfileLike) => boolean }[],
): string[] {
  return checks.filter(c => !c.ok(p)).map(c => c.key)
}

/**
 * Capability-based readiness for the strategy experience.
 *
 * @param profile  Brand profile (Prisma BrandProfile or /api/brand response shape).
 * @param opts.hasPixel  Whether a Meta Pixel / analytics source is connected
 *                       (derive from AdAccount.pixelId). Defaults to false.
 */
export function getStrategyCapabilities(
  profile: StrategyProfileLike | null | undefined,
  opts: { hasPixel?: boolean } = {},
): StrategyCapabilities {
  const p: StrategyProfileLike = profile ?? {}
  const hasPixel = Boolean(opts.hasPixel)

  // Content base = the existing organic gate (same 5 fields as getBrandBrainReadiness).
  const contentMissing = missingKeysOf(p, [
    { key: 'brandName',      ok: x => hasStr(x.brandName) },
    { key: 'industry',       ok: x => hasStr(x.industry) },
    { key: 'description',    ok: x => hasStr(x.description) },
    { key: 'targetAudience', ok: x => hasStr(x.targetAudience) },
    { key: 'topPlatforms',   ok: x => hasArr(x.topPlatforms) },
  ])
  const contentReady = contentMissing.length === 0

  const contentStrategy: StrategyCapability = {
    id: 'contentStrategy',
    ready: contentReady,
    missingKeys: contentMissing,
    confidence: contentReady ? 'high' : 'none',
  }

  // ── full marketing strategy ── (content base + goal/offer/location/differentiator)
  // missingKeys folds in the content base so it is never empty when not ready.
  const fullExtra = missingKeysOf(p, [
    { key: 'businessGoal',     ok: x => hasStr(x.businessGoal) },
    { key: 'primaryOffer',     ok: x => hasStr(x.primaryOffer) },
    { key: 'audienceLocation', ok: x => hasStr(x.audienceLocation) },
    { key: 'uniqueAdvantages', ok: x => hasArr(x.uniqueAdvantages) },
  ])
  const fullMissing = [...contentMissing, ...fullExtra]
  const fullReady = fullMissing.length === 0
  const fullStrategy: StrategyCapability = {
    id: 'fullStrategy',
    ready: fullReady,
    missingKeys: fullMissing,
    confidence: fullReady ? 'high' : contentReady ? 'low' : 'none',
  }

  // ── paid strategy ── (content base + offer + budget + conversion destination + location)
  const paidExtra = missingKeysOf(p, [
    { key: 'primaryOffer',          ok: x => hasStr(x.primaryOffer) },
    { key: 'marketingBudget',       ok: x => hasStr(x.marketingBudget) },
    { key: 'conversionDestination', ok: x => hasStr(x.conversionDestination) },
    { key: 'audienceLocation',      ok: x => hasStr(x.audienceLocation) },
  ])
  const paidMissing = [...contentMissing, ...paidExtra]
  const paidReady = paidMissing.length === 0
  const paidStrategy: StrategyCapability = {
    id: 'paidStrategy',
    ready: paidReady,
    missingKeys: paidMissing,
    confidence: paidReady ? 'high' : 'none',
  }

  // ── KPIs / budget ── (goal + budget; independent of the content gate)
  const kpiMissing = missingKeysOf(p, [
    { key: 'businessGoal',    ok: x => hasStr(x.businessGoal) },
    { key: 'marketingBudget', ok: x => hasStr(x.marketingBudget) },
  ])
  const kpiBudget: StrategyCapability = {
    id: 'kpiBudget',
    ready: kpiMissing.length === 0,
    missingKeys: kpiMissing,
    confidence: kpiMissing.length === 0 ? 'high' : 'none',
  }

  // ── funnel ── (offer + conversion destination + lead handling)
  const funnelMissing = missingKeysOf(p, [
    { key: 'primaryOffer',          ok: x => hasStr(x.primaryOffer) },
    { key: 'conversionDestination', ok: x => hasStr(x.conversionDestination) },
    { key: 'leadHandling',          ok: x => hasStr(x.leadHandling) },
  ])
  const funnel: StrategyCapability = {
    id: 'funnel',
    ready: funnelMissing.length === 0,
    missingKeys: funnelMissing,
    confidence: funnelMissing.length === 0 ? 'high' : 'none',
  }

  // ── competitor analysis ── (user notes only → 'low'; never live market data)
  const hasCompetitors = hasArr(p.competitors) || hasStr(p.competitorNotes)
  const competitorAnalysis: StrategyCapability = {
    id: 'competitorAnalysis',
    ready: hasCompetitors,
    missingKeys: hasCompetitors ? [] : ['competitors'],
    confidence: hasCompetitors ? 'low' : 'none',
  }

  // ── retargeting ── (derived from a connected pixel/analytics source)
  const retargeting: StrategyCapability = {
    id: 'retargeting',
    ready: hasPixel,
    missingKeys: hasPixel ? [] : ['pixel'],
    confidence: hasPixel ? 'high' : 'none',
  }

  return { contentStrategy, fullStrategy, paidStrategy, kpiBudget, funnel, competitorAnalysis, retargeting }
}
