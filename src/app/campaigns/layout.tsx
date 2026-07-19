import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Campaigns — Nexus AI',
  description: 'Review campaign scope, workflow state, content production, paid planning, and verified performance when data exists.',
  robots: { index: false, follow: false },
}

export default function CampaignsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
