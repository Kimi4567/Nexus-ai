import { describe, expect, it } from 'vitest'
import {
  buildCampaignExecutionTruth,
  buildWorkspaceExecutionTruth,
  type CampaignExecutionSnapshot,
} from '@/lib/executionTruth'

function snapshot(overrides: Partial<CampaignExecutionSnapshot> = {}): CampaignExecutionSnapshot {
  return {
    campaignId: 'campaign-1',
    campaignName: 'Launch',
    campaignStatus: 'ACTIVE',
    updatedAt: '2026-07-12T12:00:00.000Z',
    strategyApprovalState: 'approved',
    strategyBlockers: [],
    posts: { draft: 0, approved: 0, scheduled: 0, published: 0, failed: 0, publishedWithoutAnalytics: 0 },
    ...overrides,
  }
}

describe('execution truth', () => {
  it('never moves an unapproved strategy into content execution', () => {
    const result = buildCampaignExecutionTruth(snapshot({ strategyApprovalState: 'ready_for_review' }))
    expect(result.stage).toBe('STRATEGY_REVIEW')
    expect(result.nextAction).toMatchObject({ kind: 'REVIEW_STRATEGY', requiresApproval: true })
  })

  it('does not treat a paused campaign as live execution', () => {
    const result = buildCampaignExecutionTruth(snapshot({ campaignStatus: 'PAUSED' }))
    expect(result.stage).toBe('PAUSED')
    expect(result.nextAction?.kind).toBe('REVIEW_CAMPAIGN')
  })

  it('treats failed posts as the most urgent execution truth', () => {
    const result = buildCampaignExecutionTruth(snapshot({
      strategyApprovalState: 'blocked',
      posts: { draft: 2, approved: 0, scheduled: 0, published: 0, failed: 1, publishedWithoutAnalytics: 0 },
    }))
    expect(result.stage).toBe('NEEDS_ATTENTION')
    expect(result.nextAction).toMatchObject({ kind: 'RESOLVE_FAILURE', priority: 'critical' })
  })

  it('routes a live Brand Brain conflict to the source instead of strategy approval', () => {
    const result = buildCampaignExecutionTruth(snapshot({
      strategyApprovalState: 'blocked',
      strategyBlockers: ['BRAND_TRUTH_CONFLICT', 'brand_industry_too_broad_or_misaligned'],
      posts: { draft: 4, approved: 0, scheduled: 0, published: 0, failed: 0, publishedWithoutAnalytics: 0 },
    }))

    expect(result.stage).toBe('NEEDS_ATTENTION')
    expect(result.nextAction).toMatchObject({
      kind: 'FIX_BRAND_TRUTH',
      href: '/brand',
      priority: 'critical',
      requiresApproval: false,
    })
  })

  it('keeps drafts behind explicit content approval', () => {
    const result = buildCampaignExecutionTruth(snapshot({
      posts: { draft: 4, approved: 0, scheduled: 0, published: 0, failed: 0, publishedWithoutAnalytics: 0 },
    }))
    expect(result.stage).toBe('CONTENT_REVIEW')
    expect(result.nextAction).toMatchObject({ kind: 'REVIEW_CONTENT', safety: 'review_required' })
  })

  it('distinguishes approved from scheduled content', () => {
    const approved = buildCampaignExecutionTruth(snapshot({
      posts: { draft: 0, approved: 2, scheduled: 0, published: 0, failed: 0, publishedWithoutAnalytics: 0 },
    }))
    const scheduled = buildCampaignExecutionTruth(snapshot({
      posts: { draft: 0, approved: 0, scheduled: 2, published: 0, failed: 0, publishedWithoutAnalytics: 0 },
    }))
    expect(approved.nextAction?.kind).toBe('SCHEDULE_CONTENT')
    expect(scheduled.nextAction).toMatchObject({ kind: 'MONITOR_SCHEDULE', safety: 'monitor_only' })
  })

  it('routes approved posts with missing media to media review before scheduling', () => {
    const result = buildCampaignExecutionTruth(snapshot({
      posts: { draft: 0, approved: 3, approvedMissingMedia: 3, scheduled: 0, published: 0, failed: 0, publishedWithoutAnalytics: 0 },
    }))

    expect(result.stage).toBe('MEDIA_REVIEW')
    expect(result.nextAction).toMatchObject({ kind: 'REVIEW_MEDIA', href: '/campaigns/campaign-1/content-hub' })
    expect(result.nextAction?.reason.en).toContain('confirmed media before scheduling')
  })

  it('requires analytics evidence before claiming the learning loop is ready', () => {
    const result = buildCampaignExecutionTruth(snapshot({
      posts: { draft: 0, approved: 0, scheduled: 0, published: 3, failed: 0, publishedWithoutAnalytics: 2 },
    }))
    expect(result.stage).toBe('LEARNING')
    expect(result.nextAction?.kind).toBe('SYNC_ANALYTICS')
  })

  it('sorts failures before approvals and monitoring', () => {
    const result = buildWorkspaceExecutionTruth([
      snapshot({ campaignId: 'monitor', posts: { draft: 0, approved: 0, scheduled: 1, published: 0, failed: 0, publishedWithoutAnalytics: 0 } }),
      snapshot({ campaignId: 'approve', posts: { draft: 1, approved: 0, scheduled: 0, published: 0, failed: 0, publishedWithoutAnalytics: 0 } }),
      snapshot({ campaignId: 'failed', posts: { draft: 0, approved: 0, scheduled: 0, published: 0, failed: 1, publishedWithoutAnalytics: 0 } }),
    ], new Date('2026-07-12T13:00:00.000Z'))
    expect(result.queue.map((entry) => entry.campaignId)).toEqual(['failed', 'approve', 'monitor'])
    expect(result.summary).toMatchObject({ needsAttention: 1, awaitingApproval: 1, scheduledPosts: 1 })
  })
})
