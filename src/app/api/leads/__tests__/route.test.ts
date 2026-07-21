import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getServerUserId: vi.fn(),
  workspaceFindFirst: vi.fn(),
  campaignFindFirst: vi.fn(),
  leadFindFirst: vi.fn(),
  leadFindMany: vi.fn(),
  leadGroupBy: vi.fn(),
  leadCount: vi.fn(),
  leadCreate: vi.fn(),
  activityCreate: vi.fn(),
  transaction: vi.fn(),
  databaseReadiness: vi.fn(),
  requested: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mocks.getServerUserId }))
vi.mock('@/lib/leadCrmReadiness', () => ({
  getLeadCrmDatabaseReadiness: mocks.databaseReadiness,
  isLeadCrmRequested: mocks.requested,
  leadCrmUnavailableResponse: () => ({ error: 'Unavailable', code: 'LEAD_CRM_DISABLED' }),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: { findFirst: mocks.workspaceFindFirst },
    campaign: { findFirst: mocks.campaignFindFirst },
    lead: {
      findFirst: mocks.leadFindFirst,
      findMany: mocks.leadFindMany,
      groupBy: mocks.leadGroupBy,
      count: mocks.leadCount,
    },
    $transaction: mocks.transaction,
  },
}))

import { GET, POST } from '@/app/api/leads/route'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getServerUserId.mockResolvedValue('user-1')
  mocks.requested.mockReturnValue(true)
  mocks.databaseReadiness.mockResolvedValue({ ready: true, state: 'ready' })
  mocks.workspaceFindFirst.mockResolvedValue({ id: 'workspace-1', ownerId: 'user-1', members: [] })
  mocks.leadFindFirst.mockResolvedValue(null)
  mocks.campaignFindFirst.mockResolvedValue({ id: 'campaign-1' })
  mocks.leadCreate.mockResolvedValue({ id: 'lead-1', email: 'Person@Example.com', campaign: null })
  mocks.activityCreate.mockResolvedValue({ id: 'activity-1' })
  mocks.leadCount.mockResolvedValue(0)
  mocks.transaction.mockImplementation(async callback => callback({
    lead: { create: mocks.leadCreate },
    leadActivity: { create: mocks.activityCreate },
  }))
})

function postRequest(body: unknown) {
  return new NextRequest('http://localhost/api/leads', {
    method: 'POST',
    headers: { Authorization: 'Bearer session', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/leads', () => {
  it('creates a workspace-scoped lead and activity with normalized deduplication evidence', async () => {
    const response = await POST(postRequest({
      fullName: 'Person One',
      email: ' Person@Example.COM ',
      source: 'MANUAL',
      campaignId: 'campaign-1',
      consentStatus: 'GRANTED',
      consentSource: 'Website checkbox v1',
      attribution: { source: 'google', medium: 'cpc', secret: 'drop-me' },
    }))

    expect(response.status).toBe(201)
    expect(mocks.campaignFindFirst).toHaveBeenCalledWith({
      where: { id: 'campaign-1', workspaceId: 'workspace-1' },
      select: { id: true },
    })
    expect(mocks.leadCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        workspaceId: 'workspace-1',
        assignedToId: 'user-1',
        emailNormalized: 'person@example.com',
        consentStatus: 'GRANTED',
        responseDueAt: expect.any(Date),
        attribution: { source: 'google', medium: 'cpc' },
      }),
    }))
    expect(mocks.activityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        leadId: 'lead-1', type: 'CREATED', actor: 'USER',
        metadata: expect.objectContaining({ campaignId: 'campaign-1', assignedToId: 'user-1', consentStatus: 'GRANTED' }),
      }),
    })
  })

  it('never infers granted consent from contact information', async () => {
    await POST(postRequest({ email: 'person@example.com' }))
    expect(mocks.leadCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ consentStatus: 'UNKNOWN', consentAt: null }),
    }))
  })

  it('rejects granted consent without evidence source', async () => {
    const response = await POST(postRequest({ email: 'person@example.com', consentStatus: 'GRANTED' }))
    expect(response.status).toBe(400)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('returns the existing workspace lead instead of creating a duplicate', async () => {
    mocks.leadFindFirst.mockResolvedValue({ id: 'existing-lead' })
    const response = await POST(postRequest({ email: 'person@example.com' }))
    const body = await response.json()
    expect(response.status).toBe(409)
    expect(body).toMatchObject({ code: 'LEAD_DUPLICATE', existingLeadId: 'existing-lead' })
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})

describe('GET /api/leads', () => {
  it('scopes search and stage summaries to the authenticated workspace', async () => {
    mocks.leadFindMany.mockResolvedValue([{ id: 'lead-1', stage: 'NEW' }])
    mocks.leadGroupBy.mockResolvedValue([{ stage: 'NEW', _count: { _all: 1 } }])
    mocks.leadCount.mockResolvedValue(1)

    const response = await GET(new NextRequest('http://localhost/api/leads?stage=NEW&q=person', {
      headers: { Authorization: 'Bearer session' },
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.summary.total).toBe(1)
    expect(body.summary.overdueResponseCount).toBe(1)
    expect(mocks.leadFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ workspaceId: 'workspace-1', stage: 'NEW' }),
    }))
    expect(mocks.leadGroupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: { workspaceId: 'workspace-1' },
    }))
  })
})
