import { describe, it, expect } from 'vitest'
import { buildStrategistPrompts, type BusinessBrief } from '@/lib/agents/strategist'
import { getStrategyDeliverables } from '@/lib/strategy/deliverablesContract'
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

/** Build a brief with the deterministic contract attached, the way the route does. */
const briefWith = (o: StrategyOrder, postsPerMonth?: number): BusinessBrief => {
  const d = getStrategyDeliverables(o, typeof postsPerMonth === 'number' ? { postsPerMonth } : undefined)
  return {
    companyName: 'NEXUS AI',
    businessType: 'SaaS',
    targetAudience: 'SME owners',
    monthlyBudget: 5000,
    primaryGoal: 'leads',
    language: 'en',
    strategyType: o.strategyType,
    strategyDuration: o.durationPreset,
    strategyOrder: o,
    strategyDeliverables: d,
    generationInstructions: d.generationInstructions,
    organicPostCount: d.organicPostCount,
    detailedCalendarDays: d.detailedCalendarDays,
    roadmapMonths: d.roadmapMonths,
    planCapApplied: d.planCapApplied,
  }
}

const sys = (b: BusinessBrief) => buildStrategistPrompts(b).systemPrompt

describe('buildStrategistPrompts — binding scope wiring', () => {
  it('includes the binding-scope header when generationInstructions is present', () => {
    const s = sys(briefWith(order('organic', 'standard', '90')))
    expect(s).toContain('BINDING GENERATION SCOPE')
    expect(s).toContain('The following scope is binding. Do not exceed it.')
    expect(s).toMatch(/label it as "not included"/i)
  })

  it('back-compat: NO binding block when generationInstructions is absent', () => {
    const b: BusinessBrief = {
      companyName: 'X', businessType: 'Y', targetAudience: 'Z', monthlyBudget: 1000, language: 'en',
    }
    const s = sys(b)
    expect(s).not.toContain('BINDING GENERATION SCOPE')
    // existing prompt still intact
    expect(s).toContain('expert marketing strategist')
  })
})

describe('buildStrategistPrompts — 30 / 90 / 180 horizon', () => {
  it('3+4. 90-day: FIRST 30 DAYS ONLY + no day-by-day for the full 90-day horizon', () => {
    const s = sys(briefWith(order('organic', 'standard', '90')))
    expect(s).toMatch(/FIRST 30 DAYS ONLY/i)
    expect(s).toMatch(/do NOT generate posts for every day of the full 90-day horizon/i)
  })

  it('3+4. 180-day: FIRST 30 DAYS ONLY + no day-by-day for the full 180-day horizon', () => {
    const s = sys(briefWith(order('organic', 'standard', '180')))
    expect(s).toMatch(/FIRST 30 DAYS ONLY/i)
    expect(s).toMatch(/do NOT generate posts for every day of the full 180-day horizon/i)
    expect(s).toContain('6-month roadmap')
  })

  it('5. never imply all days are scheduled/published (90/180)', () => {
    expect(sys(briefWith(order('organic', 'standard', '90')))).toMatch(/do NOT imply that all days .* are scheduled or published/i)
    expect(sys(briefWith(order('full', 'growth', '180')))).toMatch(/do NOT imply that all days .* are scheduled or published/i)
  })

  it('30-day: detailed full window, no multi-month roadmap sentence', () => {
    const s = sys(briefWith(order('organic', 'standard', '30')))
    expect(s).toMatch(/detailed strategy and content calendar for the full 30 days/i)
    expect(s).not.toMatch(/month roadmap\. Generate a DETAILED/i) // no multi-month block
  })
})

describe('buildStrategistPrompts — Paid enforcement', () => {
  const s = sys(briefWith(order('paid', 'standard', '90')))
  it('6. planning-only', () => {
    expect(s).toMatch(/PLANNING-ONLY/i)
  })
  it('7. no launch / spend / publish / activation', () => {
    expect(s).toMatch(/never describe how to launch\/activate ads/i)
    expect(s).toMatch(/never spend budget/i)
    expect(s).toMatch(/never publish/i)
    // generic binding safety line also asserts activation + publish
    expect(s).toMatch(/campaigns will be activated/i)
    expect(s).toMatch(/scheduled\/published/i)
  })
  it('8. no fake performance projections', () => {
    expect(s).toMatch(/never invent performance numbers/i)
    expect(s).toMatch(/Performance projections \/ invented metrics/i) // excluded list
  })
})

describe('buildStrategistPrompts — Full + Organic enforcement', () => {
  it('9. full: do not blindly double outputs', () => {
    expect(sys(briefWith(order('full', 'standard', '90')))).toMatch(/do NOT blindly double outputs/i)
  })

  it('10. organic excludes paid launch/spend', () => {
    const s = sys(briefWith(order('organic', 'standard', '90')))
    expect(s).toContain('Paid campaign plan') // listed under NOT included
    expect(s).toMatch(/ads will launch, budget will be spent/i)
  })
})

describe('buildStrategistPrompts — content intensity / plan cap', () => {
  it('11. includes the exact organicPostCount (Organic Standard 90 = 16)', () => {
    const s = sys(briefWith(order('organic', 'standard', '90')))
    expect(s).toMatch(/exactly 16 post ideas/i)
  })

  it('11. a different intensity yields a different exact count (Organic Light 90 = 10)', () => {
    expect(sys(briefWith(order('organic', 'light', '90')))).toMatch(/exactly 10 post ideas/i)
  })

  it('12. states the plan cap honestly when planCapApplied (growth 25 capped to 10)', () => {
    const s = sys(briefWith(order('organic', 'growth', '90'), 10))
    expect(s).toMatch(/capped by the plan quota 10/i)
    expect(s).toMatch(/exactly 10 post ideas/i) // capped count, not requested 25
  })

  it('platform variants framed as adaptations', () => {
    expect(sys(briefWith(order('organic', 'standard', '90')))).toMatch(/Platform variants are ADAPTATIONS/i)
  })
})
