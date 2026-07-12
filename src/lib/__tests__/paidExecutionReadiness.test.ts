import { describe, expect, it } from 'vitest'
import {
  buildTrackedPaidDestinationUrl,
  evaluatePaidExecutionReadiness,
  normalizePaidCreativeUrl,
  normalizePaidDestinationUrl,
} from '@/lib/paidExecutionReadiness'

describe('paidExecutionReadiness', () => {
  it('accepts public HTTPS destinations and rejects placeholders or local URLs', () => {
    expect(normalizePaidDestinationUrl('https://nexus-grow.com/book')).toBe('https://nexus-grow.com/book')
    expect(normalizePaidDestinationUrl('http://nexus-grow.com/book')).toBeNull()
    expect(normalizePaidDestinationUrl('https://example.com/offer')).toBeNull()
    expect(normalizePaidDestinationUrl('https://localhost:3000/offer')).toBeNull()
    expect(normalizePaidDestinationUrl('https://192.168.1.2/offer')).toBeNull()
  })

  it('accepts public HTTPS creative assets and rejects placeholder or private hosts', () => {
    expect(normalizePaidCreativeUrl('https://res.cloudinary.com/demo/image/upload/sample.jpg')).toBe('https://res.cloudinary.com/demo/image/upload/sample.jpg')
    expect(normalizePaidCreativeUrl('https://example.com/ad.jpg')).toBeNull()
    expect(normalizePaidCreativeUrl('https://localhost:3000/ad.jpg')).toBeNull()
    expect(normalizePaidCreativeUrl('https://10.0.0.4/ad.jpg')).toBeNull()
  })

  it('adds missing UTM tracking without overwriting explicit values', () => {
    const tracked = buildTrackedPaidDestinationUrl({
      destinationUrl: 'https://nexus-grow.com/book?utm_source=partner',
      platform: 'META',
      campaignSlug: 'Clinic Launch 2026',
    })

    expect(tracked).not.toBeNull()
    const url = new URL(tracked!)
    expect(url.searchParams.get('utm_source')).toBe('partner')
    expect(url.searchParams.get('utm_medium')).toBe('paid_social')
    expect(url.searchParams.get('utm_campaign')).toBe('clinic_launch_2026')
  })

  it('blocks execution when budget, destination, media, or Meta page are missing', () => {
    const result = evaluatePaidExecutionReadiness({
      platform: 'META',
      budgetType: 'DAILY',
      dailyBudget: 0,
      lifetimeBudget: null,
      pageId: null,
      requireMetaPage: true,
      ads: [{ id: 'ad_1', name: 'Draft A', primaryText: 'Copy', headline: 'Headline' }],
    })

    expect(result.ready).toBe(false)
    expect(result.blockers.map(blocker => blocker.code)).toEqual(expect.arrayContaining([
      'BUDGET_REQUIRED',
      'META_PAGE_REQUIRED',
      'DESTINATION_URL_REQUIRED',
      'AD_MEDIA_REQUIRED',
    ]))
  })

  it('accepts a complete reviewed Meta image draft without claiming platform approval', () => {
    const result = evaluatePaidExecutionReadiness({
      platform: 'META',
      budgetType: 'DAILY',
      dailyBudget: 100,
      lifetimeBudget: null,
      pageId: 'page_1',
      requireMetaPage: true,
      ads: [{
        id: 'ad_1',
        name: 'Draft A',
        primaryText: 'Review this message',
        headline: 'Book a consultation',
        destinationUrl: 'https://nexus-grow.com/book?utm_source=meta',
        imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
        specsValidated: true,
        specsErrors: [],
        reviewStatus: 'PENDING',
      }],
    })

    expect(result).toMatchObject({ ready: true, budgetAmount: 100, adCount: 1 })
    expect(result.blockers).toEqual([])
  })

  it('blocks unsupported video-only drafts and disapproved ads', () => {
    const result = evaluatePaidExecutionReadiness({
      platform: 'META',
      budgetType: 'LIFETIME',
      dailyBudget: null,
      lifetimeBudget: 500,
      ads: [{
        name: 'Video draft',
        primaryText: 'Copy',
        headline: 'Headline',
        destinationUrl: 'https://nexus-grow.com/book',
        videoUrl: 'https://cdn.example-assets.test/video.mp4',
        reviewStatus: 'DISAPPROVED',
      }],
    })

    expect(result.blockers.map(blocker => blocker.code)).toEqual(expect.arrayContaining([
      'UNSUPPORTED_LIFETIME_BUDGET',
      'UNSUPPORTED_VIDEO_CREATIVE',
      'AD_DISAPPROVED',
    ]))
  })

  it('blocks a public image until the paid creative preflight has passed', () => {
    const result = evaluatePaidExecutionReadiness({
      platform: 'META',
      budgetType: 'DAILY',
      dailyBudget: 100,
      lifetimeBudget: null,
      ads: [{
        name: 'Unvalidated image',
        primaryText: 'Copy',
        headline: 'Headline',
        destinationUrl: 'https://nexus-grow.com/book',
        imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
        specsValidated: false,
      }],
    })

    expect(result.blockers.map(blocker => blocker.code)).toContain('AD_MEDIA_PREFLIGHT_REQUIRED')
  })
})
