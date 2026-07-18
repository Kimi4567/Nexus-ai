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
  interfaceLocale?: string | null
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

export type CreativeStudioDecisionStatus =
  | 'review_ready'
  | 'needs_background'
  | 'needs_brand_asset'
  | 'needs_message'

export type CreativeStudioDecisionBrief = {
  title: string
  creativeObjective: string
  audienceMoment: string
  platformFit: string
  messageHierarchy: Array<{
    role: 'headline' | 'cta' | 'brand' | 'background'
    label: string
    value: string
  }>
  readiness: {
    status: CreativeStudioDecisionStatus
    label: string
    score: number
    blockers: string[]
  }
  qualitySignals: Array<{
    id: string
    label: string
    status: 'pass' | 'review'
    detail: string
  }>
  nextBestAction: string
}

export type CreativeStudioPreviewModel = {
  postId: string
  postNumber: number
  platform: string
  format: string
  outputClassification: 'draft_layered_studio_preview'
  interfaceLocale: 'ar' | 'en'
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
  decisionBrief: CreativeStudioDecisionBrief
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

const DRAFT_LAYOUT_LABELS_AR: Record<CreativeStudioDraftLayout, string> = {
  balanced: 'متوازن',
  editorial: 'تحريري',
  cta_focus: 'تركيز CTA',
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
    ? 'الدعوة للإجراء غير محددة'
    : 'CTA not defined'
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

function buildControlledPath(hasBackground: boolean, isArabic = false): CreativeStudioPathStep[] {
  return [
    {
      id: 'preview',
      label: isArabic ? 'معاينة مسودة الطبقات' : 'Draft layered preview',
      state: 'available_now',
      description: isArabic
        ? 'راجع خانة الخلفية الحالية، العنوان القابل للتعديل، CTA، طبقة البراند، ومناطق الأمان.'
        : 'Review the current background slot, editable headline, CTA, brand layer, and safe zones.',
    },
    {
      id: 'render',
      label: isArabic ? 'تركيب أصل مراجعة لاحقًا' : 'Render composed review asset',
      state: hasBackground ? 'future_explicit_confirmation' : 'locked_until_background',
      description: hasBackground
        ? (isArabic
            ? 'خطوة مستقبلية فقط: أي تركيب يجب أن يتطلب تأكيدًا صريحًا ولا يرفع الأصل تلقائيًا.'
            : 'Future step only: rendering must require explicit confirmation and must not upload automatically.')
        : (isArabic
            ? 'مقفول حتى يتم توليد أو رفع خلفية واختيارها لهذا المنشور.'
            : 'Locked until a background is generated or uploaded and selected for this post.'),
    },
    {
      id: 'attach',
      label: isArabic ? 'الربط النهائي من Content Hub' : 'Attach from Content Hub',
      state: 'future_explicit_confirmation',
      description: isArabic
        ? 'ربط وسائط SocialPost النهائي يظل قرارًا منفصلًا من Content Hub.'
        : 'Final SocialPost media attachment remains a separate Content Hub decision.',
    },
  ]
}

function isArabicText(value?: string | null): boolean {
  return /[\u0600-\u06FF]/.test(value || '')
}

function layerText(
  layers: CreativeStudioPreviewModel['editableLayers'],
  role: string,
): string {
  return compact(layers.find(layer => layer.role === role)?.text) || ''
}

function platformFitCopy(platform: string, format: string, isArabic: boolean): string {
  const normalized = platform.toUpperCase()
  if (/LINKEDIN/.test(normalized)) {
    return isArabic
      ? `تنسيق ${format} مناسب لرسالة LinkedIn عندما يكون العنوان واضحًا، والبراند حاضرًا، والـ CTA عمليًا بدون ازدحام بصري.`
      : `${format} fits LinkedIn when the headline is clear, the brand anchor is visible, and the CTA stays practical instead of visually noisy.`
  }

  if (/INSTAGRAM|META|FACEBOOK/.test(normalized)) {
    return isArabic
      ? `تنسيق ${format} مناسب لمنشورات Meta عندما تكون الخلفية جذابة، والرسالة قصيرة، والـ CTA قابل للقراءة بسرعة.`
      : `${format} fits Meta-style feeds when the background is distinctive, the message is short, and the CTA can be read quickly.`
  }

  if (/TIKTOK|YOUTUBE|SHORT|REEL|STORY/.test(normalized)) {
    return isArabic
      ? `تنسيق ${format} يحتاج إيقاعًا بصريًا سريعًا. هذه المعاينة تخطط الغلاف/الإطار فقط ولا تستبدل مسار فيديو كامل.`
      : `${format} needs fast visual rhythm. This preview plans the cover/frame only and does not replace a full video workflow.`
  }

  return isArabic
    ? `تنسيق ${format} صالح كمراجعة أولية عندما تكون الطبقات واضحة والخلفية لا تنافس الرسالة.`
    : `${format} is useful for first review when the layers are clear and the background does not compete with the message.`
}

function buildDecisionBrief(params: {
  requirement: CreativeRequirement
  backgroundStatus: CreativeStudioBackgroundStatus
  editableLayers: CreativeStudioPreviewModel['editableLayers']
  sourcePostText: string
  language?: string | null
}): CreativeStudioDecisionBrief {
  const isArabic = (params.language || '').toLowerCase().startsWith('ar')
    || isArabicText(params.sourcePostText)
  const headline = layerText(params.editableLayers, 'headline')
  const rawCta = layerText(params.editableLayers, 'cta')
  const cta = /^(CTA not defined|الدعوة للإجراء غير محددة)$/i.test(rawCta) ? '' : rawCta
  const brand = layerText(params.editableLayers, 'logo_or_brand_name')
  const hasBackground = params.backgroundStatus === 'background_available_for_preview'
  const safeZonesPass = params.editableLayers.every(layer => layer.safeZoneCompliant)

  const blockers: string[] = []
  if (!hasBackground) {
    blockers.push(isArabic
      ? 'قرار الخلفية غير مكتمل بعد.'
      : 'Background decision is not complete yet.')
  }
  if (!brand) {
    blockers.push(isArabic
      ? 'طبقة البراند تحتاج شعارًا أو اسمًا واضحًا.'
      : 'Brand layer needs a logo or clear brand label.')
  }
  if (!headline) {
    blockers.push(isArabic
      ? 'طبقة العنوان تحتاج رسالة واضحة.'
      : 'Headline layer needs a clear message.')
  }
  if (!cta) {
    blockers.push(isArabic
      ? 'الـ CTA غير محدد في المنشور المعتمد.'
      : 'The approved post does not define a CTA.')
  }

  const status: CreativeStudioDecisionStatus = !hasBackground
    ? 'needs_background'
    : !brand
      ? 'needs_brand_asset'
      : !headline || !cta
        ? 'needs_message'
        : 'review_ready'
  const score = Math.min(95,
    45
    + (hasBackground ? 24 : 0)
    + (headline ? 12 : 0)
    + (cta ? 7 : 0)
    + (brand ? 7 : 0)
    + (safeZonesPass ? 5 : 0),
  )

  return {
    title: isArabic ? 'قرار التصميم لهذا المنشور' : 'Creative decision for this post',
    creativeObjective: isArabic
      ? `حوّل هدف الحملة (${params.requirement.objective}) إلى أصل بصري قابل للمراجعة قبل أي تنفيذ.`
      : `Turn the campaign objective (${params.requirement.objective}) into a reviewable visual asset before execution.`,
    audienceMoment: isArabic
      ? `لحظة الجمهور: ${params.requirement.contentAngle || params.sourcePostText}`
      : `Audience moment: ${params.requirement.contentAngle || params.sourcePostText}`,
    platformFit: platformFitCopy(params.requirement.platform, params.requirement.format, isArabic),
    messageHierarchy: [
      {
        role: 'headline',
        label: isArabic ? 'الرسالة الأولى' : 'Primary message',
        value: headline || (isArabic ? 'تحتاج صياغة عنوان أوضح.' : 'Needs a clearer headline.'),
      },
      {
        role: 'cta',
        label: isArabic ? 'الخطوة المطلوبة' : 'Action cue',
        value: cta || (isArabic ? 'تحتاج CTA واضح للمراجعة.' : 'Needs a clear CTA for review.'),
      },
      {
        role: 'brand',
        label: isArabic ? 'مرساة البراند' : 'Brand anchor',
        value: brand || (isArabic ? 'استخدم الشعار أو اسم البراند كطبقة قابلة للتعديل.' : 'Use logo or brand name as an editable layer.'),
      },
      {
        role: 'background',
        label: isArabic ? 'دور الخلفية' : 'Background role',
        value: hasBackground
          ? (isArabic ? 'الخلفية متاحة كمادة مسودة للمراجعة، وليست إعلانًا نهائيًا.' : 'Background is available as draft review material, not final creative.')
          : (isArabic ? 'الخلفية ناقصة؛ اختر/ولّد/ارفع أصلًا لاحقًا بتأكيد منفصل.' : 'Background is missing; choose, generate, or upload an asset later with separate confirmation.'),
      },
    ],
    readiness: {
      status,
      label: status === 'review_ready'
        ? (isArabic ? 'جاهز لمراجعة القرار الإبداعي' : 'Ready for creative decision review')
        : status === 'needs_brand_asset'
          ? (isArabic ? 'يحتاج تثبيت طبقة البراند' : 'Needs brand layer confirmation')
          : status === 'needs_message'
            ? (isArabic ? 'يحتاج عنوانًا وCTA معتمدين' : 'Needs an approved headline and CTA')
            : (isArabic ? 'يحتاج قرار الخلفية أولًا' : 'Needs background decision first'),
      score,
      blockers,
    },
    qualitySignals: [
      {
        id: 'message_clarity',
        label: isArabic ? 'وضوح الرسالة' : 'Message clarity',
        status: headline && cta ? 'pass' : 'review',
        detail: headline && cta
          ? (isArabic ? 'العنوان والـ CTA موجودان كطبقات قابلة للتعديل.' : 'Headline and CTA exist as editable layers.')
          : (isArabic ? 'راجع العنوان والـ CTA قبل أي تركيب لاحق.' : 'Review headline and CTA before any later composition.'),
      },
      {
        id: 'brand_anchor',
        label: isArabic ? 'حضور البراند' : 'Brand anchor',
        status: brand ? 'pass' : 'review',
        detail: brand
          ? (isArabic ? 'يوجد شعار/اسم براند داخل المسودة.' : 'Logo or brand-name layer is present in the draft.')
          : (isArabic ? 'أضف شعارًا أو اسم براند واضحًا قبل اعتماد الاتجاه.' : 'Add a logo or clear brand label before approving the direction.'),
      },
      {
        id: 'background_source',
        label: isArabic ? 'مصدر الخلفية' : 'Background source',
        status: hasBackground ? 'pass' : 'review',
        detail: hasBackground
          ? (isArabic ? 'توجد خلفية للمراجعة فقط؛ الربط النهائي يظل منفصلًا.' : 'A background exists for review only; final attachment remains separate.')
          : (isArabic ? 'لا توجد خلفية مرتبطة، لذلك لا يوجد render أو attach جاهز.' : 'No linked background exists, so render or attach is not ready.'),
      },
      {
        id: 'safe_zones',
        label: isArabic ? 'مناطق الأمان' : 'Safe zones',
        status: safeZonesPass ? 'pass' : 'review',
        detail: safeZonesPass
          ? (isArabic ? 'الطبقات الحالية داخل مناطق أمان المراجعة.' : 'Current layers sit inside review safe zones.')
          : (isArabic ? 'بعض الطبقات تحتاج ضبطًا قبل أي تركيب لاحق.' : 'Some layers need adjustment before any later composition.'),
      },
      {
        id: 'execution_boundary',
        label: isArabic ? 'حدود التنفيذ' : 'Execution boundary',
        status: 'pass',
        detail: isArabic
          ? 'هذه الصفحة لا تحفظ، لا ترفع، لا ترفق، لا تنشر، ولا تجدول.'
          : 'This page does not save, upload, attach, publish, or schedule.',
      },
    ],
    nextBestAction: !hasBackground
      ? (isArabic
          ? 'أكمل قرار الخلفية من Content Hub أو مكتبة الوسائط بتأكيد منفصل، ثم ارجع لمراجعة الطبقات.'
          : 'Complete the background decision from Content Hub or Media Library with separate confirmation, then return to review layers.')
      : !cta
        ? (isArabic
            ? 'حدّد CTA حقيقيًا ووجهة قابلة للقياس في المنشور، ثم راجع الطبقات قبل الربط.'
            : 'Define a real CTA and measurable destination on the post, then review the layers before attachment.')
        : (isArabic
            ? 'راجع ترتيب الرسالة والبراند هنا، ثم اترك الربط النهائي لقرار منفصل من Content Hub.'
            : 'Review message hierarchy and brand fit here, then leave final attachment to a separate Content Hub decision.'),
  }
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
  const contentIsArabic = (input.campaign.language || '').toLowerCase().startsWith('ar')
    || isArabicText(firstMeaningfulText(input.post))
  const interfaceLocale: 'ar' | 'en' = (input.campaign.interfaceLocale || '').toLowerCase().startsWith('ar') ? 'ar' : 'en'
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
      locale: contentIsArabic ? 'ar' : 'en',
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
  const qualitySummary = summarizeQuality(compositionPlan, compositionPreview)

  return {
    postId: input.post.id,
    postNumber: input.post.postNumber,
    platform: requirement.platform,
    format: requirement.format,
    outputClassification: 'draft_layered_studio_preview',
    interfaceLocale,
    backgroundStatus,
    backgroundLabel: backgroundLabel(backgroundStatus),
    sourcePostText: firstMeaningfulText(input.post),
    requirement,
    compositionPlan,
    compositionPreview,
    editableLayers,
    qualitySummary,
    decisionBrief: buildDecisionBrief({
      requirement,
      backgroundStatus,
      editableLayers,
      sourcePostText: firstMeaningfulText(input.post),
      language: interfaceLocale,
    }),
    controlledPath: buildControlledPath(hasBackground, interfaceLocale === 'ar'),
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
  const interfaceIsArabic = model.interfaceLocale === 'ar'
  const controlledPath = model.controlledPath.map(step => (
    step.id === 'preview'
      ? {
          ...step,
          label: `${step.label} · ${(interfaceIsArabic ? DRAFT_LAYOUT_LABELS_AR : DRAFT_LAYOUT_LABELS)[normalizedControls.layout]}`,
          description: interfaceIsArabic
            ? `${step.description} تعديلات المسودة محلية داخل هذا المتصفح ولا يتم حفظها.`
            : `${step.description} Draft edits are local to this browser session and are not saved.`,
        }
      : step
  ))
  const qualitySummary = summarizeQuality(compositionPlan, compositionPreview)

  return {
    ...model,
    compositionPlan,
    compositionPreview,
    editableLayers,
    qualitySummary,
    decisionBrief: buildDecisionBrief({
      requirement: model.requirement,
      backgroundStatus: model.backgroundStatus,
      editableLayers,
      sourcePostText: model.sourcePostText,
      language: model.interfaceLocale,
    }),
    controlledPath,
  }
}
