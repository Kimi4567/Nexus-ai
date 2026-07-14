import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createOAuthState } from '@/lib/oauthState'
import { pinterestOAuthNonceHash } from '@/lib/pinterestPublishing'

const mocks = vi.hoisted(() => ({
  userUpsert: vi.fn(), workspaceFindFirst: vi.fn(), workspaceFindUnique: vi.fn(), workspaceCreate: vi.fn(),
  integrationFindUnique: vi.fn(), integrationUpsert: vi.fn(), encrypt: vi.fn((value: string) => `encrypted:${value}`),
}))
vi.mock('@/lib/prisma', () => ({ prisma: {
  user: { upsert: mocks.userUpsert },
  workspace: { findFirst: mocks.workspaceFindFirst, findUnique: mocks.workspaceFindUnique, create: mocks.workspaceCreate },
  integration: { findUnique: mocks.integrationFindUnique, upsert: mocks.integrationUpsert },
} }))
vi.mock('@/lib/tokenCrypto', () => ({ encryptToken: mocks.encrypt }))

import { GET } from '@/app/api/social/callback/pinterest/route'

const originalFetch = global.fetch
const original = {
  id: process.env.PINTEREST_APP_ID, secret: process.env.PINTEREST_APP_SECRET,
  baseUrl: process.env.NEXT_PUBLIC_APP_URL, stateSecret: process.env.OAUTH_STATE_SECRET,
  tier: process.env.PINTEREST_ACCESS_TIER,
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.PINTEREST_APP_ID = 'pinterest-app-id'
  process.env.PINTEREST_APP_SECRET = 'pinterest-app-secret'
  process.env.PINTEREST_ACCESS_TIER = 'STANDARD'
  process.env.NEXT_PUBLIC_APP_URL = 'https://preview.nexus.test'
  process.env.OAUTH_STATE_SECRET = 'a-test-oauth-secret-that-is-longer-than-thirty-two-characters'
  mocks.workspaceFindFirst.mockResolvedValue({ id: 'workspace-1' })
  mocks.integrationFindUnique.mockResolvedValue({ refreshToken: 'encrypted:old-refresh' })
})

afterEach(() => {
  global.fetch = originalFetch
  const env: Array<[string, string | undefined]> = [
    ['PINTEREST_APP_ID', original.id], ['PINTEREST_APP_SECRET', original.secret],
    ['NEXT_PUBLIC_APP_URL', original.baseUrl], ['OAUTH_STATE_SECRET', original.stateSecret],
    ['PINTEREST_ACCESS_TIER', original.tier],
  ]
  for (const [key, value] of env) value === undefined ? delete process.env[key] : process.env[key] = value
})

describe('GET /api/social/callback/pinterest', () => {
  it('stores renewable credentials, verified scopes, public Boards, and honest access tier', async () => {
    const nonce = 'cookie-bound-pinterest-nonce'
    const state = createOAuthState('user-pinterest', 'pinterest', pinterestOAuthNonceHash(nonce))
    global.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'pinterest-access', refresh_token: 'pinterest-refresh', expires_in: 2592000,
        refresh_token_expires_in: 5184000, scope: 'boards:read boards:write pins:read pins:write user_accounts:read',
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'p-user-1', username: 'nexus', business_name: 'NEXUS' }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [{ id: '12345', name: 'Launches', privacy: 'PUBLIC' }], bookmark: null }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch

    const response = await GET(new NextRequest(`https://preview.nexus.test/api/social/callback/pinterest?code=provider-code&state=${encodeURIComponent(state)}`, { headers: { Cookie: `nexus_pinterest_oauth=${nonce}` } }))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://preview.nexus.test/connections?social=connected&platform=pinterest')
    const tokenBody = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as URLSearchParams
    expect(Object.fromEntries(tokenBody)).toMatchObject({ grant_type: 'authorization_code', code: 'provider-code', continuous_refresh: 'true' })
    expect(mocks.integrationUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { workspaceId_type: { workspaceId: 'workspace-1', type: 'PINTEREST' } },
      create: expect.objectContaining({
        type: 'PINTEREST', accessToken: 'encrypted:pinterest-access', refreshToken: 'encrypted:pinterest-refresh', accountId: 'p-user-1',
        config: expect.objectContaining({
          accessTier: 'STANDARD', accessTierEvidence: 'operator_configuration',
          boards: [{ id: '12345', name: 'Launches', privacy: 'PUBLIC', isAdsOnly: false }],
          scopeEvidence: 'provider_response',
        }),
      }),
    }))
  })

  it('rejects state that is not bound to its HttpOnly cookie', async () => {
    global.fetch = vi.fn() as typeof fetch
    const state = createOAuthState('user-pinterest', 'pinterest', pinterestOAuthNonceHash('expected-nonce'))
    const response = await GET(new NextRequest(`https://preview.nexus.test/api/social/callback/pinterest?code=provider-code&state=${encodeURIComponent(state)}`, { headers: { Cookie: 'nexus_pinterest_oauth=different-nonce' } }))
    expect(response.headers.get('location')).toContain('invalid_oauth_context')
    expect(global.fetch).not.toHaveBeenCalled()
    expect(mocks.integrationUpsert).not.toHaveBeenCalled()
  })
})
