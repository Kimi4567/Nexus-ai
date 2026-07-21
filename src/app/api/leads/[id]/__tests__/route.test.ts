import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getServerUserId: vi.fn(),
  leadFindFirst: vi.fn(),
  leadUpdateMany: vi.fn(),
  activityCreateMany: vi.fn(),
  learningCreate: vi.fn(),
  leadDeleteMany: vi.fn(),
  transaction: vi.fn(),
  databaseReadiness: vi.fn(),
  requested: vi.fn(),
  operator: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mocks.getServerUserId }))
vi.mock('@/lib/leadCrmReadiness', () => ({
  getLeadCrmDatabaseReadiness: mocks.databaseReadiness,
  isLeadCrmRequested: mocks.requested,
  leadCrmUnavailableResponse: () => ({ error: 'Unavailable', code: 'LEAD_CRM_DISABLED' }),
}))
vi.mock('@/lib/leadCrmAccess', () => ({
  leadWorkspaceAccessFilter: (userId: string) => ({ OR: [{ ownerId: userId }] }),
  isLeadOperator: mocks.operator,
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    lead: { findFirst: mocks.leadFindFirst },
    $transaction: mocks.transaction,
  },
}))

import { DELETE, PATCH } from '@/app/api/leads/[id]/route'

const updatedAt = new Date('2026-07-20T12:00:00.000Z')
const currentLead = {
  id: 'lead-1', workspaceId: 'workspace-1', stage: 'NEW', score: 10,
  consentStatus: 'UNKNOWN', consentSource: null, consentAt: null,
  lostReason: null, updatedAt, campaign: null, activities: [],
  assignedToId: null, assignedTo: null, responseDueAt: null, firstContactedAt: null, tasks: [],
  convertedAt: null, conversionValue: null, conversionCurrency: null, conversionValueSource: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getServerUserId.mockResolvedValue('user-1')
  mocks.requested.mockReturnValue(true)
  mocks.databaseReadiness.mockResolvedValue({ ready: true, state: 'ready' })
  mocks.operator.mockResolvedValue(true)
  mocks.leadFindFirst.mockResolvedValue(currentLead)
  mocks.leadUpdateMany.mockResolvedValue({ count: 1 })
  mocks.activityCreateMany.mockResolvedValue({ count: 1 })
  mocks.learningCreate.mockResolvedValue({ id: 'event-1' })
  mocks.leadDeleteMany.mockResolvedValue({ count: 1 })
  mocks.transaction.mockImplementation(async callback => callback({
    lead: { updateMany: mocks.leadUpdateMany, deleteMany: mocks.leadDeleteMany },
    leadActivity: { createMany: mocks.activityCreateMany },
    marketingLearningEvent: { create: mocks.learningCreate },
  }))
})

