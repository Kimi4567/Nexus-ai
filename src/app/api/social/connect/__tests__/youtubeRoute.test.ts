import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ getUser: vi.fn() }))

vi.mock('@/lib/supabaseAuth', () => ({
  adminClient: { auth: { getUser: mocks.getUser } },
}))

import { GET } from '@/app/api/social/connect/youtube/route'

const original = {
  clientId: process.env.GOOGLE_CLIENT_ID,
  baseUrl: process.env.NEXT_PUBLIC_APP_URL,
  secret: process.env.OAUTH_STATE_SECRET,
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.GOOGLE_CLIENT_ID = 'google-client-id'
  process.env.NEXT_PUBLIC_APP_URL = 'https://preview.nexus.test'
  process.env.OAUTH_STATE_SECRET = 'a-test-oauth-secret-that-is-longer-than-thirty-two-characters'
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
})

afterEach(() => {
  if (original.clientId === undefined) delete process.env.GOOGLE_CLIENT_ID
  else process.env.GOOGLE_CLIENT_ID = original.clientId
  if (original.baseUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL
  else process.env.NEXT_PUBLIC_APP_URL = original.baseUrl
  if (original.secret === undefined) delete process.env.OAUTH_STATE_SECRET
  else process.env.OAUTH_STATE_SECRET = original.secret
})

describe('GET /api/social/connect/youtube', () => {
  it('requests offline upload and readback access with signed state', async () => {
    const response = await GET(new NextRequest('https://preview.nexus.test/api/social/connect/youtube', {
      headers: { Authorization: 'Bearer session' },
    }))
    const body = await response.json()
    const url = new URL(body.url)

    expect(response.status).toBe(200)
    expect(url.origin).toBe('https://accounts.google.com')
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('prompt')).toBe('consent')
    expect(url.searchParams.get('redirect_uri')).toBe('https://preview.nexus.test/api/social/callback/youtube')
    expect(url.searchParams.get('scope')?.split(' ')).toEqual([
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
    ])
    expect(url.searchParams.get('state')).toBeTruthy()
  })

  it('fails closed when Google credentials are not configured', async () => {
    delete process.env.GOOGLE_CLIENT_ID
    const response = await GET(new NextRequest('https://preview.nexus.test/api/social/connect/youtube', {
      headers: { Authorization: 'Bearer session' },
    }))
    expect(response.status).toBe(503)
  })
})
