import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRunwayProductAdTask, retrieveRunwayTask } from '../runway'

describe('Runway adapter', () => {
  beforeEach(() => {
    vi.stubEnv('RUNWAYML_API_SECRET', 'runway-test-key')
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('starts one pinned eight-second multi-reference product-ad recipe with no audio', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: 'task_product_ad_1' }), { status: 200 }))

    await expect(createRunwayProductAdTask({
      productImages: [
        'https://res.cloudinary.com/demo/image/upload/product-front.png',
        'https://res.cloudinary.com/demo/image/upload/product-side.png',
      ],
      productInfo: 'Approved product description.',
      userConcept: 'Hook, reveal, benefit, and hero end frame.',
      ratio: '720:1280',
      duration: 8,
    })).resolves.toMatchObject({ id: 'task_product_ad_1', status: 'PENDING' })

    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('https://api.dev.runwayml.com/v1/recipes/product_ad')
    expect(JSON.parse(String(init?.body))).toMatchObject({
      version: '2026-06',
      productImages: [
        { uri: 'https://res.cloudinary.com/demo/image/upload/product-front.png' },
        { uri: 'https://res.cloudinary.com/demo/image/upload/product-side.png' },
      ],
      duration: 8,
      ratio: '720:1280',
      audio: false,
    })
  })

  it('retrieves an existing task in a separate request', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      id: 'task_123456',
      status: 'SUCCEEDED',
      output: ['https://provider.example/video.mp4'],
    }), { status: 200 }))

    await expect(retrieveRunwayTask('task_123456')).resolves.toMatchObject({
      status: 'SUCCEEDED',
      output: ['https://provider.example/video.mp4'],
    })
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('https://api.dev.runwayml.com/v1/tasks/task_123456')
  })

  it('preserves provider validation details for internal diagnostics', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      error: 'Validation of body failed',
      issues: [{ path: ['promptText'], message: 'String must contain at most 1000 characters' }],
    }), { status: 400 }))

    await expect(createRunwayProductAdTask({
      productImages: ['https://example.com/front.png', 'https://example.com/side.png'],
      productInfo: 'Approved product.',
      userConcept: 'Premium product ad.',
      ratio: '1280:720',
      duration: 8,
    })).rejects.toThrow(/promptText.*at most 1000 characters/)
  })
})
