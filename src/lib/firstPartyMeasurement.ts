export type ConversionEvidenceState =
  | 'CLIENT_REPORTED'
  | 'SERVER_CONFIRMED'
  | 'MANUAL_CONFIRMED'

export type FirstPartyEventRow = {
  eventType: string
  verificationState: string
  attribution?: unknown
  occurredAt: Date | string
}

export type FirstPartyLeadRow = {
  id: string
  campaignId?: string | null
  source: string
  stage: string
  attribution?: unknown
  createdAt: Date | string
  convertedAt?: Date | string | null
  conversionValue?: unknown
  conversionCurrency?: string | null
}

export type FirstPartyLeadTouchRow = {
  leadId: string
  type: string
  metadata?: unknown
  occurredAt: Date | string
}

export type AttributionPerformanceRow = {
  key: string
  source: string
  medium: string | null
  campaign: string | null
  pageViews: number
  ctaClicks: number
  confirmedForms: number
  leads: number
  wonLeads: number
  revenueByCurrency: Array<{ currency: string; value: number }>
}

export type FirstPartyAttributionOutcomeRow = {
  key: string
  source: string
  medium: string | null
  campaign: string | null
  leads: number
  qualifiedLeads: number
  wonLeads: number
  revenueByCurrency: Array<{ currency: string; value: number }>
}

export type FirstPartyLearningInsight = {
  code: string
  evidenceLevel: 'insufficient' | 'directional'
  title: string
  titleAr: string
  rationale: string
  rationaleAr: string
  nextAction: string
  nextActionAr: string
  causalClaim: false
}

export type FirstPartyMeasurementSummary = {
  stage: 'empty' | 'collecting' | 'directional'
  coverage: {
    eventRowsAnalyzed: number
    leadRowsAnalyzed: number
    touchRowsAnalyzed: number
    partial: boolean
  }
  evidence: {
    pageViews: ConversionEvidenceState
    ctaClicks: ConversionEvidenceState
    formSubmissions: ConversionEvidenceState
    wonLeads: ConversionEvidenceState
    revenue: ConversionEvidenceState
  }
  funnel: {
    pageViews: number
    ctaClicks: number
    confirmedForms: number
    leads: number
    qualifiedLeads: number
    wonLeads: number
    ctaRate: number | null
    pageToLeadRate: number | null
    leadToWonRate: number | null
    revenueCoverageRate: number | null
  }
  revenueByCurrency: Array<{ currency: string; value: number; outcomes: number }>
  attribution: AttributionPerformanceRow[]
  attributionModels: {
    firstTouch: FirstPartyAttributionOutcomeRow[]
    lastTouch: FirstPartyAttributionOutcomeRow[]
  }
  sample: {
    minimumTrackedViews: number
    minimumConfirmedForms: number
    trackedViewsRemaining: number
    confirmedFormsRemaining: number
    readyForDirectionalReview: boolean
    statisticalProof: false
  }
  insights: FirstPartyLearningInsight[]
  lastUpdatedAt: string | null
  kpis: Array<{
    key: 'CTA_RATE' | 'PAGE_TO_LEAD_RATE' | 'UNIQUE_LEADS' | 'QUALIFIED_LEADS' | 'LEAD_TO_WON_RATE' | 'CONFIRMED_REVENUE'
    numerator: string
    denominator: string | null
    evidence: ConversionEvidenceState
  }>
}

type Attribution = {
  source: string
  medium: string | null
  campaign: string | null
}

const MIN_DIRECTIONAL_TRACKED_VIEWS = 20
const MIN_DIRECTIONAL_CONFIRMED_FORMS = 3
const QUALIFIED_STAGES = new Set(['QUALIFIED', 'NURTURING', 'OPPORTUNITY', 'WON'])

function attributionOf(value: unknown): Attribution {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  const clean = (key: string) => typeof record[key] === 'string' && record[key].trim()
    ? record[key].trim().slice(0, 500)
    : null
  return {
    source: clean('source') || '(direct / unknown)',
    medium: clean('medium'),
    campaign: clean('campaign'),
  }
}

function finiteMoney(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'object' && value && 'toString' in value
    ? Number(String(value))
    : Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null
}

