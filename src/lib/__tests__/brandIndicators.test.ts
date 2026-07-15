import { describe, it, expect } from 'vitest'
import { getBrandIndicators, type BrandIndicatorProfile } from '../brandIndicators'

const organicComplete: BrandIndicatorProfile = {
  brandName: 'NEXUS AI',
  industry: 'Tech & Apps',
  description: 'AI marketing operator for SMEs',
  primaryOffer: 'AI marketing automation',
  targetAudience: 'SME founders',
  audiencePainPoints: ['no time to market', 'inconsistent posting'],
  businessGoal: 'Generate qualified leads',
  topPlatforms: ['Instagram', 'LinkedIn'],
}

describe('getBrandIndicators — null / empty', () => {
  it('returns zeroed, not-ready, planning-only result for null', () => {
    const r = getBrandIndicators(null)
    expect(r.brandCompleteness.score).toBe(0)
    expect(r.brandCompleteness.level).toBe('none')
    expect(r.organicReadiness.ready).toBe(false)
    expect(r.organicReadiness.missingKeys.length).toBeGreaterThan(0)
    expect(r.paidReadiness.ready).toBe(false)
    expect(r.paidReadiness.launchReady).toBe(false)
    expect(r.paidReadiness.note).toBe('planning_only')
    expect(r.memoryRichness.score).toBe(0)
    expect(r.memoryRichness.signals).toBe(0)
  })
})

describe('brandCompleteness — core durable fields only', () => {
  it('rises with core fields and lists missing core keys', () => {
    const r = getBrandIndicators(organicComplete)
    expect(r.brandCompleteness.score).toBeGreaterThan(0)
    // audienceAge + audienceLocation not provided → reported missing
    expect(r.brandCompleteness.missingKeys).toContain('audienceAge')
    expect(r.brandCompleteness.missingKeys).toContain('audienceLocation')
    expect(r.brandCompleteness.missingKeys).not.toContain('brandName')
  })

  it('is NOT inflated by learned memory (hooks/angles do not count toward completeness)', () => {
    const coreOnly = getBrandIndicators({ brandName: 'A', industry: 'Tech & Apps' })
    const coreWithMemory = getBrandIndicators({
      brandName: 'A', industry: 'Tech & Apps',
      winningHooks: ['h1', 'h2', 'h3', 'h4', 'h5'],
      winningAngles: ['a1', 'a2', 'a3'],
    }, { acceptedLearningCount: 13 })
    // completeness identical; only memory richness differs
    expect(coreWithMemory.brandCompleteness.score).toBe(coreOnly.brandCompleteness.score)
    expect(coreWithMemory.memoryRichness.score).toBeGreaterThan(coreOnly.memoryRichness.score)
  })
})

describe('organicReadiness — minimum organic set', () => {
  it('is ready when the full organic set is present', () => {
    const r = getBrandIndicators(organicComplete)
    expect(r.organicReadiness.ready).toBe(true)
    expect(r.organicReadiness.missingKeys).toEqual([])
    expect(r.organicReadiness.score).toBe(100)
  })

  it('is not ready when business goal / pain points are missing', () => {
    const r = getBrandIndicators({ ...organicComplete, businessGoal: '', audiencePainPoints: [] })
    expect(r.organicReadiness.ready).toBe(false)
    expect(r.organicReadiness.missingKeys).toContain('businessGoal')
    expect(r.organicReadiness.missingKeys).toContain('audiencePainPoints')
  })
})

describe('paidReadiness — honest planning-only', () => {
  it('stays planning-only / not launch-ready when prerequisites are missing', () => {
    const r = getBrandIndicators(organicComplete) // no budget/conversion/location/follow-up
    expect(r.paidReadiness.ready).toBe(false)
    expect(r.paidReadiness.note).toBe('planning_only')
    expect(r.paidReadiness.launchReady).toBe(false)
    expect(r.paidReadiness.missingKeys).toContain('marketingBudget')
  })

  it('marks prerequisites met but still never launch-ready (approval-gated)', () => {
    const paidComplete: BrandIndicatorProfile = {
      ...organicComplete,
      marketingBudget: '$1,000 / month',
      conversionDestination: 'Landing page',
      audienceLocation: 'UAE',
      leadHandling: 'Sales team responds within one business day',
    }
    const r = getBrandIndicators(paidComplete)
    expect(r.paidReadiness.ready).toBe(true)
    expect(r.paidReadiness.note).toBe('ready')
    expect(r.paidReadiness.launchReady).toBe(false) // policy: paid never auto-launches
    expect(r.paidReadiness.missingKeys).toEqual([])
  })

  it('keeps paid planning ready without tracking while launch remains locked', () => {
    const r = getBrandIndicators({
      ...organicComplete,
      marketingBudget: '$1,000 / month',
      conversionDestination: 'Landing page',
      audienceLocation: 'UAE',
      leadHandling: 'Sales team responds within one business day',
    }, { hasPixel: false })

    expect(r.paidReadiness.ready).toBe(true)
    expect(r.paidReadiness.note).toBe('ready')
    expect(r.paidReadiness.launchReady).toBe(false)
    expect(r.paidReadiness.missingKeys).not.toContain('pixel')
  })

  it('does not claim paid readiness without a real lead follow-up path', () => {
    const r = getBrandIndicators({
      ...organicComplete,
      marketingBudget: '$1,000 / month',
      conversionDestination: 'Landing page',
      audienceLocation: 'UAE',
    }, { hasPixel: true })
    expect(r.paidReadiness.ready).toBe(false)
    expect(r.paidReadiness.missingKeys).toContain('leadHandling')
  })
})

describe('memoryRichness — separate from readiness', () => {
  it('high memory does not make an organically-unready brand look ready', () => {
    const richMemoryWeakCore: BrandIndicatorProfile = {
      brandName: 'A',
      winningHooks: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
      winningAngles: ['a1', 'a2', 'a3', 'a4'],
      failedAngles: ['f1'],
      audiencePainPoints: ['p1', 'p2', 'p3'],
    }
    const r = getBrandIndicators(richMemoryWeakCore, { acceptedLearningCount: 13 })
    expect(r.memoryRichness.score).toBeGreaterThan(0)
    expect(r.memoryRichness.signals).toBeGreaterThanOrEqual(3)
    // readiness is unaffected by memory
    expect(r.organicReadiness.ready).toBe(false)
    expect(r.paidReadiness.ready).toBe(false)
  })
})
