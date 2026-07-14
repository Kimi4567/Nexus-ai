import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { verifyOAuthState } from '@/lib/oauthState'

const mocks = vi.hoisted(() => ({ getUser: vi.fn() }))
vi.mock('@/lib/supabaseAuth', () => ({ adminClient: { auth: { getUser: mocks.getUser } } }))

import { GET } from '@/app/api/social/connect/pinterest/route'

const original = {
  id: process.env.PINTEREST_APP_ID,
  secret: process.env.PINTEREST_APP_SECRET,
  baseUrl: process.env.NEXT_PUBLIC_APP_URL,
  stateSecret: process.env.OAUTH_STATE_SECRET,
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.PINTEREST_APP_ID = 'pinterest-app-id'
  process.env.PINTEREST_APP_SECRET = 'pinterest-app-secret'
  process.env.NEXT_PUBLIC_APP_URL = 'https://preview.nexus.test'
  process.env.OAUTH_STATE_SECRET = 'a-test-oauth-secret-that-is-longer-than-thirty-two-characters'
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-pinterest' } } })
})

afterEach(() => {
  const env: Array<[string, string | undefined]> = [
    ['PINTEREST_APP_ID', original.id], ['PINTEREST_APP_SECRET', original.secret],
    ['NEXT_PUBLIC_APP_URL', original.baseUrl], ['OAUTH_STATE_SECRET', original.stateSecret],
  ]
  for (const [key, value] of env) value === undefined ? delete process.env[key] : process.env[key] = value
})

describe('GET /api/social/connect/pinterest', () => {
  it('starts cookie-bound OAuth with the exact organic publishing scopes', async () => {
    const response = await GET(new NextRequest('https://preview.nexus.test/api/social/connect/pinterest', { headers: { Authorization: 'Bearer session' } }))
    const body = await response.json()
    const url = new URL(body.url)
    expect(response.status).toBe(200)
    expect(url.origin).toBe('https://www.pinterest.com')
    expect(url.searchParams.get('redirect_uri')).toBe('https://preview.nexus.test/api/social/callback/pinterest')
    expect(url.searchParams.get('scope')?.split(',')).toEqual(['boards:read', 'boards:write', 'pins:read', 'pins:write', 'user_accounts:read'])
    expect(verifyOAuthState(url.searchParams.get('state') || '', 'pinterest').context).toBeTruthy()
    expect(response.headers.get('set-cookie')).toContain('nexus_pinterest_oauth=')
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
    expect(response.headers.get('set-cookie')).toContain('SameSite=lax')
  })

  it('fails closed when Pinterest credentials are absent', async () => {
    delete process.env.PINTEREST_APP_SECRET
    const response = await GET(new NextRequest('https://preview.nexus.test/api/social/connect/pinterest', { headers: { Authorization: 'Bearer session' } }))
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ code: 'PINTEREST_OAUTH_NOT_CONFIGURED' })
  })
})
