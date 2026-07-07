import {
  deriveCreativeCompositionPlan,
  type CompositionInput,
  type CreativeCompositionPlan,
} from './creativeComposition'
import {
  deriveCreativeCompositionPreview,
  type CreativeCompositionPreview,
} from './creativeCompositionPreview'
import {
  derivePostCreativeRequirement,
  type CreativeRequirement,
} from './creativeRequirements'

export type CreativeStudioBackgroundStatus =
  | 'background_available_for_preview'
  | 'background_needed_before_render'

export type CreativeStudioPathStepState =
  | 'available_now'
  | 'locked_until_background'
  | 'future_explicit_confirmation'

export type CreativeStudioPostInput = {
  id: string
  postNumber: number
  platform?: string | null
  caption?: string | null
  hook?: string | null
  cta?: string | null
  contentType?: string | null
  imageUrl?: string | null
  uploadedMediaId?: string | null
  mediaSource?: string | null
  generationStatus?: string | null
  status?: string | null
}

export type CreativeStudioCampaignInput = {
  campaignName: string
  campaignGoal?: string | null
  campaignType?: string | null
  language?: string | null
  brandName?: string | null
  logoUrl?: string | null
  colorPalette?: string[] | string | null
}

export type CreativeStudioPreviewInput = {
  post: CreativeStudioPostInput
  campaign: CreativeStudioCampaignInput
}

export type CreativeStudioPathStep = {
  id: 'preview' | 'render' | 'attach'
  label: string
  state: CreativeStudioPathStepState
  description: string
}

export type CreativeStudioDraftLayout = 'balanced' | 'editorial' | 'cta_focus'

export type CreativeStudioDraftControls = {
  headlineText?: string | null
  ctaText?: string | null
  brandText?: string | null
  accentColor?: string | null
  layout?: CreativeStudioDraftLayout | null
}

export type CreativeStudioPreviewModel = {
  postId: string
  postNumber: number
  platform: string
  format: string
  outputClassification: 'draft_layered_studio_preview'
  backgroundStatus: CreativeStudioBackgroundStatus
  backgroundLabel: string
  sourcePostText: string
  requirement: CreativeRequirement
  compositionPlan: CreativeCompositionPlan
  compositionPreview: CreativeCompositionPreview
  editableLayers: Array<{
    id: string
    role: string
    text: string | null
    safeZoneCompliant: boolean
  }>
  qualitySummary: {
    requiredPassed: number
    requiredFailed: number
    recommendedFailed: number
  }
  controlledPath: CreativeStudioPathStep[]
  safety: {
    reviewOnly: true
    doesNotGenerateImage: true
    doesNotRenderOrUpload: true
    doesNotAttachMedia: true
    doesNotMutateSocialPost: true
    doesNotPublish: true
    doesNotSchedule: true
    attachSurface: 'content_hub'
  }
}

const DRAFT_LAYOUT_LABELS: Record<CreativeStudioDraftLayout, string> = {
  balanced: 'Balanced',
  editorial: 'Editorial',
  cta_focus: 'CTA focus',
}

function compact(value?: string | null): string {
  return (value || '').replace(/\s+/g, ' ').trim()
}

function firstMeaningfulText(post: CreativeStudioPostInput): string {
  return compact(post.hook) || compact(post.caption) || `Post #${post.postNumber}`
}

function deriveHeadline(post: CreativeStudioPostInput): string | null {
  const source = firstMeaningfulText(post)
  const firstSentence = source.split(/[.!؟?\n]/)[0]?.trim() || source
  return firstSentence.length > 72 ? `${firstSentence.slice(0, 69).trim()}...` : firstSentence
}

function deriveCta(post: CreativeStudioPostInput, language?: string | null): string {
  const explicit = compact(post.cta)
  if (explicit) return explicit.length > 30 ? `${explicit.slice(0, 27).trim()}...` : explicit
  return (language || '').toLowerCase().startsWith('ar') || /[\u0600-\u06FF]/.test(firstMeaningfulText(post))
    ? 'راجع الخطوة التالية'
    : 'Review next step'
}

