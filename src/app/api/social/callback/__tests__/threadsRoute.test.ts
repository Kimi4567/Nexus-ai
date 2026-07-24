import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createOAuthState } from '@/lib/oauthState'
import { threadsOAuthNonceHash } from '@/lib/threadsPublishing'

const mocks = vi.hoisted(() => ({
  userUpsert: vi.fn(), workspaceFindFirst: vi.fn(), workspaceFindUnique: vi.fn(), workspaceCreate: vi.fn(),
  integrationUpsert: vi.fn(), encrypt: vi.fn((value: string) => `encrypted:${value}`),
}))
vi.mock('@/lib/prisma', () => ({ prisma: {
  user: { upsert: mocks.userUpsert },
  workspace: { findFirst: mocks.workspaceFindFirst, findUnique: mocks.workspaceFindUnique, create: mocks.workspaceCreate },
  integration: { upsert: mocks.integrationUpsert },
} }))
vi.mock('@/lib/tokenCrypto', () => ({ encryptToken: mocks.encrypt }))

import { GET } from '@/app/api/social/callback/threads/route'

const originalFetch = global.fetch
const original = {
  id: process.env.THREADS_APP_ID, secret: process.env.THREADS_APP_SECRET,
  baseUrl: process.env.NEXT_PUBLIC_APP_URL, stateSecret: process.env.OAUTH_STATE_SECRET,
  tier: process.env.THREADS_ACCESS_TIER,
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.THREADS_APP_ID = 'threads-app-id'
  process.env.THREADS_APP_SECRET = 'threads-app-secret'
  process.env.THREADS_ACCESS_TIER = 'LIVE'
  process.env.NEXT_PUBLIC_APP_URL = 'https://preview.nexus.test'
  process.env.OAUTH_STATE_SECRET = 'a-test-oauth-secret-that-is-longer-than-thirty-two-characters'
  mocks.workspaceFindFirst.mockResolvedValue({ id: 'workspace-1' })
})

afterEach(() => {
  global.fetch = originalFetch
  const env: Array<[string, string | undefined]> = [
    ['THREADS_APP_ID', original.id], ['THREADS_APP_SECRET', original.secret],
    ['NEXT_PUBLIC_APP_URL', original.baseUrl], ['OAUTH_STATE_SECRET', original.stateSecret],
    ['THREADS_ACCESS_TIER', original.tier],
  ]
  for (const [key, value] of env) value === undefined ? delete process.env[key] : process.env[key] = value
})

describe('GET /api/social/callback/threads', () => {
  it('stores a long-lived token only after provider scope and identity verification', async () => {
    const nonce = 'cookie-bound-threads-nonce'
    const state = createOAuthState('user-threads', 'threads', threadsOAuthNonceHash(nonce))
    const providerUserId = '12345678901234567890'
    global.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(`{"access_token":"short-token","user_id":${providerUserId}}`, { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'long-token', token_type: 'bearer', expires_in: 5_184_000 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: providerUserId, username: 'nexus', name: 'NEXUS', threads_profile_picture_url: 'https://example.com/avatar.jpg' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'TH|app|token', token_type: 'bearer' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {
        app_id: 'threads-app-id', user_id: providerUserId, is_valid: true,
        expires_at: Math.floor(Date.now() / 1000) + 5_184_000,
        scopes: ['threads_basic', 'threads_content_publish', 'threads_manage_insights'],
      } }), { status: 200 })) as typeof fetch

    const response = await GET(new NextRequest(`https://preview.nexus.test/api/social/callback/threads?code=provider-code&state=${encodeURIComponent(state)}`, { headers: { Cookie: `nexus_threads_oauth=${nonce}` } }))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://preview.nexus.test/connections?social=connected&platform=threads')
    const longTokenRequest = vi.mocked(global.fetch).mock.calls[1]
    const longTokenUrl = new URL(String(longTokenRequest[0]))
    expect(longTokenUrl.origin + longTokenUrl.pathname).toBe('https://graph.threads.net/access_token')
    expect(longTokenUrl.searchParams.get('grant_type')).toBe('th_exchange_token')
    expect(longTokenUrl.searchParams.get('access_token')).toBe('short-token')
    expect(longTokenRequest[1]?.headers).toBeUndefined()
    expect(mocks.integrationUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { workspaceId_type: { workspaceId: 'workspace-1', type: 'THREADS' } },
      create: expect.objectContaining({
        type: 'THREADS', accessToken: 'encrypted:long-token', refreshToken: null,
        accountId: providerUserId, accountName: 'NEXUS',
        config: expect.objectContaining({
          username: 'nexus', accessTier: 'LIVE', scopeEvidence: 'provider_response',
          scopes: ['threads_basic', 'threads_content_publish', 'threads_manage_insights'],
        }),
      }),
    }))
  })

  it('rejects state that is not bound to its HttpOnly cookie', async () => {
    global.fetch = vi.fn() as typeof fetch
    const state = createOAuthState('user-threads', 'threads', threadsOAuthNonceHash('expected-nonce'))
    const response = await GET(new NextRequest(`https://preview.nexus.test/api/social/callback/threads?code=provider-code&state=${encodeURIComponent(state)}`, { headers: { Cookie: 'nexus_threads_oauth=different-nonce' } }))
    expect(response.headers.get('location')).toContain('invalid_oauth_context')
    expect(global.fetch).not.toHaveBeenCalled()
    expect(mocks.integrationUpsert).not.toHaveBeenCalled()
  })
})
