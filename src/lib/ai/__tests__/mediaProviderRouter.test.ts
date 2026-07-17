import { describe, expect, it } from 'vitest'
import {
  buildCinematicProductAdBrief,
  chooseProfessionalImageProvider,
  platformToRunwayRatio,
} from '../mediaProviderRouter'

describe('professional media provider routing', () => {
  it('uses GPT Image 2 without fallback for product/reference fidelity', () => {
    expect(chooseProfessionalImageProvider({
      purpose: 'product_to_ad',
      hasReferenceImage: true,
      openAiConfigured: true,
      falConfigured: true,
    })).toEqual({
      provider: 'openai-gpt-image-2',
      reason: 'reference_fidelity',
      fallback: null,
    })
  })

  it('fails closed instead of silently replacing a reference product', () => {
    expect(() => chooseProfessionalImageProvider({
      purpose: 'product_to_ad',
      hasReferenceImage: true,
      openAiConfigured: false,
      falConfigured: true,
    })).toThrow('REFERENCE_IMAGE_PROVIDER_UNAVAILABLE')
  })

  it('prefers final quality for ads and keeps FAL as a bounded fallback', () => {
    expect(chooseProfessionalImageProvider({
      purpose: 'final_ad_creative',
      hasReferenceImage: false,
      openAiConfigured: true,
      falConfigured: true,
    })).toMatchObject({
      provider: 'openai-gpt-image-2',
      fallback: 'fal-flux',
    })
  })

  it('uses platform-native video orientation', () => {
    expect(platformToRunwayRatio('TIKTOK', false)).toBe('720:1280')
    expect(platformToRunwayRatio('LINKEDIN', false)).toBe('1280:720')
    expect(platformToRunwayRatio('PINTEREST', true)).toBe('720:1280')
    expect(platformToRunwayRatio('FACEBOOK', false)).toBe('720:1280')
  })

  it('builds a product-safe, typography-safe advertising brief', () => {
    const brief = buildCinematicProductAdBrief({
      brandName: 'NEXUS',
      description: 'A premium product.',
      primaryOffer: 'One approved offer.',
      verifiedProof: ['Verified proof'],
      uniqueAdvantages: ['Clear advantage'],
      caption: 'ابدأ حملتك بوضوح',
      videoDirection: 'Slow product reveal with a premium camera move.',
      industry: 'SaaS',
      toneWords: ['premium', 'clear'],
    })
    expect(brief.productInfo).toContain('sole source of truth')
    expect(brief.userConcept).toContain('0–2s visual hook')
    expect(brief.userConcept).toContain('Do not generate text')
    expect(brief.productInfo.length).toBeLessThanOrEqual(2_500)
    expect(brief.userConcept.length).toBeLessThanOrEqual(3_500)
  })

  it('keeps the source and advertising rules when strategy and caption inputs are very long', () => {
    const brief = buildCinematicProductAdBrief({
      brandName: 'NEXUS',
      caption: 'Long campaign copy '.repeat(100),
      videoDirection: 'Detailed cinematic direction '.repeat(100),
      industry: 'AI marketing software',
      toneWords: ['premium', 'precise', 'confident', 'clear'],
    })

    expect(brief.productInfo.length).toBeLessThanOrEqual(2_500)
    expect(brief.userConcept.length).toBeLessThanOrEqual(3_500)
    expect(brief.productInfo).toContain('source of truth')
    expect(brief.userConcept).toContain('Do not generate text')
    expect(brief.userConcept).toContain('extra product variants')
  })
})
