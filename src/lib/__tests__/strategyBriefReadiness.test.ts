import { describe, expect, it } from 'vitest'
import { getStrategyBriefReadiness, type StrategyBriefProfileLike } from '@/lib/strategyBriefReadiness'

const organicReadyBrand: StrategyBriefProfileLike = {
  brandName: 'Cairo Bloom Coffee',
  industry: 'Coffee supplier',
  description: 'Office and home coffee supplier in Cairo.',
  primaryOffer: 'Fresh roasted coffee for offices and households',
  targetAudience: 'Office managers and coffee-loving households',
  businessGoal: 'Generate qualified leads',
  topPlatforms: ['instagram', 'facebook'],
  writingStyle: 'Warm and practical',
  languagePreference: 'both',
}

const paidReadyBrand: StrategyBriefProfileLike = {
  ...organicReadyBrand,
  marketingBudget: 'Budget to be confirmed by owner before spend',
  conversionDestination: 'WhatsApp inquiry form',
  leadHandling: 'Sales team follows up manually',
  audienceLocation: 'Cairo and nearby delivery zones',
}

describe('getStrategyBriefReadiness', () => {
  it('allows an organic-ready brand and treats missing proof as a warning only', () => {
    const result = getStrategyBriefReadiness({
      mode: 'organic',
      brandProfile: organicReadyBrand,
    })

    expect(result.canGenerate).toBe(true)
    expect(result.canGenerateOrganic).toBe(true)
    expect(result.canGeneratePaidPlan).toBe(false)
    expect(result.paidPlanningOnly).toBe(false)
    expect(result.missingRequiredFields).toEqual([])
    expect(result.recommendedFields).toContain('verifiedProof')
    expect(result.warnings).toContain('verified_proof_missing')
    expect(result.warnings).not.toContain('paid_planning_only')
    expect(result.warnings).not.toContain('no_launch_or_spend')
    expect(result.blockers).toEqual([])
    expect(result.safeScope).toContain('Organic strategy only')
  })

  it('blocks paid-only when budget, conversion, and lead handling are missing', () => {
    const result = getStrategyBriefReadiness({
      mode: 'paid',
      brandProfile: organicReadyBrand,
    })

    expect(result.canGenerate).toBe(false)
    expect(result.canGeneratePaidPlan).toBe(false)
    expect(result.missingRequiredFields).toEqual(
      expect.arrayContaining(['marketingBudget', 'conversionDestination', 'leadHandling', 'audienceLocation']),
    )
    expect(result.blockers).toContain('paid_brief_incomplete')
    expect(result.explanation).toContain('No internal default budget')
  })

  it('blocks full strategy when organic is ready but paid brief inputs are incomplete', () => {
    const result = getStrategyBriefReadiness({
      mode: 'full',
      brandProfile: organicReadyBrand,
    })

    expect(result.canGenerate).toBe(false)
    expect(result.canGenerateOrganic).toBe(true)
    expect(result.canGeneratePaidPlan).toBe(false)
    expect(result.blockers).toContain('full_paid_brief_incomplete')
    expect(result.safeScope).toContain('switch to Organic-only')
  })

  it('allows paid planning when the paid brief exists but still does not authorize launch or spend', () => {
    const result = getStrategyBriefReadiness({
      mode: 'paid',
      brandProfile: paidReadyBrand,
    })

    expect(result.canGenerate).toBe(true)
    expect(result.canGeneratePaidPlan).toBe(true)
    expect(result.missingRequiredFields).toEqual([])
    expect(result.paidPlanningOnly).toBe(true)
    expect(result.blockers).toEqual([])
    expect(result.warnings).toEqual(expect.arrayContaining(['paid_planning_only', 'no_launch_or_spend']))
    expect(result.safeScope).toContain('Paid planning brief only')
  })

  it('allows full strategy when organic and paid briefs are ready while launch readiness remains gated', () => {
    const result = getStrategyBriefReadiness({
      mode: 'full',
      brandProfile: paidReadyBrand,
    })

    expect(result.canGenerate).toBe(true)
    expect(result.canGenerateOrganic).toBe(true)
    expect(result.canGeneratePaidPlan).toBe(true)
    expect(result.paidPlanningOnly).toBe(true)
    expect(result.blockers).toEqual([])
    expect(result.warnings).toEqual(expect.arrayContaining(['paid_planning_only', 'no_launch_or_spend']))
    expect(result.safeScope).toContain('Launch, spend')
    expect(result.safeScope).toContain('outside this run')
  })

  it('does not block organic strategy when verified proof is missing', () => {
    const result = getStrategyBriefReadiness({
      mode: 'organic',
      brandProfile: { ...organicReadyBrand, verifiedProof: [] },
    })

    expect(result.canGenerate).toBe(true)
    expect(result.recommendedFields).toContain('verifiedProof')
    expect(result.warnings).toContain('verified_proof_missing')
    expect(result.blockers).not.toContain('organic_brief_incomplete')
  })
})
