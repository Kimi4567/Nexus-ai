import { describe, expect, it } from 'vitest'
import {
  BRAND_INDUSTRY_OPTIONS,
  getBrandIndustryLabel,
  normalizeBrandIndustry,
} from '@/lib/brandIndustries'

describe('Brand Brain industry vocabulary', () => {
  it('normalizes onboarding codes and old localized labels to one stable value', () => {
    expect(normalizeBrandIndustry('saas')).toBe('Tech & Apps')
    expect(normalizeBrandIndustry('تقنية وتطبيقات')).toBe('Tech & Apps')
    expect(normalizeBrandIndustry('Software & Tech')).toBe('Tech & Apps')
  })

  it('keeps unknown user-provided industries instead of guessing', () => {
    expect(normalizeBrandIndustry('Specialty marine logistics')).toBe('Specialty marine logistics')
  })

  it('uses localized labels without changing the persisted value', () => {
    expect(getBrandIndustryLabel('Tech & Apps', 'ar')).toBe('برمجيات وتقنية')
    expect(getBrandIndustryLabel('Tech & Apps', 'en')).toBe('Software & Tech')
    expect(BRAND_INDUSTRY_OPTIONS.some(option => option.value === 'Tech & Apps')).toBe(true)
  })
})
