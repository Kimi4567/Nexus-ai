'use client'

import { useState } from 'react'
import { normalizeSentryModule } from '@/lib/observability/sentryModule'

type SmokeStatus = 'idle' | 'sending' | 'delivered' | 'failed'

const STATUS_COPY: Record<SmokeStatus, string> = {
  idle: 'Ready to send a controlled, privacy-safe browser event.',
  sending: 'Sending the controlled event…',
  delivered: 'Browser event delivered to Sentry.',
  failed: 'Sentry did not confirm delivery. Check the Preview configuration.',
}

export function BrowserSentrySmoke() {
  const [status, setStatus] = useState<SmokeStatus>('idle')

  async function sendControlledEvent() {
    if (status === 'sending') return
    setStatus('sending')

    try {
      const Sentry = normalizeSentryModule(await import('@sentry/nextjs'))
      const controlledError = new Error('browser-observability-smoke-test failed')
      controlledError.name = 'ControlledBrowserSmokeError'

      Sentry.withScope((scope) => {
        scope.setLevel('warning')
        scope.setTag('nexus.component', 'application')
        scope.setTag('nexus.operation', 'browser-observability-smoke-test')
        scope.setTag('nexus.route', '/internal/observability-smoke')
        scope.setTag('nexus.error_code', 'SENTRY_BROWSER_SMOKE_TEST')
        scope.setContext('verification', {
          controlled: true,
          containsCustomerData: false,
          runtime: 'browser',
        })
        Sentry.captureException(controlledError)
      })

      const delivered = await Sentry.flush(5_000)
      setStatus(delivered ? 'delivered' : 'failed')
    } catch {
      setStatus('failed')
    }
  }

  return (
    <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
        Preview-only verification
      </p>
      <h1 className="mt-3 text-2xl font-bold text-slate-950">
        Browser observability smoke test
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-600" aria-live="polite">
        {STATUS_COPY[status]}
      </p>
      <button
        type="button"
        onClick={sendControlledEvent}
        disabled={status === 'sending' || status === 'delivered'}
        className="mt-6 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {status === 'sending' ? 'Sending…' : 'Send controlled browser event'}
      </button>
    </section>
  )
}
