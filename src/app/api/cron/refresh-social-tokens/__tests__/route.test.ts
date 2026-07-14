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
})
