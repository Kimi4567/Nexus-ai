import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Login — Nexus AI',
  description: 'Sign in to your Nexus AI dashboard. Access your AI marketing campaigns, content calendar, and analytics.',
  robots: { index: false, follow: false },
}

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children
}
