import { describe, expect, it } from 'vitest'

import {
  applyCreativeStudioDraftControls,
  buildCreativeStudioPreviewModel,
  defaultCreativeStudioDraftControls,
} from '../creativeStudioPreview'

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

  it('summarizes the creative decision before any execution step', () => {
    const model = buildCreativeStudioPreviewModel(baseInput)

    expect(model.decisionBrief.title).toBe('Creative decision for this post')
    expect(model.decisionBrief.creativeObjective).toContain('leads')
    expect(model.decisionBrief.audienceMoment).toContain('Make clinic follow-up easier')
    expect(model.decisionBrief.platformFit).toContain('LinkedIn')
    expect(model.decisionBrief.readiness.status).toBe('review_ready')
    expect(model.decisionBrief.readiness.score).toBeGreaterThanOrEqual(85)
    expect(model.decisionBrief.nextBestAction).toContain('Content Hub')
    expect(model.decisionBrief.messageHierarchy.map(item => item.role)).toEqual([
      'headline',
      'cta',
      'brand',
      'background',
    ])
    expect(model.decisionBrief.qualitySignals.map(signal => signal.id)).toEqual(expect.arrayContaining([
      'message_clarity',
      'brand_anchor',
      'background_source',
      'safe_zones',
      'execution_boundary',
    ]))
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
    expect(model.decisionBrief.readiness.status).toBe('needs_background')
    expect(model.decisionBrief.readiness.blockers).toContain('Background decision is not complete yet.')
    expect(model.decisionBrief.nextBestAction).toContain('background decision')
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
    expect(model.compositionPreview.artifact.svg).toContain('unicode-bidi="plaintext"')
    expect(model.controlledPath.map(step => step.label)).toEqual([
      'معاينة مسودة الطبقات',
      'تركيب أصل مراجعة لاحقًا',
      'الربط النهائي من Content Hub',
    ])
    expect(JSON.stringify(model.controlledPath)).not.toContain('Draft layered preview')
    expect(JSON.stringify(model.controlledPath)).not.toContain('Attach from Content Hub')
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
    expect(model.compositionPreview.artifact.svg).not.toContain('stroke-dasharray')
  })

  it('derives safe local draft defaults from editable layers', () => {
    const model = buildCreativeStudioPreviewModel(baseInput)
    const controls = defaultCreativeStudioDraftControls(model)

    expect(controls.headlineText).toBe('Clinic follow-up gets messy when ownership is unclear')
    expect(controls.ctaText).toBe('Review workflow')
    expect(controls.brandText).toBe('ClinicFlow AI')
    expect(controls.accentColor).toBe('#334155')
    expect(controls.layout).toBe('balanced')
  })

  it('applies local editable draft controls without mutating the original model', () => {
    const model = buildCreativeStudioPreviewModel(baseInput)
    const edited = applyCreativeStudioDraftControls(model, {
      headlineText: 'Make follow-up work feel calm',
      ctaText: 'Audit the workflow',
      brandText: 'ClinicFlow Ops',
      accentColor: '#7C3AED',
      layout: 'cta_focus',
    })

    expect(edited.postId).toBe(model.postId)
    expect(edited.outputClassification).toBe('draft_layered_studio_preview')
    expect(edited.compositionPreview.artifact.persisted).toBe(false)
    expect(edited.compositionPreview.artifact.uploaded).toBe(false)
    expect(edited.editableLayers.find(layer => layer.role === 'headline')?.text).toBe('Make follow-up work feel calm')
    expect(edited.editableLayers.find(layer => layer.role === 'cta')?.text).toBe('Audit the workflow')
    expect(edited.editableLayers.find(layer => layer.role === 'logo_or_brand_name')?.text).toBe('ClinicFlow Ops')
    expect(edited.decisionBrief.messageHierarchy.find(item => item.role === 'headline')?.value).toBe(
      'Make follow-up work feel calm',
    )
    expect(edited.decisionBrief.messageHierarchy.find(item => item.role === 'cta')?.value).toBe(
      'Audit the workflow',
    )
    expect(edited.decisionBrief.messageHierarchy.find(item => item.role === 'brand')?.value).toBe(
      'ClinicFlow Ops',
    )
    expect(edited.compositionPreview.artifact.svg).toContain('Make follow-up work feel calm')
    expect(edited.compositionPreview.artifact.svg).toContain('Audit the workflow')
    expect(edited.compositionPreview.artifact.svg).toContain('ClinicFlow')
    expect(edited.compositionPreview.artifact.svg).toContain('Ops')
    expect(edited.compositionPreview.artifact.svg).toContain('#7C3AED')
    expect(model.editableLayers.find(layer => layer.role === 'headline')?.text).toBe(
      'Clinic follow-up gets messy when ownership is unclear',
    )
  })

  it('keeps local draft controls away from save, render, attach, and publish behavior', () => {
    const edited = applyCreativeStudioDraftControls(buildCreativeStudioPreviewModel(baseInput), {
      headlineText: 'A review-only local edit',
      layout: 'editorial',
    })
    const serialized = JSON.stringify(edited)

    expect(edited.safety).toMatchObject({
      reviewOnly: true,
      doesNotGenerateImage: true,
      doesNotRenderOrUpload: true,
      doesNotAttachMedia: true,
      doesNotMutateSocialPost: true,
      doesNotPublish: true,
      doesNotSchedule: true,
      attachSurface: 'content_hub',
    })
    expect(edited.compositionPreview.attachPolicy.autoAttach).toBe(false)
    expect(serialized).not.toContain('saveAction')
    expect(serialized).not.toContain('renderAction')
    expect(serialized).not.toContain('uploadAction')
    expect(serialized).not.toContain('attachAction')
    expect(serialized).not.toContain('publishAction')
    expect(serialized).not.toContain('ready to launch')
    expect(serialized).not.toContain('platform-ready')
  })
})
