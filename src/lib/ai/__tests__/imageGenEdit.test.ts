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

  it('uses the current JSON image URL contract for gpt-image-2', async () => {
    await expect(generateWithOpenAIImageEdit(
      'Create a premium product ad',
      'https://res.cloudinary.com/demo/image/upload/product.png',
      '1024x1536',
    )).resolves.toBe('data:image/png;base64,aW1hZ2U=')

    const [url, init] = vi.mocked(fetch).mock.calls[1]
    expect(url).toBe('https://api.openai.com/v1/images/edits')
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer test-key',
      'Content-Type': 'application/json',
    })
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: 'gpt-image-2',
      images: [{ image_url: 'https://res.cloudinary.com/demo/image/upload/product.png' }],
      size: '1024x1536',
      quality: 'high',
      n: 1,
    })
    expect(JSON.parse(String(init?.body))).not.toHaveProperty('input_fidelity')
  })

  it('keeps multipart image[] compatibility for earlier GPT Image models', async () => {
    vi.stubEnv('OPENAI_IMAGE_MODEL', 'gpt-image-1.5')

    await generateWithOpenAIImageEdit(
      'Create a premium product ad',
      'https://res.cloudinary.com/demo/image/upload/product.png',
      '1024x1536',
    )

    const [, init] = vi.mocked(fetch).mock.calls[1]
    const form = init?.body as FormData
    expect(form.get('model')).toBe('gpt-image-1.5')
    expect(form.getAll('image[]')).toHaveLength(1)
    expect(form.get('input_fidelity')).toBe('high')
    expect((form.get('image[]') as File).name).toBe('reference-image.png')
  })

  it('exposes only a privacy-safe provider code on rejected edits', async () => {
    vi.mocked(fetch).mockReset()
      .mockResolvedValueOnce(new Response(new Uint8Array([137, 80, 78, 71]), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: {
          code: 'invalid_image_url',
          message: 'sensitive provider detail that must not be forwarded',
        },
      }), { status: 400, headers: { 'content-type': 'application/json' } }))

    await expect(generateWithOpenAIImageEdit(
      'Create a premium product ad',
      'https://res.cloudinary.com/demo/image/upload/product.png',
    )).rejects.toMatchObject({
      name: 'OpenAIImageEditError',
      code: 'OPENAI_IMAGE_EDIT_400_invalid_image_url',
      message: 'OpenAI image edit request failed with HTTP 400',
    })
  })
})
