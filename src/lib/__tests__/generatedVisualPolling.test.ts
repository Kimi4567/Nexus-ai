import { describe, expect, it, vi } from 'vitest'
import { pollGeneratedVisual } from '@/lib/generatedVisualPolling'

function response(status: number, visual?: Record<string, unknown>) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ visual }),
  } as Response
}

describe('pollGeneratedVisual', () => {
  it('returns a completed durable visual', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(200, {
      id: 'visual_1',
      status: 'COMPLETED',
      imageUrl: 'https://cdn.example.com/visual.jpg',
    }))

    await expect(pollGeneratedVisual({
      visualId: 'visual_1',
      authorization: 'Bearer session',
      intervalMs: 1,
      maxWaitMs: 50,
      fetcher,
    })).resolves.toMatchObject({ id: 'visual_1', status: 'COMPLETED' })
    expect(fetcher).toHaveBeenCalledWith('/api/visuals/visual_1', expect.objectContaining({
      headers: { Authorization: 'Bearer session' },
      cache: 'no-store',
    }))
  })

  it('surfaces a failed job instead of silently starting another generation', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(200, {
      id: 'visual_1',
      status: 'FAILED',
      errorMessage: 'NEXUS quality review rejected this image. Credits were restored.',
    }))

    await expect(pollGeneratedVisual({
      visualId: 'visual_1',
      authorization: 'Bearer session',
      intervalMs: 1,
      maxWaitMs: 50,
      fetcher,
    })).rejects.toThrow('quality review rejected')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('retries a transient polling read without duplicating the production POST', async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new TypeError('temporary network error'))
      .mockResolvedValueOnce(response(200, {
        id: 'visual_1',
        status: 'COMPLETED',
        imageUrl: 'https://cdn.example.com/visual.jpg',
      }))

    await expect(pollGeneratedVisual({
      visualId: 'visual_1',
      authorization: 'Bearer session',
      intervalMs: 1,
      maxWaitMs: 50,
      fetcher,
    })).resolves.toMatchObject({ status: 'COMPLETED' })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
