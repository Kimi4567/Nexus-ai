import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetUser } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
}))

vi.mock('@/lib/supabaseAuth', () => ({
  adminClient: {
    auth: {
      getUser: mockGetUser,
    },
  },
}))

import { GET } from '../meta-ads/route'

const makeReq = (authorization = 'Bearer test-token') =>
  ({
    headers: {
      get: (key: string) => (key.toLowerCase() === 'authorization' ? authorization : null),
    },
  }) as any

describe('Meta Ads connect route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.META_APP_ID = '123456789'
    process.env.NEXT_PUBLIC_APP_URL = 'https://nexus-grow.com'
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user_123' } },
      error: null,
    })
  })

  it('builds a Marketing API OAuth URL with valid paid scopes only', async () => {
    const res = await GET(makeReq())
    expect(res.status).toBe(200)

    const json = await res.json()
    const url = new URL(json.url)
    const scopes = url.searchParams.get('scope')?.split(',') ?? []

    expect(url.origin).toBe('https://www.facebook.com')
    expect(url.pathname).toBe('/v21.0/dialog/oauth')
    expect(url.searchParams.get('redirect_uri')).toBe('https://nexus-grow.com/api/social/callback/meta-ads')
    expect(scopes).toEqual([
      'public_profile',
      'ads_management',
      'ads_read',
      'business_management',
    ])
    expect(scopes).not.toContain('read_insights')
  })

  it('requires an authenticated user before returning an OAuth URL', async () => {
    const res = await GET(makeReq(''))
    expect(res.status).toBe(401)
  })
})
