import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Analytics — Nexus AI',
  description: 'Review verified platform metrics, measurement gaps, and evidence-backed learning when eligible data exists.',
  robots: { index: false, follow: false },
}

export default function AnalyticsLayout({ children }: { children: ReactNode }) {
  return children
}
