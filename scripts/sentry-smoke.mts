/**
 * Sends one privacy-safe operational event through the same helper used by
 * production routes. Run only with explicit SENTRY_ENABLED and SENTRY_DSN.
 */
async function main() {
  if (process.env.SENTRY_ENABLED !== 'true' || !process.env.SENTRY_DSN) {
    throw new Error('Sentry smoke test requires SENTRY_ENABLED=true and SENTRY_DSN')
  }

  await import('../src/sentry.server.config.ts')
  const { captureOperationalError } = await import(
    '../src/lib/observability/operationalError.ts'
  )

  const report = await captureOperationalError(
    Object.assign(new Error('Controlled observability smoke test'), {
      code: 'SENTRY_SMOKE_TEST',
    }),
    {
      operation: 'observability-smoke-test',
      route: '/internal/observability-smoke-test',
      component: 'application',
      method: 'POST',
      statusCode: 503,
      retryable: false,
      severity: 'warning',
    },
  )

  const { normalizeSentryModule } = await import(
    '../src/lib/observability/sentryModule.ts'
  )
  const Sentry = normalizeSentryModule(await import('@sentry/nextjs'))
  const flushed = await Sentry.flush(5_000)

  console.log(JSON.stringify({
    reportedExternally: report.reportedExternally,
    flushed,
    errorName: report.errorName,
    errorCode: report.errorCode,
  }))

  if (!report.reportedExternally || !flushed) process.exitCode = 1
}

await main()
