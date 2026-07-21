import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Leads & CRM — NEXUS AI',
  description: 'Workspace-isolated lead pipeline, campaign attribution, consent evidence, and follow-up history.',
  robots: { index: false, follow: false },
}

export default function LeadsLayout({ children }: { children: ReactNode }) {
  return children
}
