import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { verifyOAuthState } from '@/lib/oauthState'

const mocks = vi.hoisted(() => ({ getUser: vi.fn() }))
vi.mock('@/lib/supabaseAuth', () => ({ adminClient: { auth: { getUser: mocks.getUser } } }))

import { GET as connectMeta } from '@/app/api/social/connect/meta/route'
import { GET as connectTikTok } from '@/app/api/social/connect/tiktok/route'
import { GET as connectLinkedIn } from '@/app/api/social/connect/linkedin/route'
import { GET as getReadiness } from '@/app/api/social/readiness/route'

const keys = [
  'META_APP_ID',
  'META_APP_SECRET',
  'META_ENABLE_INSTAGRAM_SCOPES',
  'TIKTOK_CLIENT_KEY',
  'TIKTOK_CLIENT_SECRET',
  'LINKEDIN_CLIENT_ID',
  'LINKEDIN_CLIENT_SECRET',
  'LINKEDIN_ORGANIZATION_PUBLISHING_ENABLED',
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
  process.env.LINKEDIN_CLIENT_ID = 'linkedin-id'
  process.env.LINKEDIN_CLIENT_SECRET = 'linkedin-secret'
  process.env.NEXT_PUBLIC_APP_URL = 'https://www.nexus-grow.com'
  process.env.OAUTH_STATE_SECRET = 'a-test-oauth-secret-that-is-longer-than-thirty-two-characters'
  delete process.env.META_ENABLE_INSTAGRAM_SCOPES
  delete process.env.LINKEDIN_ORGANIZATION_PUBLISHING_ENABLED
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-social' } }, error: null })
})

