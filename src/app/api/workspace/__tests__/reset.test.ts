/**
 * Workspace fresh-start reset — scope + safety contract (PR-1G).
 *
 * Guarantees:
 *   - account infra + platform connections are NEVER deleted
 *     (Integration, AdAccount, Project, WorkspaceMember, CreditTransaction,
 *      Subscription, User, Account, Session)
 *   - MarketingLearningEvent IS reset (orphan-trap closed)
 *   - every delete/count/update is scoped to the caller's workspace id
 *   - dry-run deletes nothing, returns counts
 *   - a real reset requires confirmation
 *
 * No DB/network: prisma + auth are mocked.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockAuth, prismaMock, RESET_MODELS, FORBIDDEN_MODELS } = vi.hoisted(() => {
  const RESET_MODELS = [
    'marketingLearningEvent', 'conversionEvent', 'landingPageExperiment', 'landingPage',
    'lifecycleMessage', 'contactSuppression', 'leadCaptureForm', 'lead',
    'competitorSignal', 'competitorSnapshot', 'competitorSource', 'competitor',
    'competitorResearchRun', 'brandEvidenceDocument', 'brainLearning', 'brainScoreSnapshot', 'campaignMemory',
    'agentReport', 'agentSuggestion', 'agentRun', 'automationJob', 'generatedVisual', 'socialPost',
    'export', 'paidCampaignPack', 'adCampaign', 'uploadSession', 'uploadAudit', 'media', 'campaign',
  ]
  // These must NEVER be deleted by the reset (connections / access / account).
  const FORBIDDEN_MODELS = ['integration', 'adAccount', 'project', 'workspaceMember']
  const models: Record<string, any> = {}
  for (const m of [...RESET_MODELS, ...FORBIDDEN_MODELS]) {
    models[m] = {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      count: vi.fn().mockResolvedValue(1),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
    }
  }
  const prismaMock = {
    ...models,
    workspace: { findFirst: vi.fn().mockResolvedValue({ id: 'ws1' }) },
    brandProfile: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  } as Record<string, any>
  prismaMock.brandEvidenceDocument.findMany = vi.fn().mockResolvedValue([])
  prismaMock.media.findMany = vi.fn().mockResolvedValue([])
  prismaMock.generatedVisual.findMany = vi.fn().mockResolvedValue([])
  prismaMock.$transaction = vi.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations))
  return {
    RESET_MODELS,
    FORBIDDEN_MODELS,
    mockAuth: vi.fn(),
    prismaMock,
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/apiAuth', () => ({ getAuthUser: mockAuth }))
vi.mock('@/lib/externalAssetCleanup.server', () => ({
  cleanupCloudinaryAssets: vi.fn().mockResolvedValue({ attempted: 0, removed: 0, pending: 0 }),
  cloudinaryReferenceFromUrl: vi.fn().mockReturnValue(null),
}))

import { POST } from '../reset/route'

const req = (body: Record<string, unknown>) => ({ json: async () => body }) as any

const RESET_BRAND = {
  id: 'bp1', workspaceId: 'ws1', brandName: null, industry: null, description: null,
  toneKeywords: [], avoidKeywords: [], writingStyle: null, targetAudience: null,
  audienceAge: null, audienceLocation: null, audiencePainPoints: [], audienceDesires: [],
  primaryOffer: null, secondaryOffers: [], pricePoint: null, uniqueAdvantages: [],
  visualStyle: null, colorPalette: [], logoUrl: null, winningHooks: [], winningAngles: [],
  failedAngles: [], topPlatforms: [], competitors: [], competitorNotes: null,
  strategicNotes: null, websiteUrl: null, contentSamples: [], aiInsights: null,
  businessGoal: null, marketingBudget: null, conversionDestination: null,
  leadHandling: null, customerObjections: [], complianceNotes: null,
  averageOrderValue: null, grossMargin: null, customerLifetimeValue: null,
  salesCycleLength: null, seasonality: null, pastAdResults: null,
  languagePreference: null, verifiedProof: [], strategyType: null,
  strategyDuration: null, strategyCustomDays: null, campaignObjective: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ id: 'user1' })
  prismaMock.workspace.findFirst.mockResolvedValue({ id: 'ws1' })
  prismaMock.brandProfile.findUnique.mockResolvedValue(RESET_BRAND)
  for (const m of [...RESET_MODELS, ...FORBIDDEN_MODELS]) {
    prismaMock[m].deleteMany.mockResolvedValue({ count: 1 })
    prismaMock[m].count.mockResolvedValue(0)
  }
})

describe('POST /api/workspace/reset (PR-1G)', () => {
  it('rejects a real reset without confirmation', async () => {
    const res = await POST(req({}))
    expect(res.status).toBe(400)
    for (const m of RESET_MODELS) expect(prismaMock[m].deleteMany).not.toHaveBeenCalled()
  })

  it('accepts the strong confirmText and deletes only journey/brain models', async () => {
    const res = await POST(req({ confirmText: 'RESET MY NEXUS WORKSPACE' }))
    const data = await res.json()
    expect(data.ok).toBe(true)
    for (const m of RESET_MODELS) {
      expect(prismaMock[m].deleteMany).toHaveBeenCalledWith({ where: { workspaceId: 'ws1' } })
    }
    // MarketingLearningEvent orphan trap is closed.
    expect(prismaMock.marketingLearningEvent.deleteMany).toHaveBeenCalled()
    // Brand Brain fields reset, row kept (update, not delete).
    expect(prismaMock.brandProfile.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: 'ws1' },
        data: expect.objectContaining({
          strategyType: null,
          strategyDuration: null,
          strategyCustomDays: null,
          campaignObjective: null,
        }),
      })
    )
    expect(data.brandProfileReset).toBe(true)
    expect(data.projectShellsReset).toBe(1)
    expect(prismaMock.project.updateMany).toHaveBeenCalledWith({
      where: { workspaceId: 'ws1' },
      data: {
        name: 'My Project',
        description: null,
        businessType: null,
        businessInfo: expect.anything(),
        status: 'DRAFT',
      },
    })
    expect(data.connectionsPreserved).toBe(true)
    expect(data.creditsUnchanged).toBe(true)
    expect(data.preserved).toEqual(expect.arrayContaining(['Integration', 'AdAccount', 'CreditTransaction']))
    expect(data.resetVerified).toBe(true)
    expect(data.externalCleanupComplete).toBe(true)
    expect(data.next).toBe('/onboarding')
    expect(data.verification.remaining).toEqual(
      Object.fromEntries(RESET_MODELS.map(model => [model, 0])),
    )
    expect(data.verification.dirtyProjectIds).toEqual([])
  })

  it('NEVER deletes connections / access / account models', async () => {
    await POST(req({ confirmText: 'RESET MY NEXUS WORKSPACE' }))
    for (const m of FORBIDDEN_MODELS) {
      expect(prismaMock[m].deleteMany).not.toHaveBeenCalled()
    }
  })

  it('rejects the legacy weak confirm token', async () => {
    const res = await POST(req({ confirm: 'RESET' }))
    expect(res.status).toBe(400)
    expect(prismaMock.campaign.deleteMany).not.toHaveBeenCalled()
  })

  it('dry-run deletes nothing and returns counts', async () => {
    for (const m of RESET_MODELS) prismaMock[m].count.mockResolvedValue(1)
    const res = await POST(req({ dryRun: true }))
    const data = await res.json()
    expect(data.dryRun).toBe(true)
    expect(data.wouldDelete).toBeTruthy()
    for (const m of RESET_MODELS) {
      expect(prismaMock[m].count).toHaveBeenCalledWith({ where: { workspaceId: 'ws1' } })
      expect(prismaMock[m].deleteMany).not.toHaveBeenCalled()
    }
    expect(prismaMock.brandProfile.updateMany).not.toHaveBeenCalled()
    expect(prismaMock.project.updateMany).not.toHaveBeenCalled()
  })

  it('fails closed when same-transaction verification finds remaining journey data', async () => {
    prismaMock.socialPost.count.mockResolvedValue(1)

    const res = await POST(req({ confirmText: 'RESET MY NEXUS WORKSPACE' }))
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.code).toBe('WORKSPACE_RESET_VERIFICATION_FAILED')
    expect(data.error).toContain('verification failed')
  })

  it('fails closed when a Brand Brain field was not cleared', async () => {
    prismaMock.brandProfile.findUnique.mockResolvedValue({
      ...RESET_BRAND,
      strategyType: 'organic',
    })

    const res = await POST(req({ confirmText: 'RESET MY NEXUS WORKSPACE' }))
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.code).toBe('WORKSPACE_RESET_VERIFICATION_FAILED')
  })
})
