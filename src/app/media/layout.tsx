import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Media Library — Nexus AI',
  description: 'Upload, organize, and manage your marketing assets, images, and creative files.',
  robots: { index: false, follow: false },
}

export default function MediaLayout({ children }: { children: ReactNode }) {
  return children
}
