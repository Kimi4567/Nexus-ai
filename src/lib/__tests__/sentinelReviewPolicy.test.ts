import { describe, expect, it } from 'vitest'
import {
  SENTINEL_REVIEW_POLICY_VERSION,
  isCurrentSentinelReview,
  isStaleSentinelReview,
} from '@/lib/sentinelReviewPolicy'

describe('Sentinel review policy version', () => {
  it('accepts only a review produced by the current policy', () => {
    expect(isCurrentSentinelReview({
      status: 'passed',
      policyVersion: SENTINEL_REVIEW_POLICY_VERSION,
    })).toBe(true)
    expect(isCurrentSentinelReview({
      status: 'needs_attention',
      policyVersion: SENTINEL_REVIEW_POLICY_VERSION,
    })).toBe(true)
  })

  it('reopens legacy reviews without charging them as a new user action', () => {
    expect(isStaleSentinelReview({ status: 'passed' })).toBe(true)
    expect(isCurrentSentinelReview({ status: 'passed' })).toBe(false)
    expect(isStaleSentinelReview(null)).toBe(false)
  })
})
