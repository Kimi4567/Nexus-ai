import { readMediaIntelligence } from '@/lib/creativeIntelligence'

export const PROPERTY_PHOTO_FILM_DURATION_SECONDS = 10
export const PROPERTY_PHOTO_FILM_MIN_REFERENCES = 3
export const PROPERTY_PHOTO_FILM_MAX_REFERENCES = 6
export const PROPERTY_PHOTO_FILM_VERSION = '2026-07-source-locked-property-1'

export type PropertyPhotoFilmAssetInput = {
  id: string
  fileName?: string | null
  type?: string | null
  url?: string | null
  width?: number | null
  height?: number | null
  intelligenceStatus?: string | null
  intelligence?: unknown
}

export type PropertyPhotoFilmPreflightIssue = {
  code:
    | 'REFERENCE_COUNT'
    | 'DUPLICATE_REFERENCE'
    | 'IMAGE_REQUIRED'
    | 'CLOUDINARY_SOURCE_REQUIRED'
    | 'ANALYSIS_REQUIRED'
    | 'PROPERTY_REFERENCE_REQUIRED'
    | 'RESOLUTION_REQUIRED'
    | 'QUALITY_TOO_LOW'
    | 'UNSAFE_SOURCE_GRAPHICS'
  mediaId?: string
  message: string
}

export type PropertyPhotoFilmPreflightResult = {
  eligible: boolean
  route: 'SOURCE_LOCKED_PROPERTY_PHOTO_FILM' | 'BLOCKED'
  issues: PropertyPhotoFilmPreflightIssue[]
  warnings: string[]
  qualifiedAssetIds: string[]
}

export type PropertyPhotoFilmCopy = {
  brand: string
  eyebrow: string
  hook: string
  detail: string
  cta: string
  disclosure: string | null
  language: 'ar' | 'en'
}

export type PropertyCopyGroundingResult = {
  ok: boolean
  unsupportedClaims: string[]
}

const PROPERTY_EVIDENCE = /\b(?:apartment|architecture|balcony|bathroom|bedroom|building|condo|exterior|facade|garden|home|house|interior|kitchen|living room|lobby|office|patio|pool|property|residence|residential|room|terrace|villa)\b|(?:عقار|عقاري|شقة|فيلا|منزل|بيت|غرفة|مطبخ|مجلس|صالة|واجهة|مبنى|حديقة|مسبح|تراس|شرفة|تصميم داخلي)/iu
const UNSAFE_GRAPHICS = /watermark|overlaid?\s+text|text\s+overlay|screenshot|screen\s*capture|علامة\s+مائية|نص\s+متراكب|لقطة\s+شاشة/iu
const DEMO_DISCLOSURE = /\b(?:demo|sample|concept|not a live listing)\b|(?:تجريبي|نموذج|تصور|ليس إعلان بيع فعلي)/iu

const HIGH_RISK_PROPERTY_CLAIMS: RegExp[] = [
  /\b(?:AED|USD|EUR|GBP)\s*[\d,.]+|[\d,.]+\s*(?:AED|USD|EUR|GBP)\b|(?:درهم|دولار|يورو|جنيه)\s*[\d,.]+|[\d,.]+\s*(?:درهم|دولار|يورو|جنيه)/iu,
  /\b\d+(?:\.\d+)?\s*(?:bed(?:room)?s?|bath(?:room)?s?|br|sq\.?\s*ft|sqft|square feet|sqm|m²|square metres?|square meters?)\b|(?:غرف?|غرفة نوم|حمام|متر مربع|قدم مربع)\s*\d+/iu,
  /\b(?:ROI|yield|return|capital appreciation|guaranteed return|handover|off[- ]?plan|ready to move|available now|for sale|for rent)\b|(?:عائد استثماري|عائد مضمون|تسليم|على المخطط|جاهز للسكن|متاح الآن|للبيع|للإيجار)/iu,
  /\b(?:located in|minutes? (?:from|to)|steps? from|overlooking|sea view|marina view|burj khalifa view|private beach|private pool)\b|(?:يقع في|دقائق من|على بعد|إطلالة|شاطئ خاص|مسبح خاص)/iu,
]

