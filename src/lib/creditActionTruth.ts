import type { CreditAction } from '@/lib/credits'

const ACTION_COSTS: Record<CreditAction, number> = {
  CAMPAIGN_GENERATION: 5,
  RUN_FULL_STRATEGY: 8,
  CREATIVE_BRIEF: 3,
  SENTINEL_REVIEW: 2,
  IMAGE_GENERATION: 3,
  AD_COPY: 2,
  AI_FIELD_SUGGESTION: 1,
  PAID_EXECUTION_PLAN: 4,
  CHAT_MESSAGE: 1,
  AI_POST_REWRITE: 1,
  CONTENT_PLAN_GENERATION: 2,
  CONTENT_AB_VARIANTS: 2,
  PAID_PACK_GENERATE: 6,
  WEBSITE_SCAN: 3,
  CONTENT_ANALYSIS: 2,
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
  const cost = ACTION_COSTS[input.action] ?? 0
  const creditsRemaining = safeCredits(input.creditsRemaining)
  const canAfford = input.isUnlimited === true || cost <= 0 || creditsRemaining >= cost

  return {
    cost,
    canAfford,
    label: `${cost} credit${cost === 1 ? '' : 's'}`,
    lockedReason: canAfford ? null : 'Add credits to generate this.',
  }
}
