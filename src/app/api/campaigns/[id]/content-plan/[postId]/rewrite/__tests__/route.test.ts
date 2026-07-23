import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetServerUserId,
  mockCheckAndDeduct,
  mockRefund,
  mockPrisma,
} = vi.hoisted(() => ({
  mockGetServerUserId: vi.fn(),
  mockCheckAndDeduct: vi.fn(),
  mockRefund: vi.fn(),
  mockPrisma: {
    socialPost: { findFirst: vi.fn(), update: vi.fn() },
    campaign: { findFirst: vi.fn() },
    brandProfile: { findUnique: vi.fn() },
  },
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mockGetServerUserId }))
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/credits', () => ({
  checkAndDeductCredits: mockCheckAndDeduct,
  refundCredits: mockRefund,
  refundCreditDeduction: mockRefund,
  buildCreditChargeReceipt: (action: string, deduction: any) => ({ action, cost: 2, ...deduction }),
  CREDIT_COSTS: {
    IMAGE_GENERATION: 4,
    AI_POST_REWRITE: 2,
    CONTENT_PLAN_GENERATION: 6,
  },
}))

const params = { params: Promise.resolve({ id: 'campaign_1', postId: 'post_1' }) }
const makeReq = (body: unknown = {}) => ({ json: async () => body }) as any

async function loadRoute() {
  vi.resetModules()
  return import('../route')
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetServerUserId.mockResolvedValue('user_1')
  mockPrisma.socialPost.findFirst.mockResolvedValue({
    id: 'post_1',
    caption: 'Original caption',
    imagePrompt: 'Image prompt',
    platform: 'FACEBOOK',
    status: 'DRAFT',
    workspaceId: 'workspace_1',
  })
  mockPrisma.campaign.findFirst.mockResolvedValue({
    name: 'Campaign',
    tone: 'clear',
    audience: 'office teams',
    aiOutput: {},
    goal: 'LEADS',
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('POST /api/campaigns/[id]/content-plan/[postId]/rewrite — confirmation safety', () => {
  it('missing provider returns 503 before credit deduction', async () => {
    vi.stubEnv('OPENAI_API_KEY', '')
    const { POST } = await loadRoute()

    const res = await POST(makeReq({
      instruction: 'Make it shorter',
      explicitRewriteConfirmed: true,
      acknowledgedCreditCost: 2,
    }), params)
    const json = await res.json()

    expect(res.status).toBe(503)
    expect(json).toMatchObject({ code: 'AI_PROVIDER_UNAVAILABLE', creditsCharged: false })
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockPrisma.brandProfile.findUnique).not.toHaveBeenCalled()
  })

  it('requires explicit rewrite confirmation before credit deduction', async () => {
    const { POST } = await loadRoute()

    const res = await POST(makeReq({ instruction: 'Make it shorter' }), params)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toMatchObject({ code: 'CONFIRMATION_REQUIRED' })
    expect(json.error).toContain('No credits were spent')
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockPrisma.brandProfile.findUnique).not.toHaveBeenCalled()
    expect(mockPrisma.socialPost.update).not.toHaveBeenCalled()
  })

  it('loads campaign context independently because SocialPost has no campaign relation', async () => {
    vi.stubEnv('OPENAI_API_KEY', '')
    const { POST } = await loadRoute()

    await POST(makeReq({
      instruction: 'Make it shorter',
      explicitRewriteConfirmed: true,
      acknowledgedCreditCost: 2,
    }), params)

    expect(mockPrisma.socialPost.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.not.objectContaining({ campaign: expect.anything() }),
    }))
    expect(mockPrisma.campaign.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'campaign_1' }),
      select: expect.objectContaining({ goal: true, aiOutput: true }),
    }))
  })
})