function safeRate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? Math.round((numerator / denominator) * 10_000) / 100 : null
}

function validDate(value: Date | string | null | undefined): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

function attributionKey(value: Attribution): string {
  return [value.source, value.medium || '', value.campaign || ''].join('\u001f')
}

function revenueArray(values: Map<string, number>): Array<{ currency: string; value: number }> {
  return [...values.entries()]
    .map(([currency, value]) => ({ currency, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => a.currency.localeCompare(b.currency))
}

function recaptureAttribution(value: unknown): unknown | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const metadata = value as Record<string, unknown>
  if (!Object.prototype.hasOwnProperty.call(metadata, 'attribution')) return null
  const attribution = metadata.attribution
  return attribution && typeof attribution === 'object' && !Array.isArray(attribution)
    ? attribution
    : null
}

function summarizeLeadAttribution(
  leads: FirstPartyLeadRow[],
  attributionForLead: (lead: FirstPartyLeadRow) => unknown,
): FirstPartyAttributionOutcomeRow[] {
  const rows = new Map<string, FirstPartyAttributionOutcomeRow & { revenue: Map<string, number> }>()
  const ensure = (raw: unknown) => {
    const parsed = attributionOf(raw)
    const key = attributionKey(parsed)
    const existing = rows.get(key)
    if (existing) return existing
    const created: FirstPartyAttributionOutcomeRow & { revenue: Map<string, number> } = {
      key,
      ...parsed,
      leads: 0,
      qualifiedLeads: 0,
      wonLeads: 0,
      revenueByCurrency: [],
      revenue: new Map(),
    }
    rows.set(key, created)
    return created
  }

  leads.forEach(lead => {
    const row = ensure(attributionForLead(lead))
    row.leads += 1
    if (QUALIFIED_STAGES.has(lead.stage)) row.qualifiedLeads += 1
    if (lead.stage === 'WON') row.wonLeads += 1
    const value = finiteMoney(lead.conversionValue)
    const currency = lead.conversionCurrency?.trim().toUpperCase()
    if (lead.stage === 'WON' && value !== null && currency && /^[A-Z]{3}$/.test(currency)) {
      row.revenue.set(currency, (row.revenue.get(currency) || 0) + value)
    }
  })

  return [...rows.values()]
    .map(({ revenue, ...row }) => ({ ...row, revenueByCurrency: revenueArray(revenue) }))
    .sort((a, b) => b.wonLeads - a.wonLeads || b.qualifiedLeads - a.qualifiedLeads || b.leads - a.leads)
}

export function summarizeFirstPartyMeasurement(
  events: FirstPartyEventRow[],
  leads: FirstPartyLeadRow[],
  leadTouches: FirstPartyLeadTouchRow[] = [],
): FirstPartyMeasurementSummary {
  const pageViews = events.filter(row => row.eventType === 'PAGE_VIEW' && row.verificationState === 'CLIENT_REPORTED')
  const ctaClicks = events.filter(row => row.eventType === 'CTA_CLICK' && row.verificationState === 'CLIENT_REPORTED')
  const confirmedForms = events.filter(row => row.eventType === 'FORM_SUBMITTED' && row.verificationState === 'SERVER_CONFIRMED')
  // A server-confirmed form can still exist when its client-side PAGE_VIEW was
  // blocked or lost. In that case the raw counts remain useful, but presenting
  // forms / views as a conversion rate would create an impossible (>100%) KPI.
  const browserCoverageMismatch = confirmedForms.length > pageViews.length
  const won = leads.filter(row => row.stage === 'WON')
  const qualified = leads.filter(row => QUALIFIED_STAGES.has(row.stage))
  const valuedWon = won.flatMap(row => {
    const value = finiteMoney(row.conversionValue)
    const currency = row.conversionCurrency?.trim().toUpperCase()
    return value !== null && currency && /^[A-Z]{3}$/.test(currency) ? [{ row, value, currency }] : []
  })

  const attribution = new Map<string, AttributionPerformanceRow & { revenue: Map<string, number> }>()
  const ensure = (raw: unknown) => {
    const parsed = attributionOf(raw)
    const key = attributionKey(parsed)
    const existing = attribution.get(key)
    if (existing) return existing
    const created: AttributionPerformanceRow & { revenue: Map<string, number> } = {
      key,
      ...parsed,
      pageViews: 0,
      ctaClicks: 0,
      confirmedForms: 0,
      leads: 0,
      wonLeads: 0,
      revenueByCurrency: [],
      revenue: new Map(),
    }
    attribution.set(key, created)
    return created
  }

  pageViews.forEach(row => { ensure(row.attribution).pageViews += 1 })
  ctaClicks.forEach(row => { ensure(row.attribution).ctaClicks += 1 })
  confirmedForms.forEach(row => { ensure(row.attribution).confirmedForms += 1 })
  const attributionRows = [...attribution.values()]
    .map(({ revenue, ...row }) => ({ ...row, revenueByCurrency: revenueArray(revenue) }))
    .sort((a, b) => b.confirmedForms - a.confirmedForms || b.pageViews - a.pageViews || b.leads - a.leads)

  const latestRecaptureByLead = new Map<string, { attribution: unknown; at: number }>()
  leadTouches.forEach(touch => {
    if (touch.type !== 'FORM_RECAPTURED') return
    const attribution = recaptureAttribution(touch.metadata)
    if (attribution === null) return
    const at = new Date(touch.occurredAt).getTime()
    if (!Number.isFinite(at)) return
    const existing = latestRecaptureByLead.get(touch.leadId)
    if (!existing || at >= existing.at) latestRecaptureByLead.set(touch.leadId, { attribution, at })
  })
  const firstTouchAttribution = summarizeLeadAttribution(leads, lead => lead.attribution)
  const lastTouchAttribution = summarizeLeadAttribution(
    leads,
    lead => latestRecaptureByLead.get(lead.id)?.attribution ?? lead.attribution,
  )

  const totalRevenue = new Map<string, { value: number; outcomes: number }>()
  valuedWon.forEach(({ value, currency }) => {
    const current = totalRevenue.get(currency) || { value: 0, outcomes: 0 }
    current.value += value
    current.outcomes += 1
    totalRevenue.set(currency, current)
  })

  const insights: FirstPartyLearningInsight[] = []
  if (browserCoverageMismatch) {
    insights.push({
      code: 'FIRST_PARTY_BROWSER_COVERAGE_MISMATCH', evidenceLevel: 'insufficient', causalClaim: false,
      title: 'Browser tracking coverage is incomplete', titleAr: 'تغطية تتبع الزيارات غير مكتملة',
      rationale: `${confirmedForms.length} server-confirmed forms were recorded but only ${pageViews.length} browser page views were captured, so a page-to-lead rate would be misleading.`,
      rationaleAr: `تم تسجيل ${confirmedForms.length} نموذجًا مؤكدًا من الخادم مقابل ${pageViews.length} زيارة متصفح فقط؛ لذلك سيكون معدل التحويل مضللًا.`,
      nextAction: 'Verify page-view tracking and consent behavior before reading or comparing the conversion rate.',
      nextActionAr: 'تحقق من تتبع الزيارات وسلوك الموافقة قبل قراءة معدل التحويل أو مقارنته.',
    })
  } else if (pageViews.length === 0) {
    insights.push({
      code: 'FIRST_PARTY_PATH_NOT_STARTED', evidenceLevel: 'insufficient', causalClaim: false,
      title: 'Publish a measurable destination', titleAr: 'انشر وجهة تحويل قابلة للقياس',
      rationale: 'No first-party page view has been recorded yet.',
      rationaleAr: 'لم تُسجل أي زيارة First-party حتى الآن.',
      nextAction: 'Publish a landing page and distribute its UTM-tagged URL.',
      nextActionAr: 'انشر Landing Page ووزّع رابطها المزود بـ UTM.',
    })
  } else if (pageViews.length < MIN_DIRECTIONAL_TRACKED_VIEWS || confirmedForms.length < MIN_DIRECTIONAL_CONFIRMED_FORMS) {
    insights.push({
      code: 'FIRST_PARTY_SAMPLE_BUILDING', evidenceLevel: 'insufficient', causalClaim: false,
      title: 'Evidence is still collecting', titleAr: 'العينة ما زالت تتكوّن',
      rationale: `${pageViews.length} tracked page views and ${confirmedForms.length} server-confirmed forms are not enough for a directional decision.`,
      rationaleAr: `${pageViews.length} زيارة مسجلة و${confirmedForms.length} نموذج مؤكد من الخادم لا تكفي لقرار اتجاهي.`,
      nextAction: 'Keep the destination and UTM structure stable until the minimum sample is reached.',
      nextActionAr: 'ثبّت الصفحة وهيكل UTM حتى تصل للحد الأدنى من العينة.',
    })
  } else {
    const ctaRate = safeRate(ctaClicks.length, pageViews.length) || 0
    const clickToFormRate = safeRate(confirmedForms.length, ctaClicks.length) || 0
    if (ctaRate < 5) {
      insights.push({
        code: 'FIRST_PARTY_CTA_FRICTION', evidenceLevel: 'directional', causalClaim: false,
        title: 'CTA engagement needs review', titleAr: 'تفاعل الـCTA يحتاج مراجعة',
        rationale: `The tracked CTA rate is ${ctaRate.toFixed(2)}% across ${pageViews.length} page views.`,
        rationaleAr: `نسبة الضغط المسجلة ${ctaRate.toFixed(2)}% عبر ${pageViews.length} زيارة.`,
        nextAction: 'Review offer clarity, CTA placement, and message-match before changing acquisition.',
        nextActionAr: 'راجع وضوح العرض ومكان الـCTA وتطابق الرسالة قبل تغيير مصدر الزيارات.',
      })
    } else if (clickToFormRate < 20) {
      insights.push({
        code: 'FIRST_PARTY_FORM_FRICTION', evidenceLevel: 'directional', causalClaim: false,
        title: 'Intake step may be the bottleneck', titleAr: 'خطوة إدخال البيانات قد تكون عنق الزجاجة',
        rationale: `${confirmedForms.length} confirmed forms followed ${ctaClicks.length} tracked CTA clicks.`,
        rationaleAr: `${confirmedForms.length} نموذجًا مؤكدًا بعد ${ctaClicks.length} ضغطة CTA مسجلة.`,
        nextAction: 'Review form length, consent copy, and response expectation.',
        nextActionAr: 'راجع طول النموذج ونص الموافقة وتوقعات وقت الرد.',
      })
    } else {
      insights.push({
        code: 'FIRST_PARTY_PATH_DIRECTIONAL', evidenceLevel: 'directional', causalClaim: false,
        title: 'The path has reviewable evidence', titleAr: 'المسار لديه دليل قابل للمراجعة',
        rationale: `${confirmedForms.length} server-confirmed forms were recorded from ${pageViews.length} tracked page views.`,
        rationaleAr: `تم تسجيل ${confirmedForms.length} نموذجًا مؤكدًا من الخادم عبر ${pageViews.length} زيارة.`,
        nextAction: 'Compare attribution rows and review lead quality before scaling distribution.',
        nextActionAr: 'قارن صفوف الإسناد وراجع جودة العملاء قبل توسيع التوزيع.',
      })
    }
  }

  if (leads.length >= 5 && safeRate(won.length, leads.length) !== null && (safeRate(won.length, leads.length) || 0) < 20) {
    insights.push({
      code: 'FIRST_PARTY_HANDOFF_FRICTION', evidenceLevel: 'directional', causalClaim: false,
      title: 'Lead-to-outcome handoff needs review', titleAr: 'التسليم من Lead إلى نتيجة يحتاج مراجعة',
      rationale: `${won.length} of ${leads.length} recorded leads are manually confirmed as won.`,
      rationaleAr: `${won.length} من أصل ${leads.length} عميلًا مسجلًا تم تأكيدهم يدويًا كمكتسبين.`,
      nextAction: 'Review response speed, qualification, objections, and follow-up completion.',
      nextActionAr: 'راجع سرعة الاستجابة والتأهيل والاعتراضات وإتمام المتابعات.',
    })
  }

  const timestamps = [
    ...events.map(row => validDate(row.occurredAt)),
    ...leads.flatMap(row => [validDate(row.createdAt), validDate(row.convertedAt)]),
  ].filter((value): value is string => Boolean(value)).sort()

  return {
    stage: pageViews.length === 0 && leads.length === 0
      ? 'empty'
      : !browserCoverageMismatch && pageViews.length >= MIN_DIRECTIONAL_TRACKED_VIEWS && confirmedForms.length >= MIN_DIRECTIONAL_CONFIRMED_FORMS ? 'directional' : 'collecting',
    coverage: { eventRowsAnalyzed: events.length, leadRowsAnalyzed: leads.length, touchRowsAnalyzed: leadTouches.length, partial: false },
    evidence: {
      pageViews: 'CLIENT_REPORTED', ctaClicks: 'CLIENT_REPORTED',
      formSubmissions: 'SERVER_CONFIRMED', wonLeads: 'MANUAL_CONFIRMED', revenue: 'MANUAL_CONFIRMED',
    },
    funnel: {
      pageViews: pageViews.length,
      ctaClicks: ctaClicks.length,
      confirmedForms: confirmedForms.length,
      leads: leads.length,
      qualifiedLeads: qualified.length,
      wonLeads: won.length,
      ctaRate: safeRate(ctaClicks.length, pageViews.length),
      pageToLeadRate: browserCoverageMismatch ? null : safeRate(confirmedForms.length, pageViews.length),
      leadToWonRate: safeRate(won.length, leads.length),
      revenueCoverageRate: safeRate(valuedWon.length, won.length),
    },
    revenueByCurrency: [...totalRevenue.entries()]
      .map(([currency, value]) => ({ currency, value: Math.round(value.value * 100) / 100, outcomes: value.outcomes }))
      .sort((a, b) => a.currency.localeCompare(b.currency)),
    attribution: attributionRows,
    attributionModels: {
      firstTouch: firstTouchAttribution,
      lastTouch: lastTouchAttribution,
    },
    sample: {
      minimumTrackedViews: MIN_DIRECTIONAL_TRACKED_VIEWS,
      minimumConfirmedForms: MIN_DIRECTIONAL_CONFIRMED_FORMS,
      trackedViewsRemaining: Math.max(0, MIN_DIRECTIONAL_TRACKED_VIEWS - pageViews.length),
      confirmedFormsRemaining: Math.max(0, MIN_DIRECTIONAL_CONFIRMED_FORMS - confirmedForms.length),
      readyForDirectionalReview: !browserCoverageMismatch
        && pageViews.length >= MIN_DIRECTIONAL_TRACKED_VIEWS
        && confirmedForms.length >= MIN_DIRECTIONAL_CONFIRMED_FORMS,
      statisticalProof: false,
    },
    insights,
    lastUpdatedAt: timestamps.at(-1) || null,
    kpis: [
      { key: 'CTA_RATE', numerator: 'CLIENT_REPORTED CTA_CLICK', denominator: 'CLIENT_REPORTED PAGE_VIEW', evidence: 'CLIENT_REPORTED' },
      { key: 'PAGE_TO_LEAD_RATE', numerator: 'SERVER_CONFIRMED FORM_SUBMITTED', denominator: 'CLIENT_REPORTED PAGE_VIEW', evidence: 'SERVER_CONFIRMED' },
      { key: 'UNIQUE_LEADS', numerator: 'Deduplicated workspace Lead records', denominator: null, evidence: 'SERVER_CONFIRMED' },
      { key: 'QUALIFIED_LEADS', numerator: 'Operator-confirmed qualified-stage leads', denominator: 'Deduplicated workspace Lead records', evidence: 'MANUAL_CONFIRMED' },
      { key: 'LEAD_TO_WON_RATE', numerator: 'MANUAL_CONFIRMED WON leads', denominator: 'Recorded leads', evidence: 'MANUAL_CONFIRMED' },
      { key: 'CONFIRMED_REVENUE', numerator: 'Operator-entered value on WON leads', denominator: null, evidence: 'MANUAL_CONFIRMED' },
    ],
  }
}
