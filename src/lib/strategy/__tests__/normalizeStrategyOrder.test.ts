import { describe, it, expect } from 'vitest'
import {
  normalizeStrategyOrder,
  normalizeContentIntensity,
  resolveStrategyCharge,
} from '@/lib/strategy/normalizeStrategyOrder'

describe('normalizeStrategyOrder — contentIntensity validation', () => {
  it('1. accepts each valid intensity', () => {
    for (const i of ['light', 'standard', 'growth', 'daily'] as const) {
      expect(normalizeStrategyOrder({ contentIntensity: i }).contentIntensity).toBe(i)
      expect(normalizeContentIntensity(i)).toBe(i)
    }
  })

  it('2. defaults invalid/missing intensity to standard', () => {
    expect(normalizeStrategyOrder({ contentIntensity: 'extreme' }).contentIntensity).toBe('standard')
    expect(normalizeStrategyOrder({ contentIntensity: 99 }).contentIntensity).toBe('standard')
    expect(normalizeStrategyOrder({}).contentIntensity).toBe('standard')
    expect(normalizeStrategyOrder(null).contentIntensity).toBe('standard')
    expect(normalizeContentIntensity(undefined)).toBe('standard')
  })
})

describe('normalizeStrategyOrder — type + duration', () => {
  it('accepts valid strategy types; defaults to organic', () => {
    expect(normalizeStrategyOrder({ strategyType: 'paid' }).strategyType).toBe('paid')
    expect(normalizeStrategyOrder({ strategyType: 'full' }).strategyType).toBe('full')
    expect(normalizeStrategyOrder({ strategyType: 'nonsense' }).strategyType).toBe('organic')
    expect(normalizeStrategyOrder({}).strategyType).toBe('organic')
  })

  it('validates durationPreset (from strategyDuration); defaults to 90', () => {
    expect(normalizeStrategyOrder({ strategyDuration: '30' }).durationPreset).toBe('30')
    expect(normalizeStrategyOrder({ strategyDuration: '180' }).durationPreset).toBe('180')
    expect(normalizeStrategyOrder({ strategyDuration: 'custom' }).durationPreset).toBe('custom')
    expect(normalizeStrategyOrder({ strategyDuration: 'weird' }).durationPreset).toBe('90')
    expect(normalizeStrategyOrder({}).durationPreset).toBe('90')
  })

  it('preset durationDays mirror the preset', () => {
    expect(normalizeStrategyOrder({ strategyDuration: '30' }).durationDays).toBe(30)
    expect(normalizeStrategyOrder({ strategyDuration: '90' }).durationDays).toBe(90)
    expect(normalizeStrategyOrder({ strategyDuration: '180' }).durationDays).toBe(180)
  })

  it('maps language bilingual → both; defaults to en', () => {
    expect(normalizeStrategyOrder({ language: 'bilingual' }).language).toBe('both')
    expect(normalizeStrategyOrder({ language: 'ar' }).language).toBe('ar')
    expect(normalizeStrategyOrder({ language: 'xx' }).language).toBe('en')
  })
})

describe('normalizeStrategyOrder — customDurationDays validation', () => {
  it('3. floors a numeric custom value', () => {
    expect(normalizeStrategyOrder({ strategyDuration: 'custom', customDurationDays: 45.9 }).durationDays).toBe(45)
    expect(normalizeStrategyOrder({ strategyDuration: 'custom', customDurationDays: '60' }).durationDays).toBe(60)
  })

  it('non-finite / ≤0 custom → 0 (→ unsupported, no charge)', () => {
    expect(normalizeStrategyOrder({ strategyDuration: 'custom', customDurationDays: 0 }).durationDays).toBe(0)
    expect(normalizeStrategyOrder({ strategyDuration: 'custom', customDurationDays: -10 }).durationDays).toBe(0)
    expect(normalizeStrategyOrder({ strategyDuration: 'custom', customDurationDays: 'abc' }).durationDays).toBe(0)
    expect(normalizeStrategyOrder({ strategyDuration: 'custom' }).durationDays).toBe(0)
  })

  it('over-180 custom is preserved (pricing flags unsupported)', () => {
    expect(normalizeStrategyOrder({ strategyDuration: 'custom', customDurationDays: 365 }).durationDays).toBe(365)
  })

  it('ignores customDurationDays for non-custom presets', () => {
    expect(normalizeStrategyOrder({ strategyDuration: '30', customDurationDays: 200 }).durationDays).toBe(30)
  })
})

describe('normalizeStrategyOrder — custom organic post count', () => {
  it('accepts and floors an exact organic post count', () => {
    expect(normalizeStrategyOrder({ customOrganicPostCount: 7.8 }).customOrganicPostCount).toBe(7)
    expect(normalizeStrategyOrder({ customOrganicPostCount: '12' }).customOrganicPostCount).toBe(12)
  })

  it('keeps invalid exact post counts as unsupported signals instead of silently defaulting', () => {
    expect(normalizeStrategyOrder({ customOrganicPostCount: 0 }).customOrganicPostCount).toBe(0)
    expect(normalizeStrategyOrder({ customOrganicPostCount: -2 }).customOrganicPostCount).toBe(-2)
    expect(normalizeStrategyOrder({ customOrganicPostCount: 'abc' }).customOrganicPostCount).toBe(0)
  })

  it('omits exact post count when not provided', () => {
    expect(normalizeStrategyOrder({}).customOrganicPostCount).toBeNull()
  })
})

