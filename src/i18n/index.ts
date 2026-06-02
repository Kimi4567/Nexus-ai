'use client'

// useTranslation now delegates to I18nProvider so the landing page and the
// auth/dashboard pages share a single locale state. Previously they used
// LanguageContext (separate state) which caused language set on the landing
// page to be ignored by auth pages that had already read localStorage once.

import { useI18n } from '@/lib/i18n-context'

export type Lang = 'en' | 'ar'

export function useTranslation() {
  const { locale, setLocale, t: i18nT } = useI18n()

  // Expose a t() that accepts dot-notation keys and returns strings,
  // matching the signature the landing page already uses.
  const t = (key: string): string => {
    const val = i18nT(key)
    return typeof val === 'string' ? val : key
  }

  return {
    t,
    lang: locale as Lang,
    setLang: setLocale as (l: Lang) => void,
  }
}
