import { describe, it, expect } from 'vitest'
import {
  formatStrategyDeliverableForLocale,
  getStrategyDeliverables,
  INTENSITY_POST_TARGET,
} from '@/lib/strategy/deliverablesContract'
import type { StrategyOrder } from '@/lib/strategy/strategyOrder'

const order = (over: Partial<StrategyOrder>): StrategyOrder => ({
  strategyType: 'organic',
  durationPreset: '30',
  durationDays: 30,
  contentIntensity: 'standard',
  goal: 'leads',
  language: 'en',
  ...over,
})

describe('getStrategyDeliverables — duration', () => {
  it('1. 30-day Organic Standard → 30-day horizon, fully detailed', () => {
    const d = getStrategyDeliverables(order({ durationPreset: '30', durationDays: 30 }))
    expect(d.supported).toBe(true)
    expect(d.planningHorizonDays).toBe(30)
    expect(d.detailedCalendarDays).toBe(30)
    expect(d.roadmapMonths).toBe(1)
  })

  it('2. 90-day Organic Standard → 90-day horizon, roadmapMonths=3, detailed 30', () => {
    const d = getStrategyDeliverables(order({ durationPreset: '90', durationDays: 90 }))
    expect(d.planningHorizonDays).toBe(90)
    expect(d.roadmapMonths).toBe(3)
    expect(d.detailedCalendarDays).toBe(30)
  })

  it('3. 180-day Organic Standard → 180-day horizon, roadmapMonths=6, detailed 30', () => {
    const d = getStrategyDeliverables(order({ durationPreset: '180', durationDays: 180 }))
    expect(d.planningHorizonDays).toBe(180)
    expect(d.roadmapMonths).toBe(6)
    expect(d.detailedCalendarDays).toBe(30)
  })

  it('4. 90/180 never detail more than 30 days (no posts for the full duration)', () => {
    for (const preset of ['90', '180'] as const) {
      const d = getStrategyDeliverables(order({ durationPreset: preset, durationDays: Number(preset) }))
      expect(d.detailedCalendarDays).toBeLessThanOrEqual(30)
      expect(d.includedDeliverables.join(' ')).toMatch(/First 30-day strategy execution outline/i)
      expect(d.includedDeliverables.join(' ')).toMatch(/themes \/ backlog|backlog/i)
      expect(d.includedDeliverables.join(' ')).not.toMatch(/Detailed first 30-day content calendar/i)
      // organic post count is for the detailed window only, never horizon-sized
      expect(d.organicPostCount).toBeLessThanOrEqual(INTENSITY_POST_TARGET.daily)
    }
  })
})

describe('getStrategyDeliverables — content intensity', () => {
  it('5. Light/Standard/Growth/Daily map to expected post counts (no plan cap)', () => {
    const expectMap = { light: 10, standard: 16, growth: 25, daily: 30 } as const
    for (const [intensity, count] of Object.entries(expectMap)) {
      const d = getStrategyDeliverables(order({ contentIntensity: intensity as keyof typeof expectMap }))
      expect(d.requestedOrganicPostCount).toBe(count)
      expect(d.organicPostCount).toBe(count) // no planContext → no cap
      expect(d.planCapApplied).toBe(false)
      expect(d.planCappedOrganicPostCount).toBeNull()
    }
  })
})

describe('getStrategyDeliverables — exact organic post count', () => {
  it('uses a custom exact post count instead of the intensity band-top', () => {
    const d = getStrategyDeliverables(order({ contentIntensity: 'daily', customOrganicPostCount: 7 }))
    expect(d.supported).toBe(true)
    expect(d.requestedOrganicPostCount).toBe(7)
    expect(d.organicPostCount).toBe(7)
    expect(d.includedDeliverables.join(' ')).toMatch(/Exact organic post directions requested \(7\)/)
    expect(d.userExplanation).toMatch(/exact first-30-day organic post-direction count: 7/i)
    expect(d.generationInstructions).toMatch(/exactly 7 post directions/)
    expect(d.generationInstructions).toMatch(/exact custom post count/)
  })

  it('still applies plan cap to an exact custom count if the plan allows fewer posts', () => {
    const d = getStrategyDeliverables(order({ customOrganicPostCount: 12 }), { postsPerMonth: 10 })
    expect(d.requestedOrganicPostCount).toBe(12)
    expect(d.organicPostCount).toBe(10)
    expect(d.planCapApplied).toBe(true)
    expect(d.generationInstructions).toMatch(/capped by the plan quota 10/)
  })

  it('does not apply exact organic post count to paid-only strategy', () => {
    const d = getStrategyDeliverables(order({ strategyType: 'paid', customOrganicPostCount: 7 }))
    expect(d.supported).toBe(true)
    expect(d.requestedOrganicPostCount).toBe(0)
    expect(d.organicPostCount).toBe(0)
  })

  it('blocks exact custom post counts over 30 before generation', () => {
    const d = getStrategyDeliverables(order({ customOrganicPostCount: 31 }))
    expect(d.supported).toBe(false)
    expect(d.userExplanation).toMatch(/1 and 30/)
    expect(d.generationInstructions).toMatch(/DO NOT GENERATE/)
  })
})

