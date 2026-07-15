import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { validPerformanceLearningEvidence } from '@/lib/__tests__/fixtures/performanceLearningEvidence'

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  workspaceFindFirst: vi.fn(),
  brainLearningFindFirst: vi.fn(),
  brandProfileFindUnique: vi.fn(),
  marketingEventFindFirst: vi.fn(),
  brandProfileUpdate: vi.fn(),
  brainLearningUpdate: vi.fn(),
  marketingEventCreate: vi.fn(),
  transaction: vi.fn(),
  snapshotBrandMaturity: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({ getAuthUser: mocks.getAuthUser }))
vi.mock('@/lib/brandMaturity', () => ({ snapshotBrandMaturity: mocks.snapshotBrandMaturity }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: { findFirst: mocks.workspaceFindFirst },
    brainLearning: {
      findFirst: mocks.brainLearningFindFirst,
      update: mocks.brainLearningUpdate,
    },
    brandProfile: {
      findUnique: mocks.brandProfileFindUnique,
      update: mocks.brandProfileUpdate,
    },
    marketingLearningEvent: {
      findFirst: mocks.marketingEventFindFirst,
      create: mocks.marketingEventCreate,
    },
    $transaction: mocks.transaction,
  },
}))

import { PATCH } from '@/app/api/brain/proposals/route'

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/brain/proposals', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getAuthUser.mockResolvedValue({ id: 'user-1' })
  mocks.workspaceFindFirst.mockResolvedValue({ id: 'workspace-1' })
  mocks.snapshotBrandMaturity.mockResolvedValue({ score: 82 })
  mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
    brandProfile: { update: mocks.brandProfileUpdate },
    brainLearning: { update: mocks.brainLearningUpdate },
    marketingLearningEvent: { create: mocks.marketingEventCreate },
  }))
})

describe('PATCH /api/brain/proposals rollback', () => {
  it('removes only decision-added values and records an audit event', async () => {
    mocks.brainLearningFindFirst.mockResolvedValue({
      id: 'proposal-1',
      workspaceId: 'workspace-1',
      trigger: 'post_performance',
      field: 'winningHooks',
      reason: 'Platform-local hook candidates.',
      evidence: validPerformanceLearningEvidence(),
      status: 'accepted',
    })
    mocks.brandProfileFindUnique.mockResolvedValue({
      workspaceId: 'workspace-1',
      winningHooks: ['An existing hook', 'A new evidence-backed hook', 'A later user hook'],
    })
    mocks.marketingEventFindFirst.mockResolvedValue({
      metadata: {
        proposalId: 'proposal-1',
        previousValue: ['An existing hook'],
        appliedValue: ['An existing hook', 'A new evidence-backed hook'],
      },
    })

    const response = await PATCH(request({ proposalId: 'proposal-1', action: 'rollback' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ action: 'rolled_back', field: 'winningHooks' })
    expect(body.removedValues).toEqual(['A new evidence-backed hook'])
    expect(mocks.brandProfileUpdate).toHaveBeenCalledWith({
      where: { workspaceId: 'workspace-1' },
      data: { winningHooks: ['An existing hook', 'A later user hook'] },
    })
    expect(mocks.brainLearningUpdate).toHaveBeenCalledWith({
      where: { id: 'proposal-1' },
      data: { status: 'rolled_back' },
    })
    expect(mocks.marketingEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: 'workspace-1',
        eventType: 'BRAND_LEARNING_ROLLED_BACK',
        metadata: expect.objectContaining({
          proposalId: 'proposal-1',
          removedValues: ['A new evidence-backed hook'],
          affectsExistingApprovedRevisions: false,
        }),
      }),
    })
  })

  it('fails closed when the original acceptance ledger is missing', async () => {
    mocks.brainLearningFindFirst.mockResolvedValue({
      id: 'proposal-1',
      trigger: 'post_performance',
      field: 'winningHooks',
      evidence: validPerformanceLearningEvidence(),
      status: 'accepted',
    })
    mocks.brandProfileFindUnique.mockResolvedValue({ winningHooks: ['A new evidence-backed hook'] })
    mocks.marketingEventFindFirst.mockResolvedValue(null)

    const response = await PATCH(request({ proposalId: 'proposal-1', action: 'rollback' }))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe('ACCEPTANCE_LEDGER_REQUIRED')
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('does not roll back a non-performance proposal through the analytics path', async () => {
    mocks.brainLearningFindFirst.mockResolvedValue({
      id: 'proposal-1',
      trigger: 'approved_content',
      field: 'winningHooks',
      status: 'accepted',
    })

    const response = await PATCH(request({ proposalId: 'proposal-1', action: 'rollback' }))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe('ROLLBACK_NOT_SUPPORTED')
    expect(mocks.brandProfileFindUnique).not.toHaveBeenCalled()
  })
})
