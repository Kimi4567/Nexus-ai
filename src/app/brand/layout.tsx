import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Brand Memory — Nexus AI',
  description: 'Save and review the brand evidence, voice, audience, offer, and operating constraints used by Nexus AI.',
  robots: { index: false, follow: false },
}

export default function BrandLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
