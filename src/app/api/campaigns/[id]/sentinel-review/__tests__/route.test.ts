import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetServerUserId,
  mockCheckAndDeduct,
  mockRefund,
  mockRunSentinelReview,
  mockPrisma,
} = vi.hoisted(() => ({
  mockGetServerUserId: vi.fn(),
  mockCheckAndDeduct: vi.fn(),
  mockRefund: vi.fn(),
  mockRunSentinelReview: vi.fn(),
  mockPrisma: {
    campaign: { findFirst: vi.fn(), update: vi.fn() },
    campaignActivity: { create: vi.fn() },
  },
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mockGetServerUserId }))
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/credits', () => ({
  checkAndDeductCredits: mockCheckAndDeduct,
  refundCredits: mockRefund,
}))
vi.mock('@/lib/agents/sentinel-reviewer', () => ({
  runSentinelReview: mockRunSentinelReview,
}))
vi.mock('@/lib/ai/strategyKpiGuard', () => ({ guardStrategyKpis: (value: unknown) => value }))
vi.mock('@/lib/ai/strategyProofGuard', () => ({ guardStrategyProof: (value: unknown) => value }))
vi.mock('@/lib/ai/strategyOutputContractGuard', () => ({ guardStrategyOutputContract: (value: unknown) => value }))
vi.mock('@/lib/strategy/strategyScope', () => ({ resolveStrategyScope: () => ({ type: 'organic' }) }))

import { POST } from '../route'

const params = { params: Promise.resolve({ id: 'campaign_1' }) }
const makeReq = (body: unknown = {}) => ({ json: async () => body }) as any

const campaign = {
  id: 'campaign_1',
  workspaceId: 'workspace_1',
  name: 'Launch',
  goal: 'leads',
  audience: 'Founders',
  tone: 'clear',
  platforms: ['META'],
  aiOutput: { strategy: { keyMessage: 'A clear offer' }, language: 'en' },
  workspace: { brandProfile: { brandName: 'Nexus', industry: 'SaaS', verifiedProof: [] } },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
  mockGetServerUserId.mockResolvedValue('user_1')
  mockPrisma.campaign.findFirst.mockResolvedValue(campaign)
  mockPrisma.campaign.update.mockResolvedValue({})
  mockPrisma.campaignActivity.create.mockResolvedValue({})
  mockCheckAndDeduct.mockResolvedValue({ ok: true, creditsUsed: 2, creditsRemaining: 18 })
  mockRefund.mockResolvedValue(undefined)
  mockRunSentinelReview.mockResolvedValue({
    status: 'passed',
    riskScore: 5,
    brandConsistencyScore: 92,
    recommendedFixes: [],
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('POST /api/campaigns/[id]/sentinel-review — provider and credit ordering', () => {
  it('checks campaign ownership before charging', async () => {
    mockPrisma.campaign.findFirst.mockResolvedValue(null)

    const res = await POST(makeReq({ language: 'en' }), params)

    expect(res.status).toBe(404)
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockRunSentinelReview).not.toHaveBeenCalled()
  })

  it('returns 503 before charging when the provider is missing', async () => {
    vi.stubEnv('OPENAI_API_KEY', '')

    const res = await POST(makeReq({ language: 'en' }), params)
    const json = await res.json()

    expect(res.status).toBe(503)
    expect(json).toMatchObject({ code: 'AI_PROVIDER_UNAVAILABLE', creditsCharged: false })
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockRunSentinelReview).not.toHaveBeenCalled()
  })

  it('charges only immediately before the real review', async () => {
    const res = await POST(makeReq({ language: 'en' }), params)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.creditsRemaining).toBe(18)
    expect(mockCheckAndDeduct).toHaveBeenCalledWith('user_1', 'SENTINEL_REVIEW')
    expect(mockRunSentinelReview).toHaveBeenCalledTimes(1)
    expect(mockRefund).not.toHaveBeenCalled()
  })
})
