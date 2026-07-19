import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Strategy Setup — Nexus AI',
  description: 'Legacy campaign setup route forwarding to the current strategy workflow.',
  robots: { index: false, follow: false },
}

export default function LegacyCampaignNewLayout({ children }: { children: ReactNode }) {
  return children
}
