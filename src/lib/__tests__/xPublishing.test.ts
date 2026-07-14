import { afterEach, describe, expect, it, vi } from 'vitest'
import { createXPost, uploadXImage, xCodeChallenge, xCodeVerifierHash } from '@/lib/xPublishing'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('X publishing safety and provider contract', () => {
  it('derives stable URL-safe PKCE evidence without storing the verifier in state', () => {
    const verifier = 'a'.repeat(64)
    expect(xCodeChallenge(verifier)).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(xCodeVerifierHash(verifier)).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(xCodeVerifierHash(verifier)).not.toBe(xCodeChallenge(verifier))
  })

  it('requires explicit consent and reviewed copy before any provider call', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(createXPost({ accessToken: 'token', text: 'Reviewed', explicitConsent: false }))
      .rejects.toThrow('explicit consent')
    await expect(createXPost({ accessToken: 'token', text: 'a'.repeat(281), explicitConsent: true }))
      .rejects.toThrow('280')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uploads an approved Cloudinary image before creating the X post', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'image/png', 'content-length': '3' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'media-1' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'post-1', text: 'Reviewed post' } }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await createXPost({
      accessToken: 'x-token',
      text: 'Reviewed post',
      imageUrl: 'https://res.cloudinary.com/nexus/image/upload/post.png',
      username: '@nexus',
      explicitConsent: true,
    })

    expect(result).toEqual({ postId: 'post-1', platformUrl: 'https://x.com/nexus/status/post-1' })
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.x.com/2/media/upload')
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
      media: Buffer.from([1, 2, 3]).toString('base64'),
      media_category: 'tweet_image',
      media_type: 'image/png',
    })
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({
      text: 'Reviewed post',
      media: { media_ids: ['media-1'] },
    })
  })

  it('rejects untrusted media URLs and unsupported file types', async () => {
    vi.stubGlobal('fetch', vi.fn())
    await expect(uploadXImage({ accessToken: 'token', imageUrl: 'https://127.0.0.1/private.png' }))
      .rejects.toThrow('Cloudinary')

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array([1]), {
      status: 200,
      headers: { 'content-type': 'image/gif', 'content-length': '1' },
    })))
    await expect(uploadXImage({ accessToken: 'token', imageUrl: 'https://res.cloudinary.com/nexus/image/upload/post.gif' }))
      .rejects.toThrow('JPG, PNG, or WEBP')
  })
})
