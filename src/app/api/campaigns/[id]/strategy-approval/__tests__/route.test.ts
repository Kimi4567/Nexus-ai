import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => {
  class MockStrategyApprovalError extends Error {
    constructor(
      public readonly code: string,
      public readonly status: number,
      public readonly blockers: unknown[] = [],
    ) {
      super(code)
    }
  }

  return {
    StrategyApprovalError: MockStrategyApprovalError,
    getServerUserId: vi.fn(),
    getApprovalContract: vi.fn(),
    approve: vi.fn(),
    revoke: vi.fn(),
    campaignFindFirst: vi.fn(),
    socialPostCount: vi.fn(),
    executeContentPlan: vi.fn(),
  }
})

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mocks.getServerUserId }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    campaign: { findFirst: mocks.campaignFindFirst },
    socialPost: { count: mocks.socialPostCount },
  },
}))
vi.mock('@/lib/credits', () => ({
  getCreditActionPolicy: () => ({
    action: 'CONTENT_PLAN_GENERATION',
    cost: 6,
    pricingVersion: '2026-07',
  }),
}))
vi.mock('@/lib/strategyApprovalService', () => ({
  StrategyApprovalError: mocks.StrategyApprovalError,
  getStrategyApprovalContract: mocks.getApprovalContract,
  approveCampaignStrategy: mocks.approve,
  revokeCampaignStrategyApproval: mocks.revoke,
}))
vi.mock('@/app/api/campaigns/[id]/generate-content-plan/route', () => ({
  executeContentPlanGeneration: mocks.executeContentPlan,
}))

import { POST } from '../route'

const context = { params: Promise.resolve({ id: 'campaign-1' }) }
const approval = { state: 'approved', canApprove: false, canRevoke: true }

function request(
  body: Record<string, unknown>,
  operationKey = 'strategy-content-handoff-123',
) {
  return new NextRequest('http://localhost/api/campaigns/campaign-1/strategy-approval', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token',
      'Content-Type': 'application/json',
      ...(operationKey ? { 'Idempotency-Key': operationKey } : {}),
    },
    body: JSON.stringify(body),
  })
}

function combinedBody(overrides: Record<string, unknown> = {}) {
  return {
    action: 'approve_and_prepare_content',
    expectedStrategyUpdatedAt: '2026-07-29T10:00:00.000Z',
    contentPlanConsent: {
      authorized: true,
      expectedCreditCost: 6,
      language: 'ar',
      mediaSource: 'MIXED',
    },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getServerUserId.mockResolvedValue('user-1')
  mocks.approve.mockResolvedValue({ contract: approval, unchanged: false })
  mocks.campaignFindFirst.mockResolvedValue({ workspaceId: 'workspace-1' })
  mocks.socialPostCount.mockResolvedValue(0)
  mocks.executeContentPlan.mockResolvedValue(NextResponse.json({
    accepted: true,
    reused: false,
    jobId: 'job-1',
    job: { id: 'job-1', status: 'QUEUED' },
  }, {
    status: 202,
    headers: {
      Location: '/api/automation/jobs/job-1',
      'Retry-After': '2',
    },
  }))
})

