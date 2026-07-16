/**
 * Canonical inbox rules for approvals.
 *
 * Strategy suggestions created by the legacy orchestrator are notifications,
 * not executable approvals. A strategy can only be approved from the guarded
 * campaign review after deterministic and Sentinel quality checks pass.
 */

export interface ApprovalSuggestionLike {
  type?: string | null
}

export interface ApprovalQueueItemLike {
  requiresApproval?: boolean | null
}

export function isLegacyStrategySuggestion(
  suggestion: ApprovalSuggestionLike | null | undefined,
): boolean {
  return String(suggestion?.type || '').trim().toUpperCase() === 'STRATEGY'
}

export function actionableApprovalSuggestions<T extends ApprovalSuggestionLike>(
  suggestions: readonly T[] | null | undefined,
): T[] {
  return (suggestions || []).filter(suggestion => !isLegacyStrategySuggestion(suggestion))
}

export function liveApprovalQueue<T extends ApprovalQueueItemLike>(
  queue: readonly T[] | null | undefined,
): T[] {
  return (queue || []).filter(item => item.requiresApproval === true)
}