function clean(value: unknown, max: number): string {
  return typeof value === 'string'
    ? value
      .normalize('NFKC')
      .replace(/https?:\/\/\S+/giu, '')
      .replace(/#[\p{L}\p{N}_-]+/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max)
    : ''
}

function normalizedEvidence(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function sentenceParts(value: string): string[] {
  return value
    .split(/(?<=[.!?؟])\s+|[\r\n]+/u)
    .map(part => clean(part, 220))
    .filter(Boolean)
}

function compactAtBoundary(value: string, max: number): string {
  const text = clean(value, max + 24)
  if (text.length <= max) return text
  const candidate = text.slice(0, max + 1)
  const boundary = candidate.lastIndexOf(' ')
  return candidate.slice(0, boundary >= Math.floor(max * 0.65) ? boundary : max).trim()
}

export function assessPropertyPhotoFilmAssets(
  input: PropertyPhotoFilmAssetInput[],
): PropertyPhotoFilmPreflightResult {
  const issues: PropertyPhotoFilmPreflightIssue[] = []
  const warnings: string[] = []
  const assets = input.slice(0, PROPERTY_PHOTO_FILM_MAX_REFERENCES + 1)
  const uniqueIds = new Set(assets.map(asset => asset.id))

  if (input.length < PROPERTY_PHOTO_FILM_MIN_REFERENCES || input.length > PROPERTY_PHOTO_FILM_MAX_REFERENCES) {
    issues.push({
      code: 'REFERENCE_COUNT',
      message: `Choose ${PROPERTY_PHOTO_FILM_MIN_REFERENCES}–${PROPERTY_PHOTO_FILM_MAX_REFERENCES} analysed photographs of the same property.`,
    })
  }
  if (uniqueIds.size !== assets.length) {
    issues.push({ code: 'DUPLICATE_REFERENCE', message: 'Each property view must be a different media asset.' })
  }

  const qualifiedAssetIds: string[] = []
  for (const asset of assets) {
    if (String(asset.type).toUpperCase() !== 'IMAGE') {
      issues.push({ code: 'IMAGE_REQUIRED', mediaId: asset.id, message: `${asset.fileName || 'Reference'} must be a still property photograph.` })
      continue
    }
    if (
      !asset.url?.startsWith('https://res.cloudinary.com/')
      || !asset.url.includes('/image/upload/')
    ) {
      issues.push({
        code: 'CLOUDINARY_SOURCE_REQUIRED',
        mediaId: asset.id,
        message: `${asset.fileName || 'Reference'} must be a durable image stored in this workspace.`,
      })
      continue
    }

    const analysis = asset.intelligenceStatus === 'READY'
      ? readMediaIntelligence(asset.intelligence)
      : null
    if (!analysis) {
      issues.push({ code: 'ANALYSIS_REQUIRED', mediaId: asset.id, message: `${asset.fileName || 'Reference'} must pass Media Intelligence first.` })
      continue
    }
    const visibleEvidence = [
      analysis.visibleSummary,
      ...analysis.visibleObjects,
      ...analysis.safeThemes,
      ...analysis.possibleUseCases,
    ].join(' ')
    if (
      analysis.assetKind !== 'PROPERTY'
      && !(analysis.assetKind === 'LIFESTYLE' && PROPERTY_EVIDENCE.test(visibleEvidence))
      && !(analysis.assetKind === 'OTHER' && PROPERTY_EVIDENCE.test(visibleEvidence))
    ) {
      issues.push({
        code: 'PROPERTY_REFERENCE_REQUIRED',
        mediaId: asset.id,
        message: `${asset.fileName || 'Reference'} is not verified as property photography.`,
      })
      continue
    }

    const width = Math.max(0, Number(asset.width || 0))
    const height = Math.max(0, Number(asset.height || 0))
    if (Math.min(width, height) < 720 || Math.max(width, height) < 1024) {
      issues.push({
        code: 'RESOLUTION_REQUIRED',
        mediaId: asset.id,
        message: `${asset.fileName || 'Reference'} needs at least a 720px short edge and a 1024px long edge.`,
      })
      continue
    }
    if (analysis.qualityScore < 70) {
      issues.push({
        code: 'QUALITY_TOO_LOW',
        mediaId: asset.id,
        message: `${asset.fileName || 'Reference'} scored ${analysis.qualityScore}/100; 70/100 is required.`,
      })
      continue
    }

    const sourceRisks = [
      ...analysis.qualityIssues,
      ...analysis.evidenceLimits,
      ...analysis.visibleText,
    ]
    if (sourceRisks.some(item => UNSAFE_GRAPHICS.test(item))) {
      issues.push({
        code: 'UNSAFE_SOURCE_GRAPHICS',
        mediaId: asset.id,
        message: `${asset.fileName || 'Reference'} contains a watermark, screen capture, or source text that is unsafe for a professional property film.`,
      })
      continue
    }
    if (analysis.visibleText.length > 0) {
      warnings.push(`${asset.fileName || 'Reference'} contains visible environmental text; the final review must preserve it exactly.`)
    }
    qualifiedAssetIds.push(asset.id)
  }

  const eligible = issues.length === 0
    && qualifiedAssetIds.length >= PROPERTY_PHOTO_FILM_MIN_REFERENCES
  return {
    eligible,
    route: eligible ? 'SOURCE_LOCKED_PROPERTY_PHOTO_FILM' : 'BLOCKED',
    issues,
    warnings: Array.from(new Set(warnings)),
    qualifiedAssetIds,
  }
}

/**
 * Listing facts are higher risk than ordinary brand copy. A price, room count,
 * area, location, availability, investment result, or named amenity must be
 * present verbatim in source-linked verified proof. Photographs alone do not
 * establish those facts.
 */
export function reviewPropertyPhotoFilmCopy(input: {
  caption?: string | null
  verifiedFacts?: string[] | null
}): PropertyCopyGroundingResult {
  const caption = clean(input.caption, 2_200)
  const evidence = (input.verifiedFacts ?? [])
    .map(value => normalizedEvidence(value))
    .filter(Boolean)
  const unsupportedClaims = sentenceParts(caption).filter((sentence) => {
    if (!HIGH_RISK_PROPERTY_CLAIMS.some(pattern => pattern.test(sentence))) return false
    const normalizedClaim = normalizedEvidence(sentence)
    return !evidence.some(fact => fact.includes(normalizedClaim))
  })
  return { ok: unsupportedClaims.length === 0, unsupportedClaims }
}

export function buildPropertyPhotoFilmCopy(input: {
  brandName?: unknown
  campaignName?: unknown
  caption?: unknown
}): PropertyPhotoFilmCopy {
  const caption = clean(input.caption, 1_200)
  const language: 'ar' | 'en' = /\p{Script=Arabic}/u.test(caption) ? 'ar' : 'en'
  const sentences = sentenceParts(caption)
    .filter(sentence => !DEMO_DISCLOSURE.test(sentence))
  const brand = compactAtBoundary(
    clean(input.brandName, 52) || clean(input.campaignName, 52) || (language === 'ar' ? 'عرض عقاري' : 'Property showcase'),
    44,
  )
  const hook = compactAtBoundary(
    sentences[0] || (language === 'ar' ? 'شاهد العقار كما هو' : 'See the property as it is'),
    language === 'ar' ? 40 : 48,
  )
  const detail = compactAtBoundary(
    sentences[1] || (language === 'ar' ? 'جولة بصرية من الصور المختارة' : 'A visual tour from selected photography'),
    language === 'ar' ? 54 : 64,
  )
  const cta = compactAtBoundary(
    sentences.at(-1) && sentences.at(-1) !== sentences[0] && sentences.at(-1) !== sentences[1]
      ? sentences.at(-1)!
      : (language === 'ar' ? 'اطلب التفاصيل الموثقة' : 'Request verified details'),
    language === 'ar' ? 34 : 38,
  )
  const isDemo = DEMO_DISCLOSURE.test(caption)

  return {
    brand,
    eyebrow: language === 'ar' ? 'جولة عقارية' : 'PROPERTY TOUR',
    hook,
    detail,
    cta,
    disclosure: isDemo
      ? (language === 'ar' ? 'نموذج تجريبي • ليس إعلان بيع فعلي' : 'DEMO • NOT A LIVE LISTING')
      : null,
    language,
  }
}
