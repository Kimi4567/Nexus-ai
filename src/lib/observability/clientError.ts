'use client'

import {
  createPrivacySafeError,
  getPrivacySafeErrorName,
  isSentryRuntimeEnabled,
} from '@/lib/observability/sentryPrivacy'
import { normalizeSentryModule } from '@/lib/observability/sentryModule'

export function captureClientBoundaryError(
  error: Error & { digest?: string },
  boundary: 'root' | 'segment',
): void {
  const operation = boundary === 'root'
    ? 'app-router.root-boundary'
    : 'app-router.segment-boundary'

  console.error(JSON.stringify({
    level: 'error',
    message: 'Unhandled App Router error',
    boundary,
    errorName: getPrivacySafeErrorName(error),
    digest: typeof error.digest === 'string' ? error.digest.slice(0, 120) : null,
    occurredAt: new Date().toISOString(),
  }))

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!isSentryRuntimeEnabled(process.env.NEXT_PUBLIC_SENTRY_ENABLED, dsn)) return

  void import('@sentry/nextjs')
    .then(normalizeSentryModule)
    .then((Sentry) => {
      Sentry.captureException(createPrivacySafeError(error, operation), {
        tags: { 'nexus.boundary': boundary },
      })
    })
    .catch(() => {
      console.error(JSON.stringify({
        level: 'error',
        message: 'Client error reporting failed',
        boundary,
        occurredAt: new Date().toISOString(),
      }))
    })
}
