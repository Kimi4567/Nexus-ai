import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Nexus AI | Your AI Marketing Department',
  description:
    'Nexus AI generates complete marketing campaigns in 60 seconds — strategy, hooks, scripts, captions, and 30-day content calendar. Your AI marketing department.',
  keywords: [
    'AI marketing', 'marketing automation', 'campaign generator',
    'content creation', 'social media marketing', 'AI marketing platform', 'marketing SaaS',
  ],
  metadataBase: new URL('https://nexus-grow.com'),
  openGraph: {
    title: 'Nexus AI — Your AI Marketing Department',
    description: 'Generate complete marketing campaigns in 60 seconds. Strategy, hooks, scripts, captions, and a 30-day content calendar — all powered by AI.',
    url: 'https://nexus-grow.com',
    siteName: 'Nexus AI',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nexus AI — Your AI Marketing Department',
    description: 'Generate complete marketing campaigns in 60 seconds. Powered by AI.',
  },
  robots: { index: true, follow: true },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Nexus AI',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: 'https://nexus-grow.com',
  description: 'AI-powered marketing operating system. Generate complete campaigns — strategy, hooks, scripts, captions, and content calendar — in 60 seconds.',
  offers: {
    '@type': 'AggregateOffer',
    priceCurrency: 'USD',
    lowPrice: '0',
    highPrice: '199',
    offerCount: '3',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="dark bg-dark text-white">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
