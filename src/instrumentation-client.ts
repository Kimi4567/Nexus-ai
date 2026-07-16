import {
  isSentryRuntimeEnabled,
  resolveSentryEnvironment,
  resolveSentrySampleRate,
  sanitizeSentryBreadcrumb,
  sanitizeSentryEvent,
} from '@/lib/observability/sentryPrivacy'
import {
  normalizeSentryModule,
  type SentryModule,
} from '@/lib/observability/sentryModule'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
const enabled = isSentryRuntimeEnabled(
  process.env.NEXT_PUBLIC_SENTRY_ENABLED,
  dsn,
)

type RouterTransitionArgs = Parameters<SentryModule['captureRouterTransitionStart']>

let sentryModulePromise: Promise<SentryModule> | null = null

function loadSentry(): Promise<SentryModule> {
  sentryModulePromise ??= import('@sentry/nextjs').then(normalizeSentryModule)
  return sentryModulePromise
}

if (enabled) {
  void loadSentry()
    .then((Sentry) => {
      Sentry.init({
        dsn,
        environment: resolveSentryEnvironment(
          process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
          process.env.NEXT_PUBLIC_VERCEL_ENV,
          process.env.NODE_ENV,
        ),
        sendDefaultPii: false,
        enableLogs: false,
        tracesSampleRate: resolveSentrySampleRate(
          process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
          0.05,
        ),
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
    })
    .catch(() => {
      console.error(JSON.stringify({
        level: 'error',
        message: 'Client observability initialization failed',
        occurredAt: new Date().toISOString(),
      }))
    })
}

export function onRouterTransitionStart(...args: RouterTransitionArgs): void {
  if (!enabled) return
  void loadSentry()
    .then((Sentry) => Sentry.captureRouterTransitionStart(...args))
    .catch(() => undefined)
}
