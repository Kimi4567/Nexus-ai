import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchYouTubeVideoStatus } from '@/lib/youtubePublishing'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchYouTubeVideoStatus', () => {
  it('confirms publication only after YouTube reports successful processing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [{
        status: { uploadStatus: 'processed', privacyStatus: 'private' },
        processingDetails: { processingStatus: 'succeeded' },
      }],
    }), { status: 200, headers: { 'content-type': 'application/json' } })))

    await expect(fetchYouTubeVideoStatus('token', 'video-1')).resolves.toEqual({
      complete: true,
      failed: false,
      uploadStatus: 'processed',
      processingStatus: 'succeeded',
      privacyStatus: 'private',
      reason: null,
    })
  })

  it('surfaces provider rejection without claiming publication', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [{
        status: { uploadStatus: 'rejected', rejectionReason: 'copyright', privacyStatus: 'private' },
        processingDetails: { processingStatus: 'failed' },
      }],
    }), { status: 200, headers: { 'content-type': 'application/json' } })))

    await expect(fetchYouTubeVideoStatus('token', 'video-2')).resolves.toMatchObject({
      complete: false,
      failed: true,
      reason: 'copyright',
    })
  })
})
