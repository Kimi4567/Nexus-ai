import type { FirstPartyMeasurementSummary } from '@/lib/firstPartyMeasurement'

export type FirstPartyMeasurementExportScope = {
  campaignId: string | null
  campaignName: string | null
  generatedAt: string
}

const HEADERS = [
  'section',
  'metric',
  'value',
  'evidence',
  'source',
  'medium',
  'utm_campaign',
  'tracked_views',
  'cta_clicks',
  'confirmed_submissions',
  'unique_leads',
  'qualified_leads',
  'won_deals',
  'currency',
  'confirmed_revenue',
] as const

function safeCell(value: unknown): string {
  const plain = value === null || value === undefined ? '' : String(value)
  // Spreadsheet programs can interpret leading formula characters even in
  // CSV. Prefix user-controlled cells so an exported UTM cannot execute code.
  const protectedValue = /^[=+\-@]/.test(plain) ? `'${plain}` : plain
  return /[",\r\n]/.test(protectedValue)
    ? `"${protectedValue.replace(/"/g, '""')}"`
    : protectedValue
}

function row(values: unknown[]): string {
  return HEADERS.map((_, index) => safeCell(values[index])).join(',')
}

export function buildFirstPartyMeasurementCsv(
  summary: FirstPartyMeasurementSummary,
  scope: FirstPartyMeasurementExportScope,
): string {
  const rows: string[] = [HEADERS.join(',')]
  const add = (...values: unknown[]) => rows.push(row(values))

  add('metadata', 'generated_at', scope.generatedAt)
  add('metadata', 'scope', scope.campaignId ? 'campaign_acquisition_cohort' : 'workspace')
  add('metadata', 'campaign_id', scope.campaignId)
  add('metadata', 'campaign_name', scope.campaignName)
  add('metadata', 'measurement_stage', summary.stage)
  add('metadata', 'statistical_proof', false)

  add('funnel', 'tracked_views', summary.funnel.pageViews, summary.evidence.pageViews)
  add('funnel', 'cta_clicks', summary.funnel.ctaClicks, summary.evidence.ctaClicks)
  add('funnel', 'confirmed_submissions', summary.funnel.confirmedForms, summary.evidence.formSubmissions)
  add('funnel', 'unique_leads', summary.funnel.leads, 'SERVER_CONFIRMED')
  add('funnel', 'qualified_leads', summary.funnel.qualifiedLeads, 'MANUAL_CONFIRMED')
  add('funnel', 'won_deals', summary.funnel.wonLeads, summary.evidence.wonLeads)
  add('funnel', 'cta_rate_percent', summary.funnel.ctaRate, summary.evidence.pageViews)
  add('funnel', 'page_to_lead_rate_percent', summary.funnel.pageToLeadRate, summary.evidence.formSubmissions)
  add('funnel', 'lead_to_won_rate_percent', summary.funnel.leadToWonRate, summary.evidence.wonLeads)

  add('sample', 'minimum_tracked_views', summary.sample.minimumTrackedViews)
  add('sample', 'minimum_confirmed_forms', summary.sample.minimumConfirmedForms)
  add('sample', 'ready_for_directional_review', summary.sample.readyForDirectionalReview)
  add('sample', 'statistical_proof', summary.sample.statisticalProof)

  summary.attribution.forEach(item => add(
    'utm_path',
    'browser_and_server_path_signals',
    '',
    'MIXED_CLIENT_AND_SERVER_EVIDENCE',
    item.source,
    item.medium,
    item.campaign,
    item.pageViews,
    item.ctaClicks,
    item.confirmedForms,
  ))

  const addOutcomeRows = (
    section: 'first_touch' | 'last_touch',
    items: FirstPartyMeasurementSummary['attributionModels']['firstTouch'],
  ) => {
    items.forEach(item => {
      const revenue = item.revenueByCurrency.length ? item.revenueByCurrency : [{ currency: '', value: '' }]
      revenue.forEach(entry => add(
        section,
        section === 'first_touch' ? 'immutable_acquisition_source' : 'latest_recorded_recapture_source',
        '',
        'LEAD_OUTCOME_ATTRIBUTION',
        item.source,
        item.medium,
        item.campaign,
        '',
        '',
        '',
        item.leads,
        item.qualifiedLeads,
        item.wonLeads,
        entry.currency,
        entry.value,
      ))
    })
  }

  addOutcomeRows('first_touch', summary.attributionModels.firstTouch)
  addOutcomeRows('last_touch', summary.attributionModels.lastTouch)

  summary.revenueByCurrency.forEach(item => add(
    'revenue',
    'manually_confirmed_won_value',
    item.outcomes,
    summary.evidence.revenue,
    '', '', '', '', '', '', '', '', '',
    item.currency,
    item.value,
  ))

  return `\uFEFF${rows.join('\r\n')}\r\n`
}
