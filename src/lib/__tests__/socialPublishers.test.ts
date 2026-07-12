import { afterEach, describe, expect, it, vi } from 'vitest'
import { publishSocialPost } from '@/lib/socialPublishers'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('publishSocialPost', () => {
  it('publishes LinkedIn text through the versioned Posts API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', {
      status: 201,
      headers: { 'x-restli-id': 'urn:li:share:123' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await publishSocialPost({
      platform: 'LINKEDIN',
      caption: 'A reviewed post',
      accessToken: 'token',
      accountId: 'person-1',
    })

    expect(result).toEqual({ platformPostId: 'urn:li:share:123' })
    expect(fetchMock).toHaveBeenCalledWith('https://api.linkedin.com/rest/posts', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'Linkedin-Version': expect.any(String),
        'X-Restli-Protocol-Version': '2.0.0',
      }),
    }))
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body).toMatchObject({
      author: 'urn:li:person:person-1',
      commentary: 'A reviewed post',
      lifecycleState: 'PUBLISHED',
    })
  })

  it('uploads a trusted Cloudinary image before creating a LinkedIn post', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        value: { uploadUrl: 'https://www.linkedin.com/upload/1', image: 'urn:li:image:abc' },
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'image/png', 'content-length': '3' },
      }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response('', {
        status: 201,
        headers: { 'x-restli-id': 'urn:li:share:with-image' },
      }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await publishSocialPost({
      platform: 'LINKEDIN',
      caption: 'Image post',
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/post.png',
      accessToken: 'token',
      accountId: 'person-1',
    })

    expect(result.platformPostId).toBe('urn:li:share:with-image')
    const postBody = JSON.parse(fetchMock.mock.calls[3][1].body)
    expect(postBody.content).toEqual({
      media: { id: 'urn:li:image:abc', altText: 'Image post' },
    })
  })

  it('rejects server-side image downloads from untrusted hosts', async () => {
    vi.stubGlobal('fetch', vi.fn())
    await expect(publishSocialPost({
      platform: 'LINKEDIN',
      caption: 'Unsafe image',
      imageUrl: 'https://127.0.0.1/internal.png',
      accessToken: 'token',
      accountId: 'person-1',
    })).rejects.toThrow('Cloudinary')
  })

  it('publishes a Facebook page post without inventing media', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'page_99' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await publishSocialPost({
      platform: 'META',
      caption: 'Text only',
      pageId: 'page',
      accessToken: 'page-token',
      integrationConfig: { pages: [{ id: 'page', accessToken: 'encrypted' }] },
    })

    expect(result).toEqual({
      platformPostId: 'page_99',
      platformUrl: 'https://facebook.com/page_99',
    })
    expect(fetchMock.mock.calls[0][0]).toContain('/page/feed')
  })

  it('requires a real approved image for Instagram', async () => {
    vi.stubGlobal('fetch', vi.fn())
    await expect(publishSocialPost({
      platform: 'INSTAGRAM',
      caption: 'No placeholder allowed',
      pageId: 'ig-1',
      accessToken: 'token',
      integrationConfig: { pages: [{ id: 'fb-1', igAccountId: 'ig-1' }] },
    })).rejects.toThrow('approved permanent image')
  })

  it('fails TikTok closed until creator-info consent is implemented', async () => {
    await expect(publishSocialPost({
      platform: 'TIKTOK',
      caption: 'Video',
      imageUrl: 'https://res.cloudinary.com/demo/video/upload/video.mp4',
      accessToken: 'token',
      integrationConfig: {},
    })).rejects.toThrow('explicit consent')
  })
})
