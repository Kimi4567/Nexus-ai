import { describe, expect, it, vi } from 'vitest'

const { mockExtractVisualConcept } = vi.hoisted(() => ({
  mockExtractVisualConcept: vi.fn(),
}))

vi.mock('@/lib/ai/conceptExtractor', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai/conceptExtractor')>('@/lib/ai/conceptExtractor')
  return {
    ...actual,
    extractVisualConcept: mockExtractVisualConcept,
  }
})

import {
  buildImagePrompt,
  IMAGE_OUTPUT_CLASSIFICATION,
  normalizeTextFreeCentralElement,
  TEXT_FREE_BACKGROUND_IMAGE_CONSTRAINTS,
  wrapPromptWithTextFreeBackgroundContract,
} from '@/lib/ai/imageGen'

describe('imageGen prompt contract', () => {
  it('converts dashboard and infographic directions into a raster-safe physical scene', () => {
    const normalized = normalizeTextFreeCentralElement(
      'إنفوجرافيك مع مخططات وأيقونات تحليل البيانات',
      'saas_ai_tech',
    )

    expect(normalized).toContain('marketing and product team')
    expect(normalized).toContain('blank color-coded wooden tiles')
    expect(normalized).not.toContain('إنفوجرافيك')
  })

  it('catches plural reports, charts, laptops, and digital devices before provider generation', () => {
    const unsafeScenes = [
      'owner analyzing colorful charts and graphs across printed reports',
      'team reviewing campaign reports beside laptops',
      'professionals gathered around digital devices',
    ]

    for (const scene of unsafeScenes) {
      const normalized = normalizeTextFreeCentralElement(scene, 'agency_consultancy')
      expect(normalized).toContain('blank color-coded wooden tiles')
      expect(normalized).not.toBe(scene)
    }
  })

  it('keeps an already tangible text-free scene intact', () => {
    const scene = 'three strategists arranging blank planning cards around a clean table'
    expect(normalizeTextFreeCentralElement(scene, 'agency_consultancy')).toBe(scene)
  })

  it('brand-level fallback stays background-only and does not ask for text or logos', async () => {
    const { prompt } = await buildImagePrompt({
      visualType: 'HERO',
      visualStyle: 'Premium',
      brandName: 'Nexus Coffee',
      industry: 'coffee',
      platform: 'META',
      assetRole: 'campaign_concept_background',
    })

    expect(prompt).toContain('BACKGROUND VISUAL')
    expect(prompt).toContain('draft_background_for_review')
    expect(prompt).toContain('Do not include logos')
    expect(prompt).not.toMatch(/include Arabic brand name/i)
    expect(prompt).not.toMatch(/include brand name/i)
    expect(prompt).not.toMatch(/include headline/i)
    expect(prompt).not.toMatch(/include text/i)
    expect(prompt).not.toMatch(/logo in image/i)
    expect(prompt).not.toMatch(/CTA in image/i)
  })

  it('caption-driven prompt includes no-text, no-logo, no-CTA, and no Arabic raster text constraints', async () => {
    mockExtractVisualConcept.mockResolvedValueOnce({
      centralElement: 'office coffee station with warm morning light and uncluttered counter space',
      emotion: 'calm, useful',
      headline: 'Coffee planning made easier',
      cta: 'Review options',
      visualMood: 'Warm office break-room atmosphere with balanced morning light',
    })

    const { prompt } = await buildImagePrompt({
      visualType: 'SOCIAL_PREVIEW',
      visualStyle: 'Premium',
      brandName: 'Nexus Coffee',
      industry: 'coffee',
      postCaption: 'Make office coffee breaks easier with a more consistent setup.',
      platform: 'LINKEDIN',
      assetRole: 'post_background',
    })

    expect(prompt).toContain('Absolutely NO text')
    expect(prompt).toContain('Do not include logos')
    expect(prompt).toContain('no Arabic raster text')
    expect(prompt).toContain('CTA')
    expect(prompt).toContain('draft background visual for review')
  })

  it('sanitizes an extracted dashboard concept before sending it to the image provider', async () => {
    mockExtractVisualConcept.mockResolvedValueOnce({
      centralElement: 'floating analytics dashboard with metric cards and charts',
      emotion: 'clear, intelligent',
      headline: 'Understand performance clearly',
      cta: 'Review insights',
      visualMood: 'Premium strategic atmosphere',
    })

    const { prompt, concept } = await buildImagePrompt({
      visualType: 'SOCIAL_PREVIEW',
      visualStyle: 'Premium',
      brandName: 'Nexus',
      industry: 'AI marketing SaaS',
      postCaption: 'Use analytics to improve marketing decisions.',
      platform: 'META',
      assetRole: 'post_background',
    })

    expect(concept?.centralElement).toContain('marketing and product team')
    expect(prompt).not.toContain('floating analytics dashboard')
    expect(prompt).not.toContain('Nexus')
    expect(prompt).not.toContain('Stripe')
    expect(prompt).not.toContain('Linear')
  })

  it('uses CreativeRequirement hints when provided', async () => {
    mockExtractVisualConcept.mockResolvedValueOnce({
      centralElement: 'carefully arranged coffee jars beside office mugs',
      emotion: 'prepared, calm',
      headline: 'Plan better coffee breaks',
      cta: 'Review plan',
      visualMood: 'Editorial office coffee setup with practical planning feel',
    })

    const { prompt } = await buildImagePrompt({
      visualType: 'SOCIAL_PREVIEW',
      visualStyle: 'Premium',
      brandName: 'Nexus Coffee',
      industry: 'coffee',
      postCaption: 'Plan the weekly coffee setup before the office rush.',
      creativeRequirement: {
        platform: 'LINKEDIN',
        aspectRatio: '1.91:1',
        visualConcept: 'Office coffee planning background for LinkedIn.',
        objective: 'Support office coffee planning',
        funnelStage: 'Scheduled execution',
        contentAngle: 'Weekly office coffee planning',
        requiredAssetType: 'generated_background',
        sourcePreference: 'generated',
        textOverlayNeeded: true,
        logoNeeded: true,
        productImageNeeded: false,
        proofConstraints: ['No proof badge unless source proof exists.'],
      },
    })

    expect(prompt).toContain('CREATIVE REQUIREMENT HINTS')
    expect(prompt).toContain('Office coffee planning background for LinkedIn.')
    expect(prompt).toContain('Campaign objective: Support office coffee planning')
    expect(prompt).toContain('Recommended aspect ratio: 1.91:1')
    expect(prompt).toContain('Proof constraints: No proof badge unless source proof exists.')
  })

  it('uses CreativeTemplate aspect ratio and safe-zone hints when provided', async () => {
    mockExtractVisualConcept.mockResolvedValueOnce({
      centralElement: 'coffee bag and cup with space for layout',
      emotion: 'balanced, warm',
      headline: 'Coffee planning made easier',
      cta: 'Review',
      visualMood: 'Minimal product-led coffee scene',
    })

    const { prompt } = await buildImagePrompt({
      visualType: 'SOCIAL_PREVIEW',
      visualStyle: 'Premium',
      brandName: 'Nexus Coffee',
      industry: 'coffee',
      postCaption: 'A practical coffee setup for office routines.',
      creativeTemplate: {
        templateName: 'Meta portrait offer card',
        aspectRatio: '4:5',
        width: 1080,
        height: 1350,
        format: 'feed_portrait',
        safeZones: { top: 96, right: 72, bottom: 120, left: 72 },
        layers: [
          {
            id: 'background',
            type: 'background',
            role: 'Generated background',
            contentSource: 'generated_asset',
            editable: false,
            required: true,
            position: { x: 0, y: 0, anchor: 'top_left' },
            size: { width: 1, height: 1 },
            constraints: [],
            fallback: null,
            validationRules: [],
          },
          {
            id: 'headline',
            type: 'headline',
            role: 'Editable headline',
            contentSource: 'social_post',
            editable: true,
            required: true,
            position: { x: 0.08, y: 0.68, anchor: 'bottom_left' },
            size: { width: 0.68, height: 0.16 },
            constraints: [],
            fallback: null,
            validationRules: [],
          },
        ],
      },
    })

    expect(prompt).toContain('TEMPLATE / LAYER HINTS')
    expect(prompt).toContain('Template aspect ratio: 4:5')
    expect(prompt).toContain('Template canvas: 1080x1350')
    expect(prompt).toContain('Respect safe zones: top 96px')
    expect(prompt).toContain('headline at bottom_left')
  })

  it('exports reusable text-free background constraints and classification', () => {
    const wrapped = wrapPromptWithTextFreeBackgroundContract('Coffee background')

    expect(TEXT_FREE_BACKGROUND_IMAGE_CONSTRAINTS).toContain('Exclude all text')
    expect(TEXT_FREE_BACKGROUND_IMAGE_CONSTRAINTS).toContain('no Arabic raster text')
    expect(TEXT_FREE_BACKGROUND_IMAGE_CONSTRAINTS).toContain('draft background visual for review')
    expect(wrapped).toContain('Coffee background')
    expect(wrapped).toContain('Do not include logos')
    expect(IMAGE_OUTPUT_CLASSIFICATION).toBe('draft_background_for_review')
  })
})
