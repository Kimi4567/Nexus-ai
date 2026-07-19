import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Nexus AI Workspace',
  description: 'Legacy product route forwarding authenticated users to the current workspace.',
  robots: { index: false, follow: false },
}

export default function DemoLayout({ children }: { children: ReactNode }) {
  return children
}
