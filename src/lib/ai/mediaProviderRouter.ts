import { resolvePlatformVideoFormat } from '@/lib/platformVideoFormat'

export type ProfessionalImageProvider = 'openai-gpt-image-2' | 'fal-flux'

export type ImageGenerationPurpose =
  | 'concept_draft'
  | 'final_ad_creative'
  | 'product_to_ad'

export interface ImageProviderDecisionInput {
  purpose: ImageGenerationPurpose
  hasReferenceImage: boolean
  openAiConfigured: boolean
  falConfigured: boolean
}

export interface ImageProviderDecision {
  provider: ProfessionalImageProvider
  reason: 'reference_fidelity' | 'final_quality' | 'cost_efficient_concept'
  fallback: ProfessionalImageProvider | null
}

/**
 * Provider choice is based on the marketing job, never on whichever key happens
 * to be present first. Product/reference work must fail closed if the fidelity
 * provider is unavailable; silently falling back to text-only generation can
 * change product shape, packaging, colour, or brand marks.
 */
export function chooseProfessionalImageProvider(
  input: ImageProviderDecisionInput,
): ImageProviderDecision {
  if (input.hasReferenceImage || input.purpose === 'product_to_ad') {
    if (!input.openAiConfigured) {
      throw new Error('REFERENCE_IMAGE_PROVIDER_UNAVAILABLE')
    }
    return {
      provider: 'openai-gpt-image-2',
      reason: 'reference_fidelity',
      fallback: null,
    }
  }

  if (input.purpose === 'final_ad_creative' && input.openAiConfigured) {
    return {
      provider: 'openai-gpt-image-2',
      reason: 'final_quality',
      fallback: input.falConfigured ? 'fal-flux' : null,
    }
  }

  if (input.falConfigured) {
    return {
      provider: 'fal-flux',
      reason: 'cost_efficient_concept',
      fallback: input.openAiConfigured ? 'openai-gpt-image-2' : null,
    }
  }

  if (input.openAiConfigured) {
    return {
      provider: 'openai-gpt-image-2',
      reason: 'final_quality',
      fallback: null,
    }
  }

  throw new Error('IMAGE_PROVIDER_UNAVAILABLE')
}

export type RunwayVideoRatio = '1280:720' | '720:1280' | '960:960'

export function platformToRunwayRatio(platform: string, hasReferenceImage: boolean): RunwayVideoRatio {
  void hasReferenceImage
  return resolvePlatformVideoFormat(platform).ratio
}

function cleanPromptPart(value: unknown, maxLength: number): string {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : ''
}

function uniqueTextList(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value
    .map(item => cleanPromptPart(item, maxLength))
    .filter(Boolean)))
    .slice(0, maxItems)
}

/**
 * Builds a short-form advertising brief rather than a generic motion prompt.
 * Exact product appearance comes from the qualified reference angles; only
 * verified Brand Brain claims may enter productInfo.
 */
export function buildCinematicProductAdBrief(input: {
  brandName?: string | null
  description?: string | null
  primaryOffer?: string | null
  verifiedProof?: string[] | null
  uniqueAdvantages?: string[] | null
  caption?: string | null
  videoDirection?: string | null
  industry?: string | null
  toneWords?: string[] | null
}): { productInfo: string; userConcept: string } {
  const brandName = cleanPromptPart(input.brandName, 80) || 'the approved brand'
  const description = cleanPromptPart(input.description, 500)
  const primaryOffer = cleanPromptPart(input.primaryOffer, 280)
  const verifiedProof = uniqueTextList(input.verifiedProof, 4, 180)
  const advantages = uniqueTextList(input.uniqueAdvantages, 4, 160)
  const caption = cleanPromptPart(input.caption, 360)
  const direction = cleanPromptPart(input.videoDirection, 600)
  const industry = cleanPromptPart(input.industry, 80)
  const tone = uniqueTextList(input.toneWords, 5, 40)

  const productInfo = [
    `Brand: ${brandName}.`,
    industry ? `Category: ${industry}.` : '',
    description ? `Approved description: ${description}.` : '',
    primaryOffer ? `Approved offer: ${primaryOffer}.` : '',
    advantages.length ? `Approved advantages: ${advantages.join('; ')}.` : '',
    verifiedProof.length ? `Verified proof only: ${verifiedProof.join('; ')}.` : '',
    'The product reference images are the sole source of truth for shape, packaging, colour, labels, proportions, and distinctive details.',
  ].filter(Boolean).join(' ').slice(0, 2_500)

  const userConcept = [
    `Create an eight-second premium product advertisement for ${brandName}, not a generic AI motion clip.`,
    'Use a coherent three-beat commercial sequence: 0–2s visual hook, 2–6s product reveal or benefit demonstration, 6–8s confident hero end frame with intentional negative space for a separately typeset CTA.',
    caption ? `Approved campaign message and intent: ${caption}.` : '',
    direction ? `Approved creative direction: ${direction}.` : '',
    tone.length ? `Brand mood: ${tone.join(', ')}.` : '',
    'Show the exact same product consistently across every shot. Use realistic lighting, purposeful camera movement, stable geometry, clean transitions, and paid-social production polish.',
    'Do not generate text, subtitles, logos, claims, awards, statistics, people, extra product variants, duplicate products, watermarks, or interface elements. Do not redesign the product or its packaging.',
  ].filter(Boolean).join(' ').slice(0, 3_500)

  return { productInfo, userConcept }
}
