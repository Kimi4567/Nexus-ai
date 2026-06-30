import { describe, expect, it } from 'vitest'
import {
  getBrandBrainLearningCopy,
  isAnalyticsBackedLearning,
  type BrandBrainSignalSource,
} from '@/lib/brandBrainLearningContract'

function expectNoPerformanceTerms(text: string) {
  expect(text).not.toMatch(/\blearned\b/i)
  expect(text).not.toMatch(/\blearning\b/i)
  expect(text).not.toMatch(/\bwinning\b/i)
  expect(text).not.toMatch(/\bbest-performing\b/i)
  expect(text).not.toMatch(/\bperformance winner\b/i)
}

describe('brandBrainLearningContract', () => {
  it('labels approval as saved signals, not learning or winners', () => {
    const copy = getBrandBrainLearningCopy('approval')
    expect(copy.category).toBe('CONTENT_APPROVAL_SIGNAL')
    expect(copy.label).toBe('Approval signals saved')
    expect(copy.canUseLearningLanguage).toBe(false)
    expect(copy.canUseWinningLanguage).toBe(false)
    expectNoPerformanceTerms(`${copy.label} ${copy.description}`)
  })

  it('labels manual publish as execution recorded, not performance learning', () => {
    const copy = getBrandBrainLearningCopy('manual_publish')
    expect(copy.category).toBe('MANUAL_EXECUTION_EVENT')
    expect(copy.label).toBe('Manual execution recorded')
    expect(copy.canUseLearningLanguage).toBe(false)
    expect(copy.canUseWinningLanguage).toBe(false)
    expectNoPerformanceTerms(`${copy.label} ${copy.description}`)
  })

  it('labels user variant picks as selected variants, not winners', () => {
    const copy = getBrandBrainLearningCopy('user_variant_pick')
    expect(copy.category).toBe('USER_PREFERENCE_SIGNAL')
    expect(copy.label).toBe('User-selected variant')
    expect(copy.canUseLearningLanguage).toBe(false)
    expect(copy.canUseWinningLanguage).toBe(false)
    expectNoPerformanceTerms(`${copy.label} ${copy.description}`)
  })

  it('allows analytics-backed learning and winning language only for analytics', () => {
    const analytics = getBrandBrainLearningCopy('analytics')
    expect(analytics.category).toBe('ANALYTICS_LEARNING')
    expect(analytics.label).toBe('Analytics-backed learning')
    expect(analytics.canUseLearningLanguage).toBe(true)
    expect(analytics.canUseWinningLanguage).toBe(true)
    expect(isAnalyticsBackedLearning('analytics')).toBe(true)
  })

  it('reports missing analytics as pending, not active learning', () => {
    const copy = getBrandBrainLearningCopy('missing_analytics')
    expect(copy.category).toBe('ANALYTICS_PENDING')
    expect(copy.label).toBe('Analytics pending')
    expect(copy.canUseLearningLanguage).toBe(false)
    expect(copy.canUseWinningLanguage).toBe(false)
    expect(copy.description).toContain('No analytics-backed performance evidence')
  })

  it('keeps all non-analytics sources out of learning language', () => {
    const sources: BrandBrainSignalSource[] = ['approval', 'manual_publish', 'user_variant_pick', 'missing_analytics']
    expect(sources.every(source => !isAnalyticsBackedLearning(source))).toBe(true)
  })
})
