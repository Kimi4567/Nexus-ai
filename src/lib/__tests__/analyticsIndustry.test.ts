/**
 * PR-1L — Analytics industry truth. Map the real Brand Brain industry to a sector,
 * and NEVER fall back to a guessed "ecommerce" when it's missing/unknown.
 */
import { describe, it, expect } from 'vitest'
import { mapBrandIndustryToAnalytics } from '@/lib/analyticsIndustry'

describe('mapBrandIndustryToAnalytics (PR-1L)', () => {
  it('maps a known brand industry to its sector', () => {
    expect(mapBrandIndustryToAnalytics('Tech & Apps')).toBe('tech')
    expect(mapBrandIndustryToAnalytics('E-commerce')).toBe('ecommerce')
    expect(mapBrandIndustryToAnalytics('Restaurants & Food')).toBe('food')
    expect(mapBrandIndustryToAnalytics('Fashion & Apparel')).toBe('fashion')
    expect(mapBrandIndustryToAnalytics('Health & Beauty')).toBe('health')
    expect(mapBrandIndustryToAnalytics('Real Estate')).toBe('realestate')
    expect(mapBrandIndustryToAnalytics('Education & Training')).toBe('education')
    expect(mapBrandIndustryToAnalytics('Professional Services')).toBe('services')
  })

  it('a missing industry NEVER returns "ecommerce" — returns the unset state', () => {
    expect(mapBrandIndustryToAnalytics(null)).toBe('')
    expect(mapBrandIndustryToAnalytics(undefined)).toBe('')
    expect(mapBrandIndustryToAnalytics('')).toBe('')
    expect(mapBrandIndustryToAnalytics('   ')).toBe('')
    expect(mapBrandIndustryToAnalytics(null)).not.toBe('ecommerce')
  })

  it('does not invent/infer a sector for an unknown industry (no guessing)', () => {
    expect(mapBrandIndustryToAnalytics('Spaceship Manufacturing')).toBe('')
    expect(mapBrandIndustryToAnalytics('Travel & Tourism')).toBe('')
    expect(mapBrandIndustryToAnalytics('Automotive')).toBe('')
    expect(mapBrandIndustryToAnalytics('Other')).toBe('')
  })

  it('is case- and whitespace-insensitive', () => {
    expect(mapBrandIndustryToAnalytics('  tech  ')).toBe('tech')
    expect(mapBrandIndustryToAnalytics('SAAS')).toBe('tech')
    expect(mapBrandIndustryToAnalytics('e-commerce')).toBe('ecommerce')
  })

  it('non-string input is treated as unset', () => {
    expect(mapBrandIndustryToAnalytics(123 as never)).toBe('')
  })
})
