import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Cookie Policy — Nexus AI',
  description: 'Essential storage and optional product analytics used by Nexus AI.',
}

export default function CookiesLayout({ children }: { children: ReactNode }) {
  return children
}
