import type {
  CompositionLayerRole,
  CompositionPlanStatus,
  CreativeCompositionLayer,
  CreativeCompositionPlan,
} from './creativeComposition'

export type CreativeCompositionPreviewArtifact = {
  type: 'svg_string'
  svg: string
  mimeType: 'image/svg+xml'
  persisted: false
  uploaded: false
}

export type CreativeCompositionPreviewValidation = {
  id: string
  passed: boolean
  severity: 'required' | 'recommended'
  message: string
}

export type CreativeCompositionPreviewLayer = {
  id: string
  role: CompositionLayerRole
  type: CreativeCompositionLayer['type']
  editable: boolean
  required: boolean
  content: CreativeCompositionLayer['content']
  contentSource: CreativeCompositionLayer['contentSource']
  position: CreativeCompositionLayer['position']
  size: CreativeCompositionLayer['size']
  safeZoneCompliant: boolean
  validationMessages: string[]
  render: {
    x: number
    y: number
    width: number
    height: number
    anchor: CreativeCompositionLayer['position']['anchor']
  }
}

export type CreativeCompositionPreview = {
  previewId: string
  planId: string
  postId: string
  templateId: string
  outputClassification: 'draft_composition_preview'
  reviewStatus: 'preview_for_review'
  canvas: {
    width: number
    height: number
    aspectRatio: string
  }
  artifact: CreativeCompositionPreviewArtifact
  layers: CreativeCompositionPreviewLayer[]
  validations: CreativeCompositionPreviewValidation[]
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
    doesNotMutateSocialPost: true
  }
}

export type CreativeCompositionPreviewInput = {
  plan: CreativeCompositionPlan
  backgroundImageUrlOverride?: string | null
  options?: {
    includeLayerOutlines?: boolean
    locale?: 'en' | 'ar'
    previewMode?: 'review'
  }
}

const FINAL_CLAIM_PATTERN = /\b(final ad|final creative|platform-ready|publish(?:ed|ing)?|schedule(?:d|ing)?|autopilot|paid launch|brand brain learning)\b/i

