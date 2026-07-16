import * as Sentry from '@sentry/nextjs'
import {
  isSentryRuntimeEnabled,
  resolveSentryEnvironment,
  resolveSentrySampleRate,
  sanitizeSentryBreadcrumb,
  sanitizeSentryEvent,
} from '@/lib/observability/sentryPrivacy'

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
const enabled = isSentryRuntimeEnabled(process.env.SENTRY_ENABLED, dsn)

Sentry.init({
  dsn: enabled ? dsn : undefined,
  enabled,
  environment: resolveSentryEnvironment(
    process.env.SENTRY_ENVIRONMENT,
    process.env.VERCEL_ENV,
    process.env.NODE_ENV,
  ),
  sendDefaultPii: false,
  enableLogs: false,
  tracesSampleRate: enabled
    ? resolveSentrySampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE, 0.05)
    : 0,
  beforeSend: sanitizeSentryEvent,
  beforeSendTransaction: sanitizeSentryEvent,
  beforeBreadcrumb: sanitizeSentryBreadcrumb,
})
