import {
  getDefaultTemplateForPlatform,
  type CreativeLayer,
  type CreativeLayerType,
  type CreativeTemplateSpec,
} from './creativeTemplates'
import type { CreativeRequirement } from './creativeRequirements'

export type CompositionLayerRole =
  | 'background'
  | 'headline'
  | 'subheading'
  | 'cta'
  | 'logo_or_brand_name'
  | 'accent'
  | 'proof_badge_optional'

export type CompositionAssetSource =
  | 'generated_background'
  | 'uploaded_asset'
  | 'social_post'
  | 'creative_requirement'
  | 'brand_brain'
  | 'template_default'
  | 'none'

export type CompositionPlanStatus = 'composition_plan_for_review'

export type CompositionValidationResult = {
  id: string
  passed: boolean
  severity: 'required' | 'recommended'
  message: string
}

export type CreativeCompositionLayer = {
  id: string
  role: CompositionLayerRole
  type: CreativeLayerType | 'logo_or_brand_name'
  editable: boolean
  required: boolean
  content: {
    text?: string
    imageUrl?: string
    color?: string
    language?: 'ar' | 'en'
    renderMode?: 'background_image' | 'composited_text' | 'image_asset' | 'shape'
    aiRenderedText?: boolean
  }
  contentSource: CompositionAssetSource
  position: CreativeLayer['position']
  size: CreativeLayer['size']
  safeZoneCompliant: boolean
  validationMessages: string[]
}

export type CreativeCompositionPlan = {
  planId: string
  postId: string
  templateId: string
  platform: string
  format: string
  aspectRatio: string
  canvas: {
    width: number
    height: number
  }
  status: CompositionPlanStatus
  outputClassification: 'draft_composition_plan'
  background: {
    imageUrl: string | null
    source: 'generated_background' | 'uploaded_asset' | 'none'
    generatedVisualId?: string | null
    uploadedMediaId?: string | null
  }
  layers: CreativeCompositionLayer[]
  qualityChecks: CompositionValidationResult[]
  attachPolicy: {
    autoAttach: false
    attachRequiresExplicitUserAction: true
    attachSurface: 'content_hub'
  }
  safety: {
    doesNotPublish: true
    doesNotSchedule: true
    doesNotUpdateBrandBrainLearning: true
    doesNotLaunchPaidAds: true
  }
}

export type CompositionInput = {
  postId: string
  postCaption?: string | null
  brandName?: string | null
  logoUrl?: string | null
  colorPalette?: string[] | string | null
  colorRoles?: string[] | null
  language?: string | null
  creativeRequirement?: Partial<CreativeRequirement> | null
  creativeTemplate?: CreativeTemplateSpec | null
  backgroundImageUrl?: string | null
  generatedVisualId?: string | null
  uploadedMediaId?: string | null
}

const NEUTRAL_PREMIUM_COLORS = {
  accent: '#334155',
  text: '#F8FAFC',
  surface: 'rgba(15,23,42,0.72)',
}

const UNSAFE_TEXT_PATTERNS = [
  /\bwinning\b/i,
  /\bbest-performing\b/i,
  /\bhigh-conversion\b/i,
  /\bguaranteed\b/i,
  /\bguarantees\b/i,
  /\bproven\b/i,
  /\bready to launch\b/i,
]

const EXECUTION_CLAIM_PATTERNS = [
  /\bpublish(?:es|ed|ing)?\b/i,
  /\bschedule(?:s|d|ing)?\b/i,
  /\bautopilot\b/i,
  /\bpaid launch\b/i,
  /\bplatform push\b/i,
  /\bbrand brain learning\b/i,
]

