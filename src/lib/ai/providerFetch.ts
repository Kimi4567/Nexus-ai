import { getVercelOidcToken } from '@vercel/oidc'

export const AI_PROVIDER_REQUEST_FAILED_CODE = 'AI_PROVIDER_REQUEST_FAILED' as const
export const AI_PROVIDER_CIRCUIT_OPEN_CODE = 'AI_PROVIDER_CIRCUIT_OPEN' as const

const OPENAI_CHAT_COMPLETIONS_ENDPOINT = 'https://api.openai.com/v1/chat/completions'
const DEFAULT_AI_GATEWAY_CHAT_ENDPOINT = 'https://ai-gateway.vercel.sh/v1/chat/completions'
const RETRYABLE_STATUSES = new Set([408, 409, 425, 429, 500, 502, 503, 504])
const PROVIDER_WIDE_FAILURE_STATUSES = new Set([401, 402, 403])

interface CircuitState {
  consecutiveFailures: number
  openedUntil: number
  probeInFlight: boolean
}

const providerCircuits = new Map<string, CircuitState>()

export class AiProviderRequestError extends Error {
  readonly code = AI_PROVIDER_REQUEST_FAILED_CODE
  readonly status: number | null
  readonly retryable: boolean
  readonly attempts: number
  readonly providerName: string
  readonly responseExcerpt: string | null

  constructor(input: {
    message: string
    status: number | null
    retryable: boolean
    attempts: number
    providerName: string
    responseExcerpt?: string | null
  }) {
    super(input.message)
    this.name = 'AiProviderRequestError'
    this.status = input.status
    this.retryable = input.retryable
    this.attempts = input.attempts
    this.providerName = input.providerName
    this.responseExcerpt = input.responseExcerpt ?? null
  }
}

export class AiProviderCircuitOpenError extends Error {
  readonly code = AI_PROVIDER_CIRCUIT_OPEN_CODE
  readonly status = null
  readonly retryable = true
  readonly attempts = 0
  readonly providerName: string
  readonly retryAfterMs: number

  constructor(providerName: string, retryAfterMs: number) {
    super(`${providerName} is temporarily paused after repeated provider failures.`)
    this.name = 'AiProviderCircuitOpenError'
    this.providerName = providerName
    this.retryAfterMs = retryAfterMs
  }
}

export interface AiProviderCircuitBreakerOptions {
  key?: string
  failureThreshold?: number
  cooldownMs?: number
}

export interface AiProviderFetchOptions {
  providerName?: string
  timeoutMs?: number
  maxAttempts?: number
  baseDelayMs?: number
  maxDelayMs?: number
  fetchImpl?: typeof fetch
  sleep?: (delayMs: number) => Promise<void>
  random?: () => number
  now?: () => number
  oidcTokenResolver?: () => Promise<string | null | undefined>
  circuitBreaker?: false | AiProviderCircuitBreakerOptions
}

export interface ResolvedAiProviderRequest {
  input: RequestInfo | URL
  init: RequestInit
  providerName: string
  routedThroughGateway: boolean
}

function normalizeGatewayModel(model: unknown): string | null {
  if (typeof model !== 'string' || !model.trim()) return null
  const normalized = model.trim()
  return normalized.includes('/') ? normalized : `openai/${normalized}`
}

function configuredGatewayFallbacks(
  env: Record<string, string | undefined>,
  primaryModel: string,
): string[] {
  const configured = env.AI_GATEWAY_TEXT_FALLBACK_MODELS
    || env.AI_GATEWAY_STRATEGY_FALLBACK_MODEL
    || 'openai/gpt-4.1-mini'
  return [...new Set(
    configured
      .split(',')
      .map(item => normalizeGatewayModel(item))
      .filter((item): item is string => Boolean(item) && item !== primaryModel),
  )]
}

