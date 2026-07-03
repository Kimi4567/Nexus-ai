/**
 * Strategy PR-2B1 — normalizer, validators, and server-authoritative readiness.
 * Pure logic only — no network, no generation, no credits.
 */
import { describe, it, expect } from 'vitest'
import {
  normalizeStrategyOutput,
  findUnsupportedPerfNumbers,
  scrubUnsupportedNumbers,
  filterCompetitors,
  deriveConfidenceReport,
  collectMissingKeys,
  applyServerReadiness,
} from '@/lib/strategyNormalize'
import { getStrategyCapabilities, type StrategyProfileLike } from '@/lib/brandReadiness'

// A realistic OLD saved strategy (legacy fields only, pre-PR-2B1).
const legacyStrategy: any = {
  campaignName: 'Reem Hospital Dental',
  goal: 'LEADS',
  positioning: 'Reem Hospital is the dental care provider for Abu Dhabi families who need calm care.',
  differentiation: 'Painless, patient-centered techniques.',
  targetAudienceRefined: 'Anxious dental patients in Abu Dhabi',
  contentPillars: ['Trust', 'Comfort', 'Results'],
  audienceSegmentsDetailed: [{ segment: 'Anxious patients', pain: 'fear', message: 'calm care' }],
  weeklyExecutionPlan: [{ week: 1, objective: 'Awareness', deliverables: ['2 Reels'] }],
  channelMix: [{ platform: 'Instagram', budgetPercent: 60 }],
  estimatedResults: 'Steady inbound enquiries over 30 days.',
  confidence: 72,
}

const contentReady: StrategyProfileLike = {
  brandName: 'Reem Hospital', industry: 'Dental', description: 'Dental care',
  targetAudience: 'Abu Dhabi families', topPlatforms: ['INSTAGRAM'],
}

describe('normalizeStrategyOutput', () => {
  it('backward compat: preserves all legacy fields untouched', () => {
    const n: any = normalizeStrategyOutput(legacyStrategy)
    expect(n.positioning).toBe(legacyStrategy.positioning)
    expect(n.differentiation).toBe(legacyStrategy.differentiation)
    expect(n.contentPillars).toEqual(['Trust', 'Comfort', 'Results'])
    expect(n.audienceSegmentsDetailed).toHaveLength(1)
    expect(n.weeklyExecutionPlan).toHaveLength(1)
    expect(n.confidence).toBe(72)
  })

  it('coerces malformed array fields to []', () => {
    const n: any = normalizeStrategyOutput({ kpis: { not: 'an array' }, riskNotes: 'oops' })
    expect(Array.isArray(n.kpis)).toBe(true)
    expect(n.kpis).toEqual([])
    expect(n.riskNotes).toEqual([])
  })

  it('drops malformed object fields to undefined (renderer || null safe)', () => {
    const n: any = normalizeStrategyOutput({ confidenceReport: 'high', businessObjective: 42 })
    expect(n.confidenceReport).toBeUndefined()
    expect(n.businessObjective).toBeUndefined()
  })

  it('null / non-object input returns a safe shell, never throws', () => {
    expect(() => normalizeStrategyOutput(null)).not.toThrow()
    const n: any = normalizeStrategyOutput(null)
    expect(n.kpis).toEqual([])
    expect(n.contentPillars).toEqual([])
  })

  it('marketContext is always forced to isAssumption=true', () => {
    const n: any = normalizeStrategyOutput({ marketContext: { summary: 'Big TAM', isAssumption: false } })
    expect(n.marketContext.isAssumption).toBe(true)
  })
})

