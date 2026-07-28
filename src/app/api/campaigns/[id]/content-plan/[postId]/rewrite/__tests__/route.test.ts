import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetServerUserId,
  mockCheckAndDeduct,
  mockFinalize,
  mockRefund,
  mockReview,
  mockPrisma,
} = vi.hoisted(() => ({
  mockGetServerUserId: vi.fn(),
  mockCheckAndDeduct: vi.fn(),
  mockFinalize: vi.fn(),
  mockRefund: vi.fn(),
  mockReview: vi.fn(),
  mockPrisma: {
    socialPost: { findFirst: vi.fn(), update: vi.fn() },
    campaign: { findFirst: vi.fn() },
    brandProfile: { findUnique: vi.fn() },
    postStatusHistory: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mockGetServerUserId }))
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/credits', () => ({
  checkAndDeductCredits: mockCheckAndDeduct,
  creditCheckHttpStatus: () => 402,
  finalizeCreditDeduction: mockFinalize,
  refundCredits: mockRefund,
  refundCreditDeduction: mockRefund,
  buildCreditChargeReceipt: (action: string, deduction: any) => ({ action, cost: 2, ...deduction }),
  CREDIT_COSTS: {
    IMAGE_GENERATION: 4,
    AI_POST_REWRITE: 2,
    CONTENT_PLAN_GENERATION: 6,
  },
}))
vi.mock('@/lib/billableAiRateLimit', () => ({ enforceBillableAiRateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/ai/contentDraftTruthGuard', () => ({ guardContentDraftText: (value: string) => value }))
vi.mock('@/lib/contentPlanApprovalGuard', () => ({
  buildContentPlanTruthContext: () => ({}),
  reviewContentPostForPublishing: mockReview,
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
    videoPrompt: null,
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
  mockPrisma.brandProfile.findUnique.mockResolvedValue({
    brandName: 'Campaign',
    toneKeywords: ['clear'],
    avoidKeywords: [],
    targetAudience: 'office teams',
    verifiedProof: [],
  })
  mockPrisma.socialPost.update.mockResolvedValue({
    id: 'post_1',
    caption: 'Saved rewrite',
    imagePrompt: 'Image prompt',
    status: 'DRAFT',
    approvedAt: null,
    publishMode: null,
  })
  mockPrisma.$transaction.mockImplementation(async callback => callback(mockPrisma))
  mockCheckAndDeduct.mockResolvedValue({ ok: true, creditsUsed: 2, creditsRemaining: 8 })
  mockFinalize.mockResolvedValue({ ok: true })
  mockReview.mockReturnValue([])
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
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

  it('repairs one rejected provider draft inside the same charged rewrite action', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key')
    mockReview
      .mockReturnValueOnce([{ index: 1, reason: 'The hook is too generic.' }])
      .mockReturnValueOnce([])
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: 'Generic first rewrite' } }],
        usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: 'Office teams lose follow-ups between handoffs. Start with one reviewed workflow.' } }],
        usage: { prompt_tokens: 25, completion_tokens: 8, total_tokens: 33 },
      }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { POST } = await loadRoute()

    const res = await POST(makeReq({
      instruction: 'Make the hook specific',
      explicitRewriteConfirmed: true,
      acknowledgedCreditCost: 2,
    }), params)

    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(mockCheckAndDeduct).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[1]?.[1]?.body)).toContain('The hook is too generic.')
    expect(mockPrisma.socialPost.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        caption: 'Office teams lose follow-ups between handoffs. Start with one reviewed workflow.',
      }),
    }))
    expect(await res.json()).toMatchObject({ remainingQualityIssues: [] })
  })
})