function isVideoPost(post: CreativeStudioPostInput): boolean {
  return /video|reel|short|tiktok|youtube|story|فيديو|ريل/i.test(
    [post.contentType, post.platform, post.caption].map(value => value || '').join(' '),
  )
}

function backgroundLabel(status: CreativeStudioBackgroundStatus): string {
  if (status === 'background_available_for_preview') {
    return 'Background available for draft layer preview.'
  }
  return 'Background still needed before any future render/upload step.'
}

function buildRequirement(input: CreativeStudioPreviewInput): CreativeRequirement {
  const base = derivePostCreativeRequirement({
    postId: input.post.id,
    platform: input.post.platform,
    caption: input.post.caption || input.post.hook,
    status: input.post.status,
    isVideoPost: isVideoPost(input.post),
    campaignGoal: input.campaign.campaignGoal,
    campaignName: input.campaign.campaignName,
    campaignType: input.campaign.campaignType,
    campaignStrategy: null,
    brandName: input.campaign.brandName,
    language: input.campaign.language,
    imageUrl: input.post.imageUrl,
    uploadedMediaId: input.post.uploadedMediaId,
    mediaSource: input.post.mediaSource,
    generationStatus: input.post.generationStatus,
  })

  return {
    ...base,
    headlineLayer: deriveHeadline(input.post),
    ctaLayer: deriveCta(input.post, input.campaign.language),
    textOverlayNeeded: true,
    proofConstraints: [
      ...base.proofConstraints,
      'Creative Studio preview is a draft layer composition only, not final ad creative.',
      'Rendering and Content Hub attachment require separate future confirmation.',
    ],
  }
}

function summarizeQuality(plan: CreativeCompositionPlan, preview: CreativeCompositionPreview): CreativeStudioPreviewModel['qualitySummary'] {
  const checks = [
    ...plan.qualityChecks,
    ...preview.validations,
  ]
  return checks.reduce(
    (summary, check) => {
      if (check.severity === 'required' && check.passed) summary.requiredPassed += 1
      if (check.severity === 'required' && !check.passed) summary.requiredFailed += 1
      if (check.severity === 'recommended' && !check.passed) summary.recommendedFailed += 1
      return summary
    },
    { requiredPassed: 0, requiredFailed: 0, recommendedFailed: 0 },
  )
}

function buildControlledPath(hasBackground: boolean): CreativeStudioPathStep[] {
  return [
    {
      id: 'preview',
      label: 'Draft layered preview',
      state: 'available_now',
      description: 'Review the current background slot, editable headline, CTA, brand layer, and safe zones.',
    },
    {
      id: 'render',
      label: 'Render composed review asset',
      state: hasBackground ? 'future_explicit_confirmation' : 'locked_until_background',
      description: hasBackground
        ? 'Future step only: rendering must require explicit confirmation and must not upload automatically.'
        : 'Locked until a background is generated or uploaded and selected for this post.',
    },
    {
      id: 'attach',
      label: 'Attach from Content Hub',
      state: 'future_explicit_confirmation',
      description: 'Final SocialPost media attachment remains a separate Content Hub decision.',
    },
  ]
}

function clampDraftText(value: string, maxLength: number): string {
  const clean = compact(value)
  if (clean.length <= maxLength) return clean
  const slice = clean.slice(0, maxLength)
  const lastSpace = slice.lastIndexOf(' ')
  return `${(lastSpace > maxLength * 0.55 ? slice.slice(0, lastSpace) : slice).trim()}...`
}

function safeHexColor(value?: string | null): string | null {
  const clean = compact(value)
  return /^#[0-9a-fA-F]{6}$/.test(clean) ? clean.toUpperCase() : null
}

