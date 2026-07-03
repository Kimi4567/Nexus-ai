/**
 * PR-1M — one consistent campaign platform list. Normalize the explicit
 * campaign.platforms field so every surface shows the same list; never invent a
 * platform or fall back to a hardcoded default.
 */
import { describe, it, expect } from 'vitest'
import {
  normalizeCampaignPlatforms,
  platformLabel,
  getCampaignPlatformSummary,
} from '@/lib/campaignPlatforms'

describe('normalizeCampaignPlatforms (PR-1M)', () => {
  it('returns explicit platforms as normalized keys', () => {
    expect(normalizeCampaignPlatforms(['Facebook', 'Instagram', 'LinkedIn']))
      .toEqual(['FACEBOOK', 'INSTAGRAM', 'LINKEDIN'])
  })

  it('de-dupes case-insensitively', () => {
    expect(normalizeCampaignPlatforms(['facebook', 'FACEBOOK', 'Facebook']))
      .toEqual(['FACEBOOK'])
  })

  it('orders consistently regardless of input order (so surfaces agree)', () => {
    const a = normalizeCampaignPlatforms(['LinkedIn', 'Instagram', 'Facebook'])
    const b = normalizeCampaignPlatforms(['Facebook', 'LinkedIn', 'Instagram'])
    expect(a).toEqual(b)
    expect(a).toEqual(['FACEBOOK', 'INSTAGRAM', 'LINKEDIN'])
  })

  it('missing / empty / non-array input returns [] (never a hardcoded default)', () => {
    expect(normalizeCampaignPlatforms(null)).toEqual([])
    expect(normalizeCampaignPlatforms(undefined)).toEqual([])
    expect(normalizeCampaignPlatforms([])).toEqual([])
    expect(normalizeCampaignPlatforms(['', '  ', null, undefined])).toEqual([])
    expect(normalizeCampaignPlatforms('facebook' as never)).toEqual([])
  })

  it('keeps unknown platforms (no invention, no dropping) after known ones', () => {
    expect(normalizeCampaignPlatforms(['Threads', 'Facebook']))
      .toEqual(['FACEBOOK', 'THREADS'])
  })
})

describe('platformLabel (PR-1M)', () => {
  it('maps known keys to clean labels', () => {
    expect(platformLabel('FACEBOOK')).toBe('Facebook')
    expect(platformLabel('tiktok')).toBe('TikTok')
    expect(platformLabel('LINKEDIN')).toBe('LinkedIn')
    expect(platformLabel('youtube_shorts')).toBe('YouTube Shorts')
  })
  it('title-cases unknown keys', () => {
    expect(platformLabel('THREADS')).toBe('Threads')
  })
})

describe('getCampaignPlatformSummary (PR-1M)', () => {
  it('summarizes with labels and not-empty', () => {
    const s = getCampaignPlatformSummary(['instagram', 'facebook', 'youtube_shorts'], 'en')
    expect(s.isEmpty).toBe(false)
    expect(s.platforms).toEqual(['FACEBOOK', 'INSTAGRAM', 'YOUTUBE_SHORTS'])
    expect(s.labels).toEqual(['Facebook', 'Instagram', 'YouTube Shorts'])
  })

  it('empty campaign → isEmpty + localized "not set", never a default platform', () => {
    const en = getCampaignPlatformSummary([], 'en')
    expect(en.isEmpty).toBe(true)
    expect(en.labels).toEqual([])
    expect(en.emptyLabel).toBe('Platforms not set')

    const ar = getCampaignPlatformSummary(null, 'ar')
    expect(ar.isEmpty).toBe(true)
    expect(ar.emptyLabel).toBe('لم يتم تحديد المنصات')
  })
})
