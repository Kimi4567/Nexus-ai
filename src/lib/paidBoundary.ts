export const PLANNING_ASSUMPTION_BUDGET_SOURCE = 'planning_assumption' as const
export const BUDGET_VALUE_PRESENT_UNCONFIRMED_SOURCE = 'budget_value_present_unconfirmed' as const
export const EXPLICIT_BUDGET_CONFIRMED_SOURCE = 'explicit_budget_confirmed' as const

const SAFE_PAID_PACK_SETUP_STATUSES = new Set(['DRAFT', 'GENERATED'])
const UNSAFE_PAID_PACK_STATUSES = new Set([
  'LAUNCHED',
  'COMPLETED',
  'ACTIVE',
  'READY_TO_LAUNCH',
  'LIVE',
  'RUNNING',
])

export function getSafePaidPackSetupStatus(value: unknown): 'DRAFT' | 'GENERATED' | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim().toUpperCase()
  if (SAFE_PAID_PACK_SETUP_STATUSES.has(normalized)) {
    return normalized as 'DRAFT' | 'GENERATED'
  }
  return undefined
}

export function isUnsafePaidPackStatus(value: unknown): boolean {
  if (typeof value !== 'string') return false
  return UNSAFE_PAID_PACK_STATUSES.has(value.trim().toUpperCase())
}

export function getBudgetTruth({
  amount,
  fallbackAmount,
  explicitBudgetConfirmed,
}: {
  amount: number | null | undefined
  fallbackAmount: number
  explicitBudgetConfirmed?: unknown
}) {
  if (typeof amount === 'number' && Number.isFinite(amount) && amount > 0) {
    const budgetConfirmed = explicitBudgetConfirmed === true

    return {
      amount,
      budgetValuePresent: true,
      budgetSource: budgetConfirmed
        ? EXPLICIT_BUDGET_CONFIRMED_SOURCE
        : BUDGET_VALUE_PRESENT_UNCONFIRMED_SOURCE,
      budgetConfirmed,
    }
  }

  return {
    amount: fallbackAmount,
    budgetValuePresent: false,
    budgetSource: PLANNING_ASSUMPTION_BUDGET_SOURCE,
    budgetConfirmed: false,
  }
}

export function canRecordExternalPaidLaunch({
  requestedStatus,
  explicitExternalLaunchConfirmed,
  metricsProvided,
}: {
  requestedStatus: unknown
  explicitExternalLaunchConfirmed: unknown
  metricsProvided: boolean
}): boolean {
  return (
    typeof requestedStatus === 'string' &&
    requestedStatus.toUpperCase() === 'LAUNCHED' &&
    explicitExternalLaunchConfirmed === true &&
    !metricsProvided
  )
}

export function canRecordPaidCompletion({
  requestedStatus,
  explicitCompletionConfirmed,
  currentStatus,
}: {
  requestedStatus: unknown
  explicitCompletionConfirmed: unknown
  currentStatus?: string | null
}): boolean {
  return (
    typeof requestedStatus === 'string' &&
    requestedStatus.toUpperCase() === 'COMPLETED' &&
    explicitCompletionConfirmed === true &&
    currentStatus === 'LAUNCHED'
  )
}

export function isAnalyticsBackedPaidMetricsSource(source: unknown): boolean {
  return source === 'meta_api' || source === 'api' || source === 'ga4'
}

export function mapPausedPlatformPushStatus(currentStatus: unknown): 'DRAFT' | 'PAUSED' {
  void currentStatus
  return 'PAUSED'
}

export function canActivatePlatformCampaign({
  platform,
  localStatus,
  platformCampaignId,
  platformStatus,
  adAccountHasApiAccess,
  explicitPlatformActivationConfirmed,
  explicitSpendActivationConfirmed,
  explicitBudgetConfirmed,
  explicitExecutionReadinessConfirmed,
  executionReady,
}: {
  platform: unknown
  localStatus: unknown
  platformCampaignId: unknown
  platformStatus: unknown
  adAccountHasApiAccess: unknown
  explicitPlatformActivationConfirmed: unknown
  explicitSpendActivationConfirmed: unknown
  explicitBudgetConfirmed: unknown
  explicitExecutionReadinessConfirmed: unknown
  executionReady: unknown
}): boolean {
  return (
    platform === 'META' &&
    localStatus === 'PAUSED' &&
    typeof platformCampaignId === 'string' &&
    platformCampaignId.trim().length > 0 &&
    platformStatus === 'PAUSED' &&
    adAccountHasApiAccess === true &&
    explicitPlatformActivationConfirmed === true &&
    explicitSpendActivationConfirmed === true &&
    explicitBudgetConfirmed === true &&
    explicitExecutionReadinessConfirmed === true &&
    executionReady === true
  )
}

export function canCreatePlatformDraft({
  explicitPlatformDraftConfirmed,
  explicitBudgetConfirmed,
  explicitExecutionReadinessConfirmed,
  executionReady,
}: {
  explicitPlatformDraftConfirmed: unknown
  explicitBudgetConfirmed: unknown
  explicitExecutionReadinessConfirmed: unknown
  executionReady: unknown
}): boolean {
  return (
    explicitPlatformDraftConfirmed === true &&
    explicitBudgetConfirmed === true &&
    explicitExecutionReadinessConfirmed === true &&
    executionReady === true
  )
}

export function paidMetricsSignalCopy(source: unknown) {
  if (isAnalyticsBackedPaidMetricsSource(source)) {
    return {
      label: 'Analytics-backed paid metrics ready for review',
      canUpdateBrandBrain: true,
    }
  }

  return {
    label: 'Manual paid metrics signal saved for review',
    canUpdateBrandBrain: false,
  }
}
