import {
  deriveContentHubMediaState,
  type ContentHubMediaStateInput,
} from './contentHubMediaState'

export type CreativeRequirementStatus =
  | 'media_needed'
  | 'requirement_ready'
  | 'generation_ready'
  | 'media_preview_needs_confirmation'
  | 'attached_to_post'
  | 'approved_for_publish'

export type RequiredAssetType =
  | 'post_image'
  | 'uploaded_asset'
  | 'generated_background'
  | 'template_composite_later'
  | 'none'

export type CreativeSourcePreference = 'generated' | 'uploaded' | 'either'

export type CreativeRequirementInput = ContentHubMediaStateInput & {
  postId: string
  platform?: string | null
  caption?: string | null
  status?: string | null
  isVideoPost?: boolean | null
  campaignGoal?: string | null
  campaignName?: string | null
  campaignType?: string | null
  campaignStrategy?: unknown
  brandName?: string | null
  language?: string | null
}

export type CreativeRequirement = {
  postId: string
  platform: string
  format: string
  aspectRatio: string
  objective: string
  funnelStage: string
  contentAngle: string
  visualConcept: string
  requiredAssetType: RequiredAssetType
  sourcePreference: CreativeSourcePreference
  textOverlayNeeded: boolean
  headlineLayer: string | null
  ctaLayer: string | null
  logoNeeded: boolean
  productImageNeeded: boolean
  proofConstraints: string[]
  status: CreativeRequirementStatus
  statusLabel: string
  statusLabelAr: string
  explanation: string
  explanationAr: string
  countsAsMediaPresent: boolean
}

export type CreativeRequirementsSummary = {
  total: number
  mediaNeeded: number
  readinessPending: number
  attachedToPost: number
}

const PLATFORM_FORMATS: Array<{
  match: RegExp
  format: string
  aspectRatio: string
}> = [
  { match: /TIKTOK|REEL|SHORT|YOUTUBE(?:_SHORTS)?|STORY/i, format: 'Vertical short-form image/video cover', aspectRatio: '9:16' },
  { match: /PINTEREST|\bPIN\b/i, format: 'Pinterest standard image Pin', aspectRatio: '2:3' },
  { match: /LINKEDIN/i, format: 'LinkedIn feed image', aspectRatio: '1.91:1' },
  { match: /FACEBOOK|META/i, format: 'Meta feed image', aspectRatio: '4:5' },
  { match: /INSTAGRAM/i, format: 'Instagram feed image', aspectRatio: '4:5' },
  { match: /X|TWITTER/i, format: 'Social feed image', aspectRatio: '1.91:1' },
]

function normalizePlatform(platform?: string | null): string {
  return (platform || 'GENERAL').trim().toUpperCase() || 'GENERAL'
}

export function deriveCreativePlatformFormat(platform?: string | null): { format: string; aspectRatio: string } {
  const normalized = normalizePlatform(platform)
  const found = PLATFORM_FORMATS.find(item => item.match.test(normalized))
  return found ?? { format: 'Square feed image', aspectRatio: '1:1' }
}

export function deriveCreativePlatformVideoFormat(platform?: string | null): { format: string; aspectRatio: string } {
  const normalized = normalizePlatform(platform)
  if (/TIKTOK|REEL|SHORT|STORY/i.test(normalized)) {
    return { format: 'Vertical short-form video', aspectRatio: '9:16' }
  }
  if (/INSTAGRAM|FACEBOOK|META/i.test(normalized)) {
    return { format: 'Vertical social video', aspectRatio: '9:16' }
  }
  if (/LINKEDIN/i.test(normalized)) {
    return { format: 'LinkedIn feed video', aspectRatio: '16:9' }
  }
  if (/YOUTUBE/i.test(normalized)) {
    return { format: 'YouTube video', aspectRatio: '16:9' }
  }
  if (/PINTEREST|\bPIN\b/i.test(normalized)) {
    return { format: 'Pinterest video Pin', aspectRatio: '9:16' }
  }
  return { format: 'Social feed video', aspectRatio: '16:9' }
}

function deriveSourcePreference(input: CreativeRequirementInput): CreativeSourcePreference {
  const mediaSource = (input.mediaSource || '').toUpperCase()
  if (input.uploadedMediaId || mediaSource.includes('UPLOAD')) return 'uploaded'
  if (mediaSource.includes('GENERATE')) return 'generated'
  return 'either'
}

function deriveFunnelStage(status?: string | null): string {
  const normalized = (status || '').toUpperCase()
  if (normalized === 'PUBLISHED') return 'Post-publish review'
  if (normalized === 'SCHEDULED') return 'Scheduled execution'
  if (normalized === 'APPROVED') return 'Pre-schedule review'
  return 'Draft review'
}

