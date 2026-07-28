import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requested: vi.fn(),
  readiness: vi.fn(),
  rateLimit: vi.fn(),
  form: vi.fn(),
  duplicate: vi.fn(),
  transaction: vi.fn(),
  leadCreate: vi.fn(),
  activityCreate: vi.fn(),
  formUpdate: vi.fn(),
  landingRequested: vi.fn(),
  landingGate: vi.fn(),
  landingPage: vi.fn(),
  conversionCreateMany: vi.fn(),
  experimentRequested: vi.fn(),
  experiment: vi.fn(),
}))

vi.mock('@/lib/leadCrmReadiness', () => ({
  isLeadCrmRequested: mocks.requested,
  getLeadCrmDatabaseReadiness: mocks.readiness,
}))
vi.mock('@/lib/dbRateLimit', () => ({ dbRateLimit: mocks.rateLimit }))
vi.mock('@/lib/landingPageReadiness', () => ({ isLandingPagesRequested: mocks.landingRequested }))
vi.mock('@/lib/landingPageAccess', () => ({ getLandingPageGate: mocks.landingGate }))
vi.mock('@/lib/landingPageExperimentReadiness', () => ({ isLandingPageExperimentsRequested: mocks.experimentRequested }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    leadCaptureForm: { findUnique: mocks.form },
    lead: { findFirst: mocks.duplicate },
    landingPage: { findFirst: mocks.landingPage },
    landingPageExperiment: { findFirst: mocks.experiment },
    $transaction: mocks.transaction,
  },
}))

import { GET, POST } from '@/app/api/leads/intake/[publicId]/route'
import { createLandingExperimentToken } from '@/lib/landingPageExperiment'

const context = { params: Promise.resolve({ publicId: 'public-form-1' }) }
const baseForm = {
  id: 'form-1',
  publicId: 'public-form-1',
  workspaceId: 'workspace-1',
  campaignId: 'campaign-1',
  title: 'Book a consultation',
  description: 'Tell us how to contact you.',
  consentStatement: 'I agree to receive a follow-up.',
  allowedOrigin: null,
  status: 'ACTIVE',
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRO_EVENT_HASH_KEY = 'a'.repeat(32)
  mocks.requested.mockReturnValue(true)
  mocks.readiness.mockResolvedValue({ ready: true })
  mocks.rateLimit.mockResolvedValue({ ok: true })
  mocks.form.mockResolvedValue(baseForm)
  mocks.duplicate.mockResolvedValue(null)
  mocks.leadCreate.mockResolvedValue({ id: 'lead-1' })
  mocks.activityCreate.mockResolvedValue({ id: 'activity-1' })
  mocks.formUpdate.mockResolvedValue({ id: 'form-1' })
  mocks.landingRequested.mockReturnValue(false)
  mocks.landingGate.mockResolvedValue({ ready: true })
  mocks.landingPage.mockResolvedValue({
    id: 'page-1', publicId: 'public-page-1', workspaceId: 'workspace-1', campaignId: 'campaign-1',
    publishedSnapshot: { primaryCta: { kind: 'LEAD_FORM', captureFormPublicId: 'public-form-1' } },
  })
  mocks.conversionCreateMany.mockResolvedValue({ count: 1 })
  mocks.experimentRequested.mockReturnValue(false)
  mocks.experiment.mockResolvedValue({ id: 'experiment-1' })
  mocks.transaction.mockImplementation(async callback => callback({
    lead: { create: mocks.leadCreate },
    leadActivity: { create: mocks.activityCreate },
    leadCaptureForm: { update: mocks.formUpdate },
    conversionEvent: { createMany: mocks.conversionCreateMany },
  }))
})

function post(body: Record<string, unknown>, origin?: string) {
  return new NextRequest('http://localhost/api/leads/intake/public-form-1', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '203.0.113.10',
      ...(origin ? { Origin: origin } : {}),
    },
    body: JSON.stringify(body),
  })
}

