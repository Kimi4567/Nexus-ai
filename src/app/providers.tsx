'use client'

import { Toaster } from 'sonner'
import { AuthProvider } from '@/lib/auth-context'
import ChatWidget from '@/components/ui/ChatWidget'
import CookieBanner from '@/components/ui/CookieBanner'
import type { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <Toaster />
      <ChatWidget />
      <CookieBanner />
    </AuthProvider>
  )
}
