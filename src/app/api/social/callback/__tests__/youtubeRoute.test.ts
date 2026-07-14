import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createOAuthState } from '@/lib/oauthState'

const mocks = vi.hoisted(() => ({
  userUpsert: vi.fn(),
  workspaceFindFirst: vi.fn(),
  workspaceFindUnique: vi.fn(),
  workspaceCreate: vi.fn(),
  integrationFindUnique: vi.fn(),
  integrationUpsert: vi.fn(),
  encrypt: vi.fn((value: string) => `encrypted:${value}`),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { upsert: mocks.userUpsert },
    workspace: {
      findFirst: mocks.workspaceFindFirst,
      findUnique: mocks.workspaceFindUnique,
      create: mocks.workspaceCreate,
    },
    integration: {
      findUnique: mocks.integrationFindUnique,
      upsert: mocks.integrationUpsert,
    },
  },
}))
vi.mock('@/lib/tokenCrypto', () => ({ encryptToken: mocks.encrypt }))

import { GET } from '@/app/api/social/callback/youtube/route'

const originalFetch = global.fetch
const originalEnv = {
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  baseUrl: process.env.NEXT_PUBLIC_APP_URL,
  stateSecret: process.env.OAUTH_STATE_SECRET,
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.GOOGLE_CLIENT_ID = 'client-id'
  process.env.GOOGLE_CLIENT_SECRET = 'client-secret'
  process.env.NEXT_PUBLIC_APP_URL = 'https://preview.nexus.test'
  process.env.OAUTH_STATE_SECRET = 'a-test-oauth-secret-that-is-longer-than-thirty-two-characters'
  mocks.userUpsert.mockResolvedValue({})
  mocks.workspaceFindFirst.mockResolvedValue({ id: 'workspace-1' })
  mocks.integrationFindUnique.mockResolvedValue({ refreshToken: 'encrypted:existing-refresh' })
  mocks.integrationUpsert.mockResolvedValue({})
})

afterEach(() => {
  global.fetch = originalFetch
  for (const [key, value] of Object.entries(originalEnv)) {
    const envKey = key === 'clientId' ? 'GOOGLE_CLIENT_ID'
      : key === 'clientSecret' ? 'GOOGLE_CLIENT_SECRET'
        : key === 'baseUrl' ? 'NEXT_PUBLIC_APP_URL'
          : 'OAUTH_STATE_SECRET'
    if (value === undefined) delete process.env[envKey]
    else process.env[envKey] = value
  }
})

describe('GET /api/social/callback/youtube', () => {
  it('stores provider-granted scopes and preserves an existing offline refresh token', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'access-1',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [{ id: 'channel-1', snippet: { title: 'NEXUS Channel', thumbnails: { default: { url: 'https://yt.example/avatar.jpg' } } } }],
      }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch

    const state = createOAuthState('user-1', 'youtube')
    const response = await GET(new NextRequest(`https://preview.nexus.test/api/social/callback/youtube?code=code-1&state=${encodeURIComponent(state)}`))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://preview.nexus.test/connections?social=connected&platform=youtube')
    expect(mocks.integrationUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { workspaceId_type: { workspaceId: 'workspace-1', type: 'YOUTUBE' } },
      update: expect.objectContaining({
        accessToken: 'encrypted:access-1',
        refreshToken: 'encrypted:existing-refresh',
        accountId: 'channel-1',
        config: expect.objectContaining({
          scopeEvidence: 'provider_response',
          scopes: [
            'https://www.googleapis.com/auth/youtube.upload',
            'https://www.googleapis.com/auth/youtube.readonly',
          ],
        }),
      }),
    }))
  })

  it('does not create a connection when the Google account has no YouTube channel', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'access-1', expires_in: 3600, scope: 'scope' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 })) as typeof fetch

    const state = createOAuthState('user-1', 'youtube')
    const response = await GET(new NextRequest(`https://preview.nexus.test/api/social/callback/youtube?code=code-1&state=${encodeURIComponent(state)}`))

    expect(response.headers.get('location')).toContain('youtube_channel_required')
    expect(mocks.integrationUpsert).not.toHaveBeenCalled()
  })
})
