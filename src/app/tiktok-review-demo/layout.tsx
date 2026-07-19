import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'TikTok Integration Review Flow — Nexus AI',
  description: 'Reviewer-facing demonstration of the explicit TikTok connection, approval, and posting flow.',
  robots: { index: false, follow: false },
}

export default function TikTokReviewDemoLayout({ children }: { children: ReactNode }) {
  return children
}
