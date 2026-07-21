import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getUserId: vi.fn(),
  campaignFindFirst: vi.fn(),
  postFindFirst: vi.fn(),
  postUpdateMany: vi.fn(),
  postDeleteMany: vi.fn(),
  activityCreate: vi.fn(),
  runBrainLearning: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({ getServerUserId: mocks.getUserId }))
vi.mock('@/lib/brain-learning', () => ({ runBrainLearning: mocks.runBrainLearning }))
vi.mock('@/lib/brandBrainLearningContract', () => ({
  getBrandBrainLearningCopy: () => ({ label: 'Editorial preference' }),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    campaign: { findFirst: mocks.campaignFindFirst },
    socialPost: { findFirst: mocks.postFindFirst },
    $transaction: (callback: (tx: any) => unknown) => callback({
      socialPost: {
        updateMany: mocks.postUpdateMany,
        deleteMany: mocks.postDeleteMany,
      },
      campaignActivity: { create: mocks.activityCreate },
    }),
  },
}))

import { PATCH } from '@/app/api/campaigns/[id]/content-plan/[postId]/pick-winner/route'

const selectedAt = new Date('2026-07-20T12:00:00.000Z')
const discardedAt = new Date('2026-07-20T12:00:01.000Z')

const campaign = {
  id: 'campaign-1',
  workspaceId: 'workspace-1',
  aiOutput: {
    strategy: {
      experimentBacklog: [{
        hypothesis: 'A question-led hook may earn more qualified attention.',
        variable: 'Opening hook only',
        successSignal: 'Verified qualified landing-page visits by variant',
        minimumEvidence: 'At least 1,000 verified impressions per variant',
        decisionRule: 'Continue only after the evidence floor is met.',
      }],
    },
  },
}

const selected = {
  id: 'post-a',
  caption: 'Question-led reviewed copy',
  platform: 'LINKEDIN',
  variantGroup: 'group-1',
  variantLabel: 'A',
  variantWinner: false,
  contentPlanIndex: 1,
  status: 'DRAFT',
  publishedAt: null,
  updatedAt: selectedAt,
}

const discarded = {
  id: 'post-b',
  caption: 'Statement-led reviewed copy',
  platform: 'LINKEDIN',
  variantLabel: 'B',
  status: 'DRAFT',
  publishedAt: null,
  updatedAt: discardedAt,
}

const request = {} as any
const params = { params: Promise.resolve({ id: 'campaign-1', postId: 'post-a' }) }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUserId.mockResolvedValue('user-1')
  mocks.campaignFindFirst.mockResolvedValue(campaign)
  mocks.postFindFirst.mockResolvedValueOnce(selected).mockResolvedValueOnce(discarded)
  mocks.postUpdateMany.mockResolvedValue({ count: 1 })
  mocks.postDeleteMany.mockResolvedValue({ count: 1 })
  mocks.activityCreate.mockResolvedValue({})
  mocks.runBrainLearning.mockResolvedValue(null)
})

describe('PATCH draft variant selection', () => {
  it('atomically saves one draft preference without claiming a performance winner', async () => {
    const response = await PATCH(request, params)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      ok: true,
      selectionScope: 'draft_preference',
      discardedVariantDeleted: true,
      preferenceSignalSaved: false,
      draftComparison: { measurementState: 'draft_preference_only' },
    })
    expect(mocks.postUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'post-a',
        status: 'DRAFT',
        publishedAt: null,
        updatedAt: selectedAt,
      }),
      data: expect.objectContaining({ variantGroup: null, variantLabel: null }),
    }))
    expect(mocks.activityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'draft_variant_selected',
        metadata: expect.objectContaining({ performanceClaim: false }),
      }),
    })
  })

  it('blocks selection after either variant enters approval or execution', async () => {
    mocks.postFindFirst.mockReset()
    mocks.postFindFirst.mockResolvedValue({ ...selected, status: 'APPROVED' })

    const response = await PATCH(request, params)
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe('DRAFT_VARIANT_SELECTION_REQUIRED')
    expect(mocks.postUpdateMany).not.toHaveBeenCalled()
  })

  it('rolls back when either draft changes concurrently', async () => {
    mocks.postUpdateMany.mockResolvedValue({ count: 0 })

    const response = await PATCH(request, params)
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe('DRAFT_VARIANT_CONCURRENT_CHANGE')
    expect(mocks.activityCreate).not.toHaveBeenCalled()
  })
})
