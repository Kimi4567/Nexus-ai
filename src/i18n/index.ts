'use client'

import { useContext } from 'react'
import { LanguageContext } from '@/contexts/LanguageContext'
import en from './locales/en.json'
import ar from './locales/ar.json'

export type Lang = 'en' | 'ar'

const translations: Record<Lang, typeof en> = { en, ar }

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split('.')
  let current: unknown = obj
  for (const key of keys) {
    if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[key]
    } else {
      return path
    }
  }
  return typeof current === 'string' ? current : path
}

export function useTranslation() {
  const ctx = useContext(LanguageContext)
  const lang: Lang = ctx?.lang ?? 'ar'

  const t = (key: string): string => {
    return getNestedValue(translations[lang] as unknown as Record<string, unknown>, key)
  }

  return { t, lang, setLang: ctx?.setLang ?? (() => {}) }
}
