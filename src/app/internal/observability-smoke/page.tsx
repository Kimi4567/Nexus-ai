import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BrowserSentrySmoke } from './BrowserSentrySmoke'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Observability verification',
  robots: {
    index: false,
    follow: false,
  },
}

export default function ObservabilitySmokePage() {
  if (process.env.VERCEL_ENV !== 'preview') notFound()

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <BrowserSentrySmoke />
    </main>
  )
}
