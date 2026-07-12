import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ create: vi.fn() }))

vi.mock('@/lib/prisma', () => ({
  prisma: { brainLearning: { create: mocks.create } },
}))

import { runBrainLearning } from '@/lib/brain-learning'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.create.mockResolvedValue({ id: 'proposal-1' })
})

describe('runBrainLearning', () => {
  it.each([
    'strategy',
    'approved_content',
    'post_performance',
    'sentinel_insight',
    'competitor_monitor',
    'industry_trend',
  ] as const)('does not turn %s output into durable learning', async (trigger) => {
    const result = await runBrainLearning({
      workspaceId: 'w1',
      trigger,
      payload: { invented: 'context' },
    })

    expect(result).toBe(0)
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('records an explicit variant selection only as a reviewable preference note', async () => {
    const result = await runBrainLearning({
      workspaceId: 'w1',
      campaignId: 'c1',
      trigger: 'ab_winner',
      payload: {
        winner: { caption: 'Stop guessing your growth. Build a system.', platform: 'META', variantLabel: 'B' },
        loser: { caption: 'Try our new product today. Learn more.', platform: 'META', variantLabel: 'A' },
      },
    })

    expect(result).toBe(1)
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        trigger: 'ab_winner',
        field: 'strategicNotes',
        displayName: 'Creative preference note',
        proposed: expect.stringContaining('not performance evidence'),
        status: 'pending',
      }),
    })
  })

  it('does not create a note when variants have the same opening', async () => {
    const result = await runBrainLearning({
      workspaceId: 'w1',
      trigger: 'ab_winner',
      payload: {
        winner: { caption: 'Same opening. First body.' },
        loser: { caption: 'Same opening. Other body.' },
      },
    })

    expect(result).toBe(0)
    expect(mocks.create).not.toHaveBeenCalled()
  })
})
