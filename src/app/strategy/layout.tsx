import { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Strategy — Nexus AI',
  description: 'Create and review a Brand Brain-grounded strategy, audience hypotheses, channel roles, and campaign plan.',
  robots: { index: false, follow: false },
}

export default function StrategyLayout({ children }: { children: ReactNode }) {
  return children
}
