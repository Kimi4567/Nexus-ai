import {
  isContentPostMediaReadyForScheduling,
  type ContentHubMediaStateInput,
} from './contentHubMediaState'

export interface ContentLifecycleTruthInput extends ContentHubMediaStateInput {
  status?: string | null
  approvedAt?: string | Date | null
  scheduledAt?: string | Date | null
  approvedSnapshotId?: string | null
  mediaApprovalSnapshotId?: string | null
  scheduledSnapshotId?: string | null
}

export interface ContentLifecycleTruth {
  status: string
  hasApprovalTimestamp: boolean
  hasCopyApprovalSnapshot: boolean
  hasImmutableCopyApproval: boolean
  hasReadyMedia: boolean
  hasMediaApprovalSnapshot: boolean
  hasFinalMediaApproval: boolean
  hasScheduledTime: boolean
  hasScheduleDecision: boolean
  isValidScheduled: boolean
  isInvalidScheduled: boolean
  hasProposedTime: boolean
  requiresApprovalEvidence: boolean
  hasApprovalEvidenceGap: boolean
}

function hasValidDate(value?: string | Date | null): boolean {
  if (!value) return false
  const date = value instanceof Date ? value : new Date(value)
  return !Number.isNaN(date.getTime())
}

/**
 * One fail-closed interpretation of copy approval, media approval, and schedule
 * evidence. UI surfaces and server-side execution truth must use the same rules
 * so a legacy status string cannot be presented as a real execution decision.
 */
export function deriveContentLifecycleTruth(
  input: ContentLifecycleTruthInput,
): ContentLifecycleTruth {
  const status = String(input.status ?? 'DRAFT').toUpperCase()
  const hasApprovalTimestamp = hasValidDate(input.approvedAt)
  const hasCopyApprovalSnapshot = Boolean(input.approvedSnapshotId)
  const hasImmutableCopyApproval = hasApprovalTimestamp && hasCopyApprovalSnapshot
  const hasReadyMedia = isContentPostMediaReadyForScheduling(input)
  const hasMediaApprovalSnapshot = Boolean(input.mediaApprovalSnapshotId)
  const hasFinalMediaApproval = hasReadyMedia && hasMediaApprovalSnapshot
  const hasScheduledTime = hasValidDate(input.scheduledAt)
  const hasScheduleDecision = Boolean(input.scheduledSnapshotId)
  const isScheduledStatus = status === 'SCHEDULED'
  const isValidScheduled = isScheduledStatus
    && hasImmutableCopyApproval
    && hasFinalMediaApproval
    && hasScheduledTime
    && hasScheduleDecision
  const isInvalidScheduled = isScheduledStatus && !isValidScheduled
  const requiresApprovalEvidence = ['APPROVED', 'SCHEDULED', 'PROCESSING', 'PUBLISHED'].includes(status)

  return {
    status,
    hasApprovalTimestamp,
    hasCopyApprovalSnapshot,
    hasImmutableCopyApproval,
    hasReadyMedia,
    hasMediaApprovalSnapshot,
    hasFinalMediaApproval,
    hasScheduledTime,
    hasScheduleDecision,
    isValidScheduled,
    isInvalidScheduled,
    hasProposedTime: hasScheduledTime && !isValidScheduled,
    requiresApprovalEvidence,
    hasApprovalEvidenceGap: requiresApprovalEvidence && !hasImmutableCopyApproval,
  }
}