function normalizeDraftLayout(layout?: CreativeStudioDraftLayout | null): CreativeStudioDraftLayout {
  if (layout === 'editorial' || layout === 'cta_focus') return layout
  return 'balanced'
}

function layerLayoutAdjustment(
  role: string,
  layout: CreativeStudioDraftLayout,
): Partial<CreativeCompositionPlan['layers'][number]> {
  if (layout === 'balanced') return {}

  if (layout === 'editorial') {
    if (role === 'headline') return { size: { width: 0.74, height: 0.14 } }
    if (role === 'cta') return { size: { width: 0.38, height: 0.07 } }
  }

  if (layout === 'cta_focus') {
    if (role === 'headline') return { size: { width: 0.64, height: 0.13 } }
    if (role === 'cta') return { size: { width: 0.54, height: 0.1 } }
  }

  return {}
}

function applyDraftControlsToPlan(
  plan: CreativeCompositionPlan,
  controls: CreativeStudioDraftControls,
): CreativeCompositionPlan {
  const layout = normalizeDraftLayout(controls.layout)
  const headlineText = controls.headlineText == null ? null : clampDraftText(controls.headlineText, 86)
  const ctaText = controls.ctaText == null ? null : clampDraftText(controls.ctaText, 34)
  const brandText = controls.brandText == null ? null : clampDraftText(controls.brandText, 42)
  const accentColor = safeHexColor(controls.accentColor)

  const layers = plan.layers.map(layer => {
    const layoutAdjustment = layerLayoutAdjustment(layer.role, layout)
    const nextLayer = {
      ...layer,
      ...layoutAdjustment,
      content: { ...layer.content },
      position: { ...layer.position },
      size: { ...layer.size, ...layoutAdjustment.size },
      validationMessages: [...layer.validationMessages],
    }

    if (nextLayer.role === 'headline' && headlineText) {
      nextLayer.content.text = headlineText
      nextLayer.content.renderMode = 'composited_text'
      nextLayer.content.aiRenderedText = false
    }

    if (nextLayer.role === 'cta' && ctaText) {
      nextLayer.content.text = ctaText
      nextLayer.content.renderMode = 'composited_text'
      nextLayer.content.aiRenderedText = false
    }

    if (nextLayer.role === 'logo_or_brand_name' && brandText) {
      nextLayer.content.text = brandText
      delete nextLayer.content.imageUrl
      nextLayer.content.renderMode = 'composited_text'
      nextLayer.content.aiRenderedText = false
    }

    if (nextLayer.role === 'accent' && accentColor) {
      nextLayer.content.color = accentColor
    }

    return nextLayer
  })

  if (accentColor && !layers.some(layer => layer.role === 'accent')) {
    layers.push({
      id: 'local_draft_accent',
      role: 'accent',
      type: 'accent',
      editable: true,
      required: false,
      content: {
        color: accentColor,
        renderMode: 'shape',
      },
      contentSource: 'brand_brain',
      position: { x: 0, y: 0.985, anchor: 'bottom_left' },
      size: { width: 1, height: 0.015 },
      safeZoneCompliant: true,
      validationMessages: ['Local draft accent only; not saved or attached.'],
    })
  }

  return {
    ...plan,
    planId: layout === 'balanced' ? plan.planId : `${plan.planId}_${layout}`,
    layers,
  }
}

