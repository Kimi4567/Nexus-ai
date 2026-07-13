/**
 * RF-4 — paid-pack learn refund-safety contract.
 *
 * Guarantees:
 *   - auth, campaign ownership, paid-pack existence, and metrics validation happen before deduction
 *   - paid-pack learning deducts only immediately before the provider call
 *   - provider/JSON/DB failures after deduction refund the user
 *   - successful signal extraction deducts once and does not refund
 *   - manual metrics never update Brand Brain as analytics-backed learning
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetAuthUser,
  mockCheckAndDeduct,
  mockRefund,
  mockRefundForTxn,
  mockSnapshotBrandMaturity,
  mockPrisma,
} = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockCheckAndDeduct: vi.fn(),
  mockRefund: vi.fn(),
  mockRefundForTxn: vi.fn(),
  mockSnapshotBrandMaturity: vi.fn(),
  mockPrisma: {
    campaign: { findFirst: vi.fn() },
    paidCampaignPack: { findUnique: vi.fn(), update: vi.fn() },
    brandProfile: { findUnique: vi.fn(), update: vi.fn() },
  },
}))

vi.mock('@/lib/apiAuth', () => ({ getAuthUser: mockGetAuthUser }))
vi.mock('@/lib/credits', () => ({
  checkAndDeductCredits: mockCheckAndDeduct,
  refundCredits: mockRefund,
  refundCreditsForTransaction: mockRefundForTxn,
}))
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/brandMaturity', () => ({ snapshotBrandMaturity: mockSnapshotBrandMaturity }))

import { POST } from '../route'

const makeReq = () => ({}) as any
const ctx = (id = 'c1') => ({ params: Promise.resolve({ id }) })

const learningPayload = {
  learnings: {
    executiveSummary: 'Meta produced the strongest signal.',
    campaignScore: 8,
    candidateHooks: ['Stop losing qualified leads'],
    audienceSignal: 'Dubai investors',
    platformSignal: 'meta',
    underperformingAngles: ['Generic luxury claims'],
    keyInsight: 'Specific investment outcomes beat generic lifestyle copy.',
    nextCampaignRecommendation: 'Scale Meta with investment-focused hooks.',
  },
  brandBrainUpdates: {
    hooksToReview: ['Stop losing qualified leads'],
    anglesToReview: ['Generic luxury claims'],
    topPlatformsUpdate: ['meta'],
    targetAudienceRefinement: 'Dubai investors seeking ready property opportunities.',
    strategicNotesAddition: 'Investment-specific hooks outperformed generic luxury copy.',
  },
}

function mockOpenAiJson(payload: unknown = learningPayload) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: typeof payload === 'string' ? payload : JSON.stringify(payload) } }],
    }),
  }))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
  mockGetAuthUser.mockResolvedValue({ id: 'u1' })
  mockCheckAndDeduct.mockResolvedValue({ ok: true, creditsUsed: 2, creditsRemaining: 18 })
  mockRefund.mockResolvedValue(undefined)
  mockRefundForTxn.mockResolvedValue(undefined)
  mockSnapshotBrandMaturity.mockResolvedValue(undefined)
  mockPrisma.campaign.findFirst.mockResolvedValue({
    id: 'c1',
    workspaceId: 'w1',
    name: 'Paid Growth',
    workspace: { id: 'w1', ownerId: 'u1' },
  })
  mockPrisma.paidCampaignPack.findUnique.mockResolvedValue({
    campaignId: 'c1',
    objective: 'LEAD_GENERATION',
    platforms: ['meta'],
    durationDays: 30,
    dailyBudget: 50,
    currency: 'USD',
    metrics: {
      ctr: 2.4,
      roas: 3.1,
      byCreative: { v1: { ctr: 2.4, roas: 3.1 } },
    },
    metricsSource: 'meta_api',
    copyVariants: [{ id: 'v1', hook: 'Stop losing qualified leads' }],
    audienceBrief: { meta: { locations: ['Dubai'] } },
    budgetInsights: { recommendation: 'Scale Meta first.' },
  })
  mockPrisma.brandProfile.findUnique.mockResolvedValue({
    workspaceId: 'w1',
    winningHooks: ['Old hook'],
    failedAngles: ['Old failed angle'],
    topPlatforms: ['google'],
    targetAudience: 'Property buyers',
    strategicNotes: 'Existing notes.',
  })
  mockPrisma.paidCampaignPack.update.mockResolvedValue({ id: 'pack1' })
  mockPrisma.brandProfile.update.mockResolvedValue({ workspaceId: 'w1' })
  mockOpenAiJson()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('POST /api/campaigns/[id]/paid-pack/learn — RF-4 refund safety', () => {
  it('unauthenticated request does not deduct credits', async () => {
    mockGetAuthUser.mockResolvedValue(null)

    const res = await POST(makeReq(), ctx())

    expect(res.status).toBe(401)
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('campaign not found or not owned does not deduct credits', async () => {
    mockPrisma.campaign.findFirst.mockResolvedValue(null)

    const res = await POST(makeReq(), ctx('missing'))

    expect(res.status).toBe(404)
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('missing paid pack does not deduct credits', async () => {
    mockPrisma.paidCampaignPack.findUnique.mockResolvedValue(null)

    const res = await POST(makeReq(), ctx())

    expect(res.status).toBe(404)
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
  })

  it('missing metrics does not deduct credits', async () => {
    mockPrisma.paidCampaignPack.findUnique.mockResolvedValue({ metrics: null })

    const res = await POST(makeReq(), ctx())

    expect(res.status).toBe(400)
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
  })

  it('insufficient credits does not call provider or refund', async () => {
    mockCheckAndDeduct.mockResolvedValue({ ok: false, error: 'INSUFFICIENT_CREDITS' })

    const res = await POST(makeReq(), ctx())

    expect(res.status).toBe(402)
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('provider failure after deduction uses transaction-aware refund', async () => {
    mockCheckAndDeduct.mockResolvedValue({
      ok: true,
      creditsUsed: 2,
      creditsRemaining: 18,
      transactionId: 'txn_learn',
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502 }))

    const res = await POST(makeReq(), ctx())

    expect(res.status).toBe(500)
    expect(mockRefundForTxn).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1',
      transactionId: 'txn_learn',
    }))
    expect(mockRefund).not.toHaveBeenCalled()
  })

  it('invalid provider JSON after deduction falls back to scalar refund without transactionId', async () => {
    mockOpenAiJson('{not valid json')

    const res = await POST(makeReq(), ctx())
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBe('AI returned invalid JSON')
    expect(mockRefund).toHaveBeenCalledWith('u1', 'AD_COPY', 'AI returned invalid JSON')
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('DB persistence failure after deduction uses transaction-aware refund', async () => {
    mockCheckAndDeduct.mockResolvedValue({
      ok: true,
      creditsUsed: 2,
      creditsRemaining: 18,
      transactionId: 'txn_db',
    })
    mockPrisma.paidCampaignPack.update.mockRejectedValueOnce(new Error('write failed'))

    const res = await POST(makeReq(), ctx())

    expect(res.status).toBe(500)
    expect(mockRefundForTxn).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1',
      transactionId: 'txn_db',
    }))
    expect(mockRefund).not.toHaveBeenCalled()
  })

  it('does not refund twice after JSON parse failure', async () => {
    mockCheckAndDeduct.mockResolvedValue({
      ok: true,
      creditsUsed: 2,
      creditsRemaining: 18,
      transactionId: 'txn_json',
    })
    mockOpenAiJson('not json')

    await POST(makeReq(), ctx())

    expect(mockRefundForTxn).toHaveBeenCalledTimes(1)
    expect(mockRefund).not.toHaveBeenCalled()
  })

  it('does not refund unlimited users when creditsUsed is 0', async () => {
    mockCheckAndDeduct.mockResolvedValue({
      ok: true,
      creditsUsed: 0,
      creditsRemaining: -1,
      isUnlimited: true,
      transactionId: 'txn_unlimited',
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))

    const res = await POST(makeReq(), ctx())

    expect(res.status).toBe(500)
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('manual aggregate metrics create a free deterministic review signal and never update Brand Brain', async () => {
    mockPrisma.paidCampaignPack.findUnique.mockResolvedValue({
      campaignId: 'c1',
      objective: 'LEAD_GENERATION',
      platforms: ['meta'],
      durationDays: 30,
      dailyBudget: 50,
      currency: 'USD',
      metrics: { ctr: 2.4, roas: 3.1 },
      metricsSource: 'manual',
      copyVariants: [{ id: 'v1', hook: 'Stop losing qualified leads' }],
      audienceBrief: { meta: { locations: ['Dubai'] } },
      budgetInsights: {},
    })

    const res = await POST(makeReq(), ctx())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.learnings.measurementCompleteness).toBe('partial')
    expect(json.learnings.candidateHooks).toEqual([])
    expect(json.learnings.keyInsight).toMatch(/cannot establish/i)
    expect(json.brandBrainUpdated).toBe(false)
    expect(json.analyticsBacked).toBe(false)
    expect(json.attributionReady).toBe(false)
    expect(json.creditsUsed).toBe(0)
    expect(json.signalLabel).toBe('Manual paid metrics signal saved for review')
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(mockPrisma.paidCampaignPack.update).toHaveBeenCalledTimes(1)
    expect(mockPrisma.brandProfile.update).not.toHaveBeenCalled()
    expect(mockSnapshotBrandMaturity).not.toHaveBeenCalled()
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })
})
