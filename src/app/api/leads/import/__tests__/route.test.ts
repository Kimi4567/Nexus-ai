import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  requested: vi.fn(),
  readiness: vi.fn(),
  rateLimit: vi.fn(),
  workspace: vi.fn(),
  operator: vi.fn(),
  campaign: vi.fn(),
  existing: vi.fn(),
  transaction: vi.fn(),
  createLead: vi.fn(),
  createActivity: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mocks.auth }))
vi.mock('@/lib/leadCrmReadiness', () => ({
  isLeadCrmRequested: mocks.requested,
  getLeadCrmDatabaseReadiness: mocks.readiness,
  leadCrmUnavailableResponse: () => ({ error: 'Unavailable', code: 'LEAD_CRM_DISABLED' }),
}))
vi.mock('@/lib/dbRateLimit', () => ({ dbRateLimit: mocks.rateLimit }))
vi.mock('@/lib/leadCrmAccess', () => ({
  findPrimaryLeadWorkspace: mocks.workspace,
  isLeadOperator: mocks.operator,
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    campaign: { findFirst: mocks.campaign },
    lead: { findMany: mocks.existing },
    $transaction: mocks.transaction,
  },
}))

import { POST } from '@/app/api/leads/import/route'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue('user-1')
  mocks.requested.mockReturnValue(true)
  mocks.readiness.mockResolvedValue({ ready: true })
  mocks.rateLimit.mockResolvedValue({ ok: true, remaining: 9 })
  mocks.workspace.mockResolvedValue({ id: 'workspace-1', ownerId: 'user-1' })
  mocks.operator.mockResolvedValue(true)
  mocks.campaign.mockResolvedValue({ id: 'campaign-1' })
  mocks.existing.mockResolvedValue([])
  mocks.createLead.mockResolvedValue({ id: 'lead-1', email: 'person@example.com', phone: null })
  mocks.createActivity.mockResolvedValue({ id: 'activity-1' })
  mocks.transaction.mockImplementation(async callback => callback({
    lead: { create: mocks.createLead },
    leadActivity: { create: mocks.createActivity },
  }))
})

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/leads/import', {
    method: 'POST',
    headers: { Authorization: 'Bearer session', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/leads/import', () => {
  it('dry-runs against workspace duplicates without writing rows', async () => {
    mocks.existing.mockResolvedValue([{ emailNormalized: 'person@example.com', phoneNormalized: null }])
    const response = await POST(request({ csv: 'email\nperson@example.com', dryRun: true }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ dryRun: true, readyRows: 0, rejectedRows: 1 })
    expect(body.issues[0].code).toBe('DUPLICATE_IN_WORKSPACE')
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('imports valid rows atomically with assignment, SLA, and audit evidence', async () => {
    const response = await POST(request({
      csv: 'full_name,email,consent_status\nPerson,person@example.com,UNKNOWN',
      campaignId: 'campaign-1',
      assignedToId: 'user-1',
    }))

    expect(response.status).toBe(201)
    expect(mocks.createLead).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: 'workspace-1',
        campaignId: 'campaign-1',
        assignedToId: 'user-1',
        source: 'IMPORT',
        consentStatus: 'UNKNOWN',
        consentAt: null,
        responseDueAt: expect.any(Date),
      }),
      select: { id: true, fullName: true, email: true, phone: true },
    })
    expect(mocks.createActivity).toHaveBeenCalledWith({
      data: expect.objectContaining({ leadId: 'lead-1', type: 'CREATED', actor: 'IMPORT' }),
    })
  })

  it('rate-limits repeated imports before parsing or querying workspace data', async () => {
    mocks.rateLimit.mockResolvedValue({ ok: false, message: 'Try later' })
    const response = await POST(request({ csv: 'email\nperson@example.com' }))
    expect(response.status).toBe(429)
    expect(mocks.workspace).not.toHaveBeenCalled()
  })
})
