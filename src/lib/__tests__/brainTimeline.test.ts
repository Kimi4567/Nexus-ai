import { describe, it, expect } from 'vitest'
import {
  deriveBrainTimeline,
  summarizeLearning,
  fieldLabel,
  type RawLearning,
} from '@/lib/brainTimeline'
import { attachBrainSignalSources } from '@/lib/brainSignalProvenance'

const pendingRow: RawLearning = {
  id: 'p1',
  field: 'winningHooks',
  displayName: 'Winning Hooks',
  icon: '🎣',
  trigger: 'approved_content',
  reason: 'Your approved posts share a question-style hook.',
  status: 'pending',
  createdAt: '2026-06-10T10:00:00.000Z',
}

const acceptedRow: RawLearning = {
  id: 'a1',
  field: 'toneKeywords',
  displayName: 'Brand Tone',
  icon: '🎙️',
  trigger: 'strategy',
  reason: 'Strategy consistently used a calm, premium tone.',
  status: 'accepted',
  updatedAt: '2026-06-11T10:00:00.000Z',
}

const dismissedRow: RawLearning = {
  id: 'd1',
  field: 'winningAngles',
  displayName: 'Winning Angles',
  icon: '🎯',
  trigger: 'ab_winner',
  reason: 'The user selected a transformation-angle variant.',
  status: 'dismissed',
  updatedAt: '2026-06-09T10:00:00.000Z',
}

const perfRow: RawLearning = {
  id: 'perf1',
  field: 'winningHooks',
  displayName: 'Winning Hooks',
  icon: '🎣',
  trigger: 'post_performance',
  reason: 'Posts with this hook earned the most engagement.',
  status: 'accepted',
  updatedAt: '2026-06-12T10:00:00.000Z',
}

describe('deriveBrainTimeline — status mapping (honesty)', () => {
  it('pending → suggested ONLY, and is acceptable', () => {
    const [item] = deriveBrainTimeline([pendingRow], [])
    expect(item.status).toBe('suggested')
    expect(item.statusKey).toBe('brain.timeline.status.suggested')
    expect(item.canAccept).toBe(true)
  })

  it('accepted → applied ONLY, not acceptable', () => {
    const [item] = deriveBrainTimeline([], [acceptedRow])
    expect(item.status).toBe('applied')
    expect(item.statusKey).toBe('brain.timeline.status.applied')
    expect(item.canAccept).toBe(false)
  })

  it('dismissed → dismissed ONLY', () => {
    const [item] = deriveBrainTimeline([], [dismissedRow])
    expect(item.status).toBe('dismissed')
    expect(item.statusKey).toBe('brain.timeline.status.dismissed')
    expect(item.canAccept).toBe(false)
  })

  it('never marks a non-pending row as suggested', () => {
    const items = deriveBrainTimeline([], [acceptedRow, dismissedRow])
    expect(items.every((i) => i.status !== 'suggested')).toBe(true)
  })

  it('drops rows with unknown/missing status (no fabrication)', () => {
    const items = deriveBrainTimeline(
      [{ id: 'x', status: 'weird' } as RawLearning],
      [{ id: 'y' } as RawLearning],
    )
    expect(items).toHaveLength(0)
  })

  it('shows the exact reviewable string value that Accept would apply', () => {
    const [item] = deriveBrainTimeline([{
      ...pendingRow,
      proposed: 'Editorial preference: keep drafts grounded in confirmed details.',
    }], [])

    expect(item.suggestedValue).toBe('Editorial preference: keep drafts grounded in confirmed details.')
  })

  it('renders string-list proposals safely but never exposes arbitrary JSON', () => {
    const [listItem] = deriveBrainTimeline([{
      ...pendingRow,
      id: 'list-proposal',
      proposed: ['Question-led opening', 'Direct factual opening'],
    }], [])
    const [objectItem] = deriveBrainTimeline([{
      ...pendingRow,
      id: 'object-proposal',
      proposed: { secret: 'raw JSON must stay hidden' },
    }], [])

    expect(listItem.suggestedValue).toBe('Question-led opening · Direct factual opening')
    expect(objectItem.suggestedValue).toBeNull()
  })
})

