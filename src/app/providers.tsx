'use client'

import { Toaster } from 'sonner'
import { AuthProvider } from '@/lib/auth-context'
import { I18nProvider } from '@/lib/i18n-context'
import ChatWidget from '@/components/ui/ChatWidget'
import CookieBanner from '@/components/ui/CookieBanner'
import type { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <AuthProvider>
        {children}
        <Toaster />
        <ChatWidget />
        <CookieBanner />
      </AuthProvider>
    </I18nProvider>
  )
}
