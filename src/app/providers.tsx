'use client'

import { useEffect } from 'react'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/lib/auth-context'
import { I18nProvider, useI18n } from '@/lib/i18n-context'
import ChatWidget from '@/components/ui/ChatWidget'
import CookieBanner from '@/components/ui/CookieBanner'
import type { ReactNode } from 'react'

/** Syncs locale → <html dir> and <html lang> on every locale change */
function DirSyncer() {
  const { locale, dir } = useI18n()
  useEffect(() => {
    document.documentElement.dir  = dir
    document.documentElement.lang = locale
  }, [locale, dir])
  return null
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <DirSyncer />
      <AuthProvider>
        {children}
        <Toaster />
        <ChatWidget />
        <CookieBanner />
      </AuthProvider>
    </I18nProvider>
  )
}
