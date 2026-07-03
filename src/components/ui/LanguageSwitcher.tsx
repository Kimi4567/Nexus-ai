'use client'

import React, { memo } from 'react'
import { useI18n } from '@/lib/i18n-context'
import { Globe } from 'lucide-react'

const LanguageSwitcher = memo(function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n()

  const toggle = () => {
    setLocale(locale === 'ar' ? 'en' : 'ar')
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={locale === 'ar' ? t('language.switchTo') as string : 'Switch to Arabic'}
      className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all hover:scale-[1.02]"
      style={{
        background: '#FFFFFF',
        border: '1px solid rgba(15,23,42,0.10)',
        color: '#475569',
      }}
      title={locale === 'ar' ? t('language.switchTo') as string : 'Switch to Arabic'}
    >
      <Globe className="w-4 h-4" />
      <span className="hidden sm:inline">{locale === 'ar' ? 'العربية' : 'English'}</span>
      <span className="text-[10px] opacity-50">{locale === 'ar' ? 'EN' : 'AR'}</span>
    </button>
  )
})

export default LanguageSwitcher
