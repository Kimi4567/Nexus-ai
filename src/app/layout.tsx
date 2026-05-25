import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'NEXUS AI | AI Marketing Operating System',
  description:
    'Generate complete marketing campaigns with AI. Strategies, scripts, videos, and social content.',
  keywords: [
    'AI marketing',
    'content generation',
    'video creation',
    'social media',
    'marketing automation',
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="dark bg-dark text-white">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