describe('resolveStrategyCharge — required examples', () => {
  it('4a. Organic Standard 160 days (custom) = 32 credits', () => {
    const r = resolveStrategyCharge({ strategyType: 'organic', contentIntensity: 'standard', strategyDuration: 'custom', customDurationDays: 160 })
    expect(r.supported).toBe(true)
    expect(r.cost).toBe(32)
  })
  it('4b. Full Standard 90 days = 46 credits', () => {
    const r = resolveStrategyCharge({ strategyType: 'full', contentIntensity: 'standard', strategyDuration: '90' })
    expect(r.cost).toBe(46)
  })
  it('4c. Paid Standard 90 days = 32 credits', () => {
    const r = resolveStrategyCharge({ strategyType: 'paid', contentIntensity: 'standard', strategyDuration: '90' })
    expect(r.cost).toBe(32)
  })
  it('4d. Organic Daily 30 days = 28 credits', () => {
    const r = resolveStrategyCharge({ strategyType: 'organic', contentIntensity: 'daily', strategyDuration: '30' })
    expect(r.cost).toBe(28)
  })
  it('4e. Custom 45 Organic Standard = 20 credits', () => {
    const r = resolveStrategyCharge({ strategyType: 'organic', contentIntensity: 'standard', strategyDuration: 'custom', customDurationDays: 45 })
    expect(r.cost).toBe(20)
  })

  it('4f. Organic exact 7 posts uses the light pricing tier and preserves exact count', () => {
    const r = resolveStrategyCharge({
      strategyType: 'organic',
      contentIntensity: 'daily',
      strategyDuration: '30',
      customOrganicPostCount: 7,
    })
    expect(r.supported).toBe(true)
    expect(r.cost).toBe(12)
    expect(r.order.customOrganicPostCount).toBe(7)
    expect(r.pricing.tierLabel).toBe('Organic Light')
  })

  it('4g. Full exact 22 posts uses the growth pricing tier', () => {
    const r = resolveStrategyCharge({
      strategyType: 'full',
      contentIntensity: 'light',
      strategyDuration: '90',
      customOrganicPostCount: 22,
    })
    expect(r.supported).toBe(true)
    expect(r.cost).toBe(60)
    expect(r.pricing.tierLabel).toBe('Full Growth')
  })
})

describe('resolveStrategyCharge — unsupported custom > 180 (no charge)', () => {
  it('5a. custom 365 → supported:false, cost:null', () => {
    const r = resolveStrategyCharge({ strategyType: 'organic', contentIntensity: 'standard', strategyDuration: 'custom', customDurationDays: 365 })
    expect(r.supported).toBe(false)
    expect(r.cost).toBeNull()
  })
  it('5b. custom 181 (boundary) → unsupported', () => {
    const r = resolveStrategyCharge({ strategyType: 'full', contentIntensity: 'growth', strategyDuration: 'custom', customDurationDays: 181 })
    expect(r.supported).toBe(false)
    expect(r.cost).toBeNull()
  })
  it('5c. custom 0 / invalid → unsupported (no charge)', () => {
    const r = resolveStrategyCharge({ strategyType: 'organic', contentIntensity: 'standard', strategyDuration: 'custom', customDurationDays: 0 })
    expect(r.supported).toBe(false)
    expect(r.cost).toBeNull()
  })
  it('5d. custom 180 (boundary) is supported and charged', () => {
    const r = resolveStrategyCharge({ strategyType: 'organic', contentIntensity: 'standard', strategyDuration: 'custom', customDurationDays: 180 })
    expect(r.supported).toBe(true)
    expect(r.cost).toBe(32) // 91–180 → 180-day price
  })

  it('5e. custom organic post count > 30 is unsupported and never chargeable', () => {
    const r = resolveStrategyCharge({
      strategyType: 'organic',
      strategyDuration: '30',
      contentIntensity: 'standard',
      customOrganicPostCount: 31,
    })
    expect(r.supported).toBe(false)
    expect(r.cost).toBeNull()
    expect(r.pricing.pricingExplanation).toMatch(/custom organic post count/i)
  })
})

describe('resolveStrategyCharge — never trusts a client price', () => {
  it('ignores any client-supplied cost/price field on the body', () => {
    const r = resolveStrategyCharge({
      strategyType: 'organic', contentIntensity: 'standard', strategyDuration: '30',
      // adversarial extras that must be ignored:
      cost: 1, price: 0, credits: 999,
    } as any)
    expect(r.cost).toBe(16) // Organic Standard 30 = 16, recomputed
  })

  it('purity — same input yields identical result; no mutation', () => {
    const input = { strategyType: 'full', contentIntensity: 'growth', strategyDuration: 'custom', customDurationDays: 120 }
    const snap = JSON.stringify(input)
    const a = resolveStrategyCharge(input)
    const b = resolveStrategyCharge(input)
    expect(a).toEqual(b)
    expect(JSON.stringify(input)).toBe(snap)
  })
})
