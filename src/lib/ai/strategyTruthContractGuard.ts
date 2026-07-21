import {
  guardStrategyOutputContract,
  type StrategyOutputContractContext,
} from '@/lib/ai/strategyOutputContractGuard'
import {
  guardStrategyProof,
  type StrategyProofContext,
} from '@/lib/ai/strategyProofGuard'

/**
 * Stabilize truth wording and the structural delivery contract together.
 *
 * A proof rewrite can make two formerly different directions identical, while
 * contract alignment can reuse legacy weekly copy. Two bounded structural
 * passes with a final proof pass reach a deterministic fixed point without an
 * unbounded loop or another model call.
 */
export function guardStrategyTruthContract<T>(
  input: T,
  proofContext: StrategyProofContext,
  contractContext: StrategyOutputContractContext,
): T {
  let guarded = guardStrategyProof(input, proofContext)
  guarded = guardStrategyOutputContract(guarded, contractContext)
  guarded = guardStrategyProof(guarded, proofContext)
  guarded = guardStrategyOutputContract(guarded, contractContext)
  return guardStrategyProof(guarded, proofContext)
}
