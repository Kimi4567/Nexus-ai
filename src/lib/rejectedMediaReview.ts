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

export interface RetainedVideoRepair {
  generationId: string
  reason: 'COMPOSITOR_UPGRADE'
  creditsUsed: 0
  providerGenerationStarted: false
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

export function isRetainedCampaignFilmRepairEligible(value: unknown): boolean {
  const generation = record(value)
  if (!generation) return false
  const metadata = record(generation.metadata)
  const params = record(generation.params)
  if (
    !metadata
    || params?.productionRoute !== 'MULTI_SHOT_CAMPAIGN_FILM'
    || metadata.compositorVersion === PROFESSIONAL_CAMPAIGN_FILM_COMPOSITOR_VERSION
    || !safeCloudinaryVideoUrl(generation.output)
  ) return false

  if (generation.status === 'COMPLETED') {
    return metadata.qualityStatus === 'PASSED'
      && metadata.attached === true
      && metadata.compositorRepairVersion !== PROFESSIONAL_CAMPAIGN_FILM_COMPOSITOR_VERSION
  }

  const qualityReview = record(metadata.qualityReview)
  const issues = Array.isArray(qualityReview?.issues)
    ? qualityReview.issues.filter((issue): issue is string => typeof issue === 'string')
    : []
  return generation.status === 'FAILED'
    && metadata.qualityStatus === 'REJECTED'
    && metadata.retainedForAudit === true
    && qualityReview?.passed === false
    && issues.some(issue => /gibberish text|missing approved.*overlay|typography/i.test(issue))
}

/**
 * Marks an attached, previously approved campaign film for a one-time,
 * zero-credit compositor upgrade. The retained provider master is reused and
 * no generative-video provider call is permitted.
 */
export function readRetainedVideoRepair(value: unknown): RetainedVideoRepair | null {
  const generation = record(value)
  if (!generation || generation.status !== 'COMPLETED' || !isRetainedCampaignFilmRepairEligible(generation)) {
    return null
  }
  const generationId = boundedText(generation.id, 120)
  if (!generationId) return null
  return {
    generationId,
    reason: 'COMPOSITOR_UPGRADE',
    creditsUsed: 0,
    providerGenerationStarted: false,
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
    repairEligible: isRetainedCampaignFilmRepairEligible(generation),
  }
}
