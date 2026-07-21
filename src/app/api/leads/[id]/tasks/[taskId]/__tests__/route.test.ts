import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), requested: vi.fn(), readiness: vi.fn(), workspace: vi.fn(), task: vi.fn(),
  transaction: vi.fn(), updateMany: vi.fn(), nextTask: vi.fn(), leadUpdate: vi.fn(), activityCreate: vi.fn(), findUnique: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mocks.auth }))
vi.mock('@/lib/leadCrmReadiness', () => ({
  isLeadCrmRequested: mocks.requested,
  getLeadCrmDatabaseReadiness: mocks.readiness,
  leadCrmUnavailableResponse: () => ({ error: 'Unavailable' }),
}))
vi.mock('@/lib/leadCrmAccess', () => ({ findPrimaryLeadWorkspace: mocks.workspace }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    leadTask: { findFirst: mocks.task, findUnique: mocks.findUnique },
    $transaction: mocks.transaction,
  },
}))

import { PATCH } from '@/app/api/leads/[id]/tasks/[taskId]/route'

const updatedAt = new Date('2026-07-20T12:00:00.000Z')
const dueAt = new Date('2026-07-22T12:00:00.000Z')
beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue('user-1')
  mocks.requested.mockReturnValue(true)
  mocks.readiness.mockResolvedValue({ ready: true })
  mocks.workspace.mockResolvedValue({ id: 'workspace-1' })
  mocks.task.mockResolvedValue({ id: 'task-1', leadId: 'lead-1', status: 'OPEN', updatedAt, dueAt })
  mocks.updateMany.mockResolvedValue({ count: 1 })
  mocks.nextTask.mockResolvedValue({ dueAt: new Date('2026-07-23T12:00:00.000Z') })
  mocks.findUnique.mockResolvedValue({ id: 'task-1', status: 'COMPLETED' })
  mocks.transaction.mockImplementation(async callback => callback({
    leadTask: { updateMany: mocks.updateMany, findFirst: mocks.nextTask },
    lead: { update: mocks.leadUpdate },
    leadActivity: { create: mocks.activityCreate },
  }))
})

const context = { params: Promise.resolve({ id: 'lead-1', taskId: 'task-1' }) }
function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/leads/lead-1/tasks/task-1', {
    method: 'PATCH', headers: { Authorization: 'Bearer session', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}

describe('PATCH /api/leads/[id]/tasks/[taskId]', () => {
  it('completes a task with revision pinning and derives the next open follow-up', async () => {
    const response = await PATCH(request({ status: 'COMPLETED', expectedUpdatedAt: updatedAt.toISOString() }), context)
    expect(response.status).toBe(200)
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: 'task-1', leadId: 'lead-1', status: 'OPEN', updatedAt },
      data: expect.objectContaining({ status: 'COMPLETED', completedAt: expect.any(Date) }),
    })
    expect(mocks.leadUpdate).toHaveBeenCalledWith({
      where: { id: 'lead-1' }, data: expect.objectContaining({ nextFollowUpAt: new Date('2026-07-23T12:00:00.000Z') }),
    })
    expect(mocks.activityCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ type: 'TASK_COMPLETED' }) })
  })

  it('returns a conflict without writing history after a concurrent change', async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 })
    const response = await PATCH(request({ status: 'CANCELLED', expectedUpdatedAt: updatedAt.toISOString() }), context)
    expect(response.status).toBe(409)
    expect(mocks.activityCreate).not.toHaveBeenCalled()
  })
})
