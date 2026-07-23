import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getUserId: vi.fn(),
  workspaceFindFirst: vi.fn(),
  agentRunFindFirst: vi.fn(),
  agentRunFindMany: vi.fn(),
  integrationFindMany: vi.fn(),
  adAccountFindMany: vi.fn(),
  getApprovalInbox: vi.fn(),
  creditTransactionFindMany: vi.fn(),
  adCampaignFindMany: vi.fn(),
  socialPostFindFirst: vi.fn(),
  socialPostFindMany: vi.fn(),
  brainLearningFindMany: vi.fn(),
  historyCount: vi.fn(),
  historyFindFirst: vi.fn(),
  getTruth: vi.fn(),
  buildOverview: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mocks.getUserId }))
vi.mock('@/lib/executionTruthService', () => ({ getWorkspaceExecutionTruthByWorkspaceId: mocks.getTruth }))
vi.mock('@/lib/operationsOverview', () => ({ buildOperationsOverview: mocks.buildOverview }))
vi.mock('@/lib/approvalInboxService', () => ({ getCanonicalApprovalInbox: mocks.getApprovalInbox }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: { findFirst: mocks.workspaceFindFirst },
    agentRun: { findFirst: mocks.agentRunFindFirst, findMany: mocks.agentRunFindMany },
    integration: { findMany: mocks.integrationFindMany },
    adAccount: { findMany: mocks.adAccountFindMany },
    creditTransaction: { findMany: mocks.creditTransactionFindMany },
    adCampaign: { findMany: mocks.adCampaignFindMany },
    socialPost: { findFirst: mocks.socialPostFindFirst, findMany: mocks.socialPostFindMany },
    brainLearning: { findMany: mocks.brainLearningFindMany },
    postStatusHistory: { count: mocks.historyCount, findFirst: mocks.historyFindFirst },
  },
}))

import { GET } from '@/app/api/operations/overview/route'

const executionTruth = {
  version: 1,
  generatedAt: '2026-07-15T12:00:00.000Z',
  summary: { campaigns: 1, needsAttention: 0, awaitingApproval: 1, scheduledPosts: 0, publishedPosts: 1 },
  queue: [{ campaignId: 'campaign-live', requiresApproval: true }],
  campaigns: [{ posts: { publishedWithoutAnalytics: 1 } }],
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUserId.mockResolvedValue('user-1')
  mocks.workspaceFindFirst.mockResolvedValue({ id: 'workspace-1' })
  mocks.getTruth.mockResolvedValue(executionTruth)
  mocks.agentRunFindFirst.mockResolvedValue(null)
  mocks.agentRunFindMany.mockResolvedValue([])
  mocks.integrationFindMany.mockResolvedValue([])
  mocks.adAccountFindMany.mockResolvedValue([])
  mocks.getApprovalInbox.mockResolvedValue({
    suggestions: [{ createdAt: new Date(0) }],
    proposals: [{ createdAt: new Date(0) }],
    liveApprovalActions: [{ campaignId: 'campaign-live' }],
    summary: { total: 3, brandBrain: 1, operational: 1, live: 1 },
  })
  mocks.creditTransactionFindMany.mockResolvedValue([])
  mocks.adCampaignFindMany.mockResolvedValue([])
  mocks.socialPostFindFirst.mockResolvedValue(null)
  mocks.socialPostFindMany.mockResolvedValue([])
  mocks.brainLearningFindMany.mockResolvedValue([])
  mocks.historyCount.mockResolvedValue(0)
  mocks.historyFindFirst.mockResolvedValue(null)
  mocks.buildOverview.mockReturnValue({ version: 1, summary: { incidents: 0 } })
})

describe('GET /api/operations/overview', () => {
  it('fails closed without authentication', async () => {
    mocks.getUserId.mockResolvedValue(null)

    const response = await GET(new NextRequest('http://localhost/api/operations/overview'))

    expect(response.status).toBe(401)
    expect(mocks.workspaceFindFirst).not.toHaveBeenCalled()
  })

  it('aggregates only the owned workspace and de-duplicates persisted campaign approvals', async () => {
    const response = await GET(new NextRequest('http://localhost/api/operations/overview'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.overview).toEqual({ version: 1, summary: { incidents: 0 } })
    expect(mocks.getTruth).toHaveBeenCalledWith('workspace-1')
    expect(mocks.getApprovalInbox).toHaveBeenCalledWith('user-1')
    expect(mocks.integrationFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { workspaceId: 'workspace-1', status: { not: 'DISCONNECTED' } },
    }))
    expect(mocks.buildOverview).toHaveBeenCalledWith(expect.objectContaining({
      truth: executionTruth,
      pendingApprovals: 3,
      overdueApprovals: 2,
      publishedAwaitingEvidence: 1,
      strategyRuns: [],
      pilotProof: expect.objectContaining({ status: 'not_started', completedCampaigns: 0 }),
    }))
  })
})
