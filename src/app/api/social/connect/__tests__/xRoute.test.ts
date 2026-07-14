import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { verifyOAuthState } from '@/lib/oauthState'

const mocks = vi.hoisted(() => ({ getUser: vi.fn() }))

vi.mock('@/lib/supabaseAuth', () => ({
  adminClient: { auth: { getUser: mocks.getUser } },
}))

import { GET } from '@/app/api/social/connect/x/route'

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
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-x' } } })
})

afterEach(() => {
  for (const [key, value] of Object.entries(original)) {
    const envKey = key === 'baseUrl'
      ? 'NEXT_PUBLIC_APP_URL'
      : key === 'stateSecret'
        ? 'OAUTH_STATE_SECRET'
        : key === 'clientId'
          ? 'X_CLIENT_ID'
          : 'X_CLIENT_SECRET'
    if (value === undefined) delete process.env[envKey]
    else process.env[envKey] = value
  }
})

describe('GET /api/social/connect/x', () => {
  it('starts confidential OAuth2 PKCE with publish, media, readback, and offline scopes', async () => {
    const response = await GET(new NextRequest('https://preview.nexus.test/api/social/connect/x', {
      headers: { Authorization: 'Bearer session' },
    }))
    const body = await response.json()
    const url = new URL(body.url)
    const state = url.searchParams.get('state') || ''

    expect(response.status).toBe(200)
    expect(url.origin).toBe('https://x.com')
    expect(url.searchParams.get('redirect_uri')).toBe('https://preview.nexus.test/api/social/callback/x')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(url.searchParams.get('scope')?.split(' ')).toEqual([
      'tweet.read',
      'tweet.write',
      'users.read',
      'media.write',
      'offline.access',
    ])
    expect(verifyOAuthState(state, 'x').context).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(response.headers.get('set-cookie')).toContain('nexus_x_pkce=')
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
    expect(response.headers.get('set-cookie')).toContain('SameSite=lax')
  })

  it('fails closed when X credentials are missing', async () => {
    delete process.env.X_CLIENT_SECRET
    const response = await GET(new NextRequest('https://preview.nexus.test/api/social/connect/x', {
      headers: { Authorization: 'Bearer session' },
    }))
    expect(response.status).toBe(503)
  })
})
