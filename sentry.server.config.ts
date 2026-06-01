/**
 * Sentry — server-side config (stub)
 * To activate: npm install @sentry/nextjs, then uncomment the code below.
 *
 * import * as Sentry from '@sentry/nextjs'
 * Sentry.init({
 *   dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
 *   tracesSampleRate: 0.1,
 *   enabled: process.env.NODE_ENV === 'production',
 *   beforeSend(event) {
 *     if (event.request?.data) {
 *       const data = event.request.data as Record<string, unknown>
 *       if (data.password) data.password = '[Filtered]'
 *       if (data.token)    data.token    = '[Filtered]'
 *     }
 *     return event
 *   },
 * })
 */
export {}
