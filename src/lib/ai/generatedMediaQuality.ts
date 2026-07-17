import {
  readOpenAIChatUsage,
  summarizeOpenAITextUsage,
  type ProviderUsageSummary,
} from '@/lib/ai/providerEconomics'
import type {
  PlatformImageFormat,
  PlatformImageFormatValidation,
} from '@/lib/platformImageFormat'

const QUALITY_MODEL = 'gpt-4o'

export interface GeneratedMediaQualityReview {
  version: 1
  passed: boolean
  mediaType: 'IMAGE' | 'VIDEO'
  referenceRequired: boolean
  referencePreservationScore: number | null
  semanticAlignmentScore: number
  professionalQualityScore: number
  technicalIntegrity: boolean
  formatRequired: boolean
  formatValidation: PlatformImageFormatValidation | null
  noNewRasterText: boolean
  noInventedClaims: boolean
  advertisingStructure: boolean | null
  paidSocialAdReadiness: boolean | null
  commercialHookScore: number | null
  productHeroScore: number | null
  benefitCommunicationScore: number | null
  commercialPacingScore: number | null
  endFrameReadinessScore: number | null
  brandAlignmentScore: number | null
  issues: string[]
  summary: string
  reviewedAt: string
  providerUsage: ProviderUsageSummary
}

type QualityInput = {
  mediaType: 'IMAGE' | 'VIDEO'
  outputFrames: string[]
  referenceImageUrl?: string | null
  referenceImageUrls?: string[]
  campaignMessage?: string | null
  creativeDirection?: string | null
  referenceEvidence?: unknown
  targetFormat?: PlatformImageFormat | null
  formatValidation?: PlatformImageFormatValidation | null
  requireProductAdStructure?: boolean
  /** Exact user/brand-approved text deliberately typeset by NEXUS. */
  approvedOverlayTexts?: string[]
}

function boundedText(value: unknown, max = 280): string {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, max)
    : ''
}

function boundedIssues(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value
    .map(item => boundedText(item, 180))
    .filter(Boolean)))
    .slice(0, 8)
}

function score(value: unknown): number {
  const parsed = Math.round(Number(value))
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : 0
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('NEXUS media quality review returned no result')
  }
  const cleaned = value
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()
  const parsed = JSON.parse(cleaned)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('NEXUS media quality review returned invalid JSON')
  }
  return parsed as Record<string, unknown>
}

