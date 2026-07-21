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
  source: string
  stage: string
  attribution?: unknown
  createdAt: Date | string
  convertedAt?: Date | string | null
  conversionValue?: unknown
  conversionCurrency?: string | null
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
  insights: FirstPartyLearningInsight[]
  lastUpdatedAt: string | null
  kpis: Array<{
    key: 'CTA_RATE' | 'PAGE_TO_LEAD_RATE' | 'LEAD_TO_WON_RATE' | 'CONFIRMED_REVENUE'
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

export function summarizeFirstPartyMeasurement(
  events: FirstPartyEventRow[],
  leads: FirstPartyLeadRow[],
): FirstPartyMeasurementSummary {
  const pageViews = events.filter(row => row.eventType === 'PAGE_VIEW' && row.verificationState === 'CLIENT_REPORTED')
  const ctaClicks = events.filter(row => row.eventType === 'CTA_CLICK' && row.verificationState === 'CLIENT_REPORTED')
  const confirmedForms = events.filter(row => row.eventType === 'FORM_SUBMITTED' && row.verificationState === 'SERVER_CONFIRMED')
  const qualifiedStages = new Set(['QUALIFIED', 'NURTURING', 'OPPORTUNITY', 'WON'])
  const won = leads.filter(row => row.stage === 'WON')
  const qualified = leads.filter(row => qualifiedStages.has(row.stage))
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
  leads.forEach(row => {
    const group = ensure(row.attribution)
    group.leads += 1
    if (row.stage === 'WON') group.wonLeads += 1
    const value = finiteMoney(row.conversionValue)
    const currency = row.conversionCurrency?.trim().toUpperCase()
    if (row.stage === 'WON' && value !== null && currency && /^[A-Z]{3}$/.test(currency)) {
      group.revenue.set(currency, (group.revenue.get(currency) || 0) + value)
    }
  })

  const attributionRows = [...attribution.values()]
    .map(({ revenue, ...row }) => ({ ...row, revenueByCurrency: revenueArray(revenue) }))
    .sort((a, b) => b.confirmedForms - a.confirmedForms || b.pageViews - a.pageViews || b.leads - a.leads)

  const totalRevenue = new Map<string, { value: number; outcomes: number }>()
  valuedWon.forEach(({ value, currency }) => {
    const current = totalRevenue.get(currency) || { value: 0, outcomes: 0 }
    current.value += value
    current.outcomes += 1
    totalRevenue.set(currency, current)
  })

  const insights: FirstPartyLearningInsight[] = []
  if (pageViews.length === 0) {
    insights.push({
      code: 'FIRST_PARTY_PATH_NOT_STARTED', evidenceLevel: 'insufficient', causalClaim: false,
      title: 'Publish a measurable destination', titleAr: 'انشر وجهة تحويل قابلة للقياس',
      rationale: 'No first-party page view has been recorded yet.',
      rationaleAr: 'لم تُسجل أي زيارة First-party حتى الآن.',
      nextAction: 'Publish a landing page and distribute its UTM-tagged URL.',
      nextActionAr: 'انشر Landing Page ووزّع رابطها المزود بـ UTM.',
    })
  } else if (pageViews.length < 20 || confirmedForms.length < 3) {
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
      : pageViews.length >= 20 && confirmedForms.length >= 3 ? 'directional' : 'collecting',
    coverage: { eventRowsAnalyzed: events.length, leadRowsAnalyzed: leads.length, partial: false },
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
      pageToLeadRate: safeRate(confirmedForms.length, pageViews.length),
      leadToWonRate: safeRate(won.length, leads.length),
      revenueCoverageRate: safeRate(valuedWon.length, won.length),
    },
    revenueByCurrency: [...totalRevenue.entries()]
      .map(([currency, value]) => ({ currency, value: Math.round(value.value * 100) / 100, outcomes: value.outcomes }))
      .sort((a, b) => a.currency.localeCompare(b.currency)),
    attribution: attributionRows,
    insights,
    lastUpdatedAt: timestamps.at(-1) || null,
    kpis: [
      { key: 'CTA_RATE', numerator: 'CLIENT_REPORTED CTA_CLICK', denominator: 'CLIENT_REPORTED PAGE_VIEW', evidence: 'CLIENT_REPORTED' },
      { key: 'PAGE_TO_LEAD_RATE', numerator: 'SERVER_CONFIRMED FORM_SUBMITTED', denominator: 'CLIENT_REPORTED PAGE_VIEW', evidence: 'SERVER_CONFIRMED' },
      { key: 'LEAD_TO_WON_RATE', numerator: 'MANUAL_CONFIRMED WON leads', denominator: 'Recorded leads', evidence: 'MANUAL_CONFIRMED' },
      { key: 'CONFIRMED_REVENUE', numerator: 'Operator-entered value on WON leads', denominator: null, evidence: 'MANUAL_CONFIRMED' },
    ],
  }
}
