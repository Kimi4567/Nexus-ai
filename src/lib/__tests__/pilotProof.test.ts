import { describe, expect, it } from 'vitest'
import { buildPerformanceEvidence } from '@/lib/performanceEvidence'
import { buildPilotProofOverview } from '@/lib/pilotProof'

const analytics = buildPerformanceEvidence({
  platform: 'LINKEDIN',
  platformPostId: 'provider-1',
  collectedAt: new Date('2026-07-15T00:00:00.000Z'),
  metrics: { likes: 30, comments: 5, shares: 2, impressions: 1_000, reach: 0 },
})

const learningEvidence = {
  schemaVersion: 1,
  source: 'platform_api',
  observationType: 'platform_local_association',
  causalClaim: false,
  platform: 'LINKEDIN',
  period: { start: '2026-07-01T00:00:00.000Z', end: '2026-07-15T00:00:00.000Z' },
  sample: { eligiblePosts: 5, aboveThresholdPosts: 3, evidencePostIds: ['post-1', 'post-2', 'post-3'], campaignIds: ['campaign-1'] },
  comparison: {
    metricDefinition: 'clicks_reactions_comments_shares_saves_over_impressions',
    baselineMethod: 'platform_local_median',
    baselineEngagementRate: 2,
    candidateThresholdEngagementRate: 3,
    thresholdRule: 'at_least_20_percent_above_platform_median',
  },
  confidence: { level: 'directional', rationale: 'Five eligible provider posts support a directional test candidate only.' },
  proposedChange: { field: 'winningHooks', values: ['A specific useful hook'], affectsExistingApprovedRevisions: false, affectsFutureStrategyAndContent: true },
  rollback: { strategy: 'remove_only_values_added_by_this_proposal', field: 'winningHooks', previousValue: [] },
}

describe('pilot proof', () => {
  it('requires publish, analytics, and accepted learning on the same campaign', () => {
    const result = buildPilotProofOverview([
      { id: 'post-1', campaignId: 'campaign-1', status: 'PUBLISHED', platformPostId: 'provider-1', publishedAt: '2026-07-10', analyticsData: analytics },
    ], [
      { status: 'accepted', trigger: 'post_performance', evidence: learningEvidence },
    ])

    expect(result).toMatchObject({ status: 'learning_applied', completedCampaigns: 1 })
  })

  it('never combines unrelated campaign evidence into a false completed pilot', () => {
    const result = buildPilotProofOverview([
      { id: 'post-1', campaignId: 'campaign-2', status: 'PUBLISHED', platformPostId: 'provider-1', publishedAt: '2026-07-10', analyticsData: analytics },
    ], [
      { status: 'accepted', trigger: 'post_performance', evidence: learningEvidence },
    ])

    expect(result.completedCampaigns).toBe(0)
    expect(result.status).toBe('analytics_ready')
  })

  it('does not count a manual publish record as provider proof', () => {
    const result = buildPilotProofOverview([
      { id: 'post-1', campaignId: 'campaign-1', status: 'PUBLISHED', platformPostId: 'provider-1', publishedAt: '2026-07-10', manuallyPublishedAt: '2026-07-10', analyticsData: analytics },
    ], [])

    expect(result.status).toBe('not_started')
    expect(result.providerPublishedPosts).toBe(0)
  })

  it('does not call a real but undersized analytics sample eligible', () => {
    const insufficientAnalytics = buildPerformanceEvidence({
      platform: 'LINKEDIN',
      platformPostId: 'provider-1',
      collectedAt: new Date('2026-07-15T00:00:00.000Z'),
      metrics: { likes: 2, comments: 0, shares: 0, impressions: 50, reach: 0 },
    })
    const result = buildPilotProofOverview([
      { id: 'post-1', campaignId: 'campaign-1', status: 'PUBLISHED', platformPostId: 'provider-1', publishedAt: '2026-07-10', analyticsData: insufficientAnalytics },
    ], [])

    expect(result.status).toBe('provider_published')
    expect(result.eligibleAnalyticsPosts).toBe(0)
  })
})
