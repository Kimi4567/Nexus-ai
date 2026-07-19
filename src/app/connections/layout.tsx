import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Connections — Nexus AI',
  description: 'Connect and verify eligible publishing, advertising, and measurement accounts.',
  robots: { index: false, follow: false },
}

export default function ConnectionsLayout({ children }: { children: ReactNode }) {
  return children
}
