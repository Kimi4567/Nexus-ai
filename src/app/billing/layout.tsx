import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Billing & Plans — Nexus AI',
  description: 'Manage your subscription, AI credits, and billing history. Compare the Growth and Autopilot plans.',
  robots: { index: false, follow: false },
}

export default function BillingLayout({ children }: { children: ReactNode }) {
  return children
}
