import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createOAuthState } from '@/lib/oauthState'

const mocks = vi.hoisted(() => ({
  userUpsert: vi.fn(),
  userFindUnique: vi.fn(),
  workspaceFindFirst: vi.fn(),
  workspaceFindUnique: vi.fn(),
  workspaceCreate: vi.fn(),
  integrationUpsert: vi.fn(),
  getAuthUserById: vi.fn(),
  encrypt: vi.fn((value: string) => `encrypted:${value}`),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { upsert: mocks.userUpsert, findUnique: mocks.userFindUnique },
    workspace: {
      findFirst: mocks.workspaceFindFirst,
      findUnique: mocks.workspaceFindUnique,
      create: mocks.workspaceCreate,
    },
    integration: { upsert: mocks.integrationUpsert },
  },
}))
vi.mock('@/lib/tokenCrypto', () => ({ encryptToken: mocks.encrypt }))
vi.mock('@/lib/supabaseAuth', () => ({
  adminClient: { auth: { admin: { getUserById: mocks.getAuthUserById } } },
}))

import { GET as callbackMeta } from '@/app/api/social/callback/meta/route'
import { GET as callbackMetaAds } from '@/app/api/social/callback/meta-ads/route'
import { GET as callbackTikTok } from '@/app/api/social/callback/tiktok/route'
import { GET as callbackLinkedIn } from '@/app/api/social/callback/linkedin/route'

const originalFetch = global.fetch
const keys = [
  'META_APP_ID',
  'META_APP_SECRET',
  'TIKTOK_CLIENT_KEY',
  'TIKTOK_CLIENT_SECRET',
  'TIKTOK_REDIRECT_URI',
  'LINKEDIN_CLIENT_ID',
  'LINKEDIN_CLIENT_SECRET',
  'NEXT_PUBLIC_APP_URL',
  'OAUTH_STATE_SECRET',
] as const
const original = Object.fromEntries(keys.map(key => [key, process.env[key]]))

beforeEach(() => {
  vi.clearAllMocks()
  process.env.META_APP_ID = 'meta-id'
  process.env.META_APP_SECRET = 'meta-secret'
  process.env.TIKTOK_CLIENT_KEY = 'tiktok-key'
  process.env.TIKTOK_CLIENT_SECRET = 'tiktok-secret'
  process.env.TIKTOK_REDIRECT_URI = 'https://nexus-grow.com/api/social/callback/tiktok'
  process.env.LINKEDIN_CLIENT_ID = 'linkedin-id'
  process.env.LINKEDIN_CLIENT_SECRET = 'linkedin-secret'
  process.env.NEXT_PUBLIC_APP_URL = 'https://www.nexus-grow.com'
  process.env.OAUTH_STATE_SECRET = 'a-test-oauth-secret-that-is-longer-than-thirty-two-characters'
  mocks.userUpsert.mockResolvedValue({ id: 'user-social' })
  mocks.workspaceFindFirst.mockResolvedValue({ id: 'workspace-1' })
  mocks.integrationUpsert.mockResolvedValue({ id: 'integration-1' })
  mocks.userFindUnique.mockResolvedValue({ email: 'owner@nexus.test' })
  mocks.getAuthUserById.mockResolvedValue({ data: { user: { email: 'owner@nexus.test' } } })
})

