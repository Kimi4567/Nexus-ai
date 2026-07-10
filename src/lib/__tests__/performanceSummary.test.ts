import { describe, expect, it } from 'vitest'
import { summarizePerformanceEvidence } from '@/lib/performanceSummary'

describe('summarizePerformanceEvidence', () => {
  it('keeps workflow-only records and manual paid snapshots out of performance evidence', () => {
    const summary = summarizePerformanceEvidence(
      [{ platform: 'META', analyticsData: { status: 'PUBLISHED' } }],
      [{ platform: 'META', dataSource: 'manual', impressions: 1200, clicks: 30 }],
    )

    expect(summary.hasEvidence).toBe(false)
    expect(summary.totalEvidenceRows).toBe(0)
    expect(summary.channels).toEqual([])
  })

  it('treats measured zeroes from a trusted source as real evidence', () => {
    const summary = summarizePerformanceEvidence(
      [{ platform: 'META', analyticsData: { impressions: 0, likes: 0 }, analyticsUpdatedAt: '2026-07-10T10:00:00Z' }],
      [{ platform: 'META', dataSource: 'api', impressions: 0, clicks: 0, spend: 0, date: '2026-07-10T00:00:00Z' }],
    )

    expect(summary.hasEvidence).toBe(true)
    expect(summary.organicEvidenceCount).toBe(1)
    expect(summary.paidEvidenceCount).toBe(1)
    expect(summary.totals.impressions).toBe(0)
  })

  it('aggregates organic and analytics-backed paid metrics without inventing rates', () => {
    const summary = summarizePerformanceEvidence(
      [{
        platform: 'INSTAGRAM',
        analyticsData: { impressions: 1000, reach: 700, likes: 50, comments: 10, shares: 5, clicks: 20 },
        analyticsUpdatedAt: '2026-07-08T10:00:00Z',
      }],
      [{
        platform: 'META',
        dataSource: 'meta_api',
        impressions: 2000,
        reach: 1500,
        postEngagements: 100,
        clicks: 80,
        conversions: 8,
        spend: 160,
        roas: 3.5,
        date: '2026-07-09T00:00:00Z',
        syncedAt: '2026-07-09T03:00:00Z',
      }],
    )

    expect(summary.totals).toMatchObject({
      impressions: 3000,
      reach: 2200,
      engagements: 165,
      clicks: 100,
      conversions: 8,
      spend: 160,
      paidRoas: 3.5,
    })
    expect(summary.totals.organicEngagementRate).toBe(6.5)
    expect(summary.totals.paidCtr).toBe(4)
    expect(summary.channels.map(channel => channel.platform)).toEqual(['META', 'INSTAGRAM'])
    expect(summary.trend).toHaveLength(2)
  })
})
