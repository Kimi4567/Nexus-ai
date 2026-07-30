import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  checkAiProviderHealth,
  resetAiProviderHealthCache,
} from '@/lib/ai/providerHealth'

describe('checkAiProviderHealth', () => {
  beforeEach(() => resetAiProviderHealthCache())

  it('reports an unconfigured provider without making a request', async () => {
    const fetchImpl = vi.fn()
    const health = await checkAiProviderHealth({ env: {}, fetchImpl })

    expect(health).toMatchObject({
      configured: false,
      ready: false,
      provider: null,
      state: 'unconfigured',
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('proves the configured OpenAI credential with a minimal generation', async () => {
    let now = 1_000
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'OK' } }],
    }), { status: 200 }))

    const health = await checkAiProviderHealth({
      env: { OPENAI_API_KEY: 'test-secret' },
      fetchImpl,
      now: () => {
        now += 25
        return now
      },
      force: true,
    })

    expect(health).toMatchObject({
      configured: true,
      ready: true,
      reachable: true,
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
      state: 'healthy',
      status: 200,
    })
    const [, init] = fetchImpl.mock.calls[0]
    expect(init.headers.Authorization).toBe('Bearer test-secret')
    expect(JSON.parse(init.body)).toMatchObject({
      model: 'gpt-4o-mini',
      max_tokens: 4,
    })
  })

  it('classifies authentication failures without exposing credentials', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('invalid token', { status: 401 }))

    const health = await checkAiProviderHealth({
      env: { AI_GATEWAY_API_KEY: 'super-secret-token' },
      fetchImpl,
      force: true,
    })

    expect(health).toMatchObject({
      configured: true,
      ready: false,
      reachable: true,
      provider: 'Vercel AI Gateway',
      state: 'authentication_failed',
      status: 401,
    })
    expect(JSON.stringify(health)).not.toContain('super-secret-token')
    expect(JSON.stringify(health)).not.toContain('invalid token')
  })

  it('uses the Gateway minimum output budget and proves OIDC readiness', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'OK' } }],
    }), { status: 200 }))

    const health = await checkAiProviderHealth({
      env: { VERCEL_OIDC_TOKEN: 'oidc-token' },
      fetchImpl,
      force: true,
    })

    expect(health).toMatchObject({
      ready: true,
      provider: 'Vercel AI Gateway',
      state: 'healthy',
    })
    const [, init] = fetchImpl.mock.calls[0]
    expect(JSON.parse(init.body)).toMatchObject({
      model: 'openai/gpt-4.1-mini',
      max_tokens: 16,
    })
  })

  it('discovers request-context OIDC before probing a direct OpenAI fallback', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'OK' } }],
    }), { status: 200 }))

    const health = await checkAiProviderHealth({
      env: { OPENAI_API_KEY: 'exhausted-direct-key' },
      oidcTokenResolver: vi.fn(async () => 'request-context-oidc'),
      fetchImpl,
      force: true,
    })

    expect(health).toMatchObject({
      ready: true,
      provider: 'Vercel AI Gateway',
      state: 'healthy',
    })
    const [input, init] = fetchImpl.mock.calls[0]
    expect(input).toBe('https://ai-gateway.vercel.sh/v1/chat/completions')
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer request-context-oidc')
  })

  it('distinguishes exhausted quota from a transient 429 rate limit', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { type: 'insufficient_quota', code: 'credit_balance_exhausted' },
    }), { status: 429 }))

    const health = await checkAiProviderHealth({
      env: { OPENAI_API_KEY: 'exhausted-key' },
      fetchImpl,
      force: true,
    })

    expect(health).toMatchObject({
      ready: false,
      reachable: true,
      provider: 'OpenAI',
      state: 'quota_exhausted',
      status: 429,
    })
    expect(JSON.stringify(health)).not.toContain('credit_balance_exhausted')
  })

  it('caches the active probe briefly to protect provider credit', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'OK' } }],
    }), { status: 200 }))
    const options = {
      env: { OPENAI_API_KEY: 'test-secret' },
      fetchImpl,
      now: () => 10_000,
    }

    await checkAiProviderHealth(options)
    await checkAiProviderHealth(options)

    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})
