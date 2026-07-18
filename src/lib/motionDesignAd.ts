import { readMediaIntelligence } from '@/lib/creativeIntelligence'

// Six seconds is a native paid-media bumper length and lets NEXUS stretch only
// the verified opening three seconds of a source. This avoids looping into an
// unrelated later scene or using a provider-generated filler shot.
export const MOTION_DESIGN_DURATION_SECONDS = 6
export const MOTION_DESIGN_SAFE_SOURCE_SECONDS = 3
// Creative Intelligence intentionally scores conservatively. A clean 1080p
// master with no flagged defects is paid-ready at 85+, while lower-resolution
// sources still need 90+. The final rendered ad must independently pass the
// stricter multi-frame paid-social quality gate before any credit is settled.
export const MOTION_DESIGN_SOURCE_QUALITY_MIN = 85
export const MOTION_DESIGN_SOURCE_QUALITY_PREFERRED = 90
export const MOTION_DESIGN_SOURCE_PREMIUM_SHORT_EDGE = 1080

export type MotionDesignAssetInput = {
  id: string
  fileName?: string | null
  type?: string | null
  url?: string | null
  cloudinaryId?: string | null
  width?: number | null
  height?: number | null
  duration?: number | null
  category?: string | null
  tags?: string[] | null
  intelligenceStatus?: string | null
  intelligence?: unknown
}

export type MotionDesignPreflightIssue = {
  code:
    | 'VIDEO_REQUIRED'
    | 'CLOUDINARY_SOURCE_REQUIRED'
    | 'ANALYSIS_REQUIRED'
    | 'SCREEN_OR_DEMO_REQUIRED'
    | 'RESOLUTION_REQUIRED'
    | 'DURATION_REQUIRED'
    | 'QUALITY_TOO_LOW'
    | 'LANGUAGE_MISMATCH'
    | 'DERIVATIVE_SOURCE_BLOCKED'
  message: string
}

export type MotionDesignPreflightResult = {
  eligible: boolean
  route: 'SOURCE_LOCKED_MOTION_DESIGN' | 'BLOCKED'
  issues: MotionDesignPreflightIssue[]
  qualityScore: number | null
  sourceKind: string | null
}

export type MotionDesignCopy = {
  brandLabel: string
  hook: string
}

const DERIVATIVE_PATTERN = /motion[-_ ]design|source[-_ ]locked/i

