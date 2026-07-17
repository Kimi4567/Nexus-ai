import { describe, expect, it } from 'vitest'
import {
  cloudinaryVideoReviewFrames,
  normalizeGeneratedMediaQualityReview,
} from '@/lib/ai/generatedMediaQuality'

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
