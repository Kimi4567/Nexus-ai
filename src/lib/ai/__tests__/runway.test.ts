import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRunwayMultiShotVideoTask, createRunwayProductAdTask, retrieveRunwayTask } from '../runway'

describe('Runway adapter', () => {
  beforeEach(() => {
    vi.stubEnv('RUNWAYML_API_SECRET', 'key_runway-test-key')
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

  it('starts one pinned custom multi-shot campaign film with audio', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ id: 'task_multishot_1' }), { status: 200 }))

    await expect(createRunwayMultiShotVideoTask({
      duration: 10,
      ratio: '720:1280',
      audio: true,
      shots: [
        { prompt: 'Wide luxury fashion establishing shot.', duration: 3 },
        { prompt: 'Macro detail shot with natural fabric motion.', duration: 3 },
        { prompt: 'Confident hero shot with a cinematic camera arc.', duration: 4 },
      ],
    })).resolves.toMatchObject({ id: 'task_multishot_1', status: 'PENDING' })

    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('https://api.dev.runwayml.com/v1/recipes/multi_shot_video')
    expect(JSON.parse(String(init?.body))).toMatchObject({
      version: '2026-06',
      mode: 'custom',
      duration: 10,
      ratio: '720:1280',
      audio: true,
    })
  })

  it('rejects an invalid multi-shot duration before provider spend', async () => {
    await expect(createRunwayMultiShotVideoTask({
      duration: 10,
      ratio: '720:1280',
      shots: [
        { prompt: 'Opening fashion shot.', duration: 2 },
        { prompt: 'Product detail shot.', duration: 2 },
        { prompt: 'Closing brand shot.', duration: 2 },
      ],
    })).rejects.toThrow('MULTI_SHOT_DURATION_INVALID')
    expect(fetch).not.toHaveBeenCalled()
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

  it('accepts the legacy RUNWAY_ML_API_KEY without exposing it', async () => {
    vi.stubEnv('RUNWAYML_API_SECRET', '')
    vi.stubEnv('RUNWAY_API_KEY', '')
    vi.stubEnv('RUNWAY_ML_API_KEY', 'key_legacy-runway-test-key')
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      id: 'task_legacy_key',
      status: 'RUNNING',
    }), { status: 200 }))

    await expect(retrieveRunwayTask('task_legacy_key')).resolves.toMatchObject({
      id: 'task_legacy_key',
      status: 'RUNNING',
    })

    const [, init] = vi.mocked(fetch).mock.calls[0]
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer key_legacy-runway-test-key' })
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
