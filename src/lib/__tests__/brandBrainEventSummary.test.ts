/**
 * Brand Brain Sprint PR2 — execution-event read model.
 *
 * Pins the honest summarisation of MarketingLearningEvent rows: real counts only, no
 * fake metrics, no full URLs exposed, "rate" is workflow-only, and unknown event types
 * are counted without breaking the summary.
 */

import { describe, it, expect } from 'vitest'
import {
  summarizeLearningEvents,
  learningEventsQuery,
  type LearningEventRecord,
} from '@/lib/brandBrainEventSummary'

const ev = (eventType: string, over: Partial<LearningEventRecord> = {}): LearningEventRecord => ({
  eventType,
  campaignId: 'c1',
  socialPostId: 'p1',
  source: 'EXECUTION_WORKFLOW',
  actor: 'USER',
  createdAt: '2026-06-13T10:00:00.000Z',
  metadata: { fromStatus: 'DRAFT', toStatus: 'APPROVED', publishMode: 'MANUAL' },
  ...over,
})

describe('summarizeLearningEvents — honest workflow signals', () => {
  it('1. empty event list returns a zeroed summary', () => {
    const s = summarizeLearningEvents([])
    expect(s).toMatchObject({
      totalEvents: 0, approvedPostsCount: 0, scheduledPostsCount: 0,
      manuallyPublishedPostsCount: 0, autoPublishedPostsCount: 0,
      unscheduledCount: 0, revertedToDraftCount: 0, failedCount: 0,
      lastEventAt: null, lastManualPublishAt: null, manualPublishWorkflowRate: null,
    })
    expect(s.platformsUsed).toEqual([])
    expect(s.recentEvents).toEqual([])
    expect(s.eventTypesCount).toEqual({})
  })

  it('2. POST_APPROVED increments approvedPostsCount', () => {
    expect(summarizeLearningEvents([ev('POST_APPROVED')]).approvedPostsCount).toBe(1)
  })

  it('3. POST_SCHEDULED increments scheduledPostsCount', () => {
    expect(summarizeLearningEvents([ev('POST_SCHEDULED')]).scheduledPostsCount).toBe(1)
  })

  it('4. POST_MANUALLY_PUBLISHED increments the manual count + sets lastManualPublishAt', () => {
    const s = summarizeLearningEvents([ev('POST_MANUALLY_PUBLISHED', { createdAt: '2026-06-13T12:00:00.000Z' })])
    expect(s.manuallyPublishedPostsCount).toBe(1)
    expect(s.autoPublishedPostsCount).toBe(0) // manual is never counted as auto
    expect(s.lastManualPublishAt).toBe('2026-06-13T12:00:00.000Z')
  })

  it('5. platform/domain aggregation uses safe metadata only', () => {
    const s = summarizeLearningEvents([
      ev('POST_MANUALLY_PUBLISHED', { metadata: { platform: 'META', platformUrlDomain: 'facebook.com', hasPlatformUrl: true } }),
      ev('POST_MANUALLY_PUBLISHED', { metadata: { platform: 'META', platformUrlDomain: 'facebook.com', hasPlatformUrl: true } }),
      ev('POST_SCHEDULED',          { metadata: { platform: 'TIKTOK' } }),
    ])
    expect(s.platformsUsed).toEqual(['META', 'TIKTOK', 'facebook.com'])
  })

  it('6. full / sensitive URLs are NEVER exposed (only the bare domain + a boolean)', () => {
    const s = summarizeLearningEvents([
      ev('POST_MANUALLY_PUBLISHED', { metadata: { hasPlatformUrl: true, platformUrlDomain: 'facebook.com', fromStatus: 'SCHEDULED', toStatus: 'PUBLISHED', publishMode: 'MANUAL' } }),
    ])
    const r = s.recentEvents[0]
    expect(r.platformUrlDomain).toBe('facebook.com')
    expect(r.hasPlatformUrl).toBe(true)
    // the recent-event shape has no field that could carry a full URL/path/query
    const blob = JSON.stringify(s)
    expect(blob).not.toMatch(/https?:\/\//)
    expect(blob).not.toContain('/posts/')
    expect(blob).not.toContain('ref=')
    expect(Object.keys(r)).not.toContain('platformUrl')
  })

  it('7. NO fake performance metric is ever produced', () => {
    const s = summarizeLearningEvents([ev('POST_MANUALLY_PUBLISHED'), ev('POST_SCHEDULED')])
    const keys = Object.keys(s)
    for (const banned of ['likes','comments','shares','impressions','reach','engagement','engagementRate','views','clicks','leads','score','successRate','performance']) {
      expect(keys).not.toContain(banned)
    }
  })

  it('8. manualPublishWorkflowRate is workflow-only (manual/scheduled), never a success metric', () => {
    // 1 manual publish out of 2 scheduled → 0.5 workflow rate
    const s = summarizeLearningEvents([ev('POST_SCHEDULED'), ev('POST_SCHEDULED'), ev('POST_MANUALLY_PUBLISHED')])
    expect(s.manualPublishWorkflowRate).toBe(0.5)
    // no schedules → rate is null (never fabricated as 0/100%)
    expect(summarizeLearningEvents([ev('POST_MANUALLY_PUBLISHED')]).manualPublishWorkflowRate).toBeNull()
    // the field name makes the workflow meaning explicit (not "successRate"/"performance")
    expect(Object.keys(s)).toContain('manualPublishWorkflowRate')
  })

  it('9. unknown event types are counted but never break the summary', () => {
    const s = summarizeLearningEvents([ev('POST_APPROVED'), ev('SOMETHING_NEW' as any), ev('LEGACY_X' as any)])
    expect(s.totalEvents).toBe(3)
    expect(s.approvedPostsCount).toBe(1)
    expect(s.eventTypesCount).toMatchObject({ POST_APPROVED: 1, SOMETHING_NEW: 1, LEGACY_X: 1 })
    // unknown types do not bleed into any known bucket
    expect(s.scheduledPostsCount).toBe(0)
    expect(s.manuallyPublishedPostsCount).toBe(0)
  })

  it('10. summary can be filtered by campaignId', () => {
    const events = [
      ev('POST_APPROVED',  { campaignId: 'A' }),
      ev('POST_SCHEDULED', { campaignId: 'A' }),
      ev('POST_APPROVED',  { campaignId: 'B' }),
    ]
    const a = summarizeLearningEvents(events, { campaignId: 'A' })
    expect(a.totalEvents).toBe(2)
    expect(a.approvedPostsCount).toBe(1)
    expect(a.scheduledPostsCount).toBe(1)
    const b = summarizeLearningEvents(events, { campaignId: 'B' })
    expect(b.totalEvents).toBe(1)
    expect(b.approvedPostsCount).toBe(1)
  })

  it('recentEvents are newest-first and respect the limit', () => {
    const events = [
      ev('POST_APPROVED',          { createdAt: '2026-06-13T09:00:00.000Z' }),
      ev('POST_SCHEDULED',         { createdAt: '2026-06-13T10:00:00.000Z' }),
      ev('POST_MANUALLY_PUBLISHED',{ createdAt: '2026-06-13T11:00:00.000Z' }),
    ]
    const s = summarizeLearningEvents(events, { recentLimit: 2 })
    expect(s.recentEvents.map(r => r.eventType)).toEqual(['POST_MANUALLY_PUBLISHED', 'POST_SCHEDULED'])
    expect(s.lastEventAt).toBe('2026-06-13T11:00:00.000Z')
  })
})

describe('learningEventsQuery — dependency-free Prisma where/orderBy builder', () => {
  it('builds a workspace query, optionally scoped to a campaign', () => {
    expect(learningEventsQuery('ws1')).toEqual({ where: { workspaceId: 'ws1' }, orderBy: { createdAt: 'desc' }, take: 500 })
    expect(learningEventsQuery('ws1', 'c9', 50)).toEqual({ where: { workspaceId: 'ws1', campaignId: 'c9' }, orderBy: { createdAt: 'desc' }, take: 50 })
  })
})
