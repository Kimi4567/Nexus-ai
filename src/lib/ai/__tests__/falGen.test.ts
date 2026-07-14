import { afterEach, describe, expect, it, vi } from 'vitest'

import { generateWithFlux } from '../falGen'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('generateWithFlux', () => {
  it('uses the FLUX 1.1 Ultra aspect_ratio field instead of the ignored image_size field', async () => {
    vi.stubEnv('FAL_KEY', 'fal_test_key')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        images: [{ url: 'https://fal.media/example.jpg', width: 2048, height: 2048 }],
        seed: 42,
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await generateWithFlux({ prompt: 'text-free premium team scene', aspectRatio: '1:1' })

    const request = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const body = JSON.parse(request[1].body as string)
    expect(body.aspect_ratio).toBe('1:1')
    expect(body).not.toHaveProperty('image_size')
    expect(body).not.toHaveProperty('num_inference_steps')
    expect(request[1].signal).toBeInstanceOf(AbortSignal)
  })
})
