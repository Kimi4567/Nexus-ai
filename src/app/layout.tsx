import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'
import { LanguageProvider } from '@/contexts/LanguageContext'
import ConsentAwareTelemetry from '@/components/ConsentAwareTelemetry'

export const metadata: Metadata = {
  title: 'NEXUS AI | Marketing Operating System',
  description:
    'Build reviewed strategy, content plans, paid planning, approvals, and evidence-backed monitoring from one Brand Brain. Start with 15 one-time trial credits.',
  keywords: [
    'AI marketing', 'marketing automation', 'AI marketing department',
    'campaign generator', 'content creation', 'social media marketing',
    'AI marketing platform', 'marketing SaaS', 'Brand Brain',
  ],
  metadataBase: new URL('https://nexus-grow.com'),
  openGraph: {
    title: 'NEXUS AI — Marketing Operating System',
    description: 'Brand Brain, reviewed strategy, content planning, approvals, and evidence-backed monitoring in one platform. Start with 15 trial credits.',
    url: 'https://nexus-grow.com',
    siteName: 'NEXUS AI',
    type: 'website',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'NEXUS AI — Marketing Operating System',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NEXUS AI — Marketing Operating System',
    description: 'Brand Brain, reviewed strategy, content planning, approvals, and evidence-backed monitoring. Start with 15 trial credits.',
    images: ['/opengraph-image'],
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Noto+Sans+Arabic:wght@400;600;800&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased overflow-x-hidden min-h-screen bg-slate-50 text-slate-950" style={{ fontFamily: "'Inter', 'Noto Sans Arabic', system-ui, sans-serif" }}>
        <Providers>
          <LanguageProvider>
            {children}
          </LanguageProvider>
        </Providers>
        <ConsentAwareTelemetry />
      </body>
    </html>
  )
}
