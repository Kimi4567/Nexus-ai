/**
 * Strategy PR-2A — capability-based readiness tests.
 *
 * getStrategyCapabilities() returns STABLE field keys + ready + confidence only
 * (the UI localizes them). Verifies: correct detection, the content base is folded
 * into full/paid so missingKeys is NEVER empty when not ready (no empty "add ."
 * sentence), and the organic gate uses the same professional input contract.
 * Pure logic — no network, no generation.
 */
import { describe, it, expect } from 'vitest'
import {
  getStrategyCapabilities,
  getBrandBrainReadiness,
  type StrategyProfileLike,
} from '@/lib/brandReadiness'

// Satisfies the professional 8-field organic/content gate.
const contentReadyProfile: StrategyProfileLike = {
  brandName: 'Reem Hospital',
  industry: 'Dental',
  description: 'Dental care in Abu Dhabi',
  primaryOffer: 'Dental consultations and treatment planning',
  targetAudience: 'Individuals seeking stress-free dental care',
  audiencePainPoints: ['Unclear treatment steps', 'Delayed appointment follow-up'],
  businessGoal: 'Generate qualified consultations',
  topPlatforms: ['INSTAGRAM', 'FACEBOOK'],
}

describe('getBrandBrainReadiness — professional organic contract', () => {
  it('NOT ready when required fields missing', () => {
    const r = getBrandBrainReadiness({ brandName: 'X' })
    expect(r.ready).toBe(false)
    expect(r.missingRequired).toContain('industry')
    expect(r.missingRequired).toContain('topPlatforms')
  })
  it('ready with the professional 8 required fields', () => {
    const r = getBrandBrainReadiness(contentReadyProfile)
    expect(r.ready).toBe(true)
    expect(r.missingRequired).toEqual([])
  })
  it('zero score for null profile', () => {
    expect(getBrandBrainReadiness(null).score).toBe(0)
    expect(getBrandBrainReadiness(null).ready).toBe(false)
  })
})

describe('content strategy', () => {
  it('ready (high) with the professional organic fields', () => {
    const c = getStrategyCapabilities(contentReadyProfile).contentStrategy
    expect(c.ready).toBe(true)
    expect(c.confidence).toBe('high')
    expect(c.missingKeys).toEqual([])
  })
  it('not ready (none) when missing — keys are stable field names', () => {
    const c = getStrategyCapabilities({ brandName: 'X' }).contentStrategy
    expect(c.ready).toBe(false)
    expect(c.confidence).toBe('none')
    expect(c.missingKeys).toContain('industry')
  })
})

describe('full marketing strategy', () => {
  it('partial/low when content ready but location/differentiator are missing', () => {
    const f = getStrategyCapabilities(contentReadyProfile).fullStrategy
    expect(f.ready).toBe(false)
    expect(f.confidence).toBe('low')
    expect(f.missingKeys).toContain('audienceLocation')
    expect(f.missingKeys).toContain('uniqueAdvantages')
    expect(f.missingKeys).not.toContain('industry') // content base present
  })
  it('ready/high when goal + offer + location + differentiator present', () => {
    const f = getStrategyCapabilities({
      ...contentReadyProfile,
      audienceLocation: 'Abu Dhabi',
      uniqueAdvantages: ['Painless tech'],
    }).fullStrategy
    expect(f.ready).toBe(true)
    expect(f.confidence).toBe('high')
    expect(f.missingKeys).toEqual([])
  })
  it('folds content base into missingKeys when content NOT ready (no empty list)', () => {
    const f = getStrategyCapabilities({ brandName: 'X', businessGoal: 'G', primaryOffer: 'O', audienceLocation: 'L', uniqueAdvantages: ['D'] }).fullStrategy
    expect(f.ready).toBe(false)
    expect(f.confidence).toBe('none')
    expect(f.missingKeys.length).toBeGreaterThan(0)
    expect(f.missingKeys).toContain('industry')
  })
})

