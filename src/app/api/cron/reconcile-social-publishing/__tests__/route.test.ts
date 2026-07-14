import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  update: vi.fn(),
  historyCreate: vi.fn(),
  learningCreate: vi.fn(),
  decrypt: vi.fn(),
  youtubeStatus: vi.fn(),
  tiktokStatus: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    socialPost: { findMany: mocks.findMany, update: mocks.update },
    postStatusHistory: { create: mocks.historyCreate },
    marketingLearningEvent: { create: mocks.learningCreate },
    $transaction: (operations: Array<Promise<unknown>>) => Promise.all(operations),
  },
}))
vi.mock('@/lib/tokenCrypto', () => ({ decryptToken: mocks.decrypt }))
vi.mock('@/lib/youtubePublishing', () => ({ fetchYouTubeVideoStatus: mocks.youtubeStatus }))
vi.mock('@/lib/tiktokPublishing', () => ({ fetchTikTokPublishStatus: mocks.tiktokStatus }))

import { GET } from '@/app/api/cron/reconcile-social-publishing/route'

const originalSecret = process.env.CRON_SECRET

function request() {
  return new NextRequest('http://localhost/api/cron/reconcile-social-publishing', {
    headers: { Authorization: 'Bearer cron-secret' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 'cron-secret'
  mocks.decrypt.mockReturnValue('plain-token')
  mocks.update.mockResolvedValue({})
  mocks.historyCreate.mockResolvedValue({})
  mocks.learningCreate.mockResolvedValue({})
  mocks.findMany.mockResolvedValue([{
    id: 'youtube-post',
    workspaceId: 'workspace-1',
    campaignId: 'campaign-1',
    platform: 'YOUTUBE',
    publishTarget: 'YOUTUBE',
    platformPostId: 'video-1',
    platformOptions: { privacyStatus: 'public' },
    publishAttemptedAt: new Date(),
    scheduledAt: new Date(),
    integration: { accessToken: 'encrypted-token' },
  }])
})

afterEach(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = originalSecret
})

describe('YouTube publishing reconciliation', () => {
  it('promotes processing only after YouTube confirms transcoding success', async () => {
    mocks.youtubeStatus.mockResolvedValue({
      complete: true,
      failed: false,
      uploadStatus: 'processed',
      processingStatus: 'succeeded',
      privacyStatus: 'private',
      reason: null,
    })

    const response = await GET(request())
    const body = await response.json()

    expect(body).toMatchObject({ ok: true, processed: 1, published: 1, failed: 0, pending: 0 })
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'youtube-post' },
      data: expect.objectContaining({
        status: 'PUBLISHED',
        platformPostId: 'video-1',
        platformOptions: { privacyStatus: 'public', confirmedPrivacyStatus: 'private' },
        errorMessage: null,
      }),
    })
    expect(mocks.historyCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ note: '[YOUTUBE_CONFIRMED] processed/succeeded' }),
    })
  })

  it('leaves an actively processing upload pending without claiming publication', async () => {
    mocks.youtubeStatus.mockResolvedValue({
      complete: false,
      failed: false,
      uploadStatus: 'uploaded',
      processingStatus: 'processing',
      privacyStatus: 'private',
      reason: null,
    })

    const response = await GET(request())
    const body = await response.json()

    expect(body).toMatchObject({ published: 0, failed: 0, pending: 1 })
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
