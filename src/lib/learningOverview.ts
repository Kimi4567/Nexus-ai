import { inspectBrainSignalProvenance } from '@/lib/brainSignalProvenance'

export interface LearningSignalRecord {
  id: string
  trigger?: string | null
  field?: string | null
  displayName?: string | null
  icon?: string | null
  current?: unknown
  proposed?: unknown
  reason?: string | null
  evidence?: unknown
  status?: string | null
  campaignId?: string | null
  createdAt?: Date | string | null
  updatedAt?: Date | string | null
}

export interface WorkflowSignalRecord {
  id: string
  eventType: string
  actor?: string | null
  campaignId?: string | null
  socialPostId?: string | null
  createdAt?: Date | string | null
}

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function timestamp(value: Date | string | null | undefined): number {
  const parsed = iso(value)
  return parsed ? new Date(parsed).getTime() : 0
}

export function summarizeLearningEvidence({
  learningSignals,
  workflowSignals,
  performanceEvidenceRows,
  eligiblePerformancePostIds,
}: {
  learningSignals: LearningSignalRecord[] | null | undefined
  workflowSignals: WorkflowSignalRecord[] | null | undefined
  performanceEvidenceRows: number
  eligiblePerformancePostIds?: string[]
}) {
  const signals = Array.isArray(learningSignals) ? learningSignals : []
  const workflow = Array.isArray(workflowSignals) ? workflowSignals : []
  const hasPerformanceEvidence = performanceEvidenceRows > 0
  const eligiblePostIds = eligiblePerformancePostIds ? new Set(eligiblePerformancePostIds) : null

  const hasMatchingAnalyticsEvidence = (signal: LearningSignalRecord): boolean => {
    if (signal.trigger !== 'post_performance' || !hasPerformanceEvidence) return false
    const provenance = inspectBrainSignalProvenance(signal)
    if (!provenance.canAccept || !('evidence' in provenance) || !provenance.evidence) return false
    return eligiblePostIds === null
      ? true
      : provenance.evidence.sample.evidencePostIds.some(id => eligiblePostIds.has(id))
  }

  const pending = signals.filter(signal => signal.status === 'pending')
  const accepted = signals.filter(signal => signal.status === 'accepted')
  const dismissed = signals.filter(signal => signal.status === 'dismissed')
  const rolledBack = signals.filter(signal => signal.status === 'rolled_back')
  const analyticsBacked = accepted.filter(hasMatchingAnalyticsEvidence)
  const reviewedSignals = accepted.filter(signal => signal.trigger !== 'post_performance')
  const untraceableExternalSignals = signals.filter(signal => (
    inspectBrainSignalProvenance(signal).traceability === 'source_not_attached'
  ))

  const stage = analyticsBacked.length > 0
    ? 'analytics_backed'
    : pending.length > 0 || reviewedSignals.length > 0 || workflow.length > 0
      ? 'signals_building'
      : 'empty'

  const mappedSignals = [...signals]
    .sort((a, b) => timestamp(b.updatedAt ?? b.createdAt) - timestamp(a.updatedAt ?? a.createdAt))
    .map(signal => {
      const provenance = inspectBrainSignalProvenance(signal)
      return {
        id: signal.id,
        status: signal.status || 'unknown',
        source: hasMatchingAnalyticsEvidence(signal)
          ? 'analytics'
          : 'review_signal',
        trigger: signal.trigger || null,
        field: signal.field || '',
        displayName: signal.displayName || '',
        icon: signal.icon || null,
        current: signal.current ?? null,
        proposed: signal.proposed ?? null,
        reason: provenance.displayReason,
        traceability: provenance.traceability,
        sourceRefs: provenance.sourceRefs,
        canAccept: provenance.canAccept,
        evidence: 'evidence' in provenance ? provenance.evidence : null,
        campaignId: signal.campaignId || null,
        at: iso(signal.updatedAt ?? signal.createdAt),
      }
    })

  const recentWorkflowSignals = [...workflow]
    .sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt))
    .slice(0, 8)
    .map(signal => ({
      id: signal.id,
      eventType: signal.eventType,
      actor: signal.actor || 'USER',
      campaignId: signal.campaignId || null,
      socialPostId: signal.socialPostId || null,
      at: iso(signal.createdAt),
    }))

  return {
    stage,
    counts: {
      totalSignals: signals.length,
      acceptedSignals: accepted.length,
      pendingReview: pending.length,
      reviewedSignals: reviewedSignals.length,
      dismissedSignals: dismissed.length,
      rolledBackLessons: rolledBack.length,
      analyticsBackedLessons: analyticsBacked.length,
      workflowSignals: workflow.length,
      performanceEvidenceRows: Math.max(0, performanceEvidenceRows),
      untraceableExternalSignals: untraceableExternalSignals.length,
    },
    signals: mappedSignals,
    recentSignals: mappedSignals.slice(0, 8),
    recentWorkflowSignals,
  }
}
