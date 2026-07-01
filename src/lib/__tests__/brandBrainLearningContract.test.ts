import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
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

  it('keeps user-selected variant proposal context out of winner/loser vocabulary', () => {
    const routeSource = readSource('src/app/api/campaigns/[id]/content-plan/[postId]/pick-winner/route.ts')
    const brainLearningSource = readSource('src/lib/brain-learning.ts')

    expect(routeSource).toContain("trigger: 'user_selected_variant'")
    expect(routeSource).toContain('selectedVariant')
    expect(routeSource).toContain('discardedVariant')
    expect(routeSource).toContain('Not analytics-backed performance evidence')
    expect(routeSource).toContain('preferenceSignalSaved: false')
    expect(routeSource).toContain('preferenceSignalProposalQueued')
    expect(routeSource).toContain('A preference signal proposal was queued for review')
    expect(routeSource).not.toContain('saved as a user preference signal')
    expect(routeSource).not.toContain("trigger: 'ab_winner'")
    expect(routeSource).not.toContain('payload: {\\n          winner:')
    expect(routeSource).not.toContain('payload: {\\n          loser:')

    expect(brainLearningSource).toContain("trigger === 'ab_winner' || trigger === 'user_selected_variant'")
    expect(brainLearningSource).toContain('USER PREFERENCE SIGNAL only')
    expect(brainLearningSource).toContain('SELECTED DRAFT VARIANT')
    expect(brainLearningSource).toContain('DISCARDED DRAFT VARIANT')
    expect(brainLearningSource).toContain('Do not use winner, winning, loser, best-performing, performance winner')
  })

  it('prevents approval and variant selection from directly mutating BrandProfile winning fields', () => {
    const approvalRoute = readSource('src/app/api/campaigns/[id]/approve-content-plan/route.ts')
    const pickVariantRoute = readSource('src/app/api/campaigns/[id]/content-plan/[postId]/pick-winner/route.ts')
    const campaignRoute = readSource('src/app/api/campaigns/[id]/route.ts')

    expect(approvalRoute).not.toMatch(/brandProfile\.update|prisma\.brandProfile\.update/)
    expect(approvalRoute).not.toContain('data: {\n              winningHooks')
    expect(approvalRoute).not.toContain('data: {\n              winningAngles')

    expect(pickVariantRoute).not.toMatch(/brandProfile\.update|prisma\.brandProfile\.update/)
    expect(pickVariantRoute).not.toContain('winningHooks: mergeUnique')

    expect(campaignRoute).not.toMatch(/brandProfile\.update|prisma\.brandProfile\.update/)
    expect(campaignRoute).toContain('Campaign status changes are workflow events only')
  })

  it('keeps suggestions approval as reviewed workflow input instead of direct learning', () => {
    const suggestionsRoute = readSource('src/app/api/suggestions/route.ts')

    expect(suggestionsRoute).not.toContain('applyBrandBrainLearning')
    expect(suggestionsRoute).not.toMatch(/brandProfile\.update|prisma\.brandProfile\.update/)
    expect(suggestionsRoute).toContain('Suggestion applied as reviewed brand input')
    expect(suggestionsRoute).toContain('Needs analytics before performance learning')
  })

  it('keeps legacy brain routes and rewrite prompts on signal language for non-analytics sources', () => {
    const brainRoute = readSource('src/app/api/brain/learn/route.ts')
    const rewriteRoute = readSource('src/app/api/campaigns/[id]/content-plan/[postId]/rewrite/route.ts')

    expect(brainRoute).toContain('Reviewed Hook Signals')
    expect(brainRoute).toContain('Content Angle Signals')
    expect(brainRoute).toContain('review signals')
    expect(brainRoute).not.toContain('Winning Hooks')
    expect(brainRoute).not.toContain('Winning Angles')
    expect(brainRoute).not.toContain('permanent memory')

    expect(rewriteRoute).toContain('Reviewed hook signals to consider')
    expect(rewriteRoute).not.toContain('Proven hook formulas')
  })
})
