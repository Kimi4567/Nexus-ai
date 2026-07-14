import { describe, expect, it } from 'vitest'
import { hasVerifiedProviderScope, YOUTUBE_CONTENT_SCOPES } from '@/lib/socialPlatformConfig'

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

describe('YouTube scopes', () => {
  it('requests only upload and readback permissions needed by the publishing workflow', () => {
    expect(YOUTUBE_CONTENT_SCOPES).toEqual([
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
    ])
  })
})
