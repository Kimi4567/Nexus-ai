import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockEnsureDbUser,
  mockRateLimit,
  mockCheckAndDeduct,
  mockFinalizeDeduction,
  mockRefundDeduction,
  mockPrisma,
} = vi.hoisted(() => ({
  mockEnsureDbUser: vi.fn(),
  mockRateLimit: vi.fn(),
  mockCheckAndDeduct: vi.fn(),
  mockFinalizeDeduction: vi.fn(),
  mockRefundDeduction: vi.fn(),
  mockPrisma: {
    user: { findUnique: vi.fn() },
    workspace: { findFirst: vi.fn() },
    subscription: { findUnique: vi.fn() },
    campaign: { count: vi.fn() },
    brandProfile: { findUnique: vi.fn() },
    landingPage: { count: vi.fn() },
    leadCaptureForm: { count: vi.fn() },
    lead: { count: vi.fn() },
    conversionEvent: { count: vi.fn() },
    integration: { count: vi.fn() },
    socialPost: { count: vi.fn() },
  },
}))

vi.mock('@/lib/apiAuth', () => ({ ensureDbUser: mockEnsureDbUser }))
vi.mock('@/lib/dbRateLimit', () => ({ chatRateLimitDb: mockRateLimit }))
vi.mock('@/lib/billableAiRateLimit', () => ({
  enforceBillableAiRateLimit: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@vercel/oidc', () => ({
  getVercelOidcToken: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/lib/credits', () => ({
  CREDIT_COSTS: {
    RUN_FULL_STRATEGY: 8,
    SENTINEL_REVIEW: 2,
    CONTENT_PLAN_GENERATION: 2,
    IMAGE_GENERATION: 3,
    CHAT_MESSAGE: 1,
  },
  checkAndDeductCredits: mockCheckAndDeduct,
  creditCheckHttpStatus: () => 402,
  finalizeCreditDeduction: mockFinalizeDeduction,
  refundCreditDeduction: mockRefundDeduction,
  buildCreditChargeReceipt: (action: string, deduction: any) => ({
    action,
    reason: 'Generates one context-aware assistant response.',
    ...deduction,
  }),
}))

import { POST } from '../route'

const request = (messages: Array<{ role: 'user' | 'assistant'; content: string }>) => ({
  json: async () => ({ messages, page: '/dashboard' }),
}) as any

function openAiStream(chunks: string): Response {
  return new Response(chunks, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('OPENAI_API_KEY', 'test-key')
  mockEnsureDbUser.mockResolvedValue({ id: 'user_1' })
  mockRateLimit.mockResolvedValue({ ok: true })
  mockCheckAndDeduct.mockResolvedValue({
    ok: true,
    creditsUsed: 1,
    creditsRemaining: 9,
    isUnlimited: false,
    transactionId: 'credit_tx_1',
  })
  mockRefundDeduction.mockResolvedValue(undefined)
  mockFinalizeDeduction.mockResolvedValue({ ok: true, status: 'settled' })
  mockPrisma.user.findUnique.mockResolvedValue({ name: 'Owner', aiCredits: 9, subscriptionStatus: 'FREE' })
  mockPrisma.workspace.findFirst.mockResolvedValue({ id: 'workspace_1' })
  mockPrisma.subscription.findUnique.mockResolvedValue(null)
  mockPrisma.campaign.count.mockResolvedValue(1)
  mockPrisma.brandProfile.findUnique.mockResolvedValue(null)
  mockPrisma.landingPage.count.mockResolvedValue(0)
  mockPrisma.leadCaptureForm.count.mockResolvedValue(0)
  mockPrisma.lead.count.mockResolvedValue(0)
  mockPrisma.conversionEvent.count.mockResolvedValue(0)
  mockPrisma.integration.count.mockResolvedValue(0)
  mockPrisma.socialPost.count.mockResolvedValue(0)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('POST /api/chat credit safety', () => {
  it('rejects oversized context before charging credits', async () => {
    const response = await POST(request([{ role: 'user', content: 'x'.repeat(4_001) }]))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toMatchObject({ code: 'CHAT_CONTEXT_LIMIT', creditsCharged: false })
    expect(mockCheckAndDeduct).not.toHaveBeenCalled()
  })

  it('returns a credit receipt in headers for a completed usable stream', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(openAiStream(
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: [DONE]\n\n',
    )))

    const response = await POST(request([{ role: 'user', content: 'Help me plan a post.' }]))
    expect(await response.text()).toBe('Hello')
    expect(response.headers.get('X-Nexus-Credit-Action')).toBe('CHAT_MESSAGE')
    expect(response.headers.get('X-Nexus-Credits-Used')).toBe('1')
    expect(mockFinalizeDeduction).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user_1',
      action: 'CHAT_MESSAGE',
    }))
    expect(mockRefundDeduction).not.toHaveBeenCalled()
  })

  it('refunds a completed provider stream that contains no usable content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(openAiStream('data: [DONE]\n\n')))

    const response = await POST(request([{ role: 'user', content: 'Help me.' }]))
    expect(await response.text()).toBe('')
    expect(mockRefundDeduction).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user_1',
      action: 'CHAT_MESSAGE',
      reason: 'Chat provider returned no usable response',
    }))
  })

  it('grounds the assistant in first-party measurement and execution truth', async () => {
    mockPrisma.landingPage.count.mockResolvedValue(2)
    mockPrisma.leadCaptureForm.count.mockResolvedValue(1)
    mockPrisma.lead.count
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(2)
    mockPrisma.conversionEvent.count.mockResolvedValue(14)
    mockPrisma.integration.count.mockResolvedValue(0)
    mockPrisma.socialPost.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1)
    const provider = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const requestBody = JSON.parse(String(init.body))
      const systemPrompt = String(requestBody.messages[0].content)
      expect(systemPrompt).toContain('Landing Pages: 2')
      expect(systemPrompt).toContain('CRM Leads: 7')
      expect(systemPrompt).toContain('WON Leads: 2')
      expect(systemPrompt).toContain('First-party Conversion Events: 14')
      expect(systemPrompt).toContain('Provider-confirmed Publications: 1')
      expect(systemPrompt).toContain('first-party measurement from provider analytics')
      expect(systemPrompt).not.toContain('Strategy Studio')
      return openAiStream('data: {"choices":[{"delta":{"content":"Grounded"}}]}\n\ndata: [DONE]\n\n')
    })
    vi.stubGlobal('fetch', provider)

    const response = await POST(request([{ role: 'user', content: 'What can Nexus measure now?' }]))
    expect(await response.text()).toBe('Grounded')
  })
})
