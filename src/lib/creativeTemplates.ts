export type CreativeTemplatePlatform =
  | 'META'
  | 'FACEBOOK'
  | 'INSTAGRAM'
  | 'LINKEDIN'
  | 'TIKTOK'
  | 'X'
  | 'PINTEREST'
  | 'GOOGLE'
  | 'UNKNOWN'

export type CreativeTemplateFormat =
  | 'feed_square'
  | 'feed_portrait'
  | 'feed_landscape'
  | 'story_reel'
  | 'linkedin_landscape'
  | 'generic_social'

export type CreativeLayerType =
  | 'background'
  | 'hero_image'
  | 'headline'
  | 'subheading'
  | 'cta'
  | 'logo'
  | 'badge'
  | 'accent'
  | 'proof_note'

export type CreativeLayerContentSource =
  | 'brand_brain'
  | 'social_post'
  | 'creative_requirement'
  | 'user_editable'
  | 'uploaded_asset'
  | 'generated_asset'
  | 'template_default'

export type CreativeLayerAnchor =
  | 'top_left'
  | 'top_right'
  | 'center'
  | 'bottom_left'
  | 'bottom_right'

export type CreativeLayer = {
  id: string
  type: CreativeLayerType
  role: string
  contentSource: CreativeLayerContentSource
  editable: boolean
  required: boolean
  position: {
    x: number
    y: number
    anchor: CreativeLayerAnchor
  }
  size: {
    width: number
    height: number
  }
  constraints: string[]
  fallback: string | null
  validationRules: string[]
}

export type CreativeTemplateSpec = {
  templateId: string
  templateName: string
  platform: CreativeTemplatePlatform
  format: CreativeTemplateFormat
  aspectRatio: string
  width: number
  height: number
  postType: string
  funnelStage: string
  industryFit: string[]
  brandStyleFit: string[]
  safeZones: {
    top: number
    right: number
    bottom: number
    left: number
  }
  colorRoles: string[]
  typographyRoles: string[]
  requiredAssets: string[]
  editableFields: string[]
  qualityRules: string[]
  layers: CreativeLayer[]
}

export type CreativeTemplateValidationResult = {
  ok: boolean
  errors: string[]
  warnings: string[]
}

export type CreativeQualityChecklistItem = {
  id: string
  label: string
  severity: 'required' | 'recommended'
  passedByDefault: boolean
  explanation: string
}

export type CreativeTemplateRequirementInput = {
  platform?: string | null
  aspectRatio?: string | null
  funnelStage?: string | null
  format?: string | null
  logoNeeded?: boolean | null
  textOverlayNeeded?: boolean | null
  ctaLayer?: string | null
  headlineLayer?: string | null
  proofConstraints?: string[] | null
}

const REQUIRED_BASE_LAYER_TYPES: CreativeLayerType[] = ['background', 'headline']

function layer(
  input: Pick<CreativeLayer, 'id' | 'type' | 'role' | 'contentSource' | 'editable' | 'required' | 'position' | 'size'> & {
    constraints?: string[]
    fallback?: string | null
    validationRules?: string[]
  },
): CreativeLayer {
  return {
    constraints: [],
    fallback: null,
    validationRules: [],
    ...input,
  }
}

