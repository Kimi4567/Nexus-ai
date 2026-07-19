import { describe, expect, it } from 'vitest'
import {
  deriveCampaignOperatingState,
  hasStrategyEvidence,
} from '@/lib/campaignOperatingState'

const strategyCampaign = {
  status: 'DRAFT',
  aiOutput: {
    strategy: { keyMessage: 'Own the local market with trust.' },
    qualityGate: {
      schemaVersion: 1,
      status: 'passed',
      score: 100,
      blockers: [],
      warnings: [],
      checkedAt: '2026-01-01T00:00:00.000Z',
    },
    sentinelReview: { status: 'passed' },
  },
}

const immutableApproval = {
  approvedAt: '2026-01-01T08:00:00Z',
  approvedSnapshotId: 'copy-revision-1',
}

const finalMediaApproval = {
  imageUrl: 'https://cdn.example.com/final.jpg',
  mediaSource: 'GENERATE',
  generationStatus: 'DONE',
  mediaApprovalSnapshotId: 'media-revision-1',
}

const immutableSchedule = {
  ...immutableApproval,
  ...finalMediaApproval,
  scheduledAt: '2026-01-02T09:00:00Z',
  scheduledSnapshotId: 'schedule-revision-1',
}

describe('hasStrategyEvidence', () => {
  it('is conservative about empty or missing strategy evidence', () => {
    expect(hasStrategyEvidence(null)).toBe(false)
    expect(hasStrategyEvidence({})).toBe(false)
    expect(hasStrategyEvidence({ strategy: {} })).toBe(false)
  })

  it('accepts canonical strategy or direct strategy-like fields', () => {
    expect(hasStrategyEvidence({ strategy: { contentPillars: ['Trust'] } })).toBe(true)
    expect(hasStrategyEvidence({ keyMessage: 'Trusted local operator' })).toBe(true)
    expect(hasStrategyEvidence({ contentPillars: ['Proof', 'Offer'] })).toBe(true)
  })
})

