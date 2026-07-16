import type { Instrumentation } from 'next'
import * as Sentry from '@sentry/nextjs'

/**
 * Next.js server observability baseline.
 *
 * Errors are emitted as structured, privacy-safe JSON for Vercel Runtime Logs.
 * We intentionally avoid request paths, bodies, cookies, authorization headers,
 * and stacks because those may contain customer or workspace data.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

function normalizeRequestError(error: unknown): {
  name: string
  message: string
  digest: string | null
} {
  if (error instanceof Error) {
    const digest = 'digest' in error && typeof error.digest === 'string'
      ? error.digest
      : null

    return {
      name: error.name || 'Error',
      message: error.message || 'Unhandled request error',
      digest,
    }
  }

  return {
    name: 'UnknownError',
    message: typeof error === 'string' ? error : 'Unhandled request error',
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
    errorMessage: normalizedError.message,
    digest: normalizedError.digest,
    requestId: requestId ?? null,
    method: request.method,
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
    runtime: process.env.NEXT_RUNTIME ?? 'unknown',
    occurredAt: new Date().toISOString(),
  }))

  // Sentry.captureRequestError is a no-op while the explicit runtime gate is
  // disabled, so Runtime Logs remain available without sending external data.
  Sentry.captureRequestError(error, request, context)
}
