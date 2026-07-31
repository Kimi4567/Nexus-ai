import { describe, expect, it } from 'vitest'
import { buildProjectBrandContext } from '@/lib/projectBrandContext'

describe('project brand context', () => {
  it('replaces stale project identity with the current Brand Brain context', () => {
    expect(buildProjectBrandContext({
      brandName: 'Aster Property Marketing',
      industry: 'Real Estate',
      description: 'A Dubai real-estate marketing service.',
      targetAudience: 'Independent brokers and small agencies in Dubai.',
      primaryOffer: 'Evidence-backed property campaigns.',
    })).toEqual({
      name: 'Aster Property Marketing',
      description: 'A Dubai real-estate marketing service.',
      businessType: 'Real Estate',
      businessInfo: {
        brandName: 'Aster Property Marketing',
        industry: 'Real Estate',
        description: 'A Dubai real-estate marketing service.',
        targetAudience: 'Independent brokers and small agencies in Dubai.',
        primaryOffer: 'Evidence-backed property campaigns.',
      },
    })
  })

  it('never invents a project identity without a saved brand name', () => {
    expect(buildProjectBrandContext({
      industry: 'Real Estate',
      description: 'A description without an owner-confirmed brand name.',
    })).toBeNull()
  })
})
