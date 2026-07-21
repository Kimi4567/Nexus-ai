import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  workspaceFindFirst: vi.fn(),
  integrationFindMany: vi.fn(),
  integrationFindFirst: vi.fn(),
  integrationUpdateMany: vi.fn(),
  learningEventCreate: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('@/lib/supabaseAuth', () => ({ adminClient: { auth: { getUser: mocks.getUser } } }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: { findFirst: mocks.workspaceFindFirst },
    integration: {
      findMany: mocks.integrationFindMany,
      findFirst: mocks.integrationFindFirst,
    },
    $transaction: mocks.transaction,
  },
}))

import { DELETE, GET } from '@/app/api/social/accounts/route'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  mocks.workspaceFindFirst.mockResolvedValue({ id: 'workspace-1' })
  mocks.integrationUpdateMany.mockResolvedValue({ count: 1 })
  mocks.learningEventCreate.mockResolvedValue({ id: 'event-1' })
  mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
    integration: { updateMany: mocks.integrationUpdateMany },
    marketingLearningEvent: { create: mocks.learningEventCreate },
  }))
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

  it('never returns expired provider evidence as a publishing capability', async () => {
    mocks.integrationFindMany.mockResolvedValue([{
      id: 'x-expired', type: 'X', status: 'CONNECTED',
      accountId: 'x-user-expired', accountName: 'Expired X',
      accessToken: 'encrypted-access', refreshToken: 'encrypted-refresh',
      lastSyncedAt: new Date(), createdAt: new Date(),
      config: {
        scopeEvidence: 'provider_response',
        scopes: ['tweet.read', 'tweet.write', 'users.read', 'media.write', 'offline.access'],
        expiresAt: '2020-01-01T00:00:00.000Z',
      },
    }])

    const response = await GET(new NextRequest('http://localhost/api/social/accounts', {
      headers: { Authorization: 'Bearer session' },
    }))
    const body = await response.json()

    expect(body.accounts[0]).toMatchObject({
      status: 'EXPIRED',
      capabilities: {
        xPublishing: false,
        xMediaPublishing: false,
        xReadback: false,
        tokenRefresh: false,
      },
    })
  })
})

describe('DELETE /api/social/accounts', () => {
  const disconnectRequest = () => new NextRequest('http://localhost/api/social/accounts', {
    method: 'DELETE',
    headers: { Authorization: 'Bearer session', 'Content-Type': 'application/json' },
    body: JSON.stringify({ integrationId: 'meta-1' }),
  })

  it('atomically erases column and nested provider credentials without claiming provider revocation', async () => {
    const updatedAt = new Date('2026-07-20T10:00:00.000Z')
    mocks.integrationFindFirst.mockResolvedValue({
      id: 'meta-1',
      type: 'META',
      status: 'CONNECTED',
      accessToken: 'encrypted-user-token',
      refreshToken: 'encrypted-refresh-token',
      config: {
        pages: [{ id: 'page-1', accessToken: 'encrypted-page-token' }],
        scopes: ['pages_manage_posts'],
      },
      updatedAt,
    })

    const response = await DELETE(disconnectRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      ok: true,
      credentialsErased: true,
      providerRevocationConfirmed: false,
    })
    expect(mocks.integrationUpdateMany).toHaveBeenCalledWith({
      where: { id: 'meta-1', workspaceId: 'workspace-1', updatedAt },
      data: {
        status: 'DISCONNECTED',
        accessToken: null,
        refreshToken: null,
        config: expect.objectContaining({
          schemaVersion: 1,
          lifecycle: 'disconnected',
          credentialErasure: 'completed',
          providerRevocation: 'not_confirmed',
        }),
        lastSyncedAt: null,
      },
    })
    const persistedUpdate = mocks.integrationUpdateMany.mock.calls[0][0]
    expect(JSON.stringify(persistedUpdate)).not.toContain('encrypted-user-token')
    expect(JSON.stringify(persistedUpdate)).not.toContain('encrypted-refresh-token')
    expect(JSON.stringify(persistedUpdate)).not.toContain('encrypted-page-token')
    expect(mocks.learningEventCreate).toHaveBeenCalledWith({
      data: {
        workspaceId: 'workspace-1',
        eventType: 'PLATFORM_DISCONNECTED',
        source: 'INTEGRATION_WORKFLOW',
        actor: 'USER',
        metadata: {
          integrationId: 'meta-1',
          platform: 'META',
          localCredentialsErased: true,
          providerRevocationConfirmed: false,
        },
      },
    })
  })

  it('does not mutate an integration outside the user workspace', async () => {
    mocks.integrationFindFirst.mockResolvedValue(null)

    const response = await DELETE(disconnectRequest())

    expect(response.status).toBe(404)
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.integrationUpdateMany).not.toHaveBeenCalled()
  })

  it('returns a conflict and writes no audit event after a concurrent integration change', async () => {
    mocks.integrationFindFirst.mockResolvedValue({
      id: 'meta-1', type: 'META', status: 'CONNECTED',
      accessToken: 'token', refreshToken: null, config: {},
      updatedAt: new Date('2026-07-20T10:00:00.000Z'),
    })
    mocks.integrationUpdateMany.mockResolvedValue({ count: 0 })

    const response = await DELETE(disconnectRequest())
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe('INTEGRATION_DISCONNECT_CONCURRENT_CHANGE')
    expect(mocks.learningEventCreate).not.toHaveBeenCalled()
  })

  it('is idempotent once credentials are already erased and does not duplicate the event', async () => {
    mocks.integrationFindFirst.mockResolvedValue({
      id: 'meta-1', type: 'META', status: 'DISCONNECTED',
      accessToken: null, refreshToken: null,
      config: {
        schemaVersion: 1,
        lifecycle: 'disconnected',
        disconnectedAt: '2026-07-20T10:00:00.000Z',
        credentialErasure: 'completed',
        providerRevocation: 'not_confirmed',
      },
      updatedAt: new Date('2026-07-20T10:00:00.000Z'),
    })

    const response = await DELETE(disconnectRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ ok: true, unchanged: true, credentialsErased: true })
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.learningEventCreate).not.toHaveBeenCalled()
  })
})
