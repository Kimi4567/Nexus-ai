import { describe, expect, it } from 'vitest'

import {
  deriveCreativeCompositionPlan,
  validateCreativeCompositionPlan,
  type CompositionInput,
} from '../creativeComposition'
import { getDefaultTemplateForPlatform, type CreativeTemplateSpec } from '../creativeTemplates'

const baseInput: CompositionInput = {
  postId: 'post-3',
  postCaption: 'Make office coffee breaks easier with a more consistent option for the team.',
  brandName: 'Nexus Coffee',
  logoUrl: 'https://cdn.example.com/logo.png',
  colorPalette: ['#123456', '#F8FAFC'],
  language: 'en',
  backgroundImageUrl: 'https://cdn.example.com/generated-bg.png',
  generatedVisualId: 'visual-123',
  creativeRequirement: {
    postId: 'post-3',
    platform: 'LINKEDIN',
    format: 'LinkedIn feed image',
    aspectRatio: '1.91:1',
    objective: 'Support office coffee planning',
    funnelStage: 'Scheduled execution',
    contentAngle: 'Support smoother team coffee breaks',
    visualConcept: 'Warm office coffee station background with no text.',
    requiredAssetType: 'generated_background',
    sourcePreference: 'generated',
    textOverlayNeeded: true,
    headlineLayer: 'Make team coffee breaks easier',
    ctaLayer: 'Review options',
    logoNeeded: true,
    productImageNeeded: false,
    proofConstraints: [
      'Creative requirements guide media decisions only; no proof badges without analytics.',
    ],
    status: 'generation_ready',
    statusLabel: 'Ready for background generation',
    statusLabelAr: 'جاهز لتوليد الخلفية',
    explanation: 'Background can be generated for review.',
    explanationAr: 'يمكن توليد الخلفية للمراجعة.',
    countsAsMediaPresent: false,
  },
}

function expectQualityPass(plan: ReturnType<typeof deriveCreativeCompositionPlan>, id: string): void {
  expect(plan.qualityChecks.find(check => check.id === id)?.passed).toBe(true)
}

