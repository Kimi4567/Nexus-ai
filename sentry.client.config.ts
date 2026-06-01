/**
 * Sentry — client-side config
 * Docs: https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture 10% of transactions for performance monitoring (keep costs low)
  tracesSampleRate: 0.1,

  // Capture session replays on errors only
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0,

  // Don't send errors in dev
  enabled: process.env.NODE_ENV === 'production',

  // Clean up noisy errors
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
    /^AbortError/,
    /^NetworkError/,
    'Load failed',
  ],
})
