import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AiProviderRequestError } from '@/lib/ai/providerFetch'

const mocks = vi.hoisted(() => ({
  runCampaignEngine: vi.fn(),
  finalizeCreditDeduction: vi.fn(),
  refundCreditDeduction: vi.fn(),
  jobStepCreate: vi.fn(),
  jobStepUpdate: vi.fn(),
  jobStepUpdateMany: vi.fn(),
  jobUpdate: vi.fn(),
  jobFindUnique: vi.fn(),
  transaction: vi.fn(),
  socialPostFindMany: vi.fn(),
  executeContentPlanGeneration: vi.fn(),
}))

vi.mock('@/lib/campaign-engine', () => ({ runCampaignEngine: mocks.runCampaignEngine }))
vi.mock('@/app/api/campaigns/[id]/generate-content-plan/route', () => ({
  executeContentPlanGeneration: mocks.executeContentPlanGeneration,
}))
vi.mock('@/lib/credits', () => ({
  finalizeCreditDeduction: mocks.finalizeCreditDeduction,
  refundCreditDeduction: mocks.refundCreditDeduction,
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    automationJobStep: {
      create: mocks.jobStepCreate,
      update: mocks.jobStepUpdate,
      updateMany: mocks.jobStepUpdateMany,
    },
    automationJob: {
      update: mocks.jobUpdate,
      findUnique: mocks.jobFindUnique,
    },
    socialPost: { findMany: mocks.socialPostFindMany },
    $transaction: mocks.transaction,
  },
}))

import {
  isRetryableAutomationError,
  processClaimedAutomationJob,
} from '@/lib/automationJobs/processor'