export const DEFAULT_CREATIVE_TEMPLATES: CreativeTemplateSpec[] = [
  {
    templateId: 'meta-portrait-offer-card-v1',
    templateName: 'Meta portrait offer card',
    platform: 'META',
    format: 'feed_portrait',
    aspectRatio: '4:5',
    width: 1080,
    height: 1350,
    postType: 'single_image',
    funnelStage: 'Review-ready social post',
    industryFit: ['food_beverage', 'retail', 'services', 'general'],
    brandStyleFit: ['premium', 'warm', 'modern', 'editorial'],
    safeZones: { top: 96, right: 72, bottom: 120, left: 72 },
    colorRoles: ['background', 'surface_scrim', 'brand_accent', 'text_primary'],
    typographyRoles: ['headline', 'cta'],
    requiredAssets: ['background_or_hero_visual', 'brand_logo'],
    editableFields: ['headline', 'cta', 'logo'],
    qualityRules: [
      'Use editable headline and CTA layers.',
      'Do not treat AI-rendered text inside the background as final creative text.',
      'Keep Content Hub as the final attachment source.',
    ],
    layers: [
      layer({
        id: 'background',
        type: 'background',
        role: 'Generated or uploaded background visual',
        contentSource: 'generated_asset',
        editable: false,
        required: true,
        position: { x: 0, y: 0, anchor: 'top_left' },
        size: { width: 1, height: 1 },
        constraints: ['Must not include final text baked into the image.'],
        validationRules: ['Background fills the full canvas.'],
      }),
      layer({
        id: 'headline',
        type: 'headline',
        role: 'Primary message from SocialPost or user edit',
        contentSource: 'social_post',
        editable: true,
        required: true,
        position: { x: 0.08, y: 0.68, anchor: 'bottom_left' },
        size: { width: 0.68, height: 0.16 },
        fallback: 'Use the first safe sentence from the post copy.',
        validationRules: ['Must remain readable on mobile.', 'Arabic text must be editable and composited.'],
      }),
      layer({
        id: 'cta',
        type: 'cta',
        role: 'Soft call to action',
        contentSource: 'user_editable',
        editable: true,
        required: true,
        position: { x: 0.08, y: 0.83, anchor: 'bottom_left' },
        size: { width: 0.46, height: 0.08 },
        fallback: 'Learn more',
        validationRules: ['CTA must be truthful and review-safe.'],
      }),
      layer({
        id: 'logo',
        type: 'logo',
        role: 'Brand logo mark',
        contentSource: 'brand_brain',
        editable: true,
        required: true,
        position: { x: 0.9, y: 0.88, anchor: 'bottom_right' },
        size: { width: 0.12, height: 0.12 },
        fallback: 'Use brand name text if no logo is available.',
        validationRules: ['Logo must stay inside safe zones.'],
      }),
      layer({
        id: 'accent',
        type: 'accent',
        role: 'Brand color accent',
        contentSource: 'brand_brain',
        editable: true,
        required: false,
        position: { x: 0, y: 0.98, anchor: 'bottom_left' },
        size: { width: 1, height: 0.02 },
        fallback: 'Use neutral accent if no brand color exists.',
        validationRules: ['Accent must not obscure required text.'],
      }),
    ],
  },
  {
    templateId: 'linkedin-landscape-insight-v1',
    templateName: 'LinkedIn landscape insight card',
    platform: 'LINKEDIN',
    format: 'linkedin_landscape',
    aspectRatio: '1.91:1',
    width: 1200,
    height: 628,
    postType: 'single_image',
    funnelStage: 'Professional feed review',
    industryFit: ['b2b', 'services', 'technology', 'food_beverage', 'general'],
    brandStyleFit: ['professional', 'modern', 'editorial', 'minimal'],
    safeZones: { top: 56, right: 72, bottom: 64, left: 72 },
    colorRoles: ['background', 'content_panel', 'brand_accent', 'text_primary'],
    typographyRoles: ['headline', 'subheading', 'cta'],
    requiredAssets: ['background_or_hero_visual', 'brand_logo'],
    editableFields: ['headline', 'subheading', 'cta', 'logo'],
    qualityRules: [
      'Use editable headline, subheading, and CTA layers.',
      'Do not treat AI-rendered text inside the background as final creative text.',
      'Keep Content Hub as the final attachment source.',
    ],
    layers: [
      layer({
        id: 'background',
        type: 'background',
        role: 'Professional background visual',
        contentSource: 'generated_asset',
        editable: false,
        required: true,
        position: { x: 0, y: 0, anchor: 'top_left' },
        size: { width: 1, height: 1 },
        constraints: ['Must preserve room for editable copy layers.'],
        validationRules: ['Background fills the full canvas.'],
      }),
      layer({
        id: 'headline',
        type: 'headline',
        role: 'Professional hook',
        contentSource: 'social_post',
        editable: true,
        required: true,
        position: { x: 0.07, y: 0.24, anchor: 'top_left' },
        size: { width: 0.54, height: 0.22 },
        fallback: 'Use a concise post-safe headline.',
        validationRules: ['Headline must be readable in feed preview.'],
      }),
      layer({
        id: 'subheading',
        type: 'subheading',
        role: 'Supporting message',
        contentSource: 'creative_requirement',
        editable: true,
        required: false,
        position: { x: 0.07, y: 0.48, anchor: 'top_left' },
        size: { width: 0.5, height: 0.16 },
        fallback: 'Use the campaign message if a subheading is needed.',
        validationRules: ['Subheading must not introduce unsupported proof.'],
      }),
      layer({
        id: 'logo',
        type: 'logo',
        role: 'Brand logo mark',
        contentSource: 'brand_brain',
        editable: true,
        required: true,
        position: { x: 0.92, y: 0.12, anchor: 'top_right' },
        size: { width: 0.1, height: 0.16 },
        fallback: 'Use brand name text if no logo is available.',
        validationRules: ['Logo must stay inside safe zones.'],
      }),
      layer({
        id: 'cta',
        type: 'cta',
        role: 'Professional next step',
        contentSource: 'user_editable',
        editable: true,
        required: false,
        position: { x: 0.07, y: 0.77, anchor: 'bottom_left' },
        size: { width: 0.32, height: 0.1 },
        fallback: 'Review the details',
        validationRules: ['CTA must remain explicit and non-absolute.'],
      }),
    ],
  },
  {
    templateId: 'generic-square-review-v1',
    templateName: 'Generic square review card',
    platform: 'UNKNOWN',
    format: 'feed_square',
    aspectRatio: '1:1',
    width: 1080,
    height: 1080,
    postType: 'single_image',
    funnelStage: 'Review-ready social post',
    industryFit: ['general'],
    brandStyleFit: ['modern', 'minimal', 'editorial'],
    safeZones: { top: 80, right: 72, bottom: 96, left: 72 },
    colorRoles: ['background', 'brand_accent', 'text_primary'],
    typographyRoles: ['headline', 'cta'],
    requiredAssets: ['background_or_hero_visual'],
    editableFields: ['headline', 'cta', 'logo'],
    qualityRules: [
      'Use editable headline and CTA layers.',
      'Do not treat AI-rendered text inside the background as final creative text.',
      'Keep Content Hub as the final attachment source.',
    ],
    layers: [
      layer({
        id: 'background',
        type: 'background',
        role: 'Generated or uploaded square background',
        contentSource: 'generated_asset',
        editable: false,
        required: true,
        position: { x: 0, y: 0, anchor: 'top_left' },
        size: { width: 1, height: 1 },
        validationRules: ['Background fills the full canvas.'],
      }),
      layer({
        id: 'headline',
        type: 'headline',
        role: 'Primary post message',
        contentSource: 'social_post',
        editable: true,
        required: true,
        position: { x: 0.08, y: 0.64, anchor: 'bottom_left' },
        size: { width: 0.72, height: 0.18 },
        fallback: 'Use post copy headline.',
        validationRules: ['Must remain readable.'],
      }),
      layer({
        id: 'cta',
        type: 'cta',
        role: 'Optional review-safe CTA',
        contentSource: 'user_editable',
        editable: true,
        required: false,
        position: { x: 0.08, y: 0.82, anchor: 'bottom_left' },
        size: { width: 0.5, height: 0.08 },
        fallback: 'Learn more',
        validationRules: ['CTA must be editable.'],
      }),
      layer({
        id: 'logo',
        type: 'logo',
        role: 'Optional brand mark',
        contentSource: 'brand_brain',
        editable: true,
        required: false,
        position: { x: 0.9, y: 0.88, anchor: 'bottom_right' },
        size: { width: 0.12, height: 0.12 },
        fallback: 'Use brand name text if no logo is available.',
        validationRules: ['Logo must stay inside safe zones.'],
      }),
    ],
  },
]