describe('getStrategyDeliverables — plan cap', () => {
  it('6. plan quota caps post count and marks planCapApplied', () => {
    const d = getStrategyDeliverables(order({ contentIntensity: 'daily' }), { postsPerMonth: 10 })
    expect(d.requestedOrganicPostCount).toBe(30)
    expect(d.organicPostCount).toBe(10)
    expect(d.planCappedOrganicPostCount).toBe(10)
    expect(d.planCapApplied).toBe(true)
    expect(d.userExplanation.toLowerCase()).toMatch(/plan allows 10/)
    expect(d.userExplanation).toMatch(/post directions/i)
  })

  it('does not cap when the request is within quota', () => {
    const d = getStrategyDeliverables(order({ contentIntensity: 'light' }), { postsPerMonth: 25 })
    expect(d.organicPostCount).toBe(10)
    expect(d.planCapApplied).toBe(false)
  })
})

describe('getStrategyDeliverables — paid', () => {
  it('7. paid returns ad variations / creative briefs / audience hypotheses + planning-only exclusions', () => {
    const d = getStrategyDeliverables(order({ strategyType: 'paid' }))
    expect(d.paidAdVariationCount).toBeGreaterThanOrEqual(6)
    expect(d.paidAdVariationCount).toBeLessThanOrEqual(12)
    expect(d.creativeBriefCount).toBeGreaterThanOrEqual(3)
    expect(d.creativeBriefCount).toBeLessThanOrEqual(5)
    expect(d.audienceHypothesisCount).toBeGreaterThanOrEqual(2)
    expect(d.audienceHypothesisCount).toBeLessThanOrEqual(3)
    // organic content not part of a paid-only order
    expect(d.organicPostCount).toBe(0)
    expect(d.excludedDeliverables).toEqual(
      expect.arrayContaining(['Ad launch', 'Ad spend', 'Publishing', 'Campaign execution']),
    )
    expect(d.excludedDeliverables.join(' ')).toMatch(/projection|metric/i)
    expect(d.generationInstructions).toMatch(/PLANNING-ONLY/i)
  })
})

describe('getStrategyDeliverables — full', () => {
  it('8. full returns aligned organic + paid without blind doubling', () => {
    const d = getStrategyDeliverables(order({ strategyType: 'full', durationPreset: '90', durationDays: 90, contentIntensity: 'standard' }))
    // organic present
    expect(d.organicPostCount).toBe(16)
    // paid present
    expect(d.paidAdVariationCount).toBeGreaterThan(0)
    expect(d.creativeBriefCount).toBeGreaterThan(0)
    // alignment deliverables present (not duplicated organic+paid blocks)
    const inc = d.includedDeliverables.join(' ')
    expect(inc).toMatch(/Shared message angles/i)
    expect(inc).toMatch(/Funnel alignment/i)
    expect(inc).toMatch(/Retargeting direction/i)
    expect(d.generationInstructions).toMatch(/do not blindly double/i)
    // still only first 30 days detailed
    expect(d.detailedCalendarDays).toBe(30)
  })
})

describe('getStrategyDeliverables — custom duration', () => {
  it('9. custom 37 days → first 30 detailed + weekly extension explanation', () => {
    const d = getStrategyDeliverables(order({ durationPreset: 'custom', durationDays: 37 }))
    expect(d.supported).toBe(true)
    expect(d.planningHorizonDays).toBe(37)
    expect(d.detailedCalendarDays).toBe(30)
    expect(d.roadmapMonths).toBe(2)
    expect(d.includedDeliverables.join(' ')).toMatch(/weekly extension/i)
    expect(d.generationInstructions).toMatch(/weekly extension/i)
  })

  it('custom 75 days → 90-day bucket (roadmapMonths=3), first 30 detailed', () => {
    const d = getStrategyDeliverables(order({ durationPreset: 'custom', durationDays: 75 }))
    expect(d.roadmapMonths).toBe(3)
    expect(d.detailedCalendarDays).toBe(30)
  })

  it('custom 120 days → 180-bucket (roadmapMonths=6), first 30 detailed', () => {
    const d = getStrategyDeliverables(order({ durationPreset: 'custom', durationDays: 120 }))
    expect(d.roadmapMonths).toBe(6)
    expect(d.detailedCalendarDays).toBe(30)
  })

  it('custom 1–30 (e.g. 14 days) → detailed for that span', () => {
    const d = getStrategyDeliverables(order({ durationPreset: 'custom', durationDays: 14 }))
    expect(d.planningHorizonDays).toBe(14)
    expect(d.detailedCalendarDays).toBe(14)
    expect(d.roadmapMonths).toBe(1)
  })

  it('10. custom > 180 → unsupported / custom quote, nothing generated', () => {
    const d = getStrategyDeliverables(order({ durationPreset: 'custom', durationDays: 365 }))
    expect(d.supported).toBe(false)
    expect(d.unsupportedReason).toMatch(/not supported|custom quote/i)
    expect(d.userExplanation.toLowerCase()).toMatch(/contact support|custom quote/)
    expect(d.generationInstructions).toMatch(/DO NOT GENERATE/i)
    expect(d.organicPostCount).toBe(0)
  })
})

