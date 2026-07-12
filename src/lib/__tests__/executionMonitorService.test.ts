import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    agentSuggestion: { findMany: vi.fn(), createMany: vi.fn() },
    agentRun: { create: vi.fn() },
  }
  return {
    tx,
    transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    getTruth: vi.fn(),
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: mocks.transaction } }))
vi.mock('@/lib/executionTruthService', () => ({
  getWorkspaceExecutionTruthByWorkspaceId: mocks.getTruth,
}))

import { monitorWorkspaceExecution } from '@/lib/executionMonitorService'

const posts = { draft: 1, approved: 0, scheduled: 0, published: 0, failed: 0, publishedWithoutAnalytics: 0 }
const truth = {
  version: 1,
  generatedAt: '2026-07-12T12:00:00.000Z',
  summary: { campaigns: 1, needsAttention: 0, awaitingApproval: 1, scheduledPosts: 0, publishedPosts: 0 },
  queue: [{
    id: 'c1:REVIEW_CONTENT',
    campaignId: 'c1',
    campaignName: 'Launch',
    kind: 'REVIEW_CONTENT',
    stage: 'CONTENT_REVIEW',
    priority: 'high',
    safety: 'review_required',
    requiresApproval: true,
    href: '/campaigns/c1/content-hub',
    title: { en: 'Review draft content', ar: 'راجع المسودات' },
    reason: { en: 'One draft needs approval.', ar: 'مسودة تحتاج اعتماداً.' },
    evidence: { campaignStatus: 'ACTIVE', strategyApprovalState: 'approved', posts },
    updatedAt: '2026-07-12T12:00:00.000Z',
  }],
  campaigns: [{ campaignId: 'c1' }],
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getTruth.mockResolvedValue(truth)
  mocks.tx.$queryRaw.mockResolvedValue([{ locked: true }])
  mocks.tx.agentSuggestion.findMany.mockResolvedValue([])
  mocks.tx.agentRun.create.mockResolvedValue({ id: 'run-1' })
  mocks.tx.agentSuggestion.createMany.mockResolvedValue({ count: 1 })
})

describe('execution monitor service', () => {
  it('supports a write-free dry run', async () => {
    const result = await monitorWorkspaceExecution('w1', { dryRun: true })
    expect(result).toMatchObject({ actionsDetected: 1, suggestionsCreated: 0, dryRun: true })
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('uses one lock, one dedupe query, and one batch insert', async () => {
    const now = new Date('2026-07-12T13:00:00.000Z')
    const result = await monitorWorkspaceExecution('w1', { now })

    expect(result.suggestionsCreated).toBe(1)
    expect(mocks.tx.$queryRaw).toHaveBeenCalledTimes(1)
    expect(mocks.tx.agentSuggestion.findMany).toHaveBeenCalledTimes(1)
    expect(mocks.tx.agentSuggestion.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        workspaceId: 'w1',
        campaignId: 'c1',
        status: 'PENDING',
        payload: expect.objectContaining({ performanceClaim: false, autoExecution: false }),
      })],
    })
  })

  it('suppresses an equivalent pending or recently resolved suggestion', async () => {
    mocks.tx.agentSuggestion.findMany.mockResolvedValue([{
      campaignId: 'c1',
      title: 'Review draft content',
      payload: { signature: 'execution:v1:c1:REVIEW_CONTENT:CONTENT_REVIEW' },
    }])

    const result = await monitorWorkspaceExecution('w1')

    expect(result).toMatchObject({ suggestionsCreated: 0, suggestionsSuppressed: 1 })
    expect(mocks.tx.agentRun.create).not.toHaveBeenCalled()
    expect(mocks.tx.agentSuggestion.createMany).not.toHaveBeenCalled()
  })

  it('skips immediately when another monitor owns the workspace lock', async () => {
    mocks.tx.$queryRaw.mockResolvedValue([{ locked: false }])
    const result = await monitorWorkspaceExecution('w1')
    expect(result.skippedBecauseLocked).toBe(true)
    expect(mocks.tx.agentSuggestion.findMany).not.toHaveBeenCalled()
  })
})
