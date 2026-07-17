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

// Keep a margin below the provider's 1,000-character validation limit. The
// safety suffix is appended after truncation so long campaign copy can never
// cut off product-fidelity or typography protections.
export const PROFESSIONAL_VIDEO_PROMPT_MAX_CHARS = 950

export function platformToRunwayRatio(platform: string, hasReferenceImage: boolean): RunwayVideoRatio {
  void hasReferenceImage
  return resolvePlatformVideoFormat(platform).ratio
}

function cleanPromptPart(value: unknown, maxLength: number): string {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : ''
}

export function buildProfessionalVideoPrompt(input: {
  brandName?: string | null
  caption?: string | null
  videoDirection?: string | null
  industry?: string | null
  toneWords?: string[] | null
  hasReferenceImage: boolean
}): string {
  const brandName = cleanPromptPart(input.brandName, 60) || 'the brand'
  const direction = cleanPromptPart(input.videoDirection, 280)
  const caption = cleanPromptPart(input.caption, 140)
  const industry = cleanPromptPart(input.industry, 60)
  const tone = Array.isArray(input.toneWords)
    ? input.toneWords.map(item => cleanPromptPart(item, 24)).filter(Boolean).slice(0, 4).join(', ')
    : ''

  const sourceRule = input.hasReferenceImage
    ? 'The supplied image is the exact first-frame source of truth. Preserve its geometry, colours, labels, logo placement, proportions, and distinctive details; do not redesign or replace it.'
    : 'Create a brand-safe scene without inventing a product, interface, result, award, testimonial, statistic, or certification.'

  const safetySuffix = 'Use realistic light, plausible motion, stable composition, controlled camera movement, and a clean ad-ready end frame. No generated text, captions, subtitles, watermarks, extra logos, distorted details, duplicate products, or jump cuts.'
  const base = [
    `Create one premium five-second commercial master shot for ${brandName}.`,
    industry ? `Industry: ${industry}.` : '',
    tone ? `Visual tone: ${tone}.` : '',
    direction ? `Scene and motion: ${direction}.` : '',
    caption ? `Message context only; never render it as text: ${caption}.` : '',
    sourceRule,
  ].filter(Boolean).join(' ')

  const availableBaseChars = PROFESSIONAL_VIDEO_PROMPT_MAX_CHARS - safetySuffix.length - 1
  const boundedBase = base.length <= availableBaseChars
    ? base
    : base.slice(0, availableBaseChars).replace(/\s+\S*$/, '').trim()

  return `${boundedBase} ${safetySuffix}`.trim()
}
