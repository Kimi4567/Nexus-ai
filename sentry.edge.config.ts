/**
 * Sentry — edge runtime config
 * Install: npm install @sentry/nextjs
 */
// @ts-ignore — @sentry/nextjs is an optional peer dep; install before enabling
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === 'production',
})
