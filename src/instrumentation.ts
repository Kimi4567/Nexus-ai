import type { Instrumentation } from 'next'
import {
  createPrivacySafeError,
  getPrivacySafeErrorName,
  isSentryRuntimeEnabled,
} from '@/lib/observability/sentryPrivacy'
import { normalizeSentryModule } from '@/lib/observability/sentryModule'

/**
 * Next.js server observability baseline.
 *
 * Errors are emitted as structured, privacy-safe JSON for Vercel Runtime Logs.
 * We intentionally avoid request paths, bodies, cookies, authorization headers,
 * and stacks because those may contain customer or workspace data.
 */
export async function register() {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!isSentryRuntimeEnabled(process.env.SENTRY_ENABLED, dsn)) return

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

function normalizeRequestError(error: unknown): { name: string; digest: string | null } {
  if (error instanceof Error) {
    const digest = 'digest' in error && typeof error.digest === 'string'
      ? error.digest
      : null

    return {
      name: getPrivacySafeErrorName(error),
      digest,
    }
  }

  return {
    name: 'UnknownError',
    digest: null,
  }
}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  const normalizedError = normalizeRequestError(error)
  const requestIdHeader = request.headers['x-vercel-id']
  const requestId = Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader

  console.error(JSON.stringify({
    level: 'error',
    message: 'Unhandled server request error',
    errorName: normalizedError.name,
    digest: normalizedError.digest,
    requestId: requestId ?? null,
    method: request.method,
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
    runtime: process.env.NEXT_RUNTIME ?? 'unknown',
    occurredAt: new Date().toISOString(),
  }))

  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!isSentryRuntimeEnabled(process.env.SENTRY_ENABLED, dsn)) return

  const Sentry = normalizeSentryModule(await import('@sentry/nextjs'))
  Sentry.captureRequestError(
    createPrivacySafeError(error, 'unhandled-server-request'),
    request,
    context,
  )
}
