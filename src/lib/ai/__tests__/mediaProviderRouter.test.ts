import { describe, expect, it } from 'vitest'
import {
  buildProfessionalVideoPrompt,
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
    expect(platformToRunwayRatio('PINTEREST', true)).toBe('960:960')
  })

  it('builds a product-safe, typography-safe commercial prompt', () => {
    const prompt = buildProfessionalVideoPrompt({
      brandName: 'NEXUS',
      caption: 'ابدأ حملتك بوضوح',
      videoDirection: 'Slow product reveal with a premium camera move.',
      industry: 'SaaS',
      toneWords: ['premium', 'clear'],
      hasReferenceImage: true,
    })
    expect(prompt).toContain('exact product and first-frame source of truth')
    expect(prompt).toContain('Preserve product geometry')
    expect(prompt).toContain('No generated captions')
    expect(prompt).toContain('Arabic or English copy outside the generated pixels')
  })
})
