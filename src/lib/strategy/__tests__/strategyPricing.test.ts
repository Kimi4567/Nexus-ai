import { describe, it, expect } from 'vitest'
import { getStrategyCreditCost } from '@/lib/strategy/strategyPricing'
import type { StrategyOrder, StrategyType, ContentIntensity, DurationPreset } from '@/lib/strategy/strategyOrder'

const order = (
  strategyType: StrategyType,
  contentIntensity: ContentIntensity,
  durationPreset: DurationPreset,
  durationDays?: number,
): StrategyOrder => ({
  strategyType,
  contentIntensity,
  durationPreset,
  durationDays: durationDays ?? (durationPreset === 'custom' ? 45 : Number(durationPreset)),
  goal: 'leads',
  language: 'en',
})

const cost = (o: StrategyOrder) => getStrategyCreditCost(o).cost

describe('strategyPricing — Organic matrix', () => {
  const M = {
    light:    { 30: 12, 90: 18, 180: 24 },
    standard: { 30: 16, 90: 24, 180: 32 },
    growth:   { 30: 22, 90: 32, 180: 42 },
    daily:    { 30: 28, 90: 40, 180: 54 },
  } as const
  for (const intensity of ['light', 'standard', 'growth', 'daily'] as const) {
    for (const dur of ['30', '90', '180'] as const) {
      it(`Organic ${intensity} ${dur} = ${M[intensity][dur]}`, () => {
        expect(cost(order('organic', intensity, dur))).toBe(M[intensity][dur])
      })
    }
  }
})

describe('strategyPricing — Paid matrix + intensity→tier', () => {
  // light→Basic, standard→Standard, growth/daily→Advanced
  const EXPECT = {
    light:    { 30: 16, 90: 24, 180: 32, tier: 'Paid Basic' },
    standard: { 30: 22, 90: 32, 180: 42, tier: 'Paid Standard' },
    growth:   { 30: 28, 90: 40, 180: 54, tier: 'Paid Advanced' },
    daily:    { 30: 28, 90: 40, 180: 54, tier: 'Paid Advanced' },
  } as const
  for (const intensity of ['light', 'standard', 'growth', 'daily'] as const) {
    for (const dur of ['30', '90', '180'] as const) {
      it(`Paid ${intensity} ${dur} = ${EXPECT[intensity][dur]} (${EXPECT[intensity].tier})`, () => {
        const r = getStrategyCreditCost(order('paid', intensity, dur))
        expect(r.cost).toBe(EXPECT[intensity][dur])
        expect(r.tierLabel).toBe(EXPECT[intensity].tier)
      })
    }
  }
})

describe('strategyPricing — Full matrix', () => {
  const M = {
    light:    { 30: 24, 90: 34, 180: 46 },
    standard: { 30: 32, 90: 46, 180: 60 },
    growth:   { 30: 42, 90: 60, 180: 78 },
    daily:    { 30: 54, 90: 76, 180: 96 },
  } as const
  for (const intensity of ['light', 'standard', 'growth', 'daily'] as const) {
    for (const dur of ['30', '90', '180'] as const) {
      it(`Full ${intensity} ${dur} = ${M[intensity][dur]}`, () => {
        expect(cost(order('full', intensity, dur))).toBe(M[intensity][dur])
      })
    }
  }
})

describe('strategyPricing — custom duration rules', () => {
  it('custom 1–30 uses 30-day price (Organic Standard 14d = 16)', () => {
    const r = getStrategyCreditCost(order('organic', 'standard', 'custom', 14))
    expect(r.cost).toBe(16)
    expect(r.durationBucket).toBe('30')
  })

  it('custom 31–60 uses ceil(30-day price * 1.2) (Organic Standard 45d = 20)', () => {
    const r = getStrategyCreditCost(order('organic', 'standard', 'custom', 45))
    expect(r.cost).toBe(20) // ceil(16 * 1.2) = 20
    expect(r.durationBucket).toBe('30')
  })

  it('custom 31–60 +20% rounds UP (Organic Light 45d = ceil(12*1.2)=15)', () => {
    expect(cost(order('organic', 'light', 'custom', 45))).toBe(15) // ceil(14.4)=15
  })

  it('custom 61–90 uses 90-day price (Organic Standard 75d = 24)', () => {
    const r = getStrategyCreditCost(order('organic', 'standard', 'custom', 75))
    expect(r.cost).toBe(24)
    expect(r.durationBucket).toBe('90')
  })

  it('custom 91–180 uses 180-day price (Organic Standard 160d = 32)', () => {
    const r = getStrategyCreditCost(order('organic', 'standard', 'custom', 160))
    expect(r.cost).toBe(32)
    expect(r.durationBucket).toBe('180')
  })

  it('custom > 180 → supported:false, cost:null, custom-unsupported', () => {
    const r = getStrategyCreditCost(order('organic', 'standard', 'custom', 365))
    expect(r.supported).toBe(false)
    expect(r.cost).toBeNull()
    expect(r.durationBucket).toBe('custom-unsupported')
    expect(r.pricingExplanation.toLowerCase()).toMatch(/not supported|custom quote/)
  })

  it('custom boundaries: 30→30col, 60→30col+20%, 61→90col, 90→90col, 180→180col, 181→unsupported', () => {
    expect(getStrategyCreditCost(order('organic', 'standard', 'custom', 30)).durationBucket).toBe('30')
    expect(getStrategyCreditCost(order('organic', 'standard', 'custom', 60)).cost).toBe(20) // ceil(16*1.2)
    expect(getStrategyCreditCost(order('organic', 'standard', 'custom', 61)).durationBucket).toBe('90')
    expect(getStrategyCreditCost(order('organic', 'standard', 'custom', 90)).durationBucket).toBe('90')
    expect(getStrategyCreditCost(order('organic', 'standard', 'custom', 180)).durationBucket).toBe('180')
    expect(getStrategyCreditCost(order('organic', 'standard', 'custom', 181)).supported).toBe(false)
  })
})

