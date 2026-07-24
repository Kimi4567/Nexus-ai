import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  workspaceFindFirst: vi.fn(),
  raw: vi.fn(),
  monitor: vi.fn(),
  reconcileStaleRuns: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: { findFirst: mocks.workspaceFindFirst },
    $queryRawUnsafe: mocks.raw,
  },
}))
vi.mock('@/lib/executionMonitorService', () => ({ monitorWorkspaceExecution: mocks.monitor }))
vi.mock('@/lib/agents/staleAgentRuns', () => ({ reconcileStaleAgentRuns: mocks.reconcileStaleRuns }))

import { GET } from '@/app/api/cron/agent-monitor/route'

const originalSecret = process.env.CRON_SECRET

function request(path = '/api/cron/agent-monitor', token?: string) {
  return new NextRequest(`http://localhost${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 'cron-secret'
  mocks.workspaceFindFirst.mockResolvedValue({ id: 'w1' })
  mocks.raw.mockResolvedValue([])
  mocks.monitor.mockResolvedValue({
    workspaceId: 'w1',
    campaignsChecked: 2,
    actionsDetected: 1,
    suggestionsCreated: 1,
    suggestionsSuppressed: 0,
    skippedBecauseLocked: false,
    dryRun: true,
    signatures: ['sig'],
  })
  mocks.reconcileStaleRuns.mockResolvedValue({
    cutoff: new Date('2026-07-24T05:15:00.000Z'),
    found: 2,
    reconciled: 0,
    dryRun: true,
  })
})

afterEach(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = originalSecret
})

describe('GET /api/cron/agent-monitor', () => {
  it('fails closed when CRON_SECRET is missing', async () => {
    delete process.env.CRON_SECRET
    const response = await GET(request())
    expect(response.status).toBe(500)
    expect(mocks.monitor).not.toHaveBeenCalled()
  })

  it('rejects an invalid bearer token', async () => {
    const response = await GET(request('/api/cron/agent-monitor', 'wrong'))
    expect(response.status).toBe(401)
    expect(mocks.monitor).not.toHaveBeenCalled()
  })

  it('supports an authenticated, workspace-scoped dry run', async () => {
    const response = await GET(request('/api/cron/agent-monitor?workspaceId=w1&dryRun=1', 'cron-secret'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      monitor: 'execution-truth',
      mode: 'deterministic-no-ai',
      performanceClaims: false,
      autoExecution: false,
      dryRun: true,
      suggestionsCreated: 1,
      staleRuns: {
        found: 2,
        reconciled: 0,
        cutoff: '2026-07-24T05:15:00.000Z',
      },
    })
    expect(mocks.reconcileStaleRuns).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true }))
    expect(mocks.monitor).toHaveBeenCalledWith('w1', expect.objectContaining({ dryRun: true }))
  })
})
