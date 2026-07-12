import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'
import { LanguageProvider } from '@/contexts/LanguageContext'

export const metadata: Metadata = {
  title: 'NEXUS AI | Your AI Marketing Department',
  description:
    'NEXUS AI is your AI marketing assistant — strategy, content, campaigns, and brand safety in one platform. Start free with 15 AI credits.',
  keywords: [
    'AI marketing', 'marketing automation', 'AI marketing department',
    'campaign generator', 'content creation', 'social media marketing',
    'AI marketing platform', 'marketing SaaS', 'Brand Brain',
  ],
  metadataBase: new URL('https://nexus-grow.com'),
  openGraph: {
    title: 'NEXUS AI — Your AI Marketing Department',
    description: 'Strategy, content, campaigns, and analytics — in one AI platform. Start free with 15 AI credits, no credit card required.',
    url: 'https://nexus-grow.com',
    siteName: 'NEXUS AI',
    type: 'website',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'NEXUS AI — Your AI Marketing Department',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NEXUS AI — Your AI Marketing Department',
    description: 'Strategy, content, campaigns, and analytics — in one AI platform. Start free with 15 AI credits.',
    images: ['/opengraph-image'],
  },
  robots: { index: true, follow: true },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'NEXUS AI',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: 'https://nexus-grow.com',
  description: 'AI-powered marketing operating system. Strategy, content, campaigns, and analytics — all in one platform with full human approval control.',
  offers: {
    '@type': 'AggregateOffer',
    priceCurrency: 'USD',
    lowPrice: '49',
    highPrice: '99',
    offerCount: '2',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Noto+Sans+Arabic:wght@400;600;800&display=swap" rel="stylesheet" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased overflow-x-hidden min-h-screen bg-slate-50 text-slate-950" style={{ fontFamily: "'Inter', 'Noto Sans Arabic', system-ui, sans-serif" }}>
        <Providers>
          <LanguageProvider>
            {children}
          </LanguageProvider>
        </Providers>
      </body>
    </html>
  )
}
