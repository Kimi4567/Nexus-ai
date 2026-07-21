import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), requested: vi.fn(), readiness: vi.fn(), workspace: vi.fn(), leads: vi.fn(), tasks: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mocks.auth }))
vi.mock('@/lib/leadCrmReadiness', () => ({
  isLeadCrmRequested: mocks.requested,
  getLeadCrmDatabaseReadiness: mocks.readiness,
  leadCrmUnavailableResponse: () => ({ error: 'Unavailable' }),
}))
vi.mock('@/lib/leadCrmAccess', () => ({ findPrimaryLeadWorkspace: mocks.workspace }))
vi.mock('@/lib/prisma', () => ({
  prisma: { lead: { findMany: mocks.leads }, leadTask: { findMany: mocks.tasks } },
}))

import { GET } from '@/app/api/leads/alerts/route'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue('user-1')
  mocks.requested.mockReturnValue(true)
  mocks.readiness.mockResolvedValue({ ready: true })
  mocks.workspace.mockResolvedValue({ id: 'workspace-1' })
  mocks.leads.mockResolvedValue([{ id: 'lead-1', responseDueAt: new Date('2026-07-20T10:00:00Z'), stage: 'NEW' }])
  mocks.tasks.mockResolvedValue([{ id: 'task-1', title: 'Call', dueAt: new Date('2026-07-20T11:00:00Z'), priority: 'HIGH', assignedTo: null, lead: { id: 'lead-2', stage: 'QUALIFIED' } }])
})
describe('GET /api/leads/alerts', () => {
  it('returns workspace-scoped SLA facts without triggering outreach', async () => {
    const response = await GET(new NextRequest('http://localhost/api/leads/alerts', { headers: { Authorization: 'Bearer session' } }))
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.summary).toEqual({ total: 2, firstResponse: 1, followUp: 1 })
    expect(body.outreachTriggered).toBe(false)
    expect(mocks.leads).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ workspaceId: 'workspace-1' }) }))
    expect(mocks.tasks).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ lead: { workspaceId: 'workspace-1' } }) }))
  })
})