describe('POST /api/campaigns/[id]/strategy-approval', () => {
  it('requires authentication before recording a decision', async () => {
    mocks.getServerUserId.mockResolvedValueOnce(null)

    const response = await POST(request(combinedBody()), context)

    expect(response.status).toBe(401)
    expect(mocks.approve).not.toHaveBeenCalled()
  })

  it('validates replay protection and exact price consent before approval', async () => {
    const missingKey = await POST(request(combinedBody(), ''), context)
    expect(missingKey.status).toBe(400)
    await expect(missingKey.json()).resolves.toMatchObject({
      error: 'IDEMPOTENCY_KEY_REQUIRED',
    })

    const stalePrice = await POST(request(combinedBody({
      contentPlanConsent: {
        authorized: true,
        expectedCreditCost: 5,
        language: 'en',
        mediaSource: 'MIXED',
      },
    })), context)
    expect(stalePrice.status).toBe(409)
    await expect(stalePrice.json()).resolves.toMatchObject({
      error: 'CREDIT_PRICE_CHANGED',
      currentCost: 6,
    })
    expect(mocks.approve).not.toHaveBeenCalled()
  })

  it('records approval and queues content through one replay-safe server command', async () => {
    const response = await POST(request(combinedBody()), context)
    const body = await response.json()

    expect(response.status).toBe(202)
    expect(response.headers.get('Location')).toBe('/api/automation/jobs/job-1')
    expect(body).toMatchObject({
      approval,
      approvalRecorded: true,
      contentHandoff: {
        state: 'QUEUED_OR_REUSED',
        jobId: 'job-1',
        creditsAuthorized: 6,
        publishAuthorized: false,
        spendAuthorized: false,
      },
    })
    expect(mocks.approve).toHaveBeenCalledWith(
      'campaign-1',
      'user-1',
      'CAMPAIGN_REVIEW',
      '2026-07-29T10:00:00.000Z',
    )
    expect(mocks.executeContentPlan).toHaveBeenCalledTimes(1)
    const [forwardedRequest, campaignId, userId] = mocks.executeContentPlan.mock.calls[0]
    expect(campaignId).toBe('campaign-1')
    expect(userId).toBe('user-1')
    expect(forwardedRequest.headers.get('Idempotency-Key')).toBe('strategy-content-handoff-123')
    expect(forwardedRequest.headers.get('Prefer')).toBe('respond-async')
    await expect(forwardedRequest.json()).resolves.toEqual({
      language: 'ar',
      mediaSource: 'MIXED',
    })
  })

  it('retains existing content without charging or regenerating it', async () => {
    mocks.socialPostCount.mockResolvedValueOnce(8)

    const response = await POST(request(combinedBody()), context)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      approvalRecorded: true,
      contentHandoff: {
        state: 'EXISTING_CONTENT_RETAINED',
        existingContentCount: 8,
        creditsAuthorized: 0,
        publishAuthorized: false,
        spendAuthorized: false,
      },
    })
    expect(mocks.executeContentPlan).not.toHaveBeenCalled()
  })

  it('reports a content failure without hiding the recorded approval', async () => {
    mocks.executeContentPlan.mockResolvedValueOnce(NextResponse.json({
      error: 'AI provider unavailable',
      code: 'AI_PROVIDER_UNAVAILABLE',
      creditsCharged: false,
    }, { status: 503 }))

    const response = await POST(request(combinedBody()), context)

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      error: 'AI provider unavailable',
      code: 'AI_PROVIDER_UNAVAILABLE',
      approval,
      approvalRecorded: true,
      contentHandoff: {
        state: 'NEEDS_RETRY',
        creditsCharged: false,
        publishAuthorized: false,
        spendAuthorized: false,
      },
    })
  })

  it('returns a replayable partial-success contract when the internal handoff throws', async () => {
    mocks.executeContentPlan.mockRejectedValueOnce(new Error('queue connection lost'))

    const response = await POST(request(combinedBody()), context)

    expect(response.status).toBe(503)
    expect(response.headers.get('Retry-After')).toBe('2')
    await expect(response.json()).resolves.toMatchObject({
      error: 'CONTENT_HANDOFF_FAILED',
      approval,
      approvalRecorded: true,
      contentHandoff: {
        state: 'NEEDS_RETRY',
        retryable: true,
        creditsAuthorized: 6,
        publishAuthorized: false,
        spendAuthorized: false,
      },
    })
    expect(mocks.approve).toHaveBeenCalledTimes(1)
  })

  it('keeps the zero-credit approval-only action backward compatible', async () => {
    const response = await POST(request({
      action: 'approve',
      expectedStrategyUpdatedAt: '2026-07-29T10:00:00.000Z',
    }, ''), context)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      approval,
      unchanged: false,
    })
    expect(mocks.socialPostCount).not.toHaveBeenCalled()
    expect(mocks.executeContentPlan).not.toHaveBeenCalled()
  })
})
