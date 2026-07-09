// @vitest-environment jsdom

/**
 * Strategy PR-2B2B1 — one-primary-CTA action resolver + card.
 * Pure logic + light render. No network, no generation, no credits.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import StrategyActionCard, { resolveStrategyAction, type StrategyActionState } from '@/components/StrategyActionCard'

const base: StrategyActionState = {
  locale: 'en',
  engineRunning: false,
  brandBaseReady: true,
  sentinelPassed: false,
  isApproved: false,
  hasContentPlan: false,
  hasPosts: false,
  reviewing: false,
  approving: false,
  missingDataKeys: [],
  paidGated: false,
  contentHubHref: '/campaigns/x/content-hub',
  contentHubBuildHref: '/campaigns/x/content-hub?buildPlan=1',
}

describe('resolveStrategyAction — state → single primary', () => {
  it('engine running → working, not clickable', () => {
    expect(resolveStrategyAction({ ...base, engineRunning: true }).primary.kind).toBe('working')
  })
  it('brand base not ready → Complete Brand Brain (link to /brand)', () => {
    const p = resolveStrategyAction({ ...base, brandBaseReady: false }).primary
    expect(p.kind).toBe('link'); expect(p.href).toBe('/brand'); expect(p.label).toMatch(/Complete Brand Brain/)
  })
  it('not reviewed → Review strategy quality', () => {
    const p = resolveStrategyAction(base).primary
    expect(p.kind).toBe('review'); expect(p.label).toMatch(/Review strategy quality/)
  })
  it('reviewed/passed not approved → Confirm strategy and open content plan (no launch/publish/spend)', () => {
    const p = resolveStrategyAction({ ...base, sentinelPassed: true }).primary
    expect(p.kind).toBe('approve')
    expect(p.label).toBe('Confirm strategy and open content plan')
    expect(p.label.toLowerCase()).not.toMatch(/launch|publish|spend/)
  })
  it('approved no plan → Generate organic content plan', () => {
    const p = resolveStrategyAction({ ...base, isApproved: true }).primary
    expect(p.kind).toBe('link'); expect(p.href).toContain('buildPlan=1'); expect(p.label).toMatch(/Generate organic content plan/)
  })
  it('approved, plan, no posts → Review content in Content Hub', () => {
    const p = resolveStrategyAction({ ...base, isApproved: true, hasContentPlan: true }).primary
    expect(p.label).toMatch(/Review content in Content Hub/)
  })
  it('approved, plan, posts → Review & schedule content', () => {
    const p = resolveStrategyAction({ ...base, isApproved: true, hasContentPlan: true, hasPosts: true }).primary
    expect(p.href).toBe(base.contentHubHref); expect(p.label).toMatch(/Review & schedule content/)
  })
})

describe('single-primary invariant + honest labels', () => {
  const states: Partial<StrategyActionState>[] = [
    { engineRunning: true }, { brandBaseReady: false }, {}, { sentinelPassed: true },
    { isApproved: true }, { isApproved: true, hasContentPlan: true },
    { isApproved: true, hasContentPlan: true, hasPosts: true },
  ]
  it('always exactly one primary, and never implies launch/publish/spend', () => {
    for (const s of states) {
      const { primary, secondaries } = resolveStrategyAction({ ...base, ...s })
      expect(primary).toBeTruthy()
      const labels = [primary.label, ...secondaries.map(x => x.label)].join(' ').toLowerCase()
      expect(labels).not.toMatch(/launch|publish|spend/)
    }
  })
})

describe('secondaries — quiet, filtered, capped at 3', () => {
  it('shows budget + conversion + complete-brand, capped at 3', () => {
    const { secondaries } = resolveStrategyAction({
      ...base, sentinelPassed: true,
      missingDataKeys: ['marketingBudget', 'conversionDestination', 'industry', 'businessGoal'],
    })
    expect(secondaries.length).toBeLessThanOrEqual(3)
    const keys = secondaries.map(s => s.key)
    expect(keys).toContain('budget'); expect(keys).toContain('conv')
  })
  it('does not duplicate the primary (no Complete Brand Brain secondary when it is the primary)', () => {
    const { primary, secondaries } = resolveStrategyAction({ ...base, brandBaseReady: false, missingDataKeys: ['industry'] })
    expect(primary.label).toMatch(/Complete Brand Brain/)
    expect(secondaries.find(s => s.key === 'brand')).toBeUndefined()
  })
})

describe('paid is never a CTA; trust copy is state-aware', () => {
  it('paidGated adds a gated planning line but no paid CTA', () => {
    const { primary, secondaries, trustLines } = resolveStrategyAction({ ...base, sentinelPassed: true, paidGated: true })
    const allLabels = [primary.label, ...secondaries.map(s => s.label)].join(' ').toLowerCase()
    expect(allLabels).not.toMatch(/paid|ad set|ads/)
    expect(trustLines.join(' ')).toMatch(/no budget will be spent/)
  })
  it('always includes the human-review line', () => {
    expect(resolveStrategyAction(base).trustLines[0]).toMatch(/nothing publishes automatically/)
  })
  it('missing data adds the limited-confidence line', () => {
    expect(resolveStrategyAction({ ...base, missingDataKeys: ['marketingBudget'] }).trustLines.join(' '))
      .toMatch(/confidence is limited/)
  })
})

describe('old strategy compatibility', () => {
  it('no missingData / no paid → one trust line, no missing-data secondaries, primary still resolves', () => {
    const { primary, secondaries, trustLines } = resolveStrategyAction(base)
    expect(primary.kind).toBe('review')
    expect(secondaries.length).toBe(0)
    expect(trustLines.length).toBe(1)
  })
})

describe('render smoke', () => {
  it('renders the primary CTA + trust line and calls onReview', () => {
    const onReview = vi.fn()
    render(<StrategyActionCard {...base} nextBestAction="Develop Reels showcasing patient testimonials." onReview={onReview} onApprove={() => {}} />)
    expect(screen.getByText('Review strategy quality')).toBeTruthy()
    expect(screen.getByText(/nothing publishes automatically/)).toBeTruthy()
    screen.getByText('Review strategy quality').click()
    expect(onReview).toHaveBeenCalled()
  })
})
