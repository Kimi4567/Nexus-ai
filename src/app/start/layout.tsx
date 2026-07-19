import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Get Started — Nexus AI',
  description: 'Set your brief, choose your platforms, and NEXUS drafts your first campaign.',
  robots: { index: false, follow: false },
}

export default function StartLayout({ children }: { children: ReactNode }) {
  return children
}
