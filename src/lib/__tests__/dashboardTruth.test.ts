import { describe, expect, it } from 'vitest'
import {
  getDashboardCampaignStatusCopy,
  getDashboardExecutionCopy,
  getDashboardLearningCopy,
  summarizeDashboardPosts,
} from '@/lib/dashboardTruth'

describe('dashboardTruth mixed-state labels', () => {
  it('summarizes one manual publish and seven scheduled posts without implying platform publish', () => {
    const summary = summarizeDashboardPosts([
      { status: 'PUBLISHED', publishMode: 'MANUAL', manuallyPublishedAt: '2026-06-29T10:00:00Z' },
      ...Array.from({ length: 7 }, () => ({ status: 'SCHEDULED', publishMode: 'MANUAL' })),
    ])

    expect(summary.manuallyPublished).toBe(1)
    expect(summary.platformPublished).toBe(0)
    expect(summary.scheduled).toBe(7)

    const copy = getDashboardCampaignStatusCopy(summary, 'DRAFT')
    expect(copy.label).toBe('1 manually published · 7 scheduled')
    expect(copy.labelAr).toBe('1 منشور تم تأكيد نشره يدويًا · 7 مجدولة')
    expect(copy.label).not.toMatch(/\blive\b|platform/i)
  })

  it('keeps manual publish with a user-provided live URL classified as manual', () => {
    const summary = summarizeDashboardPosts([
      {
        status: 'PUBLISHED',
        publishMode: 'MANUAL',
        manuallyPublishedAt: '2026-06-29T10:00:00Z',
        platformUrl: 'https://example.com/manual-post',
      },
    ])

    expect(summary.published).toBe(1)
    expect(summary.manuallyPublished).toBe(1)
    expect(summary.platformPublished).toBe(0)

    const copy = getDashboardCampaignStatusCopy(summary, 'DRAFT')
    expect(copy.label).toBe('1 manually published')
    expect(copy.label).not.toMatch(/platform published|API publish/i)
  })

  it('classifies platform API publish from AUTO mode or platformPostId, not live URL alone', () => {
    const autoSummary = summarizeDashboardPosts([
      { status: 'PUBLISHED', publishMode: 'AUTO', platformPostId: 'abc123', platformUrl: null },
    ])

    expect(autoSummary.platformPublished).toBe(1)
    expect(autoSummary.manuallyPublished).toBe(0)

    const legacyWithPlatformPostId = summarizeDashboardPosts([
      { status: 'PUBLISHED', publishMode: null, platformPostId: 'abc123' },
    ])

    expect(legacyWithPlatformPostId.platformPublished).toBe(1)
    expect(legacyWithPlatformPostId.manuallyPublished).toBe(0)

    const legacyWithLiveUrlOnly = summarizeDashboardPosts([
      { status: 'PUBLISHED', publishMode: null, platformUrl: 'https://example.com/manual-post' },
    ])

    expect(legacyWithLiveUrlOnly.manuallyPublished).toBe(1)
    expect(legacyWithLiveUrlOnly.platformPublished).toBe(0)
  })

  it('uses the same manual/scheduled truth for the operating brief execution surface', () => {
    const copy = getDashboardExecutionCopy({
      manuallyPublished: 1,
      published: 1,
      scheduled: 7,
    })

    expect(copy.label).toBe('1 manually published · 7 scheduled')
    expect(copy.label).not.toBe('1 published · 7 scheduled')
  })

  it('keeps learning pending until real analytics exists', () => {
    const pending = getDashboardLearningCopy({ manuallyPublished: 1, published: 1, scheduled: 7 })
    expect(pending.value).toBe('Analytics pending')
    expect(pending.valueAr).toBe('التحليلات قيد الانتظار')
    expect(pending.loopComplete).toBe(false)

    const ready = getDashboardLearningCopy({ manuallyPublished: 1, published: 1, analyticsReady: 1 })
    expect(ready.value).toBe('Analytics available')
    expect(ready.loopComplete).toBe(true)
  })

  it('falls back to Draft only when no post lifecycle summary exists', () => {
    const copy = getDashboardCampaignStatusCopy(null, 'DRAFT')
    expect(copy.label).toBe('Draft')
    expect(copy.labelAr).toBe('مسودة')
  })
})
