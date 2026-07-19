import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Create Account — Nexus AI',
  description: 'Create your NEXUS AI account. Get 15 one-time trial credits and start planning your marketing today.',
  robots: { index: false, follow: false },
}

export default function RegisterLayout({ children }: { children: ReactNode }) {
  return children
}
