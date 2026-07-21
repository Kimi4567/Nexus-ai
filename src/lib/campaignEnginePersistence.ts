type EngineStep = {
  key?: string
  status?: string
  completedAt?: string
  [key: string]: unknown
}

type EngineRecord = {
  status?: string
  score?: number
  currentStep?: string
  sentinelStatus?: string
  steps?: EngineStep[]
  error?: string
  [key: string]: unknown
}

/** A successful stage must never preserve an error from an older attempt. */
export function clearSuccessfulCampaignEngineError<T extends { error?: unknown }>(engine: T): Omit<T, 'error'> {
  const { error: _staleError, ...clean } = engine
  return clean
}

/**
 * Sentinel is separate from publication approval. Persist its outcome into the
 * engine summary so operational reads and the reviewed package cannot disagree.
 */
export function applySentinelReviewToCampaignEngine(
  previous: unknown,
  sentinelStatus: 'passed' | 'needs_attention',
  reviewedAt: string,
): EngineRecord {
  const source = previous && typeof previous === 'object' && !Array.isArray(previous)
    ? previous as EngineRecord
    : {}
  const passed = sentinelStatus === 'passed'
  const steps = Array.isArray(source.steps)
    ? source.steps.map(step => {
        if (step.key === 'sentinel') {
          return {
            ...step,
            status: passed ? 'done' : 'blocked',
            ...(passed ? { completedAt: reviewedAt } : {}),
          }
        }
        if (step.key === 'approval') {
          const { completedAt: _oldCompletedAt, ...approvalStep } = step
          return { ...approvalStep, status: passed ? 'pending' : 'blocked' }
        }
        return step
      })
    : []
  const completed = steps.filter(step => step.status === 'done').length
  const score = steps.length > 0 ? Math.round((completed / steps.length) * 100) : (passed ? 100 : 0)
  const { error: _staleError, ...cleanSource } = source

  return {
    ...cleanSource,
    status: passed ? 'ready_for_approval' : 'blocked',
    currentStep: passed ? 'approval' : 'sentinel',
    sentinelStatus,
    steps,
    score,
    lastCompletedAt: reviewedAt,
  }
}

/**
 * Strategy approval unlocks content planning, not launch. Persist a distinct
 * state so an approved direction is never presented as publish-ready while its
 * Content Hub drafts are still missing or quota-blocked.
 */
export function applyStrategyApprovalToCampaignEngine(
  previous: unknown,
  approved: boolean,
  decidedAt: string,
): EngineRecord {
  const source = previous && typeof previous === 'object' && !Array.isArray(previous)
    ? previous as EngineRecord
    : {}
  const sentinelPassed = source.sentinelStatus === 'passed'
  const steps = Array.isArray(source.steps)
    ? source.steps.map(step => {
        if (step.key !== 'approval') return step
        const { completedAt: _oldCompletedAt, ...approvalStep } = step
        return approved
          ? { ...approvalStep, status: 'done', completedAt: decidedAt }
          : { ...approvalStep, status: sentinelPassed ? 'pending' : 'blocked' }
      })
    : []
  const completed = steps.filter(step => step.status === 'done').length
  const score = steps.length > 0 ? Math.round((completed / steps.length) * 100) : 0
  const { error: _staleError, ...cleanSource } = source

  return {
    ...cleanSource,
    status: approved ? 'strategy_approved' : (sentinelPassed ? 'ready_for_approval' : 'idle'),
    currentStep: approved ? 'content' : (sentinelPassed ? 'approval' : 'sentinel'),
    steps,
    score,
    lastCompletedAt: decidedAt,
  }
}