function primaryTextLanguage(value: string | null | undefined): 'AR' | 'EN' | 'MIXED' | 'NONE' {
  const text = String(value || '')
  const hasArabic = /\p{Script=Arabic}/u.test(text)
  const hasLatin = /[A-Za-z]/.test(text.replace(/https?:\/\/\S+|#[\p{L}\p{N}_-]+/gu, ''))
  if (hasArabic && hasLatin) return 'MIXED'
  if (hasArabic) return 'AR'
  if (hasLatin) return 'EN'
  return 'NONE'
}

function cleanText(value: unknown, max: number): string {
  return typeof value === 'string'
    ? value
      .normalize('NFKC')
      .replace(/https?:\/\/\S+/gi, '')
      .replace(/#[\p{L}\p{N}_-]+/gu, '')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/[,/%\\]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max)
    : ''
}

function firstClause(value: string): string {
  const sentence = value.split(/[.!?؟]/u)[0]?.trim() || value.trim()
  const clause = sentence.split(/\s+(?:with|while|and see|so that|because)\s+/i)[0]?.trim() || sentence
  if (/\p{Script=Arabic}/u.test(clause)) {
    return clause.split(/\s+/).slice(0, 6).join(' ').slice(0, 42).trim()
  }
  const words = clause.split(/\s+/).filter(Boolean).slice(0, 4)
  while (words.length > 1 && /^(?:and|or|with|for|to|the)$/i.test(words.at(-1) || '')) {
    words.pop()
  }
  return words.join(' ').slice(0, 34).trim()
}

/**
 * Fail-closed preflight for the low-cost deterministic route. Physical product
 * photos belong to the cinematic route; recursively rendering an existing
 * motion-design derivative is blocked so overlays and compression never stack.
 */
export function assessMotionDesignVideoAsset(
  asset: MotionDesignAssetInput | null | undefined,
  campaignText?: string | null,
): MotionDesignPreflightResult {
  const issues: MotionDesignPreflightIssue[] = []
  if (!asset || String(asset.type).toUpperCase() !== 'VIDEO') {
    issues.push({ code: 'VIDEO_REQUIRED', message: 'Choose one analysed user-owned screen or demo video.' })
    return { eligible: false, route: 'BLOCKED', issues, qualityScore: null, sourceKind: null }
  }

  if (
    !asset.url?.startsWith('https://res.cloudinary.com/')
    || !asset.url.includes('/video/upload/')
    || !asset.cloudinaryId?.trim()
  ) {
    issues.push({ code: 'CLOUDINARY_SOURCE_REQUIRED', message: 'The source must be a durable Cloudinary video in this workspace.' })
  }

  const derivativeEvidence = [asset.category || '', ...(asset.tags || [])].join(' ')
  if (DERIVATIVE_PATTERN.test(derivativeEvidence)) {
    issues.push({ code: 'DERIVATIVE_SOURCE_BLOCKED', message: 'Choose the original uploaded clip, not a previous motion-design derivative.' })
  }

  const intelligence = asset.intelligenceStatus === 'READY'
    ? readMediaIntelligence(asset.intelligence)
    : null
  if (!intelligence) {
    issues.push({ code: 'ANALYSIS_REQUIRED', message: 'Run Media Intelligence on this video before paid motion design.' })
  }

  const sourceKind = intelligence?.assetKind ?? null
  if (intelligence && !['SCREEN', 'DEMO'].includes(intelligence.assetKind)) {
    issues.push({ code: 'SCREEN_OR_DEMO_REQUIRED', message: 'Motion Design accepts verified screen recordings and product demos; use the cinematic route for physical products.' })
  }

  const width = Math.max(0, Number(asset.width || 0))
  const height = Math.max(0, Number(asset.height || 0))
  if (Math.min(width, height) < 720) {
    issues.push({ code: 'RESOLUTION_REQUIRED', message: 'The source needs at least a 720px short edge.' })
  }

  const duration = Math.max(0, Number(asset.duration || 0))
  if (duration < 4) {
    issues.push({ code: 'DURATION_REQUIRED', message: 'The source must contain at least four seconds so NEXUS can verify a stable six-second bumper master.' })
  }

  const qualityScore = intelligence?.qualityScore ?? null
  const qualityIssues = intelligence?.qualityIssues ?? []
  const cleanFullHdException = qualityScore != null
    && qualityScore >= MOTION_DESIGN_SOURCE_QUALITY_MIN
    && Math.min(width, height) >= MOTION_DESIGN_SOURCE_PREMIUM_SHORT_EDGE
    && qualityIssues.length === 0
  const qualityQualified = qualityScore != null
    && (qualityScore >= MOTION_DESIGN_SOURCE_QUALITY_PREFERRED || cleanFullHdException)
  if (qualityScore != null && !qualityQualified) {
    issues.push({
      code: 'QUALITY_TOO_LOW',
      message: `The source scored ${qualityScore}/100. Paid Motion Design requires ${MOTION_DESIGN_SOURCE_QUALITY_PREFERRED}/100, or ${MOTION_DESIGN_SOURCE_QUALITY_MIN}–${MOTION_DESIGN_SOURCE_QUALITY_PREFERRED - 1}/100 with a 1080px short edge and zero flagged quality issues.`,
    })
  }

  const campaignLanguage = primaryTextLanguage(campaignText)
  const sourceLanguage = intelligence?.language ?? 'NONE'
  if (
    ['AR', 'EN'].includes(campaignLanguage)
    && ['AR', 'EN'].includes(sourceLanguage)
    && campaignLanguage !== sourceLanguage
  ) {
    issues.push({
      code: 'LANGUAGE_MISMATCH',
      message: `The source creative is ${sourceLanguage}, while this post is ${campaignLanguage}. Adapt the post or choose a matching source before paid production.`,
    })
  }

  return {
    eligible: issues.length === 0,
    route: issues.length === 0 ? 'SOURCE_LOCKED_MOTION_DESIGN' : 'BLOCKED',
    issues,
    qualityScore,
    sourceKind,
  }
}

export function buildMotionDesignCopy(input: {
  brandName?: string | null
  campaignName?: string | null
  caption?: string | null
}): MotionDesignCopy {
  const brandLabel = cleanText(input.brandName || input.campaignName || 'NEXUS', 28) || 'NEXUS'
  const caption = cleanText(input.caption, 180)
  const hook = firstClause(caption) || brandLabel
  return { brandLabel, hook }
}

export function cloudinarySourceReviewFrames(sourceUrl: string): string[] {
  if (!sourceUrl.startsWith('https://res.cloudinary.com/') || !sourceUrl.includes('/video/upload/')) {
    throw new Error('Motion-design QA requires a durable Cloudinary source')
  }
  const jpegUrl = sourceUrl.replace(/\.[a-z0-9]+(?:\?.*)?$/i, '.jpg')
  return [0, 1.5, 3].map(second => jpegUrl.replace(
    '/video/upload/',
    `/video/upload/so_${second},f_jpg,q_auto/`,
  ))
}
