import { describe, expect, it } from 'vitest'
import { buildBrandTruthRegistry } from '@/lib/brandTruthRegistry'

describe('brand truth registry', () => {
  it('keeps owner-entered facts distinct from source-confirmed truth', () => {
    const summary = buildBrandTruthRegistry({
      profile: {
        primaryOffer: 'Premium abayas',
        pricePoint: 'AED 500',
        verifiedProof: ['Owner confirms nationwide delivery'],
      },
    })

    expect(summary.areas.find(area => area.key === 'offer')?.status).toBe('OWNER_CONFIRMED')
    expect(summary.areas.find(area => area.key === 'pricing')?.status).toBe('OWNER_CONFIRMED')
    expect(summary.areas.find(area => area.key === 'delivery')?.status).toBe('OWNER_CONFIRMED')
    expect(summary.restrictedStrongClaimKeys).toEqual(expect.arrayContaining(['offer', 'pricing', 'delivery']))
  })

  it('unlocks only the truth areas supported by approved source claims', () => {
    const summary = buildBrandTruthRegistry({
      profile: { primaryOffer: 'Abayas' },
      claims: [
        { claim: 'Prices start at AED 450', category: 'OFFER', status: 'APPROVED', truthStatus: 'CONFIRMED' },
        { claim: 'Returns are accepted within 14 days', category: 'POLICY', status: 'APPROVED', truthStatus: 'CONFIRMED' },
      ],
    })

    expect(summary.areas.find(area => area.key === 'pricing')?.status).toBe('SOURCE_CONFIRMED')
    expect(summary.areas.find(area => area.key === 'returns')?.status).toBe('SOURCE_CONFIRMED')
    expect(summary.restrictedStrongClaimKeys).not.toContain('pricing')
    expect(summary.restrictedStrongClaimKeys).not.toContain('returns')
    expect(summary.restrictedStrongClaimKeys).toContain('delivery')
  })

  it('surfaces conflicts before an older confirmed fact and tracks real execution assets', () => {
    const summary = buildBrandTruthRegistry({
      profile: {
        conversionDestination: 'https://example.com/shop',
        campaignObjective: 'sales',
      },
      claims: [
        { claim: 'Delivery takes 2 days', category: 'POLICY', status: 'APPROVED', truthStatus: 'CONFIRMED' },
        { claim: 'Delivery takes 5 days', category: 'POLICY', status: 'PENDING', truthStatus: 'CONFLICTING' },
      ],
      visualAssetCount: 3,
    })

    expect(summary.areas.find(area => area.key === 'delivery')?.status).toBe('CONFLICTING')
    expect(summary.areas.find(area => area.key === 'visual_assets')?.status).toBe('SOURCE_CONFIRMED')
    expect(summary.areas.find(area => area.key === 'conversion_path')?.status).toBe('OWNER_CONFIRMED')
    expect(summary.conversionReady).toBe(true)
    expect(summary.visualAssetCount).toBe(3)
  })

  it('does not turn explicitly denied proof gaps into owner-confirmed facts', () => {
    const summary = buildBrandTruthRegistry({
      profile: {
        primaryOffer: 'Modern modest abayas',
        verifiedProof: [
          'Owner confirms the category and market only, not quality, price, delivery, customer results, or performance.',
        ],
      },
    })

    expect(summary.areas.find(area => area.key === 'delivery')?.status).toBe('MISSING')
    expect(summary.areas.find(area => area.key === 'materials_quality')?.status).toBe('MISSING')
    expect(summary.areas.find(area => area.key === 'commercial_proof')?.status).toBe('MISSING')
  })
})
