import { describe, expect, it } from 'vitest'
import { summarizeFirstPartyMeasurement } from '@/lib/firstPartyMeasurement'

describe('first-party conversion measurement', () => {
  it('keeps browser events separate from server and human confirmed outcomes', () => {
    const summary = summarizeFirstPartyMeasurement([
      { eventType: 'PAGE_VIEW', verificationState: 'CLIENT_REPORTED', attribution: { source: 'instagram', medium: 'organic', campaign: 'launch' }, occurredAt: '2026-07-21T10:00:00Z' },
      { eventType: 'CTA_CLICK', verificationState: 'CLIENT_REPORTED', attribution: { source: 'instagram', medium: 'organic', campaign: 'launch' }, occurredAt: '2026-07-21T10:01:00Z' },
      { eventType: 'FORM_SUBMITTED', verificationState: 'SERVER_CONFIRMED', attribution: { source: 'instagram', medium: 'organic', campaign: 'launch' }, occurredAt: '2026-07-21T10:02:00Z' },
      { eventType: 'FORM_SUBMITTED', verificationState: 'CLIENT_REPORTED', occurredAt: '2026-07-21T10:03:00Z' },
    ], [{
      id: 'lead-1', source: 'FORM', stage: 'WON', attribution: { source: 'instagram', medium: 'organic', campaign: 'launch' },
      createdAt: '2026-07-21T10:02:00Z', convertedAt: '2026-07-21T12:00:00Z', conversionValue: '350.00', conversionCurrency: 'AED',
    }])

    expect(summary.funnel).toMatchObject({ pageViews: 1, ctaClicks: 1, confirmedForms: 1, leads: 1, wonLeads: 1 })
    expect(summary.revenueByCurrency).toEqual([{ currency: 'AED', value: 350, outcomes: 1 }])
    expect(summary.evidence).toEqual({
      pageViews: 'CLIENT_REPORTED', ctaClicks: 'CLIENT_REPORTED', formSubmissions: 'SERVER_CONFIRMED',
      wonLeads: 'MANUAL_CONFIRMED', revenue: 'MANUAL_CONFIRMED',
    })
  })

  it('never combines different currencies into a fake revenue total', () => {
    const summary = summarizeFirstPartyMeasurement([], [
      { id: 'a', source: 'MANUAL', stage: 'WON', createdAt: '2026-07-21', conversionValue: 100, conversionCurrency: 'AED' },
      { id: 'b', source: 'MANUAL', stage: 'WON', createdAt: '2026-07-21', conversionValue: 50, conversionCurrency: 'USD' },
      { id: 'c', source: 'MANUAL', stage: 'WON', createdAt: '2026-07-21', conversionValue: -1, conversionCurrency: 'USD' },
    ])
    expect(summary.revenueByCurrency).toEqual([
      { currency: 'AED', value: 100, outcomes: 1 },
      { currency: 'USD', value: 50, outcomes: 1 },
    ])
    expect(summary.funnel.revenueCoverageRate).toBeCloseTo(66.67, 2)
  })

  it('withholds directional conclusions until minimum evidence exists', () => {
    const summary = summarizeFirstPartyMeasurement([
      { eventType: 'PAGE_VIEW', verificationState: 'CLIENT_REPORTED', occurredAt: '2026-07-21' },
    ], [])
    expect(summary.stage).toBe('collecting')
    expect(summary.insights[0]).toMatchObject({ evidenceLevel: 'insufficient', causalClaim: false })
  })
})
