import { afterEach, describe, expect, it, vi } from 'vitest'
import { createThreadsPost, parseThreadsPostOptions } from '@/lib/threadsPublishing'

afterEach(() => vi.unstubAllGlobals())

describe('Threads publishing contract', () => {
  it('fails closed without reviewed reply controls, alt text, and explicit consent', () => {
    expect(() => parseThreadsPostOptions({ explicitConsent: false })).toThrow('explicit consent')
    expect(() => parseThreadsPostOptions({ explicitConsent: true, replyControl: 'nobody' })).toThrow('reply setting')
    expect(() => parseThreadsPostOptions({ explicitConsent: true, replyControl: 'everyone' }, { hasImage: true })).toThrow('alt text')
  })

  it('creates then publishes the exact approved image post and returns its permalink', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'container-1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'container-1', status: 'FINISHED' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'thread-1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'thread-1', permalink: 'https://www.threads.net/@nexus/post/abc' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(createThreadsPost({
      accessToken: 'threads-token',
      text: 'Reviewed launch message',
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/launch.jpg',
      options: {
        replyControl: 'accounts_you_follow',
        altText: 'The reviewed product on a clean studio background.',
        explicitConsent: true,
      },
    })).resolves.toEqual({
      postId: 'thread-1',
      platformUrl: 'https://www.threads.net/@nexus/post/abc',
    })

    const createBody = fetchMock.mock.calls[0][1].body as URLSearchParams
    expect(Object.fromEntries(createBody)).toEqual({
      media_type: 'IMAGE',
      text: 'Reviewed launch message',
      reply_control: 'accounts_you_follow',
      image_url: 'https://res.cloudinary.com/demo/image/upload/launch.jpg',
      alt_text: 'The reviewed product on a clean studio background.',
    })
    expect(String(fetchMock.mock.calls[1][0])).toContain('container-1?fields=id%2Cstatus%2Cerror_message')
    expect(fetchMock.mock.calls[2][0]).toBe('https://graph.threads.net/me/threads_publish')
  })

  it('rejects overlong copy and non-Cloudinary images before calling Meta', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(createThreadsPost({
      accessToken: 'token', text: 'x'.repeat(501), options: { explicitConsent: true },
    })).rejects.toThrow('1 to 500')
    await expect(createThreadsPost({
      accessToken: 'token', text: 'Valid text', imageUrl: 'https://example.com/image.jpg',
      options: { explicitConsent: true, altText: 'Image' },
    })).rejects.toThrow('Cloudinary')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
