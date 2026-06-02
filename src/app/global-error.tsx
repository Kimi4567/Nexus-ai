'use client'
/**
 * global-error.tsx — catches unhandled errors in the App Router root layout.
 * Logs to console in production. Sentry reporting commented out until
 * @sentry/nextjs is installed (npm install @sentry/nextjs).
 */
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // TODO: replace with Sentry.captureException(error) after npm install @sentry/nextjs
    console.error('[GlobalError]', error)
  }, [error])

  return (
    <html>
      <body style={{ background: '#080C1A', color: '#fff', fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: '16px', padding: '24px' }}>
        <div style={{ fontSize: '32px' }}>⚠️</div>
        <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Something went wrong</h2>
        <p style={{ fontSize: '13px', color: '#888', textAlign: 'center', maxWidth: '400px' }}>
          Our team has been notified. Please try again or contact support if the issue persists.
        </p>
        <button
          onClick={reset}
          style={{ marginTop: '8px', padding: '10px 24px', background: '#8B5CF6', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
          Try again
        </button>
      </body>
    </html>
  )
}
