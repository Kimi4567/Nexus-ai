'use client'
/**
 * global-error.tsx — catches unhandled errors in the App Router root layout.
 * Records a privacy-safe client error signal in Runtime Logs and, only when the
 * explicit Sentry gate is enabled, in the external error tracker.
 */
import { useEffect } from 'react'
import { captureClientBoundaryError } from '@/lib/observability/clientError'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    captureClientBoundaryError(error, 'root')
  }, [error])

  return (
    <html>
      <body style={{ background: '#080C1A', color: '#fff', fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: '16px', padding: '24px' }}>
        <div style={{ fontSize: '32px' }}>⚠️</div>
        <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Something went wrong</h2>
        <p style={{ fontSize: '13px', color: '#888', textAlign: 'center', maxWidth: '400px' }}>
          Please try again or contact support if the issue persists.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{ marginTop: '8px', padding: '10px 24px', background: '#8B5CF6', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
          Try again
        </button>
      </body>
    </html>
  )
}