describe('strategyPricing — exact organic post count', () => {
  it('uses the exact post count to derive the organic tier', () => {
    const r = getStrategyCreditCost({
      ...order('organic', 'daily', '90'),
      customOrganicPostCount: 7,
    })
    expect(r.cost).toBe(18)
    expect(r.tierLabel).toBe('Organic Light')
    expect(r.pricingExplanation).toMatch(/exact 7 organic post directions/i)
  })

  it('uses exact count to derive full-strategy tier', () => {
    const r = getStrategyCreditCost({
      ...order('full', 'light', '90'),
      customOrganicPostCount: 17,
    })
    expect(r.cost).toBe(60)
    expect(r.tierLabel).toBe('Full Growth')
  })

  it('ignores exact organic post count for paid-only pricing', () => {
    const r = getStrategyCreditCost({
      ...order('paid', 'standard', '90'),
      customOrganicPostCount: 7,
    })
    expect(r.cost).toBe(32)
    expect(r.tierLabel).toBe('Paid Standard')
  })

  it('blocks exact organic post counts outside the first-30-day supported range', () => {
    const r = getStrategyCreditCost({
      ...order('organic', 'standard', '30'),
      customOrganicPostCount: 31,
    })
    expect(r.supported).toBe(false)
    expect(r.cost).toBeNull()
    expect(r.pricingExplanation).toMatch(/1-30/)
  })
})

describe('strategyPricing — plan-capped output', () => {
  it('prices Organic from the post count the Free plan can actually deliver', () => {
    const r = getStrategyCreditCost(order('organic', 'daily', '180'), { postsPerMonth: 3 })

    expect(r.cost).toBe(24)
    expect(r.tierLabel).toBe('Organic Light')
    expect(r.pricingExplanation).toMatch(/plan-adjusted to 3 of 30 requested/i)
  })

  it('prices Full from the post count the Free plan can actually deliver', () => {
    const r = getStrategyCreditCost({
      ...order('full', 'daily', '180'),
      customOrganicPostCount: 30,
    }, { postsPerMonth: 3 })

    expect(r.cost).toBe(46)
    expect(r.tierLabel).toBe('Full Light')
    expect(r.pricingExplanation).toMatch(/plan-adjusted to 3 of 30 requested/i)
  })

  it('keeps paid-only pricing independent from organic post quotas', () => {
    const r = getStrategyCreditCost(order('paid', 'standard', '90'), { postsPerMonth: 3 })

    expect(r.cost).toBe(32)
    expect(r.tierLabel).toBe('Paid Standard')
  })
})

describe('strategyPricing — required examples', () => {
  it('Organic Standard 160 (custom) = 32', () => {
    expect(cost(order('organic', 'standard', 'custom', 160))).toBe(32)
  })
  it('Full Standard 90 (preset) = 46', () => {
    expect(cost(order('full', 'standard', '90'))).toBe(46)
  })
  it('Paid Standard 90 (preset) = 32', () => {
    expect(cost(order('paid', 'standard', '90'))).toBe(32)
  })
  it('Organic Daily 30 (preset) = 28', () => {
    expect(cost(order('organic', 'daily', '30'))).toBe(28)
  })
  it('Custom 45 Organic Standard = 20 (ceil(16*1.2))', () => {
    expect(cost(order('organic', 'standard', 'custom', 45))).toBe(20)
  })
})

describe('strategyPricing — purity & shape', () => {
  it('is deterministic — same input → identical output', () => {
    const o = order('full', 'growth', 'custom', 120)
    expect(getStrategyCreditCost(o)).toEqual(getStrategyCreditCost(o))
  })

  it('does not mutate the input order', () => {
    const o = order('paid', 'daily', 'custom', 50)
    const snapshot = JSON.stringify(o)
    getStrategyCreditCost(o)
    expect(JSON.stringify(o)).toBe(snapshot)
  })

  it('returns the documented shape and no deduction/credit fields', () => {
    const r = getStrategyCreditCost(order('organic', 'standard', '90'))
    expect(r).toHaveProperty('cost')
    expect(r).toHaveProperty('supported')
    expect(r).toHaveProperty('tierLabel')
    expect(r).toHaveProperty('durationBucket')
    expect(r).toHaveProperty('pricingExplanation')
    expect(r).not.toHaveProperty('creditsUsed')
    expect(r).not.toHaveProperty('deducted')
    expect(r).not.toHaveProperty('balance')
  })
})
