import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchWithTimeout, RequestTimeoutError } from '@/lib/fetchWithTimeout'

describe('fetchWithTimeout', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('returns the response when the request finishes within the limit', async () => {
    const response = new Response(JSON.stringify({ ok: true }), { status: 200 })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response)

    await expect(fetchWithTimeout('/api/test', {}, 500)).resolves.toBe(response)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal)
  })

  it('aborts a stalled request and exposes a specific timeout error', async () => {
    vi.useFakeTimers()
    vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('The operation was aborted', 'AbortError'))
      })
    }))

    const request = fetchWithTimeout('/api/stalled', {}, 100)
    const assertion = expect(request).rejects.toBeInstanceOf(RequestTimeoutError)

    await vi.advanceTimersByTimeAsync(100)
    await assertion
  })
})
