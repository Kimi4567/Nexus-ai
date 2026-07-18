import { describe, expect, it } from 'vitest'
import {
  cloudinaryVideoReviewFrames,
  normalizeGeneratedMediaQualityReview,
} from '@/lib/ai/generatedMediaQuality'
import { resolvePlatformImageFormat } from '@/lib/platformImageFormat'

const usage = {
  pricingVersion: 'test',
  model: 'gpt-4o' as const,
  calls: 1,
  inputTokens: 10,
  cachedInputTokens: 0,
  outputTokens: 10,
  estimatedProviderCostUsd: 0.001,
}

describe('generated media quality gate', () => {
  it('passes only a clean professional non-reference output', () => {
    const result = normalizeGeneratedMediaQualityReview({
      semanticAlignmentScore: 92,
      professionalQualityScore: 91,
      technicalIntegrity: true,
      noNewRasterText: true,
      noInventedClaims: true,
      issues: [],
      summary: 'Clean output.',
    }, { mediaType: 'IMAGE', referenceImageUrl: null }, usage)

    expect(result.passed).toBe(true)
    expect(result.referencePreservationScore).toBeNull()
  })

  it('rejects reference work below the immutable-source threshold', () => {
    const result = normalizeGeneratedMediaQualityReview({
      referencePreservationScore: 89,
      semanticAlignmentScore: 95,
      professionalQualityScore: 95,
      technicalIntegrity: true,
      noNewRasterText: true,
      noInventedClaims: true,
      issues: [],
    }, {
      mediaType: 'IMAGE',
      referenceImageUrl: 'https://res.cloudinary.com/demo/reference.png',
    }, usage)

    expect(result.passed).toBe(false)
    expect(result.referenceRequired).toBe(true)
  })

  it('rejects malformed raster text even when visual scores are high', () => {
    const result = normalizeGeneratedMediaQualityReview({
      semanticAlignmentScore: 96,
      professionalQualityScore: 96,
      technicalIntegrity: true,
      noNewRasterText: false,
      noInventedClaims: true,
      issues: ['Unreadable generated label.'],
    }, { mediaType: 'IMAGE', referenceImageUrl: null }, usage)

    expect(result.passed).toBe(false)
    expect(result.issues).toEqual(['Unreadable generated label.'])
  })

  it('rejects a visually strong image when its final platform canvas is wrong', () => {
    const targetFormat = resolvePlatformImageFormat('LINKEDIN')
    const result = normalizeGeneratedMediaQualityReview({
      semanticAlignmentScore: 96,
      professionalQualityScore: 96,
      technicalIntegrity: true,
      noNewRasterText: true,
      noInventedClaims: true,
      issues: [],
    }, {
      mediaType: 'IMAGE',
      referenceImageUrl: null,
      targetFormat,
      formatValidation: {
        passed: false,
        width: 1536,
        height: 1024,
        expectedWidth: 1200,
        expectedHeight: 628,
        aspectRatio: '1.91:1',
        contentType: 'image/jpeg',
      },
    }, usage)

    expect(result.passed).toBe(false)
    expect(result.formatRequired).toBe(true)
    expect(result.issues).toContain('Final image format is 1536×1024; required 1200×628 (1.91:1).')
  })

  it('passes the same image only after exact platform delivery validation', () => {
    const targetFormat = resolvePlatformImageFormat('LINKEDIN')
    const result = normalizeGeneratedMediaQualityReview({
      semanticAlignmentScore: 96,
      professionalQualityScore: 96,
      technicalIntegrity: true,
      noNewRasterText: true,
      noInventedClaims: true,
      issues: [],
    }, {
      mediaType: 'IMAGE',
      referenceImageUrl: null,
      targetFormat,
      formatValidation: {
        passed: true,
        width: 1200,
        height: 628,
        expectedWidth: 1200,
        expectedHeight: 628,
        aspectRatio: '1.91:1',
        contentType: 'image/jpeg',
      },
    }, usage)

    expect(result.passed).toBe(true)
    expect(result.formatValidation).toMatchObject({ width: 1200, height: 628 })
  })

  it('rejects a professional-looking video when its verified delivery canvas is wrong', () => {
    const result = normalizeGeneratedMediaQualityReview({
      semanticAlignmentScore: 95,
      professionalQualityScore: 95,
      technicalIntegrity: true,
      noNewRasterText: true,
      noInventedClaims: true,
      issues: [],
    }, {
      mediaType: 'VIDEO',
      referenceImageUrl: null,
      targetFormat: {
        platform: 'INSTAGRAM',
        format: 'Vertical short-form video',
        aspectRatio: '9:16',
        width: 720,
        height: 1280,
      },
      formatValidation: {
        passed: false,
        width: 1280,
        height: 720,
        expectedWidth: 720,
        expectedHeight: 1280,
        aspectRatio: '9:16',
        contentType: 'video/mp4',
      },
    }, usage)

    expect(result.passed).toBe(false)
    expect(result.formatRequired).toBe(true)
    expect(result.issues).toContain('Final video format is 1280×720; required 720×1280 (9:16).')
  })

  it('rejects a polished motion clip that lacks the required advertising sequence', () => {
    const result = normalizeGeneratedMediaQualityReview({
      referencePreservationScore: 96,
      semanticAlignmentScore: 95,
      professionalQualityScore: 95,
      technicalIntegrity: true,
      noNewRasterText: true,
      noInventedClaims: true,
      advertisingStructure: false,
      issues: [],
    }, {
      mediaType: 'VIDEO',
      referenceImageUrl: 'https://res.cloudinary.com/demo/reference.png',
      requireProductAdStructure: true,
    }, usage)

    expect(result.passed).toBe(false)
    expect(result.advertisingStructure).toBe(false)
    expect(result.issues[0]).toContain('hook, product reveal, benefit moment')
  })

  it('accepts a product video only when it reads as a finished paid-social advertisement', () => {
    const result = normalizeGeneratedMediaQualityReview({
      referencePreservationScore: 97,
      semanticAlignmentScore: 94,
      professionalQualityScore: 95,
      technicalIntegrity: true,
      noNewRasterText: true,
      noInventedClaims: true,
      advertisingStructure: true,
      paidSocialAdReadiness: true,
      commercialHookScore: 91,
      productHeroScore: 96,
      benefitCommunicationScore: 88,
      commercialPacingScore: 92,
      endFrameReadinessScore: 94,
      brandAlignmentScore: 93,
      issues: [],
    }, {
      mediaType: 'VIDEO',
      referenceImageUrl: 'https://res.cloudinary.com/demo/reference.png',
      requireProductAdStructure: true,
    }, usage)

    expect(result.passed).toBe(true)
    expect(result.paidSocialAdReadiness).toBe(true)
    expect(result.productHeroScore).toBe(96)
  })

  it('rejects beautiful AI B-roll when commercial readiness is below threshold', () => {
    const result = normalizeGeneratedMediaQualityReview({
      referencePreservationScore: 96,
      semanticAlignmentScore: 93,
      professionalQualityScore: 94,
      technicalIntegrity: true,
      noNewRasterText: true,
      noInventedClaims: true,
      advertisingStructure: true,
      paidSocialAdReadiness: false,
      commercialHookScore: 72,
      productHeroScore: 94,
      benefitCommunicationScore: 74,
      commercialPacingScore: 70,
      endFrameReadinessScore: 78,
      brandAlignmentScore: 91,
      issues: [],
    }, {
      mediaType: 'VIDEO',
      referenceImageUrl: 'https://res.cloudinary.com/demo/reference.png',
      requireProductAdStructure: true,
    }, usage)

    expect(result.passed).toBe(false)
    expect(result.issues).toContain('The result reads as a generic generated clip rather than a paid-social product advertisement.')
    expect(result.issues).toContain('The video edit lacks purposeful commercial pacing or coherent shot progression.')
  })

  it('builds three durable Cloudinary review frames for a video', () => {
    expect(cloudinaryVideoReviewFrames(
      'https://res.cloudinary.com/demo/video/upload/v1/nexus/video.mp4',
    )).toEqual([
      'https://res.cloudinary.com/demo/video/upload/so_0,f_jpg,q_auto/v1/nexus/video.jpg',
      'https://res.cloudinary.com/demo/video/upload/so_1,f_jpg,q_auto/v1/nexus/video.jpg',
      'https://res.cloudinary.com/demo/video/upload/so_2,f_jpg,q_auto/v1/nexus/video.jpg',
      'https://res.cloudinary.com/demo/video/upload/so_3,f_jpg,q_auto/v1/nexus/video.jpg',
      'https://res.cloudinary.com/demo/video/upload/so_4,f_jpg,q_auto/v1/nexus/video.jpg',
    ])
    expect(cloudinaryVideoReviewFrames(
      'https://res.cloudinary.com/demo/video/upload/v1/nexus/video.mp4',
      8,
    )).toEqual([
      'https://res.cloudinary.com/demo/video/upload/so_0,f_jpg,q_auto/v1/nexus/video.jpg',
      'https://res.cloudinary.com/demo/video/upload/so_1,f_jpg,q_auto/v1/nexus/video.jpg',
      'https://res.cloudinary.com/demo/video/upload/so_3,f_jpg,q_auto/v1/nexus/video.jpg',
      'https://res.cloudinary.com/demo/video/upload/so_5,f_jpg,q_auto/v1/nexus/video.jpg',
      'https://res.cloudinary.com/demo/video/upload/so_7,f_jpg,q_auto/v1/nexus/video.jpg',
    ])
  })
})