const baseJob = {
  id: 'job-1',
  workspaceId: 'workspace-1',
  campaignId: 'campaign-1',
  requestedByUserId: 'user-1',
  kind: 'CAMPAIGN_ENGINE',
  status: 'RUNNING',
  idempotencyKey: 'operation-1',
  priority: 0,
  input: {
    schemaVersion: 1,
    userId: 'user-1',
    campaignId: 'campaign-1',
    language: 'ar',
    force: false,
    credit: {
      creditsRemaining: 88,
      creditsUsed: 12,
      isUnlimited: false,
      transactionId: 'credit-1',
      operationStatus: 'RESERVED',
    },
  },
  output: null,
  currentStep: 'campaign_engine',
  progress: 20,
  attemptCount: 1,
  maxAttempts: 3,
  nextAttemptAt: new Date(),
  leaseToken: 'lease-1',
  leaseExpiresAt: new Date(Date.now() + 60_000),
  errorCode: null,
  lastError: null,
  startedAt: new Date(),
  completedAt: null,
  cancelledAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as any

beforeEach(() => {
  vi.clearAllMocks()
  mocks.jobStepCreate.mockResolvedValue({ id: 'step-1' })
  mocks.jobStepUpdateMany.mockResolvedValue({ count: 1 })
  mocks.jobStepUpdate.mockResolvedValue({ id: 'step-1' })
  mocks.transaction.mockImplementation(async (operations: Array<Promise<unknown>>) => Promise.all(operations))
  mocks.finalizeCreditDeduction.mockResolvedValue({ ok: true, status: 'settled' })
  mocks.refundCreditDeduction.mockResolvedValue({ ok: true, status: 'refunded' })
  mocks.socialPostFindMany.mockResolvedValue([])
})

describe('automation job processor', () => {
  it('persists the campaign result and settles the exact reserved credit', async () => {
    mocks.runCampaignEngine.mockResolvedValue({
      campaign: { id: 'campaign-1' },
      engine: { status: 'ready_for_approval', score: 71 },
    })
    mocks.jobUpdate.mockResolvedValue({ ...baseJob, status: 'COMPLETED' })
    mocks.jobFindUnique.mockResolvedValue({ ...baseJob, status: 'COMPLETED', progress: 100 })

    const result = await processClaimedAutomationJob(baseJob)

    expect(result.status).toBe('COMPLETED')
    expect(mocks.finalizeCreditDeduction).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      action: 'RUN_FULL_STRATEGY',
      deduction: expect.objectContaining({ transactionId: 'credit-1', creditsUsed: 12 }),
    }))
    expect(mocks.jobUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'COMPLETED',
        progress: 100,
        currentStep: 'completed',
      }),
    }))
    expect(mocks.refundCreditDeduction).not.toHaveBeenCalled()
  })

  it('schedules a provider retry without refunding or losing the checkpoint', async () => {
    const providerError = new AiProviderRequestError({
      message: 'OpenAI request failed (503).',
      status: 503,
      retryable: true,
      attempts: 3,
      providerName: 'OpenAI',
    })
    mocks.runCampaignEngine.mockRejectedValue(providerError)
    mocks.jobUpdate.mockResolvedValue({ ...baseJob, status: 'RETRY_SCHEDULED' })

    const result = await processClaimedAutomationJob(baseJob)

    expect(result.status).toBe('RETRY_SCHEDULED')
    expect(mocks.jobUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'RETRY_SCHEDULED',
        currentStep: 'waiting_to_retry',
        leaseToken: null,
      }),
    }))
    expect(mocks.refundCreditDeduction).not.toHaveBeenCalled()
  })

  it('refunds the reservation after a permanent failure', async () => {
    mocks.runCampaignEngine.mockRejectedValue(new Error('MARKETING_QUALITY_GATE_BLOCKED'))
    mocks.jobUpdate.mockResolvedValue({ ...baseJob, status: 'FAILED' })

    const result = await processClaimedAutomationJob(baseJob)

    expect(result.status).toBe('FAILED')
    expect(mocks.refundCreditDeduction).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      action: 'RUN_FULL_STRATEGY',
      deduction: expect.objectContaining({ transactionId: 'credit-1' }),
    }))
    expect(mocks.jobUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'FAILED',
        currentStep: 'failed',
        output: expect.objectContaining({ refunded: true, creditsUsed: 0 }),
      }),
    }))
  })

  it('recognizes only transient provider and database failures as retryable', () => {
    expect(isRetryableAutomationError(new AiProviderRequestError({
      message: 'rate limited',
      status: 429,
      retryable: true,
      attempts: 3,
      providerName: 'OpenAI',
    }))).toBe(true)
    expect(isRetryableAutomationError({ code: 'P2024', message: 'pool timeout' })).toBe(true)
    expect(isRetryableAutomationError(new Error('quality contract failed'))).toBe(false)
  })

  it('builds a reviewable content package and stops at explicit approval', async () => {
    const packageJob = {
      ...baseJob,
      kind: 'CAMPAIGN_APPROVAL_PACKAGE',
      input: {
        schemaVersion: 1,
        userId: 'user-1',
        campaignId: 'campaign-1',
        language: 'ar',
        mediaSource: 'MIXED',
        selectedMediaIds: ['media-1'],
        credit: {
          creditsRemaining: 76,
          creditsUsed: 12,
          isUnlimited: false,
          transactionId: 'content-credit-1',
          operationStatus: 'RESERVED',
        },
      },
    }
    mocks.executeContentPlanGeneration.mockResolvedValue(new Response(JSON.stringify({
      success: true,
      summary: {
        total: 8,
        imagePosts: 6,
        videoSlots: 2,
        uploadSlots: 1,
        platforms: ['META', 'LINKEDIN'],
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    mocks.jobUpdate.mockResolvedValue({ ...packageJob, status: 'WAITING_FOR_APPROVAL' })
    mocks.jobFindUnique.mockResolvedValue({
      ...packageJob,
      status: 'WAITING_FOR_APPROVAL',
      currentStep: 'waiting_for_approval',
      progress: 100,
    })

    const result = await processClaimedAutomationJob(packageJob)

    expect(result.status).toBe('WAITING_FOR_APPROVAL')
    expect(mocks.executeContentPlanGeneration).toHaveBeenCalledWith(
      expect.anything(),
      'campaign-1',
      'user-1',
      expect.objectContaining({
        reservedCredit: expect.objectContaining({ transactionId: 'content-credit-1' }),
      }),
    )
    expect(mocks.jobUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'WAITING_FOR_APPROVAL',
        currentStep: 'waiting_for_approval',
        output: expect.objectContaining({
          reviewUrl: '/campaigns/campaign-1/content-hub',
          publishAuthorized: false,
          spendAuthorized: false,
        }),
      }),
    }))
  })
})
