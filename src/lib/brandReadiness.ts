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