describe('unsupported performance numbers', () => {
  it('flags fabricated ROAS / CPL / CTR / percentages', () => {
    const hits = findUnsupportedPerfNumbers('Expect 3.2 ROAS, CPL $12, and a 30% conversion rate', [])
    expect(hits.length).toBeGreaterThan(0)
  })
  it('does NOT flag numbers echoed from user-provided values', () => {
    const allowed = ['$1,000–3,000 / month']
    const hits = findUnsupportedPerfNumbers('Budget band is $1,000–3,000 / month', allowed)
    expect(hits).toEqual([])
  })
  it('scrubs unsupported numbers but keeps allowed echoes', () => {
    const out = scrubUnsupportedNumbers('Target 5.0 ROAS on a $1,000 budget', ['$1,000'])
    expect(out).not.toContain('5.0 ROAS')
    expect(out).toContain('$1,000')
  })
  it('flags and scrubs Arabic percentages and Arabic-Indic numerals', () => {
    const hits = findUnsupportedPerfNumbers('تحقيق زيادة ٢٥٪ في الحجوزات و20% في التفاعل', [])
    expect(hits).toEqual(expect.arrayContaining(['٢٥٪', '20%']))

    const out = scrubUnsupportedNumbers('تحقيق زيادة ٢٥٪ في الحجوزات و20% في التفاعل خلال 30 يومًا')
    expect(out).not.toMatch(/٢٥\s*٪|20\s*%/)
    expect(out).toContain('30 يومًا')
  })
})

describe('invented competitors', () => {
  it('keeps only provided competitor names', () => {
    expect(filterCompetitors(['Clinic X', 'Imaginary Co'], ['Clinic X'])).toEqual(['Clinic X'])
  })
  it('returns [] when no competitors were provided', () => {
    expect(filterCompetitors(['Anything'], [])).toEqual([])
  })
})

describe('server-authoritative readiness', () => {
  it('derives confidence + missing keys from capabilities (not the model)', () => {
    const sparseCaps = getStrategyCapabilities({ brandName: 'X' })
    const report = deriveConfidenceReport(sparseCaps)
    expect(report.overall).toBe('low') // content not ready
    expect(report.byCapability.contentStrategy).toBe('none')
    expect(collectMissingKeys(sparseCaps)).toContain('industry')
  })

  it('OVERWRITES an inflated model confidenceReport / missingData / competitorAnalysisComplete', () => {
    const sparseCaps = getStrategyCapabilities({ brandName: 'X' })
    const modelOutput: any = {
      campaignName: 'X', goal: 'LEADS', positioning: '', targetAudienceRefined: '',
      confidenceReport: { overall: 'high', byCapability: { contentStrategy: 'high' } }, // inflated
      missingData: [],                       // model claims nothing missing
      competitorAnalysisComplete: true,      // model claims complete
      kpis: [{ metric: 'Leads', target: '50', timeframe: '30d' }],
    }
    const s: any = applyServerReadiness(modelOutput, sparseCaps, { hasHistoricalData: false })
    expect(s.confidenceReport.overall).toBe('low')          // not 'high'
    expect(s.competitorAnalysisComplete).toBe(false)        // not true
    expect(s.missingData.length).toBeGreaterThan(0)         // not []
    expect(s.kpis[0].isHypothesis).toBe(true)               // no historical data
  })

  it('caps overall confidence below high when competitors or analytics/pixel are missing', () => {
    const fullButNoCompetitorsOrPixel = getStrategyCapabilities({
      ...contentReady,
      businessGoal: 'Generate qualified demos',
      primaryOffer: 'AI finance operations platform',
      audienceLocation: 'UAE',
      uniqueAdvantages: ['Arabic/English workflows'],
      marketingBudget: '$3,000/month',
      conversionDestination: 'Demo booking page',
      leadHandling: 'Sales replies within one business day',
    }, { hasPixel: false })

    expect(fullButNoCompetitorsOrPixel.fullStrategy.ready).toBe(true)
    expect(deriveConfidenceReport(fullButNoCompetitorsOrPixel).overall).toBe('medium')

    const fullWithCompetitorsAndPixel = getStrategyCapabilities({
      ...contentReady,
      businessGoal: 'Generate qualified demos',
      primaryOffer: 'AI finance operations platform',
      audienceLocation: 'UAE',
      uniqueAdvantages: ['Arabic/English workflows'],
      marketingBudget: '$3,000/month',
      conversionDestination: 'Demo booking page',
      leadHandling: 'Sales replies within one business day',
      competitorNotes: 'Competitor X focuses on enterprise teams.',
    }, { hasPixel: true })

    expect(deriveConfidenceReport(fullWithCompetitorsAndPixel).overall).toBe('high')
  })

  it('keeps paid readiness out of organic-only persisted strategy output', () => {
    const caps = getStrategyCapabilities({
      ...contentReady,
      businessGoal: 'Generate qualified demos',
      primaryOffer: 'AI finance operations platform',
      audienceLocation: 'UAE',
      uniqueAdvantages: ['Arabic/English workflows'],
      marketingBudget: '$3,000/month',
      conversionDestination: 'Demo booking page',
      leadHandling: 'Sales replies within one business day',
      competitorNotes: 'Competitor X focuses on enterprise teams.',
    }, { hasPixel: true })
    const s: any = applyServerReadiness({
      campaignName: 'Organic only',
      goal: 'LEADS',
      positioning: 'p',
      targetAudienceRefined: 'a',
      readyForPaidAds: true,
      readyForPaidAdsReason: 'Model overclaimed paid readiness',
      diagnosisDetails: { readyForPaidAds: true, readyForPaidAdsReason: 'Overclaim' },
    } as any, caps, { hasHistoricalData: false, strategyType: 'organic', language: 'ar' })

    expect(s.readyForPaidAds).toBe(false)
    expect(s.diagnosisDetails.readyForPaidAds).toBe(false)
    expect(s.confidenceReport.byCapability.paidStrategy).toBe('none')
    expect(s.readyForPaidAdsReason).toMatch(/عضوي فقط/)
    expect(s.readyForPaidAdsReason).not.toMatch(/Organic-only/)
  })

  it('competitorAnalysisComplete true only when competitors provided', () => {
    const caps = getStrategyCapabilities({ ...contentReady, competitorNotes: 'Clinic X undercuts on price' })
    const s: any = applyServerReadiness({ campaignName: 'X', goal: '', positioning: '', targetAudienceRefined: '' } as any, caps, { hasHistoricalData: false })
    expect(s.competitorAnalysisComplete).toBe(true)
  })
})

