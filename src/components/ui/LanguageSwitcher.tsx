'use client'

import { useI18n } from '@/lib/i18n-context'
import { Globe } from 'lucide-react'

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n()

  const toggle = () => {
    setLocale(locale === 'ar' ? 'en' : 'ar')
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all hover:scale-[1.02]"
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        color: '#94a3b8',
      }}
      title={locale === 'ar' ? t('language.switchTo') as string : 'Switch to Arabic'}
    >
      <Globe className="w-4 h-4" />
      <span className="hidden sm:inline">{locale === 'ar' ? 'العربية' : 'English'}</span>
      <span className="text-[10px] opacity-50">{locale === 'ar' ? 'EN' : 'AR'}</span>
    </button>
  )
}
