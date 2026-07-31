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

  it('keeps a real-estate marketing service focused on applicable proof areas', () => {
    const summary = buildBrandTruthRegistry({
      profile: {
        industry: 'عقارات',
        description: 'شركة تسويق عقاري في دبي تساعد الوسطاء والمطورين على إنتاج حملات محتوى موثقة.',
        primaryOffer: 'استراتيجية وحملات محتوى عقاري مبنية على صور وبيانات يزوّد بها العميل',
      },
    })

    expect(summary.businessModel).toBe('SERVICE')
    expect(summary.areas.map(area => area.key)).toEqual([
      'offer',
      'pricing',
      'commercial_proof',
      'visual_assets',
      'conversion_path',
    ])
    expect(summary.restrictedStrongClaimKeys).toEqual([
      'offer',
      'pricing',
      'commercial_proof',
    ])
  })

  it('keeps explicit operational proof visible for a service brand', () => {
    const summary = buildBrandTruthRegistry({
      profile: {
        industry: 'Marketing agency',
        primaryOffer: 'Campaign strategy service',
        verifiedProof: ['Owner confirms delivery within five business days'],
      },
    })

    expect(summary.businessModel).toBe('SERVICE')
    expect(summary.areas.find(area => area.key === 'delivery')?.status).toBe('OWNER_CONFIRMED')
    expect(summary.restrictedStrongClaimKeys).toContain('delivery')
  })
})
