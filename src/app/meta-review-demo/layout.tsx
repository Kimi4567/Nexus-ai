import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Meta Publishing Review Flow — Nexus AI',
  description: 'Reviewer-facing demonstration of the approval-gated Facebook Page publishing flow.',
  robots: { index: false, follow: false },
}

export default function MetaReviewDemoLayout({ children }: { children: ReactNode }) {
  return children
}