function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeAttribute(value: string): string {
  return escapeText(value)
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function previewId(plan: CreativeCompositionPlan): string {
  return `preview_${plan.planId}`.replace(/[^a-zA-Z0-9_-]/g, '_')
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function clampLayerBounds(
  bounds: CreativeCompositionPreviewLayer['render'],
  canvas: { width: number; height: number },
): CreativeCompositionPreviewLayer['render'] {
  const width = clamp(bounds.width, 1, canvas.width)
  const height = clamp(bounds.height, 1, canvas.height)
  return {
    ...bounds,
    x: clamp(bounds.x, 0, Math.max(0, canvas.width - width)),
    y: clamp(bounds.y, 0, Math.max(0, canvas.height - height)),
    width,
    height,
  }
}

function expandBrandFallbackBounds(
  bounds: CreativeCompositionPreviewLayer['render'],
  canvas: { width: number; height: number },
): CreativeCompositionPreviewLayer['render'] {
  const width = Math.min(300, Math.max(bounds.width, Math.round(canvas.width * 0.22)))
  const height = Math.min(64, Math.max(bounds.height, 48))
  const x = bounds.anchor === 'top_right' || bounds.anchor === 'bottom_right'
    ? bounds.x + bounds.width - width
    : bounds.x
  return clampLayerBounds({ ...bounds, x, width, height }, canvas)
}

function absoluteLayerBounds(
  layer: Pick<CreativeCompositionLayer, 'position' | 'size'>,
  canvas: { width: number; height: number },
): CreativeCompositionPreviewLayer['render'] {
  const width = Math.round(layer.size.width * canvas.width)
  const height = Math.round(layer.size.height * canvas.height)
  const anchorX = Math.round(layer.position.x * canvas.width)
  const anchorY = Math.round(layer.position.y * canvas.height)

  if (layer.position.anchor === 'top_right') {
    return clampLayerBounds({ x: anchorX - width, y: anchorY, width, height, anchor: layer.position.anchor }, canvas)
  }
  if (layer.position.anchor === 'bottom_left') {
    return clampLayerBounds({ x: anchorX, y: anchorY - height, width, height, anchor: layer.position.anchor }, canvas)
  }
  if (layer.position.anchor === 'bottom_right') {
    return clampLayerBounds({ x: anchorX - width, y: anchorY - height, width, height, anchor: layer.position.anchor }, canvas)
  }
  if (layer.position.anchor === 'center') {
    return clampLayerBounds({
      x: Math.round(anchorX - width / 2),
      y: Math.round(anchorY - height / 2),
      width,
      height,
      anchor: layer.position.anchor,
    }, canvas)
  }
  return clampLayerBounds({ x: anchorX, y: anchorY, width, height, anchor: layer.position.anchor }, canvas)
}

function toPreviewLayer(
  layer: CreativeCompositionLayer,
  canvas: CreativeCompositionPreview['canvas'],
  backgroundImageUrlOverride?: string | null,
): CreativeCompositionPreviewLayer {
  const content = { ...layer.content }
  if (layer.role === 'background' && backgroundImageUrlOverride) {
    content.imageUrl = backgroundImageUrlOverride
  }

  return {
    id: layer.id,
    role: layer.role,
    type: layer.type,
    editable: layer.editable,
    required: layer.required,
    content,
    contentSource: layer.contentSource,
    position: layer.position,
    size: layer.size,
    safeZoneCompliant: layer.safeZoneCompliant,
    validationMessages: [...layer.validationMessages],
    render: layer.role === 'logo_or_brand_name' && Boolean(content.text)
      ? expandBrandFallbackBounds(absoluteLayerBounds(layer, canvas), canvas)
      : absoluteLayerBounds(layer, canvas),
  }
}

function textFontSize(layer: CreativeCompositionPreviewLayer): number {
  if (layer.role === 'headline') return Math.max(28, Math.min(46, Math.round(layer.render.height * 0.28)))
  if (layer.role === 'subheading') return Math.max(18, Math.min(28, Math.round(layer.render.height * 0.22)))
  if (layer.role === 'cta') return Math.max(22, Math.min(30, Math.round(layer.render.height * 0.3)))
  if (layer.role === 'logo_or_brand_name') return Math.max(18, Math.min(24, Math.round(layer.render.height * 0.22)))
  return Math.max(18, Math.min(26, Math.round(layer.render.height * 0.28)))
}

function maxTextLines(layer: CreativeCompositionPreviewLayer): number {
  if (layer.role === 'headline') return 2
  if (layer.role === 'subheading') return 2
  return 1
}

function truncateText(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value
  if (maxChars <= 1) return '…'
  return `${value.slice(0, maxChars - 1).trim()}…`
}

function appendEllipsis(value: string, maxChars: number): string {
  if (value.endsWith('…')) return value
  if (value.length >= maxChars) return truncateText(value, maxChars)
  return `${value.trim()}…`
}

function wrapTextToLayer(
  text: string,
  layer: CreativeCompositionPreviewLayer,
  fontSize: number,
  padding: number,
): string[] {
  const availableWidth = Math.max(24, layer.render.width - padding * 2)
  const isArabic = layer.content.language === 'ar' || /[\u0600-\u06FF]/.test(text)
  const approximateGlyphWidth = fontSize * (isArabic ? 0.72 : 0.58)
  const maxCharsPerLine = Math.max(8, Math.floor(availableWidth / approximateGlyphWidth))
  const maxLines = maxTextLines(layer)
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length <= maxCharsPerLine) {
      current = next
      continue
    }

    if (current) lines.push(current)
    current = word.length > maxCharsPerLine ? truncateText(word, maxCharsPerLine) : word
    if (lines.length === maxLines) break
  }

  if (lines.length < maxLines && current) lines.push(current)
  if (!lines.length) lines.push(truncateText(text, maxCharsPerLine))

  const totalRawChars = words.join(' ').length
  const renderedChars = lines.join(' ').replace(/…/g, '').length
  if (totalRawChars > renderedChars && lines.length) {
    lines[lines.length - 1] = appendEllipsis(lines[lines.length - 1], maxCharsPerLine)
  }

  return lines.slice(0, maxLines)
}

