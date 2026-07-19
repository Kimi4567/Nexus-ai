import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Publishing Readiness — Nexus AI',
  description: 'Verify approved content, media, schedule, and eligible provider accounts before publishing.',
  robots: { index: false, follow: false },
}

export default function PublishLayout({ children }: { children: ReactNode }) {
  return children
}
