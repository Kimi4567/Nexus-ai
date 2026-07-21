import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), requested: vi.fn(), readiness: vi.fn(), rateLimit: vi.fn(), workspace: vi.fn(),
  findForms: vi.fn(), createForm: vi.fn(), campaign: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mocks.auth }))
vi.mock('@/lib/leadCrmReadiness', () => ({
  isLeadCrmRequested: mocks.requested,
  getLeadCrmDatabaseReadiness: mocks.readiness,
  leadCrmUnavailableResponse: () => ({ error: 'Unavailable' }),
}))
vi.mock('@/lib/dbRateLimit', () => ({ dbRateLimit: mocks.rateLimit }))
vi.mock('@/lib/leadCrmAccess', () => ({ findPrimaryLeadWorkspace: mocks.workspace }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    leadCaptureForm: { findMany: mocks.findForms, create: mocks.createForm },
    campaign: { findFirst: mocks.campaign },
  },
}))

import { GET, POST } from '@/app/api/leads/forms/route'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue('user-1')
  mocks.requested.mockReturnValue(true)
  mocks.readiness.mockResolvedValue({ ready: true })
  mocks.rateLimit.mockResolvedValue({ ok: true })
  mocks.workspace.mockResolvedValue({ id: 'workspace-1' })
  mocks.findForms.mockResolvedValue([])
  mocks.campaign.mockResolvedValue({ id: 'campaign-1' })
  mocks.createForm.mockResolvedValue({ id: 'form-1', publicId: 'public-1', status: 'ACTIVE' })
})

function post(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/leads/forms', {
    method: 'POST', headers: { Authorization: 'Bearer session', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}

describe('/api/leads/forms', () => {
  it('lists only forms from the authenticated workspace', async () => {
    const response = await GET(new NextRequest('http://localhost/api/leads/forms', { headers: { Authorization: 'Bearer session' } }))
    expect(response.status).toBe(200)
    expect(mocks.findForms).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId: 'workspace-1' } }))
  })

  it('creates a campaign-scoped form with a normalized exact origin', async () => {
    const response = await POST(post({
      name: 'Consultation', title: 'Book a consultation', campaignId: 'campaign-1',
      allowedOrigin: 'https://example.com/path', consentStatement: 'I agree to follow-up.',
    }))
    expect(response.status).toBe(201)
    expect(mocks.createForm).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: 'workspace-1', campaignId: 'campaign-1', createdById: 'user-1',
        allowedOrigin: 'https://example.com', status: 'ACTIVE',
      }),
      include: { campaign: { select: { id: true, name: true } } },
    })
  })

  it('rejects unsafe origins before creating a form', async () => {
    const response = await POST(post({ name: 'Form', title: 'Title', allowedOrigin: 'javascript:alert(1)' }))
    expect(response.status).toBe(400)
    expect(mocks.createForm).not.toHaveBeenCalled()
  })
})