function estimatedTextWidth(lines: string[], fontSize: number, padding: number, layerWidth: number): number {
  const longestLine = lines.reduce((max, line) => Math.max(max, line.length), 0)
  return Math.min(layerWidth, Math.max(48, Math.round(longestLine * fontSize * 0.62 + padding * 2)))
}

function renderTextLayer(layer: CreativeCompositionPreviewLayer): string {
  const text = layer.content.text
  if (!text) return ''

  const padding = Math.max(10, Math.min(18, Math.round(layer.render.height * 0.12)))
  const fontSize = textFontSize(layer)
  const lineHeight = Math.round(fontSize * 1.18)
  const lines = wrapTextToLayer(text, layer, fontSize, padding)
  const isArabic = layer.content.language === 'ar' || /[\u0600-\u06FF]/.test(text)
  const textAnchor = isArabic ? 'end' : 'start'
  const direction = isArabic ? 'rtl' : 'ltr'
  const fill = layer.role === 'cta' ? '#0f172a' : '#f8fafc'
  const backgroundFill = layer.role === 'cta' ? '#f8fafc' : '#0f172a'
  const backgroundOpacity = layer.role === 'cta' ? '0.92' : '0.62'
  const panelWidth = estimatedTextWidth(lines, fontSize, padding, layer.render.width)
  const panelHeight = Math.min(layer.render.height, padding * 2 + lineHeight * lines.length)
  const panelX = isArabic ? layer.render.x + layer.render.width - panelWidth : layer.render.x
  const panelY = clamp(layer.render.y, 0, Math.max(0, layer.render.y + layer.render.height - panelHeight))
  const textX = isArabic ? panelX + panelWidth - padding : panelX + padding
  const firstTextY = panelY + padding + fontSize

  return [
    `<rect data-preview-layer-panel="${escapeAttribute(layer.role)}" x="${panelX}" y="${panelY}" width="${panelWidth}" height="${panelHeight}" rx="14" fill="${backgroundFill}" opacity="${backgroundOpacity}" />`,
    `<text x="${textX}" y="${firstTextY}" direction="${direction}" text-anchor="${textAnchor}" font-family="Inter, Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="${fill}">`,
    ...lines.map((line, index) => (
      `<tspan x="${textX}" dy="${index === 0 ? 0 : lineHeight}">${escapeText(line)}</tspan>`
    )),
    '</text>',
  ].join('')
}

function renderImageLayer(layer: CreativeCompositionPreviewLayer): string {
  const url = layer.content.imageUrl
  if (!url) return ''
  const preserveAspectRatio = layer.role === 'background' ? 'xMidYMid slice' : 'xMidYMid meet'

  return `<image href="${escapeAttribute(url)}" x="${layer.render.x}" y="${layer.render.y}" width="${layer.render.width}" height="${layer.render.height}" preserveAspectRatio="${preserveAspectRatio}" />`
}

function renderShapeLayer(layer: CreativeCompositionPreviewLayer): string {
  const color = layer.content.color || '#334155'
  return `<rect x="${layer.render.x}" y="${layer.render.y}" width="${layer.render.width}" height="${layer.render.height}" fill="${escapeAttribute(color)}" />`
}

