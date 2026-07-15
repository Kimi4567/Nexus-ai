import { monitorSignature } from '@/lib/executionMonitor'
import type { WorkspaceExecutionTruth } from '@/lib/executionTruth'

export interface AgentSuggestionTruthCandidate {
  campaignId?: string | null
  type?: string | null
  payload?: unknown
}

function payloadRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

/**
 * Keeps approval surfaces and operations counters on the same current-state
 * contract. Persisted monitor suggestions are historical rows; they stop being
 * pending decisions as soon as their execution signature is superseded.
 */
export function filterCurrentAgentSuggestions<T extends AgentSuggestionTruthCandidate>(
  candidates: T[],
  truth: WorkspaceExecutionTruth,
): T[] {
  const currentExecutionSignatures = new Set(truth.queue.map(monitorSignature))
  const truthByCampaign = new Map(truth.campaigns.map(campaign => [campaign.campaignId, campaign]))

  return candidates.filter((suggestion) => {
    const payload = payloadRecord(suggestion.payload)
    if (payload.source === 'execution-monitor') {
      return typeof payload.signature === 'string' && currentExecutionSignatures.has(payload.signature)
    }

    const researchReview = typeof payload.source === 'string' && payload.source.endsWith('research-monitor')
    const campaignTruth = typeof suggestion.campaignId === 'string'
      ? truthByCampaign.get(suggestion.campaignId)
      : undefined
    if (suggestion.type === 'STRATEGY' && campaignTruth?.strategyApprovalState === 'approved' && !researchReview) {
      return false
    }
    return true
  })
}
