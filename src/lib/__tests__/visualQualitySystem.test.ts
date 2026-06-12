import { describe, expect, it } from 'vitest'

import {
  buildPromptFromVisualBrief,
  buildVisualCreativeBrief,
  detectVisualCategory,
  type VisualQualityContext,
} from '@/lib/ai/visualQualitySystem'

function promptFor(ctx: VisualQualityContext): string {
  const brief = buildVisualCreativeBrief(ctx, {
    centralElement: ctx.postCaption || ctx.primaryOffer || 'premium campaign scene',
    emotion: 'premium, confident',
    cta: 'Book Now',
    visualMood: 'polished commercial mood',
  })
  return buildPromptFromVisualBrief(brief, ctx, 'en')
}

describe('Visual Quality System category detection and prompt rules', () => {
  it('builds safe premium healthcare prompts for a dental clinic', () => {
    const ctx = {
      brandName: 'Pearl Dental',
      industry: 'dental clinic',
      primaryOffer: 'cosmetic dentistry and family dental care',
      postCaption: 'Book a brighter smile consultation this week',
      colorPalette: ['#EAF6FF', '#2F80ED'],
      platform: 'INSTAGRAM',
    }

    const brief = buildVisualCreativeBrief(ctx)
    const prompt = promptFor(ctx)

    expect(detectVisualCategory(ctx)).toBe('healthcare_medical')
    expect(brief.categoryLabel).toBe('Healthcare / Medical')
    expect(prompt).toContain('bright clean modern clinic')
    expect(prompt).toContain('trust')
    expect(prompt).toContain('blood')
    expect(prompt).toContain('empty dental chair')
    expect(prompt).toContain('NO text')
  })

  it('builds appetizing food and hospitality prompts for a restaurant', () => {
    const ctx = {
      brandName: 'Saffron Table',
      industry: 'restaurant',
      primaryOffer: 'Levantine dinner menu',
      postCaption: 'Reserve your table for our signature grilled platter',
      colorPalette: 'warm amber, cream',
    }

    const prompt = promptFor(ctx)

    expect(detectVisualCategory(ctx)).toBe('food_hospitality')
    expect(prompt).toContain('appetizing hero dish')
    expect(prompt).toContain('warm inviting restaurant light')
    expect(prompt).toContain('messy plates')
    expect(prompt).toContain('dirty tables')
  })

  it('builds premium daylight prompts for real estate', () => {
    const ctx = {
      brandName: 'Dubai Dream Homes',
      industry: 'real estate',
      primaryOffer: 'premium apartments for first-time buyers',
      postCaption: 'Find a bright apartment with space for your next chapter',
      platform: 'FACEBOOK',
    }

    const prompt = promptFor(ctx)

    expect(detectVisualCategory(ctx)).toBe('real_estate_property')
    expect(prompt).toContain('bright premium interiors')
    expect(prompt).toContain('bright natural daylight')
    expect(prompt).toContain('fake distorted buildings')
    expect(prompt).toContain('messy rooms')
  })

  it('builds polished beauty prompts for a salon', () => {
    const ctx = {
      brandName: 'Glow Studio',
      industry: 'hair salon and spa',
      primaryOffer: 'premium hair color and facial treatments',
      postCaption: 'Step into a calmer beauty ritual this weekend',
      colorPalette: 'rose, white',
    }

    const prompt = promptFor(ctx)

    expect(detectVisualCategory(ctx)).toBe('beauty_wellness')
    expect(prompt).toContain('premium salon or spa')
    expect(prompt).toContain('soft flattering daylight')
    expect(prompt).toContain('distorted faces')
    expect(prompt).toContain('overprocessed skin')
  })

  it('builds energetic but safe prompts for a gym', () => {
    const ctx = {
      brandName: 'Forge Fitness',
      industry: 'gym and personal training',
      primaryOffer: 'strength training programs',
      postCaption: 'Build strength with coached workouts that keep you consistent',
      platform: 'TIKTOK',
    }

    const prompt = promptFor(ctx)

    expect(detectVisualCategory(ctx)).toBe('fitness_sports')
    expect(prompt).toContain('clean modern gym')
    expect(prompt).toContain('dynamic hero action')
    expect(prompt).toContain('unsafe poses')
    expect(prompt).toContain('distorted bodies')
  })

  it('builds editorial prompts for fashion retail', () => {
    const ctx = {
      brandName: 'Linen Lane',
      industry: 'fashion boutique',
      primaryOffer: 'summer linen collection',
      postCaption: 'Discover breathable pieces for elevated everyday style',
    }

    const prompt = promptFor(ctx)

    expect(detectVisualCategory(ctx)).toBe('retail_fashion')
    expect(prompt).toContain('editorial product or model composition')
    expect(prompt).toContain('fashion editorial framing')
    expect(prompt).toContain('warped clothing')
    expect(prompt).toContain('distorted limbs')
  })

  it('builds clean premium SaaS prompts without fake UI clutter', () => {
    const ctx = {
      brandName: 'Nexus AI',
      industry: 'SaaS AI marketing platform',
      primaryOffer: 'AI marketing operating system',
      postCaption: 'Turn campaign strategy into content execution in minutes',
      colorPalette: ['#6D5DFB', '#0F172A'],
    }

    const prompt = promptFor(ctx)

    expect(detectVisualCategory(ctx)).toBe('technology_saas')
    expect(prompt).toContain('premium abstract productivity visual')
    expect(prompt).toContain('clean luminous studio')
    expect(prompt).toContain('fake unreadable UI text')
    expect(prompt).toContain('dark generic tech blobs')
  })
})
