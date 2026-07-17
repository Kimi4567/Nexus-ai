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
  const target = platform.trim().toUpperCase()
  if (['TIKTOK', 'YOUTUBE', 'YOUTUBE_SHORTS', 'INSTAGRAM', 'META'].includes(target)) {
    return '720:1280'
  }
  if (target === 'PINTEREST' && hasReferenceImage) return '960:960'
  return '1280:720'
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
  const brandName = cleanPromptPart(input.brandName, 80) || 'the brand'
  const direction = cleanPromptPart(input.videoDirection, 900)
  const caption = cleanPromptPart(input.caption, 700)
  const industry = cleanPromptPart(input.industry, 100)
  const tone = Array.isArray(input.toneWords)
    ? input.toneWords.map(item => cleanPromptPart(item, 40)).filter(Boolean).slice(0, 5).join(', ')
    : ''

  const sourceRule = input.hasReferenceImage
    ? 'Use the supplied image as the exact product and first-frame source of truth. Preserve product geometry, packaging, colours, labels, logo placement, proportions, and distinctive details. Do not redesign, replace, or hallucinate the product.'
    : 'Create a brand-safe cinematic scene without inventing a specific product, interface, customer result, award, testimonial, statistic, or certification that is not visible in the source.'

  return [
    `Create one premium five-second commercial master shot for ${brandName}.`,
    industry ? `Industry context: ${industry}.` : '',
    tone ? `Visual tone: ${tone}.` : '',
    direction ? `Creative direction: ${direction}.` : '',
    caption ? `Message context only (do not render as text): ${caption}.` : '',
    sourceRule,
    'Use deliberate cinematic motion, realistic lighting, physically plausible reflections and shadows, stable composition, controlled camera movement, and a clean ending frame suitable for an ad edit.',
    'No generated captions, typography, subtitles, watermarks, extra logos, distorted hands, morphing labels, duplicate products, or jump cuts. Keep any Arabic or English copy outside the generated pixels so NEXUS can preserve correct typography during review.',
  ].filter(Boolean).join(' ')
}
