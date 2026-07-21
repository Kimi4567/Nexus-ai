import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), requested: vi.fn(), readiness: vi.fn(), workspace: vi.fn(), operator: vi.fn(),
  lead: vi.fn(), transaction: vi.fn(), taskCreate: vi.fn(), leadUpdate: vi.fn(), activityCreate: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mocks.auth }))
vi.mock('@/lib/leadCrmReadiness', () => ({
  isLeadCrmRequested: mocks.requested,
  getLeadCrmDatabaseReadiness: mocks.readiness,
  leadCrmUnavailableResponse: () => ({ error: 'Unavailable' }),
}))
vi.mock('@/lib/leadCrmAccess', () => ({
  findPrimaryLeadWorkspace: mocks.workspace,
  isLeadOperator: mocks.operator,
}))
vi.mock('@/lib/prisma', () => ({
  prisma: { lead: { findFirst: mocks.lead }, $transaction: mocks.transaction },
}))

import { POST } from '@/app/api/leads/[id]/tasks/route'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue('user-1')
  mocks.requested.mockReturnValue(true)
  mocks.readiness.mockResolvedValue({ ready: true })
  mocks.workspace.mockResolvedValue({ id: 'workspace-1' })
  mocks.operator.mockResolvedValue(true)
  mocks.lead.mockResolvedValue({ id: 'lead-1', assignedToId: 'user-1', nextFollowUpAt: null })
  mocks.taskCreate.mockResolvedValue({ id: 'task-1', title: 'Discovery call' })
  mocks.transaction.mockImplementation(async callback => callback({
    leadTask: { create: mocks.taskCreate },
    lead: { update: mocks.leadUpdate },
    leadActivity: { create: mocks.activityCreate },
  }))
})

const context = { params: Promise.resolve({ id: 'lead-1' }) }
function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/leads/lead-1/tasks', {
    method: 'POST', headers: { Authorization: 'Bearer session', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}

describe('POST /api/leads/[id]/tasks', () => {
  it('creates an assigned follow-up and updates the lead next-action time atomically', async () => {
    const dueAt = new Date(Date.now() + 48 * 60 * 60_000)
    const response = await POST(request({ title: 'Discovery call', dueAt: dueAt.toISOString(), priority: 'HIGH' }), context)

    expect(response.status).toBe(201)
    expect(mocks.taskCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ leadId: 'lead-1', assignedToId: 'user-1', createdById: 'user-1', priority: 'HIGH', dueAt }),
      include: { assignedTo: { select: { id: true, name: true, email: true } } },
    })
    expect(mocks.leadUpdate).toHaveBeenCalledWith({ where: { id: 'lead-1' }, data: expect.objectContaining({ nextFollowUpAt: dueAt }) })
    expect(mocks.activityCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ type: 'TASK_CREATED' }) })
  })

  it('rejects a past due date before opening a transaction', async () => {
    const response = await POST(request({ title: 'Late task', dueAt: '2020-01-01T00:00:00.000Z' }), context)
    expect(response.status).toBe(400)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})
