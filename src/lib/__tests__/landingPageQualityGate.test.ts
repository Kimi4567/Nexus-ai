import { describe, expect, it } from 'vitest'
import { evaluateLandingPageQuality, type LandingPageQualityInput } from '@/lib/landingPageQualityGate'

const READY_INPUT: LandingPageQualityInput = {
  headline: 'Build a measurable acquisition campaign for your next offer',
  subheadline: 'Turn one campaign brief into a focused conversion journey for qualified buyers.',
  body: 'Create a reviewed landing page with a clear offer, concrete benefits, and a connected lead form so the team can separate browser signals from server-confirmed submissions.',
  benefits: ['Clear positioning', 'Reviewed call to action', 'Confirmed lead intake'],
  proof: 'Based on customer-supplied campaign evidence.',
  primaryCtaLabel: 'Start the campaign',
  primaryCtaUrl: '',
  captureFormId: 'form-1',
  seoTitle: 'Build a measurable acquisition campaign | NEXUS',
  seoDescription: 'Build a reviewed acquisition campaign with clear positioning, a focused landing page, and server-confirmed lead intake for your team.',
  seoIndexable: true,
}

describe('landing-page quality gate', () => {
  it('marks a complete, measurable page ready without claiming ranking or conversion performance', () => {
    const result = evaluateLandingPageQuality(READY_INPUT)

    expect(result.blockers).toBe(0)
    expect(result.measurementMode).toBe('SERVER_CONFIRMED_FORM')
    expect(result.score).toBe(100)
    expect(result.checks.every(check => check.status === 'READY')).toBe(true)
  })

  it('blocks a missing destination and incomplete metadata when indexing is requested', () => {
    const result = evaluateLandingPageQuality({
      ...READY_INPUT,
      captureFormId: '',
      primaryCtaUrl: '',
      seoTitle: 'Short',
      seoDescription: 'Too short',
    })

    expect(result.blockers).toBe(2)
    expect(result.measurementMode).toBe('NOT_CONFIGURED')
    expect(result.checks.find(check => check.id === 'DESTINATION')?.status).toBe('BLOCKER')
    expect(result.checks.find(check => check.id === 'SEARCH_METADATA')?.status).toBe('BLOCKER')
  })

  it('keeps search checks informational while indexing is disabled', () => {
    const result = evaluateLandingPageQuality({
      ...READY_INPUT,
      seoIndexable: false,
      seoTitle: '',
      seoDescription: '',
    })

    expect(result.blockers).toBe(0)
    expect(result.checks.find(check => check.id === 'SEARCH_METADATA')?.status).toBe('INFO')
    expect(result.checks.find(check => check.id === 'SEARCH_SNIPPET_FIT')?.status).toBe('INFO')
    expect(result.checks.find(check => check.id === 'MESSAGE_MATCH')?.status).toBe('INFO')
  })

  it('does not treat absent proof as a failure that pressures users to invent a claim', () => {
    const result = evaluateLandingPageQuality({ ...READY_INPUT, proof: '' })

    expect(result.checks.find(check => check.id === 'PROOF')?.status).toBe('INFO')
    expect(result.blockers).toBe(0)
    expect(result.warnings).toBe(0)
    expect(result.score).toBe(100)
  })

  it('labels an external destination as browser-reported rather than a confirmed commercial outcome', () => {
    const result = evaluateLandingPageQuality({
      ...READY_INPUT,
      captureFormId: '',
      primaryCtaUrl: 'https://example.com/offer',
    })

    expect(result.measurementMode).toBe('CLIENT_REPORTED_CLICK')
    expect(result.blockers).toBe(0)
  })

  it('uses a language-agnostic heuristic for Arabic message match', () => {
    const result = evaluateLandingPageQuality({
      ...READY_INPUT,
      headline: 'ابنِ حملة تسويق قابلة للقياس لعرضك القادم',
      seoTitle: 'حملة تسويق قابلة للقياس | نيكسس',
    })

    expect(result.checks.find(check => check.id === 'MESSAGE_MATCH')?.status).toBe('READY')
  })

  it('does not treat common connector words as evidence of message match', () => {
    const result = evaluateLandingPageQuality({
      ...READY_INPUT,
      headline: 'Campaign planning for growth teams',
      seoTitle: 'Website design for healthcare companies',
    })

    expect(result.checks.find(check => check.id === 'MESSAGE_MATCH')?.status).toBe('WARNING')
  })
})
