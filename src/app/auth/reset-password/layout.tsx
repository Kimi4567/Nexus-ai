import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Reset Password — Nexus AI',
  description: 'Set a new password for your Nexus AI account.',
  robots: { index: false, follow: false },
}

export default function ResetPasswordLayout({ children }: { children: ReactNode }) {
  return children
}
