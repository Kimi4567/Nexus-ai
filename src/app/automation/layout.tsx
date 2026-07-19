import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Operations Center — Nexus AI',
  description: 'Review scheduled checks, incidents, approvals, connection health, and the next safe operating action.',
  robots: { index: false, follow: false },
}

export default function AutomationLayout({ children }: { children: ReactNode }) {
  return children
}
