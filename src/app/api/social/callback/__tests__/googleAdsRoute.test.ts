import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createOAuthState } from '@/lib/oauthState'
import { googleAdsOAuthNonceHash } from '@/lib/googleAdsOAuth'

const mocks = vi.hoisted(() => ({
  userUpsert: vi.fn(),
  workspaceFindFirst: vi.fn(),
  workspaceCreate: vi.fn(),
  integrationUpsert: vi.fn(),
  adAccountUpsert: vi.fn(),
  adAccountUpdateMany: vi.fn(),
  getUserById: vi.fn(),
  encrypt: vi.fn((value: string) => `encrypted:${value}`),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { upsert: mocks.userUpsert },
    workspace: {
      findFirst: mocks.workspaceFindFirst,
      create: mocks.workspaceCreate,
    },
    integration: { upsert: mocks.integrationUpsert },
    adAccount: { upsert: mocks.adAccountUpsert, updateMany: mocks.adAccountUpdateMany },
  },
}))
vi.mock('@/lib/supabaseAuth', () => ({
  adminClient: { auth: { admin: { getUserById: mocks.getUserById } } },
}))
vi.mock('@/lib/tokenCrypto', () => ({ encryptToken: mocks.encrypt }))

import { GET } from '@/app/api/social/callback/google-ads/route'

const originalFetch = global.fetch
const originalEnv = {
  clientId: process.env.GOOGLE_ADS_CLIENT_ID,
  clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET,
  developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
  accessTier: process.env.GOOGLE_ADS_ACCESS_TIER,
  baseUrl: process.env.NEXT_PUBLIC_APP_URL,
  stateSecret: process.env.OAUTH_STATE_SECRET,
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.GOOGLE_ADS_CLIENT_ID = 'client-id'
  process.env.GOOGLE_ADS_CLIENT_SECRET = 'client-secret'
  process.env.GOOGLE_ADS_DEVELOPER_TOKEN = 'developer-token'
  process.env.GOOGLE_ADS_ACCESS_TIER = 'EXPLORER'
  process.env.NEXT_PUBLIC_APP_URL = 'https://preview.nexus.test'
  process.env.OAUTH_STATE_SECRET = 'a-test-oauth-secret-that-is-longer-than-thirty-two-characters'
  mocks.userUpsert.mockResolvedValue({})
  mocks.workspaceFindFirst.mockResolvedValue({ id: 'workspace-1' })
  mocks.workspaceCreate.mockResolvedValue({ id: 'workspace-1' })
  mocks.integrationUpsert.mockResolvedValue({})
  mocks.adAccountUpsert.mockResolvedValue({})
  mocks.adAccountUpdateMany.mockResolvedValue({ count: 0 })
  mocks.getUserById.mockResolvedValue({ data: { user: { email: 'owner@nexus.test' } } })
})

afterEach(() => {
  global.fetch = originalFetch
  for (const [key, value] of Object.entries(originalEnv)) {
    const envKey = key === 'clientId' ? 'GOOGLE_ADS_CLIENT_ID'
      : key === 'clientSecret' ? 'GOOGLE_ADS_CLIENT_SECRET'
        : key === 'developerToken' ? 'GOOGLE_ADS_DEVELOPER_TOKEN'
          : key === 'accessTier' ? 'GOOGLE_ADS_ACCESS_TIER'
            : key === 'baseUrl' ? 'NEXT_PUBLIC_APP_URL'
              : 'OAUTH_STATE_SECRET'
    if (value === undefined) delete process.env[envKey]
    else process.env[envKey] = value
  }
})

describe('GET /api/social/callback/google-ads', () => {
  it('persists the verified manager connection and keeps execution blocked when no advertiser is visible', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/adwords',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        resourceNames: ['customers/3319467856'],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: [{ customerClient: {
          id: '3319467856', level: '0', manager: true,
          descriptiveName: 'NEXUS AI Marketing OS', status: 'ENABLED', testAccount: false,
        } }],
      }), { status: 200 })) as typeof fetch

    const nonce = 'test-google-ads-oauth-nonce'
    const state = createOAuthState('user-1', 'google_ads', googleAdsOAuthNonceHash(nonce))
    const response = await GET(new NextRequest(
      `https://preview.nexus.test/api/social/callback/google-ads?code=code-1&state=${encodeURIComponent(state)}`,
      { headers: { cookie: `nexus_google_ads_oauth=${nonce}` } },
    ))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://preview.nexus.test/connections?social=connected&platform=google_ads&accounts=0',
    )
    expect(mocks.integrationUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { workspaceId_type: { workspaceId: 'workspace-1', type: 'GOOGLE' } },
      create: expect.objectContaining({
        status: 'CONNECTED',
        accountId: '3319467856',
        accountName: 'NEXUS AI Marketing OS',
        accessToken: 'encrypted:access-token',
        refreshToken: 'encrypted:refresh-token',
        config: expect.objectContaining({
          connectionRole: 'MANAGER',
          advertiserAccountCount: 0,
          advertiserReadiness: 'NOT_VISIBLE',
          accessTier: 'EXPLORER',
        }),
      }),
    }))
    expect(mocks.adAccountUpsert).not.toHaveBeenCalled()
    expect(mocks.adAccountUpdateMany).toHaveBeenCalledWith({
      where: { workspaceId: 'workspace-1', platform: 'GOOGLE' },
      data: expect.objectContaining({
        status: 'DISCONNECTED',
        accessToken: null,
        refreshToken: null,
        hasApiAccess: false,
      }),
    })
  })

  it('marks a CLOSED Google test advertiser executable under TEST access', async () => {
    process.env.GOOGLE_ADS_ACCESS_TIER = 'TEST'
    global.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/adwords',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        resourceNames: ['customers/5510208607'],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: [
          { customerClient: {
            id: '5510208607', level: '0', manager: true,
            descriptiveName: 'NEXUS AI Test Manager', status: 'ENABLED', testAccount: true,
          } },
          { customerClient: {
            id: '4066002888', level: '1', manager: false,
            descriptiveName: 'NEXUS AI Search Sandbox', currencyCode: 'AED',
            timeZone: 'Asia/Dubai', status: 'CLOSED', testAccount: true,
          } },
        ],
      }), { status: 200 })) as typeof fetch

    const nonce = 'test-google-ads-closed-account-nonce'
    const state = createOAuthState('user-1', 'google_ads', googleAdsOAuthNonceHash(nonce))
    const response = await GET(new NextRequest(
      `https://preview.nexus.test/api/social/callback/google-ads?code=code-2&state=${encodeURIComponent(state)}`,
      { headers: { cookie: `nexus_google_ads_oauth=${nonce}` } },
    ))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://preview.nexus.test/connections?social=connected&platform=google_ads&accounts=1',
    )
    expect(mocks.adAccountUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        platform: 'GOOGLE',
        platformAccountId: '4066002888',
        platformAccountName: 'NEXUS AI Search Sandbox',
        loginCustomerId: '5510208607',
        hasApiAccess: true,
        lastError: null,
      }),
      update: expect.objectContaining({
        hasApiAccess: true,
        lastError: null,
      }),
    }))
  })
})
