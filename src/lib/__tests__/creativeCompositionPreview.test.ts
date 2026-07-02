import { describe, expect, it } from 'vitest'

import {
  deriveCreativeCompositionPlan,
  type CompositionInput,
  type CreativeCompositionPlan,
} from '../creativeComposition'
import {
  assertCompositionPlanForPreview,
  deriveCreativeCompositionPreview,
  validateCreativeCompositionPreview,
} from '../creativeCompositionPreview'
import { getDefaultTemplateForPlatform, type CreativeTemplateSpec } from '../creativeTemplates'

const post3Input: CompositionInput = {
  postId: 'cmqy4rgbc00041221gdbgqkhe',
  postCaption: 'Make office coffee breaks easier with a more consistent option for the team.',
  brandName: 'Cairo Bloom Coffee',
  logoUrl: 'https://cdn.example.com/cairo-bloom-logo.png',
  colorPalette: ['#1E3A8A', '#F8FAFC'],
  language: 'en',
  backgroundImageUrl: 'https://res.cloudinary.com/demo/image/upload/post-3-background.png',
  generatedVisualId: 'generated-post-3',
  creativeRequirement: {
    postId: 'cmqy4rgbc00041221gdbgqkhe',
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

function validPost3Plan(overrides: Partial<CompositionInput> = {}): CreativeCompositionPlan {
  return deriveCreativeCompositionPlan({
    ...post3Input,
    ...overrides,
    creativeRequirement: {
      ...post3Input.creativeRequirement,
      ...overrides.creativeRequirement,
    },
  })
}

function expectValidationPass(preview: ReturnType<typeof deriveCreativeCompositionPreview>, id: string): void {
  expect(preview.validations.find(validation => validation.id === id)?.passed).toBe(true)
}

describe('deriveCreativeCompositionPreview', () => {
  it('creates draft_composition_preview from a valid CreativeCompositionPlan', () => {
    const plan = validPost3Plan()
    const preview = deriveCreativeCompositionPreview({ plan })

    expect(assertCompositionPlanForPreview(plan)).toBe(true)
    expect(preview.previewId).toBe(`preview_${plan.planId}`)
    expect(preview.planId).toBe(plan.planId)
    expect(preview.postId).toBe('cmqy4rgbc00041221gdbgqkhe')
    expect(preview.templateId).toBe('linkedin-landscape-insight-v1')
    expect(preview.outputClassification).toBe('draft_composition_preview')
    expect(preview.reviewStatus).toBe('preview_for_review')
    expect(preview.canvas).toEqual({ width: 1200, height: 628, aspectRatio: '1.91:1' })
    expectValidationPass(preview, 'draft_composition_preview_classification')
  })

  it('keeps the SVG artifact transient and not uploaded or persisted', () => {
    const preview = deriveCreativeCompositionPreview({ plan: validPost3Plan() })

    expect(preview.artifact).toMatchObject({
      type: 'svg_string',
      mimeType: 'image/svg+xml',
      persisted: false,
      uploaded: false,
    })
    expect(preview.artifact.svg).toContain('<svg')
    expectValidationPass(preview, 'transient_svg_artifact')
  })

  it('requires future explicit Content Hub attach and never auto-attaches', () => {
    const preview = deriveCreativeCompositionPreview({ plan: validPost3Plan() })

    expect(preview.attachPolicy).toEqual({
      autoAttach: false,
      attachRequiresExplicitUserAction: true,
      attachSurface: 'content_hub',
    })
    expectValidationPass(preview, 'content_hub_explicit_attach_policy')
  })

  it('includes a background image URL without fetching or uploading it', () => {
    const preview = deriveCreativeCompositionPreview({
      plan: validPost3Plan(),
      backgroundImageUrlOverride: 'https://cdn.example.com/override-background.jpg?token=<unsafe>',
    })

    expect(preview.artifact.svg).toContain('https://cdn.example.com/override-background.jpg?token=&lt;unsafe&gt;')
    expect(preview.artifact.uploaded).toBe(false)
    expect(preview.artifact.persisted).toBe(false)
  })

  it('preserves headline and CTA as editable metadata layers', () => {
    const preview = deriveCreativeCompositionPreview({ plan: validPost3Plan() })
    const headline = preview.layers.find(layer => layer.role === 'headline')
    const cta = preview.layers.find(layer => layer.role === 'cta')

    expect(headline).toMatchObject({
      editable: true,
      required: true,
      content: expect.objectContaining({
        text: 'Make team coffee breaks easier',
        renderMode: 'composited_text',
        aiRenderedText: false,
      }),
    })
    expect(cta).toMatchObject({
      editable: true,
      content: expect.objectContaining({
        text: 'Review options',
        renderMode: 'composited_text',
      }),
    })
    expectValidationPass(preview, 'editable_headline_layer')
    expectValidationPass(preview, 'editable_cta_layer_when_present')
  })

  it('uses a brand-name fallback layer when logo is missing', () => {
    const preview = deriveCreativeCompositionPreview({
      plan: validPost3Plan({ logoUrl: null }),
    })
    const brandLayer = preview.layers.find(layer => layer.role === 'logo_or_brand_name')

    expect(brandLayer?.type).toBe('logo_or_brand_name')
    expect(brandLayer?.editable).toBe(true)
    expect(brandLayer?.content.text).toBe('Cairo Bloom Coffee')
    expect(preview.artifact.svg).toContain('Cairo Bloom Coffee')
    expectValidationPass(preview, 'logo_or_brand_name_fallback')
  })

  it('keeps Arabic headline as escaped text layer content', () => {
    const preview = deriveCreativeCompositionPreview({
      plan: validPost3Plan({
        language: 'ar',
        postCaption: 'قهوة صباحية أكثر اتساقًا لفريق المكتب.',
        creativeRequirement: {
          headlineLayer: 'قهوة صباحية أكثر اتساقًا <للفريق>',
          ctaLayer: 'راجع الخيارات',
        },
      }),
      options: { locale: 'ar' },
    })
    const headline = preview.layers.find(layer => layer.role === 'headline')

    expect(headline?.content.language).toBe('ar')
    expect(headline?.content.text).toBe('قهوة صباحية أكثر اتساقًا <للفريق>')
    expect(headline?.content.renderMode).toBe('composited_text')
    expect(headline?.content.aiRenderedText).toBe(false)
    expect(preview.artifact.svg).toContain('قهوة صباحية أكثر اتساقًا &lt;للفريق&gt;')
    expect(preview.artifact.svg).toContain('direction="rtl"')
    expectValidationPass(preview, 'arabic_text_remains_editable_metadata')
  })

  it('escapes unsafe text in the SVG artifact', () => {
    const preview = deriveCreativeCompositionPreview({
      plan: validPost3Plan({
        creativeRequirement: {
          headlineLayer: 'Coffee <script>alert("x")</script> & safer breaks',
          ctaLayer: 'Review "options" & plans',
        },
      }),
    })

    expect(preview.artifact.svg).toContain('Coffee &lt;script&gt;alert("x")&lt;/script&gt; &amp; safer breaks')
    expect(preview.artifact.svg).toContain('Review "options" &amp; plans')
    expect(preview.artifact.svg).not.toContain('<script>')
  })

  it('flags required layers that are outside safe zones', () => {
    const template: CreativeTemplateSpec = getDefaultTemplateForPlatform('LINKEDIN')
    template.layers = template.layers.map(layer => (
      layer.id === 'headline'
        ? {
            ...layer,
            position: { x: 0.01, y: 0.01, anchor: 'top_left' },
            size: { width: 0.2, height: 0.1 },
          }
        : layer
    ))
    const preview = deriveCreativeCompositionPreview({
      plan: validPost3Plan({ creativeTemplate: template }),
      options: { includeLayerOutlines: true },
    })
    const check = preview.validations.find(validation => validation.id === 'required_layers_inside_safe_zones')

    expect(preview.layers.find(layer => layer.id === 'headline')?.safeZoneCompliant).toBe(false)
    expect(check?.passed).toBe(false)
    expect(check?.message).toContain('headline')
    expect(preview.artifact.svg).toContain('stroke="#ef4444"')
  })

  it('does not expose publish, schedule, Autopilot, or paid launch fields', () => {
    const preview = deriveCreativeCompositionPreview({ plan: validPost3Plan() })
    const keys = Object.keys(preview)

    expect(keys).not.toContain('publish')
    expect(keys).not.toContain('schedule')
    expect(keys).not.toContain('autopilot')
    expect(keys).not.toContain('paidLaunch')
    expectValidationPass(preview, 'no_execution_fields')
  })

  it('confirms the helper does not mutate SocialPost media state', () => {
    const preview = deriveCreativeCompositionPreview({ plan: validPost3Plan() })

    expect(preview.safety).toMatchObject({
      doesNotMutateSocialPost: true,
      doesNotPublish: true,
      doesNotSchedule: true,
      doesNotLaunchPaidAds: true,
    })
    expectValidationPass(preview, 'does_not_mutate_social_post')
  })

  it('flags final-ad or execution wording in preview layer labels/content', () => {
    const preview = deriveCreativeCompositionPreview({ plan: validPost3Plan() })
    preview.layers[1].validationMessages.push('Looks like final ad creative ready to launch')

    const validation = validateCreativeCompositionPreview(preview)
      .find(item => item.id === 'no_final_ad_claims')

    expect(validation?.passed).toBe(false)
    expect(validation?.message).toContain('final ad')
  })

  it('works with a Post #3-like LinkedIn landscape fixture', () => {
    const preview = deriveCreativeCompositionPreview({ plan: validPost3Plan() })

    expect(preview.postId).toBe('cmqy4rgbc00041221gdbgqkhe')
    expect(preview.templateId).toBe('linkedin-landscape-insight-v1')
    expect(preview.artifact.svg).toContain('Make team coffee breaks easier')
    expect(preview.layers.map(layer => layer.role)).toEqual(expect.arrayContaining([
      'background',
      'headline',
      'subheading',
      'cta',
      'logo_or_brand_name',
    ]))
    expect(preview.validations.every(validation => validation.passed)).toBe(true)
  })
})
