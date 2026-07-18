import { describe, expect, it } from 'vitest'
import { normalizeGeneratedMediaQualityReview } from '@/lib/ai/generatedMediaQuality'

const providerUsage = {
  model: 'gpt-4o',
  calls: 1,
  inputTokens: 1_000,
  outputTokens: 100,
  cachedInputTokens: 0,
  estimatedProviderCostUsd: 0.01,
  pricingVersion: 'test',
} as const

const paidReadyReview = {
  referencePreservationScore: 90,
  semanticAlignmentScore: 85,
  professionalQualityScore: 80,
  technicalIntegrity: true,
  noNewRasterText: true,
  noInventedClaims: true,
  advertisingStructure: true,
  paidSocialAdReadiness: true,
  commercialHookScore: 85,
  productHeroScore: 80,
  benefitCommunicationScore: 85,
  commercialPacingScore: 80,
  endFrameReadinessScore: 85,
  brandAlignmentScore: 85,
  issues: [],
  summary: 'The output is ready for paid social use.',
}

describe('generated media quality standards', () => {
  it('passes a truthful source-locked paid-social ad at the standard delivery bar', () => {
    const result = normalizeGeneratedMediaQualityReview(paidReadyReview, {
      mediaType: 'VIDEO',
      referenceImageUrls: ['https://example.com/reference.jpg'],
      requireProductAdStructure: true,
      qualityStandard: 'PAID_SOCIAL',
    }, providerUsage)

    expect(result).toMatchObject({
      passed: true,
      qualityStandard: 'PAID_SOCIAL',
      issues: [],
    })
    expect(result.summary).toContain('paid-social gate passed')
  })

  it('keeps the premium provider-generated bar strict and never stores a contradictory ready verdict', () => {
    const result = normalizeGeneratedMediaQualityReview(paidReadyReview, {
      mediaType: 'VIDEO',
      referenceImageUrls: ['https://example.com/reference.jpg'],
      requireProductAdStructure: true,
      qualityStandard: 'PREMIUM',
    }, providerUsage)

    expect(result.passed).toBe(false)
    expect(result.summary).toContain('rejected this output')
    expect(result.summary).not.toContain('ready for paid social')
  })
})