export function buildCreativeStudioPreviewModel(input: CreativeStudioPreviewInput): CreativeStudioPreviewModel {
  const requirement = buildRequirement(input)
  const hasBackground = Boolean(input.post.imageUrl)
  const backgroundStatus: CreativeStudioBackgroundStatus = hasBackground
    ? 'background_available_for_preview'
    : 'background_needed_before_render'
  const compositionInput: CompositionInput = {
    postId: input.post.id,
    postCaption: input.post.caption || input.post.hook,
    brandName: input.campaign.brandName || input.campaign.campaignName,
    logoUrl: input.campaign.logoUrl,
    colorPalette: input.campaign.colorPalette,
    language: input.campaign.language,
    creativeRequirement: requirement,
    backgroundImageUrl: input.post.imageUrl || null,
    uploadedMediaId: input.post.uploadedMediaId || null,
    generatedVisualId: input.post.mediaSource?.toUpperCase().includes('GENERATE')
      ? input.post.id
      : null,
  }
  const compositionPlan = deriveCreativeCompositionPlan(compositionInput)
  const compositionPreview = deriveCreativeCompositionPreview({
    plan: compositionPlan,
    options: {
      includeLayerOutlines: false,
      locale: (input.campaign.language || '').toLowerCase().startsWith('ar') ? 'ar' : 'en',
      previewMode: 'review',
    },
  })
  const editableLayers = compositionPreview.layers
    .filter(layer => layer.editable)
    .map(layer => ({
      id: layer.id,
      role: layer.role,
      text: layer.content.text || null,
      safeZoneCompliant: layer.safeZoneCompliant,
    }))

  return {
    postId: input.post.id,
    postNumber: input.post.postNumber,
    platform: requirement.platform,
    format: requirement.format,
    outputClassification: 'draft_layered_studio_preview',
    backgroundStatus,
    backgroundLabel: backgroundLabel(backgroundStatus),
    sourcePostText: firstMeaningfulText(input.post),
    requirement,
    compositionPlan,
    compositionPreview,
    editableLayers,
    qualitySummary: summarizeQuality(compositionPlan, compositionPreview),
    controlledPath: buildControlledPath(hasBackground),
    safety: {
      reviewOnly: true,
      doesNotGenerateImage: true,
      doesNotRenderOrUpload: true,
      doesNotAttachMedia: true,
      doesNotMutateSocialPost: true,
      doesNotPublish: true,
      doesNotSchedule: true,
      attachSurface: 'content_hub',
    },
  }
}

export function defaultCreativeStudioDraftControls(
  model: CreativeStudioPreviewModel,
): Required<CreativeStudioDraftControls> {
  const layerText = (role: string) => model.editableLayers.find(layer => layer.role === role)?.text || ''
  const accentLayer = model.compositionPlan.layers.find(layer => layer.role === 'accent')

  return {
    headlineText: layerText('headline'),
    ctaText: layerText('cta'),
    brandText: layerText('logo_or_brand_name'),
    accentColor: safeHexColor(accentLayer?.content.color) || '#334155',
    layout: 'balanced',
  }
}

export function applyCreativeStudioDraftControls(
  model: CreativeStudioPreviewModel,
  controls: CreativeStudioDraftControls,
): CreativeStudioPreviewModel {
  const normalizedControls = {
    ...defaultCreativeStudioDraftControls(model),
    ...controls,
    layout: normalizeDraftLayout(controls.layout),
  }
  const compositionPlan = applyDraftControlsToPlan(model.compositionPlan, normalizedControls)
  const compositionPreview = deriveCreativeCompositionPreview({
    plan: compositionPlan,
    options: {
      includeLayerOutlines: false,
      locale: model.compositionPreview.layers.some(layer => layer.content.language === 'ar') ? 'ar' : 'en',
      previewMode: 'review',
    },
  })
  const editableLayers = compositionPreview.layers
    .filter(layer => layer.editable)
    .map(layer => ({
      id: layer.id,
      role: layer.role,
      text: layer.content.text || null,
      safeZoneCompliant: layer.safeZoneCompliant,
    }))
  const controlledPath = model.controlledPath.map(step => (
    step.id === 'preview'
      ? {
          ...step,
          label: `${step.label} · ${DRAFT_LAYOUT_LABELS[normalizedControls.layout]}`,
          description: `${step.description} Draft edits are local to this browser session and are not saved.`,
        }
      : step
  ))

  return {
    ...model,
    compositionPlan,
    compositionPreview,
    editableLayers,
    qualitySummary: summarizeQuality(compositionPlan, compositionPreview),
    controlledPath,
  }
}
