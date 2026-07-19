import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Content Calendar — Nexus AI',
  description: 'Review saved content drafts, schedules, and verified publishing records across supported channels.',
  robots: { index: false, follow: false },
}

export default function CalendarLayout({ children }: { children: ReactNode }) {
  return children
}
