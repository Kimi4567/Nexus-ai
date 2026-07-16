import { describe, expect, it } from 'vitest'
import {
  getMetaOrganicScopes,
  hasVerifiedProviderScope,
  TIKTOK_CONTENT_SCOPES,
  YOUTUBE_CONTENT_SCOPES,
} from '@/lib/socialPlatformConfig'

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

describe('review-bound social scopes', () => {
  it('keeps the default Meta review to demonstrated Facebook permissions', () => {
    expect(getMetaOrganicScopes(false)).toEqual([
      'public_profile',
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
    ])
    expect(getMetaOrganicScopes(false)).not.toContain('instagram_content_publish')
    expect(getMetaOrganicScopes(true)).toContain('instagram_content_publish')
  })

  it('requests only the implemented TikTok Direct Post scopes', () => {
    expect(TIKTOK_CONTENT_SCOPES).toEqual(['user.info.basic', 'video.publish'])
    expect(TIKTOK_CONTENT_SCOPES).not.toContain('video.list')
    expect(TIKTOK_CONTENT_SCOPES).not.toContain('video.upload')
  })
})
