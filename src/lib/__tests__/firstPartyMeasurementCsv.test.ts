import { describe, expect, it } from 'vitest'
import { summarizeFirstPartyMeasurement } from '@/lib/firstPartyMeasurement'
import { buildFirstPartyMeasurementCsv } from '@/lib/firstPartyMeasurementCsv'

describe('first-party measurement CSV', () => {
  it('exports distinct funnel, first-touch, last-touch, and revenue evidence', () => {
    const summary = summarizeFirstPartyMeasurement([
      { eventType: 'PAGE_VIEW', verificationState: 'CLIENT_REPORTED', attribution: { source: 'instagram', campaign: 'launch' }, occurredAt: '2026-07-21' },
      { eventType: 'FORM_SUBMITTED', verificationState: 'SERVER_CONFIRMED', attribution: { source: 'instagram', campaign: 'launch' }, occurredAt: '2026-07-21' },
    ], [{
      id: 'lead-1', source: 'FORM', stage: 'WON', attribution: { source: 'instagram', campaign: 'launch' },
      createdAt: '2026-07-21', conversionValue: 350, conversionCurrency: 'AED',
    }], [{
      leadId: 'lead-1', type: 'FORM_RECAPTURED',
      metadata: { attribution: { source: 'newsletter', medium: 'email', campaign: 'nurture' } },
      occurredAt: '2026-07-22',
    }])

    const csv = buildFirstPartyMeasurementCsv(summary, {
      campaignId: 'campaign-1', campaignName: 'Launch', generatedAt: '2026-07-22T12:00:00.000Z',
    })

    expect(csv).toContain('funnel,confirmed_submissions,1,SERVER_CONFIRMED')
    expect(csv).toContain('first_touch,immutable_acquisition_source')
    expect(csv).toContain('last_touch,latest_recorded_recapture_source')
    expect(csv).toContain('newsletter,email,nurture')
    expect(csv).toContain('revenue,manually_confirmed_won_value,1,MANUAL_CONFIRMED')
    expect(csv).toContain('metadata,statistical_proof,false')
  })

  it('neutralizes spreadsheet formulas from UTM values', () => {
    const summary = summarizeFirstPartyMeasurement([
      { eventType: 'PAGE_VIEW', verificationState: 'CLIENT_REPORTED', attribution: { source: '=WEBSERVICE("https://evil.example")' }, occurredAt: '2026-07-21' },
    ], [])
    const csv = buildFirstPartyMeasurementCsv(summary, {
      campaignId: null, campaignName: null, generatedAt: '2026-07-22T12:00:00.000Z',
    })

    expect(csv).toContain('"\'=WEBSERVICE(""https://evil.example"")"')
    expect(csv).not.toContain(',=WEBSERVICE(')
  })
})