describe('paid strategy', () => {
  it('not ready (none) without budget + conversion destination', () => {
    const p = getStrategyCapabilities({ ...contentReadyProfile, primaryOffer: 'X', audienceLocation: 'AD' }).paidStrategy
    expect(p.ready).toBe(false)
    expect(p.confidence).toBe('none')
    expect(p.missingKeys).toContain('marketingBudget')
    expect(p.missingKeys).toContain('conversionDestination')
  })
  it('ready when offer + budget + conversion destination + location present', () => {
    const p = getStrategyCapabilities({
      ...contentReadyProfile,
      primaryOffer: 'Implants',
      marketingBudget: '$1,000–3,000 / month',
      conversionDestination: 'WhatsApp',
      audienceLocation: 'Abu Dhabi',
      leadHandling: 'Sales team responds within one business day',
    }).paidStrategy
    expect(p.ready).toBe(true)
    expect(p.confidence).toBe('high')
    expect(p.missingKeys).toEqual([])
  })
  // ── Bug-fix edge case (PR-2A review #3) ──
  it('paid fields present but content basics MISSING → not ready, missingKeys non-empty (never "add .")', () => {
    const p = getStrategyCapabilities({
      brandName: 'X', // content basics deliberately incomplete
      primaryOffer: 'Implants',
      marketingBudget: '$2k/mo',
      conversionDestination: 'WhatsApp',
      audienceLocation: 'Abu Dhabi',
      leadHandling: 'Sales team responds within one business day',
    }).paidStrategy
    expect(p.ready).toBe(false)
    expect(p.confidence).toBe('none')
    expect(p.missingKeys.length).toBeGreaterThan(0)        // UI can never render an empty list
    expect(p.missingKeys).toContain('industry')            // content base folded in
    expect(p.missingKeys).not.toContain('marketingBudget') // the paid extras ARE present
  })
})

describe('kpiBudget / funnel (independent of content gate, never empty when not ready)', () => {
  it('kpiBudget needs goal + budget', () => {
    const none = getStrategyCapabilities(contentReadyProfile).kpiBudget
    expect(none.ready).toBe(false)
    expect(none.missingKeys.length).toBeGreaterThan(0)
    const ok = getStrategyCapabilities({ ...contentReadyProfile, businessGoal: 'Leads', marketingBudget: '$2k/mo' }).kpiBudget
    expect(ok.ready).toBe(true)
  })
  it('funnel needs offer + conversion destination + lead handling', () => {
    const f = getStrategyCapabilities({
      ...contentReadyProfile,
      primaryOffer: 'Implants',
      conversionDestination: 'Form',
      leadHandling: 'Front desk calls within 1h',
    }).funnel
    expect(f.ready).toBe(true)
  })
})

describe('competitor & retargeting', () => {
  it('competitor incomplete (none) when no competitors', () => {
    const c = getStrategyCapabilities(contentReadyProfile).competitorAnalysis
    expect(c.ready).toBe(false)
    expect(c.confidence).toBe('none')
    expect(c.missingKeys).toContain('competitors')
  })
  it('competitor low-confidence when notes provided (user data, not live market)', () => {
    const c = getStrategyCapabilities({ ...contentReadyProfile, competitorNotes: 'Clinic X undercuts on price' }).competitorAnalysis
    expect(c.ready).toBe(true)
    expect(c.confidence).toBe('low')
  })
  it('retargeting none without pixel, high with pixel', () => {
    expect(getStrategyCapabilities(contentReadyProfile).retargeting.confidence).toBe('none')
    expect(getStrategyCapabilities(contentReadyProfile).retargeting.missingKeys).toContain('pixel')
    expect(getStrategyCapabilities(contentReadyProfile, { hasPixel: true }).retargeting.ready).toBe(true)
  })
})

describe('null safety + invariant', () => {
  it('handles null profile without throwing', () => {
    const caps = getStrategyCapabilities(null)
    expect(caps.contentStrategy.ready).toBe(false)
    expect(caps.paidStrategy.ready).toBe(false)
  })
  it('INVARIANT: every not-ready capability has a non-empty missingKeys', () => {
    const caps = getStrategyCapabilities(null)
    for (const c of Object.values(caps)) {
      if (!c.ready) expect(c.missingKeys.length).toBeGreaterThan(0)
    }
  })
})