describe('getStrategyDeliverables — shape & purity', () => {
  it('11. included/excluded deliverables are populated for a normal order', () => {
    const d = getStrategyDeliverables(order({ strategyType: 'organic', durationPreset: '90', durationDays: 90 }))
    expect(d.includedDeliverables.length).toBeGreaterThan(0)
    expect(d.excludedDeliverables.length).toBeGreaterThan(0)
    expect(d.excludedDeliverables).toEqual(expect.arrayContaining(['Paid campaign plan']))
  })

  it('12. generationInstructions say first-30-days-only for 90/180', () => {
    for (const preset of ['90', '180'] as const) {
      const d = getStrategyDeliverables(order({ durationPreset: preset, durationDays: Number(preset) }))
      expect(d.generationInstructions).toMatch(/FIRST-30-DAY STRATEGY EXECUTION OUTLINE/i)
      expect(d.generationInstructions).toMatch(/do NOT generate posts for every day/i)
      expect(d.generationInstructions).toMatch(/does NOT create saved Content Hub posts/i)
      expect(d.generationInstructions).toMatch(/not final post drafts/i)
      expect(d.generationInstructions).toMatch(/produce exactly 16 post directions/i)
      expect(d.generationInstructions).toMatch(/Return exactly 16 contentAnglesDetailed entries/i)
      expect(d.generationInstructions).toMatch(/Distribute exactly 16 countable post directions across weeklyExecutionPlan\.deliverables/i)
    }
  })

  it('strategy run excludes saved Content Hub drafts and scheduling artifacts', () => {
    const d = getStrategyDeliverables(order({ strategyType: 'organic', durationPreset: '90', durationDays: 90 }))
    expect(d.excludedDeliverables).toEqual(expect.arrayContaining([
      'Saved Content Hub content plan',
      'Final SocialPost drafts / captions',
      'Scheduled calendar entries',
    ]))
    expect(d.includedDeliverables.join(' ')).toMatch(/Content Hub draft posts generated separately/i)
  })

  it('13. returns no charged credit/price values (informational counts only)', () => {
    const d = getStrategyDeliverables(order({}))
    expect(d).not.toHaveProperty('credits')
    expect(d).not.toHaveProperty('cost')
    expect(d).not.toHaveProperty('price')
    expect(d).not.toHaveProperty('creditsUsed')
  })

  it('14. pure & deterministic — same input yields deep-equal output, no input mutation', () => {
    const o = order({ strategyType: 'full', durationPreset: 'custom', durationDays: 95, contentIntensity: 'growth', language: 'both' })
    const snapshot = JSON.stringify(o)
    const a = getStrategyDeliverables(o, { postsPerMonth: 25, platformCount: 4 })
    const b = getStrategyDeliverables(o, { postsPerMonth: 25, platformCount: 4 })
    expect(a).toEqual(b)
    expect(JSON.stringify(o)).toBe(snapshot) // input not mutated
  })

  it('bilingual explanation includes both EN and AR text', () => {
    const d = getStrategyDeliverables(order({ language: 'both', durationPreset: '90', durationDays: 90 }))
    expect(d.userExplanation).toMatch(/roadmap/i)        // EN
    expect(d.userExplanation).toMatch(/خريطة طريق/)       // AR
  })

  it('localizes internal deliverable labels for Arabic cost-review UI', () => {
    expect(formatStrategyDeliverableForLocale('Detailed 30-day strategy', 'ar')).toBe('استراتيجية مفصلة لمدة 30 يوم')
    expect(formatStrategyDeliverableForLocale('Exact organic post directions requested (7) for the first 30 days', 'ar')).toBe('اتجاهات منشورات عضوية محددة (7) لأول 30 يوم')
    expect(formatStrategyDeliverableForLocale('Organic post direction target (16) for the first 30 days', 'ar')).toBe('هدف اتجاهات المنشورات العضوية (16) لأول 30 يوم')
    expect(formatStrategyDeliverableForLocale('Saved Content Hub content plan', 'ar')).toBe('خطة محتوى محفوظة داخل Content Hub')
    expect(formatStrategyDeliverableForLocale('Paid campaign plan', 'ar')).toBe('خطة حملة مدفوعة')
    expect(formatStrategyDeliverableForLocale('Detailed 30-day strategy', 'en')).toBe('Detailed 30-day strategy')
  })
})