function cloneTemplate(template: CreativeTemplateSpec): CreativeTemplateSpec {
  return JSON.parse(JSON.stringify(template)) as CreativeTemplateSpec
}

function pinterestTemplate(): CreativeTemplateSpec {
  const template = cloneTemplate(DEFAULT_CREATIVE_TEMPLATES[2])
  return {
    ...template,
    templateId: 'pinterest-standard-pin-v1',
    templateName: 'Pinterest standard image Pin',
    platform: 'PINTEREST',
    format: 'feed_portrait',
    aspectRatio: '2:3',
    width: 1000,
    height: 1500,
    safeZones: { top: 100, right: 80, bottom: 120, left: 80 },
  }
}

export function normalizeCreativeTemplatePlatform(platform?: string | null): CreativeTemplatePlatform {
  const normalized = (platform || '').trim().toUpperCase()
  if (normalized.includes('LINKEDIN')) return 'LINKEDIN'
  if (normalized.includes('INSTAGRAM')) return 'INSTAGRAM'
  if (normalized.includes('FACEBOOK')) return 'FACEBOOK'
  if (normalized.includes('META')) return 'META'
  if (normalized.includes('TIKTOK') || normalized.includes('REEL') || normalized.includes('SHORT')) return 'TIKTOK'
  if (normalized === 'X' || normalized.includes('TWITTER')) return 'X'
  if (normalized.includes('PINTEREST')) return 'PINTEREST'
  if (normalized.includes('GOOGLE')) return 'GOOGLE'
  return 'UNKNOWN'
}

