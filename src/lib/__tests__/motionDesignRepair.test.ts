import { describe, expect, it } from 'vitest'
import { findMotionDesignTypographyRepairCandidate } from '@/lib/motionDesignRepair'

function generation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'generation-v3',
    status: 'COMPLETED',
    params: {
      postId: 'post-1',
      sourceMediaId: 'source-1',
      productionRoute: 'SOURCE_LOCKED_MOTION_DESIGN',
      credit: {
        ok: true,
        creditsUsed: 6,
        creditsRemaining: 308,
        isUnlimited: false,
        transactionId: 'debit-v3',
        operationStatus: 'RESERVED',
      },
    },
    metadata: {
      model: 'source-locked-motion-design-ffmpeg-2026-07-v3',
      mediaId: 'attached-v3',
      attached: true,
    },
    ...overrides,
  }
}

describe('motion-design typography repair eligibility', () => {
  it('selects the currently attached v3 master for an exact one-time ledger refund', () => {
    expect(findMotionDesignTypographyRepairCandidate([generation()], {
      postId: 'post-1',
      sourceMediaId: 'source-1',
      attachedMediaId: 'attached-v3',
    })).toMatchObject({
      generationId: 'generation-v3',
      deduction: {
        creditsUsed: 6,
        transactionId: 'debit-v3',
      },
    })
  })

  it('does not refund an unattached, unrelated, or already-upgraded master', () => {
    expect(findMotionDesignTypographyRepairCandidate([generation()], {
      postId: 'post-1',
      sourceMediaId: 'source-1',
      attachedMediaId: 'different-media',
    })).toBeNull()

    const upgraded = generation({
      id: 'generation-v4',
      metadata: {
        model: 'source-locked-motion-design-ffmpeg-2026-07-v4',
        mediaId: 'attached-v4',
        attached: true,
      },
    })
    expect(findMotionDesignTypographyRepairCandidate([upgraded, generation()], {
      postId: 'post-1',
      sourceMediaId: 'source-1',
      attachedMediaId: 'attached-v4',
    })).toBeNull()
  })
})
