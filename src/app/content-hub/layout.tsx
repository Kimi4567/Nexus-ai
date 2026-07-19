import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Content Production — Nexus AI',
  description: 'Review campaign copy, media readiness, and production decisions before approval or publishing.',
  robots: { index: false, follow: false },
}

export default function ContentHubLayout({ children }: { children: ReactNode }) {
  return children
}
