import { PROFESSIONAL_CAMPAIGN_FILM_COMPOSITOR_VERSION } from '@/lib/professionalCampaignFilm'

type UnknownRecord = Record<string, unknown>

export interface RejectedVideoReview {
  generationId: string
  previewUrl: string
  summary: string
  issues: string[]
  reviewedAt: string | null
  semanticAlignmentScore: number | null
  professionalQualityScore: number | null
  referencePreservationScore: number | null
  attachable: false
  publishable: false
  repairEligible: boolean
}

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : null
}

function boundedText(value: unknown, max = 300): string {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, max)
    : ''
}

function boundedScore(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, Math.round(parsed))) : null
}

function safeCloudinaryVideoUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') return null
    if (!url.pathname.includes('/video/upload/')) return null
    return url.toString()
  } catch {
    return null
  }
}

/**
 * Exposes a rejected output only as a quarantined, read-only audit preview.
 * The output remains ineligible for attachment, approval, scheduling, or publish.
 */
export function readRejectedVideoReview(value: unknown): RejectedVideoReview | null {
  const generation = record(value)
  if (!generation || generation.status !== 'FAILED') return null

  const metadata = record(generation.metadata)
  const qualityReview = record(metadata?.qualityReview)
  const previewUrl = safeCloudinaryVideoUrl(generation.output)
  const generationId = boundedText(generation.id, 120)
  if (
    !metadata
    || metadata.qualityStatus !== 'REJECTED'
    || metadata.retainedForAudit !== true
    || !qualityReview
    || qualityReview.passed !== false
    || !previewUrl
    || !generationId
  ) return null

  const issues = Array.isArray(qualityReview.issues)
    ? Array.from(new Set(qualityReview.issues
        .map(issue => boundedText(issue, 180))
        .filter(Boolean)))
        .slice(0, 8)
    : []
  const compositorVersion = boundedText(metadata.compositorVersion, 80)
  const typographyFailure = issues.some(issue => /gibberish text|missing approved.*overlay|typography/i.test(issue))
  const params = record(generation.params)
  const isCampaignFilm = params?.productionRoute === 'MULTI_SHOT_CAMPAIGN_FILM'

  return {
    generationId,
    previewUrl,
    summary: boundedText(qualityReview.summary, 300) || 'NEXUS quality review rejected this video.',
    issues,
    reviewedAt: boundedText(qualityReview.reviewedAt, 80) || null,
    semanticAlignmentScore: boundedScore(qualityReview.semanticAlignmentScore),
    professionalQualityScore: boundedScore(qualityReview.professionalQualityScore),
    referencePreservationScore: boundedScore(qualityReview.referencePreservationScore),
    attachable: false,
    publishable: false,
    repairEligible: isCampaignFilm
      && compositorVersion !== PROFESSIONAL_CAMPAIGN_FILM_COMPOSITOR_VERSION
      && typographyFailure,
  }
}
