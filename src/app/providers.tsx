'use client'

import { Toaster } from 'sonner'
import { AuthProvider } from '@/lib/auth-context'
import type { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <Toaster />
    </AuthProvider>
  )
}
