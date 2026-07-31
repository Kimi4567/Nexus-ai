import type { CreditDeductionOk } from '@/lib/credits'
import { PROFESSIONAL_VIDEO_TIMELINE_VERSION } from '@/lib/professionalVideoTimeline'

type MotionDesignGenerationRow = {
  id: string
  status?: string | null
  params?: unknown
  metadata?: unknown
}

export type MotionDesignTypographyRepairCandidate = {
  generationId: string
  deduction: CreditDeductionOk
}

const CURRENT_MODEL = `source-locked-motion-design-ffmpeg-${PROFESSIONAL_VIDEO_TIMELINE_VERSION}`
const TYPOGRAPHY_DEFECT_MODELS = new Set([
  'source-locked-motion-design-ffmpeg-2026-07-v3',
])

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function deduction(value: unknown): CreditDeductionOk | null {
  const input = record(value)
  if (
    input.ok !== true
    || Number(input.creditsUsed) <= 0
    || typeof input.transactionId !== 'string'
    || !input.transactionId.trim()
  ) {
    return null
  }
  return input as unknown as CreditDeductionOk
}

/**
 * A v3 source-locked master can pass semantic AI review while its large inline
 * Arabic headline overflows the raster safe zone. Only the currently attached
 * v3 master qualifies for a one-time exact-ledger refund before v4 replacement.
 */
export function findMotionDesignTypographyRepairCandidate(
  generations: MotionDesignGenerationRow[],
  input: {
    postId: string
    sourceMediaId: string
    attachedMediaId?: string | null
  },
): MotionDesignTypographyRepairCandidate | null {
  if (!input.attachedMediaId) return null

  const relevant = generations.filter((generation) => {
    const params = record(generation.params)
    const metadata = record(generation.metadata)
    return generation.status === 'COMPLETED'
      && params.productionRoute === 'SOURCE_LOCKED_MOTION_DESIGN'
      && params.postId === input.postId
      && params.sourceMediaId === input.sourceMediaId
      && metadata.attached === true
      && metadata.mediaId === input.attachedMediaId
  })

  if (relevant.some(generation => record(generation.metadata).model === CURRENT_MODEL)) {
    return null
  }

  for (const generation of relevant) {
    const metadata = record(generation.metadata)
    if (!TYPOGRAPHY_DEFECT_MODELS.has(String(metadata.model || ''))) continue
    const priorDeduction = deduction(record(generation.params).credit)
    if (!priorDeduction) continue
    return { generationId: generation.id, deduction: priorDeduction }
  }
  return null
}
