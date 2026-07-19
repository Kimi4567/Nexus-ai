import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Approvals — Nexus AI',
  description: 'Review the exact strategy and content revisions awaiting a human decision.',
  robots: { index: false, follow: false },
}

export default function ApprovalsLayout({ children }: { children: ReactNode }) {
  return children
}