afterEach(() => {
  global.fetch = originalFetch
  for (const key of keys) {
    const value = original[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe('provider callbacks before public approval', () => {
  it('returns a cancelled Meta Ads connection to Connections with an explicit no-permission result', async () => {
    const response = await callbackMetaAds(new NextRequest(
      'https://www.nexus-grow.com/api/social/callback/meta-ads?error=access_denied',
    ))

    expect(response.headers.get('location')).toBe(
      'https://www.nexus-grow.com/connections?social=error&msg=authorization_not_granted',
    )
    expect(global.fetch).toBe(originalFetch)
    expect(mocks.integrationUpsert).not.toHaveBeenCalled()
  })

  it('stores only Meta Pages that include a real Page token and provider-confirmed scopes', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'short-meta-token', expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'long-meta-token', expires_in: 5_184_000 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'meta-user', name: 'Nexus Owner' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [
        { id: 'page-valid', name: 'NEXUS', access_token: 'page-token' },
        { id: 'page-missing-token', name: 'Not publishable' },
      ] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [
        { permission: 'pages_show_list', status: 'granted' },
        { permission: 'pages_manage_posts', status: 'granted' },
      ] }), { status: 200 })) as typeof fetch

    const state = createOAuthState('user-social', 'meta')
    const response = await callbackMeta(new NextRequest(
      `https://www.nexus-grow.com/api/social/callback/meta?code=provider-code&state=${encodeURIComponent(state)}`,
    ))

    expect(response.headers.get('location')).toBe('https://www.nexus-grow.com/connections?social=connected&platform=meta')
    expect(mocks.integrationUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        accessToken: 'encrypted:long-meta-token',
        config: expect.objectContaining({
          scopeEvidence: 'provider_response',
          scopes: ['pages_show_list', 'pages_manage_posts'],
          pages: [{ id: 'page-valid', name: 'NEXUS', accessToken: 'encrypted:page-token', igAccountId: null }],
        }),
      }),
    }))
  })

  it('uses one documented TikTok token exchange and stores provider-returned scope evidence', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'tiktok-token',
        refresh_token: 'tiktok-refresh',
        open_id: 'creator-1',
        expires_in: 86_400,
        refresh_expires_in: 31_536_000,
        scope: 'user.info.basic,video.publish',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { user: { open_id: 'creator-1', display_name: 'NEXUS Creator', avatar_url: 'https://example.com/avatar.jpg' } },
      }), { status: 200 })) as typeof fetch

    const state = createOAuthState('user-social', 'tiktok')
    const response = await callbackTikTok(new NextRequest(
      `https://www.nexus-grow.com/api/social/callback/tiktok?code=provider-code&state=${encodeURIComponent(state)}`,
    ))

    expect(global.fetch).toHaveBeenCalledTimes(2)
    const tokenCall = vi.mocked(global.fetch).mock.calls[0]
    expect(tokenCall[0]).toBe('https://open.tiktokapis.com/v2/oauth/token/')
    expect(String((tokenCall[1]?.body as URLSearchParams).get('client_key'))).toBe('tiktok-key')
    expect((tokenCall[1]?.body as URLSearchParams).get('redirect_uri'))
      .toBe('https://nexus-grow.com/api/social/callback/tiktok')
    expect((tokenCall[1]?.headers as Record<string, string>).Authorization).toBeUndefined()
    expect(response.headers.get('location')).toBe('https://www.nexus-grow.com/connections?social=connected&platform=tiktok')
    expect(mocks.integrationUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        accessToken: 'encrypted:tiktok-token',
        refreshToken: 'encrypted:tiktok-refresh',
        config: expect.objectContaining({
          scopeEvidence: 'provider_response',
          profileEvidence: 'provider_response',
          scopes: ['user.info.basic', 'video.publish'],
        }),
      }),
    }))
  })

  it('does not query LinkedIn organizations without the gated admin scope and preserves refresh data when provided', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'linkedin-token',
        refresh_token: 'linkedin-refresh',
        expires_in: 5_184_000,
        refresh_token_expires_in: 31_536_000,
        scope: 'openid profile email w_member_social',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        sub: 'linkedin-person-1',
        name: 'NEXUS Owner',
        email: 'owner@nexus.test',
      }), { status: 200 })) as typeof fetch

    const state = createOAuthState('user-social', 'linkedin')
    const response = await callbackLinkedIn(new NextRequest(
      `https://www.nexus-grow.com/api/social/callback/linkedin?code=provider-code&state=${encodeURIComponent(state)}`,
    ))

    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(response.headers.get('location')).toBe('https://www.nexus-grow.com/connections?social=connected&platform=linkedin')
    expect(mocks.integrationUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        accessToken: 'encrypted:linkedin-token',
        refreshToken: 'encrypted:linkedin-refresh',
        config: expect.objectContaining({
          scopeEvidence: 'provider_response',
          scopes: ['openid', 'profile', 'email', 'w_member_social'],
          organizations: [],
        }),
      }),
    }))
  })

  it('never retries a rejected TikTok token exchange', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      error: 'invalid_grant',
      error_description: 'authorization code rejected',
    }), { status: 400 })) as typeof fetch

    const state = createOAuthState('user-social', 'tiktok')
    const response = await callbackTikTok(new NextRequest(
      `https://www.nexus-grow.com/api/social/callback/tiktok?code=bad-code&state=${encodeURIComponent(state)}`,
    ))

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(mocks.integrationUpsert).not.toHaveBeenCalled()
    expect(response.headers.get('location')).toBe('https://www.nexus-grow.com/connections?social=error&msg=token_exchange_failed')
  })
})
