import { getVercelOidcToken } from '@vercel/oidc'
import {
  AiProviderRequestError,
  fetchAiProvider,
  getAiProviderCircuitSnapshot,
} from './providerFetch'

export type AiProviderHealthState =
  | 'healthy'
  | 'unconfigured'
  | 'authentication_failed'
  | 'quota_exhausted'
  | 'rate_limited'
  | 'circuit_open'
  | 'unreachable'
  | 'invalid_response'
  | 'provider_error'

export interface AiProviderHealth {
  configured: boolean
  ready: boolean
  reachable: boolean
  provider: 'Vercel AI Gateway' | 'OpenAI' | null
  model: string | null
  state: AiProviderHealthState
  status: number | null
  latencyMs: number | null
  checkedAt: string
  circuit: {
    open: boolean
    consecutiveFailures: number
    retryAfterMs: number
  } | null
}

interface ProviderHealthConfig {
  endpoint: string
  token: string
  model: string
  provider: 'Vercel AI Gateway' | 'OpenAI'
}

interface CheckAiProviderHealthOptions {
  env?: Record<string, string | undefined>
  fetchImpl?: typeof fetch
  now?: () => number
  timeoutMs?: number
  cacheTtlMs?: number
  force?: boolean
  oidcTokenResolver?: () => Promise<string | null | undefined>
}

interface CachedHealth {
  expiresAt: number
  health: AiProviderHealth
}

const healthCache = new Map<string, CachedHealth>()

function getProviderHealthConfig(
  env: Record<string, string | undefined>,
): ProviderHealthConfig | null {
  const gatewayToken = env.AI_GATEWAY_API_KEY?.trim() || env.VERCEL_OIDC_TOKEN?.trim()
  if (gatewayToken) {
    return {
      endpoint: env.AI_GATEWAY_BASE_URL?.trim()
        || 'https://ai-gateway.vercel.sh/v1/chat/completions',
      token: gatewayToken,
      model: env.AI_GATEWAY_HEALTH_MODEL?.trim()
        || env.AI_GATEWAY_STRATEGY_FALLBACK_MODEL?.trim()
        || 'openai/gpt-4.1-mini',
      provider: 'Vercel AI Gateway',
    }
  }

  const openAIKey = env.OPENAI_API_KEY?.trim()
  if (!openAIKey) return null

  return {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    token: openAIKey,
    model: env.OPENAI_HEALTH_MODEL?.trim() || 'gpt-4o-mini',
    provider: 'OpenAI',
  }
}

function cacheKey(config: ProviderHealthConfig): string {
  return `${config.provider}:${config.endpoint}:${config.model}`
}

function classifyProviderFailure(
  error: unknown,
): Pick<AiProviderHealth, 'state' | 'status' | 'reachable'> {
  if (!(error instanceof AiProviderRequestError)) {
    return { state: 'provider_error', status: null, reachable: false }
  }
  if (error.status === 401 || error.status === 403) {
    return { state: 'authentication_failed', status: error.status, reachable: true }
  }
  if (error.status === 402) {
    return { state: 'quota_exhausted', status: error.status, reachable: true }
  }
  if (error.status === 429) {
    const excerpt = error.responseExcerpt?.toLowerCase() || ''
    if (
      excerpt.includes('insufficient_quota')
      || excerpt.includes('credit_balance_exhausted')
      || excerpt.includes('organization_spend_limit_exceeded')
      || excerpt.includes('project_spend_limit_exceeded')
      || excerpt.includes('organization_usage_limit_exceeded')
    ) {
      return { state: 'quota_exhausted', status: error.status, reachable: true }
    }
    return { state: 'rate_limited', status: error.status, reachable: true }
  }
  if (error.status === null) {
    return { state: 'unreachable', status: null, reachable: false }
  }
  return { state: 'provider_error', status: error.status, reachable: true }
}

