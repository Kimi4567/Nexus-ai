export type SentryModule = typeof import('@sentry/nextjs')

type InteropSentryModule = SentryModule & {
  default?: SentryModule
}

/**
 * Normalizes ESM and CommonJS interop shapes without statically importing the
 * SDK. The latter matters for CLI smoke tests and for runtimes that wrap
 * dynamic imports under `default`.
 */
export function normalizeSentryModule(module: SentryModule): SentryModule {
  const candidate = module as InteropSentryModule
  const resolved = typeof candidate.captureException === 'function'
    ? candidate
    : candidate.default

  if (!resolved || typeof resolved.captureException !== 'function') {
    throw new Error('Sentry SDK module could not be initialized')
  }

  return resolved
}
