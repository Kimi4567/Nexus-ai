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
    expect(guardKpiTarget('Increase by 20% over the next 30 days', ['20% gross margin'])).toBe('Increase — baseline needed (target to define after first 30 days)')
    expect(guardKpiTarget('Improve by 15%')).toMatch(/^Improve — baseline needed/)
    expect(guardKpiTarget('25% more engagement')).toBe('Baseline needed — target to define after first 30 days')
  })

  it('strips unsupported multiplier-word targets even without digits', () => {
    expect(guardKpiTarget('Double the current monthly requests')).toBe('Baseline needed — target to define after first 30 days')
    expect(guardResultText('Aim to double current monthly requests in 30 days')).toContain('baseline-needed performance target')
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

  it('returns Arabic-safe fallback text when Arabic output is selected', () => {
    expect(guardKpiTarget('Generate 50 leads', [], { language: 'ar' })).toBe(
      'توليد — نحتاج إلى خط أساس لتحديد الهدف بعد أول ٣٠ يومًا',
    )
    expect(guardKpiTarget('25% more engagement', [], { language: 'ar' })).toBe(
      'نحتاج إلى خط أساس لتحديد الهدف بعد أول ٣٠ يومًا',
    )
  })

  it('strips Arabic KPI percentage targets observed in production', () => {
    expect(guardKpiTarget('زيادة بنسبة 20% في 30 يومًا', [], { language: 'ar' })).toBe(
      'زيادة — نحتاج إلى خط أساس لتحديد الهدف بعد أول ٣٠ يومًا',
    )
    expect(guardKpiTarget('زيادة بنسبة ٢٥٪ خلال ٣٠ يومًا', [], { language: 'ar' })).toBe(
      'زيادة — نحتاج إلى خط أساس لتحديد الهدف بعد أول ٣٠ يومًا',
    )
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
  it('uses Arabic-safe replacement for multiplier claims in Arabic mode', () => {
    const out = guardResultText('Aim to double current monthly requests in 30 days', [], { language: 'ar' })
    expect(out).toContain('هدف أداء يحتاج إلى خط أساس')
    expect(out).not.toContain('baseline-needed')
  })
  it('replaces unsupported qualitative outcome promises without a baseline', () => {
    const out = guardResultText(
      'تحقيق زيادة في الوعي وجذب العملاء المحتملين',
      [],
      { language: 'ar' },
    )
    expect(out).toBe('نتيجة اتجاهية قيد الاختبار — يلزم خط أساس وبيانات فعلية قبل تحديد أثر الأداء')
    expect(guardResultText('زيادة الوعي تحتاج إلى خط أساس وقياس فعلي', [], { language: 'ar' }))
      .toBe('زيادة الوعي تحتاج إلى خط أساس وقياس فعلي')
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

  it('replaces unsupported numeric decision thresholds with baseline-based operating rules', () => {
    const guarded = guardStrategyKpis({
      decisionRules: [
        {
          signal: 'Engagement rate increase',
          continueWhen: 'Engagement improves by 10%',
          iterateWhen: 'Engagement is stable',
          stopWhen: 'Engagement decreases',
          nextAction: 'Adjust one message variable',
        },
      ],
    })

    expect(guarded.decisionRules[0]).toEqual({
      signal: 'Engagement rate increase',
      continueWhen: 'Continue when the signal improves against the documented baseline.',
      iterateWhen: 'Engagement is stable',
      stopWhen: 'Engagement decreases',
      nextAction: 'Adjust one message variable',
    })
    expect(JSON.stringify(guarded)).not.toContain('10%')
  })

  it('guards Arabic achieved-threshold wording, roadmap gates, experiments, and direct Brand Brain learning', () => {
    const guarded = guardStrategyKpis({
      decisionRules: [{
        signal: 'معدل التفاعل',
        continueWhen: 'تحقق الزيادة بنسبة 10%',
        iterateWhen: 'تحقق الزيادة بنسبة 5%',
        stopWhen: 'عدم وجود زيادة',
      }],
      roadmap30_60_90: [
        { phase: 'days 1 30', exitGate: 'تحقق زيادة بنسبة 10% في التفاعل' },
      ],
      experimentBacklog: [
        { hypothesis: 'اختبار فيديو', minimumEvidence: 'زيادة بنسبة 10% في المشاهدات' },
      ],
      operatingCadence: {
        monthly: ['تقييم الاستراتيجية وتعلم من Brand Brain'],
      },
    }, [], { language: 'ar' })

    const serialized = JSON.stringify(guarded)
    expect(serialized).not.toMatch(/(?:10|5)\s*%/)
    expect(serialized).not.toContain('تعلم من Brand Brain')
    expect(guarded.decisionRules[0].continueWhen).toContain('خط الأساس الموثق')
    expect(guarded.roadmap30_60_90[0].exitGate).toContain('دليل فعلي قابل للمقارنة')
    expect(guarded.experimentBacklog[0].minimumEvidence).toContain('عينة فعلية')
    expect(guarded.operatingCadence.monthly[0]).toContain('مراجعتها قبل الاعتماد')
  })

  it('guards Arabic learning language inside a bilingual strategy', () => {
    const guarded = guardStrategyKpis({
      operatingCadence: {
        monthly: ['تقييم الاستراتيجية وتعلم من Brand Brain'],
      },
    }, [], { language: 'bilingual' })

    const serialized = JSON.stringify(guarded)
    expect(serialized).not.toContain('تعلم من Brand Brain')
    expect(serialized).toContain('مراجعتها قبل الاعتماد')
  })

  it('keeps Arabic strategy KPI fallbacks inside the Arabic language contract', () => {
    const strategy = {
      kpis: [
        { metric: 'طلبات واتساب', target: 'Generate 50 leads', timeframe: '30 days', isHypothesis: false },
        { metric: 'حجوزات واتساب', target: 'زيادة بنسبة 20% في 30 يومًا', timeframe: '30 يومًا', isHypothesis: false },
      ],
      successMetricsDetailed: [
        { category: 'conversion', metric: 'استفسارات', target: 'Improve by 15%', timeframe: '30 days' },
        { category: 'engagement', metric: 'تفاعلات', target: 'زيادة بنسبة 25% في 30 يومًا', timeframe: '30 يومًا' },
      ],
      estimatedResults: 'Aim to double current monthly requests in 30 days',
    }
    const g = guardStrategyKpis(strategy, [], { language: 'ar' })
    expect(g.kpis[0].target).toBe('توليد — نحتاج إلى خط أساس لتحديد الهدف بعد أول ٣٠ يومًا')
    expect(g.kpis[1].target).toBe('زيادة — نحتاج إلى خط أساس لتحديد الهدف بعد أول ٣٠ يومًا')
    expect((g.successMetricsDetailed[0] as { target: string }).target).toBe(
      'تحسين — نحتاج إلى خط أساس لتحديد الهدف بعد أول ٣٠ يومًا',
    )
    expect((g.successMetricsDetailed[1] as { target: string }).target).toBe(
      'زيادة — نحتاج إلى خط أساس لتحديد الهدف بعد أول ٣٠ يومًا',
    )
    expect(g.estimatedResults).toContain('هدف أداء يحتاج إلى خط أساس')
    expect(JSON.stringify(g)).not.toMatch(/baseline needed|target to define|performance target/)
    expect(JSON.stringify(g)).not.toMatch(/20\s*%|25\s*%|٢٥\s*٪/)
  })

  it('guards nested persisted aiOutput.strategy shapes as a defensive backstop', () => {
    const wrapped = {
      language: 'ar',
      strategy: {
        businessObjective: {
          successIn30Days: 'زيادة ملحوظة في عدد الطلبات التجريبية.',
        },
        kpis: [
          { metric: 'عدد الحجوزات عبر WhatsApp', target: 'زيادة بنسبة 20% في 30 يومًا', timeframe: '30 يومًا' },
        ],
        successMetricsDetailed: [
          { metric: 'عدد التفاعلات مع المحتوى', target: 'زيادة بنسبة 25% في 30 يومًا', timeframe: '30 يومًا' },
        ],
        successMetrics: ['تحقيق زيادة 25% في الحجوزات خلال 30 يومًا'],
      },
    }
    const g = guardStrategyKpis(wrapped, [], { language: 'ar' })
    const nested = g.strategy as unknown as {
      kpis: Array<{ target: string; isHypothesis?: boolean }>
      successMetricsDetailed: Array<{ target: string; isHypothesis?: boolean }>
      successMetrics: string[]
      businessObjective: { successIn30Days: string }
    }
    expect(nested.businessObjective.successIn30Days).toBe(
      'تحديد خط أساس للطلبات والتفاعل بعد أول ٣٠ يومًا من البيانات الحقيقية',
    )
    expect(nested.kpis[0].target).toBe('زيادة — نحتاج إلى خط أساس لتحديد الهدف بعد أول ٣٠ يومًا')
    expect(nested.kpis[0].isHypothesis).toBe(true)
    expect(nested.successMetricsDetailed[0].target).toBe('زيادة — نحتاج إلى خط أساس لتحديد الهدف بعد أول ٣٠ يومًا')
    expect(nested.successMetricsDetailed[0].isHypothesis).toBe(true)
    expect(nested.successMetrics[0]).not.toMatch(/25\s*%/)
    expect(nested.successMetrics[0]).toContain('30 يومًا')
  })

  it('guards non-numeric 30-day success claims while preserving baseline definitions', () => {
    const guardedAr = guardStrategyKpis({
      businessObjective: {
        successIn30Days: 'زيادة ملحوظة في عدد الطلبات التجريبية.',
      },
    }, [], { language: 'ar' })
    expect((guardedAr.businessObjective as { successIn30Days: string }).successIn30Days).toBe(
      'تحديد خط أساس للطلبات والتفاعل بعد أول ٣٠ يومًا من البيانات الحقيقية',
    )

    const guardedEn = guardStrategyKpis({
      businessObjective: {
        successIn30Days: 'Increase qualified demo requests in the first month.',
      },
    })
    expect((guardedEn.businessObjective as { successIn30Days: string }).successIn30Days).toBe(
      'Define a baseline for qualified demand and engagement after the first 30 days of real data',
    )

    const clean = 'تحديد خط أساس للطلبات والتفاعل'
    const preserved = guardStrategyKpis({
      businessObjective: { successIn30Days: clean },
    }, [], { language: 'ar' })
    expect((preserved.businessObjective as { successIn30Days: string }).successIn30Days).toBe(clean)
  })

  it('handles missing / odd shapes safely', () => {
    expect(guardStrategyKpis({} as Record<string, unknown>)).toEqual({})
    expect(guardStrategyKpis({ kpis: 'nope' } as unknown as Record<string, unknown>).kpis).toBe('nope')
  })
})