export function getDefaultTemplateForPlatform(platform?: string | null): CreativeTemplateSpec {
  const normalized = normalizeCreativeTemplatePlatform(platform)
  if (normalized === 'LINKEDIN') return cloneTemplate(DEFAULT_CREATIVE_TEMPLATES[1])
  if (normalized === 'META' || normalized === 'FACEBOOK' || normalized === 'INSTAGRAM') {
    return cloneTemplate(DEFAULT_CREATIVE_TEMPLATES[0])
  }
  if (normalized === 'PINTEREST') return pinterestTemplate()
  return cloneTemplate(DEFAULT_CREATIVE_TEMPLATES[2])
}

export function getCreativeTemplatesForRequirement(
  requirement: CreativeTemplateRequirementInput,
): CreativeTemplateSpec[] {
  const platform = normalizeCreativeTemplatePlatform(requirement.platform)
  const aspectRatio = (requirement.aspectRatio || '').trim()
  const defaultTemplate = getDefaultTemplateForPlatform(platform)
  const platformFits = DEFAULT_CREATIVE_TEMPLATES.filter(template => {
    if (platform === 'UNKNOWN') return template.platform === 'UNKNOWN'
    if (platform === 'FACEBOOK' || platform === 'INSTAGRAM') return template.platform === 'META'
    return template.platform === platform
  })
  const aspectFits = aspectRatio
    ? platformFits.filter(template => template.aspectRatio === aspectRatio)
    : platformFits

  const matches = aspectFits.length ? aspectFits : platformFits
  if (!matches.length) return [defaultTemplate]

  return matches.map(cloneTemplate)
}

function hasSafeZones(template: CreativeTemplateSpec): boolean {
  return ['top', 'right', 'bottom', 'left'].every(key => {
    const value = template.safeZones[key as keyof CreativeTemplateSpec['safeZones']]
    return Number.isFinite(value) && value >= 0
  })
}

