import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  userId: vi.fn(),
  gate: vi.fn(),
  workspace: vi.fn(),
  page: vi.fn(),
  form: vi.fn(),
  transaction: vi.fn(),
  updateMany: vi.fn(),
  revisionUpdateMany: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  experimentRequested: vi.fn(),
  experimentGate: vi.fn(),
  activeExperiment: vi.fn(),
  brandProfile: vi.fn(),
  brandUpdateMany: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mocks.userId }))
vi.mock('@/lib/landingPageAccess', () => ({ getLandingPageGate: mocks.gate }))
vi.mock('@/lib/landingPageExperimentReadiness', () => ({ isLandingPageExperimentsRequested: mocks.experimentRequested }))
vi.mock('@/lib/landingPageExperimentAccess', () => ({ getLandingExperimentGate: mocks.experimentGate }))
vi.mock('@/lib/leadCrmAccess', () => ({ findPrimaryLeadWorkspace: mocks.workspace }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    landingPage: { findFirst: mocks.page },
    landingPageExperiment: { findFirst: mocks.activeExperiment },
    leadCaptureForm: { findFirst: mocks.form },
    brandProfile: { findUnique: mocks.brandProfile },
    $transaction: mocks.transaction,
  },
}))

import { POST } from '@/app/api/landing-pages/[id]/publish/route'

const context = { params: Promise.resolve({ id: 'page-1' }) }
const current = {
  id: 'page-1', publicId: 'public-page-1', workspaceId: 'workspace-1', campaignId: 'campaign-1', captureFormId: 'form-1',
  name: 'Campaign page', locale: 'AR', status: 'DRAFT', headline: 'Headline', subheadline: 'Subheadline', body: 'Body',
  benefits: ['One'], proof: null, primaryCtaLabel: 'Start', primaryCtaUrl: null, theme: { variant: 'MIDNIGHT' }, version: 2,
  seoTitle: 'A reviewed campaign offer',
  seoDescription: 'A reviewed and source-grounded description of the campaign offer and the next step for interested visitors.',
  seoIndexable: true,
}

function request(expectedVersion = 2) {
  return new NextRequest('http://localhost/api/landing-pages/page-1/publish', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedVersion }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.userId.mockResolvedValue('user-1')
  mocks.gate.mockResolvedValue({ ready: true })
  mocks.experimentRequested.mockReturnValue(false)
  mocks.experimentGate.mockResolvedValue({ ready: true })
  mocks.activeExperiment.mockResolvedValue(null)
  mocks.brandProfile.mockResolvedValue({ conversionDestination: null })
  mocks.brandUpdateMany.mockResolvedValue({ count: 1 })
  mocks.workspace.mockResolvedValue({ id: 'workspace-1' })
  mocks.page.mockResolvedValue(current)
  mocks.form.mockResolvedValue({ publicId: 'public-form-1', status: 'ACTIVE', campaignId: 'campaign-1' })
  mocks.updateMany.mockResolvedValue({ count: 1 })
  mocks.revisionUpdateMany.mockResolvedValue({ count: 1 })
  mocks.findUniqueOrThrow.mockResolvedValue({ ...current, status: 'PUBLISHED', publishedVersion: 2 })
  mocks.transaction.mockImplementation(async callback => callback({
    landingPage: { updateMany: mocks.updateMany, findUniqueOrThrow: mocks.findUniqueOrThrow },
    landingPageRevision: { updateMany: mocks.revisionUpdateMany },
    brandProfile: { updateMany: mocks.brandUpdateMany },
  }))
})

describe('landing page publication', () => {
  it('publishes exactly the reviewed version as an immutable public snapshot', async () => {
    const response = await POST(request(), context)
    expect(response.status).toBe(200)
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: 'page-1', workspaceId: 'workspace-1', version: 2 },
      data: expect.objectContaining({
        status: 'PUBLISHED',
        publishedVersion: 2,
        publishedSnapshot: expect.objectContaining({
          publicId: 'public-page-1',
          primaryCta: { label: 'Start', href: '/lead-form/public-form-1?lp=public-page-1', kind: 'LEAD_FORM', captureFormPublicId: 'public-form-1' },
          seo: expect.objectContaining({ indexable: true, title: 'A reviewed campaign offer' }),
        }),
        publishedHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        publishedSeoIndexable: true,
        publishedById: 'user-1',
      }),
    })
    expect(mocks.revisionUpdateMany).toHaveBeenCalledWith({
      where: { landingPageId: 'page-1', version: 2 },
      data: { publishedById: 'user-1', publishedAt: expect.any(Date) },
    })
    expect(mocks.brandUpdateMany).toHaveBeenCalledWith({
      where: { workspaceId: 'workspace-1' },
      data: { conversionDestination: expect.stringContaining('/lp/public-page-1') },
    })
    expect(await response.json()).toMatchObject({
      brandDestinationUpdated: true,
      conversionDestination: expect.stringContaining('/lp/public-page-1'),
    })
  })

  it('preserves an existing usable conversion destination', async () => {
    mocks.brandProfile.mockResolvedValue({ conversionDestination: 'https://shop.example/checkout' })
    const response = await POST(request(), context)
    expect(response.status).toBe(200)
    expect(mocks.brandUpdateMany).not.toHaveBeenCalled()
    expect(await response.json()).toMatchObject({ brandDestinationUpdated: false })
  })

  it('fails closed when the editor version is stale', async () => {
    const response = await POST(request(1), context)
    expect(response.status).toBe(409)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('refuses to publish against a paused capture form', async () => {
    mocks.form.mockResolvedValue({ publicId: 'public-form-1', status: 'PAUSED', campaignId: 'campaign-1' })
    const response = await POST(request(), context)
    expect(response.status).toBe(400)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('locks publication while an experiment is running or paused', async () => {
    mocks.experimentRequested.mockReturnValue(true)
    mocks.activeExperiment.mockResolvedValue({ id: 'experiment-1' })
    const response = await POST(request(), context)
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: 'LANDING_EXPERIMENT_PAGE_LOCKED' })
    expect(mocks.form).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})
