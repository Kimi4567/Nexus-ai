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

  it('streams an approved Cloudinary video through a YouTube resumable upload', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3, 4]), {
        status: 200,
        headers: { 'content-type': 'video/mp4', 'content-length': '4' },
      }))
      .mockResolvedValueOnce(new Response(null, {
        status: 200,
        headers: { location: 'https://www.googleapis.com/upload/youtube/v3/videos?upload_id=session-1' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'video-123' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await publishSocialPost({
      platform: 'YOUTUBE',
      caption: 'Reviewed YouTube description',
      imageUrl: 'https://res.cloudinary.com/demo/video/upload/short.mp4',
      accessToken: 'youtube-token',
      platformOptions: {
        title: 'Reviewed title',
        privacyStatus: 'private',
        selfDeclaredMadeForKids: false,
        containsSyntheticMedia: true,
        notifySubscribers: false,
        explicitConsent: true,
      },
    })

    expect(result).toEqual({
      platformPostId: 'video-123',
      platformUrl: 'https://www.youtube.com/watch?v=video-123',
      state: 'PROCESSING',
    })
    const initUrl = String(fetchMock.mock.calls[1][0])
    expect(initUrl).toContain('uploadType=resumable')
    expect(initUrl).toContain('notifySubscribers=false')
    const metadata = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(metadata).toEqual({
      snippet: {
        title: 'Reviewed title',
        description: 'Reviewed YouTube description',
        categoryId: '22',
      },
      status: {
        privacyStatus: 'private',
        selfDeclaredMadeForKids: false,
        containsSyntheticMedia: true,
      },
    })
    expect(fetchMock.mock.calls[2][1]).toMatchObject({ method: 'PUT', duplex: 'half' })
  })

  it('fails YouTube closed until audience, disclosure, and consent are reviewed', async () => {
    vi.stubGlobal('fetch', vi.fn())
    await expect(publishSocialPost({
      platform: 'YOUTUBE',
      caption: 'Video description',
      imageUrl: 'https://res.cloudinary.com/demo/video/upload/short.mp4',
      accessToken: 'youtube-token',
      platformOptions: { title: 'Title', privacyStatus: 'private' },
    })).rejects.toThrow('explicit consent')
  })

  it('publishes approved X text through the v2 create-post endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: 'x-post-1' } }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await publishSocialPost({
      platform: 'X',
      caption: 'Reviewed X post',
      accessToken: 'x-token',
      integrationConfig: { username: 'nexus' },
      platformOptions: { explicitConsent: true },
    })

    expect(result).toEqual({
      platformPostId: 'x-post-1',
      platformUrl: 'https://x.com/nexus/status/x-post-1',
      state: 'PUBLISHED',
    })
    expect(fetchMock).toHaveBeenCalledWith('https://api.x.com/2/tweets', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer x-token' }),
    }))
  })

  it('publishes a reviewed Pinterest image Pin to its exact Board', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: '998877' }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await publishSocialPost({
      platform: 'PINTEREST',
      caption: 'A reviewed Pinterest description for the approved campaign offer.',
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/pin.jpg',
      accessToken: 'pinterest-token',
      integrationConfig: { boards: [{ id: '12345', name: 'Launches' }] },
      platformOptions: {
        boardId: '12345',
        title: 'Reviewed Pin',
        altText: 'Approved product visual for the campaign.',
        destinationLink: 'https://example.com/offer',
        aiDisclosureReviewed: true,
        aiDisclosureValues: [],
        explicitConsent: true,
      },
    })

    expect(result).toEqual({
      platformPostId: '998877',
      platformUrl: 'https://www.pinterest.com/pin/998877/',
      state: 'PUBLISHED',
    })
  })
})