function normalizeLanguage(language?: string | null, text?: string | null): 'ar' | 'en' {
  if ((language || '').toLowerCase().startsWith('ar')) return 'ar'
  return /[\u0600-\u06FF]/.test(text || '') ? 'ar' : 'en'
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function truncateAtWord(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value
  const slice = value.slice(0, maxChars)
  const lastSpace = slice.lastIndexOf(' ')
  return `${(lastSpace > maxChars * 0.55 ? slice.slice(0, lastSpace) : slice).trim()}...`
}

function stripUnsafeWording(value: string): string {
  return UNSAFE_TEXT_PATTERNS.reduce(
    (text, pattern) => text.replace(pattern, 'review-ready'),
    value,
  )
}

function firstSentence(value?: string | null): string {
  const clean = compactWhitespace(value || '')
  if (!clean) return ''
  return clean.split(/[.!؟?\n]/)[0]?.trim() || clean
}

function deriveHeadline(input: CompositionInput, language: 'ar' | 'en'): string {
  const requirementHeadline = compactWhitespace(input.creativeRequirement?.headlineLayer || '')
  const contentAngle = compactWhitespace(input.creativeRequirement?.contentAngle || '')
  const captionHeadline = firstSentence(input.postCaption)
  const fallback = language === 'ar'
    ? `رسالة ${input.brandName || 'العلامة'}`
    : `${input.brandName || 'Brand'} update`

  return truncateAtWord(
    stripUnsafeWording(requirementHeadline || contentAngle || captionHeadline || fallback),
    language === 'ar' ? 56 : 68,
  )
}

function deriveSubheading(input: CompositionInput): string {
  const objective = compactWhitespace(input.creativeRequirement?.objective || '')
  const concept = compactWhitespace(input.creativeRequirement?.visualConcept || '')
  const source = objective && objective !== 'Support the campaign message' ? objective : concept
  return truncateAtWord(stripUnsafeWording(source), 88)
}

function deriveCta(input: CompositionInput, language: 'ar' | 'en'): string {
  const explicit = compactWhitespace(input.creativeRequirement?.ctaLayer || '')
  if (explicit) return truncateAtWord(stripUnsafeWording(explicit), 28)
  return language === 'ar' ? 'استكشف الخيارات' : 'Explore options'
}

function normalizeColorPalette(palette?: string[] | string | null): string[] {
  if (Array.isArray(palette)) return palette.map(String).map(compactWhitespace).filter(Boolean)
  if (typeof palette === 'string') return palette.split(',').map(compactWhitespace).filter(Boolean)
  return []
}

function deriveAccentColor(input: CompositionInput): string {
  const palette = normalizeColorPalette(input.colorPalette)
  return palette.find(color => /^#[0-9a-fA-F]{6}$/.test(color)) || NEUTRAL_PREMIUM_COLORS.accent
}

function backgroundSource(input: CompositionInput): CreativeCompositionPlan['background']['source'] {
  if (!input.backgroundImageUrl) return 'none'
  if (input.uploadedMediaId || input.creativeRequirement?.sourcePreference === 'uploaded') return 'uploaded_asset'
  return 'generated_background'
}

function proofLayerAllowed(input: CompositionInput): boolean {
  const constraints = input.creativeRequirement?.proofConstraints || []
  if (!constraints.length) return false
  const joined = constraints.join(' ').toLowerCase()
  if (/no proof|without proof|disallow|do not include proof|requires real analytics|analytics required|unsupported proof|no badge/.test(joined)) {
    return false
  }
  return /proof|analytics|testimonial|award|badge/.test(joined)
}

function isTextLayer(layer: CreativeCompositionLayer): boolean {
  return Boolean(layer.content.text)
}

function normalizedLayerBounds(
  layer: Pick<CreativeCompositionLayer, 'position' | 'size'>,
  canvas: { width: number; height: number },
): { left: number; top: number; right: number; bottom: number } {
  const width = layer.size.width * canvas.width
  const height = layer.size.height * canvas.height
  const x = layer.position.x * canvas.width
  const y = layer.position.y * canvas.height

  if (layer.position.anchor === 'top_right') {
    return { left: x - width, top: y, right: x, bottom: y + height }
  }
  if (layer.position.anchor === 'bottom_left') {
    return { left: x, top: y - height, right: x + width, bottom: y }
  }
  if (layer.position.anchor === 'bottom_right') {
    return { left: x - width, top: y - height, right: x, bottom: y }
  }
  if (layer.position.anchor === 'center') {
    return { left: x - width / 2, top: y - height / 2, right: x + width / 2, bottom: y + height / 2 }
  }
  return { left: x, top: y, right: x + width, bottom: y + height }
}

function fitsSafeZones(
  layer: Pick<CreativeCompositionLayer, 'role' | 'position' | 'size'>,
  template: CreativeTemplateSpec,
): boolean {
  if (layer.role === 'background' || layer.role === 'accent') return true
  const bounds = normalizedLayerBounds(layer, { width: template.width, height: template.height })
  return bounds.left >= template.safeZones.left
    && bounds.top >= template.safeZones.top
    && bounds.right <= template.width - template.safeZones.right
    && bounds.bottom <= template.height - template.safeZones.bottom
}

function layerRole(type: CreativeLayerType): CompositionLayerRole {
  if (type === 'logo') return 'logo_or_brand_name'
  if (type === 'badge' || type === 'proof_note') return 'proof_badge_optional'
  if (type === 'hero_image') return 'background'
  return type
}

function buildLayer(
  templateLayer: CreativeLayer,
  input: CompositionInput,
  template: CreativeTemplateSpec,
  language: 'ar' | 'en',
  accentColor: string,
): CreativeCompositionLayer | null {
  const role = layerRole(templateLayer.type)
  const validationMessages = [...templateLayer.validationRules]
  let content: CreativeCompositionLayer['content'] = {}
  let contentSource: CompositionAssetSource = 'template_default'
  let type: CreativeCompositionLayer['type'] = templateLayer.type
  let editable = templateLayer.editable

  if (role === 'background') {
    content = {
      imageUrl: input.backgroundImageUrl || undefined,
      renderMode: 'background_image',
      aiRenderedText: false,
    }
    contentSource = backgroundSource(input)
    editable = false
  } else if (role === 'headline') {
    content = {
      text: deriveHeadline(input, language),
      language,
      renderMode: 'composited_text',
      aiRenderedText: false,
    }
    contentSource = input.creativeRequirement?.headlineLayer ? 'creative_requirement' : 'social_post'
  } else if (role === 'subheading') {
    const subheading = deriveSubheading(input)
    content = subheading
      ? { text: subheading, language, renderMode: 'composited_text', aiRenderedText: false }
      : { text: templateLayer.fallback || '', language, renderMode: 'composited_text', aiRenderedText: false }
    contentSource = subheading ? 'creative_requirement' : 'template_default'
  } else if (role === 'cta') {
    content = {
      text: deriveCta(input, language),
      language,
      renderMode: 'composited_text',
      aiRenderedText: false,
    }
    contentSource = input.creativeRequirement?.ctaLayer ? 'creative_requirement' : 'template_default'
  } else if (role === 'logo_or_brand_name') {
    if (input.logoUrl) {
      content = { imageUrl: input.logoUrl, renderMode: 'image_asset', aiRenderedText: false }
      contentSource = 'brand_brain'
    } else {
      type = 'logo_or_brand_name'
      content = {
        text: input.brandName || 'Brand',
        language,
        renderMode: 'composited_text',
        aiRenderedText: false,
      }
      contentSource = input.brandName ? 'brand_brain' : 'template_default'
      validationMessages.push('No logo asset found; use editable brand-name fallback layer.')
    }
  } else if (role === 'accent') {
    content = { color: accentColor, renderMode: 'shape', aiRenderedText: false }
    contentSource = normalizeColorPalette(input.colorPalette).length ? 'brand_brain' : 'template_default'
    if (!normalizeColorPalette(input.colorPalette).length) {
      validationMessages.push('No Brand Brain color palette found; using neutral premium fallback color.')
    }
  } else if (role === 'proof_badge_optional') {
    if (!proofLayerAllowed(input)) return null
    content = {
      text: templateLayer.fallback || 'Proof pending review',
      language,
      renderMode: 'composited_text',
      aiRenderedText: false,
    }
    contentSource = 'creative_requirement'
  }

  const layer: CreativeCompositionLayer = {
    id: templateLayer.id,
    role,
    type,
    editable,
    required: templateLayer.required,
    content,
    contentSource,
    position: templateLayer.position,
    size: templateLayer.size,
    safeZoneCompliant: true,
    validationMessages,
  }

  return {
    ...layer,
    safeZoneCompliant: fitsSafeZones(layer, template),
  }
}

function planId(postId: string, templateId: string): string {
  return `composition_${postId}_${templateId}`.replace(/[^a-zA-Z0-9_-]/g, '_')
}

export function deriveCreativeCompositionPlan(input: CompositionInput): CreativeCompositionPlan {
  const template = input.creativeTemplate || getDefaultTemplateForPlatform(input.creativeRequirement?.platform)
  const language = normalizeLanguage(input.language, input.postCaption || input.creativeRequirement?.contentAngle)
  const accentColor = deriveAccentColor(input)
  const layers = template.layers
    .map(templateLayer => buildLayer(templateLayer, input, template, language, accentColor))
    .filter((layer): layer is CreativeCompositionLayer => Boolean(layer))

  const plan: CreativeCompositionPlan = {
    planId: planId(input.postId, template.templateId),
    postId: input.postId,
    templateId: template.templateId,
    platform: template.platform === 'UNKNOWN'
      ? template.platform
      : input.creativeRequirement?.platform || template.platform,
    format: template.format,
    aspectRatio: template.aspectRatio,
    canvas: {
      width: template.width,
      height: template.height,
    },
    status: 'composition_plan_for_review',
    outputClassification: 'draft_composition_plan',
    background: {
      imageUrl: input.backgroundImageUrl || null,
      source: backgroundSource(input),
      generatedVisualId: input.generatedVisualId || null,
      uploadedMediaId: input.uploadedMediaId || null,
    },
    layers,
    qualityChecks: [],
    attachPolicy: {
      autoAttach: false,
      attachRequiresExplicitUserAction: true,
      attachSurface: 'content_hub',
    },
    safety: {
      doesNotPublish: true,
      doesNotSchedule: true,
      doesNotUpdateBrandBrainLearning: true,
      doesNotLaunchPaidAds: true,
    },
  }

  return {
    ...plan,
    qualityChecks: validateCreativeCompositionPlan(plan),
  }
}

function result(
  id: string,
  passed: boolean,
  severity: CompositionValidationResult['severity'],
  message: string,
): CompositionValidationResult {
  return { id, passed, severity, message }
}

export function validateCreativeCompositionPlan(plan: CreativeCompositionPlan): CompositionValidationResult[] {
  const headlineLayer = plan.layers.find(layer => layer.role === 'headline')
  const ctaLayer = plan.layers.find(layer => layer.role === 'cta')
  const brandLayer = plan.layers.find(layer => layer.role === 'logo_or_brand_name')
  const textLayers = plan.layers.filter(isTextLayer)
  const unsafeText = textLayers
    .map(layer => layer.content.text || '')
    .filter(text => EXECUTION_CLAIM_PATTERNS.some(pattern => pattern.test(text)))
  const unsafeSafeZoneLayers = plan.layers.filter(layer => !layer.safeZoneCompliant)
  const proofLayers = plan.layers.filter(layer => layer.role === 'proof_badge_optional')
  const arabicTextLayers = textLayers.filter(layer => layer.content.language === 'ar')

  return [
    result(
      'background_exists_when_required',
      plan.background.source !== 'none' && Boolean(plan.background.imageUrl),
      'required',
      'Composition plan needs a generated or uploaded background before rendering.',
    ),
    result(
      'editable_headline_layer',
      Boolean(headlineLayer?.editable && headlineLayer.content.renderMode === 'composited_text' && headlineLayer.content.aiRenderedText === false),
      'required',
      'Headline must be an editable composited layer, not AI-rendered text.',
    ),
    result(
      'editable_cta_layer',
      Boolean(ctaLayer?.editable && ctaLayer.content.renderMode === 'composited_text'),
      'recommended',
      'CTA should stay editable and review-safe.',
    ),
    result(
      'logo_or_brand_name_layer',
      Boolean(brandLayer),
      'required',
      'Plan needs a logo layer or editable brand-name fallback.',
    ),
    result(
      'layers_fit_safe_zones',
      unsafeSafeZoneLayers.length === 0,
      'required',
      unsafeSafeZoneLayers.length
        ? `Layers outside safe zones: ${unsafeSafeZoneLayers.map(layer => layer.id).join(', ')}.`
        : 'All editable layers fit within template safe zones.',
    ),
    result(
      'proof_layer_blocked_without_allowed_proof',
      proofLayers.every(layer => !/unsupported|unverified|fake/i.test(layer.content.text || '')),
      'recommended',
      'Proof badges stay optional and must only appear from allowed proof constraints.',
    ),
    result(
      'no_publish_schedule_paid_claims',
      unsafeText.length === 0,
      'required',
      unsafeText.length
        ? `Layer text contains execution claims: ${unsafeText.join(' | ')}.`
        : 'Layer text does not claim publishing, scheduling, Autopilot, paid launch, or Brand Brain learning.',
    ),
    result(
      'attach_policy_requires_content_hub_action',
      plan.attachPolicy.autoAttach === false
        && plan.attachPolicy.attachRequiresExplicitUserAction === true
        && plan.attachPolicy.attachSurface === 'content_hub',
      'required',
      'Composition plans never auto-attach and require explicit Content Hub action.',
    ),
    result(
      'draft_composition_plan_classification',
      plan.outputClassification === 'draft_composition_plan'
        && plan.status === 'composition_plan_for_review',
      'required',
      'Plan is classified as a draft composition plan for review, not final ad creative.',
    ),
    result(
      'arabic_text_is_composited_editable',
      arabicTextLayers.every(layer => layer.editable && layer.content.renderMode === 'composited_text' && layer.content.aiRenderedText === false),
      'required',
      'Arabic text must remain editable/composited and never trusted as AI-rendered raster text.',
    ),
  ]
}
