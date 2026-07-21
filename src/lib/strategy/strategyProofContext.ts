import type { StrategyProofContext } from '@/lib/ai/strategyProofGuard'
import { sourceLinkedProofStatements } from '@/lib/strategy/strategyEvidenceLedger'

type BrandProfileLike = Record<string, unknown> | null | undefined

export type BuiltStrategyProofContext = StrategyProofContext & {
  verifiedProof: string[]
  budgetText: string | null
  allowedClaimText: string[]
  commercialClaimText: string[]
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
}

/**
 * Build the one proof boundary used by generation, campaign display, and
 * Sentinel preflight. Keeping these fields centralized prevents a strategy
 * that passed generation from being rewritten under a narrower client-side
 * proof context and then incorrectly reported as stale.
 */
export function buildStrategyProofContextFromBrand(brand: BrandProfileLike): {
  recordedProof: string[]
  proofContext: BuiltStrategyProofContext
} {
  const values = brand ?? {}
  const recordedProof = stringArray(values.verifiedProof)
  const verifiedProof = sourceLinkedProofStatements(recordedProof)

  return {
    recordedProof,
    proofContext: {
      verifiedProof,
      commercialClaimText: verifiedProof,
      budgetText: typeof values.marketingBudget === 'string' && values.marketingBudget.trim()
        ? values.marketingBudget
        : null,
      allowedClaimText: [
        values.description,
        values.primaryOffer,
        values.targetAudience,
        ...stringArray(values.audiencePainPoints),
        ...stringArray(values.audienceDesires),
        values.pricePoint,
        values.languagePreference,
        values.writingStyle,
        ...stringArray(values.toneKeywords),
        ...stringArray(values.uniqueAdvantages),
        values.complianceNotes,
        ...recordedProof,
      ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
    },
  }
}
