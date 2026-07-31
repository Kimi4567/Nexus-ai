import type { MotionDesignCopy } from '@/lib/motionDesignAd'

export const PROFESSIONAL_VIDEO_TIMELINE_VERSION = '2026-07-v4'
export const PROFESSIONAL_VIDEO_FRAME_RATE = 24
export const PROFESSIONAL_VIDEO_DURATION_SECONDS = 6
export const PROFESSIONAL_VIDEO_SAFE_SOURCE_SECONDS = 3

export type ProfessionalVideoTemplate =
  | 'OFFER_REVEAL'
  | 'SERVICE_PROMISE'
  | 'BRAND_STORY'

export type ProfessionalVideoTransition = {
  type: 'SMOOTH_LEFT' | 'FADE_FAST'
  durationSeconds: number
}

export type ProfessionalVideoScene = {
  id: 'HOOK' | 'PROOF' | 'CTA'
  startSeconds: number
  durationSeconds: number
  sourceOffsetSeconds: number
  sourceEffect: 'PUNCH_OUT' | 'EDITORIAL_DRIFT' | 'CTA_PUSH'
  overlay: 'HOOK' | 'PROOF' | 'CTA'
  transitionOut: ProfessionalVideoTransition | null
}

export type ProfessionalVideoCopy = {
  brand: string
  eyebrow: string
  headline: string
  supporting: string | null
  cta: string
  language: 'ar' | 'en'
}

export type ProfessionalVideoPalette = {
  ink: string
  paper: string
  accent: string
}

export type ProfessionalVideoTimeline = {
  version: typeof PROFESSIONAL_VIDEO_TIMELINE_VERSION
  template: ProfessionalVideoTemplate
  durationSeconds: typeof PROFESSIONAL_VIDEO_DURATION_SECONDS
  frameRate: typeof PROFESSIONAL_VIDEO_FRAME_RATE
  safeSourceSeconds: typeof PROFESSIONAL_VIDEO_SAFE_SOURCE_SECONDS
  sourceLayout: 'FULL_BLEED' | 'BLURRED_CANVAS'
  soundDesign: {
    source: 'PROCEDURAL_ORIGINAL'
    targetLufs: -18
    truePeakDb: -2
  }
  safeZone: {
    topPercent: 7
    sidePercent: 7
    bottomPercent: 14
  }
  palette: ProfessionalVideoPalette
  copy: ProfessionalVideoCopy
  scenes: ProfessionalVideoScene[]
}

export type ProfessionalVideoTimelineIssue = {
  code:
    | 'DURATION_INVALID'
    | 'SCENE_STRUCTURE_INVALID'
    | 'SOURCE_WINDOW_INVALID'
    | 'COPY_TOO_LONG'
    | 'UNGROUNDED_COPY'
    | 'UNAPPROVED_NUMBER'
    | 'PALETTE_INVALID'
  message: string
}

const PRICE_PATTERN = /\b\d+(?:[.,]\d+)?\s*(?:درهم(?:ًا|ا)?|AED|SAR|USD|EGP|ريال(?:ًا|ا)?|دولار(?:ًا|ا)?|جنيه(?:ًا|ا)?)/iu
const DURATION_PATTERN = /\b\d+(?:[.,]\d+)?\s*(?:ساعة|ساعات|يوم|أيام|hour|hours|day|days)/iu
const ARABIC_QUANTITY_PATTERN = /(?:كيلوغرام|كيلو|غرام)\s+\S+(?:\s+شهري(?:ًا|ا))?/iu
const ENGLISH_QUANTITY_PATTERN = /\b(?:one|\d+(?:[.,]\d+)?)\s*(?:kg|kilogram|kilograms|gram|grams)(?:\s+(?:monthly|per month))?\b/iu
const DUBAI_SCOPE_PATTERN = /داخل\s+دبي\s+فقط/iu
const ENGLISH_SCOPE_PATTERN = /\b(?:within|inside)\s+Dubai\s+only\b/iu
const NEUTRAL_CTAS = new Set(['عرض التفاصيل', 'View details'])

function clean(value: unknown, max = 120): string {
  if (typeof value !== 'string') return ''
  const normalizedValue = value
    .normalize('NFKC')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/#[\p{L}\p{N}_-]+/gu, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (normalizedValue.length <= max) return normalizedValue
  const boundary = normalizedValue.slice(0, max + 1).lastIndexOf(' ')
  return normalizedValue.slice(0, boundary >= Math.floor(max * 0.55) ? boundary : max).trim()
}

