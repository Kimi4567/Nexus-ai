/**
 * RF-2A — paid-pack generate refund-safety contract.
 *
 * Guarantees:
 *   - auth, route param, campaign ownership, and context loading happen before deduction
 *   - paid pack generation deducts only immediately before the provider call
 *   - provider/JSON/DB failures after deduction refund the user
 *   - successful generation deducts once and does not refund
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

const {
  mockGetAuthUser, mockCheckAndDeduct, mockRefund, mockRefundForTxn, mockPrisma,
} = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockCheckAndDeduct: vi.fn(),
  mockRefund: vi.fn(),
  mockRefundForTxn: vi.fn(),
  mockPrisma: {
    campaign: { findFirst: vi.fn() },
    brandProfile: { findUnique: vi.fn() },
    paidCampaignPack: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}))

vi.mock('@/lib/apiAuth', () => ({ getAuthUser: mockGetAuthUser }))
vi.mock('@/lib/credits', () => ({
  checkAndDeductCredits: mockCheckAndDeduct,
  refundCredits: mockRefund,
  refundCreditsForTransaction: mockRefundForTxn,
}))
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

import { POST } from '../route'

const makeReq = () => ({}) as any
const ctx = (id = 'c1') => ({ params: Promise.resolve({ id }) })

const generatedPack = {
  audienceBrief: { meta: { ageMin: 25, ageMax: 45 } },
  copyVariants: [{ id: 'v1', platform: 'meta', headline: 'Grow Faster' }],
  budgetInsights: { recommendation: 'Start small and scale winners.' },
  platformGuides: { meta: ['Create campaign'] },
}

function mockOpenAiJson(payload: unknown = generatedPack) {
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
  mockCheckAndDeduct.mockResolvedValue({ ok: true, creditsUsed: 6, creditsRemaining: 94 })
  mockRefund.mockResolvedValue(undefined)
  mockRefundForTxn.mockResolvedValue(undefined)
  mockPrisma.campaign.findFirst.mockResolvedValue({
    id: 'c1',
    workspaceId: 'w1',
    name: 'Paid Growth',
    goal: 'leads',
    aiOutput: { strategyType: 'paid', summary: 'Strategy summary' },
  })
  mockPrisma.brandProfile.findUnique.mockResolvedValue({
    brandName: 'Nexus',
    industry: 'SaaS',
    description: 'AI marketing operator',
    audiencePainPoints: ['No time'],
    audienceDesires: ['More leads'],
    toneKeywords: ['clear'],
    uniqueAdvantages: ['fast'],
    topPlatforms: ['meta'],
    winningHooks: ['Stop wasting time'],
    failedAngles: [],
  })
  mockPrisma.paidCampaignPack.findUnique.mockResolvedValue({
    objective: 'LEAD_GENERATION',
    platforms: ['meta'],
    dailyBudget: 20,
    durationDays: 7,
    currency: 'USD',
  })
  mockPrisma.paidCampaignPack.upsert.mockResolvedValue({ id: 'pack1', campaignId: 'c1', status: 'GENERATED' })
  mockOpenAiJson()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('POST /api/campaigns/[id]/paid-pack/generate — RF-2A refund safety', () => {
  it('unauthenticated request does not deduct credits', async () => {
    mockGetAuthUser.mockResolvedValue(null)
    const res = await POST(makeReq(), ctx())
    expect(res.status).toBe(401)
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
  })

  it('missing campaign id does not deduct credits', async () => {
    const res = await POST(makeReq(), ctx(''))
    expect(res.status).toBe(400)
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
  })

  it('campaign not found or not owned does not deduct credits', async () => {
    mockPrisma.campaign.findFirst.mockResolvedValue(null)
    const res = await POST(makeReq(), ctx('missing'))
    expect(res.status).toBe(404)
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
  })

  it('organic-only campaigns are rejected before credits or provider calls', async () => {
    mockPrisma.campaign.findFirst.mockResolvedValue({
      id: 'c1',
      workspaceId: 'w1',
      name: 'Organic Growth',
      goal: 'awareness',
      aiOutput: { strategyType: 'organic', summary: 'Organic strategy summary' },
    })

    const res = await POST(makeReq(), ctx())
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.error).toBe('PAID_PLANNING_OUT_OF_SCOPE')
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(mockPrisma.paidCampaignPack.findUnique).not.toHaveBeenCalled()
  })

  it('context lookup failure before provider call does not deduct or refund', async () => {
    mockPrisma.paidCampaignPack.findUnique.mockRejectedValue(new Error('db unavailable'))
    const res = await POST(makeReq(), ctx())
    expect(res.status).toBe(500)
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('insufficient credits does not call provider or refund', async () => {
    mockCheckAndDeduct.mockResolvedValue({ ok: false, error: 'Insufficient credits' })
    const res = await POST(makeReq(), ctx())
    expect(res.status).toBe(402)
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('provider failure after deduction triggers scalar refund', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    const res = await POST(makeReq(), ctx())
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('Generation failed')
    expect(mockCheckAndDeduct).toHaveBeenCalledWith('u1', 'PAID_PACK_GENERATE')
    expect(mockRefund).toHaveBeenCalledWith('u1', 'PAID_PACK_GENERATE')
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('invalid provider JSON after deduction triggers refund', async () => {
    mockOpenAiJson('{not valid json')
    const res = await POST(makeReq(), ctx())
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('AI returned invalid JSON')
    expect(mockRefund).toHaveBeenCalledWith('u1', 'PAID_PACK_GENERATE')
  })

  it('DB persistence failure after deduction triggers refund', async () => {
    mockPrisma.paidCampaignPack.upsert.mockRejectedValue(new Error('write failed'))
    const res = await POST(makeReq(), ctx())
    expect(res.status).toBe(500)
    expect(mockRefund).toHaveBeenCalledWith('u1', 'PAID_PACK_GENERATE')
  })

  it('uses transaction refund when transactionId exists', async () => {
    mockCheckAndDeduct.mockResolvedValue({ ok: true, creditsUsed: 6, creditsRemaining: 94, transactionId: 'txn_1' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502 }))
    await POST(makeReq(), ctx())
    expect(mockRefundForTxn).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', transactionId: 'txn_1' }),
    )
    expect(mockRefund).not.toHaveBeenCalled()
  })

  it('does not refund unlimited users when creditsUsed is 0', async () => {
    mockCheckAndDeduct.mockResolvedValue({ ok: true, creditsUsed: 0, creditsRemaining: -1, isUnlimited: true })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    await POST(makeReq(), ctx())
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
  })

  it('success deducts once and does not refund', async () => {
    const res = await POST(makeReq(), ctx())
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.pack).toEqual({ id: 'pack1', campaignId: 'c1', status: 'GENERATED' })
    expect(mockCheckAndDeduct).toHaveBeenCalledTimes(1)
    expect(mockRefund).not.toHaveBeenCalled()
    expect(mockRefundForTxn).not.toHaveBeenCalled()
    expect(mockPrisma.paidCampaignPack.upsert).toHaveBeenCalledTimes(1)
  })
})