const context = { params: Promise.resolve({ id: 'lead-1' }) }
function patchRequest(body: unknown) {
  return new NextRequest('http://localhost/api/leads/lead-1', {
    method: 'PATCH',
    headers: { Authorization: 'Bearer session', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/leads/[id]', () => {
  it('rejects impossible direct funnel jumps', async () => {
    const response = await PATCH(patchRequest({ stage: 'WON', expectedUpdatedAt: updatedAt.toISOString() }), context)
    const body = await response.json()
    expect(response.status).toBe(409)
    expect(body.code).toBe('INVALID_LEAD_STAGE_TRANSITION')
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('writes an atomic stage event pinned to the reviewed revision', async () => {
    const response = await PATCH(patchRequest({ stage: 'CONTACTED', expectedUpdatedAt: updatedAt.toISOString(), note: 'Called once' }), context)
    expect(response.status).toBe(200)
    expect(mocks.leadUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'lead-1', workspaceId: 'workspace-1', updatedAt },
      data: expect.objectContaining({ stage: 'CONTACTED' }),
    }))
    expect(mocks.activityCreateMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        leadId: 'lead-1', type: 'STAGE_CHANGED', note: 'Called once',
        metadata: { from: 'NEW', to: 'CONTACTED', lostReason: null },
      })],
    })
  })

  it('returns conflict without an event after a concurrent update', async () => {
    mocks.leadUpdateMany.mockResolvedValue({ count: 0 })
    const response = await PATCH(patchRequest({ stage: 'CONTACTED', expectedUpdatedAt: updatedAt.toISOString() }), context)
    expect(response.status).toBe(409)
    expect(mocks.activityCreateMany).not.toHaveBeenCalled()
  })

  it('records accountable ownership and response SLA in the same revision-pinned transaction', async () => {
    const responseDueAt = new Date('2026-07-21T12:00:00.000Z')
    const response = await PATCH(patchRequest({
      assignedToId: 'user-2', responseDueAt: responseDueAt.toISOString(), expectedUpdatedAt: updatedAt.toISOString(),
    }), context)

    expect(response.status).toBe(200)
    expect(mocks.operator).toHaveBeenCalledWith('workspace-1', 'user-1', 'user-2')
    expect(mocks.leadUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ assignedToId: 'user-2', responseDueAt }),
    }))
    expect(mocks.activityCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ type: 'ASSIGNEE_CHANGED', metadata: { from: null, to: 'user-2' } }),
        expect.objectContaining({ type: 'RESPONSE_SLA_CHANGED', metadata: { from: null, to: responseDueAt.toISOString() } }),
      ],
    })
  })

  it('records a WON outcome and optional value as manual evidence in the same transaction', async () => {
    mocks.leadFindFirst.mockResolvedValue({ ...currentLead, stage: 'OPPORTUNITY' })
    const response = await PATCH(patchRequest({
      stage: 'WON', conversionValue: '350.50', conversionCurrency: 'aed',
      expectedUpdatedAt: updatedAt.toISOString(),
    }), context)

    expect(response.status).toBe(200)
    expect(mocks.leadUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        stage: 'WON', conversionValue: '350.50', conversionCurrency: 'AED',
        conversionValueSource: 'MANUAL_CONFIRMED', convertedAt: expect.any(Date),
      }),
    }))
    expect(mocks.activityCreateMany).toHaveBeenCalledWith({ data: expect.arrayContaining([
      expect.objectContaining({ type: 'CONVERSION_RECORDED', metadata: expect.objectContaining({ value: '350.50', currency: 'AED', valueSource: 'MANUAL_CONFIRMED' }) }),
    ]) })
  })

  it('rejects an outcome value without an ISO currency before writing', async () => {
    mocks.leadFindFirst.mockResolvedValue({ ...currentLead, stage: 'OPPORTUNITY' })
    const response = await PATCH(patchRequest({
      stage: 'WON', conversionValue: '350.50', conversionCurrency: 'dirham',
      expectedUpdatedAt: updatedAt.toISOString(),
    }), context)
    expect(response.status).toBe(400)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/leads/[id]', () => {
  it('deletes personal data with a non-PII audit record and revision pin', async () => {
    const response = await DELETE(new NextRequest(`http://localhost/api/leads/lead-1?expectedUpdatedAt=${encodeURIComponent(updatedAt.toISOString())}`, {
      method: 'DELETE', headers: { Authorization: 'Bearer session' },
    }), context)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ ok: true, personalDataDeleted: true })
    expect(mocks.learningCreate).toHaveBeenCalledWith({
      data: {
        workspaceId: 'workspace-1', eventType: 'LEAD_DELETED', source: 'CRM_WORKFLOW', actor: 'USER',
        metadata: { leadId: 'lead-1', personalDataDeleted: true },
      },
    })
    expect(JSON.stringify(mocks.learningCreate.mock.calls[0][0])).not.toContain('person@example.com')
    expect(mocks.leadDeleteMany).toHaveBeenCalledWith({
      where: { id: 'lead-1', workspaceId: 'workspace-1', updatedAt },
    })
  })
})
