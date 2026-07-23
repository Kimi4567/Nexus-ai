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
    expect(summary.funnel).toMatchObject({ leads: 1, qualifiedLeads: 1, wonLeads: 1 })
    expect(summary.attributionModels.firstTouch[0]).toMatchObject({
      source: 'instagram', medium: 'organic', campaign: 'launch', leads: 1, qualifiedLeads: 1, wonLeads: 1,
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

  it('withholds an impossible page-to-lead rate when browser coverage is incomplete', () => {
    const summary = summarizeFirstPartyMeasurement([
      { eventType: 'PAGE_VIEW', verificationState: 'CLIENT_REPORTED', occurredAt: '2026-07-21T10:00:00Z' },
      { eventType: 'FORM_SUBMITTED', verificationState: 'SERVER_CONFIRMED', occurredAt: '2026-07-21T10:01:00Z' },
      { eventType: 'FORM_SUBMITTED', verificationState: 'SERVER_CONFIRMED', occurredAt: '2026-07-21T10:02:00Z' },
    ], [])

    expect(summary.stage).toBe('collecting')
    expect(summary.funnel.pageToLeadRate).toBeNull()
    expect(summary.insights[0]).toMatchObject({
      code: 'FIRST_PARTY_BROWSER_COVERAGE_MISMATCH',
      evidenceLevel: 'insufficient',
      causalClaim: false,
    })
  })

  it('preserves first-touch outcomes and calculates last-touch from the latest recapture only', () => {
    const summary = summarizeFirstPartyMeasurement([], [{
      id: 'lead-1', source: 'FORM', stage: 'WON',
      attribution: { source: 'instagram', medium: 'organic', campaign: 'launch' },
      createdAt: '2026-07-20T10:00:00Z', conversionValue: 200, conversionCurrency: 'AED',
    }], [
      {
        leadId: 'lead-1', type: 'FORM_RECAPTURED',
        metadata: { attribution: { source: 'newsletter', medium: 'email', campaign: 'nurture-1' } },
        occurredAt: '2026-07-21T10:00:00Z',
      },
      {
        leadId: 'lead-1', type: 'FORM_RECAPTURED',
        metadata: { attribution: { source: 'google', medium: 'cpc', campaign: 'brand-search' } },
        occurredAt: '2026-07-22T10:00:00Z',
      },
    ])

    expect(summary.attributionModels.firstTouch).toEqual([expect.objectContaining({
      source: 'instagram', medium: 'organic', campaign: 'launch', wonLeads: 1,
    })])
    expect(summary.attributionModels.lastTouch).toEqual([expect.objectContaining({
      source: 'google', medium: 'cpc', campaign: 'brand-search', wonLeads: 1,
    })])
    expect(summary.attributionModels.firstTouch[0].revenueByCurrency).toEqual([{ currency: 'AED', value: 200 }])
    expect(summary.attributionModels.lastTouch[0].revenueByCurrency).toEqual([{ currency: 'AED', value: 200 }])
  })

  it('exposes the evidence threshold as directional review readiness, never statistical proof', () => {
    const events = [
      ...Array.from({ length: 20 }, (_, index) => ({
        eventType: 'PAGE_VIEW', verificationState: 'CLIENT_REPORTED', occurredAt: `2026-07-21T10:${String(index).padStart(2, '0')}:00Z`,
      })),
      ...Array.from({ length: 3 }, (_, index) => ({
        eventType: 'FORM_SUBMITTED', verificationState: 'SERVER_CONFIRMED', occurredAt: `2026-07-21T11:0${index}:00Z`,
      })),
    ]
    const summary = summarizeFirstPartyMeasurement(events, [])

    expect(summary.stage).toBe('directional')
    expect(summary.sample).toEqual({
      minimumTrackedViews: 20,
      minimumConfirmedForms: 3,
      trackedViewsRemaining: 0,
      confirmedFormsRemaining: 0,
      readyForDirectionalReview: true,
      statisticalProof: false,
    })
  })
})