function normalized(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function exactMatch(value: string, pattern: RegExp): string | null {
  return value.match(pattern)?.[0]?.trim() || null
}

function exactSupportingSentence(caption: string, excluded: string[]): string | null {
  const normalizedExcluded = excluded.map(normalized).filter(Boolean)
  const candidates = caption
    .split(/[.!?؟]+/u)
    .map(value => clean(value, 54))
    .filter(value => value.length >= 8)
    .filter(value => !PRICE_PATTERN.test(value) && !DURATION_PATTERN.test(value))
    .filter(value => {
      const candidate = normalized(value)
      return !normalizedExcluded.some(exclusion => candidate.includes(exclusion) || exclusion.includes(candidate))
    })

  return candidates[0] || null
}

function exactAudienceLead(caption: string, excluded: string[]): string | null {
  const normalizedExcluded = excluded.map(normalized).filter(Boolean)
  const firstSentence = caption.split(/[.!?؟]+/u)[0]?.trim() || ''
  const commaLead = firstSentence.split(/[,،:]+/u)[0]?.trim() || ''
  if (!commaLead || commaLead === firstSentence) return null

  const words = commaLead.split(/\s+/).filter(Boolean)
  const bounded: string[] = []
  for (const word of words) {
    const candidate = [...bounded, word].join(' ')
    if (candidate.length > 42) break
    bounded.push(word)
  }
  const lead = clean(bounded.join(' '), 42)
  const normalizedLead = normalized(lead)
  if (
    lead.length < 4
    || normalizedExcluded.some(exclusion => (
      normalizedLead.includes(exclusion)
      || exclusion.includes(normalizedLead)
    ))
  ) {
    return null
  }
  return lead
}

function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value)
}

export function resolveProfessionalVideoPalette(colors?: string[] | null): ProfessionalVideoPalette {
  const safe = (colors || []).filter(isHexColor).slice(0, 3)
  return {
    ink: safe[0] || '#17120F',
    paper: safe[1] || '#F6F0E8',
    accent: safe[2] || '#E7A85A',
  }
}

export function buildProfessionalVideoTimeline(input: {
  copy: MotionDesignCopy
  caption?: string | null
  colorPalette?: string[] | null
  sourceMatchesTarget?: boolean
  sourceLayout?: 'FULL_BLEED' | 'BLURRED_CANVAS'
}): ProfessionalVideoTimeline {
  const caption = clean(input.caption, 500)
  const price = exactMatch(caption, PRICE_PATTERN)
  const duration = exactMatch(caption, DURATION_PATTERN)
  const quantity = exactMatch(caption, ARABIC_QUANTITY_PATTERN)
    || exactMatch(caption, ENGLISH_QUANTITY_PATTERN)
  const scope = exactMatch(caption, DUBAI_SCOPE_PATTERN)
    || exactMatch(caption, ENGLISH_SCOPE_PATTERN)
  const template: ProfessionalVideoTemplate = price
    ? 'OFFER_REVEAL'
    : duration
      ? 'SERVICE_PROMISE'
      : 'BRAND_STORY'

  const headline = clean(price || duration || input.copy.hook, 42)
  const audienceLead = exactAudienceLead(caption, [headline])
  const eyebrow = clean(
    template === 'OFFER_REVEAL'
      ? quantity || input.copy.hook
      : template === 'SERVICE_PROMISE'
        ? scope || input.copy.hook
        : audienceLead || input.copy.hook,
    42,
  )
  const supporting = exactSupportingSentence(caption, [headline, eyebrow])

  return {
    version: PROFESSIONAL_VIDEO_TIMELINE_VERSION,
    template,
    durationSeconds: PROFESSIONAL_VIDEO_DURATION_SECONDS,
    frameRate: PROFESSIONAL_VIDEO_FRAME_RATE,
    safeSourceSeconds: PROFESSIONAL_VIDEO_SAFE_SOURCE_SECONDS,
    sourceLayout: input.sourceLayout
      || (input.sourceMatchesTarget ? 'FULL_BLEED' : 'BLURRED_CANVAS'),
    soundDesign: {
      source: 'PROCEDURAL_ORIGINAL',
      targetLufs: -18,
      truePeakDb: -2,
    },
    safeZone: {
      topPercent: 7,
      sidePercent: 7,
      bottomPercent: 14,
    },
    palette: resolveProfessionalVideoPalette(input.colorPalette),
    copy: {
      brand: clean(input.copy.brandLabel, 28),
      eyebrow,
      headline,
      supporting,
      cta: clean(input.copy.cta, 24),
      language: input.copy.language,
    },
    scenes: [
      {
        id: 'HOOK',
        startSeconds: 0,
        durationSeconds: 2,
        sourceOffsetSeconds: 0,
        sourceEffect: 'PUNCH_OUT',
        overlay: 'HOOK',
        transitionOut: { type: 'SMOOTH_LEFT', durationSeconds: 0.35 },
      },
      {
        id: 'PROOF',
        startSeconds: 1.65,
        durationSeconds: 2.5,
        sourceOffsetSeconds: 0.5,
        sourceEffect: 'EDITORIAL_DRIFT',
        overlay: 'PROOF',
        transitionOut: { type: 'FADE_FAST', durationSeconds: 0.35 },
      },
      {
        id: 'CTA',
        startSeconds: 3.8,
        durationSeconds: 2.2,
        sourceOffsetSeconds: 0.8,
        sourceEffect: 'CTA_PUSH',
        overlay: 'CTA',
        transitionOut: null,
      },
    ],
  }
}

