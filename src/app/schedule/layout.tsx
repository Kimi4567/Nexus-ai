import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Execution Queue — Nexus AI',
  description: 'Legacy scheduling route forwarding to the approval-gated execution queue and verified publishing records.',
  robots: { index: false, follow: false },
}

export default function ScheduleLayout({ children }: { children: ReactNode }) {
  return children
}
