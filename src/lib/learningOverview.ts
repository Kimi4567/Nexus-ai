import { inspectBrainSignalProvenance } from '@/lib/brainSignalProvenance'

export interface LearningSignalRecord {
  id: string
  trigger?: string | null
  field?: string | null
  displayName?: string | null
  reason?: string | null
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
}: {
  learningSignals: LearningSignalRecord[] | null | undefined
  workflowSignals: WorkflowSignalRecord[] | null | undefined
  performanceEvidenceRows: number
}) {
  const signals = Array.isArray(learningSignals) ? learningSignals : []
  const workflow = Array.isArray(workflowSignals) ? workflowSignals : []
  const hasPerformanceEvidence = performanceEvidenceRows > 0

  const pending = signals.filter(signal => signal.status === 'pending')
  const accepted = signals.filter(signal => signal.status === 'accepted')
  const dismissed = signals.filter(signal => signal.status === 'dismissed')
  const analyticsBacked = accepted.filter(signal => signal.trigger === 'post_performance' && hasPerformanceEvidence)
  const reviewedSignals = accepted.filter(signal => signal.trigger !== 'post_performance')
  const untraceableExternalSignals = signals.filter(signal => (
    inspectBrainSignalProvenance(signal).traceability === 'source_not_attached'
  ))

  const stage = analyticsBacked.length > 0
    ? 'analytics_backed'
    : pending.length > 0 || reviewedSignals.length > 0 || workflow.length > 0
      ? 'signals_building'
      : 'empty'

  const recentSignals = [...signals]
    .sort((a, b) => timestamp(b.updatedAt ?? b.createdAt) - timestamp(a.updatedAt ?? a.createdAt))
    .slice(0, 8)
    .map(signal => {
      const provenance = inspectBrainSignalProvenance(signal)
      return {
        id: signal.id,
        status: signal.status || 'unknown',
        source: signal.trigger === 'post_performance' && hasPerformanceEvidence
          ? 'analytics'
          : 'review_signal',
        trigger: signal.trigger || null,
        field: signal.field || '',
        displayName: signal.displayName || '',
        reason: provenance.displayReason,
        traceability: provenance.traceability,
        sourceRefs: provenance.sourceRefs,
        canAccept: provenance.canAccept,
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
      pendingReview: pending.length,
      reviewedSignals: reviewedSignals.length,
      dismissedSignals: dismissed.length,
      analyticsBackedLessons: analyticsBacked.length,
      workflowSignals: workflow.length,
      performanceEvidenceRows: Math.max(0, performanceEvidenceRows),
      untraceableExternalSignals: untraceableExternalSignals.length,
    },
    recentSignals,
    recentWorkflowSignals,
  }
}
