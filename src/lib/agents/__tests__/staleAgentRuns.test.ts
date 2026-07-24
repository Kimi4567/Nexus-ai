import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  updateMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    agentRun: {
      count: mocks.count,
      updateMany: mocks.updateMany,
    },
  },
}))

import {
  reconcileStaleAgentRuns,
  STALE_AGENT_RUN_ERROR,
} from '@/lib/agents/staleAgentRuns'

const now = new Date('2026-07-24T05:30:00.000Z')
const cutoff = new Date('2026-07-24T05:15:00.000Z')

beforeEach(() => {
  vi.clearAllMocks()
  mocks.count.mockResolvedValue(2)
  mocks.updateMany.mockResolvedValue({ count: 2 })
})

describe('stale AgentRun reconciliation', () => {
  it('reports stale rows without mutating them in dry-run mode', async () => {
    const result = await reconcileStaleAgentRuns({ now, dryRun: true })

    expect(result).toEqual({ cutoff, found: 2, reconciled: 0, dryRun: true })
    expect(mocks.count).toHaveBeenCalledWith({
      where: { status: 'RUNNING', createdAt: { lte: cutoff } },
    })
    expect(mocks.updateMany).not.toHaveBeenCalled()
  })

  it('atomically closes every expired RUNNING lease as FAILED', async () => {
    const result = await reconcileStaleAgentRuns({ now })

    expect(result).toEqual({ cutoff, found: 2, reconciled: 2, dryRun: false })
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { status: 'RUNNING', createdAt: { lte: cutoff } },
      data: {
        status: 'FAILED',
        completedAt: now,
        error: STALE_AGENT_RUN_ERROR,
      },
    })
    expect(mocks.count).not.toHaveBeenCalled()
  })
})
