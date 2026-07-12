import type {
  ExecutionActionKind,
  ExecutionQueueItem,
  WorkspaceExecutionTruth,
} from '@/lib/executionTruth'

export const EXECUTION_MONITOR_VERSION = 1
export const EXECUTION_MONITOR_COOLDOWN_HOURS = 24

export interface ExecutionMonitorSuggestionPlan {
  signature: string
  campaignId: string
  agent: 'STRATEGIST' | 'CONTENT_DIRECTOR' | 'CAMPAIGN_MANAGER'
  type: 'STRATEGY' | 'CONTENT_SWAP'
  priority: 1 | 2
  title: string
  reasoning: string
  impact: string
  payload: {
    source: 'execution-monitor'
    monitorVersion: 1
    signature: string
    actionKind: ExecutionActionKind
    href: string
    titleAr: string
    reasoningAr: string
    safety: ExecutionQueueItem['safety']
    evidence: ExecutionQueueItem['evidence']
    performanceClaim: false
    autoExecution: false
  }
}

function ownerFor(action: ExecutionQueueItem): Pick<ExecutionMonitorSuggestionPlan, 'agent' | 'type'> {
  switch (action.kind) {
    case 'CREATE_STRATEGY':
    case 'REVIEW_STRATEGY':
    case 'REVIEW_CAMPAIGN':
      return { agent: 'STRATEGIST', type: 'STRATEGY' }
    case 'GENERATE_CONTENT':
    case 'REVIEW_CONTENT':
      return { agent: 'CONTENT_DIRECTOR', type: 'CONTENT_SWAP' }
    default:
      return { agent: 'CAMPAIGN_MANAGER', type: 'CONTENT_SWAP' }
  }
}

export function monitorSignature(action: ExecutionQueueItem): string {
  return `execution:v${EXECUTION_MONITOR_VERSION}:${action.campaignId}:${action.kind}:${action.stage}`
}

/**
 * Converts only urgent, actionable execution truth into approval suggestions.
 * Monitoring-only and medium/low actions stay visible in the Execution Queue but
 * never create inbox noise. No AI model or inferred performance is involved.
 */
export function planExecutionMonitorSuggestions(
  truth: WorkspaceExecutionTruth,
  limit = 12,
): ExecutionMonitorSuggestionPlan[] {
  return truth.queue
    .filter((action) => action.safety !== 'monitor_only')
    .filter((action) => action.priority === 'critical' || action.priority === 'high')
    .slice(0, Math.max(0, limit))
    .map((action) => {
      const owner = ownerFor(action)
      const signature = monitorSignature(action)
      return {
        signature,
        campaignId: action.campaignId,
        ...owner,
        priority: action.priority === 'critical' ? 1 : 2,
        title: action.title.en,
        reasoning: action.reason.en,
        impact: 'Closes the next verified workflow gap; no performance outcome is assumed.',
        payload: {
          source: 'execution-monitor',
          monitorVersion: EXECUTION_MONITOR_VERSION,
          signature,
          actionKind: action.kind,
          href: action.href,
          titleAr: action.title.ar,
          reasoningAr: action.reason.ar,
          safety: action.safety,
          evidence: action.evidence,
          performanceClaim: false,
          autoExecution: false,
        },
      }
    })
}