export function validateCreativeTemplateSpec(template: CreativeTemplateSpec): CreativeTemplateValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!template.templateId) errors.push('Template must include templateId.')
  if (!template.templateName) errors.push('Template must include templateName.')
  if (template.width <= 0 || template.height <= 0) errors.push('Template dimensions must be positive.')
  if (!template.aspectRatio) errors.push('Template must include aspectRatio.')
  if (!hasSafeZones(template)) errors.push('Template must include non-negative safeZones.')
  if (!template.layers.length) errors.push('Template must include layers.')

  const layerIds = new Set<string>()
  const layerTypes = new Set<CreativeLayerType>()
  for (const item of template.layers) {
    if (layerIds.has(item.id)) errors.push(`Duplicate layer id: ${item.id}.`)
    layerIds.add(item.id)
    layerTypes.add(item.type)

    if (!item.role.trim()) errors.push(`Layer ${item.id} must include a role.`)
    if (item.size.width <= 0 || item.size.height <= 0) errors.push(`Layer ${item.id} must have positive size.`)
    if (item.type === 'background' && item.editable) warnings.push('Background layers should not be text-editable.')
  }

  for (const requiredType of REQUIRED_BASE_LAYER_TYPES) {
    if (!layerTypes.has(requiredType)) errors.push(`Missing required ${requiredType} layer.`)
  }

  for (const editableField of template.editableFields) {
    const field = editableField.toLowerCase()
    if ((field === 'headline' || field === 'cta' || field === 'logo') && !layerTypes.has(field as CreativeLayerType)) {
      errors.push(`Editable field ${field} requires a matching layer.`)
    }
  }

  if (template.requiredAssets.includes('brand_logo') && !layerTypes.has('logo')) {
    errors.push('Required brand_logo asset requires a logo layer.')
  }

  return { ok: errors.length === 0, errors, warnings }
}

export function deriveCreativeQualityChecklist(template: CreativeTemplateSpec): CreativeQualityChecklistItem[] {
  const headlineLayer = template.layers.find(item => item.type === 'headline')
  const ctaLayer = template.layers.find(item => item.type === 'cta')
  const logoLayer = template.layers.find(item => item.type === 'logo')
  const proofLayer = template.layers.find(item => item.type === 'proof_note' || item.type === 'badge')

  return [
    {
      id: 'editable_headline_layer',
      label: 'Editable headline layer',
      severity: 'required',
      passedByDefault: Boolean(headlineLayer?.editable),
      explanation: 'Final text should be composited as an editable headline layer, not baked into the AI background.',
    },
    {
      id: 'editable_cta_layer',
      label: 'Editable CTA layer',
      severity: 'recommended',
      passedByDefault: Boolean(ctaLayer?.editable),
      explanation: 'CTA copy should stay editable so reviewers can keep it truthful and platform-appropriate.',
    },
    {
      id: 'avoid_ai_rendered_text',
      label: 'Avoid AI-rendered text in background',
      severity: 'required',
      passedByDefault: template.layers.some(item => item.type === 'background')
        && Boolean(headlineLayer?.editable),
      explanation: 'AI-generated backgrounds should not be treated as final text. Arabic, headline, CTA, and logo text should be composited as separate layers.',
    },
    {
      id: 'safe_zones_defined',
      label: 'Safe zones defined',
      severity: 'required',
      passedByDefault: hasSafeZones(template),
      explanation: 'Templates need safe zones so text, logo, and CTA layers do not collide with platform UI or crop edges.',
    },
    {
      id: 'brand_logo_layer',
      label: 'Brand/logo layer',
      severity: template.requiredAssets.includes('brand_logo') ? 'required' : 'recommended',
      passedByDefault: Boolean(logoLayer),
      explanation: 'Brand identity should be represented by an editable logo or brand-name layer when available.',
    },
    {
      id: 'proof_layer_is_constrained',
      label: 'Proof/compliance layer constrained',
      severity: 'recommended',
      passedByDefault: !proofLayer || proofLayer.validationRules.length > 0,
      explanation: 'Proof badges or notes must only appear when proof is allowed by the Creative Requirement and Brand Brain context.',
    },
    {
      id: 'platform_aspect_ratio_match',
      label: 'Platform aspect ratio match',
      severity: 'required',
      passedByDefault: Boolean(template.aspectRatio && template.width > 0 && template.height > 0),
      explanation: 'The template must explicitly match the platform format and aspect ratio before rendering or attachment.',
    },
    {
      id: 'content_hub_final_attachment_boundary',
      label: 'Content Hub final attachment boundary',
      severity: 'required',
      passedByDefault: template.qualityRules.some(rule => /Content Hub/i.test(rule)),
      explanation: 'A template is not final post media by itself. Final attachment remains an explicit Content Hub decision.',
    },
  ]
}
