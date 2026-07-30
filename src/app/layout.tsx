import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import './globals.css'
import { Providers } from './providers'
import ConsentAwareTelemetry from '@/components/ConsentAwareTelemetry'
import { isSupportedLocale, LOCALE_COOKIE_NAME } from '@/lib/locale'

export const metadata: Metadata = {
  title: 'NEXUS AI | Marketing Operating System',
  description:
    'Run brand intelligence, strategy, content, approvals, scheduled operations, lead management, and evidence-backed learning from one Brand Brain.',
  keywords: [
    'AI marketing', 'marketing automation', 'AI marketing department',
    'campaign generator', 'content creation', 'social media marketing',
    'AI marketing platform', 'marketing SaaS', 'Brand Brain',
  ],
  metadataBase: new URL('https://www.nexus-grow.com'),
  openGraph: {
    title: 'NEXUS AI — Marketing Operating System',
    description: 'One Brand Brain for strategy, content, approvals, scheduled operations, leads, and evidence-backed learning.',
    url: 'https://www.nexus-grow.com',
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
    description: 'One Brand Brain for strategy, content, approvals, scheduled operations, leads, and evidence-backed learning.',
    images: ['/opengraph-image'],
  },
  robots: { index: true, follow: true },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const savedLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value
  const initialLocale = isSupportedLocale(savedLocale) ? savedLocale : 'en'
  const direction = initialLocale === 'ar' ? 'rtl' : 'ltr'

  return (
    <html lang={initialLocale} dir={direction} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Noto+Sans+Arabic:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="nx-root-body min-h-screen overflow-x-hidden antialiased">
        <Providers initialLocale={initialLocale}>
          {children}
        </Providers>
        <ConsentAwareTelemetry />
      </body>
    </html>
  )
}