function cacheHealth(key: string, health: AiProviderHealth, expiresAt: number): AiProviderHealth {
  healthCache.set(key, { health, expiresAt })
  return health
}

/**
 * Performs a tiny authenticated generation so readiness proves that the
 * configured credential, provider and model can actually serve AI work.
 */
export async function checkAiProviderHealth(
  options: CheckAiProviderHealthOptions = {},
): Promise<AiProviderHealth> {
  let env = options.env ?? process.env
  const gatewayToken = env.AI_GATEWAY_API_KEY?.trim() || env.VERCEL_OIDC_TOKEN?.trim()
  if (!gatewayToken && (options.oidcTokenResolver || options.env === undefined)) {
    try {
      const runtimeOidcToken = (
        await (options.oidcTokenResolver ?? getVercelOidcToken)()
      )?.trim()
      if (runtimeOidcToken) {
        env = {
          ...env,
          VERCEL_OIDC_TOKEN: runtimeOidcToken,
        }
      }
    } catch {
      // The normal unconfigured/direct-provider classification below remains
      // authoritative when no Vercel request context is available.
    }
  }
  const now = options.now ?? Date.now
  const startedAt = now()
  const checkedAt = new Date(startedAt).toISOString()
  const config = getProviderHealthConfig(env)

  if (!config) {
    return {
      configured: false,
      ready: false,
      reachable: false,
      provider: null,
      model: null,
      state: 'unconfigured',
      status: null,
      latencyMs: null,
      checkedAt,
      circuit: null,
    }
  }

  const key = cacheKey(config)
  const circuit = getAiProviderCircuitSnapshot(config.endpoint, config.provider, startedAt)
  if (circuit.open) {
    healthCache.delete(key)
    return {
      configured: true,
      ready: false,
      reachable: false,
      provider: config.provider,
      model: config.model,
      state: 'circuit_open',
      status: null,
      latencyMs: 0,
      checkedAt,
      circuit,
    }
  }

  const cached = healthCache.get(key)
  if (!options.force && cached && cached.expiresAt > startedAt) return cached.health

  const cacheTtlMs = Math.max(0, options.cacheTtlMs ?? 60_000)
  try {
    const response = await fetchAiProvider(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: 'Reply with OK.' }],
        temperature: 0,
        // AI Gateway rejects output budgets below 16 even for a one-word probe.
        max_tokens: config.provider === 'Vercel AI Gateway' ? 16 : 4,
      }),
    }, {
      providerName: config.provider,
      timeoutMs: options.timeoutMs ?? 8_000,
      maxAttempts: 1,
      fetchImpl: options.fetchImpl,
      oidcTokenResolver: options.env === undefined
        ? options.oidcTokenResolver
        : async () => env.VERCEL_OIDC_TOKEN?.trim() || null,
      circuitBreaker: false,
    })

    const payload = await response.json().catch(() => null) as {
      choices?: Array<{ message?: { content?: unknown } }>
    } | null
    const hasContent = typeof payload?.choices?.[0]?.message?.content === 'string'
    const finishedAt = now()
    const health: AiProviderHealth = {
      configured: true,
      ready: hasContent,
      reachable: true,
      provider: config.provider,
      model: config.model,
      state: hasContent ? 'healthy' : 'invalid_response',
      status: response.status,
      latencyMs: Math.max(0, finishedAt - startedAt),
      checkedAt,
      circuit,
    }
    return cacheHealth(key, health, finishedAt + cacheTtlMs)
  } catch (error) {
    const failure = classifyProviderFailure(error)
    const finishedAt = now()
    return cacheHealth(key, {
      configured: true,
      ready: false,
      provider: config.provider,
      model: config.model,
      latencyMs: Math.max(0, finishedAt - startedAt),
      checkedAt,
      circuit,
      ...failure,
    }, finishedAt + cacheTtlMs)
  }
}

/** Test-only cache reset. */
export function resetAiProviderHealthCache(): void {
  healthCache.clear()
}
