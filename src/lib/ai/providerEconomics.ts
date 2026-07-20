/**
 * Provider cost catalog used for internal margin measurement.
 *
 * Credits are commercial work units, not token aliases. These rates let us
 * record the real variable provider cost behind a completed action while the
 * public credit price also pays for retries, validation, storage, platform
 * work, support, and operating margin.
 */

export const PROVIDER_PRICING_VERSION = 'openai-standard-2026-07-20'

export const OPENAI_TEXT_RATES_USD_PER_MILLION = {
  'gpt-4o': { input: 2.5, cachedInput: 1.25, output: 10 },
  'gpt-4o-mini': { input: 0.15, cachedInput: 0.075, output: 0.6 },
} as const

export type MeteredTextModel = keyof typeof OPENAI_TEXT_RATES_USD_PER_MILLION

export interface OpenAITextUsage {
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
}

export interface ProviderUsageSummary extends OpenAITextUsage {
  pricingVersion: string
  model: MeteredTextModel
  calls: number
  estimatedProviderCostUsd: number
}

function safeTokenCount(value: unknown): number {
  const parsed = Math.floor(Number(value))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

export function readOpenAIChatUsage(value: unknown): OpenAITextUsage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 }
  }
  const usage = value as Record<string, unknown>
  const promptDetails = usage.prompt_tokens_details
  const cachedInputTokens = promptDetails && typeof promptDetails === 'object' && !Array.isArray(promptDetails)
    ? safeTokenCount((promptDetails as Record<string, unknown>).cached_tokens)
    : 0
  return {
    inputTokens: safeTokenCount(usage.prompt_tokens ?? usage.input_tokens),
    cachedInputTokens,
    outputTokens: safeTokenCount(usage.completion_tokens ?? usage.output_tokens),
  }
}

export function estimateOpenAITextCostUsd(
  model: MeteredTextModel,
  usage: OpenAITextUsage,
): number {
  const rate = OPENAI_TEXT_RATES_USD_PER_MILLION[model]
  const input = safeTokenCount(usage.inputTokens)
  const cached = Math.min(input, safeTokenCount(usage.cachedInputTokens))
  const uncached = Math.max(0, input - cached)
  const output = safeTokenCount(usage.outputTokens)
  const cost = (
    (uncached * rate.input)
    + (cached * rate.cachedInput)
    + (output * rate.output)
  ) / 1_000_000
  return Number(cost.toFixed(6))
}

export function summarizeOpenAITextUsage(
  model: MeteredTextModel,
  calls: OpenAITextUsage[],
): ProviderUsageSummary {
  const totals = calls.reduce<OpenAITextUsage>((sum, call) => ({
    inputTokens: sum.inputTokens + safeTokenCount(call.inputTokens),
    cachedInputTokens: sum.cachedInputTokens + safeTokenCount(call.cachedInputTokens),
    outputTokens: sum.outputTokens + safeTokenCount(call.outputTokens),
  }), { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 })
  return {
    pricingVersion: PROVIDER_PRICING_VERSION,
    model,
    calls: calls.length,
    ...totals,
    estimatedProviderCostUsd: estimateOpenAITextCostUsd(model, totals),
  }
}

export const OPENAI_IMAGE_OUTPUT_RESERVE_USD = {
  'gpt-image-2:high:1024x1024': 0.211,
  'gpt-image-2:high:1024x1536': 0.165,
  'gpt-image-2:high:1536x1024': 0.165,
  'gpt-image-1:high:1024x1024': 0.167,
  'gpt-image-1:high:1024x1536': 0.25,
  'gpt-image-1:high:1536x1024': 0.25,
} as const

export const FAL_FLUX_PRO_1_1_ULTRA_IMAGE_USD = 0.06
export const IMAGE_PROVIDER_ECONOMICS_VERSION = 'image-provider-estimate-2026-07-20-v1'

export type ImageProviderName = 'openai-gpt-image-2' | 'fal-flux'
export type OpenAIImageSize = '1024x1024' | '1024x1536' | '1536x1024'

export function estimateProfessionalImageCostUsd(input: {
  provider: ImageProviderName
  size: OpenAIImageSize
  model?: string | null
  qualityReviewCostUsd?: number | null
}): { providerCostUsd: number; providerPricingVersion: string; providerUsage: Record<string, unknown> } {
  const model = String(input.model || 'gpt-image-2').trim() || 'gpt-image-2'
  const openAiKey = `${model}:high:${input.size}` as keyof typeof OPENAI_IMAGE_OUTPUT_RESERVE_USD
  const generationEstimate = input.provider === 'fal-flux'
    ? FAL_FLUX_PRO_1_1_ULTRA_IMAGE_USD
    : OPENAI_IMAGE_OUTPUT_RESERVE_USD[openAiKey]
      ?? OPENAI_IMAGE_OUTPUT_RESERVE_USD[`gpt-image-2:high:${input.size}`]
  const qualityReviewCost = Number(input.qualityReviewCostUsd)
  const normalizedReviewCost = Number.isFinite(qualityReviewCost) && qualityReviewCost >= 0
    ? qualityReviewCost
    : 0
  return {
    providerCostUsd: Number((generationEstimate + normalizedReviewCost).toFixed(6)),
    providerPricingVersion: IMAGE_PROVIDER_ECONOMICS_VERSION,
    providerUsage: {
      generation: {
        provider: input.provider,
        model: input.provider === 'fal-flux' ? 'fal-ai/flux-pro/v1.1-ultra' : model,
        quality: 'high',
        size: input.size,
        estimateUsd: generationEstimate,
        estimateBasis: input.provider === 'fal-flux'
          ? 'official per-image price'
          : 'official high-quality output estimate; image/text input tokens may add cost',
      },
      qualityReview: {
        estimateUsd: normalizedReviewCost,
      },
    },
  }
}
