import { describe, expect, it } from 'vitest'
import {
  buildPerformanceEvidence,
  hasRealPerformanceAnalytics,
  numberFromPerformanceMetric,
  planPerformanceLearning,
  readPerformanceEvidence,
  summarizePerformanceEvidence,
} from '@/lib/performanceEvidence'

const now = new Date('2026-07-12T12:00:00.000Z')

function evidence(platform: 'META' | 'LINKEDIN', engagementCount: number, denominator = 1000) {
  return buildPerformanceEvidence({
    platform,
    platformPostId: `${platform}-${engagementCount}`,
    collectedAt: now,
    metrics: platform === 'META'
      ? { likes: 0, comments: 0, shares: 0, impressions: denominator, reach: denominator, engagedUsers: engagementCount }
      : { likes: engagementCount, comments: 0, shares: 0, clicks: 0, impressions: denominator, reach: 0 },
  })
}

describe('performance evidence contract', () => {
  it('stores provenance and computes rates server-side', () => {
    const result = evidence('META', 25, 1000)
    expect(result).toMatchObject({
      schemaVersion: 1,
      source: 'platform_api',
      platform: 'META',
      engagementCount: 25,
      engagementRate: 2.5,
      quality: 'eligible',
    })
  })

  it('accepts YouTube view-based evidence without inventing unavailable metrics', () => {
    const result = buildPerformanceEvidence({
      platform: 'YOUTUBE',
      platformPostId: 'video-1',
      collectedAt: now,
      metrics: { likes: 25, comments: 5, shares: 0, impressions: 1_000, reach: 0 },
    })
    expect(readPerformanceEvidence(result)).toMatchObject({
      platform: 'YOUTUBE',
      denominator: 1_000,
      engagementCount: 30,
      engagementRate: 3,
    })
  })

  it('rejects empty and workflow-only legacy payloads', () => {
    expect(hasRealPerformanceAnalytics(null)).toBe(false)
    expect(hasRealPerformanceAnalytics(undefined)).toBe(false)
    expect(hasRealPerformanceAnalytics({})).toBe(false)
    expect(hasRealPerformanceAnalytics({ fetchedAt: '2026-07-10', source: 'manual_publish' })).toBe(false)
  })

  it('accepts measured zero values and finite platform strings', () => {
    expect(hasRealPerformanceAnalytics({ impressions: 0 })).toBe(true)
    expect(hasRealPerformanceAnalytics({ engagementRate: 0 })).toBe(true)
    expect(numberFromPerformanceMetric('0')).toBe(0)
    expect(hasRealPerformanceAnalytics({ clicks: '12' })).toBe(true)
  })

  it('rejects invalid or unrelated legacy metric values', () => {
    expect(hasRealPerformanceAnalytics({ likes: 'unknown' })).toBe(false)
    expect(hasRealPerformanceAnalytics({ impressions: Number.NaN })).toBe(false)
    expect(hasRealPerformanceAnalytics({ status: 'PUBLISHED' })).toBe(false)
  })

  it('marks tiny samples as insufficient and rejects legacy unproven blobs', () => {
    expect(evidence('META', 2, 50).quality).toBe('insufficient_sample')
    expect(readPerformanceEvidence({ engagementRate: 99, impressions: 1 })).toBeNull()
  })

  it('requires five comparable posts and three above-baseline posts on the same platform', () => {
    const posts = [10, 10, 10, 20, 20, 20].map((count, index) => ({
      id: `m${index}`,
      campaignId: index < 3 ? 'campaign-1' : 'campaign-2',
      caption: index < 3 ? `Baseline message number ${index}` : `Proven opening candidate number ${index}`,
      platform: 'META',
      analyticsData: evidence('META', count),
    }))

    const [plan] = planPerformanceLearning(posts)
    expect(plan).toMatchObject({
      platform: 'META',
      eligiblePostCount: 6,
      baselineEngagementRate: 1.5,
      thresholdEngagementRate: 1.8,
      winningPostCount: 3,
      periodStart: now.toISOString(),
      periodEnd: now.toISOString(),
      confidence: { level: 'directional' },
      causalClaim: false,
    })
    expect(plan.evidencePostIds).toEqual(['m3', 'm4', 'm5'])
    expect(plan.evidenceCampaignIds).toEqual(['campaign-2'])
    expect(plan.metricDefinition).toBe('engaged_users_over_reach_or_impressions')
    expect(plan.candidateHooks).toHaveLength(3)
  })

  it('never mixes Meta and LinkedIn samples to manufacture significance', () => {
    const posts = [
      ...[10, 20, 20].map((count, index) => ({
        id: `m${index}`, caption: `Meta candidate message ${index}`, platform: 'META', analyticsData: evidence('META', count),
      })),
      ...[10, 20, 20].map((count, index) => ({
        id: `l${index}`, caption: `LinkedIn candidate message ${index}`, platform: 'LINKEDIN', analyticsData: evidence('LINKEDIN', count),
      })),
    ]
    expect(planPerformanceLearning(posts)).toEqual([])
  })

  it('keeps insufficient and legacy records out of KPI totals', () => {
    const summary = summarizePerformanceEvidence([
      { platform: 'META', analyticsData: evidence('META', 40, 400) },
      { platform: 'META', analyticsData: evidence('META', 10, 50) },
      { platform: 'META', analyticsData: { reach: 999999, engagementRate: 99 } },
    ])

    expect(summary).toMatchObject({
      eligiblePosts: 1,
      insufficientSamplePosts: 1,
      unverifiedPosts: 1,
      reach: 400,
      impressions: 400,
      engagementCount: 40,
      denominator: 400,
      engagementRate: 10,
    })
  })
})