export function normalizeGeneratedMediaQualityReview(
  value: unknown,
  input: Pick<QualityInput, 'mediaType' | 'referenceImageUrl' | 'referenceImageUrls' | 'targetFormat' | 'formatValidation' | 'requireProductAdStructure'>,
  providerUsage: ProviderUsageSummary,
): GeneratedMediaQualityReview {
  const result = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  const referenceRequired = Boolean(input.referenceImageUrl || input.referenceImageUrls?.length)
  const referencePreservationScore = referenceRequired
    ? score(result.referencePreservationScore)
    : null
  const semanticAlignmentScore = score(result.semanticAlignmentScore)
  const professionalQualityScore = score(result.professionalQualityScore)
  const technicalIntegrity = result.technicalIntegrity === true
  const noNewRasterText = result.noNewRasterText === true
  const noInventedClaims = result.noInventedClaims === true
  const advertisingStructure = input.requireProductAdStructure
    ? result.advertisingStructure === true
    : null
  const paidSocialAdReadiness = input.requireProductAdStructure
    ? result.paidSocialAdReadiness === true
    : null
  const commercialHookScore = input.requireProductAdStructure ? score(result.commercialHookScore) : null
  const productHeroScore = input.requireProductAdStructure ? score(result.productHeroScore) : null
  const benefitCommunicationScore = input.requireProductAdStructure ? score(result.benefitCommunicationScore) : null
  const commercialPacingScore = input.requireProductAdStructure ? score(result.commercialPacingScore) : null
  const endFrameReadinessScore = input.requireProductAdStructure ? score(result.endFrameReadinessScore) : null
  const brandAlignmentScore = input.requireProductAdStructure ? score(result.brandAlignmentScore) : null
  const formatRequired = Boolean(input.targetFormat)
  const formatValidation = formatRequired ? input.formatValidation ?? null : null
  const dimensionsPassed = Boolean(
    formatValidation
    && formatValidation.width === formatValidation.expectedWidth
    && formatValidation.height === formatValidation.expectedHeight,
  )
  const videoValidation = formatValidation as (PlatformImageFormatValidation & {
    durationPassed?: boolean
    durationSeconds?: number
    expectedDurationSeconds?: number
  }) | null
  const formatIssue = formatRequired && !formatValidation?.passed && !dimensionsPassed
    ? `Final ${input.mediaType.toLowerCase()} format is ${formatValidation?.width ?? 0}×${formatValidation?.height ?? 0}; required ${input.targetFormat?.width ?? 0}×${input.targetFormat?.height ?? 0} (${input.targetFormat?.aspectRatio ?? 'platform format'}).`
    : ''
  const durationIssue = input.mediaType === 'VIDEO' && videoValidation?.durationPassed === false
    ? `Final video duration is ${videoValidation.durationSeconds ?? 0}s; required ${videoValidation.expectedDurationSeconds ?? 0}s.`
    : ''
  const unknownFormatIssue = formatRequired
    && !formatValidation?.passed
    && !formatIssue
    && !durationIssue
    ? 'Final media delivery validation did not pass.'
    : ''
  const issues = boundedIssues([
    ...(Array.isArray(result.issues) ? result.issues : []),
    formatIssue,
    durationIssue,
    unknownFormatIssue,
    input.requireProductAdStructure && !advertisingStructure
      ? 'The video does not visibly deliver the required advertising sequence: hook, product reveal, benefit moment, and deliberate end frame.'
      : '',
    input.requireProductAdStructure && !paidSocialAdReadiness
      ? 'The result reads as a generic generated clip rather than a paid-social product advertisement.'
      : '',
    input.requireProductAdStructure && (commercialHookScore ?? 0) < 85
      ? 'The opening two seconds do not create a clear, scroll-stopping commercial hook.'
      : '',
    input.requireProductAdStructure && (productHeroScore ?? 0) < 90
      ? 'The real product is not presented as a stable, unmistakable hero throughout the advertisement.'
      : '',
    input.requireProductAdStructure && (benefitCommunicationScore ?? 0) < 80
      ? 'The benefit or payoff is not visually understandable without inventing unsupported claims.'
      : '',
    input.requireProductAdStructure && (commercialPacingScore ?? 0) < 85
      ? 'The eight-second edit lacks purposeful commercial pacing or coherent shot progression.'
      : '',
    input.requireProductAdStructure && (endFrameReadinessScore ?? 0) < 85
      ? 'The final hero frame is not clean, deliberate, and usable with an exact separately typeset CTA.'
      : '',
    input.requireProductAdStructure && (brandAlignmentScore ?? 0) < 85
      ? 'The visible art direction does not match the approved brand and campaign intent closely enough.'
      : '',
  ])

  // The model supplies observations; NEXUS owns the decision. A reference job
  // must preserve the actual product/source, and every output must remain free
  // of invented claims and unusable raster typography.
  const passed = (
    (!referenceRequired || (referencePreservationScore ?? 0) >= (input.requireProductAdStructure ? 92 : 90))
    && semanticAlignmentScore >= (input.requireProductAdStructure ? 85 : 75)
    && professionalQualityScore >= (input.requireProductAdStructure ? 88 : 80)
    && technicalIntegrity
    && (!formatRequired || formatValidation?.passed === true)
    && noNewRasterText
    && noInventedClaims
    && (!input.requireProductAdStructure || (
      advertisingStructure === true
      && paidSocialAdReadiness === true
      && (commercialHookScore ?? 0) >= 85
      && (productHeroScore ?? 0) >= 90
      && (benefitCommunicationScore ?? 0) >= 80
      && (commercialPacingScore ?? 0) >= 85
      && (endFrameReadinessScore ?? 0) >= 85
      && (brandAlignmentScore ?? 0) >= 85
    ))
    && issues.length === 0
  )

  return {
    version: 1,
    passed,
    mediaType: input.mediaType,
    referenceRequired,
    referencePreservationScore,
    semanticAlignmentScore,
    professionalQualityScore,
    technicalIntegrity,
    formatRequired,
    formatValidation,
    noNewRasterText,
    noInventedClaims,
    advertisingStructure,
    paidSocialAdReadiness,
    commercialHookScore,
    productHeroScore,
    benefitCommunicationScore,
    commercialPacingScore,
    endFrameReadinessScore,
    brandAlignmentScore,
    issues,
    summary: boundedText(result.summary, 300) || (passed
      ? 'NEXUS quality review passed.'
      : 'NEXUS quality review rejected this output.'),
    reviewedAt: new Date().toISOString(),
    providerUsage,
  }
}

