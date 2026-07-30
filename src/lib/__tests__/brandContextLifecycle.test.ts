import { describe, expect, it, vi } from 'vitest'
import {
  brandContextFingerprint,
  hasBrandIdentityChange,
  invalidateDependentBrandContext,
  type BrandContextInvalidationStore,
} from '@/lib/brandContextLifecycle'

function storeMock(counts = [1, 2, 1, 3]) {
  const competitorUpdateMany = vi.fn().mockResolvedValue({ count: counts[0] })
  const signalUpdateMany = vi.fn().mockResolvedValue({ count: counts[1] })
  const learningUpdateMany = vi.fn().mockResolvedValue({ count: counts[2] })
  const sourceUpdateMany = vi.fn().mockResolvedValue({ count: counts[3] })
  const store: BrandContextInvalidationStore = {
    competitor: { updateMany: competitorUpdateMany },
    competitorSignal: { updateMany: signalUpdateMany },
    brainLearning: { updateMany: learningUpdateMany },
    competitorSource: { updateMany: sourceUpdateMany },
  }
  return {
    store,
    competitorUpdateMany,
    signalUpdateMany,
    learningUpdateMany,
    sourceUpdateMany,
  }
}

describe('Brand Brain dependent-context lifecycle', () => {
  it('uses a stable fingerprint for equivalent user-entered brand identity', () => {
    const first = brandContextFingerprint({
      brandName: ' Nestora   Home ',
      industry: 'Home & Furniture',
      primaryOffer: 'Premium furniture',
      websiteUrl: 'HTTPS://EXAMPLE.COM',
    })
    const second = brandContextFingerprint({
      brandName: 'nestora home',
      industry: 'home & furniture',
      primaryOffer: 'premium furniture',
      websiteUrl: 'https://example.com',
    })

    expect(first).toBe(second)
    expect(first).toMatch(/^[a-f0-9]{64}$/)
  })

  it('treats identity and core-offer changes as context invalidations, not copy edits', () => {
    expect(hasBrandIdentityChange(['toneKeywords', 'writingStyle'])).toBe(false)
    expect(hasBrandIdentityChange(['brandName'])).toBe(true)
    expect(hasBrandIdentityChange(['industry'])).toBe(true)
    expect(hasBrandIdentityChange(['primaryOffer'])).toBe(true)
    expect(hasBrandIdentityChange(['websiteUrl'])).toBe(true)
  })

  it('does nothing when only non-identity Brand Brain fields change', async () => {
    const mocks = storeMock()
    const result = await invalidateDependentBrandContext(
      mocks.store,
      'workspace-1',
      ['toneKeywords', 'audiencePainPoints'],
    )

    expect(result).toEqual({
      required: false,
      competitorsPaused: 0,
      signalsDismissed: 0,
      proposalsDismissed: 0,
    })
    expect(mocks.competitorUpdateMany).not.toHaveBeenCalled()
    expect(mocks.signalUpdateMany).not.toHaveBeenCalled()
    expect(mocks.learningUpdateMany).not.toHaveBeenCalled()
    expect(mocks.sourceUpdateMany).not.toHaveBeenCalled()
  })

  it('pauses stale monitors and dismisses their unaccepted signals without deleting evidence', async () => {
    const mocks = storeMock([2, 4, 1, 2])
    const changedAt = new Date('2026-07-30T08:00:00.000Z')
    const result = await invalidateDependentBrandContext(
      mocks.store,
      'workspace-1',
      ['brandName', 'industry'],
      changedAt,
    )

    expect(result).toEqual({
      required: true,
      competitorsPaused: 2,
      signalsDismissed: 4,
      proposalsDismissed: 1,
    })
    expect(mocks.competitorUpdateMany).toHaveBeenCalledWith({
      where: { workspaceId: 'workspace-1', contextReviewRequired: false },
      data: {
        status: 'PAUSED',
        contextReviewRequired: true,
        contextInvalidatedAt: changedAt,
        nextScanAt: null,
      },
    })
    expect(mocks.signalUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        workspaceId: 'workspace-1',
        status: { in: ['NEW', 'REVIEWED', 'PROPOSED'] },
      },
    }))
    expect(mocks.learningUpdateMany).toHaveBeenCalledWith({
      where: {
        workspaceId: 'workspace-1',
        trigger: 'competitor_monitor',
        status: 'pending',
      },
      data: { status: 'dismissed' },
    })
  })
})
