import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Forgot Password — Nexus AI',
  description: 'Reset your Nexus AI password. We will send you a secure link to create a new password.',
  robots: { index: false, follow: false },
}

export default function ForgotPasswordLayout({ children }: { children: ReactNode }) {
  return children
}
