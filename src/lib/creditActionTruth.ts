import type { CreditAction } from '@/lib/credits'

/** Client-safe mirror guarded against the server catalog by contract tests. */
export const CREDIT_ACTION_COSTS: Record<CreditAction, number> = {
  CAMPAIGN_GENERATION: 8,
  RUN_FULL_STRATEGY: 12,
  CREATIVE_BRIEF: 5,
  SENTINEL_REVIEW: 3,
  IMAGE_GENERATION: 4,
  VIDEO_GENERATION: 6,
  AD_COPY: 3,
  AI_FIELD_SUGGESTION: 1,
  PAID_EXECUTION_PLAN: 6,
  CHAT_MESSAGE: 1,
  AI_POST_REWRITE: 2,
  CONTENT_PLAN_GENERATION: 6,
  CONTENT_AB_VARIANTS: 3,
  PAID_PACK_GENERATE: 10,
  WEBSITE_SCAN: 4,
  CONTENT_ANALYSIS: 3,
  BRAND_EVIDENCE_ANALYSIS: 3,
}

export interface CreditActionTruthInput {
  action: CreditAction
  creditsRemaining: number
  isUnlimited?: boolean
}

export interface CreditActionTruth {
  cost: number
  canAfford: boolean
  label: string
  lockedReason: string | null
}

function safeCredits(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0
}

export function getCreditActionTruth(input: CreditActionTruthInput): CreditActionTruth {
  const cost = CREDIT_ACTION_COSTS[input.action] ?? 0
  const creditsRemaining = safeCredits(input.creditsRemaining)
  const canAfford = input.isUnlimited === true || cost <= 0 || creditsRemaining >= cost

  return {
    cost,
    canAfford,
    label: `${cost} credit${cost === 1 ? '' : 's'}`,
    lockedReason: canAfford ? null : 'Add credits to generate this.',
  }
}
