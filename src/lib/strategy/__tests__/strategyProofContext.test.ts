import { describe, expect, it } from 'vitest'
import { buildStrategyProofContextFromBrand } from '@/lib/strategy/strategyProofContext'

describe('strategy proof context', () => {
  it('keeps the same grounded brand fields available across generation and review', () => {
    const { recordedProof, proofContext } = buildStrategyProofContextFromBrand({
      description: 'Modern modest abayas for UAE customers',
      primaryOffer: 'Online abaya collection',
      targetAudience: 'Women in the UAE',
      audiencePainPoints: ['Hard to assess fit online'],
      audienceDesires: ['Clear product details'],
      writingStyle: 'Warm and precise',
      toneKeywords: ['elegant'],
      uniqueAdvantages: ['Modern modest design'],
      verifiedProof: [
        'Owner-confirmed category statement',
        'Published product catalog [Source: Catalog — https://example.com/catalog]',
      ],
    })

    expect(recordedProof).toHaveLength(2)
    expect(proofContext.allowedClaimText).toEqual(expect.arrayContaining([
      'Women in the UAE',
      'Hard to assess fit online',
      'Clear product details',
      'Warm and precise',
    ]))
    expect(proofContext.verifiedProof).toEqual(['Published product catalog'])
    expect(proofContext.commercialClaimText).toEqual(proofContext.verifiedProof)
  })
})
