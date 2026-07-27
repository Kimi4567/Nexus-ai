import { describe, expect, it } from 'vitest'
import { readRejectedVideoReview } from '@/lib/rejectedMediaReview'
import { PROFESSIONAL_CAMPAIGN_FILM_COMPOSITOR_VERSION } from '@/lib/professionalCampaignFilm'

function rejectedGeneration(overrides: Record<string, unknown> = {}) {
  return {
    id: 'generation-1',
    status: 'FAILED',
    params: { productionRoute: 'MULTI_SHOT_CAMPAIGN_FILM' },
    output: 'https://res.cloudinary.com/nexus/video/upload/v1/rejected.mp4',
    metadata: {
      qualityStatus: 'REJECTED',
      retainedForAudit: true,
      qualityReview: {
        passed: false,
        summary: 'Visible interface text became distorted.',
        issues: ['Misspelled UI text', 'Misspelled UI text', 'Broken geometry'],
        semanticAlignmentScore: 72.4,
        professionalQualityScore: 61.8,
        referencePreservationScore: 84.2,
        reviewedAt: '2026-07-17T16:55:00.000Z',
      },
    },
    ...overrides,
  }
}

describe('readRejectedVideoReview', () => {
  it('returns a read-only audit preview for a genuine rejected Cloudinary video', () => {
    expect(readRejectedVideoReview(rejectedGeneration())).toEqual({
      generationId: 'generation-1',
      previewUrl: 'https://res.cloudinary.com/nexus/video/upload/v1/rejected.mp4',
      summary: 'Visible interface text became distorted.',
      issues: ['Misspelled UI text', 'Broken geometry'],
      reviewedAt: '2026-07-17T16:55:00.000Z',
      semanticAlignmentScore: 72,
      professionalQualityScore: 62,
      referencePreservationScore: 84,
      attachable: false,
      publishable: false,
      repairEligible: false,
    })
  })

  it('offers one retained-footage repair per corrected compositor version', () => {
    const repairable = readRejectedVideoReview(rejectedGeneration({
      metadata: {
        qualityStatus: 'REJECTED',
        retainedForAudit: true,
        qualityReview: {
          passed: false,
          summary: 'Typography failed.',
          issues: ['Generated gibberish text present', 'Missing approved motion-design overlays'],
        },
      },
    }))
    expect(repairable?.repairEligible).toBe(true)

    const alreadyAttemptedWithCurrentCompositor = readRejectedVideoReview(rejectedGeneration({
      metadata: {
        qualityStatus: 'REJECTED',
        retainedForAudit: true,
        typographyRepairAttemptedAt: '2026-07-18T18:00:00.000Z',
        compositorVersion: PROFESSIONAL_CAMPAIGN_FILM_COMPOSITOR_VERSION,
        qualityReview: { passed: false, issues: ['Generated gibberish text present'] },
      },
    }))
    expect(alreadyAttemptedWithCurrentCompositor?.repairEligible).toBe(false)

    const priorDefectiveCompositor = readRejectedVideoReview(rejectedGeneration({
      metadata: {
        qualityStatus: 'REJECTED',
        retainedForAudit: true,
        typographyRepairAttemptedAt: '2026-07-18T18:00:00.000Z',
        compositorVersion: '2026-07-arabic-2',
        qualityReview: { passed: false, issues: ['Generated gibberish text present'] },
      },
    }))
    expect(priorDefectiveCompositor?.repairEligible).toBe(true)

    const otherVideoRoute = readRejectedVideoReview(rejectedGeneration({
      params: { productionRoute: 'CINEMATIC_PRODUCT_AD' },
      metadata: {
        qualityStatus: 'REJECTED',
        retainedForAudit: true,
        qualityReview: { passed: false, issues: ['Generated gibberish text present'] },
      },
    }))
    expect(otherVideoRoute?.repairEligible).toBe(false)
  })

  it('does not expose provider URLs or unverified failed generations', () => {
    expect(readRejectedVideoReview(rejectedGeneration({
      output: 'https://provider.example/private-output.mp4',
    }))).toBeNull()
    expect(readRejectedVideoReview(rejectedGeneration({
      metadata: { qualityStatus: 'REJECTED', retainedForAudit: false },
    }))).toBeNull()
  })
})
