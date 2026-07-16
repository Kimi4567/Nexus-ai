import * as Sentry from '@sentry/nextjs'
import {
  isSentryRuntimeEnabled,
  resolveSentryEnvironment,
  resolveSentrySampleRate,
  sanitizeSentryBreadcrumb,
  sanitizeSentryEvent,
} from '@/lib/observability/sentryPrivacy'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
const enabled = isSentryRuntimeEnabled(
  process.env.NEXT_PUBLIC_SENTRY_ENABLED,
  dsn,
)

Sentry.init({
  dsn: enabled ? dsn : undefined,
  enabled,
  environment: resolveSentryEnvironment(
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
    undefined,
    process.env.NODE_ENV,
  ),
  sendDefaultPii: false,
  enableLogs: false,
  tracesSampleRate: enabled
    ? resolveSentrySampleRate(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE, 0.05)
    : 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  beforeSend: sanitizeSentryEvent,
  beforeSendTransaction: sanitizeSentryEvent,
  beforeBreadcrumb: sanitizeSentryBreadcrumb,
  ignoreErrors: [
    'ResizeObserver loop completed with undelivered notifications',
    'ResizeObserver loop limit exceeded',
    /^AbortError$/,
    /^NetworkError$/,
  ],
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
