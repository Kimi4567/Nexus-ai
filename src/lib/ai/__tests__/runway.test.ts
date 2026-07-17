import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRunwayVideoTask, retrieveRunwayTask } from '../runway'

describe('Runway adapter', () => {
  beforeEach(() => {
    vi.stubEnv('RUNWAYML_API_SECRET', 'runway-test-key')
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('starts an exact five-second Gen-4.5 image-to-video task', async () => {
    // Runway creation responses contain the task ID only; status is fetched separately.
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: 'task_123456' }), { status: 200 }))

    await expect(createRunwayVideoTask({
      promptText: 'Premium product reveal',
      promptImage: 'https://res.cloudinary.com/demo/image/upload/product.png',
      ratio: '720:1280',
      duration: 5,
    })).resolves.toMatchObject({ id: 'task_123456', status: 'PENDING' })

    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('https://api.dev.runwayml.com/v1/image_to_video')
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer runway-test-key',
      'X-Runway-Version': '2024-11-06',
    })
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: 'gen4.5',
      duration: 5,
      ratio: '720:1280',
      promptImage: 'https://res.cloudinary.com/demo/image/upload/product.png',
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

    await expect(createRunwayVideoTask({
      promptText: 'Too long',
      ratio: '1280:720',
      duration: 5,
    })).rejects.toThrow(/promptText.*at most 1000 characters/)
  })
})
