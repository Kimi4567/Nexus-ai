import { describe, expect, it } from 'vitest'
import {
  hasCampaignEvidenceQuote,
  normalizeSentinelAssessment,
} from '@/lib/agents/sentinel-reviewer'
import { detectUnsupportedClaims } from '@/lib/ai/claimGuard'

describe('Sentinel evidence grounding', () => {
  const source = 'LedgerPilot helps finance teams review invoice approvals with a clear audit trail.'

  it('accepts only quotes that exist in the supplied campaign package', () => {
    expect(hasCampaignEvidenceQuote('Review "clear audit trail" before launch.', source)).toBe(true)
    expect(hasCampaignEvidenceQuote('Verify the conversion destination before launch.', source)).toBe(false)
    expect(hasCampaignEvidenceQuote('Create the planned infographic before approval.', source)).toBe(false)
  })

  it('allows the documented score of 40 to proceed when findings have no supplied evidence', () => {
    const review = normalizeSentinelAssessment({
      riskScore: 40,
      brandConsistencyScore: 85,
      complianceWarnings: [],
      recommendedFixes: [
        'Verify the conversion destination before launch.',
        'Create the planned infographic before approval.',
      ],
    }, source, detectUnsupportedClaims(source), 'en')

    expect(review.status).toBe('passed')
    expect(review.riskScore).toBe(40)
    expect(review.recommendedFixes).toEqual([])
    expect(review.complianceWarnings).toEqual([])
  })

  it('does not let an uncited model score become a workflow blocker', () => {
    const review = normalizeSentinelAssessment({
      riskScore: 75,
      brandConsistencyScore: 70,
      complianceWarnings: [],
      recommendedFixes: ['Add more content later.'],
    }, source, detectUnsupportedClaims(source), 'en')

    expect(review.status).toBe('passed')
    expect(review.riskScore).toBe(40)
  })

  it('blocks a grounded compliance warning that quotes supplied content', () => {
    const review = normalizeSentinelAssessment({
      riskScore: 35,
      brandConsistencyScore: 80,
      complianceWarnings: ['Substantiate the factual phrase "clear audit trail" before use.'],
      recommendedFixes: [],
    }, source, detectUnsupportedClaims(source), 'en')

    expect(review.status).toBe('needs_attention')
    expect(review.complianceWarnings).toHaveLength(1)
  })

  it('always blocks a deterministic unsupported claim even at an advisory score', () => {
    const risky = 'LedgerPilot will increase revenue by 30%.'
    const review = normalizeSentinelAssessment({
      riskScore: 10,
      brandConsistencyScore: 90,
      complianceWarnings: [],
      recommendedFixes: [],
    }, risky, detectUnsupportedClaims(risky), 'en')

    expect(review.status).toBe('needs_attention')
    expect(review.riskScore).toBe(40)
    expect(review.complianceWarnings.length).toBeGreaterThan(0)
    expect(review.recommendedFixes.length).toBeGreaterThan(0)
  })

  it('reviews the complete guarded strategy source, not only selected summary fields', () => {
    const source = 'Expected result: guaranteed results for every founder.'
    const review = normalizeSentinelAssessment({
      riskScore: 5,
      brandConsistencyScore: 90,
      complianceWarnings: [],
      recommendedFixes: [],
    }, source, detectUnsupportedClaims(source), 'en')

    expect(review.status).toBe('needs_attention')
    expect(review.complianceWarnings[0]).toContain('guaranteed results')
    expect(review.recommendedFixes[0]).toContain('aims to')
  })
})
