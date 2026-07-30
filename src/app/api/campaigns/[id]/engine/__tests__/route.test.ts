/**
 * SAF-D1 — campaign engine credit safety contract.
 *
 * Guarantees:
 * - campaign ownership is checked before credit deduction
 * - Brand Brain readiness is checked before credit deduction
 * - successful strategy run proceeds after the safety gates
 * - provider/AI failure after deduction refunds credits
 * - unlimited-plan users (creditsUsed=0) are never refunded
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

const {
  mockGetServerUserId,
  mockAiRateLimitDb,
  mockCheckAndDeduct,
  mockRefund,
  mockRunEngine,
  mockCampaignFindFirst,
  mockSocialPostCount,
  mockGetBrandBrainReadiness,
  mockIsAiProviderConfigured,
  mockFinalizeCreditDeduction,
  mockFindCampaignEngineJob,
  mockEnqueueCampaignEngineJob,
  mockProcessAutomationJobById,
  mockAfter,
} = vi.hoisted(() => ({
  mockGetServerUserId: vi.fn(),
  mockAiRateLimitDb: vi.fn(),
  mockCheckAndDeduct: vi.fn(),
  mockRefund: vi.fn(),
  mockRunEngine: vi.fn(),
  mockCampaignFindFirst: vi.fn(),
  mockSocialPostCount: vi.fn(),
  mockGetBrandBrainReadiness: vi.fn(),
  mockIsAiProviderConfigured: vi.fn(),
  mockFinalizeCreditDeduction: vi.fn(),
  mockFindCampaignEngineJob: vi.fn(),
  mockEnqueueCampaignEngineJob: vi.fn(),
  mockProcessAutomationJobById: vi.fn(),
  mockAfter: vi.fn(),
}))

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: mockAfter }
})
vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mockGetServerUserId }))
vi.mock('@/lib/dbRateLimit', () => ({ aiRateLimitDb: mockAiRateLimitDb }))
vi.mock('@/lib/billableAiRateLimit', () => ({ enforceBillableAiRateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/credits', () => ({
  checkAndDeductCredits: mockCheckAndDeduct,
  creditCheckHttpStatus: (result: any) => result.error === 'CREDIT_OPERATION_REPLAY' ? 409 : 402,
  finalizeCreditDeduction: mockFinalizeCreditDeduction,
  refundCreditDeduction: vi.fn(async ({ userId, action, deduction }) => {
    if (deduction?.creditsUsed > 0) await mockRefund(userId, action)
  }),
  getCreditActionPolicy: () => ({
    action: 'RUN_FULL_STRATEGY',
    cost: 12,
    label: 'Full marketing strategy',
    reason: 'Creates a reviewed strategy.',
    includedWork: 'One bounded run.',
    providerCallLimit: 2,
    refundableOnNoUsableOutput: true,
  }),
}))
vi.mock('@/lib/campaign-engine', () => ({ runCampaignEngine: mockRunEngine, deriveCampaignEngineState: vi.fn() }))
vi.mock('@/lib/automationJobs/repository', () => ({
  findCampaignEngineJob: mockFindCampaignEngineJob,
  enqueueCampaignEngineJob: mockEnqueueCampaignEngineJob,
}))
vi.mock('@/lib/automationJobs/processor', () => ({
  processAutomationJobById: mockProcessAutomationJobById,
}))
vi.mock('@/lib/brandReadiness', () => ({ getBrandBrainReadiness: mockGetBrandBrainReadiness }))
vi.mock('@/lib/ai/provider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/provider')>()
  return { ...actual, isAiProviderConfigured: mockIsAiProviderConfigured }
})
vi.mock('@/lib/prisma', () => ({
  prisma: {
    campaign: {
      findFirst: mockCampaignFindFirst,
    },
    socialPost: {
      count: mockSocialPostCount,
    },
  },
}))

import { maxDuration, POST } from '../route'

const ctx = { params: Promise.resolve({ id: 'c1' }) }
const makeReq = (body: Record<string, unknown> = {}, async = false) => ({
  json: async () => body,
  headers: {
    get: (name: string) => {
      if (name.toLowerCase() === 'prefer') return async ? 'respond-async' : null
      if (name.toLowerCase() === 'idempotency-key') return 'campaign-engine-operation-123'
      return null
    },
  },
}) as any

const ownedCampaignWithBrand = {
  id: 'c1',
  workspaceId: 'w1',
  workspace: {
    brandProfile: {
      brandName: 'Test Brand',
      industry: 'Food',
      targetAudience: 'Families',
      topPlatforms: ['INSTAGRAM'],
    },
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetServerUserId.mockResolvedValue('u1')
  mockAiRateLimitDb.mockResolvedValue({ ok: true })
  mockCampaignFindFirst.mockResolvedValue(ownedCampaignWithBrand)
  mockSocialPostCount.mockResolvedValue(0)
  mockGetBrandBrainReadiness.mockReturnValue({ ready: true, missingRequired: [], score: 100 })
  mockCheckAndDeduct.mockResolvedValue({ ok: true, creditsUsed: 12, creditsRemaining: 100 })
  mockRefund.mockResolvedValue(undefined)
  mockIsAiProviderConfigured.mockReturnValue(true)
  mockFinalizeCreditDeduction.mockResolvedValue({ ok: true, status: 'settled' })
  mockFindCampaignEngineJob.mockResolvedValue(null)
  mockAfter.mockImplementation(() => undefined)
})

describe('POST /api/campaigns/[id]/engine', () => {
  it('keeps enough runtime headroom to close the credit lifecycle', () => {
    expect(maxDuration).toBe(180)
  })

  it('campaign not found short-circuits before credit deduction', async () => {
    mockCampaignFindFirst.mockResolvedValue(null)

    const res = await POST(makeReq(), ctx)

    expect(res.status).toBe(404)
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockRunEngine).not.toHaveBeenCalled()
  })

  it('missing Brand Brain short-circuits before credit deduction', async () => {
    mockCampaignFindFirst.mockResolvedValue({
      id: 'c1',
      workspaceId: 'w1',
      workspace: { brandProfile: null },
    })

    const res = await POST(makeReq(), ctx)
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error).toBe('NO_BRAND_PROFILE')
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockRunEngine).not.toHaveBeenCalled()
  })

  it('does not rewrite an approved strategy snapshot', async () => {
    mockCampaignFindFirst.mockResolvedValue({ ...ownedCampaignWithBrand, status: 'ACTIVE' })

    const res = await POST(makeReq({ force: true }), ctx)
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.error).toBe('REVOKE_STRATEGY_APPROVAL_FIRST')
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockRunEngine).not.toHaveBeenCalled()
  })

  it('incomplete Brand Brain short-circuits before credit deduction', async () => {
    mockGetBrandBrainReadiness.mockReturnValue({
      ready: false,
      missingRequired: ['targetAudience'],
      score: 40,
    })

    const res = await POST(makeReq(), ctx)
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error).toBe('BRAND_BRAIN_INCOMPLETE')
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockRunEngine).not.toHaveBeenCalled()
  })

  it('successful engine path proceeds after safety gates (200, no refund)', async () => {
    mockRunEngine.mockResolvedValue({ campaign: { id: 'c1' }, engine: { status: 'ready_for_approval', score: 70 } })

    const res = await POST(makeReq(), ctx)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(mockCampaignFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'c1', workspace: { ownerId: 'u1' } },
    }))
    expect(mockCheckAndDeduct).toHaveBeenCalledWith(
      'u1',
      'RUN_FULL_STRATEGY',
      undefined,
      expect.objectContaining({
        entityId: 'c1',
        entityType: 'campaign_strategy_rebuild',
        operationKey: expect.any(String),
      }),
    )
    expect(json.engine.status).toBe('ready_for_approval')
    expect(json.creditsUsed).toBe(12)
    expect(mockRefund).not.toHaveBeenCalled()
  })

  it('queues a durable background job and returns immediately when the UI prefers async work', async () => {
    const queuedJob = {
      id: 'job-1',
      workspaceId: 'w1',
      campaignId: 'c1',
      requestedByUserId: 'u1',
      kind: 'CAMPAIGN_ENGINE',
      status: 'QUEUED',
      idempotencyKey: 'operation-key',
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
    mockEnqueueCampaignEngineJob.mockResolvedValue({ job: queuedJob, created: true })

    const res = await POST(makeReq({}, true), ctx)
    const json = await res.json()

    expect(res.status).toBe(202)
    expect(json).toMatchObject({
      accepted: true,
      reused: false,
      jobId: 'job-1',
      job: { status: 'QUEUED', progress: 10 },
      creditReservation: { creditsReserved: 12, status: 'RESERVED' },
    })
    expect(mockEnqueueCampaignEngineJob).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: 'w1',
      campaignId: 'c1',
      requestedByUserId: 'u1',
      force: false,
    }))
    expect(mockRunEngine).not.toHaveBeenCalled()
    expect(mockAfter).toHaveBeenCalledTimes(1)
  })

  it('reuses an active campaign job before creating another credit reservation', async () => {
    mockFindCampaignEngineJob.mockResolvedValue({
      id: 'job-active',
      workspaceId: 'w1',
      campaignId: 'c1',
      requestedByUserId: 'u1',
      kind: 'CAMPAIGN_ENGINE',
      status: 'RUNNING',
      idempotencyKey: 'operation-key',
      priority: 0,
      input: {},
      output: null,
      currentStep: 'campaign_engine',
      progress: 40,
      attemptCount: 1,
      maxAttempts: 3,
      nextAttemptAt: new Date(),
      leaseToken: 'lease',
      leaseExpiresAt: new Date(Date.now() + 60_000),
      errorCode: null,
      lastError: null,
      startedAt: new Date(),
      completedAt: null,
      cancelledAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const res = await POST(makeReq({}, true), ctx)
    const json = await res.json()

    expect(res.status).toBe(202)
    expect(json).toMatchObject({
      reused: true,
      jobId: 'job-active',
      job: { status: 'RUNNING' },
    })
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockEnqueueCampaignEngineJob).not.toHaveBeenCalled()
  })

  it('provider misconfiguration returns 503 before credit deduction', async () => {
    mockIsAiProviderConfigured.mockReturnValue(false)

    const res = await POST(makeReq({ language: 'en' }), ctx)
    const json = await res.json()

    expect(res.status).toBe(503)
    expect(json.code).toBe('AI_PROVIDER_UNAVAILABLE')
    expect(json.creditsCharged).toBe(false)
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockRunEngine).not.toHaveBeenCalled()
  })

  it('force engine rebuild requires explicit confirmation before credit deduction', async () => {
    const res = await POST(makeReq({ force: true }), ctx)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('ENGINE_REBUILD_CONFIRMATION_REQUIRED')
    expect(json.message).toContain('No credits were spent')
    expect(mockSocialPostCount).not.toHaveBeenCalled()
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockRunEngine).not.toHaveBeenCalled()
  })

  it('force engine rebuild locks progressed campaigns before credit deduction', async () => {
    mockSocialPostCount.mockResolvedValue(2)

    const res = await POST(makeReq({
      force: true,
      explicitEngineRebuildConfirmed: true,
      acknowledgedCreditCost: 12,
      acknowledgedOutputOverwrite: true,
    }), ctx)
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.error).toBe('ENGINE_REBUILD_LOCKED_BY_PROGRESS')
    expect(json.message).toContain('approved, scheduled, or published posts')
    expect(mockSocialPostCount).toHaveBeenCalledWith({
      where: {
        campaignId: 'c1',
        workspaceId: 'w1',
        status: { in: ['APPROVED', 'SCHEDULED', 'PUBLISHED'] },
      },
    })
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockRunEngine).not.toHaveBeenCalled()
  })

  it('provider/AI failure after deduction → 500 + refund + stage:strategy', async () => {
    mockRunEngine.mockRejectedValue(new Error('OpenAI returned invalid JSON'))

    const res = await POST(makeReq(), ctx)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.refunded).toBe(true)
    expect(json.stage).toBe('strategy')
    expect(mockRefund).toHaveBeenCalledTimes(1)
    expect(mockRefund).toHaveBeenCalledWith('u1', 'RUN_FULL_STRATEGY')
  })

  it('does not refund unlimited-plan users (creditsUsed=0) on failure', async () => {
    mockCheckAndDeduct.mockResolvedValue({ ok: true, creditsUsed: 0, creditsRemaining: -1 })
    mockRunEngine.mockRejectedValue(new Error('boom'))

    const res = await POST(makeReq(), ctx)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.refunded).toBe(false)
    expect(mockRefund).not.toHaveBeenCalled()
  })

  it('insufficient credits short-circuits with 402 after ownership/readiness checks and before engine run', async () => {
    mockCheckAndDeduct.mockResolvedValue({ ok: false, error: 'Insufficient credits' })

    const res = await POST(makeReq(), ctx)

    expect(res.status).toBe(402)
    expect(mockCampaignFindFirst).toHaveBeenCalled()
    expect(mockGetBrandBrainReadiness).toHaveBeenCalled()
    expect(mockRunEngine).not.toHaveBeenCalled()
  })
})