afterEach(() => {
  for (const key of keys) {
    const value = original[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe('pre-approval OAuth initiation', () => {
  it('starts least-privilege Meta Page OAuth and defers Instagram scopes', async () => {
    const response = await connectMeta(new NextRequest('https://www.nexus-grow.com/api/social/connect/meta', {
      headers: { Authorization: 'Bearer session' },
    }))
    const body = await response.json()
    const url = new URL(body.url)
    const scopes = (url.searchParams.get('scope') || '').split(',')

    expect(response.status).toBe(200)
    expect(url.searchParams.get('redirect_uri')).toBe('https://www.nexus-grow.com/api/social/callback/meta')
    expect(scopes).toEqual(['public_profile', 'pages_show_list', 'pages_read_engagement', 'pages_manage_posts'])
    expect(scopes).not.toContain('instagram_content_publish')
    expect(verifyOAuthState(url.searchParams.get('state') || '', 'meta').userId).toBe('user-social')
  })

  it('starts TikTok OAuth with only identity and direct-post scopes', async () => {
    const response = await connectTikTok(new NextRequest('https://www.nexus-grow.com/api/social/connect/tiktok', {
      headers: { Authorization: 'Bearer session' },
    }))
    const body = await response.json()
    const url = new URL(body.url)

    expect(response.status).toBe(200)
    expect(url.searchParams.get('redirect_uri')).toBe('https://www.nexus-grow.com/api/social/callback/tiktok')
    expect((url.searchParams.get('scope') || '').split(',')).toEqual(['user.info.basic', 'video.publish'])
    expect(verifyOAuthState(url.searchParams.get('state') || '', 'tiktok').userId).toBe('user-social')
  })

  it('keeps LinkedIn Company Page scopes out of the member flow before product access', async () => {
    const response = await connectLinkedIn(new NextRequest('https://www.nexus-grow.com/api/social/connect/linkedin', {
      headers: { Authorization: 'Bearer session' },
    }))
    const body = await response.json()
    const url = new URL(body.url)
    const scopes = (url.searchParams.get('scope') || '').split(' ')

    expect(response.status).toBe(200)
    expect(url.searchParams.get('redirect_uri')).toBe('https://www.nexus-grow.com/api/social/callback/linkedin')
    expect(scopes).toEqual(['openid', 'profile', 'email', 'w_member_social'])
    expect(scopes).not.toContain('w_organization_social')
    expect(verifyOAuthState(url.searchParams.get('state') || '', 'linkedin').userId).toBe('user-social')
  })

  it('fails closed before redirect when any provider secret is missing', async () => {
    delete process.env.META_APP_SECRET
    delete process.env.TIKTOK_CLIENT_SECRET
    delete process.env.LINKEDIN_CLIENT_SECRET
    const request = (path: string) => new NextRequest(`https://www.nexus-grow.com${path}`, {
      headers: { Authorization: 'Bearer session' },
    })

    await expect(connectMeta(request('/api/social/connect/meta')).then(async response => [response.status, await response.json()]))
      .resolves.toEqual([503, expect.objectContaining({ code: 'META_OAUTH_NOT_CONFIGURED' })])
    await expect(connectTikTok(request('/api/social/connect/tiktok')).then(async response => [response.status, await response.json()]))
      .resolves.toEqual([503, expect.objectContaining({ code: 'TIKTOK_OAUTH_NOT_CONFIGURED' })])
    await expect(connectLinkedIn(request('/api/social/connect/linkedin')).then(async response => [response.status, await response.json()]))
      .resolves.toEqual([503, expect.objectContaining({ code: 'LINKEDIN_OAUTH_NOT_CONFIGURED' })])
  })

  it('fails closed when the OAuth state-signing secret is unavailable', async () => {
    delete process.env.OAUTH_STATE_SECRET
    const request = (path: string) => new NextRequest(`https://www.nexus-grow.com${path}`, {
      headers: { Authorization: 'Bearer session' },
    })

    await expect(connectMeta(request('/api/social/connect/meta')).then(async response => [response.status, await response.json()]))
      .resolves.toEqual([503, expect.objectContaining({ code: 'META_OAUTH_NOT_CONFIGURED' })])
    await expect(connectTikTok(request('/api/social/connect/tiktok')).then(async response => [response.status, await response.json()]))
      .resolves.toEqual([503, expect.objectContaining({ code: 'TIKTOK_OAUTH_NOT_CONFIGURED' })])
    await expect(connectLinkedIn(request('/api/social/connect/linkedin')).then(async response => [response.status, await response.json()]))
      .resolves.toEqual([503, expect.objectContaining({ code: 'LINKEDIN_OAUTH_NOT_CONFIGURED' })])
  })
})

describe('GET /api/social/readiness', () => {
  it('reports configured callbacks and provider-review boundaries without exposing secrets', async () => {
    const response = await getReadiness(new NextRequest('https://www.nexus-grow.com/api/social/readiness', {
      headers: { Authorization: 'Bearer session' },
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.providers).toHaveLength(3)
    expect(body.providers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        platform: 'META',
        credentialsConfigured: true,
        callbackUrl: 'https://www.nexus-grow.com/api/social/callback/meta',
        deferredScopes: ['instagram_basic', 'instagram_content_publish'],
      }),
      expect.objectContaining({
        platform: 'LINKEDIN',
        credentialsConfigured: true,
        deferredScopes: ['r_organization_admin', 'r_organization_social', 'w_organization_social'],
      }),
      expect.objectContaining({
        platform: 'TIKTOK',
        credentialsConfigured: true,
        publicAccess: 'PROVIDER_AUDIT_REQUIRED',
      }),
    ]))
    expect(JSON.stringify(body)).not.toContain('meta-secret')
    expect(JSON.stringify(body)).not.toContain('tiktok-secret')
    expect(JSON.stringify(body)).not.toContain('linkedin-secret')
  })

  it('does not report OAuth readiness without a secure state-signing secret', async () => {
    delete process.env.OAUTH_STATE_SECRET
    const response = await getReadiness(new NextRequest('https://www.nexus-grow.com/api/social/readiness', {
      headers: { Authorization: 'Bearer session' },
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.providers.every((provider: { credentialsConfigured: boolean }) => !provider.credentialsConfigured)).toBe(true)
  })
})
