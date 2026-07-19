import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Refund Policy — Nexus AI',
  description: 'Refund terms that apply after commercial launch and live billing activation.',
}

export default function RefundLayout({ children }: { children: ReactNode }) {
  return children
}
