import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Paid Campaigns — Nexus AI',
  description: 'Create approval-gated paid execution drafts from an approved strategy and verified tracking inputs.',
  robots: { index: false, follow: false },
}

export default function PaidCampaignsLayout({ children }: { children: ReactNode }) {
  return children
}
