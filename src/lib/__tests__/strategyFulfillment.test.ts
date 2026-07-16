import { describe, expect, it } from 'vitest'
import { deriveStrategyFulfillmentSummary } from '../strategyFulfillment'

const posts = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    contentPlanIndex: i + 1,
    variantGroup: null,
  }))

describe('deriveStrategyFulfillmentSummary', () => {
  it('shows a positive match when Content Hub posts fulfill the saved organic order', () => {
    const summary = deriveStrategyFulfillmentSummary({
      locale: 'ar',
      operatingSnapshotsLoaded: true,
      aiOutput: {
        strategyType: 'organic',
        strategyOrder: { strategyType: 'organic', durationDays: 45 },
        strategyDeliverables: { planningHorizonDays: 45, organicPostCount: 7, requestedOrganicPostCount: 7 },
      },
      posts: posts(7),
    })

    expect(summary.status).toBe('matched')
    expect(summary.tone).toBe('positive')
    expect(summary.value).toContain('7 من 7')
    expect(summary.helper).toContain('45 يوم')
  })

  it('does not call an organic strategy failed before Content Hub posts are generated', () => {
    const summary = deriveStrategyFulfillmentSummary({
      locale: 'en',
      operatingSnapshotsLoaded: true,
      aiOutput: {
        strategyType: 'full',
        strategyOrder: { strategyType: 'full', durationDays: 90 },
        strategyDeliverables: { planningHorizonDays: 90, organicPostCount: 16, requestedOrganicPostCount: 16 },
      },
      posts: [],
    })

    expect(summary.status).toBe('waiting_for_content_hub')
    expect(summary.tone).toBe('warning')
    expect(summary.value).toContain('16 posts not created yet')
    expect(summary.helper).toContain('draft posts are created later in Content Hub')
  })

  it('never describes positive organic deliverables as paid-only', () => {
    const summary = deriveStrategyFulfillmentSummary({
      locale: 'en',
      operatingSnapshotsLoaded: true,
      aiOutput: {
        strategyType: 'paid',
        strategyOrder: { strategyType: 'organic', durationDays: 30 },
        strategyDeliverables: {
          planningHorizonDays: 30,
          organicPostCount: 3,
          paidAdAngleCount: 0,
          paidAdVariationCount: 0,
          creativeBriefCount: 0,
          audienceHypothesisCount: 0,
        },
      },
      posts: [],
    })

    expect(summary.status).toBe('waiting_for_content_hub')
    expect(summary.helper).toContain('Saved order: organic-only')
    expect(summary.helper).not.toContain('paid-only')
  })

  it('repairs a stale paid review label at the final presentation boundary', () => {
    const summary = deriveStrategyFulfillmentSummary({
      locale: 'en',
      operatingSnapshotsLoaded: true,
      aiOutput: {
        strategyType: 'paid',
        strategyOrder: { strategyType: 'paid', durationDays: 30 },
        strategyDeliverables: {
          planningHorizonDays: 30,
          organicPostCount: 3,
          requestedOrganicPostCount: 3,
        },
      },
      posts: [],
    })

    expect(summary.value).toContain('3 posts not created yet')
    expect(summary.helper).toContain('Saved order: organic-only')
    expect(summary.helper).not.toContain('paid-only')
  })

  it('shows paid planning-only as fulfilled when no organic Content Hub posts are expected', () => {
    const summary = deriveStrategyFulfillmentSummary({
      locale: 'en',
      operatingSnapshotsLoaded: true,
      aiOutput: {
        strategyType: 'paid',
        strategyOrder: { strategyType: 'paid', durationDays: 30 },
        strategyDeliverables: { planningHorizonDays: 30, organicPostCount: 0, requestedOrganicPostCount: 0 },
      },
      posts: [],
    })

    expect(summary.status).toBe('paid_planning_only')
    expect(summary.tone).toBe('positive')
    expect(summary.value).toBe('Matched: no organic posts expected')
    expect(summary.helper).toContain('paid planning for review only')
  })

  it('flags a real mismatch once Content Hub posts exist with the wrong count', () => {
    const summary = deriveStrategyFulfillmentSummary({
      locale: 'en',
      operatingSnapshotsLoaded: true,
      aiOutput: {
        strategyType: 'organic',
        strategyOrder: { strategyType: 'organic', durationDays: 30 },
        strategyDeliverables: { planningHorizonDays: 30, organicPostCount: 7 },
      },
      posts: posts(8),
    })

    expect(summary.status).toBe('mismatch')
    expect(summary.tone).toBe('danger')
    expect(summary.value).toContain('8 actual, 7 expected')
    expect(summary.helper).toContain('Do not approve or schedule')
  })

  it('stays neutral for legacy campaigns without a saved strategy order', () => {
    const summary = deriveStrategyFulfillmentSummary({
      locale: 'en',
      operatingSnapshotsLoaded: true,
      aiOutput: {},
      posts: posts(12),
    })

    expect(summary.status).toBe('legacy')
    expect(summary.tone).toBe('muted')
    expect(summary.expectedDirections).toBeNull()
  })

  it('does not judge fulfillment while post snapshots are still loading', () => {
    const summary = deriveStrategyFulfillmentSummary({
      locale: 'en',
      operatingSnapshotsLoaded: false,
      aiOutput: {
        strategyType: 'organic',
        strategyOrder: { strategyType: 'organic', durationDays: 45 },
        strategyDeliverables: { planningHorizonDays: 45, organicPostCount: 7 },
      },
      posts: [],
    })

    expect(summary.status).toBe('checking')
    expect(summary.tone).toBe('checking')
    expect(summary.value).toBe('Checking Content Hub posts')
  })
})
