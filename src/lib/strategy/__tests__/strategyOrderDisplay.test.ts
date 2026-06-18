import { describe, it, expect } from 'vitest'
import {
  INTENSITY_RANGE_LABEL,
  intensityLabel,
  tierToPostsPerMonth,
} from '@/lib/strategy/strategyOrderDisplay'

describe('strategyOrderDisplay — intensity ranges', () => {
  it('1. maps each intensity to its user-friendly range', () => {
    expect(INTENSITY_RANGE_LABEL.light).toBe('8–10')
    expect(INTENSITY_RANGE_LABEL.standard).toBe('12–16')
    expect(INTENSITY_RANGE_LABEL.growth).toBe('20–25')
    expect(INTENSITY_RANGE_LABEL.daily).toBe('30')
  })

  it('4. localized intensity labels (EN/AR)', () => {
    expect(intensityLabel('standard', 'en')).toBe('Standard')
    expect(intensityLabel('standard', 'ar')).toBe('قياسية')
    expect(intensityLabel('daily')).toBe('Daily')
  })
})

describe('strategyOrderDisplay — tier → postsPerMonth', () => {
  it('2. maps known tiers to the right quota', () => {
    expect(tierToPostsPerMonth('free')).toBe(3)
    expect(tierToPostsPerMonth('starter')).toBe(10)
    expect(tierToPostsPerMonth('growth')).toBe(25)
    expect(tierToPostsPerMonth('pro')).toBe(25)
    expect(tierToPostsPerMonth('agency')).toBe(60)
    expect(tierToPostsPerMonth('business')).toBe(60)
  })

  it('case-insensitive', () => {
    expect(tierToPostsPerMonth('Growth')).toBe(25)
    expect(tierToPostsPerMonth('AGENCY')).toBe(60)
  })

  it('3. unknown / null / undefined tier → undefined (caller omits planContext)', () => {
    expect(tierToPostsPerMonth('enterprise')).toBeUndefined()
    expect(tierToPostsPerMonth('')).toBeUndefined()
    expect(tierToPostsPerMonth(null)).toBeUndefined()
    expect(tierToPostsPerMonth(undefined)).toBeUndefined()
  })
})
