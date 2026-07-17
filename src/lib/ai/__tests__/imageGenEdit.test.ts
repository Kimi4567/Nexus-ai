import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateWithOpenAIImageEdit } from '../imageGen'

describe('GPT Image edit adapter', () => {
  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key')
    vi.stubEnv('OPENAI_IMAGE_MODEL', 'gpt-image-2')
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(new Uint8Array([137, 80, 78, 71]), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ b64_json: 'aW1hZ2U=' }],
      }), { status: 200, headers: { 'content-type': 'application/json' } })))
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('uses the current multipart image[] contract for gpt-image-2', async () => {
    await expect(generateWithOpenAIImageEdit(
      'Create a premium product ad',
      'https://res.cloudinary.com/demo/image/upload/product.png',
      '1024x1536',
    )).resolves.toBe('data:image/png;base64,aW1hZ2U=')

    const [url, init] = vi.mocked(fetch).mock.calls[1]
    expect(url).toBe('https://api.openai.com/v1/images/edits')
    const form = init?.body as FormData
    expect(form.get('model')).toBe('gpt-image-2')
    expect(form.getAll('image[]')).toHaveLength(1)
    expect(form.has('image')).toBe(false)
    expect(form.has('input_fidelity')).toBe(false)
    expect((form.get('image[]') as File).name).toBe('reference-image.png')
  })
})
