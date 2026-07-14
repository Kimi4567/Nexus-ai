import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { verifyOAuthState } from '@/lib/oauthState'

const mocks = vi.hoisted(() => ({ getUser: vi.fn() }))
vi.mock('@/lib/supabaseAuth', () => ({ adminClient: { auth: { getUser: mocks.getUser } } }))

import { GET } from '@/app/api/social/connect/google-ads/route'

const original = {
  clientId: process.env.GOOGLE_ADS_CLIENT_ID,
  clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET,
  developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
  appUrl: process.env.NEXT_PUBLIC_APP_URL,
  stateSecret: process.env.OAUTH_STATE_SECRET,
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.GOOGLE_ADS_CLIENT_ID = 'google-ads-client-id'
  process.env.GOOGLE_ADS_CLIENT_SECRET = 'google-ads-client-secret'
  process.env.GOOGLE_ADS_DEVELOPER_TOKEN = 'developer-token'
  process.env.NEXT_PUBLIC_APP_URL = 'https://preview.nexus.test'
  process.env.OAUTH_STATE_SECRET = 'a-test-oauth-secret-that-is-longer-than-thirty-two-characters'
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-google-ads' } } })
})

afterEach(() => {
  for (const [key, value] of Object.entries(original)) {
    const envKey = key === 'clientId' ? 'GOOGLE_ADS_CLIENT_ID'
      : key === 'clientSecret' ? 'GOOGLE_ADS_CLIENT_SECRET'
        : key === 'developerToken' ? 'GOOGLE_ADS_DEVELOPER_TOKEN'
          : key === 'appUrl' ? 'NEXT_PUBLIC_APP_URL'
            : 'OAUTH_STATE_SECRET'
    if (value === undefined) delete process.env[envKey]
    else process.env[envKey] = value
  }
})

describe('GET /api/social/connect/google-ads', () => {
  it('starts cookie-bound offline OAuth with the Google Ads scope', async () => {
    const response = await GET(new NextRequest('https://preview.nexus.test/api/social/connect/google-ads', {
      headers: { Authorization: 'Bearer session' },
    }))
    const body = await response.json()
    const url = new URL(body.url)

    expect(response.status).toBe(200)
    expect(url.origin).toBe('https://accounts.google.com')
    expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/adwords')
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('prompt')).toBe('consent')
    expect(url.searchParams.get('redirect_uri')).toBe('https://preview.nexus.test/api/social/callback/google-ads')
    expect(verifyOAuthState(url.searchParams.get('state') || '', 'google_ads').context).toBeTruthy()
    expect(response.headers.get('set-cookie')).toContain('nexus_google_ads_oauth=')
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
    expect(response.headers.get('set-cookie')).toContain('Max-Age=1800')
  })

  it('fails closed when the developer token is absent', async () => {
    delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN
    const response = await GET(new NextRequest('https://preview.nexus.test/api/social/connect/google-ads', {
      headers: { Authorization: 'Bearer session' },
    }))
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ code: 'GOOGLE_ADS_NOT_CONFIGURED' })
  })
})