function appendGatewayJsonContract(
  messages: unknown,
  responseFormat: unknown,
): unknown {
  if (!Array.isArray(messages)) return messages
  const schema = responseFormat
    && typeof responseFormat === 'object'
    && !Array.isArray(responseFormat)
    && (responseFormat as { type?: unknown }).type === 'json_schema'
    ? (responseFormat as { json_schema?: { schema?: unknown } }).json_schema?.schema
    : null
  const instruction = schema
    ? `Return raw JSON only. The JSON must conform exactly to this schema: ${JSON.stringify(schema)}`
    : 'Return exactly one valid JSON value and nothing else. Do not use Markdown fences or commentary.'
  const nextMessages = messages.map(message => (
    message && typeof message === 'object' && !Array.isArray(message)
      ? { ...message as Record<string, unknown> }
      : message
  ))
  const systemIndex = nextMessages.findIndex(message => (
    message
    && typeof message === 'object'
    && !Array.isArray(message)
    && (message as { role?: unknown }).role === 'system'
    && typeof (message as { content?: unknown }).content === 'string'
  ))
  if (systemIndex >= 0) {
    const systemMessage = nextMessages[systemIndex] as Record<string, unknown>
    systemMessage.content = `${systemMessage.content}\n\nJSON OUTPUT CONTRACT (binding):\n${instruction}`
    return nextMessages
  }
  return [{ role: 'system', content: `JSON OUTPUT CONTRACT (binding):\n${instruction}` }, ...nextMessages]
}

/**
 * Routes OpenAI-compatible text calls through Vercel AI Gateway whenever the
 * deployment supplies OIDC or a Gateway key. Direct OpenAI remains the local
 * fallback. The adaptation is centralized so legacy call sites cannot silently
 * bypass the working production credential and hit an exhausted provider key.
 */
