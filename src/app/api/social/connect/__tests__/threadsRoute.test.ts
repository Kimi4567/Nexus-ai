import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { verifyOAuthState } from '@/lib/oauthState'

const mocks = vi.hoisted(() => ({ getUser: vi.fn() }))
vi.mock('@/lib/supabaseAuth', () => ({ adminClient: { auth: { getUser: mocks.getUser } } }))

import { GET } from '@/app/api/social/connect/threads/route'

const original = {
  id: process.env.THREADS_APP_ID,
  secret: process.env.THREADS_APP_SECRET,
  baseUrl: process.env.NEXT_PUBLIC_APP_URL,
  stateSecret: process.env.OAUTH_STATE_SECRET,
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.THREADS_APP_ID = 'threads-app-id'
  process.env.THREADS_APP_SECRET = 'threads-app-secret'
  process.env.NEXT_PUBLIC_APP_URL = 'https://preview.nexus.test'
  process.env.OAUTH_STATE_SECRET = 'a-test-oauth-secret-that-is-longer-than-thirty-two-characters'
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-threads' } } })
})

afterEach(() => {
  original.id === undefined ? delete process.env.THREADS_APP_ID : process.env.THREADS_APP_ID = original.id
  original.secret === undefined ? delete process.env.THREADS_APP_SECRET : process.env.THREADS_APP_SECRET = original.secret
  original.baseUrl === undefined ? delete process.env.NEXT_PUBLIC_APP_URL : process.env.NEXT_PUBLIC_APP_URL = original.baseUrl
  original.stateSecret === undefined ? delete process.env.OAUTH_STATE_SECRET : process.env.OAUTH_STATE_SECRET = original.stateSecret
})

describe('GET /api/social/connect/threads', () => {
  it('starts cookie-bound OAuth with only implemented Threads scopes', async () => {
    const response = await GET(new NextRequest('https://preview.nexus.test/api/social/connect/threads', { headers: { Authorization: 'Bearer session' } }))
    const body = await response.json()
    const url = new URL(body.url)
    expect(response.status).toBe(200)
    expect(url.origin).toBe('https://threads.net')
    expect(url.searchParams.get('redirect_uri')).toBe('https://preview.nexus.test/api/social/callback/threads')
    expect(url.searchParams.get('scope')?.split(',')).toEqual(['threads_basic', 'threads_content_publish', 'threads_manage_insights'])
    expect(verifyOAuthState(url.searchParams.get('state') || '', 'threads').context).toBeTruthy()
    expect(response.headers.get('set-cookie')).toContain('nexus_threads_oauth=')
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
  })

  it('fails closed when Meta Threads credentials are absent', async () => {
    delete process.env.THREADS_APP_SECRET
    const response = await GET(new NextRequest('https://preview.nexus.test/api/social/connect/threads', { headers: { Authorization: 'Bearer session' } }))
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ code: 'THREADS_OAUTH_NOT_CONFIGURED' })
  })
})
