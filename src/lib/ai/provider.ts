export const AI_PROVIDER_UNAVAILABLE_CODE = 'AI_PROVIDER_UNAVAILABLE' as const
export const IMAGE_PROVIDER_UNAVAILABLE_CODE = 'IMAGE_PROVIDER_UNAVAILABLE' as const
export const MEDIA_STORAGE_UNAVAILABLE_CODE = 'MEDIA_STORAGE_UNAVAILABLE' as const
export const VIDEO_PROVIDER_UNAVAILABLE_CODE = 'VIDEO_PROVIDER_UNAVAILABLE' as const

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

export function isImageProviderConfigured(): boolean {
  const falKey = process.env.FAL_KEY
  return (typeof falKey === 'string' && falKey.trim().length > 0) || isAiProviderConfigured()
}

export function isVideoProviderConfigured(): boolean {
  const runwayKey = process.env.RUNWAYML_API_SECRET || process.env.RUNWAY_API_KEY
  return typeof runwayKey === 'string' && runwayKey.trim().length > 0
}

export function isMediaStorageConfigured(): boolean {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  return [cloudName, apiKey, apiSecret].every(
    (value) => typeof value === 'string' && value.trim().length > 0,
  )
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

export function getImageProviderUnavailablePayload(language: unknown = 'ar') {
  const isArabic = typeof language !== 'string' || language.toLowerCase().startsWith('ar')

  return {
    error: isArabic
      ? 'إنشاء الصور غير متاح حالياً لأن مزود الصور غير مُهيأ. لم يتم إنشاء صورة ولم يُخصم أي كريدت.'
      : 'Image generation is currently unavailable because no image provider is configured. No image was created and no credits were charged.',
    code: IMAGE_PROVIDER_UNAVAILABLE_CODE,
    providerConfigured: false,
    creditsCharged: false,
    retryable: false,
  }
}

export function getMediaStorageUnavailablePayload(language: unknown = 'ar') {
  const isArabic = typeof language !== 'string' || language.toLowerCase().startsWith('ar')

  return {
    error: isArabic
      ? 'إنشاء الصور غير متاح حالياً لأن تخزين الوسائط الدائم غير مُهيأ. لم يتم إنشاء صورة ولم يُخصم أي كريدت.'
      : 'Image generation is currently unavailable because permanent media storage is not configured. No image was created and no credits were charged.',
    code: MEDIA_STORAGE_UNAVAILABLE_CODE,
    storageConfigured: false,
    creditsCharged: false,
    retryable: false,
  }
}

export function getVideoProviderUnavailablePayload(language: unknown = 'ar') {
  const isArabic = typeof language !== 'string' || language.toLowerCase().startsWith('ar')

  return {
    error: isArabic
      ? 'إنشاء الفيديو غير متاح حالياً لأن مزود Runway غير مُهيأ. لم يتم إنشاء فيديو ولم يُخصم أي كريديت.'
      : 'Video generation is currently unavailable because Runway is not configured. No video was created and no credits were charged.',
    code: VIDEO_PROVIDER_UNAVAILABLE_CODE,
    providerConfigured: false,
    creditsCharged: false,
    retryable: false,
  }
}
