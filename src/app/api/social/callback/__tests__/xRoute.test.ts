import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createOAuthState } from '@/lib/oauthState'
import { xCodeVerifierHash } from '@/lib/xPublishing'

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
    integration: { findUnique: mocks.integrationFindUnique, upsert: mocks.integrationUpsert },
  },
}))
vi.mock('@/lib/tokenCrypto', () => ({ encryptToken: mocks.encrypt }))

import { GET } from '@/app/api/social/callback/x/route'

const originalFetch = global.fetch
const original = {
  clientId: process.env.X_CLIENT_ID,
  clientSecret: process.env.X_CLIENT_SECRET,
  baseUrl: process.env.NEXT_PUBLIC_APP_URL,
  stateSecret: process.env.OAUTH_STATE_SECRET,
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.X_CLIENT_ID = 'x-client-id'
  process.env.X_CLIENT_SECRET = 'x-client-secret'
  process.env.NEXT_PUBLIC_APP_URL = 'https://preview.nexus.test'
  process.env.OAUTH_STATE_SECRET = 'a-test-oauth-secret-that-is-longer-than-thirty-two-characters'
  mocks.workspaceFindFirst.mockResolvedValue({ id: 'workspace-1' })
  mocks.integrationFindUnique.mockResolvedValue({ refreshToken: 'encrypted:old-refresh' })
  mocks.integrationUpsert.mockResolvedValue({ id: 'x-integration' })
})

afterEach(() => {
  global.fetch = originalFetch
  const env: Array<[string, string | undefined]> = [
    ['X_CLIENT_ID', original.clientId],
    ['X_CLIENT_SECRET', original.clientSecret],
    ['NEXT_PUBLIC_APP_URL', original.baseUrl],
    ['OAUTH_STATE_SECRET', original.stateSecret],
  ]
  for (const [key, value] of env) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe('GET /api/social/callback/x', () => {
  it('exchanges the PKCE code, verifies identity, and stores encrypted renewable credentials', async () => {
    const verifier = 'x-pkce-verifier-that-is-long-enough-for-the-provider-123456789'
    const state = createOAuthState('user-x', 'x', xCodeVerifierHash(verifier))
    global.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'x-access',
        refresh_token: 'x-refresh',
        expires_in: 7200,
        scope: 'tweet.read tweet.write users.read media.write offline.access',
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { id: 'x-user-1', name: 'NEXUS', username: 'nexus', profile_image_url: 'https://pbs.twimg.com/profile.jpg' },
      }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch

    const url = `https://preview.nexus.test/api/social/callback/x?code=provider-code&state=${encodeURIComponent(state)}`
    const response = await GET(new NextRequest(url, { headers: { Cookie: `nexus_x_pkce=${verifier}` } }))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://preview.nexus.test/connections?social=connected&platform=x')
    expect(response.headers.get('set-cookie')).toContain('nexus_x_pkce=')
    expect(global.fetch).toHaveBeenNthCalledWith(1, 'https://api.x.com/2/oauth2/token', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: `Basic ${Buffer.from('x-client-id:x-client-secret').toString('base64')}`,
      }),
      body: expect.any(URLSearchParams),
    }))
    const tokenBody = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as URLSearchParams
    expect(Object.fromEntries(tokenBody)).toMatchObject({
      code: 'provider-code',
      grant_type: 'authorization_code',
      code_verifier: verifier,
      redirect_uri: 'https://preview.nexus.test/api/social/callback/x',
    })
    expect(mocks.integrationUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { workspaceId_type: { workspaceId: 'workspace-1', type: 'X' } },
      create: expect.objectContaining({
        type: 'X',
        accessToken: 'encrypted:x-access',
        refreshToken: 'encrypted:x-refresh',
        accountId: 'x-user-1',
        config: expect.objectContaining({
          username: 'nexus',
          scopes: ['tweet.read', 'tweet.write', 'users.read', 'media.write', 'offline.access'],
          scopeEvidence: 'provider_response',
        }),
      }),
    }))
  })

  it('rejects state that is not bound to the PKCE cookie', async () => {
    global.fetch = vi.fn() as typeof fetch
    const state = createOAuthState('user-x', 'x', xCodeVerifierHash('expected-verifier'))
    const response = await GET(new NextRequest(
      `https://preview.nexus.test/api/social/callback/x?code=provider-code&state=${encodeURIComponent(state)}`,
      { headers: { Cookie: 'nexus_x_pkce=different-verifier' } },
    ))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('invalid_pkce_context')
    expect(global.fetch).not.toHaveBeenCalled()
    expect(mocks.integrationUpsert).not.toHaveBeenCalled()
  })
})
