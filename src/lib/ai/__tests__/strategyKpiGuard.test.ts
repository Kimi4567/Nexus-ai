import { describe, it, expect } from 'vitest'
import { guardKpiTarget, guardResultText, guardStrategyKpis, normalizeStrategyIntent } from '../strategyKpiGuard'

describe('normalizeStrategyIntent — safe defaults', () => {
  it('defaults to organic / 90 when missing or invalid', () => {
    expect(normalizeStrategyIntent(undefined, undefined)).toEqual({ strategyType: 'organic', strategyDuration: '90' })
    expect(normalizeStrategyIntent('nonsense', '7')).toEqual({ strategyType: 'organic', strategyDuration: '90' })
    expect(normalizeStrategyIntent(null, null)).toEqual({ strategyType: 'organic', strategyDuration: '90' })
  })
  it('passes through valid values', () => {
    expect(normalizeStrategyIntent('paid', '30')).toEqual({ strategyType: 'paid', strategyDuration: '30' })
    expect(normalizeStrategyIntent('full', '180')).toEqual({ strategyType: 'full', strategyDuration: '180' })
    expect(normalizeStrategyIntent('organic', 'custom')).toEqual({ strategyType: 'organic', strategyDuration: 'custom' })
  })
})

describe('guardKpiTarget — strips unsupported performance numbers', () => {
  it('strips invented percentages (20% / 25% / 15%) → directional', () => {
    expect(guardKpiTarget('Increase by 20%')).toBe('Increase — baseline needed (target to define after first 30 days)')
    expect(guardKpiTarget('Improve by 15%')).toMatch(/^Improve — baseline needed/)
    expect(guardKpiTarget('25% more engagement')).toBe('Baseline needed — target to define after first 30 days')
  })

  it('strips ROI / ROAS / revenue / lead-count style targets', () => {
    expect(guardKpiTarget('Achieve a 3.2 ROAS')).toMatch(/baseline needed/i)
    expect(guardKpiTarget('Generate 50 leads')).toMatch(/Generate — baseline needed/)
    expect(guardKpiTarget('$10,000 in revenue')).toBe('Baseline needed — target to define after first 30 days')
    expect(guardKpiTarget('2x return')).toMatch(/baseline needed/i)
  })

  it('PR-I.1 — strips unsupported engagement/reach count targets (views, impressions, clicks, visits, downloads, followers)', () => {
    expect(guardKpiTarget('Achieve 500 views per video')).toMatch(/baseline needed/i)
    expect(guardKpiTarget('Achieve 500 views per video')).not.toMatch(/500/)
    expect(guardKpiTarget('Get 1,000 impressions')).toBe('Baseline needed — target to define after first 30 days')
    expect(guardKpiTarget('Generate 300 clicks')).toMatch(/Generate — baseline needed/)
    expect(guardKpiTarget('Drive 200 website visits')).toMatch(/Drive — baseline needed/)
    expect(guardKpiTarget('Gain 100 followers')).toMatch(/baseline needed/i)
    expect(guardKpiTarget('Get 50 downloads')).toBe('Baseline needed — target to define after first 30 days')
    expect(guardKpiTarget('Reach 2,000 video views')).not.toMatch(/2,000/)
  })

  it('PR-I.1 — preserves the 30-day timeframe while scrubbing the count', () => {
    // timeframe must survive even when no count number is present
    expect(guardKpiTarget('Increase engagement over 30 days')).toBe('Increase engagement over 30 days')
    // and survive in free-text alongside a scrubbed count
    const out = guardResultText('Reach 5,000 impressions in 30 days')
    expect(out).not.toContain('5,000')
    expect(out).toContain('30 days')
  })

  it('preserves non-numeric directional KPIs', () => {
    expect(guardKpiTarget('Grow brand awareness')).toBe('Grow brand awareness')
    expect(guardKpiTarget('Sign-ups for trials')).toBe('Sign-ups for trials')
    expect(guardKpiTarget('Higher engagement on social media')).toBe('Higher engagement on social media')
  })

  it('preserves calendar timeframes (not performance numbers)', () => {
    expect(guardKpiTarget('Establish a baseline within 30 days')).toBe('Establish a baseline within 30 days')
    expect(guardKpiTarget('Review after 90 days')).toBe('Review after 90 days')
  })

  it('preserves numbers the user actually provided (allowed)', () => {
    expect(guardKpiTarget('Stay within the $1,000 monthly budget', ['$1,000 / month'])).toContain('$1,000')
    // a different invented number is still scrubbed even when another is allowed
    expect(guardKpiTarget('Hit 30% growth on the $1,000 budget', ['$1,000 / month'])).toMatch(/baseline needed/i)
  })
})

describe('guardResultText — free-text estimated results', () => {
  it('scrubs invented numbers but keeps timeframes', () => {
    const out = guardResultText('Expect a 40% lift and 200 new leads in 30 days')
    expect(out).not.toMatch(/40\s*%/)
    expect(out).not.toContain('200')
    expect(out).toContain('30 days')
  })
  it('leaves clean directional text unchanged', () => {
    const clean = 'Build consistent organic presence and a repeatable content rhythm.'
    expect(guardResultText(clean)).toBe(clean)
  })
})

describe('guardStrategyKpis — full strategy object', () => {
  it('guards kpis[], successMetricsDetailed[], successMetrics[], estimatedResults; marks changed KPI as hypothesis', () => {
    const strategy = {
      kpis: [
        { metric: 'Trial sign-ups', target: 'Increase by 20%', timeframe: '30 days', isHypothesis: false },
        { metric: 'Awareness', target: 'Grow brand mentions', timeframe: '90 days', isHypothesis: true },
      ],
      successMetricsDetailed: [
        { category: 'conversion', metric: 'Trial→paid', target: 'Improve by 15%', timeframe: '30 days' },
      ],
      successMetrics: ['Increase conversions by 25%', 'Build a content calendar'],
      estimatedResults: 'Likely 3x ROAS within 30 days',
      positioning: 'unchanged field',
    }
    const g = guardStrategyKpis(strategy)
    expect(g.kpis[0].target).toMatch(/baseline needed/i)
    expect(g.kpis[0].isHypothesis).toBe(true)            // forced true when number stripped
    expect(g.kpis[1].target).toBe('Grow brand mentions') // directional preserved
    expect((g.successMetricsDetailed[0] as { target: string }).target).toMatch(/baseline needed/i)
    expect(g.successMetrics[0]).not.toMatch(/25\s*%/)
    expect(g.successMetrics[1]).toBe('Build a content calendar')
    expect(g.estimatedResults).not.toMatch(/3x|ROAS/i)
    expect(g.estimatedResults).toContain('30 days')
    expect(g.positioning).toBe('unchanged field')        // non-KPI fields untouched
  })

  it('handles missing / odd shapes safely', () => {
    expect(guardStrategyKpis({} as Record<string, unknown>)).toEqual({})
    expect(guardStrategyKpis({ kpis: 'nope' } as unknown as Record<string, unknown>).kpis).toBe('nope')
  })
})
