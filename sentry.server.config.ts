/**
 * Sentry — server-side config (Node.js runtime)
 * Install: npm install @sentry/nextjs
 */
// @ts-ignore — @sentry/nextjs is an optional peer dep; install before enabling
import * as Sentry from '@sentry/nextjs'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SentryEvent = any

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === 'production',

  // Tag every server error with useful context
  beforeSend(event: SentryEvent) {
    // Scrub sensitive data from request bodies
    if (event.request?.data) {
      const data = event.request.data as Record<string, unknown>
      if (data.password) data.password = '[Filtered]'
      if (data.token)    data.token    = '[Filtered]'
    }
    return event
  },
})