export function resolveAiProviderRequest(
  input: RequestInfo | URL,
  init: RequestInit,
  options: {
    env?: Record<string, string | undefined>
    providerName?: string
  } = {},
): ResolvedAiProviderRequest {
  const providerName = options.providerName || 'AI provider'
  const env = options.env ?? process.env
  const endpoint = String(input)
  const gatewayToken = env.AI_GATEWAY_API_KEY?.trim() || env.VERCEL_OIDC_TOKEN?.trim()
  if (endpoint !== OPENAI_CHAT_COMPLETIONS_ENDPOINT || !gatewayToken) {
    return { input, init, providerName, routedThroughGateway: false }
  }

  let body: Record<string, unknown> | null = null
  if (typeof init.body === 'string') {
    try {
      const parsed = JSON.parse(init.body)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        body = parsed as Record<string, unknown>
      }
    } catch {
      body = null
    }
  }
  if (!body) {
    return { input, init, providerName, routedThroughGateway: false }
  }

  const primaryModel = normalizeGatewayModel(body.model)
  if (!primaryModel) {
    return { input, init, providerName, routedThroughGateway: false }
  }

  const responseFormat = body.response_format
  if (responseFormat) {
    body.messages = appendGatewayJsonContract(body.messages, responseFormat)
    delete body.response_format
  }
  body.model = primaryModel

  const fallbackModels = configuredGatewayFallbacks(env, primaryModel)
  if (fallbackModels.length > 0) {
    const existingProviderOptions = body.providerOptions
      && typeof body.providerOptions === 'object'
      && !Array.isArray(body.providerOptions)
      ? body.providerOptions as Record<string, unknown>
      : {}
    const existingGatewayOptions = existingProviderOptions.gateway
      && typeof existingProviderOptions.gateway === 'object'
      && !Array.isArray(existingProviderOptions.gateway)
      ? existingProviderOptions.gateway as Record<string, unknown>
      : {}
    body.providerOptions = {
      ...existingProviderOptions,
      gateway: {
        ...existingGatewayOptions,
        models: Array.isArray(existingGatewayOptions.models)
          ? existingGatewayOptions.models
          : fallbackModels,
      },
    }
  }

  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${gatewayToken}`)
  headers.set('Content-Type', 'application/json')
  return {
    input: env.AI_GATEWAY_BASE_URL?.trim() || DEFAULT_AI_GATEWAY_CHAT_ENDPOINT,
    init: {
      ...init,
      headers,
      body: JSON.stringify(body),
    },
    providerName: 'Vercel AI Gateway',
    routedThroughGateway: true,
  }
}

async function resolveAiProviderRequestForFetch(
  input: RequestInfo | URL,
  init: RequestInit,
  options: AiProviderFetchOptions,
): Promise<ResolvedAiProviderRequest> {
  const resolved = resolveAiProviderRequest(input, init, {
    providerName: options.providerName,
  })
  if (
    resolved.routedThroughGateway
    || String(input) !== OPENAI_CHAT_COMPLETIONS_ENDPOINT
  ) {
    return resolved
  }

  // Vercel may expose the deployment OIDC token through request context rather
  // than as an enumerable process.env value. The official helper handles both
  // surfaces. This keeps every legacy OpenAI-compatible text call on Gateway
  // in production instead of silently falling back to an exhausted direct key.
  try {
    const token = (
      await (options.oidcTokenResolver ?? getVercelOidcToken)()
    )?.trim()
    if (!token) return resolved

    return resolveAiProviderRequest(input, init, {
      providerName: options.providerName,
      env: {
        ...process.env,
        VERCEL_OIDC_TOKEN: token,
      },
    })
  } catch {
    return resolved
  }
}

function circuitKey(
  input: RequestInfo | URL,
  providerName: string,
  configuredKey?: string,
): string {
  if (configuredKey) return configuredKey
  try {
    return `${providerName}:${new URL(String(input)).origin}`
  } catch {
    return `${providerName}:${String(input)}`
  }
}

function getCircuitState(key: string): CircuitState {
  const current = providerCircuits.get(key)
  if (current) return current
  const created = { consecutiveFailures: 0, openedUntil: 0, probeInFlight: false }
  providerCircuits.set(key, created)
  return created
}

function shouldCountCircuitFailure(error: AiProviderRequestError): boolean {
  return error.status === null
    || error.retryable
    || PROVIDER_WIDE_FAILURE_STATUSES.has(error.status)
}

export function getAiProviderCircuitSnapshot(
  input: RequestInfo | URL,
  providerName = 'AI provider',
  now = Date.now(),
): {
  open: boolean
  consecutiveFailures: number
  retryAfterMs: number
} {
  const state = providerCircuits.get(circuitKey(input, providerName))
  if (!state) return { open: false, consecutiveFailures: 0, retryAfterMs: 0 }
  return {
    open: state.openedUntil > now,
    consecutiveFailures: state.consecutiveFailures,
    retryAfterMs: Math.max(0, state.openedUntil - now),
  }
}

/** Test-only state reset; production code should let cooldown and success close circuits. */
export function resetAiProviderCircuitBreakers(): void {
  providerCircuits.clear()
}

function parseRetryAfterMs(value: string | null, now: () => number): number | null {
  if (!value) return null

  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000

  const retryAt = Date.parse(value)
  if (!Number.isFinite(retryAt)) return null
  return Math.max(0, retryAt - now())
}

function providerHttpMessage(providerName: string, status: number): string {
  if (status === 401 || status === 403) {
    return `${providerName} authentication failed (${status}).`
  }
  if (status === 429) {
    return `${providerName} is temporarily rate-limited or has no available quota (429).`
  }
  return `${providerName} request failed (${status}).`
}

async function runFetchWithTimeout(
  fetchImpl: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const upstreamSignal = init.signal
  const abortFromUpstream = () => controller.abort(upstreamSignal?.reason)
  if (upstreamSignal?.aborted) abortFromUpstream()
  else upstreamSignal?.addEventListener('abort', abortFromUpstream, { once: true })

  const timer = setTimeout(() => {
    controller.abort(new DOMException(`AI provider timed out after ${timeoutMs}ms`, 'TimeoutError'))
  }, timeoutMs)

  try {
    return await fetchImpl(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
    upstreamSignal?.removeEventListener('abort', abortFromUpstream)
  }
}

/**
 * Reliability boundary for billable AI calls.
 *
 * Retries only transient HTTP/network failures, applies a hard timeout to every
 * attempt, and throws a typed error once the request is definitively unusable.
 */
export async function fetchAiProvider(
  input: RequestInfo | URL,
  init: RequestInit,
  options: AiProviderFetchOptions = {},
): Promise<Response> {
  const resolvedRequest = await resolveAiProviderRequestForFetch(input, init, options)
  input = resolvedRequest.input
  init = resolvedRequest.init
  const providerName = resolvedRequest.providerName
  const timeoutMs = Math.max(1, options.timeoutMs ?? 45_000)
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? 3))
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 750)
  const maxDelayMs = Math.max(baseDelayMs, options.maxDelayMs ?? 10_000)
  const fetchImpl = options.fetchImpl ?? fetch
  const sleep = options.sleep ?? (delayMs => new Promise(resolve => setTimeout(resolve, delayMs)))
  const random = options.random ?? Math.random
  const now = options.now ?? Date.now
  const breakerOptions = options.circuitBreaker === false
    ? null
    : options.circuitBreaker ?? {}
  const breakerKey = breakerOptions
    ? circuitKey(input, providerName, breakerOptions.key)
    : null
  const breakerState = breakerKey ? getCircuitState(breakerKey) : null
  const failureThreshold = Math.max(1, Math.floor(breakerOptions?.failureThreshold ?? 5))
  const cooldownMs = Math.max(1, breakerOptions?.cooldownMs ?? 30_000)
  const startedAt = now()
  let halfOpenProbe = false

  if (breakerState?.openedUntil && breakerState.openedUntil > startedAt) {
    throw new AiProviderCircuitOpenError(providerName, breakerState.openedUntil - startedAt)
  }
  if (breakerState?.openedUntil && breakerState.openedUntil <= startedAt) {
    if (breakerState.probeInFlight) {
      throw new AiProviderCircuitOpenError(providerName, cooldownMs)
    }
    breakerState.probeInFlight = true
    halfOpenProbe = true
  }

  let lastNetworkError: unknown = null

  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await runFetchWithTimeout(fetchImpl, input, init, timeoutMs)
        if (response.ok) {
          if (breakerKey) providerCircuits.delete(breakerKey)
          return response
        }

        const retryable = RETRYABLE_STATUSES.has(response.status)
        if (!retryable || attempt === maxAttempts) {
          const responseExcerpt = (await response.text().catch(() => '')).slice(0, 300) || null
          throw new AiProviderRequestError({
            message: providerHttpMessage(providerName, response.status),
            status: response.status,
            retryable,
            attempts: attempt,
            providerName,
            responseExcerpt,
          })
        }

        const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'), now)
        const exponentialMs = baseDelayMs * (2 ** (attempt - 1))
        const jitterMs = baseDelayMs * 0.25 * random()
        await sleep(Math.min(retryAfterMs ?? (exponentialMs + jitterMs), maxDelayMs))
      } catch (error) {
        if (error instanceof AiProviderRequestError) throw error
        lastNetworkError = error

        if (attempt === maxAttempts || init.signal?.aborted) {
          throw new AiProviderRequestError({
            message: `${providerName} could not be reached after ${attempt} attempt${attempt === 1 ? '' : 's'}.`,
            status: null,
            retryable: true,
            attempts: attempt,
            providerName,
          })
        }

        const exponentialMs = baseDelayMs * (2 ** (attempt - 1))
        const jitterMs = baseDelayMs * 0.25 * random()
        await sleep(Math.min(exponentialMs + jitterMs, maxDelayMs))
      }
    }

    throw new AiProviderRequestError({
      message: `${providerName} retry loop ended unexpectedly${lastNetworkError ? ' after a network error' : ''}.`,
      status: null,
      retryable: true,
      attempts: maxAttempts,
      providerName,
    })
  } catch (error) {
    if (breakerState && error instanceof AiProviderRequestError && shouldCountCircuitFailure(error)) {
      breakerState.consecutiveFailures = halfOpenProbe
        ? failureThreshold
        : breakerState.consecutiveFailures + 1
      if (breakerState.consecutiveFailures >= failureThreshold) {
        breakerState.openedUntil = now() + cooldownMs
      }
    }
    throw error
  } finally {
    if (halfOpenProbe && breakerState) breakerState.probeInFlight = false
  }
}
