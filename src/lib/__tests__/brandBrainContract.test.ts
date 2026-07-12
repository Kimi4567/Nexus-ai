import { describe, expect, it } from 'vitest'
import { buildBrandBrainContract, getChangedBrandFields } from '@/lib/brandBrainContract'

describe('Brand Brain v3 contract', () => {
  it('separates confirmed facts, legacy candidates, missing data, and inference', () => {
    const contract = buildBrandBrainContract({
      brandName: 'Nexus',
      businessGoal: 'Qualified leads',
      winningHooks: ['Fast growth'],
      aiInsights: { summary: 'model inference' },
      updatedAt: new Date('2026-07-12T10:00:00.000Z'),
    })

    const fields = contract.layers.flatMap((layer) => layer.fields)
    expect(fields.find((field) => field.key === 'brandName')).toMatchObject({
      status: 'confirmed',
      source: 'user_confirmed',
    })
    expect(fields.find((field) => field.key === 'winningHooks')).toMatchObject({
      status: 'candidate',
      source: 'legacy_candidate',
    })
    expect(fields.find((field) => field.key === 'primaryOffer')).toMatchObject({
      status: 'missing',
      source: 'none',
    })
    expect(contract.inference).toEqual({ available: true, injectedAsTruth: false })
  })

  it('marks user-accepted learning separately and exposes pending fields', () => {
    const contract = buildBrandBrainContract(
      { strategicNotes: 'Customers respond to proof' },
      {
        revisionNumber: 4,
        learnedFields: ['strategicNotes'],
        pendingLearningFields: ['toneKeywords', 'toneKeywords', 'uniqueAdvantages'],
        lastChangedFields: ['strategicNotes'],
      },
    )

    const strategicNotes = contract.layers.flatMap((layer) => layer.fields)
      .find((field) => field.key === 'strategicNotes')
    expect(strategicNotes?.source).toBe('accepted_learning')
    expect(contract.revision).toMatchObject({ number: 4, lastChangedFields: ['strategicNotes'] })
    expect(contract.pendingLearning).toEqual({ count: 2, fields: ['toneKeywords', 'uniqueAdvantages'] })
  })

  it('detects only real normalized changes', () => {
    expect(getChangedBrandFields(
      { brandName: ' Nexus ', toneKeywords: ['Bold'] },
      { brandName: 'Nexus', toneKeywords: ['Bold'], primaryOffer: 'Automation' },
    )).toEqual(['primaryOffer'])
  })
})
