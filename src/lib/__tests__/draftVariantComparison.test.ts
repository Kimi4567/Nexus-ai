import { describe, expect, it } from 'vitest'
import { getDraftVariantComparison } from '@/lib/draftVariantComparison'

const strategy = {
  experimentBacklog: [
    {
      hypothesis: 'A question-led hook may earn more qualified attention than a statement-led hook.',
      variable: 'Opening hook only',
      successSignal: 'Verified saves and qualified landing-page visits by variant',
      minimumEvidence: 'At least 1,000 verified impressions per variant',
      decisionRule: 'Continue only when the same variant clears the evidence floor and improves the success signal.',
    },
    {
      hypothesis: 'Proof-first copy may improve qualified responses.',
      variable: 'Proof placement only',
      successSignal: 'Verified qualified replies',
      minimumEvidence: 'At least 50 verified replies across both variants',
      decisionRule: 'Keep the proof-first version only if qualified reply rate is higher.',
    },
  ],
}

describe('draft variant comparison truth', () => {
  it('links each content slot to a complete reviewed experiment contract', () => {
    expect(getDraftVariantComparison(strategy, 2)).toEqual({
      ...strategy.experimentBacklog[1],
      measurementState: 'draft_preference_only',
    })
  })

  it('cycles deterministically and never upgrades preference into performance evidence', () => {
    expect(getDraftVariantComparison(strategy, 3)).toMatchObject({
      hypothesis: strategy.experimentBacklog[0].hypothesis,
      measurementState: 'draft_preference_only',
    })
  })

  it('returns null for incomplete experiment instructions', () => {
    expect(getDraftVariantComparison({
      experimentBacklog: [{ hypothesis: 'Maybe this is better', variable: 'hook' }],
    }, 1)).toBeNull()
    expect(getDraftVariantComparison({}, 1)).toBeNull()
  })
})