function renderLayer(layer: CreativeCompositionPreviewLayer, includeLayerOutlines: boolean): string {
  let markup = ''
  if (layer.content.renderMode === 'background_image' || layer.content.renderMode === 'image_asset') {
    markup = renderImageLayer(layer)
  } else if (layer.content.renderMode === 'shape') {
    markup = renderShapeLayer(layer)
  } else if (layer.content.text) {
    markup = renderTextLayer(layer)
  }

  if (!includeLayerOutlines) return markup

  const stroke = layer.safeZoneCompliant ? '#22c55e' : '#ef4444'
  return `${markup}<rect data-preview-layer-guide="${escapeAttribute(layer.role)}" x="${layer.render.x}" y="${layer.render.y}" width="${layer.render.width}" height="${layer.render.height}" fill="none" stroke="${stroke}" stroke-width="2" stroke-opacity="0.55" stroke-dasharray="8 8" />`
}

function renderSvg(
  preview: Omit<CreativeCompositionPreview, 'artifact' | 'validations'>,
  includeLayerOutlines: boolean,
): string {
  const layers = preview.layers.map(layer => renderLayer(layer, includeLayerOutlines)).join('')
  const title = `Draft composition preview for ${preview.postId}`

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${preview.canvas.width}" height="${preview.canvas.height}" viewBox="0 0 ${preview.canvas.width} ${preview.canvas.height}" role="img" aria-label="${escapeAttribute(title)}">`,
    `<title>${escapeText(title)}</title>`,
    '<desc>Transient draft composition preview for review only. Not final ad creative and not attached to a SocialPost.</desc>',
    `<rect width="${preview.canvas.width}" height="${preview.canvas.height}" fill="#0f172a" />`,
    layers,
    '</svg>',
  ].join('')
}

function result(
  id: string,
  passed: boolean,
  severity: CreativeCompositionPreviewValidation['severity'],
  message: string,
): CreativeCompositionPreviewValidation {
  return { id, passed, severity, message }
}

export function validateCreativeCompositionPreview(
  preview: CreativeCompositionPreview,
): CreativeCompositionPreviewValidation[] {
  const headlineLayer = preview.layers.find(layer => layer.role === 'headline')
  const ctaLayer = preview.layers.find(layer => layer.role === 'cta')
  const logoOrFallbackLayer = preview.layers.find(layer => layer.role === 'logo_or_brand_name')
  const requiredOutOfZone = preview.layers.filter(layer => layer.required && !layer.safeZoneCompliant)
  const arabicTextLayers = preview.layers.filter(layer => /[\u0600-\u06FF]/.test(layer.content.text || ''))
  const serializedKeys = Object.keys(preview).join(' ')
  const labelsAndContent = [
    preview.outputClassification,
    preview.reviewStatus,
    preview.artifact.mimeType,
    ...preview.layers.flatMap(layer => [
      layer.content.text || '',
      ...layer.validationMessages,
    ]),
  ].join(' ')
  const claimText = labelsAndContent
    .split(/\s{2,}|\n/)
    .filter(Boolean)
    .filter(value => FINAL_CLAIM_PATTERN.test(value))

  return [
    result(
      'draft_composition_preview_classification',
      preview.outputClassification === 'draft_composition_preview' && preview.reviewStatus === 'preview_for_review',
      'required',
      'Preview must be classified as draft composition preview for review only.',
    ),
    result(
      'transient_svg_artifact',
      preview.artifact.type === 'svg_string'
        && preview.artifact.mimeType === 'image/svg+xml'
        && preview.artifact.persisted === false
        && preview.artifact.uploaded === false,
      'required',
      'Preview artifact must be a transient SVG string that is not persisted or uploaded.',
    ),
    result(
      'content_hub_explicit_attach_policy',
      preview.attachPolicy.autoAttach === false
        && preview.attachPolicy.attachRequiresExplicitUserAction === true
        && preview.attachPolicy.attachSurface === 'content_hub',
      'required',
      'Preview cannot auto-attach and requires a future explicit Content Hub action.',
    ),
    result(
      'no_execution_fields',
      !/\b(publish|schedule|autopilot|paidLaunch|paid)\b/.test(serializedKeys),
      'required',
      'Preview contract must not expose action-enabling publish, schedule, Autopilot, or paid launch fields.',
    ),
    result(
      'editable_headline_layer',
      Boolean(headlineLayer?.editable && headlineLayer.content.renderMode === 'composited_text'),
      'required',
      'Headline must remain editable composited metadata.',
    ),
    result(
      'editable_cta_layer_when_present',
      !ctaLayer || Boolean(ctaLayer.editable && ctaLayer.content.renderMode === 'composited_text'),
      'recommended',
      'CTA must remain editable composited metadata when present.',
    ),
    result(
      'logo_or_brand_name_fallback',
      Boolean(logoOrFallbackLayer?.content.imageUrl || logoOrFallbackLayer?.content.text),
      'required',
      'Preview needs a logo image layer or editable brand-name fallback.',
    ),
    result(
      'arabic_text_remains_editable_metadata',
      arabicTextLayers.every(layer => layer.editable && layer.content.renderMode === 'composited_text' && layer.content.aiRenderedText === false),
      'required',
      'Arabic text must remain editable layer content, not AI-rendered image text.',
    ),
    result(
      'required_layers_inside_safe_zones',
      requiredOutOfZone.length === 0,
      'required',
      requiredOutOfZone.length
        ? `Required layers outside safe zones: ${requiredOutOfZone.map(layer => layer.id).join(', ')}.`
        : 'All required preview layers are inside safe zones.',
    ),
    result(
      'no_final_ad_claims',
      claimText.length === 0,
      'required',
      claimText.length
        ? `Preview contains final/execution wording: ${claimText.join(' | ')}.`
        : 'Preview does not claim final ad creative, publishing, scheduling, paid launch, or Brand Brain learning.',
    ),
    result(
      'does_not_mutate_social_post',
      preview.safety.doesNotMutateSocialPost === true,
      'required',
      'Preview helper does not mutate SocialPost media state.',
    ),
  ]
}

