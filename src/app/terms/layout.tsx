import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Terms of Service — Nexus AI',
  description: 'Nexus AI terms of service and current commercial launch status.',
}

export default function TermsLayout({ children }: { children: ReactNode }) {
  return children
}