describe('deriveCreativeCompositionPlan', () => {
  it('creates a valid LinkedIn composition plan with a generated background', () => {
    const plan = deriveCreativeCompositionPlan(baseInput)

    expect(plan.postId).toBe('post-3')
    expect(plan.templateId).toBe('linkedin-landscape-insight-v1')
    expect(plan.platform).toBe('LINKEDIN')
    expect(plan.aspectRatio).toBe('1.91:1')
    expect(plan.background).toMatchObject({
      imageUrl: 'https://cdn.example.com/generated-bg.png',
      source: 'generated_background',
      generatedVisualId: 'visual-123',
    })
    expect(plan.layers.map(layer => layer.role)).toEqual(
      expect.arrayContaining(['background', 'headline', 'subheading', 'cta', 'logo_or_brand_name']),
    )
    expect(plan.qualityChecks.every(check => check.passed)).toBe(true)
  })

  it('uses an editable brand-name fallback when a logo is missing', () => {
    const plan = deriveCreativeCompositionPlan({
      ...baseInput,
      logoUrl: null,
      brandName: 'Bloom Office Coffee',
    })
    const brandLayer = plan.layers.find(layer => layer.role === 'logo_or_brand_name')

    expect(brandLayer?.type).toBe('logo_or_brand_name')
    expect(brandLayer?.editable).toBe(true)
    expect(brandLayer?.content.text).toBe('Bloom Office Coffee')
    expect(brandLayer?.content.renderMode).toBe('composited_text')
    expect(brandLayer?.validationMessages).toContain(
      'No logo asset found; use editable brand-name fallback layer.',
    )
  })

  it('uses a neutral fallback color when Brand Brain has no color palette', () => {
    const plan = deriveCreativeCompositionPlan({
      ...baseInput,
      colorPalette: [],
      creativeRequirement: {
        ...baseInput.creativeRequirement,
        platform: 'META',
        format: 'Meta feed image',
        aspectRatio: '4:5',
      },
    })
    const accentLayer = plan.layers.find(layer => layer.role === 'accent')

    expect(accentLayer?.content.color).toBe('#334155')
    expect(accentLayer?.contentSource).toBe('template_default')
    expect(accentLayer?.validationMessages).toContain(
      'No Brand Brain color palette found; using neutral premium fallback color.',
    )
  })

  it('keeps the headline editable and not AI-rendered', () => {
    const plan = deriveCreativeCompositionPlan(baseInput)
    const headline = plan.layers.find(layer => layer.role === 'headline')

    expect(headline?.editable).toBe(true)
    expect(headline?.content.text).toBe('Make team coffee breaks easier')
    expect(headline?.content.renderMode).toBe('composited_text')
    expect(headline?.content.aiRenderedText).toBe(false)
    expectQualityPass(plan, 'editable_headline_layer')
  })

  it('keeps the CTA editable', () => {
    const plan = deriveCreativeCompositionPlan(baseInput)
    const cta = plan.layers.find(layer => layer.role === 'cta')

    expect(cta?.editable).toBe(true)
    expect(cta?.content.text).toBe('Review options')
    expect(cta?.content.renderMode).toBe('composited_text')
    expectQualityPass(plan, 'editable_cta_layer')
  })

  it('keeps Arabic headline text as editable composited text', () => {
    const plan = deriveCreativeCompositionPlan({
      ...baseInput,
      language: 'ar',
      postCaption: 'اجعل استراحة القهوة اليومية أكثر سهولة للفريق.',
      creativeRequirement: {
        ...baseInput.creativeRequirement,
        headlineLayer: 'استراحة قهوة أسهل للفريق',
        ctaLayer: null,
      },
    })
    const headline = plan.layers.find(layer => layer.role === 'headline')
    const cta = plan.layers.find(layer => layer.role === 'cta')

    expect(headline?.content.language).toBe('ar')
    expect(headline?.content.text).toBe('استراحة قهوة أسهل للفريق')
    expect(headline?.content.renderMode).toBe('composited_text')
    expect(headline?.content.aiRenderedText).toBe(false)
    expect(cta?.content.text).toBe('استكشف الخيارات')
    expectQualityPass(plan, 'arabic_text_is_composited_editable')
  })

  it('validates layers that fall outside safe zones', () => {
    const template = getDefaultTemplateForPlatform('LINKEDIN')
    template.layers = template.layers.map(layer => (
      layer.id === 'headline'
        ? {
            ...layer,
            position: { x: 0.01, y: 0.01, anchor: 'top_left' },
            size: { width: 0.2, height: 0.1 },
          }
        : layer
    ))
    const plan = deriveCreativeCompositionPlan({
      ...baseInput,
      creativeTemplate: template,
    })
    const check = plan.qualityChecks.find(item => item.id === 'layers_fit_safe_zones')

    expect(plan.layers.find(layer => layer.id === 'headline')?.safeZoneCompliant).toBe(false)
    expect(check?.passed).toBe(false)
    expect(check?.message).toContain('headline')
  })

  it('blocks proof badges when proof constraints disallow proof', () => {
    const template: CreativeTemplateSpec = {
      ...getDefaultTemplateForPlatform('LINKEDIN'),
      layers: [
        ...getDefaultTemplateForPlatform('LINKEDIN').layers,
        {
          id: 'proof',
          type: 'badge',
          role: 'Optional proof badge',
          contentSource: 'creative_requirement',
          editable: true,
          required: false,
          position: { x: 0.7, y: 0.78, anchor: 'bottom_left' },
          size: { width: 0.18, height: 0.08 },
          constraints: ['Only include with real proof.'],
          fallback: 'Trusted by teams',
          validationRules: ['Proof must be backed by approved evidence.'],
        },
      ],
    }
    const plan = deriveCreativeCompositionPlan({
      ...baseInput,
      creativeTemplate: template,
      creativeRequirement: {
        ...baseInput.creativeRequirement,
        proofConstraints: ['No proof badges without analytics.'],
      },
    })

    expect(plan.layers.some(layer => layer.role === 'proof_badge_optional')).toBe(false)
    expectQualityPass(plan, 'proof_layer_blocked_without_allowed_proof')
  })

  it('never auto-attaches composition plans to SocialPost media', () => {
    const plan = deriveCreativeCompositionPlan(baseInput)

    expect(plan.attachPolicy).toEqual({
      autoAttach: false,
      attachRequiresExplicitUserAction: true,
      attachSurface: 'content_hub',
    })
    expectQualityPass(plan, 'attach_policy_requires_content_hub_action')
  })

  it('does not expose action-enabling publish, schedule, autopilot, or paid launch fields', () => {
    const plan = deriveCreativeCompositionPlan(baseInput)
    const keys = new Set(Object.keys(plan))

    expect(keys.has('publish')).toBe(false)
    expect(keys.has('schedule')).toBe(false)
    expect(keys.has('autopilot')).toBe(false)
    expect(keys.has('paidLaunch')).toBe(false)
    expect(plan.safety).toEqual({
      doesNotPublish: true,
      doesNotSchedule: true,
      doesNotUpdateBrandBrainLearning: true,
      doesNotLaunchPaidAds: true,
    })
    expectQualityPass(plan, 'no_publish_schedule_paid_claims')
  })

  it('classifies output as a draft composition plan, not final ad creative', () => {
    const plan = deriveCreativeCompositionPlan(baseInput)

    expect(plan.outputClassification).toBe('draft_composition_plan')
    expect(plan.status).toBe('composition_plan_for_review')
    expect(JSON.stringify(plan)).not.toContain('final_ad_creative')
    expectQualityPass(plan, 'draft_composition_plan_classification')
  })

  it('falls back safely for unknown platforms without a provided template', () => {
    const plan = deriveCreativeCompositionPlan({
      ...baseInput,
      creativeRequirement: {
        ...baseInput.creativeRequirement,
        platform: 'MASTODON',
        format: 'Unknown social format',
        aspectRatio: 'unknown',
      },
    })

    expect(plan.templateId).toBe('generic-square-review-v1')
    expect(plan.platform).toBe('UNKNOWN')
    expect(plan.aspectRatio).toBe('1:1')
  })
})

describe('validateCreativeCompositionPlan', () => {
  it('returns required validation failures for missing background media', () => {
    const plan = deriveCreativeCompositionPlan({
      ...baseInput,
      backgroundImageUrl: null,
      generatedVisualId: null,
    })
    const results = validateCreativeCompositionPlan(plan)

    expect(results.find(check => check.id === 'background_exists_when_required')).toMatchObject({
      passed: false,
      severity: 'required',
    })
  })
})