describe('public lead intake', () => {
  it('returns only public-safe form configuration', async () => {
    const response = await GET(new NextRequest('http://localhost/api/leads/intake/public-form-1'), context)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.form).toEqual({
      publicId: 'public-form-1',
      title: baseForm.title,
      description: baseForm.description,
      consentStatement: baseForm.consentStatement,
    })
    expect(JSON.stringify(body)).not.toContain('workspace-1')
    expect(JSON.stringify(body)).not.toContain('campaign-1')
  })

  it('accepts honeypot submissions without writing or disclosing detection', async () => {
    const response = await POST(post({ email: 'bot@example.com', website: 'spam.example' }), context)
    expect(response.status).toBe(202)
    expect(await response.json()).toEqual({ accepted: true, outreachTriggered: false })
    expect(mocks.duplicate).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('records explicit form consent as self-attested and never triggers outreach', async () => {
    const response = await POST(post({ email: 'person@example.com', consentGranted: true }), context)
    const body = await response.json()

    expect(response.status).toBe(202)
    expect(body).toEqual({ accepted: true, outreachTriggered: false })
    expect(mocks.leadCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: 'workspace-1',
        campaignId: 'campaign-1',
        emailNormalized: 'person@example.com',
        consentStatus: 'GRANTED',
        consentSource: expect.stringContaining('identity unverified'),
        responseDueAt: expect.any(Date),
      }),
      select: { id: true },
    })
    expect(mocks.activityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.objectContaining({ consentSelfAttested: true, identityVerified: false }),
      }),
    })
  })

  it('never reveals a duplicate and logs only a recapture event', async () => {
    mocks.duplicate.mockResolvedValue({ id: 'existing-lead' })
    const response = await POST(post({
      email: 'person@example.com',
      attribution: { source: 'newsletter', medium: 'email', secret: 'drop-me' },
    }), context)
    const body = await response.json()

    expect(response.status).toBe(202)
    expect(body).toEqual({ accepted: true, outreachTriggered: false })
    expect(mocks.leadCreate).not.toHaveBeenCalled()
    expect(mocks.activityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        leadId: 'existing-lead',
        type: 'FORM_RECAPTURED',
        metadata: expect.objectContaining({ attribution: { source: 'newsletter', medium: 'email' } }),
      }),
    })
    expect(JSON.stringify(body)).not.toContain('existing-lead')
  })

  it('enforces an explicitly configured browser origin', async () => {
    mocks.form.mockResolvedValue({ ...baseForm, allowedOrigin: 'https://trusted.example' })
    const response = await POST(post({ email: 'person@example.com' }, 'https://evil.example'), context)
    expect(response.status).toBe(403)
    expect(mocks.rateLimit).not.toHaveBeenCalled()
  })

  it('creates server-confirmed conversion evidence in the same transaction as landing-page intake', async () => {
    mocks.landingRequested.mockReturnValue(true)
    const response = await POST(post({
      email: 'person@example.com',
      landingPagePublicId: 'public-page-1',
      attribution: { source: 'campaign-email' },
    }), context)

    expect(response.status).toBe(202)
    expect(mocks.landingPage).toHaveBeenCalledWith({
      where: expect.objectContaining({
        publicId: 'public-page-1',
        workspaceId: 'workspace-1',
        campaignId: 'campaign-1',
        status: 'PUBLISHED',
      }),
      select: expect.any(Object),
    })
    expect(mocks.conversionCreateMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        landingPageId: 'page-1',
        leadId: 'lead-1',
        eventType: 'FORM_SUBMITTED',
        verificationState: 'SERVER_CONFIRMED',
        source: 'LANDING_PAGE',
      })],
      skipDuplicates: true,
    })
  })

  it('accepts a trusted legacy NEXUS form link as landing-page attribution evidence', async () => {
    mocks.landingRequested.mockReturnValue(true)
    mocks.landingPage.mockResolvedValue({
      id: 'page-1',
      publicId: 'public-page-1',
      workspaceId: 'workspace-1',
      campaignId: 'campaign-1',
      publishedSnapshot: {
        primaryCta: {
          kind: 'EXTERNAL',
          href: 'https://www.nexus-grow.com/lead-form/public-form-1',
          captureFormPublicId: null,
        },
      },
    })

    const response = await POST(post({
      email: 'legacy@example.com',
      landingPagePublicId: 'public-page-1',
    }), context)

    expect(response.status).toBe(202)
    expect(mocks.conversionCreateMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        landingPageId: 'page-1',
        eventType: 'FORM_SUBMITTED',
        verificationState: 'SERVER_CONFIRMED',
      })],
      skipDuplicates: true,
    })
  })

  it('retries a concurrent duplicate as a recapture instead of acknowledging a lost conversion', async () => {
    mocks.landingRequested.mockReturnValue(true)
    mocks.duplicate
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'race-lead' })
    mocks.transaction
      .mockRejectedValueOnce({ code: 'P2002' })
      .mockImplementationOnce(async callback => callback({
        lead: { create: mocks.leadCreate },
        leadActivity: { create: mocks.activityCreate },
        leadCaptureForm: { update: mocks.formUpdate },
        conversionEvent: { createMany: mocks.conversionCreateMany },
      }))

    const response = await POST(post({ email: 'person@example.com', landingPagePublicId: 'public-page-1' }), context)
    expect(response.status).toBe(202)
    expect(mocks.activityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ leadId: 'race-lead', type: 'FORM_RECAPTURED' }),
    })
    expect(mocks.conversionCreateMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ leadId: 'race-lead', verificationState: 'SERVER_CONFIRMED' })],
      skipDuplicates: true,
    })
  })

  it('binds a valid experiment assignment to the server-confirmed form conversion', async () => {
    mocks.landingRequested.mockReturnValue(true)
    mocks.experimentRequested.mockReturnValue(true)
    const experimentToken = createLandingExperimentToken(process.env.CRO_EVENT_HASH_KEY as string, {
      experimentId: 'experiment-1', landingPageId: 'page-1', variant: 'CHALLENGER',
    })
    const response = await POST(post({
      email: 'person@example.com',
      landingPagePublicId: 'public-page-1',
      experimentToken,
    }), context)

    expect(response.status).toBe(202)
    expect(mocks.experiment).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: 'experiment-1', landingPageId: 'page-1', startedAt: { not: null } }),
      select: { id: true },
    })
    expect(mocks.conversionCreateMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        experimentId: 'experiment-1',
        experimentVariant: 'CHALLENGER',
        verificationState: 'SERVER_CONFIRMED',
      })],
      skipDuplicates: true,
    })
  })
})
