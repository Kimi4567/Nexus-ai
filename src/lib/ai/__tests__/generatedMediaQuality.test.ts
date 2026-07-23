import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
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

  it('does not reject a background-only asset for correctly omitting editable copy layers', () => {
    const result = normalizeGeneratedMediaQualityReview({
      semanticAlignmentScore: 92,
      professionalQualityScore: 91,
      technicalIntegrity: true,
      noNewRasterText: true,
      noInventedClaims: true,
      issues: ['Missing campaign message text', 'No approved overlays present'],
      summary: 'Background scene is aligned but contains no overlays.',
    }, {
      mediaType: 'IMAGE',
      referenceImageUrl: null,
      backgroundOnly: true,
    }, usage)

    expect(result.passed).toBe(true)
    expect(result.issues).toEqual([])
  })

  it('normalizes a consistent provider 0–10 rubric before applying 0–100 thresholds', () => {
    const result = normalizeGeneratedMediaQualityReview({
      semanticAlignmentScore: 9,
      professionalQualityScore: 9,
      technicalIntegrity: true,
      noNewRasterText: true,
      noInventedClaims: true,
      issues: ['Missing campaign message text', 'No approved overlays present'],
      summary: 'Strong background scene scored on a ten-point rubric.',
    }, {
      mediaType: 'IMAGE',
      referenceImageUrl: null,
      backgroundOnly: true,
    }, usage)

    expect(result.semanticAlignmentScore).toBe(90)
    expect(result.professionalQualityScore).toBe(90)
    expect(result.passed).toBe(true)
    expect(result.issues).toEqual([])
  })

  it('still treats missing required copy as an issue outside the background-only contract', () => {
    const result = normalizeGeneratedMediaQualityReview({
      semanticAlignmentScore: 92,
      professionalQualityScore: 91,
      technicalIntegrity: true,
      noNewRasterText: true,
      noInventedClaims: true,
      issues: ['Missing campaign message text'],
    }, { mediaType: 'IMAGE', referenceImageUrl: null }, usage)

    expect(result.passed).toBe(false)
    expect(result.issues).toContain('Missing campaign message text')
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

  it('allows an advertising-scene change when the protected product remains intact', () => {
    const result = normalizeGeneratedMediaQualityReview({
      referencePreservationScore: 96,
      semanticAlignmentScore: 92,
      professionalQualityScore: 91,
      technicalIntegrity: true,
      noNewRasterText: true,
      noInventedClaims: true,
      issues: [
        'Background changed from plain to textured with a vase and directional lighting.',
        'The setting was altered for a premium advertising composition.',
      ],
      summary: 'Product identity and garment details remain intact.',
    }, {
      mediaType: 'IMAGE',
      referenceImageUrl: 'https://res.cloudinary.com/demo/reference.png',
      allowAdvertisingSceneTransformation: true,
    }, usage)

    expect(result.passed).toBe(true)
    expect(result.issues).toEqual([])
  })

  it('still rejects a product change during an advertising-scene transformation', () => {
    const result = normalizeGeneratedMediaQualityReview({
      referencePreservationScore: 96,
      semanticAlignmentScore: 92,
      professionalQualityScore: 91,
      technicalIntegrity: true,
      noNewRasterText: true,
      noInventedClaims: true,
      issues: ['The product colour changed while the background was replaced.'],
    }, {
      mediaType: 'IMAGE',
      referenceImageUrl: 'https://res.cloudinary.com/demo/reference.png',
      allowAdvertisingSceneTransformation: true,
    }, usage)

    expect(result.passed).toBe(false)
    expect(result.issues).toContain('The product colour changed while the background was replaced.')
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

  it('judges a concept film by hero-subject clarity without inventing a real-product requirement', () => {
    const result = normalizeGeneratedMediaQualityReview({
      semanticAlignmentScore: 94,
      professionalQualityScore: 95,
      technicalIntegrity: true,
      noNewRasterText: true,
      noInventedClaims: true,
      advertisingStructure: true,
      paidSocialAdReadiness: true,
      commercialHookScore: 92,
      productHeroScore: 70,
      benefitCommunicationScore: 90,
      commercialPacingScore: 92,
      endFrameReadinessScore: 93,
      brandAlignmentScore: 91,
      issues: [],
    }, {
      mediaType: 'VIDEO',
      referenceImageUrl: null,
      requireProductAdStructure: true,
      requiresRealProductHero: false,
    }, usage)

    expect(result.passed).toBe(false)
    expect(result.issues).toContain(
      'The generated concept does not maintain a clear, unmistakable hero subject or use moment throughout the advertisement.',
    )
    expect(result.issues.join(' ')).not.toContain('real product')
  })

  it('keeps the concept-film reviewer alert to operational proof and serving drift', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/lib/ai/generatedMediaQuality.ts'), 'utf8')
    expect(source).toContain('packaging, containers, jars, cups, pouring, brewing, serving, tasting')
    expect(source).toContain('first-party process evidence')
    expect(source).toContain('invented operational evidence')
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
