import { describe, expect, it } from 'vitest'

import { buildCreativeStudioPreviewModel } from '../creativeStudioPreview'

const baseInput = {
  post: {
    id: 'post-3',
    postNumber: 3,
    platform: 'LinkedIn',
    caption: 'Make clinic follow-up easier for the front desk without adding another spreadsheet.',
    hook: 'Clinic follow-up gets messy when ownership is unclear.',
    cta: 'Review workflow',
    contentType: 'LinkedIn feed image',
    imageUrl: 'https://cdn.example.com/background.png',
    uploadedMediaId: null,
    mediaSource: 'GENERATE',
    generationStatus: 'DONE',
    status: 'SCHEDULED',
  },
  campaign: {
    campaignName: 'ClinicFlow AI',
    campaignGoal: 'leads',
    campaignType: 'organic',
    language: 'en',
    brandName: 'ClinicFlow AI',
    logoUrl: null,
    colorPalette: ['#0F766E', '#F8FAFC'],
  },
}

describe('buildCreativeStudioPreviewModel', () => {
  it('creates a draft layered studio preview for one post', () => {
    const model = buildCreativeStudioPreviewModel(baseInput)

    expect(model.postId).toBe('post-3')
    expect(model.postNumber).toBe(3)
    expect(model.outputClassification).toBe('draft_layered_studio_preview')
    expect(model.compositionPreview.outputClassification).toBe('draft_composition_preview')
    expect(model.compositionPreview.artifact.type).toBe('svg_string')
    expect(model.compositionPreview.artifact.persisted).toBe(false)
    expect(model.compositionPreview.artifact.uploaded).toBe(false)
  })

  it('keeps headline, CTA, and brand fallback as editable layers', () => {
    const model = buildCreativeStudioPreviewModel(baseInput)
    const roles = model.editableLayers.map(layer => layer.role)

    expect(roles).toEqual(expect.arrayContaining(['headline', 'cta', 'logo_or_brand_name']))
    expect(model.editableLayers.find(layer => layer.role === 'headline')?.text).toBe(
      'Clinic follow-up gets messy when ownership is unclear',
    )
    expect(model.editableLayers.find(layer => layer.role === 'cta')?.text).toBe('Review workflow')
    expect(model.editableLayers.find(layer => layer.role === 'logo_or_brand_name')?.text).toBe('ClinicFlow AI')
  })

  it('shows render as a future explicit-confirmation path, not an available mutation', () => {
    const model = buildCreativeStudioPreviewModel(baseInput)

    expect(model.controlledPath.map(step => step.id)).toEqual(['preview', 'render', 'attach'])
    expect(model.controlledPath.find(step => step.id === 'preview')?.state).toBe('available_now')
    expect(model.controlledPath.find(step => step.id === 'render')?.state).toBe('future_explicit_confirmation')
    expect(model.controlledPath.find(step => step.id === 'attach')?.state).toBe('future_explicit_confirmation')
    expect(model.safety).toMatchObject({
      reviewOnly: true,
      doesNotGenerateImage: true,
      doesNotRenderOrUpload: true,
      doesNotAttachMedia: true,
      doesNotMutateSocialPost: true,
      doesNotPublish: true,
      doesNotSchedule: true,
      attachSurface: 'content_hub',
    })
  })

  it('locks future render when the post has no background yet', () => {
    const model = buildCreativeStudioPreviewModel({
      ...baseInput,
      post: {
        ...baseInput.post,
        imageUrl: null,
        mediaSource: null,
        generationStatus: null,
      },
    })

    expect(model.backgroundStatus).toBe('background_needed_before_render')
    expect(model.controlledPath.find(step => step.id === 'render')?.state).toBe('locked_until_background')
    expect(model.qualitySummary.requiredFailed).toBeGreaterThan(0)
  })

  it('keeps Arabic text as editable composited metadata', () => {
    const model = buildCreativeStudioPreviewModel({
      ...baseInput,
      post: {
        ...baseInput.post,
        caption: 'نظّم متابعة المرضى بدون جداول إضافية.',
        hook: 'متابعة المرضى تصبح أصعب عندما لا تكون المسؤولية واضحة.',
        cta: 'راجع المسار',
      },
      campaign: {
        ...baseInput.campaign,
        language: 'ar',
        brandName: 'ClinicFlow AI',
      },
    })
    const headline = model.compositionPreview.layers.find(layer => layer.role === 'headline')
    const cta = model.compositionPreview.layers.find(layer => layer.role === 'cta')

    expect(headline?.content.language).toBe('ar')
    expect(headline?.content.renderMode).toBe('composited_text')
    expect(headline?.content.aiRenderedText).toBe(false)
    expect(cta?.content.text).toBe('راجع المسار')
    expect(model.compositionPreview.artifact.svg).toContain('direction="rtl"')
  })

  it('does not expose execution fields or final creative claims', () => {
    const model = buildCreativeStudioPreviewModel(baseInput)
    const serialized = JSON.stringify(model)

    expect(Object.keys(model)).not.toContain('publish')
    expect(Object.keys(model)).not.toContain('schedule')
    expect(Object.keys(model)).not.toContain('paidLaunch')
    expect(serialized).not.toContain('final_ad_creative')
    expect(serialized).not.toContain('"autoAttach":true')
    expect(model.compositionPreview.attachPolicy.autoAttach).toBe(false)
  })
})
