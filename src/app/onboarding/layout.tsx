import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Onboarding — Nexus AI',
  description: 'Create a reviewed Brand Brain foundation before strategy, content, or execution begins.',
  robots: { index: false, follow: false },
}

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return children
}
