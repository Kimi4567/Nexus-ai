import { describe, expect, it } from 'vitest'
import { hasVerifiedProviderScope } from '@/lib/socialPlatformConfig'

describe('hasVerifiedProviderScope', () => {
  it('accepts only a scope returned by the provider', () => {
    expect(hasVerifiedProviderScope({
      scopeEvidence: 'provider_response',
      scopes: ['pages_manage_posts'],
    }, 'pages_manage_posts')).toBe(true)
  })

  it('does not treat requested or legacy scopes as granted permissions', () => {
    expect(hasVerifiedProviderScope({ scopes: ['pages_manage_posts'] }, 'pages_manage_posts')).toBe(false)
    expect(hasVerifiedProviderScope({
      scopeEvidence: 'requested',
      scopes: ['pages_manage_posts'],
    }, 'pages_manage_posts')).toBe(false)
  })

  it('fails closed for missing or different permissions', () => {
    expect(hasVerifiedProviderScope(null, 'video.publish')).toBe(false)
    expect(hasVerifiedProviderScope({
      scopeEvidence: 'provider_response',
      scopes: ['video.list'],
    }, 'video.publish')).toBe(false)
  })
})