describe('deriveBrainTimeline — source mapping', () => {
  it('post_performance source ONLY when trigger is post_performance', () => {
    const [perf] = deriveBrainTimeline([], [perfRow])
    expect(perf.source).toBe('post_performance')
    expect(perf.sourceKey).toBe('brain.timeline.source.post_performance')

    const [strat] = deriveBrainTimeline([], [acceptedRow])
    expect(strat.source).toBe('strategy')
    expect(strat.source).not.toBe('post_performance')
  })

  it('maps each known trigger to its source chip key', () => {
    const triggers = [
      'strategy',
      'approved_content',
      'post_performance',
      'sentinel_insight',
      'competitor_monitor',
      'industry_trend',
    ]
    triggers.forEach((trigger, i) => {
      const [item] = deriveBrainTimeline([], [{ id: `t${i}`, status: 'accepted', trigger } as RawLearning])
      expect(item.source).toBe(trigger)
      expect(item.sourceKey).toBe(`brain.timeline.source.${trigger}`)
    })
  })

  it('maps legacy ab_winner trigger to user-selected variant, not performance winner copy', () => {
    const [item] = deriveBrainTimeline([], [{ id: 'ab1', status: 'accepted', trigger: 'ab_winner' } as RawLearning])
    expect(item.source).toBe('user_selected_variant')
    expect(item.sourceKey).toBe('brain.timeline.source.user_selected_variant')
  })

  it('maps current user_selected_variant trigger to preference signal source', () => {
    const [item] = deriveBrainTimeline([], [{ id: 'ab2', status: 'accepted', trigger: 'user_selected_variant' } as RawLearning])
    expect(item.source).toBe('user_selected_variant')
    expect(item.sourceKey).toBe('brain.timeline.source.user_selected_variant')
  })

  it('unknown trigger → no source chip', () => {
    const [item] = deriveBrainTimeline([], [{ id: 'u', status: 'accepted', trigger: 'mystery' } as RawLearning])
    expect(item.source).toBe('unknown')
    expect(item.sourceKey).toBeNull()
  })
})

describe('deriveBrainTimeline — ordering & dedup', () => {
  it('suggested items appear before applied/dismissed history', () => {
    const items = deriveBrainTimeline([pendingRow], [perfRow, acceptedRow, dismissedRow])
    expect(items[0].status).toBe('suggested')
    expect(items.slice(1).every((i) => i.status !== 'suggested')).toBe(true)
  })

  it('history is newest-first by date', () => {
    const items = deriveBrainTimeline([], [dismissedRow, perfRow, acceptedRow])
    const dates = items.map((i) => i.at)
    expect(dates).toEqual([perfRow.updatedAt, acceptedRow.updatedAt, dismissedRow.updatedAt])
  })

  it('de-duplicates by id', () => {
    const items = deriveBrainTimeline([pendingRow], [pendingRow as RawLearning])
    expect(items).toHaveLength(1)
  })

  it('empty/nullish inputs → empty timeline', () => {
    expect(deriveBrainTimeline(null, undefined)).toHaveLength(0)
    expect(deriveBrainTimeline([], [])).toHaveLength(0)
  })
})

