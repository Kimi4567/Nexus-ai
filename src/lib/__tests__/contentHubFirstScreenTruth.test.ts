import { describe, expect, it } from 'vitest'
import { deriveContentHubFirstScreenTruth } from '../contentHubFirstScreenTruth'
import { deriveStrategyFulfillmentSummary } from '../strategyFulfillment'

const fulfillment = (postCount: number, expectedPostCount = 7, strategyType: 'organic' | 'paid' | 'full' = 'organic') =>
  deriveStrategyFulfillmentSummary({
    locale: 'en',
    operatingSnapshotsLoaded: true,
    aiOutput: {
      strategyType,
      strategyOrder: { strategyType, durationDays: 45 },
      strategyDeliverables: {
        planningHorizonDays: 45,
        organicPostCount: expectedPostCount,
        requestedOrganicPostCount: expectedPostCount,
      },
    },
    posts: Array.from({ length: postCount }, (_, i) => ({ contentPlanIndex: i + 1, variantGroup: null })),
  })

describe('deriveContentHubFirstScreenTruth', () => {
  it('surfaces the strategy promise, draft state, media readiness, and next decision for draft content', () => {
    const cards = deriveContentHubFirstScreenTruth({
      locale: 'en',
      fulfillmentSummary: fulfillment(7),
      totalPosts: 7,
      draftCount: 7,
      approvedCount: 0,
      scheduledCount: 0,
      publishedCount: 0,
      manuallyPublishedCount: 0,
      totalImagePosts: 7,
      readyMediaCount: 0,
      ambiguousPreviewCount: 0,
      videoPostCount: 0,
      hasOrderMismatch: false,
      hasQualityMismatch: false,
    })

    expect(cards).toHaveLength(4)
    expect(cards[0].value).toBe('Matched: 7 / 7 posts')
    expect(cards[1].value).toBe('7 draft posts to review')
    expect(cards[2].value).toBe('0 / 7 media ready')
    expect(cards[3].value).toBe('Review drafts and resolve media')
  })

  it('blocks the next decision when Content Hub no longer matches the saved strategy order', () => {
    const cards = deriveContentHubFirstScreenTruth({
      locale: 'en',
      fulfillmentSummary: fulfillment(8, 7),
      totalPosts: 8,
      draftCount: 8,
      approvedCount: 0,
      scheduledCount: 0,
      publishedCount: 0,
      manuallyPublishedCount: 0,
      totalImagePosts: 8,
      readyMediaCount: 8,
      ambiguousPreviewCount: 0,
      videoPostCount: 0,
      hasOrderMismatch: true,
      hasQualityMismatch: false,
    })

    expect(cards[0].tone).toBe('danger')
    expect(cards[3]).toMatchObject({
      value: 'Repair plan match first',
      tone: 'danger',
    })
    expect(cards[3].helper).toContain('Do not approve or schedule')
  })

  it('keeps paid-only strategy honest when no organic Content Hub posts are expected', () => {
    const cards = deriveContentHubFirstScreenTruth({
      locale: 'en',
      fulfillmentSummary: fulfillment(0, 0, 'paid'),
      totalPosts: 0,
      draftCount: 0,
      approvedCount: 0,
      scheduledCount: 0,
      publishedCount: 0,
      manuallyPublishedCount: 0,
      totalImagePosts: 0,
      readyMediaCount: 0,
      ambiguousPreviewCount: 0,
      videoPostCount: 0,
      hasOrderMismatch: false,
      hasQualityMismatch: false,
    })

    expect(cards[0].value).toBe('Matched: no organic posts expected')
    expect(cards[1].value).toBe('No Content Hub drafts yet')
    expect(cards[2].value).toBe('No media slots required')
    expect(cards[3].value).toBe('Review the paid planning brief')
    expect(cards[3].helper).toContain('No organic Content Hub posts are required')
  })

  it('separates user-confirmed manual publish from remaining scheduled posts', () => {
    const cards = deriveContentHubFirstScreenTruth({
      locale: 'en',
      fulfillmentSummary: fulfillment(8, 8),
      totalPosts: 8,
      draftCount: 0,
      approvedCount: 0,
      scheduledCount: 7,
      publishedCount: 1,
      manuallyPublishedCount: 1,
      totalImagePosts: 8,
      readyMediaCount: 1,
      ambiguousPreviewCount: 0,
      videoPostCount: 0,
      hasOrderMismatch: false,
      hasQualityMismatch: false,
    })

    expect(cards[1].value).toBe('1 manually published post · 7 scheduled posts not published')
    expect(cards[1].helper).toContain('Manual publish is a user record only')
    expect(cards[3].value).toBe('Review publish readiness')
  })

  it('does not count ambiguous media previews as ready', () => {
    const cards = deriveContentHubFirstScreenTruth({
      locale: 'en',
      fulfillmentSummary: fulfillment(7),
      totalPosts: 7,
      draftCount: 7,
      approvedCount: 0,
      scheduledCount: 0,
      publishedCount: 0,
      manuallyPublishedCount: 0,
      totalImagePosts: 7,
      readyMediaCount: 1,
      ambiguousPreviewCount: 1,
      videoPostCount: 0,
      hasOrderMismatch: false,
      hasQualityMismatch: false,
    })

    expect(cards[2].value).toBe('1 / 7 media ready')
    expect(cards[2].helper).toContain('not counted ready')
    expect(cards[2].tone).toBe('warning')
  })

  it('counts ready image and video media against all required post media slots', () => {
    const cards = deriveContentHubFirstScreenTruth({
      locale: 'en',
      fulfillmentSummary: fulfillment(10, 10),
      totalPosts: 10,
      draftCount: 10,
      approvedCount: 0,
      scheduledCount: 0,
      publishedCount: 0,
      manuallyPublishedCount: 0,
      totalImagePosts: 5,
      readyMediaCount: 6,
      ambiguousPreviewCount: 0,
      videoPostCount: 5,
      hasOrderMismatch: false,
      hasQualityMismatch: false,
    })

    expect(cards[2].value).toBe('6 / 10 media ready')
    expect(cards[2].helper).toContain('4 slots')
  })

  it('uses Arabic word-based ratios so RTL rendering cannot flip media counts', () => {
    const cards = deriveContentHubFirstScreenTruth({
      locale: 'ar',
      fulfillmentSummary: deriveStrategyFulfillmentSummary({
        locale: 'ar',
        operatingSnapshotsLoaded: true,
        aiOutput: {
          strategyType: 'organic',
          strategyOrder: { strategyType: 'organic', durationDays: 45 },
          strategyDeliverables: { planningHorizonDays: 45, organicPostCount: 7, requestedOrganicPostCount: 7 },
        },
        posts: Array.from({ length: 7 }, (_, i) => ({ contentPlanIndex: i + 1, variantGroup: null })),
      }),
      totalPosts: 7,
      draftCount: 7,
      approvedCount: 0,
      scheduledCount: 0,
      publishedCount: 0,
      manuallyPublishedCount: 0,
      totalImagePosts: 7,
      readyMediaCount: 0,
      ambiguousPreviewCount: 0,
      videoPostCount: 0,
      hasOrderMismatch: false,
      hasQualityMismatch: false,
    })

    expect(cards[0].value).toContain('7 من 7')
    expect(cards[0].value).not.toContain('7 / 7')
    expect(cards[2].value).toBe('0 من 7 وسائط جاهزة')
    expect(cards[2].value).not.toContain('0 / 7')
  })

  it('quarantines semantically drifting posts even when their count matches the order', () => {
    const cards = deriveContentHubFirstScreenTruth({
      locale: 'en',
      fulfillmentSummary: fulfillment(7),
      totalPosts: 7,
      draftCount: 7,
      approvedCount: 0,
      scheduledCount: 0,
      publishedCount: 0,
      manuallyPublishedCount: 0,
      totalImagePosts: 7,
      readyMediaCount: 7,
      ambiguousPreviewCount: 0,
      videoPostCount: 0,
      hasOrderMismatch: false,
      hasQualityMismatch: true,
    })

    expect(cards[3]).toMatchObject({
      value: 'Repair content alignment first',
      tone: 'danger',
    })
    expect(cards[3].helper).toContain('Brand Brain and approved strategy')
  })
})
