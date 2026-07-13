import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetServerUserId,
  mockCheckAndDeduct,
  mockRefund,
  mockAnalyzeAssets,
  mockGenerateVisualConcepts,
  mockPrisma,
} = vi.hoisted(() => ({
  mockGetServerUserId: vi.fn(),
  mockCheckAndDeduct: vi.fn(),
  mockRefund: vi.fn(),
  mockAnalyzeAssets: vi.fn(),
  mockGenerateVisualConcepts: vi.fn(),
  mockPrisma: {
    campaign: { findFirst: vi.fn(), update: vi.fn() },
    media: { findMany: vi.fn() },
    campaignActivity: { create: vi.fn() },
  },
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mockGetServerUserId }))
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/credits', () => ({
  checkAndDeductCredits: mockCheckAndDeduct,
  refundCredits: mockRefund,
}))
vi.mock('@/lib/agents/visual-director', () => ({
  analyzeAssets: mockAnalyzeAssets,
  generateVisualConcepts: mockGenerateVisualConcepts,
}))

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
  aiOutput: { strategy: { keyMessage: 'A clear offer' }, language: 'en' },
  workspace: { brandProfile: { brandName: 'Nexus', industry: 'SaaS' } },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
  mockGetServerUserId.mockResolvedValue('user_1')
  mockPrisma.campaign.findFirst.mockResolvedValue(campaign)
  mockPrisma.campaign.update.mockResolvedValue({})
  mockPrisma.media.findMany.mockResolvedValue([])
  mockPrisma.campaignActivity.create.mockResolvedValue({})
  mockCheckAndDeduct.mockResolvedValue({ ok: true, creditsUsed: 4, creditsRemaining: 16 })
  mockRefund.mockResolvedValue(undefined)
  mockGenerateVisualConcepts.mockResolvedValue({ assetAnalyses: [], overallCreativeDirection: 'Clear direction' })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('POST /api/campaigns/[id]/creative-brief — provider and credit ordering', () => {
  it('checks campaign ownership before charging', async () => {
    mockPrisma.campaign.findFirst.mockResolvedValue(null)

    const res = await POST(makeReq({ mode: 'concept', language: 'en' }), params)

    expect(res.status).toBe(404)
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockGenerateVisualConcepts).not.toHaveBeenCalled()
  })

  it('returns 503 before charging when the provider is missing', async () => {
    vi.stubEnv('OPENAI_API_KEY', '')

    const res = await POST(makeReq({ mode: 'concept', language: 'en' }), params)
    const json = await res.json()

    expect(res.status).toBe(503)
    expect(json).toMatchObject({ code: 'AI_PROVIDER_UNAVAILABLE', creditsCharged: false })
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockGenerateVisualConcepts).not.toHaveBeenCalled()
  })

  it('checks asset availability before charging', async () => {
    const res = await POST(makeReq({ mode: 'asset', mediaIds: ['missing'] }), params)

    expect(res.status).toBe(400)
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockAnalyzeAssets).not.toHaveBeenCalled()
  })

  it('does not charge for video-only asset analysis that is not supported yet', async () => {
    mockPrisma.media.findMany.mockResolvedValue([{
      id: 'video_1',
      type: 'VIDEO',
      fileName: 'launch.mp4',
      url: 'https://cdn.example.com/launch.mp4',
    }])

    const res = await POST(makeReq({ mode: 'asset', mediaIds: ['video_1'] }), params)
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.code).toBe('NO_ANALYZABLE_VISUAL_ASSETS')
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockAnalyzeAssets).not.toHaveBeenCalled()
  })

  it('charges only immediately before real concept generation', async () => {
    const res = await POST(makeReq({ mode: 'concept', language: 'en' }), params)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.creditsRemaining).toBe(16)
    expect(mockCheckAndDeduct).toHaveBeenCalledWith('user_1', 'CREATIVE_BRIEF')
    expect(mockGenerateVisualConcepts).toHaveBeenCalledTimes(1)
    expect(mockRefund).not.toHaveBeenCalled()
  })
})
