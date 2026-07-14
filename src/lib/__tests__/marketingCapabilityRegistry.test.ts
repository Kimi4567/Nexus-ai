import { describe, expect, it } from 'vitest'
import { MARKETING_CAPABILITIES, capabilitiesByStatus } from '@/lib/marketingCapabilityRegistry'

describe('marketing capability registry', () => {
  it('uses unique IDs and only explicit readiness states', () => {
    const ids = MARKETING_CAPABILITIES.map((capability) => capability.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(MARKETING_CAPABILITIES.every((capability) =>
      ['operational', 'conditional', 'planned'].includes(capability.status),
    )).toBe(true)
  })

  it('keeps external execution conditional and missing departments planned', () => {
    expect(capabilitiesByStatus('conditional').map((item) => item.id)).toEqual(
      expect.arrayContaining(['organic_distribution', 'paid_media', 'measurement_learning']),
    )
    expect(capabilitiesByStatus('planned').map((item) => item.id)).toEqual(
      expect.arrayContaining(['crm_leads', 'customer_lifecycle', 'seo_cro']),
    )
  })
})
