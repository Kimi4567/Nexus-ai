import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  socialPostFindMany: vi.fn(),
  socialPostUpdate: vi.fn(),
  brainLearningFindMany: vi.fn(),
  brainLearningCreateMany: vi.fn(),
  brandProfileFindUnique: vi.fn(),
  decryptToken: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    socialPost: {
      findMany: mocks.socialPostFindMany,
      update: mocks.socialPostUpdate,
    },
    brainLearning: {
      findMany: mocks.brainLearningFindMany,
      createMany: mocks.brainLearningCreateMany,
    },
    brandProfile: { findUnique: mocks.brandProfileFindUnique },
  },
}))
vi.mock('@/lib/tokenCrypto', () => ({ decryptToken: mocks.decryptToken }))

import { GET } from '@/app/api/cron/fetch-analytics/route'

const originalSecret = process.env.CRON_SECRET
const originalFetch = global.fetch

function request(token?: string) {
  return new NextRequest('http://localhost/api/cron/fetch-analytics', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

function metaPost() {
  return {
    id: 'post-1',
    workspaceId: 'workspace-1',
    platform: 'META' as const,
    platformPostId: 'page_123',
    pageId: 'page-1',
    integration: {
      accessToken: 'encrypted-token',
      config: { pages: [{ id: 'page-1', accessToken: 'page-token' }] },
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 'cron-secret'
  mocks.decryptToken.mockImplementation((value: string) => value)
  mocks.socialPostUpdate.mockResolvedValue({})
  mocks.brainLearningFindMany.mockResolvedValue([])
  mocks.brainLearningCreateMany.mockResolvedValue({ count: 0 })
  mocks.brandProfileFindUnique.mockResolvedValue({ winningHooks: [] })
})

afterEach(() => {
  global.fetch = originalFetch
  if (originalSecret === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = originalSecret
})

describe('GET /api/cron/fetch-analytics', () => {
  it('fails closed when CRON_SECRET is missing', async () => {
    delete process.env.CRON_SECRET
    const response = await GET(request())
    expect(response.status).toBe(500)
    expect(mocks.socialPostFindMany).not.toHaveBeenCalled()
  })

  it('rejects an invalid bearer token', async () => {
    const response = await GET(request('wrong'))
    expect(response.status).toBe(401)
    expect(mocks.socialPostFindMany).not.toHaveBeenCalled()
  })

  it('keeps failed platform fetches retryable', async () => {
    mocks.socialPostFindMany.mockResolvedValueOnce([metaPost()])
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({ error: { message: 'temporary failure' } }),
    }) as typeof fetch

    const response = await GET(request('cron-secret'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      analyticsStored: 0,
      analyticsRetryable: 1,
      aiUsed: false,
      autoLearningApplied: false,
    })
    expect(mocks.socialPostUpdate).toHaveBeenCalledWith({
      where: { id: 'post-1' },
      data: { analyticsUpdatedAt: expect.any(Date) },
    })
  })

  it('stores platform provenance and server-computed evidence', async () => {
    mocks.socialPostFindMany
      .mockResolvedValueOnce([metaPost()])
      .mockResolvedValueOnce([])
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: [
            { name: 'post_impressions', values: [{ value: 500 }] },
            { name: 'post_impressions_unique', values: [{ value: 400 }] },
            { name: 'post_engaged_users', values: [{ value: 40 }] },
            { name: 'post_clicks', values: [{ value: 12 }] },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          likes: { summary: { total_count: 20 } },
          comments: { summary: { total_count: 5 } },
          shares: { count: 3 },
        }),
      }) as typeof fetch

    const response = await GET(request('cron-secret'))
    const body = await response.json()

    expect(body).toMatchObject({ analyticsStored: 1, analyticsRetryable: 0 })
    expect(mocks.socialPostUpdate).toHaveBeenCalledWith({
      where: { id: 'post-1' },
      data: {
        analyticsUpdatedAt: expect.any(Date),
        analyticsFetched: true,
        analyticsData: expect.objectContaining({
          source: 'platform_api',
          platform: 'META',
          platformPostId: 'page_123',
          denominator: 400,
          engagementCount: 40,
          engagementRate: 10,
          quality: 'eligible',
        }),
      },
    })
  })

  it('stores YouTube views, likes, and comments without fabricating reach or conversions', async () => {
    mocks.socialPostFindMany
      .mockResolvedValueOnce([{
        id: 'youtube-post',
        workspaceId: 'workspace-1',
        platform: 'YOUTUBE',
        platformPostId: 'video-1',
        pageId: null,
        integration: { accessToken: 'youtube-token', config: {} },
      }])
      .mockResolvedValueOnce([])
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        items: [{ statistics: { viewCount: '1200', likeCount: '42', commentCount: '8' } }],
      }),
    }) as typeof fetch

    const response = await GET(request('cron-secret'))
    const body = await response.json()

    expect(body).toMatchObject({ analyticsStored: 1, analyticsRetryable: 0 })
    expect(mocks.socialPostUpdate).toHaveBeenCalledWith({
      where: { id: 'youtube-post' },
      data: {
        analyticsUpdatedAt: expect.any(Date),
        analyticsFetched: true,
        analyticsData: expect.objectContaining({
          platform: 'YOUTUBE',
          impressions: 1200,
          reach: 0,
          likes: 42,
          comments: 8,
          shares: 0,
          engagementCount: 50,
        }),
      },
    })
  })
})
