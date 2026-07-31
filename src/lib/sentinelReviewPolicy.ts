export const SENTINEL_REVIEW_POLICY_VERSION = 4 as const

type SentinelReviewLike = {
  status?: unknown
  policyVersion?: unknown
}

export function isCurrentSentinelReview(review: unknown): boolean {
  if (!review || typeof review !== 'object' || Array.isArray(review)) return false
  const candidate = review as SentinelReviewLike
  return (
    (candidate.status === 'passed' || candidate.status === 'needs_attention')
    && candidate.policyVersion === SENTINEL_REVIEW_POLICY_VERSION
  )
}

export function isStaleSentinelReview(review: unknown): boolean {
  if (!review || typeof review !== 'object' || Array.isArray(review)) return false
  const candidate = review as SentinelReviewLike
  return (
    (candidate.status === 'passed' || candidate.status === 'needs_attention')
    && candidate.policyVersion !== SENTINEL_REVIEW_POLICY_VERSION
  )
}
