import { describe, expect, it } from 'vitest'
import {
  buildContentPlanOrderMismatchMessage,
  countContentPlanDirections,
  deriveContentPlanOrderReview,
  resolveContentPlanOrderScope,
} from '@/lib/contentPlanOrderContract'

const posts = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    contentPlanIndex: i + 1,
    variantGroup: null,
  }))

describe('content plan order contract', () => {
  it('treats saved strategy deliverables as the binding Content Hub count', () => {
    const scope = resolveContentPlanOrderScope({
      strategyType: 'organic',
      strategyOrder: { strategyType: 'organic', durationPreset: 'custom' },
      strategyDeliverables: { organicPostCount: 7, requestedOrganicPostCount: 7 },
    })

    expect(scope).toEqual({
      bound: true,
      expectedDirections: 7,
      strategyType: 'organic',
    })
  })

  it('passes when Content Hub directions match the reviewed strategy order', () => {
    const review = deriveContentPlanOrderReview(
      {
        strategyType: 'organic',
        strategyOrder: { strategyType: 'organic' },
        strategyDeliverables: { organicPostCount: 7 },
      },
      posts(7),
    )

    expect(review).toMatchObject({
      bound: true,
      ok: true,
      expectedDirections: 7,
      actualDirections: 7,
    })
  })

  it('flags the observed mismatch: a 7-post order with 8 Content Hub directions', () => {
    const review = deriveContentPlanOrderReview(
      {
        strategyType: 'organic',
        strategyOrder: { strategyType: 'organic' },
        strategyDeliverables: { organicPostCount: 7 },
      },
      posts(8),
    )

    expect(review).toMatchObject({
      bound: true,
      ok: false,
      expectedDirections: 7,
      actualDirections: 8,
      reason: 'direction-count-mismatch',
    })
    expect(buildContentPlanOrderMismatchMessage(review)).toContain('expects 7')
  })

  it('counts A/B variants that share a contentPlanIndex as one direction', () => {
    const directionCount = countContentPlanDirections([
      { contentPlanIndex: 1, variantGroup: 'ab-1' },
      { contentPlanIndex: 1, variantGroup: 'ab-1' },
      { contentPlanIndex: 2, variantGroup: null },
    ])

    expect(directionCount).toBe(2)
  })

  it('blocks paid planning-only campaigns when Content Hub contains posts', () => {
    const review = deriveContentPlanOrderReview(
      {
        strategyType: 'paid',
        strategyOrder: { strategyType: 'paid' },
        strategyDeliverables: { organicPostCount: 0 },
      },
      posts(1),
    )

    expect(review).toMatchObject({
      bound: true,
      ok: false,
      expectedDirections: 0,
      actualDirections: 1,
      reason: 'paid-plan-has-posts',
    })
  })

  it('does not bind legacy campaigns without a saved order or deliverables', () => {
    const review = deriveContentPlanOrderReview({}, posts(12))

    expect(review).toMatchObject({
      bound: false,
      ok: true,
      expectedDirections: null,
      actualDirections: 12,
    })
  })

  it('does not bind legacy campaigns that only have a loose strategyType label', () => {
    const review = deriveContentPlanOrderReview({ strategyType: 'organic' }, posts(12))

    expect(review).toMatchObject({
      bound: false,
      ok: true,
      expectedDirections: null,
      actualDirections: 12,
    })
  })
})
