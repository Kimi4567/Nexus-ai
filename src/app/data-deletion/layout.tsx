import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Data Deletion — Nexus AI',
  description: 'Request or review deletion of Nexus AI and connected-platform data.',
  robots: { index: false, follow: false },
}

export default function DataDeletionLayout({ children }: { children: ReactNode }) {
  return children
}
