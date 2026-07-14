import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  workspaceFindFirst: vi.fn(),
  integrationFindMany: vi.fn(),
}))

vi.mock('@/lib/supabaseAuth', () => ({ adminClient: { auth: { getUser: mocks.getUser } } }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: { findFirst: mocks.workspaceFindFirst },
    integration: { findMany: mocks.integrationFindMany },
  },
}))

import { GET } from '@/app/api/social/accounts/route'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  mocks.workspaceFindFirst.mockResolvedValue({ id: 'workspace-1' })
})

describe('GET /api/social/accounts', () => {
  it('returns capability evidence without leaking stored page tokens', async () => {
    mocks.integrationFindMany.mockResolvedValue([{
      id: 'meta-1',
      type: 'META',
      status: 'CONNECTED',
      accountId: 'member-1',
      accountName: 'Meta Account',
      refreshToken: null,
      lastSyncedAt: new Date(),
      createdAt: new Date(),
      config: {
        scopeEvidence: 'provider_response',
        scopes: ['pages_manage_posts', 'instagram_content_publish'],
        pages: [{
          id: 'page-1',
          name: 'Page One',
          igAccountId: 'ig-1',
          accessToken: 'encrypted-page-token',
          unexpectedSecret: 'must-not-leak',
        }],
      },
    }])

    const response = await GET(new NextRequest('http://localhost/api/social/accounts', {
      headers: { Authorization: 'Bearer session' },
    }))
    const body = await response.json()

    expect(body.accounts[0].pages).toEqual([{ id: 'page-1', name: 'Page One', igAccountId: 'ig-1' }])
    expect(body.accounts[0].capabilities).toMatchObject({
      facebookPublishing: true,
      instagramPublishing: true,
    })
    expect(JSON.stringify(body)).not.toContain('encrypted-page-token')
    expect(JSON.stringify(body)).not.toContain('must-not-leak')
  })

  it('reports YouTube upload, readback, and offline renewal separately', async () => {
    mocks.integrationFindMany.mockResolvedValue([{
      id: 'youtube-1',
      type: 'YOUTUBE',
      status: 'CONNECTED',
      accountId: 'channel-1',
      accountName: 'NEXUS Channel',
      refreshToken: 'encrypted-refresh',
      lastSyncedAt: new Date(),
      createdAt: new Date(),
      config: {
        scopeEvidence: 'provider_response',
        scopes: ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly'],
        channelUrl: 'https://www.youtube.com/channel/channel-1',
      },
    }])

    const response = await GET(new NextRequest('http://localhost/api/social/accounts', {
      headers: { Authorization: 'Bearer session' },
    }))
    const body = await response.json()

    expect(body.accounts[0]).toMatchObject({
      platform: 'YOUTUBE',
      channelUrl: 'https://www.youtube.com/channel/channel-1',
      capabilities: {
        youtubeVideoPublishing: true,
        youtubeReadback: true,
        tokenRefresh: true,
      },
    })
  })

  it('reports X publish, image, readback, and offline renewal without leaking tokens', async () => {
    mocks.integrationFindMany.mockResolvedValue([{
      id: 'x-1',
      type: 'X',
      status: 'CONNECTED',
      accountId: 'x-user-1',
      accountName: 'NEXUS on X',
      refreshToken: 'encrypted-x-refresh',
      lastSyncedAt: new Date(),
      createdAt: new Date(),
      config: {
        scopeEvidence: 'provider_response',
        scopes: ['tweet.read', 'tweet.write', 'users.read', 'media.write', 'offline.access'],
        username: 'nexus',
        profileUrl: 'https://x.com/nexus',
      },
    }])

    const response = await GET(new NextRequest('http://localhost/api/social/accounts', {
      headers: { Authorization: 'Bearer session' },
    }))
    const body = await response.json()

    expect(body.accounts[0]).toMatchObject({
      platform: 'X',
      profileUrl: 'https://x.com/nexus',
      capabilities: {
        xPublishing: true,
        xMediaPublishing: true,
        xReadback: true,
        tokenRefresh: true,
      },
    })
    expect(JSON.stringify(body)).not.toContain('encrypted-x-refresh')
  })

  it('reports Threads publishing, readback, renewal, and Live mode separately without leaking its token', async () => {
    mocks.integrationFindMany.mockResolvedValue([{
      id: 'threads-1', type: 'THREADS', status: 'CONNECTED',
      accountId: 'threads-user-1', accountName: 'NEXUS Threads',
      accessToken: 'encrypted-threads-access', refreshToken: null,
      lastSyncedAt: new Date(), createdAt: new Date(),
      config: {
        scopeEvidence: 'provider_response', accessTier: 'LIVE',
        scopes: ['threads_basic', 'threads_content_publish', 'threads_manage_insights'],
        username: 'nexus', profileUrl: 'https://www.threads.net/@nexus',
      },
    }])

    const response = await GET(new NextRequest('http://localhost/api/social/accounts', {
      headers: { Authorization: 'Bearer session' },
    }))
    const body = await response.json()

    expect(body.accounts[0]).toMatchObject({
      platform: 'THREADS', accessTier: 'LIVE', profileUrl: 'https://www.threads.net/@nexus',
      capabilities: {
        threadsPostPublishing: true,
        threadsReadback: true,
        threadsPublicPublishing: true,
        tokenRefresh: true,
      },
    })
    expect(JSON.stringify(body)).not.toContain('encrypted-threads-access')
  })
})