describe('sparse Brand Brain (missing budget/competitors/conversion)', () => {
  it('does not fabricate budget, flags missing data, marks KPIs hypotheses', () => {
    const caps = getStrategyCapabilities(contentReady) // content ok, but no budget/conv/competitors
    const modelOutput: any = {
      campaignName: 'X', goal: 'LEADS', positioning: 'p', targetAudienceRefined: 'a',
      budgetBreakdown: [], // no budget provided → stays empty
      kpis: [{ metric: 'Leads', target: '40 leads', timeframe: '30d' }],
      successMetricsDetailed: [{ category: 'lead', metric: 'enquiries', target: '40', timeframe: '30d' }],
    }
    const s: any = applyServerReadiness(modelOutput, caps, { hasHistoricalData: false })
    expect(s.budgetBreakdown).toEqual([])
    expect(s.missingData).toContain('marketingBudget')
    expect(s.missingData).toContain('conversionDestination')
    expect(s.kpis[0].isHypothesis).toBe(true)
    expect(s.successMetricsDetailed[0].isHypothesis).toBe(true)
  })
})

describe('organic contract — legacy fields still populated after pipeline', () => {
  it('applyServerReadiness preserves organic fields', () => {
    const caps = getStrategyCapabilities(contentReady)
    const s: any = applyServerReadiness(legacyStrategy, caps, { hasHistoricalData: true })
    expect(s.positioning).toBe(legacyStrategy.positioning)
    expect(s.audienceSegmentsDetailed).toHaveLength(1)
    expect(s.weeklyExecutionPlan).toHaveLength(1)
    expect(s.contentPillars).toEqual(['Trust', 'Comfort', 'Results'])
    // legacy strategy has no kpis key → stays undefined (renderer uses optional chaining)
    expect(s.kpis === undefined || Array.isArray(s.kpis)).toBe(true)
  })
})

describe('renderer robustness — partial / old output never crashes consumers', () => {
  it('normalizes a grab-bag of malformed fields without throwing', () => {
    const messy: any = {
      campaignName: 'X', kpis: 'nope', funnelStages: 5, riskNotes: { a: 1 },
      confidenceReport: [], assumptions: 'str', missingData: null,
    }
    const n: any = normalizeStrategyOutput(messy)
    expect(n.kpis).toEqual([])
    expect(n.funnelStages).toEqual([])
    expect(n.riskNotes).toEqual([])
    expect(n.assumptions).toEqual([])
    expect(n.missingData).toEqual([])
    // confidenceReport was [] (array) — not a valid object → dropped
    expect(n.confidenceReport).toBeUndefined()
  })
})
