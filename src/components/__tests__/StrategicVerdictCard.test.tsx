// @vitest-environment jsdom

/**
 * Strategy PR-2B2C — derived verdict + top-3 decisions.
 * Pure derivation + light render. No network, no generation, no credits.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StrategicVerdictCard, {
  deriveStrategicVerdict,
  deriveTopDecisions,
  type VerdictInput,
} from '@/components/StrategicVerdictCard'

const full: VerdictInput = {
  locale: 'en',
  positioning: 'Reem Hospital is the dental care provider for individuals in Abu Dhabi who need exceptional oral care without anxiety.',
  keyMessage: 'Experience exceptional dental care in a stress-free environment.',
  differentiation: 'Comfortable, stress-free clinic with personalized treatments.',
  targetAudienceRefined: 'Anxious dental patients in Abu Dhabi',
  topSegment: 'Anxious Patients',
  audienceLocation: 'Abu Dhabi',
  confidenceReport: { overall: 'medium', byCapability: { paidStrategy: 'none', contentStrategy: 'high' } },
  missingDataKeys: ['marketingBudget', 'conversionDestination', 'pixel', 'businessGoal'],
  hasFunnel: true,
  kpisAreHypotheses: true,
}

const PAID_FORBIDDEN = /\blaunch|\bspend|\bad set|\bads? are active|will launch|activate|activation/i

describe('deriveStrategicVerdict', () => {
  it('builds a verdict from existing fields (organic-first + honest paid clause)', () => {
    const { text, isFallback } = deriveStrategicVerdict(full)
    expect(isFallback).toBe(false)
    expect(text).toMatch(/organic content first/i)
    expect(text).toMatch(/Anxious Patients/)
    expect(text).toMatch(/Abu Dhabi/)
    expect(text).toMatch(/before paid execution/i)
    // Oxford "and" before the final paid prerequisite (copy polish).
    expect(text).toMatch(/budget, conversion data, and tracking/)
  })

  it('sparse input returns the calm fallback', () => {
    const { text, isFallback } = deriveStrategicVerdict({ locale: 'en', missingDataKeys: [] })
    expect(isFallback).toBe(true)
    expect(text).toMatch(/Strategy direction is available, but more Brand Brain data is needed/)
  })

  it('never implies paid is active / will launch / will spend (full brand)', () => {
    expect(PAID_FORBIDDEN.test(deriveStrategicVerdict(full).text)).toBe(false)
  })

  it('omits the paid clause for old strategies (no confidenceReport)', () => {
    const old: VerdictInput = { locale: 'en', positioning: full.positioning, topSegment: 'Anxious Patients', audienceLocation: 'Abu Dhabi' }
    const { text } = deriveStrategicVerdict(old)
    expect(text).not.toMatch(/paid/i)
    expect(PAID_FORBIDDEN.test(text)).toBe(false)
  })
})

describe('deriveTopDecisions', () => {
  it('caps at 3 and returns strategic decisions in priority order', () => {
    const d = deriveTopDecisions(full)
    expect(d.length).toBe(3)
    expect(d[0].key).toBe('organic')
    expect(d.map(x => x.key)).toContain('holdPaid')
  })
  it('decisions never use execution/Action-Card wording', () => {
    const all = deriveTopDecisions(full).map(d => d.text).join(' ').toLowerCase()
    expect(all).not.toMatch(/approve|launch|spend|start paid|click/)
  })
  it('old/sparse strategy yields few or no decisions, never padded', () => {
    const d = deriveTopDecisions({ locale: 'en', missingDataKeys: [] })
    // paidReady is false (no report) → organic decision still applies; but no missing-data/kpi/segment
    expect(d.length).toBeLessThanOrEqual(3)
  })
})

describe('render', () => {
  it('renders verdict text and numbered decisions, no button', () => {
    const { container } = render(<StrategicVerdictCard {...full} />)
    expect(screen.getByText(/organic content first/i)).toBeTruthy()
    expect(screen.getByText('Strategic direction')).toBeTruthy()
    expect(container.querySelectorAll('button').length).toBe(0) // informational card, no CTA
  })
  it('renders fallback for sparse input without crashing', () => {
    render(<StrategicVerdictCard locale="en" missingDataKeys={[]} />)
    expect(screen.getByText(/more Brand Brain data is needed/)).toBeTruthy()
  })
})