describe('CTA gating', () => {
  it('canViewCampaign only when campaignId present', () => {
    const [withCampaign] = deriveBrainTimeline([{ ...pendingRow, campaignId: 'c1' }], [])
    expect(withCampaign.canViewCampaign).toBe(true)
    const [without] = deriveBrainTimeline([pendingRow], [])
    expect(without.canViewCampaign).toBe(false)
  })

  it('blocks acceptance but keeps dismiss available for an unsourced external signal', () => {
    const [item] = deriveBrainTimeline([{
      id: 'external-missing',
      trigger: 'competitor_monitor',
      status: 'pending',
      reason: 'An external market claim.',
    }], [])

    expect(item.traceability).toBe('source_not_attached')
    expect(item.reason).toBe('')
    expect(item.canAccept).toBe(false)
    expect(item.canDismiss).toBe(true)
  })

  it('allows a sourced external signal to enter explicit review', () => {
    const [item] = deriveBrainTimeline([{
      id: 'external-sourced',
      trigger: 'industry_trend',
      status: 'pending',
      reason: attachBrainSignalSources('A traceable market signal.', [{ url: 'https://example.com/report' }]),
    }], [])

    expect(item.traceability).toBe('external_sources')
    expect(item.reason).toBe('A traceable market signal.')
    expect(item.canAccept).toBe(true)
    expect(item.sourceRefs).toHaveLength(1)
  })

  it('keeps a valid analytics proposal acceptable by carrying its evidence contract', () => {
    const [item] = deriveBrainTimeline([{
      id: 'performance-pending',
      trigger: 'post_performance',
      field: 'winningHooks',
      status: 'pending',
      reason: 'A directional platform-local association is ready for review.',
      proposed: ['Question-led opening'],
      evidence: {
        schemaVersion: 1,
        source: 'platform_api',
        observationType: 'platform_local_association',
        causalClaim: false,
        platform: 'META',
        period: {
          start: '2026-07-01T00:00:00.000Z',
          end: '2026-07-20T00:00:00.000Z',
        },
        sample: {
          eligiblePosts: 5,
          aboveThresholdPosts: 3,
          evidencePostIds: ['post-1', 'post-2', 'post-3'],
          campaignIds: ['campaign-1'],
        },
        comparison: {
          metricDefinition: 'engaged_users_over_reach_or_impressions',
          baselineMethod: 'platform_local_median',
          baselineEngagementRate: 2,
          candidateThresholdEngagementRate: 2.4,
          thresholdRule: 'at_least_20_percent_above_platform_median',
        },
        confidence: {
          level: 'directional',
          rationale: 'Three posts cleared the platform-local threshold in the reviewed period.',
        },
        proposedChange: {
          field: 'winningHooks',
          values: ['Question-led opening'],
          affectsExistingApprovedRevisions: false,
          affectsFutureStrategyAndContent: true,
        },
        rollback: {
          strategy: 'remove_only_values_added_by_this_proposal',
          field: 'winningHooks',
          previousValue: [],
        },
      },
    }], [])

    expect(item.traceability).toBe('analytics_evidence')
    expect(item.canAccept).toBe(true)
  })
})

describe('summarizeLearning — dashboard line', () => {
  it('empty when no items', () => {
    expect(summarizeLearning([]).mode).toBe('empty')
  })

  it('hasLearned when at least one applied', () => {
    const items = deriveBrainTimeline([pendingRow], [acceptedRow])
    const s = summarizeLearning(items)
    expect(s.mode).toBe('hasLearned')
    expect(s.appliedCount).toBe(1)
    expect(s.pendingCount).toBe(1)
  })

  it('pendingOnly when suggestions exist but nothing applied', () => {
    const items = deriveBrainTimeline([pendingRow], [dismissedRow])
    const s = summarizeLearning(items)
    expect(s.mode).toBe('pendingOnly')
    expect(s.appliedCount).toBe(0)
    expect(s.pendingCount).toBe(1)
  })
})

describe('fieldLabel — localized, plain-business, no raw keys', () => {
  it('returns EN/AR label for known fields', () => {
    const [item] = deriveBrainTimeline([pendingRow], [])
    expect(fieldLabel(item, 'en')).toBe('Hook Signals')
    expect(fieldLabel(item, 'ar')).toBe('إشارات الخطافات')
  })

  it('falls back to stored displayName for unknown fields', () => {
    const [item] = deriveBrainTimeline([], [{ id: 'k', status: 'accepted', field: 'customField', displayName: 'Custom Insight' } as RawLearning])
    expect(fieldLabel(item, 'en')).toBe('Custom Insight')
    expect(fieldLabel(item, 'ar')).toBe('Custom Insight')
  })
})
