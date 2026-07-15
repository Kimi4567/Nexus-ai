export type OnboardingLocale = 'ar' | 'en'

export interface FirstIntentOption {
  value: string
  ar: string
  en: string
}

export interface MarketingStatusOption {
  value: string
  ar: string
  en: string
}

export type ExistingWorkspaceOnboardingRoute = '/dashboard' | '/brand' | null

/**
 * A workspace shell is deliberately preserved by Fresh Start. It is therefore
 * not proof that onboarding is complete. Only persisted Brand Brain identity
 * can move an existing workspace past the starter journey.
 */
export function resolveExistingWorkspaceOnboardingRoute({
  hasWorkspace,
  brandProfile,
  brandReady,
}: {
  hasWorkspace: boolean
  brandProfile?: Record<string, unknown> | null
  brandReady: boolean
}): ExistingWorkspaceOnboardingRoute {
  if (!hasWorkspace) return null
  const hasBrandIdentity = Boolean(
    brandProfile?.brandName || brandProfile?.industry || brandProfile?.description,
  )
  if (!hasBrandIdentity) return null
  return brandReady ? '/dashboard' : '/brand'
}

export const FIRST_INTENTS: FirstIntentOption[] = [
  { value: 'build_strategy', ar: 'بناء استراتيجية تسويق', en: 'Build a marketing strategy' },
  { value: 'create_content', ar: 'إنشاء محتوى', en: 'Create content' },
  { value: 'improve_social', ar: 'تحسين وجودي على وسائل التواصل', en: 'Improve social media presence' },
  { value: 'prepare_paid_plan', ar: 'تجهيز خطة إعلانات مدفوعة', en: 'Prepare a paid campaign plan' },
  { value: 'guide_me', ar: 'لست متأكدًا — أرشدني', en: 'I’m not sure — guide me' },
]

export function buildOnboardingStrategicNotes({
  firstIntent,
  marketingStatus,
  marketingStatusOptions,
  locale,
}: {
  firstIntent?: string | null
  marketingStatus?: string | null
  marketingStatusOptions: MarketingStatusOption[]
  locale: OnboardingLocale
}): string | null {
  const ar = locale === 'ar'
  const intentOpt = FIRST_INTENTS.find(i => i.value === firstIntent)
  const statusOpt = marketingStatusOptions.find(s => s.value === marketingStatus)

  const intentLabel = ar ? 'أول مساعدة مطلوبة من NEXUS' : 'First requested help from NEXUS'
  const statusLabel = ar ? 'الوضع التسويقي الحالي' : 'Current marketing status'

  const notes = [
    intentOpt ? `${intentLabel}: ${ar ? intentOpt.ar : intentOpt.en}` : null,
    statusOpt ? `${statusLabel}: ${ar ? statusOpt.ar : statusOpt.en}` : null,
  ].filter(Boolean)

  return notes.length ? notes.join('\n') : null
}
