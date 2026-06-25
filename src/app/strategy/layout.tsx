import { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Strategy — Nexus AI',
  description: 'AI-generated marketing strategy, audience research, competitor analysis, and campaign planning.',
  robots: { index: false, follow: false },
}

export default function StrategyLayout({ children }: { children: ReactNode }) {
  return children
}
