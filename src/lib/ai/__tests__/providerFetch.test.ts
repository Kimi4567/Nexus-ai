import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AI_PROVIDER_REQUEST_FAILED_CODE,
  AI_PROVIDER_CIRCUIT_OPEN_CODE,
  AiProviderRequestError,
  fetchAiProvider,
  resolveAiProviderRequest,
  resetAiProviderCircuitBreakers,
} from '@/lib/ai/providerFetch'

const options = {
  providerName: 'Test provider',
  timeoutMs: 100,
  baseDelayMs: 1,
  maxDelayMs: 10,
  sleep: vi.fn(async () => {}),
  random: () => 0,
}

describe('fetchAiProvider', () => {
  beforeEach(() => resetAiProviderCircuitBreakers())

  it('retries a rate limit response and returns the successful response', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('limited', {
        status: 429,
        headers: { 'retry-after': '0' },
      }))
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }))

    const response = await fetchAiProvider('https://provider.example/v1', {}, {
      ...options,
      fetchImpl,
    })

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(await response.json()).toEqual({ ok: true })
  })

  it('routes direct OpenAI text calls through Gateway OIDC without response_format', () => {
    const resolved = resolveAiProviderRequest(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer exhausted-openai-key',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: 'Return a campaign.' },
            { role: 'user', content: 'Create it.' },
          ],
          response_format: { type: 'json_object' },
        }),
      },
      {
        env: { VERCEL_OIDC_TOKEN: 'oidc-token' },
        providerName: 'OpenAI strategist',
      },
    )

    expect(resolved).toMatchObject({
      input: 'https://ai-gateway.vercel.sh/v1/chat/completions',
      providerName: 'Vercel AI Gateway',
      routedThroughGateway: true,
    })
    expect(new Headers(resolved.init.headers).get('Authorization')).toBe('Bearer oidc-token')
    const body = JSON.parse(String(resolved.init.body))
    expect(body).toMatchObject({
      model: 'openai/gpt-4o',
      providerOptions: {
        gateway: { models: ['openai/gpt-4.1-mini'] },
      },
    })
    expect(body.response_format).toBeUndefined()
    expect(body.messages[0].content).toContain('JSON OUTPUT CONTRACT')
  })

  it('retrieves request-context OIDC before falling back to the direct OpenAI key', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{"ok":true}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))

    await fetchAiProvider(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer exhausted-openai-key',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'Create a strategy.' }],
          response_format: { type: 'json_object' },
        }),
      },
      {
        ...options,
        maxAttempts: 1,
        fetchImpl,
        oidcTokenResolver: vi.fn(async () => 'request-context-oidc'),
      },
    )

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [input, init] = fetchImpl.mock.calls[0]
    expect(input).toBe('https://ai-gateway.vercel.sh/v1/chat/completions')
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer request-context-oidc')
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: 'openai/gpt-4o',
      providerOptions: {
        gateway: { models: ['openai/gpt-4.1-mini'] },
      },
    })
  })

  it('keeps direct OpenAI behavior when Gateway credentials are absent', () => {
    const init = {
      method: 'POST',
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [] }),
    }
    const resolved = resolveAiProviderRequest(
      'https://api.openai.com/v1/chat/completions',
      init,
      { env: { OPENAI_API_KEY: 'direct-key' }, providerName: 'OpenAI' },
    )

    expect(resolved).toEqual({
      input: 'https://api.openai.com/v1/chat/completions',
      init,
      providerName: 'OpenAI',
      routedThroughGateway: false,
    })
  })

  it('retries transient server errors', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))

    await expect(fetchAiProvider('https://provider.example/v1', {}, {
      ...options,
      fetchImpl,
    })).resolves.toBeInstanceOf(Response)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('does not retry a permanent request error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('bad input', { status: 400 }))

    const failure = fetchAiProvider('https://provider.example/v1', {}, {
      ...options,
      fetchImpl,
    })

    await expect(failure).rejects.toMatchObject({
      code: AI_PROVIDER_REQUEST_FAILED_CODE,
      status: 400,
      retryable: false,
      attempts: 1,
      responseExcerpt: 'bad input',
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('retries network failures and exposes a structured final error', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('network unavailable'))

    const failure = fetchAiProvider('https://provider.example/v1', {}, {
      ...options,
      maxAttempts: 2,
      fetchImpl,
    })

    await expect(failure).rejects.toBeInstanceOf(AiProviderRequestError)
    await expect(failure).rejects.toMatchObject({
      status: null,
      retryable: true,
      attempts: 2,
    })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('opens the circuit after repeated provider-wide failures and recovers after cooldown', async () => {
    let now = 1_000
    const fetchImpl = vi.fn()
      .mockResolvedValue(new Response('unavailable', { status: 503 }))
    const circuitOptions = {
      ...options,
      maxAttempts: 1,
      fetchImpl,
      now: () => now,
      circuitBreaker: {
        key: 'provider:test-circuit',
        failureThreshold: 2,
        cooldownMs: 5_000,
      },
    }

    await expect(fetchAiProvider('https://provider.example/v1', {}, circuitOptions))
      .rejects.toMatchObject({ status: 503 })
    await expect(fetchAiProvider('https://provider.example/v1', {}, circuitOptions))
      .rejects.toMatchObject({ status: 503 })

    await expect(fetchAiProvider('https://provider.example/v1', {}, circuitOptions))
      .rejects.toMatchObject({
        code: AI_PROVIDER_CIRCUIT_OPEN_CODE,
        attempts: 0,
        retryAfterMs: 5_000,
      })
    expect(fetchImpl).toHaveBeenCalledTimes(2)

    now += 5_001
    fetchImpl.mockResolvedValueOnce(new Response('ok', { status: 200 }))
    await expect(fetchAiProvider('https://provider.example/v1', {}, circuitOptions))
      .resolves.toBeInstanceOf(Response)
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })
})
