import { describe, expect, it } from 'vitest'
import {
  CONTENT_HUB_IMAGE_COST,
  CONTENT_HUB_VIDEO_COST,
  CONTENT_HUB_MOTION_DESIGN_COST,
  CONTENT_HUB_PROPERTY_PHOTO_FILM_COST,
  CONTENT_HUB_REWRITE_COST,
  CONTENT_HUB_MEDIA_INTELLIGENCE_COST,
  getBulkImageGenerationCost,
  getMediaPendingVisualStateCopy,
  summarizeBulkImageGenerationOutcome,
  validateBulkImageGenerationConfirmation,
  validateSingleImageGenerationConfirmation,
  validateVideoGenerationConfirmation,
  validateMotionDesignConfirmation,
  validatePropertyPhotoFilmConfirmation,
  validateRewriteConfirmation,
  validateMediaIntelligenceConfirmation,
  validateCreativeAdaptationConfirmation,
} from '../contentHubActionSafety'

describe('contentHubActionSafety', () => {
  it('requires explicit bulk image generation confirmation', () => {
    const result = validateBulkImageGenerationConfirmation({
      confirmed: false,
      acknowledgedImageCount: 8,
      acknowledgedCreditCost: 8 * CONTENT_HUB_IMAGE_COST,
      expectedImageCount: 8,
    })

    expect(result).toEqual({
      ok: false,
      error: 'Image generation requires explicit confirmation. No credits were spent.',
    })
  })

  it('requires exact bulk image count and total cost acknowledgement', () => {
    expect(getBulkImageGenerationCost(8)).toBe(32)
    expect(validateBulkImageGenerationConfirmation({
      confirmed: true,
      acknowledgedImageCount: 7,
      acknowledgedCreditCost: 32,
      expectedImageCount: 8,
    })).toMatchObject({ ok: false })
    expect(validateBulkImageGenerationConfirmation({
      confirmed: true,
      acknowledgedImageCount: 8,
      acknowledgedCreditCost: 31,
      expectedImageCount: 8,
    })).toMatchObject({ ok: false })
    expect(validateBulkImageGenerationConfirmation({
      confirmed: true,
      acknowledgedImageCount: 8,
      acknowledgedCreditCost: 32,
      expectedImageCount: 8,
    })).toEqual({ ok: true })
  })

  it('requires explicit single image generation confirmation', () => {
    expect(validateSingleImageGenerationConfirmation({
      confirmed: false,
      acknowledgedCreditCost: CONTENT_HUB_IMAGE_COST,
      acknowledgedNoPublishOrSchedule: true,
      acknowledgedPostMediaForReview: true,
    })).toEqual({
      ok: false,
      error: 'Image generation requires explicit confirmation. No credits were spent.',
    })
  })

  it('requires exact single image credit and no-publish acknowledgement', () => {
    expect(validateSingleImageGenerationConfirmation({
      confirmed: true,
      acknowledgedCreditCost: CONTENT_HUB_IMAGE_COST + 1,
      acknowledgedNoPublishOrSchedule: true,
      acknowledgedPostMediaForReview: true,
    })).toMatchObject({ ok: false })
    expect(validateSingleImageGenerationConfirmation({
      confirmed: true,
      acknowledgedCreditCost: CONTENT_HUB_IMAGE_COST,
      acknowledgedNoPublishOrSchedule: false,
      acknowledgedPostMediaForReview: true,
    })).toMatchObject({ ok: false })
    expect(validateSingleImageGenerationConfirmation({
      confirmed: true,
      acknowledgedCreditCost: CONTENT_HUB_IMAGE_COST,
      acknowledgedNoPublishOrSchedule: true,
      acknowledgedPostMediaForReview: false,
    })).toMatchObject({ ok: false })
    expect(validateSingleImageGenerationConfirmation({
      confirmed: true,
      acknowledgedCreditCost: CONTENT_HUB_IMAGE_COST,
      acknowledgedNoPublishOrSchedule: true,
      acknowledgedPostMediaForReview: true,
    })).toEqual({ ok: true })
  })

  it('requires explicit rewrite confirmation with exact credit cost', () => {
    expect(CONTENT_HUB_REWRITE_COST).toBe(2)
    expect(validateRewriteConfirmation({
      confirmed: false,
      acknowledgedCreditCost: CONTENT_HUB_REWRITE_COST,
    })).toMatchObject({ ok: false })
    expect(validateRewriteConfirmation({
      confirmed: true,
      acknowledgedCreditCost: CONTENT_HUB_REWRITE_COST + 1,
    })).toMatchObject({ ok: false })
    expect(validateRewriteConfirmation({
      confirmed: true,
      acknowledgedCreditCost: CONTENT_HUB_REWRITE_COST,
    })).toEqual({ ok: true })
  })

  it('locks media analysis to the confirmed batch, price, and no-change boundary', () => {
    expect(CONTENT_HUB_MEDIA_INTELLIGENCE_COST).toBe(3)
    expect(validateMediaIntelligenceConfirmation({
      confirmed: true,
      acknowledgedCreditCost: CONTENT_HUB_MEDIA_INTELLIGENCE_COST,
      acknowledgedAssetCount: 7,
      expectedAssetCount: 8,
      acknowledgedNoAutomaticChanges: true,
    })).toMatchObject({ ok: false })
    expect(validateMediaIntelligenceConfirmation({
      confirmed: true,
      acknowledgedCreditCost: CONTENT_HUB_MEDIA_INTELLIGENCE_COST,
      acknowledgedAssetCount: 8,
      expectedAssetCount: 8,
      acknowledgedNoAutomaticChanges: true,
    })).toEqual({ ok: true })
  })

  it('requires an explicit review reset and no-publish acknowledgement for copy-to-media adaptation', () => {
    expect(validateCreativeAdaptationConfirmation({
      confirmed: true,
      acknowledgedCreditCost: CONTENT_HUB_REWRITE_COST,
      acknowledgedReopensReview: false,
      acknowledgedNoPublishOrSchedule: true,
    })).toMatchObject({ ok: false })
    expect(validateCreativeAdaptationConfirmation({
      confirmed: true,
      acknowledgedCreditCost: CONTENT_HUB_REWRITE_COST,
      acknowledgedReopensReview: true,
      acknowledgedNoPublishOrSchedule: true,
    })).toEqual({ ok: true })
  })

  it('requires the exact route-specific duration and rights-confirmed video contract before charging', () => {
    expect(CONTENT_HUB_VIDEO_COST).toBe(18)
    expect(validateVideoGenerationConfirmation({
      confirmed: true,
      acknowledgedCreditCost: CONTENT_HUB_VIDEO_COST,
      acknowledgedDurationSeconds: 5,
      acknowledgedNoPublishOrSchedule: true,
      acknowledgedReviewRequired: true,
      acknowledgedAssetRights: true,
    })).toMatchObject({ ok: false })
    expect(validateVideoGenerationConfirmation({
      confirmed: true,
      acknowledgedCreditCost: CONTENT_HUB_VIDEO_COST,
      acknowledgedDurationSeconds: 8,
      acknowledgedNoPublishOrSchedule: true,
      acknowledgedReviewRequired: false,
      acknowledgedAssetRights: true,
    })).toMatchObject({ ok: false })
    expect(validateVideoGenerationConfirmation({
      confirmed: true,
      acknowledgedCreditCost: CONTENT_HUB_VIDEO_COST,
      acknowledgedDurationSeconds: 8,
      acknowledgedNoPublishOrSchedule: true,
      acknowledgedReviewRequired: true,
      acknowledgedAssetRights: true,
    })).toEqual({ ok: true })
    expect(validateVideoGenerationConfirmation({
      confirmed: true,
      acknowledgedCreditCost: CONTENT_HUB_VIDEO_COST,
      acknowledgedDurationSeconds: 8,
      acknowledgedNoPublishOrSchedule: true,
      acknowledgedReviewRequired: true,
      acknowledgedAssetRights: true,
      productionRoute: 'MULTI_SHOT_CAMPAIGN_FILM',
    })).toMatchObject({ ok: false })
    expect(validateVideoGenerationConfirmation({
      confirmed: true,
      acknowledgedCreditCost: CONTENT_HUB_VIDEO_COST,
      acknowledgedDurationSeconds: 10,
      acknowledgedNoPublishOrSchedule: true,
      acknowledgedReviewRequired: true,
      acknowledgedAssetRights: true,
      productionRoute: 'MULTI_SHOT_CAMPAIGN_FILM',
    })).toEqual({ ok: true })
  })

  it('requires source, rights, exact duration, and the lower deterministic Motion Design price', () => {
    expect(CONTENT_HUB_MOTION_DESIGN_COST).toBe(6)
    expect(validateMotionDesignConfirmation({
      confirmed: true,
      acknowledgedCreditCost: CONTENT_HUB_MOTION_DESIGN_COST,
      acknowledgedDurationSeconds: 6,
      acknowledgedNoPublishOrSchedule: true,
      acknowledgedReviewRequired: true,
      acknowledgedAssetRights: true,
      sourceMediaId: '',
    })).toMatchObject({ ok: false })
    expect(validateMotionDesignConfirmation({
      confirmed: true,
      acknowledgedCreditCost: CONTENT_HUB_MOTION_DESIGN_COST,
      acknowledgedDurationSeconds: 6,
      acknowledgedNoPublishOrSchedule: true,
      acknowledgedReviewRequired: true,
      acknowledgedAssetRights: true,
      sourceMediaId: 'media-1',
    })).toEqual({ ok: true })
  })

  it('requires rights and an explicit same-property assertion for the low-cost photo film', () => {
    const base = {
      confirmed: true,
      acknowledgedCreditCost: CONTENT_HUB_PROPERTY_PHOTO_FILM_COST,
      acknowledgedDurationSeconds: 10,
      acknowledgedNoPublishOrSchedule: true,
      acknowledgedReviewRequired: true,
      acknowledgedAssetRights: true,
      referenceMediaIds: ['exterior', 'living', 'terrace'],
    }
    expect(CONTENT_HUB_PROPERTY_PHOTO_FILM_COST).toBe(6)
    expect(validatePropertyPhotoFilmConfirmation({
      ...base,
      acknowledgedSameProperty: false,
    })).toMatchObject({ ok: false })
    expect(validatePropertyPhotoFilmConfirmation({
      ...base,
      acknowledgedSameProperty: true,
    })).toEqual({ ok: true })
  })

  it('describes media-pending posts as visually incomplete, not final or live', () => {
    expect(getMediaPendingVisualStateCopy('en')).toEqual({
      title: 'Media decision pending',
      body: 'Media-pending posts are not visually final and do not mean anything is published or live.',
    })
    expect(getMediaPendingVisualStateCopy('ar').body).toContain('ليست نهائية بصريًا')
  })

  it('reports a fully successful image run with the actual charged credits', () => {
    expect(summarizeBulkImageGenerationOutcome({
      requested: 3,
      attempted: 3,
      generated: 3,
      failed: 0,
      refundPending: 0,
      creditsUsed: 9,
    })).toEqual({
      tone: 'success',
      message: '3 post images generated and attached for review. Credits actually used: 9. Nothing was scheduled or published.',
    })
  })

  it('reports partial success, confirmed refunds, and unstarted images without claiming completion', () => {
    const result = summarizeBulkImageGenerationOutcome({
      requested: 4,
      attempted: 3,
      generated: 2,
      failed: 1,
      refundPending: 0,
      creditsUsed: 6,
      stoppedReason: 'Daily image limit reached',
    })

    expect(result.tone).toBe('warning')
    expect(result.message).toContain('2 of 4 post images generated.')
    expect(result.message).toContain('1 failed and its charge was confirmed restored.')
    expect(result.message).toContain('1 image was not started.')
    expect(result.message).toContain('Credits actually used: 6.')
  })

  it('does not claim a refund completed while reconciliation is pending', () => {
    const result = summarizeBulkImageGenerationOutcome({
      requested: 2,
      attempted: 1,
      generated: 0,
      failed: 1,
      refundPending: 1,
      creditsUsed: 0,
    })

    expect(result.tone).toBe('error')
    expect(result.message).toContain('1 credit restoration is pending automatic reconciliation.')
    expect(result.message).toContain('pending restoration is not included')
    expect(result.message).not.toContain('confirmed restored')
    expect(summarizeBulkImageGenerationOutcome({
      requested: 1,
      attempted: 1,
      generated: 0,
      failed: 1,
      refundPending: 1,
      creditsUsed: 0,
    }, 'ar').message).toContain('معلقة للمصالحة التلقائية')
  })
})
