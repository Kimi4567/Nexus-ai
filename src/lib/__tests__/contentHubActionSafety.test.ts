import { describe, expect, it } from 'vitest'
import {
  CONTENT_HUB_IMAGE_COST,
  CONTENT_HUB_REWRITE_COST,
  getBulkImageGenerationCost,
  getMediaPendingVisualStateCopy,
  validateBulkImageGenerationConfirmation,
  validateSingleImageGenerationConfirmation,
  validateRewriteConfirmation,
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
    expect(getBulkImageGenerationCost(8)).toBe(24)
    expect(validateBulkImageGenerationConfirmation({
      confirmed: true,
      acknowledgedImageCount: 7,
      acknowledgedCreditCost: 24,
      expectedImageCount: 8,
    })).toMatchObject({ ok: false })
    expect(validateBulkImageGenerationConfirmation({
      confirmed: true,
      acknowledgedImageCount: 8,
      acknowledgedCreditCost: 21,
      expectedImageCount: 8,
    })).toMatchObject({ ok: false })
    expect(validateBulkImageGenerationConfirmation({
      confirmed: true,
      acknowledgedImageCount: 8,
      acknowledgedCreditCost: 24,
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
    expect(CONTENT_HUB_REWRITE_COST).toBe(1)
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

  it('describes media-pending posts as visually incomplete, not final or live', () => {
    expect(getMediaPendingVisualStateCopy('en')).toEqual({
      title: 'Media decision pending',
      body: 'Media-pending posts are not visually final and do not mean anything is published or live.',
    })
    expect(getMediaPendingVisualStateCopy('ar').body).toContain('ليست نهائية بصريًا')
  })
})
