import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  ensureDbUser: vi.fn(),
  campaignFindFirst: vi.fn(),
  workspaceFindFirst: vi.fn(),
  transaction: vi.fn(),
  campaignFindUnique: vi.fn(),
  campaignCreate: vi.fn(),
  workspaceCount: vi.fn(),
  executeRawUnsafe: vi.fn(),
  getOrCreateProjectInWorkspace: vi.fn(),
  readLockedCampaignAllowance: vi.fn(),
  getBrandBrainReadiness: vi.fn(),
  reviewBrandTruthConsistency: vi.fn(),
  isAiProviderConfigured: vi.fn(),
}))

const tx = {
  $executeRawUnsafe: mocks.executeRawUnsafe,
  campaign: {
    findUnique: mocks.campaignFindUnique,
    create: mocks.campaignCreate,
  },
  workspace: {
    count: mocks.workspaceCount,
  },
}

vi.mock('@/lib/apiAuth', () => ({ ensureDbUser: mocks.ensureDbUser }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    campaign: { findFirst: mocks.campaignFindFirst },
    workspace: { findFirst: mocks.workspaceFindFirst },
    $transaction: mocks.transaction,
  },
}))
vi.mock('@/lib/campaignCreation.server', () => ({
  getOrCreateProjectInWorkspace: mocks.getOrCreateProjectInWorkspace,
}))
vi.mock('@/lib/campaignCommercial', () => ({
  readLockedCampaignAllowance: mocks.readLockedCampaignAllowance,
}))
vi.mock('@/lib/brandReadiness', () => ({
  getBrandBrainReadiness: mocks.getBrandBrainReadiness,
}))
vi.mock('@/lib/ai/marketingQualityGate', () => ({
  reviewBrandTruthConsistency: mocks.reviewBrandTruthConsistency,
}))
vi.mock('@/lib/ai/provider', () => ({
  isAiProviderConfigured: mocks.isAiProviderConfigured,
  getAiProviderUnavailablePayload: () => ({
    error: 'AI unavailable',
    code: 'AI_PROVIDER_UNAVAILABLE',
    creditsCharged: false,
  }),
}))

import { POST } from '@/app/api/campaigns/prepare/route'

const brandProfile = {
  brandName: 'Acme',
  industry: 'Software',
  description: 'Business software',
  primaryOffer: 'Operations platform',
  targetAudience: 'Small business owners',
  audiencePainPoints: ['Manual work'],
  businessGoal: 'Increase qualified enquiries',
  topPlatforms: ['Instagram', 'X'],
  toneKeywords: ['professional', 'modern'],
}

function request(
  body: Record<string, unknown> = { outcome: 'LEADS', language: 'en' },
  idempotencyKey = 'owner-command-123',
) {
  return new NextRequest('http://localhost/api/campaigns/prepare', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token',
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.ensureDbUser.mockResolvedValue({ id: 'user-1', email: 'owner@example.com' })
  mocks.campaignFindFirst.mockResolvedValue(null)
  mocks.workspaceFindFirst.mockResolvedValue({
    id: 'workspace-1',
    name: 'Acme Workspace',
    brandProfile,
  })
  mocks.isAiProviderConfigured.mockReturnValue(true)
  mocks.getBrandBrainReadiness.mockReturnValue({
    ready: true,
    score: 100,
    missingRequired: [],
    missingRecommended: [],
  })
  mocks.reviewBrandTruthConsistency.mockReturnValue({
    status: 'passed',
    blockers: [],
    warnings: [],
  })
  mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx))
  mocks.campaignFindUnique.mockResolvedValue(null)
  mocks.workspaceCount.mockResolvedValue(1)
  mocks.getOrCreateProjectInWorkspace.mockResolvedValue('project-1')
  mocks.readLockedCampaignAllowance.mockResolvedValue({
    limit: 2,
    current: 0,
    periodStart: new Date('2026-07-01T00:00:00.000Z'),
    periodEnd: new Date('2026-08-01T00:00:00.000Z'),
    plan: 'FREE',
  })
  mocks.campaignCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => data)
})

describe('POST /api/campaigns/prepare', () => {
  it('requires authentication and a replay-safe operation key', async () => {
    mocks.ensureDbUser.mockResolvedValueOnce(null)
    expect((await POST(request())).status).toBe(401)

    const response = await POST(request({ outcome: 'LEADS' }, 'short'))
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      code: 'IDEMPOTENCY_KEY_REQUIRED',
    })
  })

  it('reuses the deterministic draft before any provider or brand preflight', async () => {
    mocks.campaignFindFirst.mockResolvedValueOnce({
      id: 'owner_existing',
      workspaceId: 'workspace-1',
      status: 'DRAFT',
    })

    const response = await POST(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      reused: true,
      publishAuthorized: false,
      spendAuthorized: false,
    })
    expect(mocks.isAiProviderConfigured).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('blocks an incomplete Brand Brain before creating a draft', async () => {
    mocks.getBrandBrainReadiness.mockReturnValueOnce({
      ready: false,
      score: 72,
      missingRequired: ['businessGoal'],
      missingRecommended: [],
    })

    const response = await POST(request())
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body).toMatchObject({
      code: 'BRAND_BRAIN_INCOMPLETE',
      missingRequired: ['businessGoal'],
      redirectUrl: '/brand',
    })
    expect(mocks.campaignCreate).not.toHaveBeenCalled()
  })

  it('creates one owner-command draft from Brand Brain without publish or spend authority', async () => {
    const response = await POST(request({ outcome: 'SALES', language: 'ar' }))
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body).toMatchObject({
      reused: false,
      publishAuthorized: false,
      spendAuthorized: false,
      campaign: {
        workspaceId: 'workspace-1',
        projectId: 'project-1',
        goal: 'SALES',
        audience: 'Small business owners',
        tone: 'MODERN',
        platforms: ['INSTAGRAM', 'TWITTER'],
        status: 'DRAFT',
      },
    })
    expect(body.campaign.id).toMatch(/^owner_[a-f0-9]{28}$/)
    expect(body.campaign.aiOutput.ownerCommand).toMatchObject({
      schemaVersion: 1,
      outcome: 'SALES',
      publishAuthorized: false,
      spendAuthorized: false,
    })
    expect(mocks.readLockedCampaignAllowance).toHaveBeenCalledWith(tx, 'user-1')
  })

  it('enforces the monthly campaign allowance inside the transaction', async () => {
    mocks.readLockedCampaignAllowance.mockResolvedValueOnce({
      limit: 1,
      current: 1,
      periodStart: new Date('2026-07-01T00:00:00.000Z'),
      periodEnd: new Date('2026-08-01T00:00:00.000Z'),
      plan: 'FREE',
    })

    const response = await POST(request())
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body).toMatchObject({
      error: 'CAMPAIGN_LIMIT_REACHED',
      limit: 1,
      current: 1,
      upgradeUrl: '/billing',
    })
    expect(mocks.campaignCreate).not.toHaveBeenCalled()
  })
})
