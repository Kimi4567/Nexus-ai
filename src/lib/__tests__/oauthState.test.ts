import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createOAuthState, oauthStateMaxAgeSeconds, verifyOAuthState } from '@/lib/oauthState'

const originalSecret = process.env.OAUTH_STATE_SECRET

beforeEach(() => {
  process.env.OAUTH_STATE_SECRET = 'a-secure-test-secret-that-is-longer-than-32-characters'
})

afterEach(() => {
  vi.useRealTimers()
  if (originalSecret === undefined) delete process.env.OAUTH_STATE_SECRET
  else process.env.OAUTH_STATE_SECRET = originalSecret
})

describe('signed OAuth state', () => {
  it('round-trips the authenticated user and provider', () => {
    const state = createOAuthState('user-1', 'linkedin')
    expect(verifyOAuthState(state, 'linkedin')).toMatchObject({
      v: 1,
      provider: 'linkedin',
      userId: 'user-1',
    })
  })

  it('supports YouTube without allowing cross-provider state reuse', () => {
    const state = createOAuthState('user-2', 'youtube')
    expect(verifyOAuthState(state, 'youtube')).toMatchObject({ provider: 'youtube', userId: 'user-2' })
    expect(() => verifyOAuthState(state, 'tiktok')).toThrow('payload')
  })

  it('binds X PKCE evidence into signed state without cross-provider reuse', () => {
    const state = createOAuthState('user-x', 'x', 'pkce-verifier-hash')
    expect(verifyOAuthState(state, 'x')).toMatchObject({
      provider: 'x',
      userId: 'user-x',
      context: 'pkce-verifier-hash',
    })
    expect(() => verifyOAuthState(state, 'youtube')).toThrow('payload')
  })

  it('rejects tampering and cross-provider replay', () => {
    const state = createOAuthState('user-1', 'meta')
    const [payload, signature] = state.split('.')
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString())
    decoded.userId = 'victim-user'
    const tampered = `${Buffer.from(JSON.stringify(decoded)).toString('base64url')}.${signature}`

    expect(() => verifyOAuthState(tampered, 'meta')).toThrow('signature')
    expect(() => verifyOAuthState(state, 'tiktok')).toThrow('payload')
  })

  it('rejects expired state', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-12T00:00:00Z'))
    const state = createOAuthState('user-1', 'meta_ads')
    vi.setSystemTime(new Date('2026-07-12T00:11:00Z'))
    expect(() => verifyOAuthState(state, 'meta_ads')).toThrow('Expired')
  })

  it('allows Google Ads MFA to finish within 30 minutes but not beyond it', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-12T00:00:00Z'))
    const state = createOAuthState('user-1', 'google_ads')
    expect(oauthStateMaxAgeSeconds('google_ads')).toBe(30 * 60)

    vi.setSystemTime(new Date('2026-07-12T00:29:00Z'))
    expect(verifyOAuthState(state, 'google_ads')).toMatchObject({ userId: 'user-1' })

    vi.setSystemTime(new Date('2026-07-12T00:31:00Z'))
    expect(() => verifyOAuthState(state, 'google_ads')).toThrow('Expired')
  })

  it('fails closed when the signing secret is missing', () => {
    delete process.env.OAUTH_STATE_SECRET
    expect(() => createOAuthState('user-1', 'linkedin')).toThrow('OAUTH_STATE_SECRET')
  })
})
