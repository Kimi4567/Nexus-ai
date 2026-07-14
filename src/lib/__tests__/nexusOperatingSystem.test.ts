import { describe, expect, it } from 'vitest'
import { deriveNexusOperatingSystem } from '@/lib/nexusOperatingSystem'

const reviewedStrategyCampaign = {
  status: 'DRAFT',
  aiOutput: {
    strategy: { keyMessage: 'Make specialty coffee easier to choose.' },
    qualityGate: {
      schemaVersion: 1,
      status: 'passed',
      score: 100,
      blockers: [],
      warnings: [],
      checkedAt: '2026-07-14T00:00:00.000Z',
    },
    sentinelReview: { status: 'passed' },
  },
}

describe('deriveNexusOperatingSystem', () => {
  it('treats a strategy-only campaign as ready for content planning', () => {
    const os = deriveNexusOperatingSystem({ campaign: reviewedStrategyCampaign })

    expect(os.stage).toBe('content_plan_missing')
    expect(os.surfaces.strategy.status).toBe('ready_for_next_step')
    expect(os.surfaces.strategy.primaryAction.id).toBe('build_content_plan')
    expect(os.calendar.source).toBe('none')
    expect(os.nextBestAction.id).toBe('build_content_plan')
  })

  it('uses SocialPosts as calendar truth when scheduled posts exist without legacy calendar fields', () => {
    const os = deriveNexusOperatingSystem({
      campaign: {
        status: 'DRAFT',
        aiOutput: {
          strategy: { overview: 'Coffee campaign' },
          contentCalendar: [],
          calendarItems: [],
        },
      },
      posts: [
        { status: 'SCHEDULED', scheduledAt: '2026-07-03T15:00:00Z', publishMode: 'MANUAL' },
        { status: 'SCHEDULED', scheduledAt: '2026-07-06T17:00:00Z', publishMode: 'MANUAL' },
      ],
    })

    expect(os.truth.hasStrategyCalendarPlan).toBe(false)
    expect(os.truth.hasScheduledPostCalendar).toBe(true)
    expect(os.calendar.source).toBe('social_posts')
    expect(os.calendar.scheduledPostCount).toBe(2)
    expect(os.surfaces.calendar.status).toBe('truth_safe')
    expect(os.surfaces.calendar.helper.en).toContain('scheduled and published SocialPosts')
  })

  it('does not call progressed scheduled/manual content ready for content planning', () => {
    const os = deriveNexusOperatingSystem({
      campaign: {
        status: 'DRAFT',
        aiOutput: {
          strategy: { overview: 'Coffee campaign' },
          calendarItems: [],
        },
      },
      posts: [
        {
          status: 'PUBLISHED',
          publishedAt: '2026-06-29T07:28:01Z',
          manuallyPublishedAt: '2026-06-29T07:28:01Z',
          publishMode: 'MANUAL',
        },
        { status: 'SCHEDULED', scheduledAt: '2026-07-03T15:00:00Z', publishMode: 'MANUAL' },
      ],
    })

    expect(os.stage).toBe('published_waiting_for_analytics')
    expect(os.surfaces.strategy.title.en).toBe('Strategy is reference material')
    expect(os.surfaces.strategy.helper.en).toContain('Content already exists')
    expect(os.surfaces.strategy.primaryAction.id).toBe('review_content_hub')
    expect(os.nextBestAction.id).toBe('review_performance')
  })

  it('keeps Autopilot separate from manual scheduled content when weeklyExecutionPlan is missing', () => {
    const os = deriveNexusOperatingSystem({
      campaign: {
        status: 'DRAFT',
        autopilotEnabled: false,
        aiOutput: {
          strategy: { overview: 'Coffee campaign' },
        },
      },
      posts: [
        {
          status: 'PUBLISHED',
          publishedAt: '2026-06-29T07:28:01Z',
          manuallyPublishedAt: '2026-06-29T07:28:01Z',
          publishMode: 'MANUAL',
        },
        { status: 'SCHEDULED', scheduledAt: '2026-07-03T15:00:00Z', publishMode: 'MANUAL' },
      ],
    })

    expect(os.truth.hasWeeklyExecutionPlan).toBe(false)
    expect(os.surfaces.autopilot.status).toBe('truth_safe')
    expect(os.surfaces.autopilot.title.en).toBe('Autopilot not enabled')
    expect(os.surfaces.autopilot.helper.en).toContain('Do not ask the user to regenerate strategy')
    expect(os.surfaces.autopilot.blockers).not.toContain('weekly_execution_plan')
  })

  it('counts media readiness separately from visible but unconfirmed previews', () => {
    const os = deriveNexusOperatingSystem({
      campaign: reviewedStrategyCampaign,
      posts: [
        { status: 'SCHEDULED', scheduledAt: '2026-07-03T15:00:00Z', imageUrl: 'https://cdn.example/ready.png', mediaSource: 'GENERATE', generationStatus: 'DONE' },
        { status: 'SCHEDULED', scheduledAt: '2026-07-04T15:00:00Z', imageUrl: 'https://cdn.example/pending.png', mediaSource: 'GENERATE', generationStatus: 'PENDING' },
        { status: 'SCHEDULED', scheduledAt: '2026-07-05T15:00:00Z', imageUrl: null, mediaSource: 'GENERATE', generationStatus: 'PENDING' },
      ],
    })

    expect(os.counts.mediaReadyPosts).toBe(1)
    expect(os.counts.ambiguousMediaPreviewPosts).toBe(1)
    expect(os.counts.mediaNeedsAttentionPosts).toBe(2)
    expect(os.surfaces.creative.status).toBe('needs_review')
    expect(os.surfaces.creative.blockers).toContain('media_decision')
  })

  it('locks platform publishing without connected account while preserving scheduled/manual truth', () => {
    const os = deriveNexusOperatingSystem({
      campaign: reviewedStrategyCampaign,
      hasConnectedPublishingAccount: false,
      posts: [
        { status: 'SCHEDULED', scheduledAt: '2026-07-03T15:00:00Z', publishMode: 'MANUAL' },
        { status: 'PUBLISHED', publishedAt: '2026-06-29T07:28:01Z', manuallyPublishedAt: '2026-06-29T07:28:01Z', publishMode: 'MANUAL' },
      ],
    })

    expect(os.counts.scheduledPosts).toBe(1)
    expect(os.counts.manualPublishedPosts).toBe(1)
    expect(os.surfaces.publish.status).toBe('locked')
    expect(os.surfaces.publish.helper.en).toContain('API publishing needs a connected account')
  })

  it('allows performance learning only when analyticsData exists', () => {
    const waiting = deriveNexusOperatingSystem({
      campaign: reviewedStrategyCampaign,
      posts: [{ status: 'PUBLISHED', publishedAt: '2026-06-29T07:28:01Z' }],
    })
    expect(waiting.truth.performanceLearningAllowed).toBe(false)
    expect(waiting.surfaces.performance.status).toBe('waiting')
    expect(waiting.surfaces.performance.helper.en).toContain('before analyticsData exists')

    const ready = deriveNexusOperatingSystem({
      campaign: reviewedStrategyCampaign,
      posts: [{ status: 'PUBLISHED', publishedAt: '2026-06-29T07:28:01Z', analyticsData: { reach: 120 } }],
    })
    expect(ready.truth.performanceLearningAllowed).toBe(true)
    expect(ready.surfaces.performance.status).toBe('truth_safe')
  })

  it('flags completed visuals without an asset role as ambiguous instead of concept visuals', () => {
    const os = deriveNexusOperatingSystem({
      campaign: reviewedStrategyCampaign,
      generatedVisuals: [
        { status: 'COMPLETED', imageUrl: 'https://cdn.example/old-gallery.png', metadata: { assetRole: 'campaign_concept_visual' } },
        { status: 'COMPLETED', imageUrl: 'https://cdn.example/post-background.png' },
        { status: 'COMPLETED', imageUrl: 'https://cdn.example/post-background-2.png', assetRole: 'post_background' },
      ],
    })

    expect(os.visuals.totalCompletedVisuals).toBe(3)
    expect(os.visuals.conceptVisuals).toBe(1)
    expect(os.visuals.postBackgroundVisuals).toBe(1)
    expect(os.visuals.ambiguousCompletedVisuals).toBe(1)
  })

  it('documents product laws every campaign room surface must obey', () => {
    const os = deriveNexusOperatingSystem({})

    expect(os.productLaws).toContain('Scheduled does not mean published.')
    expect(os.productLaws).toContain('Performance learning requires real analyticsData.')
    expect(os.productLaws).toContain('Strategy is reference material once SocialPosts exist.')
  })
})
