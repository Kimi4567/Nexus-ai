import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Asset Library — Nexus AI',
  description: 'Legacy import route forwarding to the asset library; no campaign or analytics import is implied.',
  robots: { index: false, follow: false },
}

export default function ImportsLayout({ children }: { children: ReactNode }) {
  return children
}