export async function reviewGeneratedMediaQuality(
  input: QualityInput,
): Promise<GeneratedMediaQualityReview> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('NEXUS media quality review is unavailable')
  const frames = input.outputFrames
    .filter(url => typeof url === 'string' && url.startsWith('https://'))
    .slice(0, input.mediaType === 'VIDEO' ? 5 : 1)
  if (frames.length === 0) throw new Error('NEXUS media quality review received no durable output')

  const referenceUrls = Array.from(new Set([
    ...(input.referenceImageUrls ?? []),
    ...(input.referenceImageUrl ? [input.referenceImageUrl] : []),
  ].filter(url => typeof url === 'string' && url.startsWith('https://')))).slice(0, 4)
  const content: Array<Record<string, unknown>> = [{
    type: 'text',
    text: `Review one NEXUS ${input.mediaType.toLowerCase()} advertising output before it can be attached or billed as successful.

CAMPAIGN MESSAGE (meaning only; it must not appear as generated raster text except for the exact approved overlays below):
${boundedText(input.campaignMessage, 900) || 'Not specified'}

EXACT APPROVED MOTION-DESIGN OVERLAYS:
${JSON.stringify((input.approvedOverlayTexts ?? []).map(item => boundedText(item, 80)).filter(Boolean)).slice(0, 800)}

CREATIVE DIRECTION:
${boundedText(input.creativeDirection, 900) || 'Premium, brand-safe advertising visual'}

FINAL PLATFORM FORMAT:
${input.targetFormat
    ? `${input.targetFormat.platform}: exactly ${input.targetFormat.width}×${input.targetFormat.height} (${input.targetFormat.aspectRatio}). Deterministic delivery check: ${JSON.stringify(input.formatValidation ?? {})}`
    : 'No image delivery canvas applies to this review.'}

KNOWN REFERENCE EVIDENCE:
${JSON.stringify(input.referenceEvidence ?? {}).slice(0, 2500)}

Reject if any of these are present:
- the supplied product, packaging, screen, device, person, or distinctive source was replaced, redesigned, relabelled, recoloured, duplicated, distorted, or became unrecognizable;
- generated gibberish, misspelled words, fake UI, fake metrics, new logos, watermarks, or any new raster text not already present in the reference source and not listed exactly in APPROVED MOTION-DESIGN OVERLAYS;
- invented claims, statistics, awards, testimonials, certifications, or product capabilities;
- mismatch with the campaign message, obvious anatomy/object errors, broken geometry, poor cropping, low resolution, jump cuts, flicker, or an amateur composition.
- a composition that becomes unusable or loses the important subject within the stated final platform canvas.
${input.requireProductAdStructure ? `- a generic AI motion clip, product demo, mood reel, slideshow, or attractive B-roll that would not function as a paid-social advertisement;
- an opening that fails to stop attention within the first two seconds;
- weak product prominence, random camera movement, dead time, incoherent shot progression, or a final frame that cannot carry an exact separately typeset CTA;
- art direction that feels interchangeable with another brand rather than specific to the approved message and tone.` : ''}

For reference jobs, text/UI already visible inside the supplied source is allowed only when it is faithfully preserved. Exact text in APPROVED MOTION-DESIGN OVERLAYS is also allowed when it is cleanly typeset. "noNewRasterText" means no additional or corrupted text outside the preserved source and those exact overlays.

Return JSON exactly:
{
  "referencePreservationScore": 0,
  "semanticAlignmentScore": 0,
  "professionalQualityScore": 0,
  "technicalIntegrity": true,
  "noNewRasterText": true,
  "noInventedClaims": true,
  "advertisingStructure": ${input.requireProductAdStructure ? 'true' : 'null'},
  "paidSocialAdReadiness": ${input.requireProductAdStructure ? 'true' : 'null'},
  "commercialHookScore": ${input.requireProductAdStructure ? '0' : 'null'},
  "productHeroScore": ${input.requireProductAdStructure ? '0' : 'null'},
  "benefitCommunicationScore": ${input.requireProductAdStructure ? '0' : 'null'},
  "commercialPacingScore": ${input.requireProductAdStructure ? '0' : 'null'},
  "endFrameReadinessScore": ${input.requireProductAdStructure ? '0' : 'null'},
  "brandAlignmentScore": ${input.requireProductAdStructure ? '0' : 'null'},
  "issues": [],
  "summary": "short evidence-based verdict"
}`,
  }]

  referenceUrls.forEach((referenceUrl, index) => {
    content.push({ type: 'text', text: `REFERENCE SOURCE ${index + 1} — source of truth:` })
    content.push({
      type: 'image_url',
      image_url: { url: referenceUrl, detail: 'high' },
    })
  })
  frames.forEach((frame, index) => {
    content.push({ type: 'text', text: `GENERATED OUTPUT${frames.length > 1 ? ` FRAME ${index + 1}` : ''}:` })
    content.push({ type: 'image_url', image_url: { url: frame, detail: 'high' } })
  })

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: QUALITY_MODEL,
      temperature: 0.1,
      max_tokens: 800,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are NEXUS Media QA. Inspect only visible evidence. Be strict, concise, and return JSON only. Never infer product truth from the campaign copy.',
        },
        { role: 'user', content },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    console.error('[generated-media-quality] provider review failed', response.status, detail.slice(0, 240))
    throw new Error('NEXUS media quality review is temporarily unavailable')
  }

  const payload = await response.json()
  const parsed = parseJsonObject(payload?.choices?.[0]?.message?.content)
  const providerUsage = summarizeOpenAITextUsage(QUALITY_MODEL, [readOpenAIChatUsage(payload?.usage)])
  return normalizeGeneratedMediaQualityReview(parsed, input, providerUsage)
}

export function cloudinaryVideoReviewFrames(videoUrl: string, durationSeconds = 5): string[] {
  if (!videoUrl.startsWith('https://res.cloudinary.com/') || !videoUrl.includes('/video/upload/')) {
    throw new Error('NEXUS video QA requires a durable Cloudinary video')
  }
  const jpegUrl = videoUrl.replace(/\.[a-z0-9]+(?:\?.*)?$/i, '.jpg')
  const duration = Math.max(2, Math.round(durationSeconds))
  const seconds = Array.from(new Set([
    0,
    Math.min(1, duration - 1),
    Math.max(1, Math.floor(duration * 0.4)),
    Math.max(1, Math.floor(duration * 0.7)),
    duration - 1,
  ])).sort((a, b) => a - b)
  return seconds.map(second => jpegUrl.replace('/video/upload/', `/video/upload/so_${second},f_jpg,q_auto/`))
}
