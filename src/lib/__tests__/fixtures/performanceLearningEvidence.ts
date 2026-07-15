export function validPerformanceLearningEvidence() {
  return {
    schemaVersion: 1 as const,
    source: 'platform_api' as const,
    observationType: 'platform_local_association' as const,
    causalClaim: false as const,
    platform: 'META',
    period: { start: '2026-07-01T00:00:00.000Z', end: '2026-07-14T00:00:00.000Z' },
    sample: {
      eligiblePosts: 6,
      aboveThresholdPosts: 3,
      evidencePostIds: ['post-1', 'post-2', 'post-3'],
      campaignIds: ['campaign-1'],
    },
    comparison: {
      metricDefinition: 'engaged_users_over_reach_or_impressions',
      baselineMethod: 'platform_local_median' as const,
      baselineEngagementRate: 1.5,
      candidateThresholdEngagementRate: 1.8,
      thresholdRule: 'at_least_20_percent_above_platform_median' as const,
    },
    confidence: {
      level: 'directional' as const,
      rationale: 'A same-platform observational sample supports another controlled test, not a causal claim.',
    },
    proposedChange: {
      field: 'winningHooks',
      values: ['A new evidence-backed hook', 'An existing hook'],
      affectsExistingApprovedRevisions: false as const,
      affectsFutureStrategyAndContent: true as const,
    },
    rollback: {
      strategy: 'remove_only_values_added_by_this_proposal' as const,
      field: 'winningHooks',
      previousValue: ['An existing hook'],
    },
  }
}
