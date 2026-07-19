import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Strategy Studio — Nexus AI',
  description: 'Create a strategy draft grounded in your saved Brand Brain and review it before execution.',
  robots: { index: false, follow: false },
}

export default function TemplatesLayout({ children }: { children: ReactNode }) {
  return children
}
