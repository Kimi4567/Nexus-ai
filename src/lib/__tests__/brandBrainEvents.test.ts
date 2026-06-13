/**
 * Brand Brain Sprint PR1 — execution-workflow event capture.
 *
 * Pins the honest mapping from a lifecycle transition to a learning event + its small,
 * safe metadata. Guarantees: events only for real transitions (no duplicates, no
 * invalid transitions), a manual publish is never recorded as automatic, and NO
 * performance metric is ever stored.
 */

import { describe, it, expect } from 'vitest'
import {
  executionEventType,
  buildLearningEvent,
  buildLearningEvents,
} from '@/lib/brandBrainEvents'

describe('executionEventType — honest transition → event', () => {
  it('1. DRAFT → APPROVED is POST_APPROVED', () => {
    expect(executionEventType('DRAFT', 'APPROVED')).toBe('POST_APPROVED')
  })

  it('2. APPROVED → SCHEDULED is POST_SCHEDULED', () => {
    expect(executionEventType('APPROVED', 'SCHEDULED')).toBe('POST_SCHEDULED')
  })

  it('3. SCHEDULED → PUBLISHED (manual) is POST_MANUALLY_PUBLISHED', () => {
    expect(executionEventType('SCHEDULED', 'PUBLISHED', 'MANUAL')).toBe('POST_MANUALLY_PUBLISHED')
  })

  it('unschedule + revert + failed map to their explicit events', () => {
    expect(executionEventType('SCHEDULED', 'APPROVED')).toBe('POST_UNSCHEDULED')
    expect(executionEventType('APPROVED', 'DRAFT')).toBe('POST_REVERTED_TO_DRAFT')
    expect(executionEventType('SCHEDULED', 'DRAFT')).toBe('POST_REVERTED_TO_DRAFT')
    expect(executionEventType('SCHEDULED', 'FAILED')).toBe('POST_FAILED')
  })

  it('6. invalid / no-op transitions produce NO event', () => {
    expect(executionEventType('DRAFT', 'PUBLISHED')).toBeNull()    // honesty guard: never DRAFT → PUBLISHED
    expect(executionEventType('DRAFT', 'SCHEDULED')).toBeNull()    // must be approved first
    expect(executionEventType('APPROVED', 'APPROVED')).toBeNull()  // no-op (re-approve)
    expect(executionEventType('DRAFT', 'DRAFT')).toBeNull()
    expect(executionEventType('PUBLISHED', 'PUBLISHED')).toBeNull()
  })
})

describe('buildLearningEvent — small, safe, honest rows', () => {
  it('4. metadata carries correct fromStatus/toStatus/publishMode', () => {
    const e = buildLearningEvent({
      workspaceId: 'w1', campaignId: 'c1', socialPostId: 'p1',
      from: 'DRAFT', to: 'APPROVED', actor: 'USER', platform: 'META',
    })
    expect(e).not.toBeNull()
    expect(e!.eventType).toBe('POST_APPROVED')
    expect(e!.source).toBe('EXECUTION_WORKFLOW')
    expect(e!.actor).toBe('USER')
    expect(e!.metadata).toMatchObject({ fromStatus: 'DRAFT', toStatus: 'APPROVED', publishMode: 'MANUAL', platform: 'META' })
  })

  it('7. a manual publish event never claims automatic publishing', () => {
    const e = buildLearningEvent({
      workspaceId: 'w1', campaignId: 'c1', socialPostId: 'p1',
      from: 'SCHEDULED', to: 'PUBLISHED', publishMode: 'MANUAL',
      platformUrl: 'https://facebook.com/p/123?utm=x', manuallyPublishedAt: '2026-06-13T10:00:00.000Z',
    })
    expect(e!.eventType).toBe('POST_MANUALLY_PUBLISHED')
    expect(e!.eventType).not.toBe('POST_AUTO_PUBLISHED')
    expect(e!.metadata.publishMode).toBe('MANUAL')
    // URL is reduced to a boolean + bare domain — never the full sensitive URL
    expect(e!.metadata.hasPlatformUrl).toBe(true)
    expect(e!.metadata.platformUrlDomain).toBe('facebook.com')
    expect(JSON.stringify(e!.metadata)).not.toContain('utm=x')
    expect(JSON.stringify(e!.metadata)).not.toContain('/p/123')
  })

  it('10. an AUTO publish maps to POST_AUTO_PUBLISHED only when truly AUTO (cron safety untouched)', () => {
    expect(buildLearningEvent({ workspaceId: 'w', from: 'SCHEDULED', to: 'PUBLISHED', publishMode: 'AUTO' })!.eventType).toBe('POST_AUTO_PUBLISHED')
    // MANUAL must never become AUTO
    expect(buildLearningEvent({ workspaceId: 'w', from: 'SCHEDULED', to: 'PUBLISHED', publishMode: 'MANUAL' })!.eventType).toBe('POST_MANUALLY_PUBLISHED')
  })

  it('6b. an invalid transition builds no event row', () => {
    expect(buildLearningEvent({ workspaceId: 'w', from: 'DRAFT', to: 'PUBLISHED' })).toBeNull()
  })

  it('9. NO fake performance metric is ever stored', () => {
    const e = buildLearningEvent({
      workspaceId: 'w', from: 'SCHEDULED', to: 'PUBLISHED', publishMode: 'MANUAL',
      platformUrl: 'https://x.co/y', manuallyPublishedAt: new Date(), publishedAt: new Date(),
    })
    const keys = Object.keys(e!.metadata)
    const banned = ['likes', 'comments', 'shares', 'impressions', 'reach', 'engagement', 'engagementRate', 'views', 'clicks', 'score', 'performance']
    for (const b of banned) expect(keys).not.toContain(b)
  })
})

describe('buildLearningEvents — batch, dedup-by-real-transition', () => {
  it('5. an empty / no-op batch (e.g. double approval) creates NO events', () => {
    // Re-approving already-approved posts yields no actual transitions → no events.
    expect(buildLearningEvents([])).toHaveLength(0)
    expect(buildLearningEvents([
      { workspaceId: 'w', from: 'APPROVED', to: 'APPROVED' },   // no-op
      { workspaceId: 'w', from: 'PUBLISHED', to: 'PUBLISHED' }, // no-op
    ])).toHaveLength(0)
  })

  it('maps a real mixed batch to exactly one event per valid transition', () => {
    const events = buildLearningEvents([
      { workspaceId: 'w', socialPostId: 'a', from: 'DRAFT', to: 'APPROVED' },
      { workspaceId: 'w', socialPostId: 'b', from: 'APPROVED', to: 'SCHEDULED' },
      { workspaceId: 'w', socialPostId: 'c', from: 'DRAFT', to: 'PUBLISHED' }, // invalid → dropped
    ])
    expect(events.map(e => e.eventType)).toEqual(['POST_APPROVED', 'POST_SCHEDULED'])
  })
})
