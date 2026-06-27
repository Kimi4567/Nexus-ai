import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { buildProofPolicyPrompt, guardStrategyProof, guardStrategyProofText } from '../strategyProofGuard'

describe('strategyProofGuard', () => {
  it('rewrites unsupported testimonial and customer-story language when verified proof is empty', () => {
    const strategy = {
      contentPillars: ['Education', 'Customer Testimonials'],
      topHooks: ['Hear from our satisfied customers about their coffee journey.'],
      ctaVariations: ['Read their stories'],
      weeklyExecutionPlan: [{ deliverables: ['1 customer testimonial video'] }],
      contentAnglesDetailed: [{ title: 'Customer stories', format: 'Testimonial' }],
    }

    const guarded = guardStrategyProof(strategy, { verifiedProof: [] })
    const joined = JSON.stringify(guarded)

    expect(joined).toContain('Proof to collect')
    expect(joined).toContain('Ask customers for feedback and stories')
    expect(joined).toContain('Collect customer stories for future use')
    expect(joined).toContain('customer feedback request or proof-collection video')
    expect(joined).not.toContain('Customer Testimonials')
    expect(joined).not.toContain('satisfied customers')
    expect(joined).not.toContain('Read their stories')
    expect(joined).not.toContain('customer testimonial video')
  })

  it('rewrites active stage to planning/review-safe wording', () => {
    const out = guardStrategyProofText('The campaign is in an active stage and ready for review.', {
      verifiedProof: [],
    })

    expect(out).toContain('planning/review stage')
    expect(out).not.toContain('active stage')
  })

  it('preserves legitimate testimonial wording when user-provided proof includes a testimonial', () => {
    const text = 'Customer Testimonials can include the verified testimonial from Sara.'
    const out = guardStrategyProofText(text, {
      verifiedProof: ['Verified testimonial from Sara: Cairo Bloom Coffee helped our office simplify coffee ordering.'],
    })

    expect(out).toBe(text)
  })

  it('does not alter unrelated safe strategy text', () => {
    const safe = {
      keyMessage: 'Freshly roasted coffee with grind-size guidance for Cairo home brewers.',
      contentPillars: ['Brewing education', 'Office coffee routines'],
      nextBestAction: 'Review the strategy before generating a content plan.',
    }

    expect(guardStrategyProof(safe, { verifiedProof: [] })).toEqual(safe)
  })

  it('builds explicit proof-policy prompt text', () => {
    const prompt = buildProofPolicyPrompt({ verifiedProof: [] })

    expect(prompt).toContain('PROOF POLICY')
    expect(prompt).toContain('No testimonial, customer-story, review, award, case-study')
    expect(prompt).toContain('recommend collecting proof')
  })

  it('content-plan route includes proof-policy guard before generation', () => {
    const route = readFileSync(
      path.join(process.cwd(), 'src/app/api/campaigns/[id]/generate-content-plan/route.ts'),
      'utf8',
    )

    expect(route).toContain('buildProofPolicyPrompt')
    expect(route).toContain('guardStrategyProof')
    expect(route).toContain('If the saved strategy contains unsupported proof terms')
  })
})
