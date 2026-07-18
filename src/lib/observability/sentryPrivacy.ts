const FILTERED_VALUE = '[Filtered]'

const SAFE_REQUEST_HEADERS = new Set([
  'accept',
  'content-length',
  'content-type',
  'x-matched-path',
  'x-vercel-cache',
  'x-vercel-id',
])

const SENSITIVE_KEY_PARTS = [
  'access_token',
  'apikey',
  'api_key',
  'authorization',
  'authorization_code',
  'client_secret',
  'cookie',
  'email',
  'id_token',
  'oauth_code',
  'passwd',
  'password',
  'phone',
  'prompt',
  'query',
  'query_string',
  'refresh_token',
  'request_body',
  'response_body',
  'secret',
  'session',
  'set_cookie',
  'token',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase()
}

function isSensitiveKey(key: string): boolean {
  const normalized = normalizeKey(key)
  return SENSITIVE_KEY_PARTS.some((part) => (
    normalized === part
    || normalized.startsWith(`${part}_`)
    || normalized.endsWith(`_${part}`)
    || normalized.includes(`_${part}_`)
  ))
}

export function isValidSentryDsn(dsn: string | undefined): boolean {
  if (!dsn || dsn.includes('...') || dsn.includes('your-')) return false

  try {
    const parsed = new URL(dsn)
    return (
      (parsed.protocol === 'https:' || parsed.protocol === 'http:')
      && parsed.username.length > 0
      && parsed.hostname.length > 0
      && parsed.pathname !== '/'
    )
  } catch {
    return false
  }
}

export function isSentryRuntimeEnabled(
  enabledValue: string | undefined,
  dsn: string | undefined,
): boolean {
  return enabledValue?.trim().toLowerCase() === 'true' && isValidSentryDsn(dsn)
}

export function resolveSentrySampleRate(
  configuredValue: string | undefined,
  fallback: number,
): number {
  if (!configuredValue?.trim()) return fallback

  const parsed = Number(configuredValue)
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1
    ? parsed
    : fallback
}

export function resolveSentryEnvironment(
  explicitEnvironment: string | undefined,
  platformEnvironment: string | undefined,
  nodeEnvironment: string | undefined,
): string {
  return explicitEnvironment?.trim()
    || platformEnvironment?.trim()
    || nodeEnvironment?.trim()
    || 'unknown'
}

export function stripUrlQueryAndFragment(value: string): string {
  try {
    const absolute = /^[a-z][a-z\d+.-]*:\/\//i.test(value)
    const parsed = new URL(value, 'https://nexus.invalid')
    return absolute ? `${parsed.origin}${parsed.pathname}` : parsed.pathname
  } catch {
    return value.split(/[?#]/, 1)[0] ?? value
  }
}

export function sanitizeSentryText(value: string): string {
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, FILTERED_VALUE)
    .replace(/\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g, FILTERED_VALUE)
    .replace(/(bearer\s+)[a-z0-9._~+/=-]+/gi, `$1${FILTERED_VALUE}`)
    .replace(
      /\b(password|passwd|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|authorization[_-]?code)\s*[:=]\s*[^\s,;]+/gi,
      `$1=${FILTERED_VALUE}`,
    )
    .replace(
      /([?&](?:access_token|api_key|apikey|authorization_code|code|id_token|nonce|refresh_token|secret|session|state|token)=)[^&#\s]+/gi,
      `$1${FILTERED_VALUE}`,
    )
}

export function getPrivacySafeErrorName(error: unknown): string {
  const candidate = error instanceof Error && error.name ? error.name : 'UnknownError'
  const normalized = candidate.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 80)
  return normalized || 'UnknownError'
}

export function getPrivacySafeErrorCode(error: unknown): string | null {
  if (!isRecord(error)) return null
  const candidate = error.code
  if (typeof candidate !== 'string' && typeof candidate !== 'number') return null
  const normalized = String(candidate).replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 80)
  return normalized || null
}

/**
 * Preserves stack frames for debugging without forwarding the provider/database
 * message, which may contain customer content, credentials, or query values.
 */
export function createPrivacySafeError(error: unknown, operation: string): Error {
  const safeOperation = operation.replace(/[^a-zA-Z0-9_.:/ -]/g, '').trim().slice(0, 120)
    || 'Operational request'
  const safeError = new Error(`${safeOperation} failed`)
  safeError.name = getPrivacySafeErrorName(error)

  if (error instanceof Error && typeof error.stack === 'string') {
    const frames = error.stack
      .split('\n')
      .filter((line) => line.trimStart().startsWith('at '))
      .slice(0, 50)
    if (frames.length > 0) {
      safeError.stack = `${safeError.name}: ${safeError.message}\n${frames.join('\n')}`
    }
  }

  return safeError
}

