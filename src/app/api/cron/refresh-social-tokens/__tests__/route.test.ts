import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  update: vi.fn(),
  decrypt: vi.fn(),
  encrypt: vi.fn((value: string) => `encrypted:${value}`),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    integration: { findMany: mocks.findMany, update: mocks.update },
  },
}))
vi.mock('@/lib/tokenCrypto', () => ({ decryptToken: mocks.decrypt, encryptToken: mocks.encrypt }))

import { GET } from '@/app/api/cron/refresh-social-tokens/route'

const originalFetch = global.fetch
const original = {
  cron: process.env.CRON_SECRET,
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  xClientId: process.env.X_CLIENT_ID,
  xClientSecret: process.env.X_CLIENT_SECRET,
  pinterestId: process.env.PINTEREST_APP_ID,
  pinterestSecret: process.env.PINTEREST_APP_SECRET,
}

function request() {
  return new NextRequest('http://localhost/api/cron/refresh-social-tokens', {
    headers: { Authorization: 'Bearer cron-secret' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 'cron-secret'
  process.env.GOOGLE_CLIENT_ID = 'client-id'
  process.env.GOOGLE_CLIENT_SECRET = 'client-secret'
  process.env.X_CLIENT_ID = 'x-client-id'
  process.env.X_CLIENT_SECRET = 'x-client-secret'
  process.env.PINTEREST_APP_ID = 'pinterest-app-id'
  process.env.PINTEREST_APP_SECRET = 'pinterest-app-secret'
  mocks.decrypt.mockReturnValue('refresh-1')
  mocks.update.mockResolvedValue({})
  mocks.findMany.mockResolvedValue([{
    id: 'youtube-integration',
    type: 'YOUTUBE',
    status: 'CONNECTED',
    accessToken: 'encrypted-old-access',
    refreshToken: 'encrypted-refresh',
    config: {
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      scopes: ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly'],
      scopeEvidence: 'provider_response',
    },
  }])
})

afterEach(() => {
  global.fetch = originalFetch
  if (original.cron === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = original.cron
  if (original.clientId === undefined) delete process.env.GOOGLE_CLIENT_ID
  else process.env.GOOGLE_CLIENT_ID = original.clientId
  if (original.clientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET
  else process.env.GOOGLE_CLIENT_SECRET = original.clientSecret
  if (original.xClientId === undefined) delete process.env.X_CLIENT_ID
  else process.env.X_CLIENT_ID = original.xClientId
  if (original.xClientSecret === undefined) delete process.env.X_CLIENT_SECRET
  else process.env.X_CLIENT_SECRET = original.xClientSecret
  if (original.pinterestId === undefined) delete process.env.PINTEREST_APP_ID
  else process.env.PINTEREST_APP_ID = original.pinterestId
  if (original.pinterestSecret === undefined) delete process.env.PINTEREST_APP_SECRET
  else process.env.PINTEREST_APP_SECRET = original.pinterestSecret
})

describe('YouTube token refresh', () => {
  it('renews an expired access token without user interaction', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      access_token: 'new-access',
      expires_in: 3600,
      scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
    }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch

    const response = await GET(request())
    const body = await response.json()

    expect(body.stats).toMatchObject({ checked: 1, refreshed: 1, expired: 0, errors: 0 })
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'youtube-integration' },
      data: expect.objectContaining({
        status: 'CONNECTED',
        accessToken: 'encrypted:new-access',
        config: expect.objectContaining({
          scopes: ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly'],
          scopeEvidence: 'provider_response',
          tokenRefreshedAt: expect.any(String),
        }),
      }),
    })
  })

  it('marks a revoked refresh token expired instead of retrying forever', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: 'invalid_grant',
      error_description: 'Token has been expired or revoked.',
    }), { status: 400, headers: { 'content-type': 'application/json' } })) as typeof fetch

    const response = await GET(request())
    const body = await response.json()

    expect(body.stats).toMatchObject({ expired: 1, refreshed: 0 })
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'youtube-integration' },
      data: { status: 'EXPIRED' },
    })
  })

  it('renews X access and refresh tokens with confidential client authentication', async () => {
    mocks.findMany.mockResolvedValue([{
      id: 'x-integration',
      type: 'X',
      status: 'CONNECTED',
      accessToken: 'encrypted-old-x-access',
      refreshToken: 'encrypted-old-x-refresh',
      config: {
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
        scopes: ['tweet.read', 'tweet.write', 'users.read', 'media.write', 'offline.access'],
        scopeEvidence: 'provider_response',
      },
    }])
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      access_token: 'new-x-access',
      refresh_token: 'new-x-refresh',
      expires_in: 7200,
      scope: 'tweet.read tweet.write users.read media.write offline.access',
    }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch

    const response = await GET(request())
    const body = await response.json()

    expect(body.stats).toMatchObject({ checked: 1, refreshed: 1, expired: 0, errors: 0 })
    expect(global.fetch).toHaveBeenCalledWith('https://api.x.com/2/oauth2/token', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: `Basic ${Buffer.from('x-client-id:x-client-secret').toString('base64')}`,
      }),
    }))
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'x-integration' },
      data: expect.objectContaining({
        status: 'CONNECTED',
        accessToken: 'encrypted:new-x-access',
        refreshToken: 'encrypted:new-x-refresh',
        config: expect.objectContaining({
          scopes: ['tweet.read', 'tweet.write', 'users.read', 'media.write', 'offline.access'],
          scopeEvidence: 'provider_response',
          tokenRefreshedAt: expect.any(String),
        }),
      }),
    })
  })

  it('rotates Pinterest continuous refresh credentials before public publishing expires', async () => {
    mocks.findMany.mockResolvedValue([{
      id: 'pinterest-integration',
      type: 'PINTEREST',
      status: 'CONNECTED',
      accessToken: 'encrypted-old-access',
      refreshToken: 'encrypted-old-refresh',
      config: {
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        refreshExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        scopes: ['boards:read', 'boards:write', 'pins:read', 'pins:write'],
        accessTier: 'STANDARD',
      },
    }])
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      access_token: 'new-pinterest-access',
      refresh_token: 'new-pinterest-refresh',
      expires_in: 2592000,
      refresh_token_expires_in: 5184000,
      scope: 'boards:read boards:write pins:read pins:write',
    }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch

    const response = await GET(request())
    const body = await response.json()

    expect(body.stats).toMatchObject({ checked: 1, refreshed: 1, expired: 0, errors: 0 })
    expect(global.fetch).toHaveBeenCalledWith('https://api.pinterest.com/v5/oauth/token', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: `Basic ${Buffer.from('pinterest-app-id:pinterest-app-secret').toString('base64')}`,
      }),
    }))
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'pinterest-integration' },
      data: expect.objectContaining({
        status: 'CONNECTED',
        accessToken: 'encrypted:new-pinterest-access',
        refreshToken: 'encrypted:new-pinterest-refresh',
        config: expect.objectContaining({ accessTier: 'STANDARD', tokenRefreshedAt: expect.any(String) }),
      }),
    })
  })
})
