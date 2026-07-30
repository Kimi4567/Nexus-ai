import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  updateMany: vi.fn(),
  queryRaw: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    automationJob: {
      findUnique: mocks.findUnique,
      findFirst: mocks.findFirst,
      create: mocks.create,
      updateMany: mocks.updateMany,
    },
    $queryRaw: mocks.queryRaw,
  },
}))

import {
  claimAutomationJobById,
  claimNextAutomationJob,
  enqueueCampaignApprovalPackageJob,
  enqueueCampaignEngineJob,
} from '@/lib/automationJobs/repository'

const job = {
  id: 'job-1',
  workspaceId: 'workspace-1',
  campaignId: 'campaign-1',
  requestedByUserId: 'user-1',
  kind: 'CAMPAIGN_ENGINE',
  status: 'QUEUED',
  idempotencyKey: 'operation-1',
  priority: 0,
  input: {},
  output: null,
  currentStep: 'queued',
  progress: 10,
  attemptCount: 0,
  maxAttempts: 3,
  nextAttemptAt: new Date(),
  leaseToken: null,
  leaseExpiresAt: null,
  errorCode: null,
  lastError: null,
  startedAt: null,
  completedAt: null,
  cancelledAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

beforeEach(() => vi.clearAllMocks())

describe('automation job repository', () => {
  it('enqueues a campaign job with an ownership-scoped idempotency key', async () => {
    mocks.findUnique.mockResolvedValue(null)
    mocks.findFirst.mockResolvedValue(null)
    mocks.create.mockResolvedValue(job)

    const result = await enqueueCampaignEngineJob({
      workspaceId: 'workspace-1',
      campaignId: 'campaign-1',
      requestedByUserId: 'user-1',
      idempotencyKey: 'operation-1',
      language: 'ar',
      force: false,
      credit: {
        creditsRemaining: 88,
        creditsUsed: 12,
        isUnlimited: false,
        transactionId: 'credit-1',
        operationStatus: 'RESERVED',
      },
    })

    expect(result).toEqual({ job, created: true })
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        workspaceId: 'workspace-1',
        campaignId: 'campaign-1',
        kind: 'CAMPAIGN_ENGINE',
        status: 'QUEUED',
        idempotencyKey: 'operation-1',
        progress: 10,
      }),
    }))
  })

  it('returns the existing operation without creating a duplicate', async () => {
    mocks.findUnique.mockResolvedValue(job)

    const result = await enqueueCampaignEngineJob({
      workspaceId: 'workspace-1',
      campaignId: 'campaign-1',
      requestedByUserId: 'user-1',
      idempotencyKey: 'operation-1',
      language: 'ar',
      force: false,
      credit: {
        creditsRemaining: 88,
        creditsUsed: 12,
        isUnlimited: false,
        transactionId: 'credit-1',
        operationStatus: 'RESERVED',
      },
    })

    expect(result).toEqual({ job, created: false })
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('enqueues one durable content and media-direction approval package', async () => {
    mocks.findUnique.mockResolvedValue(null)
    mocks.findFirst.mockResolvedValue(null)
    const packageJob = { ...job, kind: 'CAMPAIGN_APPROVAL_PACKAGE' }
    mocks.create.mockResolvedValue(packageJob)

    const result = await enqueueCampaignApprovalPackageJob({
      workspaceId: 'workspace-1',
      campaignId: 'campaign-1',
      requestedByUserId: 'user-1',
      idempotencyKey: 'content-operation-1',
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
    })

    expect(result).toEqual({ job: packageJob, created: true })
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        kind: 'CAMPAIGN_APPROVAL_PACKAGE',
        status: 'QUEUED',
        input: expect.objectContaining({
          mediaSource: 'MIXED',
          selectedMediaIds: ['media-1'],
        }),
      }),
    }))
  })

  it('claims a specific due job with an expiring worker lease', async () => {
    mocks.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 })
    mocks.findFirst.mockResolvedValue({ ...job, status: 'RUNNING', leaseToken: 'lease' })

    const claimed = await claimAutomationJobById('job-1', {
      now: new Date('2026-07-29T00:00:00.000Z'),
      leaseMs: 60_000,
    })

    expect(claimed?.status).toBe('RUNNING')
    expect(mocks.updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({ id: 'job-1' }),
      data: expect.objectContaining({
        status: 'RUNNING',
        attemptCount: { increment: 1 },
      }),
    }))
  })

  it('uses SKIP LOCKED when cron workers claim the next queue row', async () => {
    mocks.queryRaw.mockResolvedValue([job])

    await expect(claimNextAutomationJob({
      now: new Date('2026-07-29T00:00:00.000Z'),
    })).resolves.toEqual(job)

    const query = mocks.queryRaw.mock.calls[0][0] as { strings?: string[] }
    expect(query.strings?.join('?')).toContain('FOR UPDATE SKIP LOCKED')
  })
})
