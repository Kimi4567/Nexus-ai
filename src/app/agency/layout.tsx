import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Workspace — Nexus AI',
  description: 'Legacy workspace route. Account-level operations continue in the main dashboard.',
  robots: { index: false, follow: false },
}

export default function AgencyLayout({ children }: { children: ReactNode }) {
  return children
}
