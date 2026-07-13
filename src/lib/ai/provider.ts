export const AI_PROVIDER_UNAVAILABLE_CODE = 'AI_PROVIDER_UNAVAILABLE' as const

export class AiProviderUnavailableError extends Error {
  readonly code = AI_PROVIDER_UNAVAILABLE_CODE
  readonly retryable = false

  constructor() {
    super('OpenAI provider is not configured')
    this.name = 'AiProviderUnavailableError'
  }
}

export function isAiProviderConfigured(): boolean {
  const apiKey = process.env.OPENAI_API_KEY
  return typeof apiKey === 'string' && apiKey.trim().length > 0
}

export function assertAiProviderConfigured(): void {
  if (!isAiProviderConfigured()) throw new AiProviderUnavailableError()
}

export function getAiProviderUnavailablePayload(language: unknown = 'ar') {
  const isArabic = typeof language !== 'string' || language.toLowerCase().startsWith('ar')

  return {
    error: isArabic
      ? 'خدمة الذكاء الاصطناعي غير متاحة حالياً لأن مزود OpenAI غير مُهيأ. لم يتم إنشاء محتوى ولم يُخصم أي كريدت.'
      : 'AI generation is currently unavailable because the OpenAI provider is not configured. No content was created and no credits were charged.',
    code: AI_PROVIDER_UNAVAILABLE_CODE,
    providerConfigured: false,
    creditsCharged: false,
    retryable: false,
  }
}
