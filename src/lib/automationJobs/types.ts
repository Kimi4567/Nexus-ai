import type { AutomationJob, AutomationJobStatus } from '@prisma/client'
import type { CreditDeductionOk } from '@/lib/credits'

export const CAMPAIGN_ENGINE_JOB_KIND = 'CAMPAIGN_ENGINE' as const
export const CAMPAIGN_APPROVAL_PACKAGE_JOB_KIND = 'CAMPAIGN_APPROVAL_PACKAGE' as const

export const ACTIVE_AUTOMATION_JOB_STATUSES: AutomationJobStatus[] = [
  'PREPARING',
  'QUEUED',
  'RUNNING',
  'RETRY_SCHEDULED',
  'WAITING_FOR_APPROVAL',
]

export const TERMINAL_AUTOMATION_JOB_STATUSES: AutomationJobStatus[] = [
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]

export interface CampaignEngineJobInput {
  schemaVersion: 1
  userId: string
  campaignId: string
  language: string
  force: boolean
  credit: {
    creditsRemaining: number
    creditsUsed: number
    isUnlimited: boolean
    transactionId: string | null
    operationStatus: 'RESERVED'
  }
}

export interface CampaignEngineJobOutput {
  schemaVersion: 1
  campaignId: string
  engine: unknown
  creditsRemaining: number
  creditsUsed: number
  creditFinalization: 'settled' | 'already_settled' | 'noop'
}

export type SerializedCreditDeduction = CampaignEngineJobInput['credit']

export interface CampaignApprovalPackageJobInput {
  schemaVersion: 1
  userId: string
  campaignId: string
  language: string
  mediaSource: 'GENERATE' | 'UPLOAD' | 'MIXED'
  selectedMediaIds: string[] | null
  credit: SerializedCreditDeduction
}

export interface CampaignApprovalPackageSummary {
  total: number
  imagePosts: number
  videoSlots: number
  uploadSlots: number
  platforms: string[]
}

export interface CampaignApprovalPackageJobOutput {
  schemaVersion: 1
  campaignId: string
  packageType: 'CONTENT_AND_MEDIA_DIRECTION'
  summary: CampaignApprovalPackageSummary
  reviewUrl: string
  publishAuthorized: false
  spendAuthorized: false
}

export interface PublicAutomationJob {
  id: string
  kind: string
  status: AutomationJobStatus
  campaignId: string | null
  currentStep: string | null
  progress: number
  attemptCount: number
  maxAttempts: number
  nextAttemptAt: string
  errorCode: string | null
  message: string | null
  output: unknown
  createdAt: string
  updatedAt: string
  startedAt: string | null
  completedAt: string | null
  terminal: boolean
  awaitingApproval: boolean
  canResume: boolean
}

export function serializeCreditDeduction(
  credit: CreditDeductionOk,
): SerializedCreditDeduction {
  return {
    creditsRemaining: credit.creditsRemaining,
    creditsUsed: credit.creditsUsed,
    isUnlimited: credit.isUnlimited,
    transactionId: credit.transactionId ?? null,
    operationStatus: 'RESERVED',
  }
}

export function deserializeCreditDeduction(
  credit: SerializedCreditDeduction,
): CreditDeductionOk {
  return {
    ok: true,
    creditsRemaining: credit.creditsRemaining,
    creditsUsed: credit.creditsUsed,
    isUnlimited: credit.isUnlimited,
    transactionId: credit.transactionId ?? undefined,
    operationStatus: 'RESERVED',
  }
}

function hasSerializedCredit(value: unknown): value is SerializedCreditDeduction {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const credit = value as Record<string, unknown>
  return typeof credit.creditsRemaining === 'number'
    && typeof credit.creditsUsed === 'number'
    && typeof credit.isUnlimited === 'boolean'
    && (credit.transactionId === null || typeof credit.transactionId === 'string')
}

export function isCampaignEngineJobInput(value: unknown): value is CampaignEngineJobInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const input = value as Record<string, unknown>
  const credit = input.credit
  return input.schemaVersion === 1
    && typeof input.userId === 'string'
    && typeof input.campaignId === 'string'
    && typeof input.language === 'string'
    && typeof input.force === 'boolean'
    && hasSerializedCredit(credit)
}

export function isCampaignApprovalPackageJobInput(
  value: unknown,
): value is CampaignApprovalPackageJobInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const input = value as Record<string, unknown>
  return input.schemaVersion === 1
    && typeof input.userId === 'string'
    && typeof input.campaignId === 'string'
    && typeof input.language === 'string'
    && ['GENERATE', 'UPLOAD', 'MIXED'].includes(String(input.mediaSource))
    && (
      input.selectedMediaIds === null
      || (
        Array.isArray(input.selectedMediaIds)
        && input.selectedMediaIds.every(id => typeof id === 'string')
      )
    )
    && hasSerializedCredit(input.credit)
}

export function toPublicAutomationJob(job: AutomationJob): PublicAutomationJob {
  const terminal = TERMINAL_AUTOMATION_JOB_STATUSES.includes(job.status)
  const awaitingApproval = job.status === 'WAITING_FOR_APPROVAL'
  return {
    id: job.id,
    kind: job.kind,
    status: job.status,
    campaignId: job.campaignId,
    currentStep: job.currentStep,
    progress: job.progress,
    attemptCount: job.attemptCount,
    maxAttempts: job.maxAttempts,
    nextAttemptAt: job.nextAttemptAt.toISOString(),
    errorCode: job.errorCode,
    message: job.lastError,
    output: job.output,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    terminal,
    awaitingApproval,
    canResume: job.status === 'QUEUED'
      || job.status === 'RETRY_SCHEDULED'
      || (job.status === 'RUNNING' && Boolean(job.leaseExpiresAt && job.leaseExpiresAt <= new Date())),
  }
}