function sentenceFromCaption(caption?: string | null): string {
  const clean = (caption || '').replace(/\s+/g, ' ').trim()
  if (!clean) return 'Post message and platform context'
  const firstSentence = clean.split(/[.!؟\n]/)[0]?.trim() || clean
  return firstSentence.length > 92 ? `${firstSentence.slice(0, 89).trim()}...` : firstSentence
}

function deriveStatus(input: CreativeRequirementInput): Pick<
  CreativeRequirement,
  'status' | 'statusLabel' | 'statusLabelAr' | 'explanation' | 'explanationAr' | 'countsAsMediaPresent'
> {
  if (input.isVideoPost) {
    return {
      status: 'requirement_ready',
      statusLabel: 'Requirement ready',
      statusLabelAr: 'المتطلبات جاهزة',
      explanation: 'This video slot has a planning requirement; final media remains a separate review step.',
      explanationAr: 'خانة الفيديو لديها متطلبات تخطيط؛ وتبقى الوسائط النهائية خطوة مراجعة منفصلة.',
      countsAsMediaPresent: false,
    }
  }

  const mediaState = deriveContentHubMediaState(input)
  if (mediaState.key === 'no_media') {
    return {
      status: 'media_needed',
      statusLabel: 'Needs post media',
      statusLabelAr: 'يحتاج وسائط للمنشور',
      explanation: 'This post needs a media decision before it can be treated as visually reviewed.',
      explanationAr: 'يحتاج هذا المنشور إلى قرار وسائط قبل اعتباره مُراجعاً بصرياً.',
      countsAsMediaPresent: false,
    }
  }

  if (mediaState.key === 'ambiguous_preview_pending') {
    return {
      status: 'media_preview_needs_confirmation',
      statusLabel: 'Media preview needs confirmation',
      statusLabelAr: 'معاينة الوسائط تحتاج تأكيداً',
      explanation: 'A preview exists, but readiness is pending until generation or attachment status is confirmed.',
      explanationAr: 'توجد معاينة، لكن الجاهزية معلقة حتى يتم تأكيد حالة التوليد أو الربط.',
      countsAsMediaPresent: true,
    }
  }

  return {
    status: 'attached_to_post',
    statusLabel: 'Media attached to post',
    statusLabelAr: 'وسائط مرتبطة بالمنشور',
    explanation: 'Post media is linked for review in Content Hub; publish and paid use remain separate steps.',
    explanationAr: 'وسائط المنشور مرتبطة للمراجعة في Content Hub؛ النشر والاستخدام المدفوع خطوات منفصلة.',
    countsAsMediaPresent: true,
  }
}

export function derivePostCreativeRequirement(input: CreativeRequirementInput): CreativeRequirement {
  const platform = normalizePlatform(input.platform)
  const isVideo = Boolean(input.isVideoPost)
  const { format, aspectRatio } = isVideo
    ? deriveCreativePlatformVideoFormat(platform)
    : deriveCreativePlatformFormat(platform)
  const sourcePreference = deriveSourcePreference(input)
  const status = deriveStatus(input)
  const contentAngle = sentenceFromCaption(input.caption)
  const brand = (input.brandName || input.campaignName || 'the brand').trim()
  const requiredAssetType: RequiredAssetType = isVideo
    ? 'template_composite_later'
    : input.uploadedMediaId
      ? 'uploaded_asset'
      : sourcePreference === 'generated'
        ? 'generated_background'
        : 'post_image'

  return {
    postId: input.postId,
    platform,
    format,
    aspectRatio,
    objective: input.campaignGoal?.trim() || 'Support the campaign message',
    funnelStage: deriveFunnelStage(input.status),
    contentAngle,
    visualConcept: `${brand} creative direction for ${platform} based on this post copy.`,
    requiredAssetType,
    sourcePreference,
    textOverlayNeeded: false,
    headlineLayer: null,
    ctaLayer: null,
    logoNeeded: true,
    productImageNeeded: sourcePreference !== 'generated',
    proofConstraints: [
      'Creative requirements guide media decisions only; they do not generate or publish anything.',
      'Text, logo, and CTA layers are planned for later Creative Studio/template work.',
      'AI image text is not treated as reviewed creative, especially Arabic text.',
    ],
    ...status,
  }
}

export function summarizeCreativeRequirements(inputs: CreativeRequirementInput[]): CreativeRequirementsSummary {
  return inputs.reduce<CreativeRequirementsSummary>((summary, input) => {
    const requirement = derivePostCreativeRequirement(input)
    summary.total += 1
    if (requirement.status === 'media_needed') summary.mediaNeeded += 1
    if (requirement.status === 'media_preview_needs_confirmation') summary.readinessPending += 1
    if (requirement.status === 'attached_to_post') summary.attachedToPost += 1
    return summary
  }, {
    total: 0,
    mediaNeeded: 0,
    readinessPending: 0,
    attachedToPost: 0,
  })
}
