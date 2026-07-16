export type BrandTruthGateState = 'checking' | 'passed' | 'blocked' | 'unavailable'

/**
 * Keep execution locked until Brand Brain truth has been positively verified.
 * A transient `checking` state is a safety lock, not a user-facing failure.
 */
export function isBrandTruthExecutionLocked(state: BrandTruthGateState): boolean {
  return state !== 'passed'
}

/** Only terminal verification failures should render an error/block banner. */
export function hasBrandTruthVerificationFailure(state: BrandTruthGateState): boolean {
  return state === 'blocked' || state === 'unavailable'
}
