import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  userId: vi.fn(),
  gate: vi.fn(),
  rateLimit: vi.fn(),
  workspace: vi.fn(),
  campaign: vi.fn(),
  form: vi.fn(),
  transaction: vi.fn(),
  pageCreate: vi.fn(),
  revisionCreate: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mocks.userId }))
vi.mock('@/lib/landingPageAccess', () => ({ getLandingPageGate: mocks.gate }))
vi.mock('@/lib/dbRateLimit', () => ({ dbRateLimit: mocks.rateLimit }))
vi.mock('@/lib/leadCrmAccess', () => ({ findPrimaryLeadWorkspace: mocks.workspace }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    campaign: { findFirst: mocks.campaign },
    leadCaptureForm: { findFirst: mocks.form },
    $transaction: mocks.transaction,
  },
}))

import { POST } from '@/app/api/landing-pages/route'

function request(overrides: Record<string, unknown> = {}) {
  return new NextRequest('http://localhost/api/landing-pages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Campaign page', campaignId: 'campaign-1', captureFormId: 'form-1', locale: 'EN', headline: 'A useful offer',
      subheadline: null, body: null, benefits: ['Clear scope'], proof: null, primaryCtaLabel: 'Start', primaryCtaUrl: null,
      theme: { variant: 'IVORY' }, seoTitle: null, seoDescription: null, seoIndexable: false, ...overrides,
    }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.userId.mockResolvedValue('user-1')
  mocks.gate.mockResolvedValue({ ready: true })
  mocks.rateLimit.mockResolvedValue({ ok: true })
  mocks.workspace.mockResolvedValue({ id: 'workspace-1' })
  mocks.campaign.mockResolvedValue({ id: 'campaign-1' })
  mocks.form.mockResolvedValue({ id: 'form-1', campaignId: 'campaign-1' })
  mocks.pageCreate.mockResolvedValue({ id: 'page-1', publicId: 'public-page-1', version: 1 })
  mocks.revisionCreate.mockResolvedValue({ id: 'revision-1' })
  mocks.transaction.mockImplementation(async callback => callback({
    landingPage: { create: mocks.pageCreate },
    landingPageRevision: { create: mocks.revisionCreate },
  }))
})

describe('POST /api/landing-pages', () => {
  it('creates a workspace-scoped draft and its first revision atomically', async () => {
    const response = await POST(request())
    expect(response.status).toBe(201)
    expect(mocks.pageCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: 'workspace-1', campaignId: 'campaign-1', captureFormId: 'form-1', createdById: 'user-1', seoIndexable: false,
      }),
    })
    expect(mocks.revisionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ landingPageId: 'page-1', version: 1, changeNote: 'Initial draft', createdById: 'user-1' }),
    })
  })

  it('rejects an indexing request without complete search metadata', async () => {
    const response = await POST(request({ seoIndexable: true }))
    expect(response.status).toBe(400)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('rejects a capture form from another campaign before writing', async () => {
    mocks.form.mockResolvedValue({ id: 'form-1', campaignId: 'campaign-2' })
    const response = await POST(request())
    expect(response.status).toBe(400)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})
