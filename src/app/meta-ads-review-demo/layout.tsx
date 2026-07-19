import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Meta Ads Review Flow — Nexus AI',
  description: 'Reviewer-facing demonstration of approval-gated Meta Ads draft and activation controls.',
  robots: { index: false, follow: false },
}

export default function MetaAdsReviewDemoLayout({ children }: { children: ReactNode }) {
  return children
}
