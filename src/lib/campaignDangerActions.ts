export const ENGINE_REBUILD_CREDIT_COST = 8

export const ENGINE_REBUILD_LOCKING_STATUSES = ['APPROVED', 'SCHEDULED', 'PUBLISHED'] as const

export type EngineRebuildLockingStatus = (typeof ENGINE_REBUILD_LOCKING_STATUSES)[number]

export type EngineRebuildAvailabilityReason =
  | 'READY'
  | 'LOCKED_BY_PROGRESS'
  | 'CONFIRMATION_REQUIRED'

export interface EngineRebuildConfirmationInput {
  explicitEngineRebuildConfirmed?: unknown
  acknowledgedCreditCost?: unknown
  acknowledgedOutputOverwrite?: unknown
}

export interface EngineRebuildAvailabilityInput extends EngineRebuildConfirmationInput {
  postStatuses?: Array<string | null | undefined>
}

export function isEngineRebuildLockingStatus(status: string | null | undefined): status is EngineRebuildLockingStatus {
  return ENGINE_REBUILD_LOCKING_STATUSES.includes(String(status || '') as EngineRebuildLockingStatus)
}

export function hasProgressedCampaignPosts(postStatuses: Array<string | null | undefined> = []): boolean {
  return postStatuses.some(isEngineRebuildLockingStatus)
}

export function isEngineRebuildConfirmationComplete(input: EngineRebuildConfirmationInput): boolean {
  return input.explicitEngineRebuildConfirmed === true
    && input.acknowledgedCreditCost === ENGINE_REBUILD_CREDIT_COST
    && input.acknowledgedOutputOverwrite === true
}

export function deriveEngineRebuildAvailability(input: EngineRebuildAvailabilityInput): {
  available: boolean
  reason: EngineRebuildAvailabilityReason
  creditCost: number
} {
  if (hasProgressedCampaignPosts(input.postStatuses)) {
    return {
      available: false,
      reason: 'LOCKED_BY_PROGRESS',
      creditCost: ENGINE_REBUILD_CREDIT_COST,
    }
  }

  if (!isEngineRebuildConfirmationComplete(input)) {
    return {
      available: false,
      reason: 'CONFIRMATION_REQUIRED',
      creditCost: ENGINE_REBUILD_CREDIT_COST,
    }
  }

  return {
    available: true,
    reason: 'READY',
    creditCost: ENGINE_REBUILD_CREDIT_COST,
  }
}
