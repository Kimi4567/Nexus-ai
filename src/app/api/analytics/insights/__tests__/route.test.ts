import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getServerUserId: vi.fn(),
  workspaceFindFirst: vi.fn(),
  campaignCount: vi.fn(),
  campaignFindMany: vi.fn(),
  brandProfileFindUnique: vi.fn(),
  generatedVisualCount: vi.fn(),
  socialPostCount: vi.fn(),
  brainLearningCount: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mocks.getServerUserId }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: { findFirst: mocks.workspaceFindFirst },
    campaign: { count: mocks.campaignCount, findMany: mocks.campaignFindMany },
    brandProfile: { findUnique: mocks.brandProfileFindUnique },
    generatedVisual: { count: mocks.generatedVisualCount },
    socialPost: { count: mocks.socialPostCount },
    brainLearning: { count: mocks.brainLearningCount },
  },
}))

import { GET } from '@/app/api/analytics/insights/route'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getServerUserId.mockResolvedValue('user-1')
  mocks.workspaceFindFirst.mockResolvedValue({ id: 'workspace-1' })
  mocks.campaignCount
    .mockResolvedValueOnce(1)
    .mockResolvedValueOnce(0)
    .mockResolvedValueOnce(1)
  mocks.campaignFindMany.mockResolvedValue([{
    id: 'campaign-1',
    name: 'Final media campaign',
    status: 'ACTIVE',
    updatedAt: new Date(),
  }])
  mocks.brandProfileFindUnique.mockResolvedValue(null)
  mocks.generatedVisualCount.mockResolvedValue(0)
  mocks.socialPostCount.mockResolvedValue(3)
  mocks.brainLearningCount.mockResolvedValue(0)
})

describe('GET /api/analytics/insights', () => {
  it('uses final Content Hub post media when GeneratedVisual has no rows', async () => {
    const response = await GET(new Request('http://localhost/api/analytics/insights'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.socialPostCount).toHaveBeenCalledWith({
      where: {
        workspaceId: 'workspace-1',
        imageUrl: { not: null },
        generationStatus: 'DONE',
      },
    })
    expect(body.insights).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'final-media-ready',
        type: 'success',
        message: '3 post packages have confirmed final media linked',
      }),
    ]))
    expect(body.insights).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'no-visuals' }),
    ]))
  })
})
