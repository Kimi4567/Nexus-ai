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
    light:    { 30: 8,  90: 12, 180: 16 },
    standard: { 30: 10, 90: 14, 180: 18 },
    growth:   { 30: 12, 90: 16, 180: 20 },
    daily:    { 30: 14, 90: 18, 180: 22 },
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
    light:    { 30: 10, 90: 14, 180: 18, tier: 'Paid Basic' },
    standard: { 30: 12, 90: 16, 180: 20, tier: 'Paid Standard' },
    growth:   { 30: 14, 90: 18, 180: 22, tier: 'Paid Advanced' },
    daily:    { 30: 14, 90: 18, 180: 22, tier: 'Paid Advanced' },
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
    light:    { 30: 14, 90: 18, 180: 24 },
    standard: { 30: 16, 90: 21, 180: 27 },
    growth:   { 30: 18, 90: 24, 180: 30 },
    daily:    { 30: 20, 90: 27, 180: 34 },
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
  it('custom 1–30 uses 30-day price (Organic Standard 14d = 10)', () => {
    const r = getStrategyCreditCost(order('organic', 'standard', 'custom', 14))
    expect(r.cost).toBe(10)
    expect(r.durationBucket).toBe('30')
  })

  it('custom 31–60 uses ceil(30-day price * 1.2) (Organic Standard 45d = 12)', () => {
    const r = getStrategyCreditCost(order('organic', 'standard', 'custom', 45))
    expect(r.cost).toBe(12) // ceil(10 * 1.2) = 12
    expect(r.durationBucket).toBe('30')
  })

  it('custom 31–60 +20% rounds UP (Organic Light 45d = ceil(8*1.2)=10)', () => {
    expect(cost(order('organic', 'light', 'custom', 45))).toBe(10) // ceil(9.6)=10
  })

  it('custom 61–90 uses 90-day price (Organic Standard 75d = 14)', () => {
    const r = getStrategyCreditCost(order('organic', 'standard', 'custom', 75))
    expect(r.cost).toBe(14)
    expect(r.durationBucket).toBe('90')
  })

  it('custom 91–180 uses 180-day price (Organic Standard 160d = 18)', () => {
    const r = getStrategyCreditCost(order('organic', 'standard', 'custom', 160))
    expect(r.cost).toBe(18)
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
    expect(getStrategyCreditCost(order('organic', 'standard', 'custom', 60)).cost).toBe(12) // ceil(10*1.2)
    expect(getStrategyCreditCost(order('organic', 'standard', 'custom', 61)).durationBucket).toBe('90')
    expect(getStrategyCreditCost(order('organic', 'standard', 'custom', 90)).durationBucket).toBe('90')
    expect(getStrategyCreditCost(order('organic', 'standard', 'custom', 180)).durationBucket).toBe('180')
    expect(getStrategyCreditCost(order('organic', 'standard', 'custom', 181)).supported).toBe(false)
  })
})

describe('strategyPricing — required examples', () => {
  it('Organic Standard 160 (custom) = 18', () => {
    expect(cost(order('organic', 'standard', 'custom', 160))).toBe(18)
  })
  it('Full Standard 90 (preset) = 21', () => {
    expect(cost(order('full', 'standard', '90'))).toBe(21)
  })
  it('Paid Standard 90 (preset) = 16', () => {
    expect(cost(order('paid', 'standard', '90'))).toBe(16)
  })
  it('Organic Daily 30 (preset) = 14', () => {
    expect(cost(order('organic', 'daily', '30'))).toBe(14)
  })
  it('Custom 45 Organic Standard = 12 (ceil(10*1.2))', () => {
    expect(cost(order('organic', 'standard', 'custom', 45))).toBe(12)
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