export function validateProfessionalVideoTimeline(
  timeline: ProfessionalVideoTimeline,
  caption?: string | null,
): { ok: boolean; issues: ProfessionalVideoTimelineIssue[] } {
  const issues: ProfessionalVideoTimelineIssue[] = []
  const sourceText = clean(caption, 500)

  if (
    timeline.durationSeconds !== PROFESSIONAL_VIDEO_DURATION_SECONDS
    || timeline.frameRate !== PROFESSIONAL_VIDEO_FRAME_RATE
  ) {
    issues.push({
      code: 'DURATION_INVALID',
      message: 'The professional ad master must remain exactly six seconds at 24 fps.',
    })
  }

  const expectedIds = ['HOOK', 'PROOF', 'CTA']
  const exactSceneOrder = timeline.scenes.length === expectedIds.length
    && timeline.scenes.every((scene, index) => scene.id === expectedIds[index])
    && timeline.scenes[0]?.startSeconds === 0
    && timeline.scenes.at(-1)?.startSeconds === 3.8
  if (!exactSceneOrder) {
    issues.push({
      code: 'SCENE_STRUCTURE_INVALID',
      message: 'The ad needs one hook, one proof scene, and one CTA scene in that order.',
    })
  }

  if (timeline.scenes.some(scene => (
    scene.sourceOffsetSeconds < 0
    || scene.sourceOffsetSeconds + scene.durationSeconds > timeline.safeSourceSeconds + 0.001
  ))) {
    issues.push({
      code: 'SOURCE_WINDOW_INVALID',
      message: 'Every edit scene must remain inside the visually verified source window.',
    })
  }

  const copyLimits: Array<[string, number]> = [
    [timeline.copy.brand, 28],
    [timeline.copy.eyebrow, 42],
    [timeline.copy.headline, 42],
    [timeline.copy.supporting || '', 54],
    [timeline.copy.cta, 24],
  ]
  if (copyLimits.some(([value, limit]) => value.length > limit)) {
    issues.push({
      code: 'COPY_TOO_LONG',
      message: 'One or more video copy layers exceed the readability limit.',
    })
  }

  const groundedLayers = [
    timeline.copy.eyebrow,
    timeline.copy.headline,
    timeline.copy.supporting || '',
  ].filter(Boolean)
  if (sourceText && groundedLayers.some(value => !normalized(sourceText).includes(normalized(value)))) {
    issues.push({
      code: 'UNGROUNDED_COPY',
      message: 'Every commercial copy layer must be an exact excerpt of the approved caption.',
    })
  }

  if (!NEUTRAL_CTAS.has(timeline.copy.cta)) {
    issues.push({
      code: 'UNGROUNDED_COPY',
      message: 'The CTA must be neutral unless an approved destination-specific CTA exists.',
    })
  }

  const captionNumbers = new Set(sourceText.match(/\d+(?:[.,]\d+)?/g) || [])
  const copyNumbers = [
    timeline.copy.eyebrow,
    timeline.copy.headline,
    timeline.copy.supporting || '',
  ].flatMap(value => value.match(/\d+(?:[.,]\d+)?/g) || [])
  if (copyNumbers.some(value => !captionNumbers.has(value))) {
    issues.push({
      code: 'UNAPPROVED_NUMBER',
      message: 'The video cannot introduce a number that is absent from the approved caption.',
    })
  }

  if (Object.values(timeline.palette).some(color => !isHexColor(color))) {
    issues.push({
      code: 'PALETTE_INVALID',
      message: 'Video palette colors must be six-digit hexadecimal values.',
    })
  }

  return { ok: issues.length === 0, issues }
}
