import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Privacy Policy — Nexus AI',
  description: 'How Nexus AI processes account, workspace, provider-connection, and product-usage data.',
}

export default function PrivacyLayout({ children }: { children: ReactNode }) {
  return children
}
