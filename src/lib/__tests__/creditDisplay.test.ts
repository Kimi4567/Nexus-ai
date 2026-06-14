/**
 * Honest credit display helper tests (Phase 1: Product Truth).
 * Pure formatter — never shows numerator > denominator; percent clamps 0..100.
 */
import { describe, it, expect } from 'vitest'
import { formatCreditDisplay } from '@/lib/creditDisplay'

describe('formatCreditDisplay', () => {
  // 1. Normal: 87 / 150
  it('renders normal quota when available ≤ monthly (EN)', () => {
    const r = formatCreditDisplay({ availableCredits: 87, monthlyCredits: 150, locale: 'en' })
    expect(r.primary).toBe('87 / 150 credits available this month')
    expect(r.secondary).toBeNull()
    expect(r.overGrant).toBe(false)
    expect(r.percent).toBe(58)
  })

  // 2. Exactly at grant: 150 / 150 → normal, not over, 100%
  it('treats available == monthly as normal (100%, not over-grant)', () => {
    const r = formatCreditDisplay({ availableCredits: 150, monthlyCredits: 150, locale: 'en' })
    expect(r.primary).toBe('150 / 150 credits available this month')
    expect(r.overGrant).toBe(false)
    expect(r.percent).toBe(100)
  })

  // 3. Over grant: 246 / 150 → NEVER "246 / 150"
  it('never shows numerator > denominator when over the grant (EN)', () => {
    const r = formatCreditDisplay({ availableCredits: 246, monthlyCredits: 150, locale: 'en' })
    expect(r.primary).toBe('246 credits available')
    expect(r.primary).not.toContain('/')
    expect(r.secondary).toContain('Your plan grants 150 credits/month')
    expect(r.overGrant).toBe(true)
    expect(r.percent).toBe(100)
  })

  // 3b. Over grant in Arabic
  it('renders over-grant honestly in Arabic', () => {
    const r = formatCreditDisplay({ availableCredits: 246, monthlyCredits: 150, locale: 'ar' })
    expect(r.primary).toBe('246 كريدت متاح')
    expect(r.secondary).toContain('خطتك تمنحك 150 كريدت شهريًا')
    expect(r.overGrant).toBe(true)
  })

  // 4. Zero available
  it('handles 0 available safely', () => {
    const r = formatCreditDisplay({ availableCredits: 0, monthlyCredits: 150, locale: 'en' })
    expect(r.primary).toBe('0 / 150 credits available this month')
    expect(r.percent).toBe(0)
    expect(r.overGrant).toBe(false)
  })

  // 5. Free / zero monthly grant → no denominator, no "/0"
  it('shows no denominator when monthly grant is 0 (free one-time credits)', () => {
    const r = formatCreditDisplay({ availableCredits: 10, monthlyCredits: 0, locale: 'en' })
    expect(r.primary).toBe('10 credits available')
    expect(r.primary).not.toContain('/')
    expect(r.percent).toBe(100)
    const rAr = formatCreditDisplay({ availableCredits: 10, monthlyCredits: 0, locale: 'ar' })
    expect(rAr.primary).toBe('10 كريدت متاح')
  })

  // 6. null / missing values do not crash
  it('does not crash on null/undefined/NaN', () => {
    expect(() => formatCreditDisplay({ availableCredits: null, monthlyCredits: null })).not.toThrow()
    const r = formatCreditDisplay({ availableCredits: null, monthlyCredits: undefined })
    expect(r.primary).toBe('0 credits available') // monthly 0 → no denominator
    expect(r.percent).toBe(0)
    const r2 = formatCreditDisplay({ availableCredits: NaN, monthlyCredits: 150 })
    expect(r2.primary).toBe('0 / 150 credits available this month')
  })

  // 7. Percent clamps at 100 even far over grant
  it('clamps percent to 100 when far over the grant', () => {
    const r = formatCreditDisplay({ availableCredits: 9999, monthlyCredits: 150 })
    expect(r.percent).toBe(100)
    expect(r.percent).toBeLessThanOrEqual(100)
  })

  // 8. Unlimited (-1) sentinel
  it('renders unlimited safely', () => {
    const r = formatCreditDisplay({ availableCredits: -1, monthlyCredits: -1, locale: 'en' })
    expect(r.isUnlimited).toBe(true)
    expect(r.percent).toBe(100)
    const c = formatCreditDisplay({ availableCredits: -1, monthlyCredits: 150, compact: true })
    expect(c.primary).toBe('∞')
  })

  // 9. Compact (sidebar chip) forms
  it('compact form: numbers only, no overflow text', () => {
    expect(formatCreditDisplay({ availableCredits: 87, monthlyCredits: 150, compact: true }).primary).toBe('87 / 150')
    expect(formatCreditDisplay({ availableCredits: 246, monthlyCredits: 150, compact: true }).primary).toBe('246')
  })

  // 10. Floats/negatives normalize safely
  it('normalizes floats and negatives to safe integers', () => {
    const r = formatCreditDisplay({ availableCredits: 86.7 as number, monthlyCredits: 150 })
    expect(r.primary).toBe('86 / 150 credits available this month')
    const neg = formatCreditDisplay({ availableCredits: -5 as number, monthlyCredits: 150 })
    expect(neg.primary).toBe('0 / 150 credits available this month')
  })
})
