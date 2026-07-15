import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchCreditOperation } from '@/lib/creditOperationClient'

const storage = new Map<string, string>()

beforeEach(() => {
  storage.clear()
  vi.stubGlobal('window', {
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchCreditOperation', () => {
  it('adds an idempotency key without overwriting caller headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await fetchCreditOperation('brand:suggest:description', '/api/brand/suggest', {
      method: 'POST',
      headers: { Authorization: 'Bearer token' },
    })

    const headers = fetchMock.mock.calls[0][1].headers as Headers
    expect(headers.get('Authorization')).toBe('Bearer token')
    expect(headers.get('Idempotency-Key')).toBeTruthy()
    expect(storage.size).toBe(0)
  })

  it('reuses the same key after an ambiguous network failure', async () => {
    const keys: string[] = []
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      keys.push((init?.headers as Headers).get('Idempotency-Key') || '')
      if (keys.length === 1) throw new TypeError('network unavailable')
      return new Response('{}', { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchCreditOperation('strategy:workspace-1', '/api/strategy/run-full')).rejects.toThrow()
    await fetchCreditOperation('strategy:workspace-1', '/api/strategy/run-full')

    expect(keys[0]).toBeTruthy()
    expect(keys[1]).toBe(keys[0])
    expect(storage.size).toBe(0)
  })
})
