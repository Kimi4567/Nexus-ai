import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard — Nexus AI',
  description: 'Your AI marketing command center.',
  robots: { index: false, follow: false },
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
