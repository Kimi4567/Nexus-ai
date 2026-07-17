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

  it('builds three durable Cloudinary review frames for a video', () => {
    expect(cloudinaryVideoReviewFrames(
      'https://res.cloudinary.com/demo/video/upload/v1/nexus/video.mp4',
    )).toEqual([
      'https://res.cloudinary.com/demo/video/upload/so_0,f_jpg,q_auto/v1/nexus/video.jpg',
      'https://res.cloudinary.com/demo/video/upload/so_2,f_jpg,q_auto/v1/nexus/video.jpg',
      'https://res.cloudinary.com/demo/video/upload/so_4,f_jpg,q_auto/v1/nexus/video.jpg',
    ])
  })
})
