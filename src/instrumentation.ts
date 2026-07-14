import type { Instrumentation } from 'next'

/**
 * Next.js server observability baseline.
 *
 * Errors are emitted as structured, privacy-safe JSON for Vercel Runtime Logs.
 * We intentionally avoid request paths, bodies, cookies, authorization headers,
 * and stacks because those may contain customer or workspace data.
 */
export function register() {
  // Web Analytics and Speed Insights are initialized in app/layout.tsx.
  // External error forwarding remains disabled until a real provider and secret
  // are configured; Runtime Logs remain the source of truth in the meantime.
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
}
