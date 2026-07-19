import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Settings — Nexus AI',
  description: 'Configure your account, preferences, notifications, and workspace settings.',
  robots: { index: false, follow: false },
}

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return children
}
