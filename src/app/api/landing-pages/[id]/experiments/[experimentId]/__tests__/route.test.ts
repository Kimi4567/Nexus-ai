import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), gate: vi.fn(), workspace: vi.fn(), experiment: vi.fn(), page: vi.fn(), groupBy: vi.fn(),
  transaction: vi.fn(), experimentUpdate: vi.fn(), experimentFinal: vi.fn(), pageUpdate: vi.fn(), revisionCreate: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mocks.auth }))
vi.mock('@/lib/landingPageExperimentAccess', () => ({ getLandingExperimentGate: mocks.gate }))
vi.mock('@/lib/leadCrmAccess', () => ({ findPrimaryLeadWorkspace: mocks.workspace }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    landingPageExperiment: { findFirst: mocks.experiment },
    landingPage: { findFirst: mocks.page },
    conversionEvent: { groupBy: mocks.groupBy },
    $transaction: mocks.transaction,
  },
}))

import { PATCH } from '@/app/api/landing-pages/[id]/experiments/[experimentId]/route'

const context = { params: Promise.resolve({ id: 'page-1', experimentId: 'experiment-1' }) }
const publicSnapshot = {
  schemaVersion: 1, publicId: 'public-page-1', locale: 'EN', headline: 'Control', subheadline: null, body: null,
  benefits: [], proof: null,
  primaryCta: { label: 'Start', href: '/lead-form/form-1?lp=public-page-1', kind: 'LEAD_FORM', captureFormPublicId: 'form-1' },
  theme: { variant: 'MIDNIGHT' },
}
const experiment = {
  id: 'experiment-1', workspaceId: 'workspace-1', landingPageId: 'page-1', campaignId: 'campaign-1',
  status: 'PAUSED', version: 2, variable: 'HEADLINE', controlHash: 'control-hash',
  challengerSnapshot: { ...publicSnapshot, headline: 'Challenger' },
  minimumVisitorsPerVariant: 100, minimumConversionsPerVariant: 10,
}
const page = {
  id: 'page-1', workspaceId: 'workspace-1', campaignId: 'campaign-1', captureFormId: 'form-1',
  status: 'PUBLISHED', version: 2, publishedVersion: 2, publishedHash: 'control-hash',
  name: 'Page', locale: 'EN', headline: 'Control', subheadline: null, body: null, benefits: [], proof: null,
  primaryCtaLabel: 'Start', primaryCtaUrl: null, theme: { variant: 'MIDNIGHT' },
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue('user-1')
  mocks.gate.mockResolvedValue({ ready: true })
  mocks.workspace.mockResolvedValue({ id: 'workspace-1' })
  mocks.experiment.mockResolvedValue(experiment)
  mocks.page.mockResolvedValue(page)
  mocks.experimentUpdate.mockResolvedValue({ count: 1 })
  mocks.experimentFinal.mockResolvedValue({ ...experiment, status: 'COMPLETED', version: 3 })
  mocks.pageUpdate.mockResolvedValue({ count: 1 })
  mocks.revisionCreate.mockResolvedValue({ id: 'revision-3' })
  mocks.transaction.mockImplementation(async callback => callback({
    landingPageExperiment: { updateMany: mocks.experimentUpdate, findUniqueOrThrow: mocks.experimentFinal },
    landingPage: { updateMany: mocks.pageUpdate },
    landingPageRevision: { create: mocks.revisionCreate },
  }))
})

function request(decision: string) {
  return new NextRequest('http://localhost/api/landing-pages/page-1/experiments/experiment-1', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'COMPLETE', decision, decisionNote: 'Reviewed against the declared evidence floor.', expectedVersion: 2 }),
  })
}

describe('landing-page experiment decisions', () => {
  it('blocks a directional decision before both variants meet minimum evidence', async () => {
    mocks.groupBy.mockResolvedValue([
      { experimentVariant: 'CONTROL', eventType: 'PAGE_VIEW', _count: { _all: 100 } },
      { experimentVariant: 'CONTROL', eventType: 'FORM_SUBMITTED', _count: { _all: 10 } },
      { experimentVariant: 'CHALLENGER', eventType: 'PAGE_VIEW', _count: { _all: 99 } },
      { experimentVariant: 'CHALLENGER', eventType: 'FORM_SUBMITTED', _count: { _all: 10 } },
    ])
    const response = await PATCH(request('KEEP_CONTROL'), context)
    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe('LANDING_EXPERIMENT_MINIMUM_EVIDENCE_REQUIRED')
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('prepares an evidenced challenger as a new draft revision without silently publishing it', async () => {
    mocks.groupBy.mockResolvedValue([
      ...['CONTROL', 'CHALLENGER'].flatMap(experimentVariant => [
        { experimentVariant, eventType: 'PAGE_VIEW', _count: { _all: 100 } },
        { experimentVariant, eventType: 'CTA_CLICK', _count: { _all: 25 } },
        { experimentVariant, eventType: 'FORM_SUBMITTED', _count: { _all: 10 } },
      ]),
    ])
    const response = await PATCH(request('APPLY_CHALLENGER_DRAFT'), context)
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body).toMatchObject({ challengerAppliedToDraftOnly: true, requiresSeparatePublishReview: true })
    expect(mocks.pageUpdate).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: 'page-1', version: 2, publishedHash: 'control-hash' }),
      data: expect.objectContaining({ headline: 'Challenger', version: 3 }),
    })
    expect(mocks.pageUpdate.mock.calls[0][0].data).not.toHaveProperty('publishedSnapshot')
    expect(mocks.revisionCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ landingPageId: 'page-1', version: 3 }) })
  })
})
