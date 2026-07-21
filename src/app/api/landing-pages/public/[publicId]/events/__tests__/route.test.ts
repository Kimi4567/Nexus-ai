import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  gate: vi.fn(),
  experimentState: vi.fn(),
  rateLimit: vi.fn(),
  page: vi.fn(),
  create: vi.fn(),
  experiment: vi.fn(),
}))

vi.mock('@/lib/landingPageAccess', () => ({ getLandingPageGate: mocks.gate }))
vi.mock('@/lib/landingPageExperimentAccess', () => ({ getPublicLandingExperimentState: mocks.experimentState }))
vi.mock('@/lib/dbRateLimit', () => ({ dbRateLimit: mocks.rateLimit }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    landingPage: { findUnique: mocks.page },
    landingPageExperiment: { findFirst: mocks.experiment },
    conversionEvent: { create: mocks.create },
  },
}))

import { POST } from '@/app/api/landing-pages/public/[publicId]/events/route'
import { createLandingExperimentToken } from '@/lib/landingPageExperiment'

const context = { params: Promise.resolve({ publicId: 'public-page-1' }) }

function request(body: Record<string, unknown>, origin = 'http://localhost') {
  return new NextRequest('http://localhost/api/landing-pages/public/public-page-1/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
      'x-forwarded-for': '203.0.113.10',
      'user-agent': 'test-browser',
    },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRO_EVENT_HASH_KEY = 'a'.repeat(32)
  mocks.gate.mockResolvedValue({ ready: true })
  mocks.experimentState.mockResolvedValue({ enabled: false })
  mocks.rateLimit.mockResolvedValue({ ok: true })
  mocks.page.mockResolvedValue({
    id: 'page-1', workspaceId: 'workspace-1', campaignId: 'campaign-1', status: 'PUBLISHED', publishedHash: 'hash-1',
  })
  mocks.create.mockResolvedValue({ id: 'event-1' })
  mocks.experiment.mockResolvedValue(null)
})

describe('public landing page browser events', () => {
  it('stores page views only as client-reported evidence with a pseudonymous fingerprint', async () => {
    const response = await POST(request({ eventType: 'PAGE_VIEW', attribution: { source: 'newsletter' } }), context)
    const body = await response.json()
    expect(response.status).toBe(202)
    expect(body.verificationState).toBe('CLIENT_REPORTED')
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'PAGE_VIEW',
        verificationState: 'CLIENT_REPORTED',
        fingerprintHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        dedupeKey: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    })
    expect(JSON.stringify(mocks.create.mock.calls)).not.toContain('203.0.113.10')
  })

  it('rejects forged server-confirmed events from the browser', async () => {
    const response = await POST(request({ eventType: 'FORM_SUBMITTED' }), context)
    expect(response.status).toBe(400)
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('rejects cross-origin event injection', async () => {
    const response = await POST(request({ eventType: 'CTA_CLICK' }, 'https://evil.example'), context)
    expect(response.status).toBe(403)
    expect(mocks.page).not.toHaveBeenCalled()
  })

  it('accepts duplicate browser reports without inflating the ledger', async () => {
    mocks.create.mockRejectedValue({ code: 'P2002' })
    const response = await POST(request({ eventType: 'CTA_CLICK' }), context)
    expect(response.status).toBe(202)
    expect(await response.json()).toMatchObject({ accepted: true, deduplicated: true, verificationState: 'CLIENT_REPORTED' })
  })

  it('requires a valid signed assignment while an experiment is running', async () => {
    mocks.experimentState.mockResolvedValue({ enabled: true, ready: true })
    mocks.experiment.mockResolvedValue({ id: 'experiment-1' })
    const rejected = await POST(request({ eventType: 'PAGE_VIEW', assignmentToken: 'forged' }), context)
    expect(rejected.status).toBe(400)
    expect(mocks.create).not.toHaveBeenCalled()

    const assignmentToken = createLandingExperimentToken(process.env.CRO_EVENT_HASH_KEY as string, {
      experimentId: 'experiment-1', landingPageId: 'page-1', variant: 'CONTROL',
    })
    const accepted = await POST(request({ eventType: 'PAGE_VIEW', assignmentToken }), context)
    expect(accepted.status).toBe(202)
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ experimentId: 'experiment-1', experimentVariant: 'CONTROL' }),
    })
  })
})