describe('deriveCampaignOperatingState', () => {
  it('no strategy, no posts -> strategy_missing', () => {
    const state = deriveCampaignOperatingState({})
    expect(state.stage).toBe('strategy_missing')
    expect(state.truthFlags.hasStrategy).toBe(false)
    expect(state.truthFlags.hasContentPlan).toBe(false)
  })

  it('strategy exists with passed review, no posts -> content_plan_missing', () => {
    const state = deriveCampaignOperatingState({ campaign: strategyCampaign })
    expect(state.stage).toBe('content_plan_missing')
    expect(state.primaryAction.href).toBe('#build-content-plan')
  })

  it('strategy exists without passed review, no posts -> strategy_review_needed', () => {
    const state = deriveCampaignOperatingState({
      campaign: { status: 'DRAFT', aiOutput: { strategy: { keyMessage: 'Plan first' } } },
    })
    expect(state.stage).toBe('strategy_review_needed')
  })

  it('Sentinel alone cannot bypass a missing deterministic Brand Brain gate', () => {
    const state = deriveCampaignOperatingState({
      campaign: {
        status: 'DRAFT',
        aiOutput: {
          strategy: { keyMessage: 'Plan first' },
          sentinelReview: { status: 'passed' },
        },
      },
    })

    expect(state.stage).toBe('strategy_review_needed')
  })

  it('strategy exists + DRAFT posts -> content_review_needed', () => {
    const state = deriveCampaignOperatingState({
      campaign: strategyCampaign,
      posts: [{ status: 'DRAFT', generationStatus: 'DONE' }],
    })
    expect(state.stage).toBe('content_review_needed')
    expect(state.counts.draftPosts).toBe(1)
    expect(state.blockers).toContain('content_review')
  })

  it('mixed DRAFT and APPROVED posts still need content review', () => {
    const state = deriveCampaignOperatingState({
      campaign: strategyCampaign,
      posts: [
        { status: 'DRAFT', generationStatus: 'DONE' },
        { status: 'APPROVED', ...immutableApproval },
      ],
    })
    expect(state.stage).toBe('content_review_needed')
    expect(state.truthFlags.hasDraftContent).toBe(true)
    expect(state.truthFlags.hasApprovedContent).toBe(true)
    expect(state.blockers).toContain('content_review')
  })

  it('APPROVED posts, no scheduled -> content_approved_not_scheduled', () => {
    const state = deriveCampaignOperatingState({
      campaign: strategyCampaign,
      posts: [{ status: 'APPROVED', ...immutableApproval }],
    })
    expect(state.stage).toBe('content_approved_not_scheduled')
    expect(state.counts.approvedPosts).toBe(1)
    expect(state.truthFlags.hasScheduledContent).toBe(false)
    expect(state.stageLabelAr).toBe('النصوص معتمدة والوسائط غير مكتملة')
    expect(state.blockers).toContain('media_review')
  })

  it('APPROVED posts with confirmed media are ready for a separate scheduling decision', () => {
    const state = deriveCampaignOperatingState({
      campaign: strategyCampaign,
      posts: [{
        status: 'APPROVED',
        ...immutableApproval,
        ...finalMediaApproval,
      }],
    })
    expect(state.stage).toBe('content_approved_not_scheduled')
    expect(state.stageLabelAr).toBe('المحتوى معتمد وغير مجدول')
    expect(state.blockers).not.toContain('media_review')
  })

  it('content quality findings override an old copy approval and lock execution', () => {
    const state = deriveCampaignOperatingState({
      campaign: strategyCampaign,
      posts: [{
        status: 'APPROVED',
        ...immutableApproval,
        ...finalMediaApproval,
      }],
      contentQualityIssueCount: 4,
      contentQualityPostCount: 1,
    })

    expect(state.stage).toBe('content_review_needed')
    expect(state.stageLabel).toBe('Content quality recheck required')
    expect(state.stageHelper).toContain('4 findings affect 1 post')
    expect(state.truthFlags.hasContentQualityIssues).toBe(true)
    expect(state.truthFlags.hasReviewedContent).toBe(false)
    expect(state.blockers).toContain('content_quality')
  })

  it('SCHEDULED with scheduledAt + MANUAL -> scheduled_manual', () => {
    const state = deriveCampaignOperatingState({
      campaign: strategyCampaign,
      posts: [{ status: 'SCHEDULED', ...immutableSchedule, publishMode: 'MANUAL' }],
    })
    expect(state.stage).toBe('scheduled_manual')
    expect(state.counts.scheduledPosts).toBe(1)
    expect(state.counts.manualScheduledPosts).toBe(1)
    expect(state.truthFlags.autoPublishEnabled).toBe(false)
  })

  it('SCHEDULED with scheduledAt + AUTO -> scheduled_auto and auto-publish flag', () => {
    const state = deriveCampaignOperatingState({
      campaign: strategyCampaign,
      posts: [{
        status: 'SCHEDULED',
        ...immutableSchedule,
        publishMode: 'AUTO',
        autoPublishConsentAt: '2026-01-01T09:00:00Z',
      }],
    })
    expect(state.stage).toBe('scheduled_auto')
    expect(state.counts.autoScheduledPosts).toBe(1)
    expect(state.truthFlags.autoPublishEnabled).toBe(true)
  })

  it('AUTO without recorded consent remains a manual queue item', () => {
    const state = deriveCampaignOperatingState({
      campaign: strategyCampaign,
      posts: [{ status: 'SCHEDULED', ...immutableSchedule, publishMode: 'AUTO' }],
    })

    expect(state.stage).toBe('scheduled_manual')
    expect(state.counts.autoScheduledPosts).toBe(0)
    expect(state.counts.manualScheduledPosts).toBe(1)
    expect(state.truthFlags.autoPublishEnabled).toBe(false)
    expect(state.blockers).toContain('auto_publish_consent')
  })

  it('does not treat a progressed post without approval evidence as reviewed', () => {
    const state = deriveCampaignOperatingState({
      campaign: { ...strategyCampaign, platforms: ['INSTAGRAM', 'LINKEDIN'] },
      posts: [{
        status: 'SCHEDULED',
        scheduledAt: '2026-01-02T09:00:00Z',
        publishMode: 'MANUAL',
        platform: 'META',
        publishTarget: 'INSTAGRAM',
      }],
    })

    expect(state.stage).toBe('content_review_needed')
    expect(state.counts.unreviewedProgressedPosts).toBe(1)
    expect(state.truthFlags.hasReviewedContent).toBe(false)
    expect(state.blockers).toContain('approval_evidence')
  })

  it('blocks an ambiguous or substituted channel outside the campaign scope', () => {
    const state = deriveCampaignOperatingState({
      campaign: { ...strategyCampaign, platforms: ['INSTAGRAM', 'LINKEDIN'] },
      posts: [{
        status: 'SCHEDULED',
        ...immutableSchedule,
        publishMode: 'MANUAL',
        platform: 'META',
        publishTarget: 'META',
      }],
    })

    expect(state.stage).toBe('content_review_needed')
    expect(state.counts.outOfScopePosts).toBe(1)
    expect(state.truthFlags.hasChannelScopeMismatch).toBe(true)
    expect(state.blockers).toContain('channel_scope')
  })

  it('keeps provider META when the exact publish target is approved Instagram', () => {
    const state = deriveCampaignOperatingState({
      campaign: { ...strategyCampaign, platforms: ['INSTAGRAM', 'LINKEDIN'] },
      posts: [{
        status: 'SCHEDULED',
        ...immutableSchedule,
        publishMode: 'MANUAL',
        platform: 'META',
        publishTarget: 'INSTAGRAM',
      }],
    })

    expect(state.stage).toBe('scheduled_manual')
    expect(state.counts.outOfScopePosts).toBe(0)
    expect(state.truthFlags.hasReviewedContent).toBe(true)
  })

  it('SCHEDULED without immutable schedule evidence is not counted as scheduled', () => {
    const state = deriveCampaignOperatingState({
      campaign: strategyCampaign,
      posts: [{ status: 'SCHEDULED', ...immutableApproval, publishMode: 'AUTO' }],
    })
    expect(state.stage).toBe('content_review_needed')
    expect(state.counts.scheduledPosts).toBe(0)
    expect(state.truthFlags.hasScheduledContent).toBe(false)
    expect(state.truthFlags.autoPublishEnabled).toBe(false)
    expect(state.counts.invalidScheduledPosts).toBe(1)
    expect(state.blockers).toContain('schedule_evidence')
  })

  it('PUBLISHED with publishedAt but no analytics -> published_waiting_for_analytics', () => {
    const state = deriveCampaignOperatingState({
      campaign: strategyCampaign,
      posts: [{ status: 'PUBLISHED', ...immutableApproval, publishedAt: '2026-01-03T09:00:00Z' }],
    })
    expect(state.stage).toBe('published_waiting_for_analytics')
    expect(state.truthFlags.hasPublishedContent).toBe(true)
    expect(state.counts.manualPublishedPosts).toBe(1)
    expect(state.blockers).toContain('analytics')
  })

  it('PUBLISHED with analyticsData -> performance_ready', () => {
    const state = deriveCampaignOperatingState({
      campaign: strategyCampaign,
      posts: [{
        status: 'PUBLISHED',
        ...immutableApproval,
        publishedAt: '2026-01-03T09:00:00Z',
        platformPostId: 'fb_123',
        analyticsData: { reach: 120 },
      }],
    })
    expect(state.stage).toBe('performance_ready')
    expect(state.counts.apiPublishedPosts).toBe(1)
    expect(state.counts.analyticsReadyPosts).toBe(1)
  })

  it('pendingLearningCount > 0 -> learning_review_needed with explicit flag', () => {
    const state = deriveCampaignOperatingState({
      campaign: strategyCampaign,
      posts: [{
        status: 'PUBLISHED',
        ...immutableApproval,
        publishedAt: '2026-01-03T09:00:00Z',
        analyticsFetched: true,
      }],
      pendingLearningCount: 2,
    })
    expect(state.stage).toBe('learning_review_needed')
    expect(state.truthFlags.hasPendingLearning).toBe(true)
    expect(state.blockers).toContain('learning_review')
  })

  it('Campaign.autopilotEnabled true but no AUTO scheduled posts is workflow, not auto-publish', () => {
    const state = deriveCampaignOperatingState({
      campaign: { ...strategyCampaign, autopilotEnabled: true },
      posts: [{ status: 'APPROVED', ...immutableApproval }],
    })
    expect(state.stage).toBe('content_approved_not_scheduled')
    expect(state.truthFlags.workflowEnabled).toBe(true)
    expect(state.truthFlags.autoPublishEnabled).toBe(false)
  })

  it('Campaign.status ACTIVE alone does not produce published/live/auto-publish state', () => {
    const state = deriveCampaignOperatingState({
      campaign: { ...strategyCampaign, status: 'ACTIVE' },
    })
    expect(state.stage).toBe('content_plan_missing')
    expect(state.truthFlags.hasPublishedContent).toBe(false)
    expect(state.truthFlags.autoPublishEnabled).toBe(false)
  })

  it('Campaign.status ARCHIVED -> paused_or_archived when no stronger published/performance state exists', () => {
    const state = deriveCampaignOperatingState({
      campaign: { ...strategyCampaign, status: 'ARCHIVED' },
      posts: [{ status: 'APPROVED', ...immutableApproval }],
    })
    expect(state.stage).toBe('paused_or_archived')
  })

  it('published/performance state is stronger than archived state', () => {
    const state = deriveCampaignOperatingState({
      campaign: { ...strategyCampaign, status: 'ARCHIVED' },
      posts: [{ status: 'PUBLISHED', ...immutableApproval, publishedAt: '2026-01-03T09:00:00Z', analyticsFetched: true }],
    })
    expect(state.stage).toBe('performance_ready')
  })
})
