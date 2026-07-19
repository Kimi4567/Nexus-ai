import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Learning | NEXUS AI',
  description: 'Reviewed Brand Brain signals and analytics-backed performance lessons.',
  robots: { index: false, follow: false },
}

export default function LearningLayout({ children }: { children: React.ReactNode }) {
  return children
}
