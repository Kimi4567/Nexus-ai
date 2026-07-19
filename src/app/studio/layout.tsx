import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Creative Direction Preview — Nexus AI',
  description: 'Review brand-grounded visual direction before generating or attaching media to a specific post.',
  robots: { index: false, follow: false },
}

export default function StudioLayout({ children }: { children: ReactNode }) {
  return children
}