function sanitizeValue(
  value: unknown,
  key: string | undefined,
  depth: number,
  seen: WeakSet<object>,
): unknown {
  if (key && isSensitiveKey(key)) return FILTERED_VALUE
  if (typeof value === 'string') {
    const normalizedKey = key ? normalizeKey(key) : ''
    const safeValue = normalizedKey === 'url'
      || normalizedKey.endsWith('_url')
      || normalizedKey === 'from'
      || normalizedKey === 'to'
      ? stripUrlQueryAndFragment(value)
      : value
    return sanitizeSentryText(safeValue)
  }
  if (value === null || value === undefined || typeof value !== 'object') return value
  if (depth >= 6) return '[Truncated]'
  if (seen.has(value)) return '[Circular]'

  seen.add(value)

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, undefined, depth + 1, seen))
  }

  if (value instanceof Date) return value.toISOString()

  return Object.fromEntries(
    Object.entries(value).map(([entryKey, entryValue]) => [
      entryKey,
      sanitizeValue(entryValue, entryKey, depth + 1, seen),
    ]),
  )
}

function sanitizeRequestHeaders(headers: unknown): Record<string, unknown> | undefined {
  if (!isRecord(headers)) return undefined

  const safeHeaders = Object.entries(headers).filter(([key]) => (
    SAFE_REQUEST_HEADERS.has(key.toLowerCase())
  ))

  return safeHeaders.length > 0
    ? Object.fromEntries(safeHeaders.map(([key, value]) => [key, sanitizeValue(value, key, 0, new WeakSet())]))
    : undefined
}

/**
 * Strict, product-level privacy filter for Sentry error and transaction events.
 * Request bodies, query strings, cookies, headers, and user identity are removed.
 */
export function sanitizeSentryEvent<T>(event: T): T {
  if (!isRecord(event)) return event
  const mutableEvent: Record<string, unknown> = event

  if (typeof mutableEvent.message === 'string') {
    mutableEvent.message = sanitizeSentryText(mutableEvent.message)
  }

  if (typeof mutableEvent.transaction === 'string') {
    mutableEvent.transaction = sanitizeSentryText(mutableEvent.transaction)
  }

  if (isRecord(mutableEvent.request)) {
    const request = mutableEvent.request
    if (typeof request.url === 'string') {
      request.url = stripUrlQueryAndFragment(request.url)
    }

    const safeHeaders = sanitizeRequestHeaders(request.headers)
    if (safeHeaders) request.headers = safeHeaders
    else delete request.headers

    delete request.cookies
    delete request.data
    delete request.env
    delete request.query_string
  }

  // User identifiers are intentionally omitted until Nexus has an explicit
  // monitoring privacy policy and a documented support need for correlation.
  delete mutableEvent.user

  for (const field of ['contexts', 'extra', 'spans', 'tags'] as const) {
    if (mutableEvent[field] !== undefined) {
      mutableEvent[field] = sanitizeValue(mutableEvent[field], field, 0, new WeakSet())
    }
  }

  if (Array.isArray(mutableEvent.breadcrumbs)) {
    mutableEvent.breadcrumbs = mutableEvent.breadcrumbs
      .map((breadcrumb) => sanitizeSentryBreadcrumb(breadcrumb))
      .filter((breadcrumb) => breadcrumb !== null)
  }

  if (mutableEvent.exception !== undefined) {
    mutableEvent.exception = sanitizeValue(mutableEvent.exception, 'exception', 0, new WeakSet())
  }

  if (isRecord(mutableEvent.exception) && Array.isArray(mutableEvent.exception.values)) {
    mutableEvent.exception.values = mutableEvent.exception.values.map((exceptionValue) => {
      if (!isRecord(exceptionValue)) return exceptionValue
      if (typeof exceptionValue.value !== 'string') return exceptionValue
      return { ...exceptionValue, value: sanitizeSentryText(exceptionValue.value) }
    })
  }

  return event as T
}

/** Removes console breadcrumbs and sensitive values from navigation/fetch breadcrumbs. */
export function sanitizeSentryBreadcrumb<T>(breadcrumb: T): T | null {
  if (!isRecord(breadcrumb)) return breadcrumb
  const mutableBreadcrumb: Record<string, unknown> = breadcrumb

  const category = typeof mutableBreadcrumb.category === 'string'
    ? mutableBreadcrumb.category.toLowerCase()
    : ''
  if (category === 'console' || category.startsWith('console.')) return null

  if (typeof mutableBreadcrumb.message === 'string') {
    mutableBreadcrumb.message = sanitizeSentryText(mutableBreadcrumb.message)
  }

  if (isRecord(mutableBreadcrumb.data)) {
    const sanitizedData = sanitizeValue(mutableBreadcrumb.data, 'data', 0, new WeakSet())
    if (isRecord(sanitizedData) && typeof sanitizedData.url === 'string') {
      sanitizedData.url = stripUrlQueryAndFragment(sanitizedData.url)
    }
    mutableBreadcrumb.data = sanitizedData
  }

  return breadcrumb as T
}
