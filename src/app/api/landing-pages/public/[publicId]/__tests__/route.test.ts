import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ gate: vi.fn(), experimentState: vi.fn(), page: vi.fn(), form: vi.fn(), experiment: vi.fn() }))

vi.mock('@/lib/landingPageAccess', () => ({ getLandingPageGate: mocks.gate }))
vi.mock('@/lib/landingPageExperimentAccess', () => ({ getPublicLandingExperimentState: mocks.experimentState }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    landingPage: { findUnique: mocks.page },
    landingPageExperiment: { findFirst: mocks.experiment },
    leadCaptureForm: { findFirst: mocks.form },
  },
}))

import { GET } from '@/app/api/landing-pages/public/[publicId]/route'

const context = { params: Promise.resolve({ publicId: 'public-page-1' }) }
const snapshot = {
  schemaVersion: 1,
  publicId: 'public-page-1',
  locale: 'EN',
  headline: 'Offer',
  subheadline: null,
  body: null,
  benefits: [],
  proof: null,
  primaryCta: {
    label: 'Start', href: '/lead-form/public-form-1?lp=public-page-1', kind: 'LEAD_FORM', captureFormPublicId: 'public-form-1',
  },
  theme: { variant: 'MIDNIGHT' },
  seo: { title: null, description: null, indexable: false },
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRO_EVENT_HASH_KEY = 'a'.repeat(32)
  mocks.gate.mockResolvedValue({ ready: true })
  mocks.experimentState.mockResolvedValue({ enabled: false })
  mocks.page.mockResolvedValue({
    id: 'page-1', workspaceId: 'workspace-1', campaignId: 'campaign-1', status: 'PUBLISHED', publishedSnapshot: snapshot,
    publishedHash: 'snapshot-hash', publishedAt: new Date('2026-07-20T10:00:00Z'),
  })
  mocks.form.mockResolvedValue({ id: 'form-1' })
  mocks.experiment.mockResolvedValue(null)
})

describe('public landing page read', () => {
  it('returns only the immutable snapshot and verifies its published capture form is still active', async () => {
    const response = await GET(new NextRequest('http://localhost/api/landing-pages/public/public-page-1'), context)
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.page).toEqual(snapshot)
    expect(JSON.stringify(body)).not.toContain('workspace-1')
    expect(mocks.form).toHaveBeenCalledWith({
      where: { publicId: 'public-form-1', workspaceId: 'workspace-1', campaignId: 'campaign-1', status: 'ACTIVE' },
      select: { id: true },
    })
  })

  it('fails closed instead of rendering a dead CTA after the published form is paused', async () => {
    mocks.form.mockResolvedValue(null)
    const response = await GET(new NextRequest('http://localhost/api/landing-pages/public/public-page-1'), context)
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'Campaign intake is temporarily unavailable.' })
  })

  it('does not require a capture form for an external published CTA', async () => {
    mocks.page.mockResolvedValue({
      workspaceId: 'workspace-1', campaignId: 'campaign-1', status: 'PUBLISHED',
      publishedSnapshot: { ...snapshot, primaryCta: { label: 'Visit', href: 'https://example.com/', kind: 'EXTERNAL', captureFormPublicId: null } },
      publishedHash: 'external-hash', publishedAt: new Date('2026-07-20T10:00:00Z'),
    })
    const response = await GET(new NextRequest('http://localhost/api/landing-pages/public/public-page-1'), context)
    expect(response.status).toBe(200)
    expect(mocks.form).not.toHaveBeenCalled()
  })

  it('serves an immutable assigned experiment snapshot with a signed token and private caching', async () => {
    mocks.experimentState.mockResolvedValue({ enabled: true, ready: true })
    mocks.experiment.mockResolvedValue({
      id: 'experiment-1',
      challengerAllocationPercent: 100,
      controlSnapshot: snapshot,
      controlHash: 'control-hash',
      challengerSnapshot: { ...snapshot, headline: 'Challenger offer' },
      challengerHash: 'challenger-hash',
    })
    const response = await GET(new NextRequest('http://localhost/api/landing-pages/public/public-page-1', {
      headers: { 'x-forwarded-for': '203.0.113.10', 'user-agent': 'test-browser' },
    }), context)
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.page.headline).toBe('Challenger offer')
    expect(body.experiment).toMatchObject({ variant: 'CHALLENGER', successMetric: 'SERVER_CONFIRMED_FORM_SUBMISSION' })
    expect(body.experiment.assignmentToken).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })

  it('serves the published control to crawlers and excludes them from experiments and measurement', async () => {
    mocks.experimentState.mockResolvedValue({ enabled: true, ready: true })
    mocks.experiment.mockResolvedValue({
      id: 'experiment-1', challengerAllocationPercent: 100, controlSnapshot: snapshot, controlHash: 'control-hash',
      challengerSnapshot: { ...snapshot, headline: 'Challenger offer' }, challengerHash: 'challenger-hash',
    })
    const response = await GET(new NextRequest('http://localhost/api/landing-pages/public/public-page-1', {
      headers: { 'user-agent': 'Googlebot/2.1' },
    }), context)
    const body = await response.json()
    expect(body.page.headline).toBe('Offer')
    expect(body.experiment).toBeNull()
    expect(body.measurementEligible).toBe(false)
    expect(body.conversionTruth.crawlerTrafficExcluded).toBe(true)
    expect(mocks.experimentState).not.toHaveBeenCalled()
    expect(mocks.experiment).not.toHaveBeenCalled()
  })
})
