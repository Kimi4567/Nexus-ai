import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), gate: vi.fn(), rateLimit: vi.fn(), workspace: vi.fn(), page: vi.fn(), active: vi.fn(), create: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mocks.auth }))
vi.mock('@/lib/landingPageExperimentAccess', () => ({ getLandingExperimentGate: mocks.gate }))
vi.mock('@/lib/dbRateLimit', () => ({ dbRateLimit: mocks.rateLimit }))
vi.mock('@/lib/leadCrmAccess', () => ({ findPrimaryLeadWorkspace: mocks.workspace }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    landingPage: { findFirst: mocks.page },
    landingPageExperiment: { findFirst: mocks.active, create: mocks.create },
  },
}))

import { POST } from '@/app/api/landing-pages/[id]/experiments/route'

const context = { params: Promise.resolve({ id: 'page-1' }) }
const snapshot = {
  schemaVersion: 1, publicId: 'public-page-1', locale: 'EN', headline: 'Control', subheadline: null, body: null,
  benefits: [], proof: null,
  primaryCta: { label: 'Start', href: '/lead-form/form-1?lp=public-page-1', kind: 'LEAD_FORM', captureFormPublicId: 'form-1' },
  theme: { variant: 'MIDNIGHT' },
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue('user-1')
  mocks.gate.mockResolvedValue({ ready: true })
  mocks.rateLimit.mockResolvedValue({ ok: true })
  mocks.workspace.mockResolvedValue({ id: 'workspace-1' })
  mocks.page.mockResolvedValue({
    id: 'page-1', campaignId: 'campaign-1', status: 'PUBLISHED', version: 2, publishedVersion: 2,
    publishedSnapshot: snapshot, publishedHash: 'control-hash',
  })
  mocks.active.mockResolvedValue(null)
  mocks.create.mockImplementation(async ({ data }) => ({ id: 'experiment-1', ...data, status: 'DRAFT', version: 1 }))
})

describe('POST landing-page experiment', () => {
  it('creates immutable control and single-field challenger snapshots without starting traffic', async () => {
    const request = new NextRequest('http://localhost/api/landing-pages/page-1/experiments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hypothesis: 'A direct headline increases qualified forms.', variable: 'HEADLINE', challengerValue: 'Challenger', minimumVisitorsPerVariant: 100, minimumConversionsPerVariant: 10 }),
    })
    const response = await POST(request, context)
    expect(response.status).toBe(201)
    expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      controlSnapshot: expect.objectContaining({ headline: 'Control' }),
      challengerSnapshot: expect.objectContaining({ headline: 'Challenger' }),
      successMetric: 'FORM_SUBMITTED',
      decisionRule: 'MANUAL_REVIEW_AFTER_MINIMUM_EVIDENCE',
    }) })
    expect((mocks.create.mock.calls[0][0].data.challengerSnapshot as typeof snapshot).primaryCta.href).toBe(snapshot.primaryCta.href)
  })

  it('requires a clean published lead-form page', async () => {
    mocks.page.mockResolvedValue({ ...await mocks.page(), version: 3, publishedVersion: 2 })
    const response = await POST(new NextRequest('http://localhost/api/landing-pages/page-1/experiments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hypothesis: 'Test', variable: 'HEADLINE', challengerValue: 'Change' }),
    }), context)
    expect(response.status).toBe(409)
    expect(mocks.create).not.toHaveBeenCalled()
  })
})
