/**
 * Canonical inbox rules for approvals.
 *
 * Strategy suggestions created by the legacy orchestrator are notifications,
 * not executable approvals. A strategy can only be approved from the guarded
 * campaign review after deterministic and Sentinel quality checks pass.
 */

export interface ApprovalSuggestionLike {
  type?: string | null
  payload?: unknown
}

export interface ApprovalQueueItemLike {
  requiresApproval?: boolean | null
  campaignId?: string | null
}

export interface CampaignApprovalSuggestionLike extends ApprovalSuggestionLike {
  campaignId?: string | null
  payload?: unknown
}

export function isLegacyStrategySuggestion(
  suggestion: ApprovalSuggestionLike | null | undefined,
): boolean {
  return String(suggestion?.type || '').trim().toUpperCase() === 'STRATEGY'
}

export function isExecutionMonitorNavigationSuggestion(
  suggestion: ApprovalSuggestionLike | null | undefined,
): boolean {
  if (!suggestion?.payload || typeof suggestion.payload !== 'object' || Array.isArray(suggestion.payload)) {
    return false
  }
  return (suggestion.payload as Record<string, unknown>).source === 'execution-monitor'
}

export function actionableApprovalSuggestions<T extends ApprovalSuggestionLike>(
  suggestions: readonly T[] | null | undefined,
): T[] {
  return (suggestions || []).filter(suggestion => (
    !isLegacyStrategySuggestion(suggestion)
    && !isExecutionMonitorNavigationSuggestion(suggestion)
  ))
}

export function liveApprovalQueue<T extends ApprovalQueueItemLike>(
  queue: readonly T[] | null | undefined,
): T[] {
  return (queue || []).filter(item => item.requiresApproval === true)
}

function payloadCampaignId(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const campaignId = (value as Record<string, unknown>).campaignId
  return typeof campaignId === 'string' && campaignId.trim() ? campaignId : null
}

export function suggestionCampaignId(
  suggestion: CampaignApprovalSuggestionLike,
): string | null {
  return typeof suggestion.campaignId === 'string' && suggestion.campaignId.trim()
    ? suggestion.campaignId
    : payloadCampaignId(suggestion.payload)
}

/**
 * A persisted suggestion and a live execution action can describe the same
 * campaign decision. Keep the persisted, reviewable row and remove only that
 * campaign's duplicate live card so every surface reports one decision.
 */
export function dedupeLiveApprovalQueue<
  TSuggestion extends CampaignApprovalSuggestionLike,
  TQueueItem extends ApprovalQueueItemLike,
>(
  suggestions: readonly TSuggestion[] | null | undefined,
  queue: readonly TQueueItem[] | null | undefined,
): TQueueItem[] {
  const persistedCampaignIds = new Set(
    (suggestions || [])
      .map(suggestionCampaignId)
      .filter((campaignId): campaignId is string => Boolean(campaignId)),
  )

  return liveApprovalQueue(queue).filter(item => (
    !item.campaignId || !persistedCampaignIds.has(item.campaignId)
  ))
}
