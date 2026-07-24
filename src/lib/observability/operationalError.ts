import {
  createPrivacySafeError,
  getPrivacySafeErrorCode,
  getPrivacySafeErrorName,
  isSentryRuntimeEnabled,
} from '@/lib/observability/sentryPrivacy'
import { normalizeSentryModule } from '@/lib/observability/sentryModule'

type OperationalErrorSeverity = 'error' | 'warning'

export type OperationalErrorContext = {
  operation: string
  route: string
  component: 'billing' | 'publishing' | 'oauth' | 'ai' | 'credits' | 'database' | 'application'
  method?: string
  requestId?: string | null
  statusCode?: number
  retryable?: boolean
  severity?: OperationalErrorSeverity
}

export type OperationalErrorReport = {
  reportedExternally: boolean
  errorName: string
  errorCode: string | null
}

function safeLabel(value: string | undefined, fallback: string): string {
  if (!value) return fallback
  const normalized = value.replace(/[^a-zA-Z0-9_.:/-]/g, '').slice(0, 120)
  return normalized || fallback
}

export function isExpectedMarketingGovernanceRejection(error: unknown): boolean {
  const name = error instanceof Error ? error.name : ''
  const message = error instanceof Error ? error.message : String(error ?? '')
  return name === 'StrategyQualityFailure'
    || message.startsWith('MARKETING_QUALITY_GATE_BLOCKED:')
    || message.startsWith('BRAND_TRUTH_CONFLICT:')
    || /Strategy OS contract/i.test(message)
}

/**
 * Records a privacy-safe Runtime Log for every operational failure. Sentry is
 * imported only when the explicit server gate and a valid DSN are both present.
 */
export async function captureOperationalError(
  error: unknown,
  context: OperationalErrorContext,
): Promise<OperationalErrorReport> {
  const operation = safeLabel(context.operation, 'unknown-operation')
  const route = safeLabel(context.route, 'unknown-route')
  const errorName = getPrivacySafeErrorName(error)
  const errorCode = getPrivacySafeErrorCode(error)
  const severity = context.severity ?? 'error'

  const logPayload = JSON.stringify({
    level: severity,
    message: 'Operational request failed',
    operation,
    route,
    component: context.component,
    method: context.method ? safeLabel(context.method.toUpperCase(), 'UNKNOWN') : null,
    requestId: context.requestId ? safeLabel(context.requestId, 'unknown-request') : null,
    statusCode: context.statusCode ?? 500,
    retryable: context.retryable ?? false,
    errorName,
    errorCode,
    runtime: process.env.NEXT_RUNTIME ?? 'nodejs',
    occurredAt: new Date().toISOString(),
  })
  if (severity === 'warning') console.warn(logPayload)
  else console.error(logPayload)

  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!isSentryRuntimeEnabled(process.env.SENTRY_ENABLED, dsn)) {
    return { reportedExternally: false, errorName, errorCode }
  }

  try {
    const Sentry = normalizeSentryModule(await import('@sentry/nextjs'))
    const safeError = createPrivacySafeError(error, operation)
    Sentry.withScope((scope) => {
      scope.setLevel(severity)
      scope.setTag('nexus.operation', operation)
      scope.setTag('nexus.route', route)
      scope.setTag('nexus.component', context.component)
      scope.setTag('nexus.retryable', String(context.retryable ?? false))
      if (errorCode) scope.setTag('nexus.error_code', errorCode)
      if (context.statusCode) scope.setTag('http.status_code', String(context.statusCode))
      Sentry.captureException(safeError)
    })
    return { reportedExternally: true, errorName, errorCode }
  } catch {
    console.error(JSON.stringify({
      level: 'error',
      message: 'External error reporting failed',
      operation,
      route,
      occurredAt: new Date().toISOString(),
    }))
    return { reportedExternally: false, errorName, errorCode }
  }
}
