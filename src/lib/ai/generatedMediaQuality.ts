import {
  readOpenAIChatUsage,
  summarizeOpenAITextUsage,
  type ProviderUsageSummary,
} from '@/lib/ai/providerEconomics'

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
  noNewRasterText: boolean
  noInventedClaims: boolean
  issues: string[]
  summary: string
  reviewedAt: string
  providerUsage: ProviderUsageSummary
}

type QualityInput = {
  mediaType: 'IMAGE' | 'VIDEO'
  outputFrames: string[]
  referenceImageUrl?: string | null
  campaignMessage?: string | null
  creativeDirection?: string | null
  referenceEvidence?: unknown
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
  input: Pick<QualityInput, 'mediaType' | 'referenceImageUrl'>,
  providerUsage: ProviderUsageSummary,
): GeneratedMediaQualityReview {
  const result = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  const referenceRequired = Boolean(input.referenceImageUrl)
  const referencePreservationScore = referenceRequired
    ? score(result.referencePreservationScore)
    : null
  const semanticAlignmentScore = score(result.semanticAlignmentScore)
  const professionalQualityScore = score(result.professionalQualityScore)
  const technicalIntegrity = result.technicalIntegrity === true
  const noNewRasterText = result.noNewRasterText === true
  const noInventedClaims = result.noInventedClaims === true
  const issues = boundedIssues(result.issues)

  // The model supplies observations; NEXUS owns the decision. A reference job
  // must preserve the actual product/source, and every output must remain free
  // of invented claims and unusable raster typography.
  const passed = (
    (!referenceRequired || (referencePreservationScore ?? 0) >= 90)
    && semanticAlignmentScore >= 75
    && professionalQualityScore >= 80
    && technicalIntegrity
    && noNewRasterText
    && noInventedClaims
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
    noNewRasterText,
    noInventedClaims,
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
    .slice(0, input.mediaType === 'VIDEO' ? 3 : 1)
  if (frames.length === 0) throw new Error('NEXUS media quality review received no durable output')

  const content: Array<Record<string, unknown>> = [{
    type: 'text',
    text: `Review one NEXUS ${input.mediaType.toLowerCase()} advertising output before it can be attached or billed as successful.

CAMPAIGN MESSAGE (meaning only; it must not appear as generated raster text):
${boundedText(input.campaignMessage, 900) || 'Not specified'}

CREATIVE DIRECTION:
${boundedText(input.creativeDirection, 900) || 'Premium, brand-safe advertising visual'}

KNOWN REFERENCE EVIDENCE:
${JSON.stringify(input.referenceEvidence ?? {}).slice(0, 2500)}

Reject if any of these are present:
- the supplied product, packaging, screen, device, person, or distinctive source was replaced, redesigned, relabelled, recoloured, duplicated, distorted, or became unrecognizable;
- generated gibberish, misspelled words, fake UI, fake metrics, new logos, watermarks, or any new raster text not already present in the reference source;
- invented claims, statistics, awards, testimonials, certifications, or product capabilities;
- mismatch with the campaign message, obvious anatomy/object errors, broken geometry, poor cropping, low resolution, jump cuts, flicker, or an amateur composition.

For reference jobs, text/UI already visible inside the supplied source is allowed only when it is faithfully preserved. "noNewRasterText" means no additional generated text outside that preserved source.

Return JSON exactly:
{
  "referencePreservationScore": 0,
  "semanticAlignmentScore": 0,
  "professionalQualityScore": 0,
  "technicalIntegrity": true,
  "noNewRasterText": true,
  "noInventedClaims": true,
  "issues": [],
  "summary": "short evidence-based verdict"
}`,
  }]

  if (input.referenceImageUrl) {
    content.push({ type: 'text', text: 'REFERENCE SOURCE — source of truth:' })
    content.push({
      type: 'image_url',
      image_url: { url: input.referenceImageUrl, detail: 'high' },
    })
  }
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

export function cloudinaryVideoReviewFrames(videoUrl: string): string[] {
  if (!videoUrl.startsWith('https://res.cloudinary.com/') || !videoUrl.includes('/video/upload/')) {
    throw new Error('NEXUS video QA requires a durable Cloudinary video')
  }
  const jpegUrl = videoUrl.replace(/\.[a-z0-9]+(?:\?.*)?$/i, '.jpg')
  return [0, 2, 4].map(second => jpegUrl.replace('/video/upload/', `/video/upload/so_${second},f_jpg,q_auto/`))
}