export function deriveCreativeCompositionPreview(
  input: CreativeCompositionPreviewInput,
): CreativeCompositionPreview {
  const previewBase: Omit<CreativeCompositionPreview, 'artifact' | 'validations'> = {
    previewId: previewId(input.plan),
    planId: input.plan.planId,
    postId: input.plan.postId,
    templateId: input.plan.templateId,
    outputClassification: 'draft_composition_preview',
    reviewStatus: 'preview_for_review',
    canvas: {
      width: input.plan.canvas.width,
      height: input.plan.canvas.height,
      aspectRatio: input.plan.aspectRatio,
    },
    layers: input.plan.layers.map(layer => toPreviewLayer(
      layer,
      {
        width: input.plan.canvas.width,
        height: input.plan.canvas.height,
        aspectRatio: input.plan.aspectRatio,
      },
      input.backgroundImageUrlOverride,
    )),
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
      doesNotMutateSocialPost: true,
    },
  }
  const svg = renderSvg(previewBase, Boolean(input.options?.includeLayerOutlines))
  const preview: CreativeCompositionPreview = {
    ...previewBase,
    artifact: {
      type: 'svg_string',
      svg,
      mimeType: 'image/svg+xml',
      persisted: false,
      uploaded: false,
    },
    validations: [],
  }

  return {
    ...preview,
    validations: validateCreativeCompositionPreview(preview),
  }
}

export function assertCompositionPlanForPreview(plan: CreativeCompositionPlan): plan is CreativeCompositionPlan & {
  status: CompositionPlanStatus
  outputClassification: 'draft_composition_plan'
} {
  return plan.status === 'composition_plan_for_review'
    && plan.outputClassification === 'draft_composition_plan'
    && plan.attachPolicy.autoAttach === false
    && plan.attachPolicy.attachRequiresExplicitUserAction === true
}
