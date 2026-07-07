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
      includeLayerOutlines: true,
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
