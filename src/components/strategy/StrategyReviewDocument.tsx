'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  BarChart3, Brain, CalendarDays, CheckCircle2, Circle, FileText,
  Layers, Megaphone, ShieldCheck, Target, Users,
} from 'lucide-react'
import { getCampaignPlatformSummary } from '@/lib/campaignPlatforms'

export interface StrategyReviewCampaign {
  id: string
  name: string
  description?: string | null
  goal?: string | null
  audience?: string | null
  status: string
  platforms: string[]
  aiOutput: unknown
  createdAt: string
  updatedAt: string
}

type Locale = 'en' | 'ar'
type Dict = Record<string, unknown>

interface BriefItem {
  label: string
  value: string
  muted?: boolean
}

function objectValue(value: unknown): Dict | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Dict : null
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asRecords(value: unknown): Dict[] {
  return asArray(value).map(objectValue).filter((item): item is Dict => Boolean(item))
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
    if (value && typeof value === 'object') {
      const o = value as Dict
      const nested = firstText(o.name, o.title, o.summary, o.text, o.value, o.description, o.label, o.item, o.metric)
      if (nested) return nested
    }
  }
  return ''
}

function listLabels(values: unknown[], limit = 8): string[] {
  return values.map(value => firstText(value)).filter(Boolean).slice(0, limit)
}

function formatDate(value: string, locale: Locale): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en', { month: 'short', day: 'numeric', year: 'numeric' }).format(d)
}

function withFallbackRows(rows: BriefItem[], fallback: string): BriefItem[] {
  return rows.map(row => row.value ? row : { ...row, value: fallback, muted: true })
}

export default function StrategyReviewDocument({
  campaign,
  locale,
}: {
  campaign: StrategyReviewCampaign
  locale: Locale
}) {
  const ar = locale === 'ar'
  const copy = {
    empty: ar ? 'غير مذكور في مسودة الاستراتيجية' : 'Not included in this strategy draft',
    noPaid: ar ? 'لم يتم إنشاء خطة مدفوعة بعد' : 'No paid plan generated yet',
    baseline: ar ? 'يحتاج إلى خط أساس' : 'Baseline needed',
    targetLater: ar ? 'يتم تحديد الهدف بعد أول 30 يوما' : 'Target to define after first 30 days',
    notConnected: ar ? 'غير متصل' : 'Not connected',
    notEnabled: ar ? 'غير مفعّل' : 'Not enabled',
  }

  const ai = objectValue(campaign.aiOutput)
  const strategy = objectValue(ai?.strategy) ?? ai ?? {}
  const paid = objectValue(ai?.paidPlan) ?? objectValue(ai?.paidCampaignPlan) ?? objectValue(strategy.paidPlan) ?? {}
  const diagnosis = objectValue(strategy.diagnosisDetails)
  const business = objectValue(strategy.businessObjective)
  const assetRequirements = objectValue(strategy.assetRequirements)
  const adSetup = objectValue(strategy.adSetupPlan)
  const platformSummary = getCampaignPlatformSummary(campaign.platforms ?? [], locale)

  const topHooks = listLabels([...asArray(ai?.topHooks), ...asArray(strategy.topHooks), ...asArray(strategy.hooks)], 10)
  const ctas = listLabels([...asArray(ai?.ctaVariations), ...asArray(strategy.ctaVariations), ...asArray(strategy.ctas)], 8)
  const valueProps = listLabels([...asArray(strategy.valueProps), ...asArray(strategy.valuePropositions), ...asArray(ai?.valueProps)], 8)
  const contentPillars = listLabels([...asArray(strategy.contentPillars), ...asArray(ai?.contentPillars)], 8)
  const contentAngles = listLabels([...asArray(strategy.contentAngles), ...asArray(strategy.contentAnglesDetailed), ...asArray(ai?.contentAngles)], 8)
  const channelMix = listLabels([...asArray(strategy.channelStrategy), ...asArray(strategy.channelMix), ...asArray(strategy.channels), ...asArray(paid.channels)], 8)
  const paidNotes = listLabels([...asArray(paid.recommendations), ...asArray(paid.notes), ...asArray(paid.channels)], 8)
  const weeklyExecutionPlan = asRecords(strategy.weeklyExecutionPlan)
  const weeklyPlan = asRecords(strategy.weeklyPlan)
  const audienceSegmentsDetailed = asRecords(strategy.audienceSegmentsDetailed)
  const audienceSegments = listLabels(asArray(strategy.audienceSegments), 8)
  const funnelStages = asRecords(strategy.funnelStages)
  const kpis = [...asRecords(strategy.kpis), ...asRecords(strategy.successMetricsDetailed)]
  const successMetrics = listLabels(asArray(strategy.successMetrics), 8)
  const readinessChecklist = asArray(strategy.readinessChecklist)
  const executionChecklist = listLabels(asArray(strategy.executionChecklist), 8)
  const riskNotes = listLabels([...asArray(strategy.riskNotes), ...asArray(strategy.complianceNotes)], 8)
  const doNotDoYet = listLabels(asArray(strategy.doNotDoYet), 8)
  const assumptions = listLabels([...asArray(strategy.assumptions), ...asArray(strategy.executionAssumptions)], 8)
  const missingData = listLabels(asArray(strategy.missingData), 8)
  const competitorAnalysisComplete = typeof strategy.competitorAnalysisComplete === 'boolean' ? strategy.competitorAnalysisComplete : null

  const diagnosisRows = withFallbackRows([
    { label: ar ? 'مرحلة النشاط' : 'Business stage', value: firstText(diagnosis?.stage, diagnosis?.businessStage, strategy.businessStage) },
    { label: ar ? 'العائق الرئيسي' : 'Main bottleneck', value: firstText(diagnosis?.bottleneck, diagnosis?.mainBottleneck, diagnosis?.biggestChallenge, strategy.mainBottleneck) },
    { label: ar ? 'فجوة الثقة' : 'Trust gap', value: firstText(diagnosis?.trustGap, strategy.trustGap) },
    { label: ar ? 'الخطر الرئيسي' : 'Main risk', value: firstText(diagnosis?.mainRisk, strategy.mainRisk) },
    { label: ar ? 'جاهزية التخطيط المدفوع' : 'Paid readiness', value: firstText(diagnosis?.readyForPaidAdsReason, strategy.readyForPaidAdsReason) },
    { label: ar ? 'سبب الاتجاه' : 'Why this direction', value: firstText(diagnosis?.whyThisStrategy, diagnosis?.marketOpportunity, strategy.whyThisStrategy) },
  ], copy.empty)

  const businessRows = withFallbackRows([
    { label: ar ? 'هدف النشاط' : 'Business objective', value: firstText(business?.primary, business?.primaryGoal, strategy.businessObjective) },
    { label: ar ? 'هدف التسويق' : 'Marketing objective', value: firstText(business?.marketing, business?.marketingObjective, strategy.marketingObjective) },
    { label: ar ? 'إجراء التحويل' : 'Conversion action', value: firstText(business?.conversionAction, strategy.conversionAction) },
    { label: ar ? 'الإجراء المتوقع' : 'Expected user action', value: firstText(business?.expectedUserAction, strategy.expectedUserAction) },
    { label: ar ? 'لماذا الآن' : 'Why now', value: firstText(business?.whyNow, strategy.whyNow) },
    { label: ar ? 'تعريف النجاح' : 'Success definition', value: firstText(business?.successDefinition, business?.successLooksLike, business?.successIn30Days, strategy.successDefinition) },
  ], copy.empty)

  const direction = firstText(strategy.executiveSummary, strategy.summary, strategy.direction, strategy.bigIdea, ai?.summary, campaign.description)
  const keyMessage = firstText(strategy.keyMessage, strategy.message)
  const positioning = firstText(strategy.positioning, strategy.brandPositioning, strategy.promise)
  const differentiation = firstText(strategy.differentiation)
  const first30 = firstText(strategy.first30Days, strategy.firstThirtyDays, strategy.initialDirection)
  const ninetyDay = firstText(strategy.ninetyDayDirection, strategy['90DayDirection'], strategy.quarterlyDirection)
  const budget = firstText(adSetup?.budget, paid.budget)
  const conversionDestination = firstText(adSetup?.conversionDestination, paid.conversionDestination)
  const pixel = firstText(adSetup?.pixel, adSetup?.trackingPixel, paid.pixel)
  const analytics = firstText(adSetup?.analytics, paid.analytics)

  return (
    <article className="max-w-[1120px] mx-auto px-4 py-8 sm:py-10">
      <header className="mb-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4" style={{ color: '#8B5CF6' }} />
              <span className="text-xs font-mono tracking-wider" style={{ color: 'rgba(139,92,246,0.85)' }}>
                {ar ? 'مراجعة الاستراتيجية' : 'STRATEGY REVIEW'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black" style={{ color: '#0f172a' }}>{campaign.name}</h1>
            <p className="text-sm mt-2 max-w-2xl leading-6" style={{ color: '#64748b' }}>
              {ar
                ? 'وثيقة استراتيجية تسويقية غنية مبنية على Brand Brain ومسودة الحملة الحالية.'
                : 'A rich marketing strategy document built from Brand Brain and the current campaign strategy draft.'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Link href="/content-hub" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: '#111827', color: '#FFFFFF' }}>
              <FileText className="w-4 h-4" />
              {ar ? 'المتابعة إلى مركز المحتوى' : 'Continue to Content Hub'}
            </Link>
            <Link href="/strategy" className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: '#FFFFFF', color: '#334155', border: '1px solid rgba(15,23,42,0.12)' }}>
              {ar ? 'العودة إلى الاستراتيجية' : 'Back to Strategy'}
            </Link>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
        <MetaCard icon={Brain} label={ar ? 'المصدر' : 'Source'} value={ar ? 'ذاكرة العلامة' : 'Brand Brain'} />
        <MetaCard icon={CalendarDays} label={ar ? 'آخر تحديث' : 'Last updated'} value={formatDate(campaign.updatedAt, locale) || copy.empty} />
        <MetaCard icon={FileText} label={ar ? 'الحالة' : 'Status'} value={ar ? 'مسودة قراءة فقط' : 'Read-only draft'} />
        <MetaCard icon={Layers} label={ar ? 'المنصات' : 'Platforms'} value={platformSummary.isEmpty ? copy.empty : platformSummary.labels.join(', ')} muted={platformSummary.isEmpty} />
      </div>

      <Section icon={ShieldCheck} title={ar ? 'ملخص الجاهزية' : 'Strategy Readiness Summary'} tone="lavender">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            ar ? 'التخطيط المدفوع يبقى تخطيطا فقط حتى تتوفر الميزانية ووجهة التحويل وبيانات التتبع.' : 'Paid planning remains planning-only until budget, conversion destination, and tracking data are available.',
            ar ? `التحليلات: ${analytics || copy.notConnected}.` : `Analytics: ${analytics || copy.notConnected}.`,
            ar ? `النشر التلقائي: ${copy.notEnabled}.` : `Automatic publishing: ${copy.notEnabled}.`,
            ar ? 'لا يتم صرف أي ميزانية إعلانية بدون موافقة صريحة.' : 'No ad spend happens without explicit approval.',
          ].map(item => <SoftBullet key={item}>{item}</SoftBullet>)}
        </div>
        {(missingData.length > 0 || competitorAnalysisComplete === false || assumptions.length > 0) && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(139,92,246,0.14)' }}>
            <BriefList label={ar ? 'بيانات ناقصة' : 'Missing data'} items={missingData} emptyText={copy.empty} />
            {competitorAnalysisComplete === false && (
              <p className="text-sm mt-3 leading-6" style={{ color: '#64748b' }}>
                {ar ? 'تحليل المنافسين غير مكتمل. لن يتم اختراع منافسين غير مذكورين.' : 'Competitor analysis is incomplete. No competitors are invented when they are not provided.'}
              </p>
            )}
            <BriefList label={ar ? 'افتراضات' : 'Assumptions'} items={assumptions} emptyText={copy.empty} />
          </div>
        )}
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-4 mt-4">
        <Section icon={Brain} title={ar ? 'التشخيص التسويقي' : 'Marketing Diagnosis'}>
          <p className="text-sm leading-7 mb-5" style={{ color: firstText(strategy.diagnosis, direction) ? '#334155' : '#94a3b8' }}>
            {firstText(strategy.diagnosis, direction) || copy.empty}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {diagnosisRows.map(item => <BriefLine key={item.label} {...item} />)}
          </div>
        </Section>

        <Section icon={Target} title={ar ? 'هدف النشاط' : 'Business Objective'}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {businessRows.map(item => <BriefLine key={item.label} {...item} />)}
          </div>
        </Section>
      </div>

      <Section icon={Layers} title={ar ? 'الاستراتيجية الأساسية' : 'Core Strategy'} className="mt-4">
        <div className="space-y-5">
          <div className="rounded-2xl p-5" style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.06)' }}>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#8B5CF6' }}>{ar ? 'الرسالة الرئيسية' : 'Key Message'}</p>
            <p className="text-xl font-black leading-relaxed" style={{ color: keyMessage ? '#0f172a' : '#94a3b8' }}>{keyMessage || copy.empty}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <BriefLine label={ar ? 'التموضع' : 'Positioning'} value={positioning || copy.empty} muted={!positioning} />
            <BriefLine label={ar ? 'التمايز' : 'Differentiation'} value={differentiation || copy.empty} muted={!differentiation} />
            <BriefLine label={ar ? 'اتجاه 90 يوما' : '90-day direction'} value={ninetyDay || copy.empty} muted={!ninetyDay} />
            <BriefLine label={ar ? 'أول 30 يوما' : 'First 30 days'} value={first30 || copy.empty} muted={!first30} />
          </div>
        </div>
      </Section>

      <Section icon={Users} title={ar ? 'شرائح الجمهور' : 'Audience Segments'} className="mt-4">
        <AudienceSegments detailed={audienceSegmentsDetailed} fallback={audienceSegments} emptyText={copy.empty} ar={ar} />
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-[1.12fr_0.88fr] gap-4 mt-4">
        <Section icon={Megaphone} title={ar ? 'خطة المحتوى العضوي' : 'Organic Content Plan'}>
          <div className="space-y-4">
            <BriefLine label={ar ? 'مزيج المنصات' : 'Platform mix'} value={platformSummary.isEmpty ? copy.empty : platformSummary.labels.join(' · ')} muted={platformSummary.isEmpty} />
            <BriefList label={ar ? 'محاور المحتوى' : 'Content pillars'} items={contentPillars} emptyText={copy.empty} pill />
            <BriefList label={ar ? 'عروض القيمة' : 'Value Propositions'} items={valueProps} emptyText={copy.empty} />
            <BriefList label={ar ? 'الخطافات' : 'Top Hooks'} items={topHooks} emptyText={copy.empty} />
            <BriefList label={ar ? 'دعوات الإجراء' : 'CTAs'} items={ctas} emptyText={copy.empty} />
            <BriefList label={ar ? 'زوايا المحتوى' : 'Content angles'} items={contentAngles} emptyText={copy.empty} />
          </div>
        </Section>

        <Section icon={ShieldCheck} title={ar ? 'التخطيط المدفوع' : 'Paid Planning'}>
          <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold mb-4"
            style={{ background: '#F1F5F9', color: '#64748b', border: '1px solid rgba(15,23,42,0.08)' }}>
            {ar ? 'تخطيط فقط' : 'Planning-only'}
          </span>
          <div className="space-y-4">
            <BriefList label={ar ? 'تفاصيل متاحة' : 'Available details'} items={paidNotes} emptyText={copy.noPaid} />
            <BriefLine label={ar ? 'الميزانية' : 'Budget'} value={budget || copy.empty} muted={!budget} />
            <BriefLine label={ar ? 'وجهة التحويل' : 'Conversion destination'} value={conversionDestination || copy.empty} muted={!conversionDestination} />
            <BriefLine label={ar ? 'التتبع' : 'Pixel / tracking'} value={pixel || copy.empty} muted={!pixel} />
            <SoftWarning>{ar ? 'التخطيط المدفوع ليس جاهزا للتنفيذ حتى تكتمل البيانات المطلوبة.' : 'Paid planning is not ready for execution until the required data is complete.'}</SoftWarning>
          </div>
        </Section>
      </div>

      <Section icon={CalendarDays} title={ar ? 'خطة التنفيذ' : 'Execution Plan'} className="mt-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-4">
            <BriefList label={ar ? 'مزيج القنوات' : 'Channel mix'} items={channelMix} emptyText={copy.empty} pill />
            <FunnelStages stages={funnelStages} strategy={strategy} emptyText={copy.empty} ar={ar} />
          </div>
          <WeeklyPlan weeklyExecutionPlan={weeklyExecutionPlan} weeklyPlan={weeklyPlan} emptyText={copy.empty} ar={ar} />
        </div>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-4 mt-4">
        <Section icon={BarChart3} title={ar ? 'المؤشرات والمقاييس' : 'KPIs / Metrics'}>
          <KpiList kpis={kpis} successMetrics={successMetrics} emptyText={copy.empty} baselineText={copy.baseline} targetText={copy.targetLater} ar={ar} />
        </Section>

        <Section icon={CheckCircle2} title={ar ? 'قائمة الجاهزية والمخاطر' : 'Readiness Checklist / Risks'}>
          <div className="space-y-5">
            <ReadinessList items={readinessChecklist} fallback={executionChecklist} emptyText={copy.empty} ar={ar} />
            <BriefList label={ar ? 'نواقص يجب توضيحها' : 'Missing items to clarify'} items={[
              platformSummary.isEmpty ? (ar ? 'تحديد المنصات المستهدفة' : 'Define target platforms') : '',
              budget ? '' : (ar ? 'ميزانية التخطيط المدفوع' : 'Paid planning budget'),
              conversionDestination ? '' : (ar ? 'وجهة التحويل' : 'Conversion destination'),
              pixel ? '' : (ar ? 'بيانات التتبع' : 'Tracking data'),
              analytics ? '' : (ar ? 'اتصال التحليلات' : 'Analytics connection'),
            ].filter(Boolean)} emptyText={copy.empty} />
            <BriefList label={ar ? 'ملاحظات المخاطر والامتثال' : 'Risk & Compliance Notes'} items={[...riskNotes, ...doNotDoYet]} emptyText={copy.empty} />
          </div>
        </Section>
      </div>

      <footer className="rounded-2xl p-5 sm:p-6 mt-4" style={{ background: '#FAFAFF', border: '1px solid rgba(139,92,246,0.18)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold" style={{ color: '#0f172a' }}>{ar ? 'الإجراء التالي' : 'Next Action'}</h2>
            <p className="text-sm mt-1 leading-6" style={{ color: '#64748b' }}>
              {ar
                ? 'بعد مراجعة هذه الوثيقة، انتقل إلى مركز المحتوى لتحويل الاستراتيجية إلى خطة محتوى قابلة للمراجعة.'
                : 'After reviewing this document, continue to Content Hub to turn the strategy into a reviewable content plan.'}
            </p>
          </div>
          <Link href="/content-hub" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: '#111827', color: '#FFFFFF' }}>
            <FileText className="w-4 h-4" />
            {ar ? 'المتابعة إلى مركز المحتوى' : 'Continue to Content Hub'}
          </Link>
        </div>
      </footer>
    </article>
  )
}

function MetaCard({ icon: Icon, label, value, muted }: BriefItem & { icon: typeof Brain }) {
  return (
    <div className="rounded-2xl p-4 sm:p-5" style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
      <Icon className="w-4 h-4 mb-2" style={{ color: '#8B5CF6' }} />
      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#94a3b8' }}>{label}</p>
      <p className="text-sm font-bold mt-1 leading-5" style={{ color: muted ? '#94a3b8' : '#334155' }}>{value}</p>
    </div>
  )
}

function Section({ icon: Icon, title, children, tone, className = '' }: {
  icon: typeof Brain
  title: string
  children: ReactNode
  tone?: 'lavender'
  className?: string
}) {
  return (
    <section className={`rounded-2xl p-5 sm:p-6 ${className}`} style={{
      background: tone === 'lavender' ? '#FAFAFF' : '#FFFFFF',
      border: tone === 'lavender' ? '1px solid rgba(139,92,246,0.18)' : '1px solid rgba(15,23,42,0.08)',
      boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
    }}>
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4" style={{ color: '#8B5CF6' }} />
        <h2 className="text-sm font-bold" style={{ color: '#0f172a' }}>{title}</h2>
      </div>
      {children}
    </section>
  )
}

function BriefLine({ label, value, muted }: BriefItem) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#94a3b8' }}>{label}</p>
      <p className="text-sm mt-1 leading-6" style={{ color: muted ? '#94a3b8' : '#334155' }}>{value}</p>
    </div>
  )
}

function BriefList({ label, items, emptyText, pill = false }: { label: string; items: string[]; emptyText: string; pill?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#94a3b8' }}>{label}</p>
      {items.length === 0 ? (
        <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>{emptyText}</p>
      ) : pill ? (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {items.map((item, i) => (
            <span key={`${item}-${i}`} className="px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background: '#F5F3FF', border: '1px solid rgba(139,92,246,0.18)', color: '#6d28d9' }}>
              {item}
            </span>
          ))}
        </div>
      ) : (
        <ul className="mt-1 space-y-1">
          {items.map((item, i) => <li key={`${item}-${i}`} className="text-sm leading-6" style={{ color: '#334155' }}>{item}</li>)}
        </ul>
      )}
    </div>
  )
}

function SoftBullet({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm leading-6" style={{ color: '#475569' }}>
      <Circle className="w-3 h-3 mt-1.5 flex-shrink-0" style={{ color: '#94a3b8' }} />
      <span>{children}</span>
    </div>
  )
}

function SoftWarning({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl" style={{ background: '#FFF7ED', border: '1px solid rgba(249,115,22,0.18)' }}>
      <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#ea580c' }} />
      <p className="text-xs font-semibold leading-5" style={{ color: '#9a3412' }}>{children}</p>
    </div>
  )
}

function AudienceSegments({ detailed, fallback, emptyText, ar }: { detailed: Dict[]; fallback: string[]; emptyText: string; ar: boolean }) {
  if (detailed.length === 0 && fallback.length === 0) return <p className="text-sm" style={{ color: '#94a3b8' }}>{emptyText}</p>
  if (detailed.length === 0) return <BriefList label={ar ? 'الشرائح' : 'Segments'} items={fallback} emptyText={emptyText} />

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {detailed.map((segment, i) => {
        const name = firstText(segment.segment, segment.name, segment.title) || `${ar ? 'شريحة' : 'Segment'} ${i + 1}`
        const rows = withFallbackRows([
          { label: ar ? 'الألم' : 'Pain', value: firstText(segment.pain, segment.painPoint) },
          { label: ar ? 'ما يريده' : 'Want', value: firstText(segment.want, segment.desire, segment.desiredOutcome) },
          { label: ar ? 'الاعتراض' : 'Objection', value: firstText(segment.objection) },
          { label: ar ? 'الرسالة' : 'Message', value: firstText(segment.message, segment.messagingAngle) },
          { label: ar ? 'المنصة المفضلة' : 'Preferred platform', value: firstText(segment.platform, segment.channel) },
        ], emptyText)
        return (
          <div key={`${name}-${i}`} className="rounded-xl p-4" style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.06)' }}>
            <h3 className="text-sm font-bold mb-3" style={{ color: '#0f172a' }}>{name}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {rows.map(row => <BriefLine key={row.label} {...row} />)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function FunnelStages({ stages, strategy, emptyText, ar }: { stages: Dict[]; strategy: Dict; emptyText: string; ar: boolean }) {
  const legacy = objectValue(strategy.funnelStrategy)
  const legacyRows: Dict[] = legacy ? Object.entries(legacy).map(([stage, value]) => ({ stage, value })) : []
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#94a3b8' }}>{ar ? 'مراحل القمع' : 'Funnel stages'}</p>
      {stages.length === 0 && legacyRows.length === 0 ? (
        <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>{emptyText}</p>
      ) : (
        <div className="space-y-2 mt-2">
          {(stages.length > 0 ? stages : legacyRows).map((stage: Dict, i) => {
            const title = firstText(stage.stage, stage.name, stage.title) || `${ar ? 'مرحلة' : 'Stage'} ${i + 1}`
            const details = [
              firstText(stage.value),
              firstText(stage.goal) && `${ar ? 'الهدف' : 'Goal'}: ${firstText(stage.goal)}`,
              firstText(stage.mechanism) && `${ar ? 'الآلية' : 'Mechanism'}: ${firstText(stage.mechanism)}`,
              listLabels(asArray(stage.tactics), 4).join(', '),
            ].filter(Boolean)
            return (
              <div key={`${title}-${i}`} className="rounded-xl p-3" style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.06)' }}>
                <p className="text-sm font-bold capitalize" style={{ color: '#334155' }}>{title}</p>
                {details.length > 0 ? (
                  <ul className="mt-1 space-y-1">
                    {details.map(detail => <li key={detail} className="text-sm leading-6" style={{ color: '#64748b' }}>{detail}</li>)}
                  </ul>
                ) : <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>{emptyText}</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function WeeklyPlan({ weeklyExecutionPlan, weeklyPlan, emptyText, ar }: { weeklyExecutionPlan: Dict[]; weeklyPlan: Dict[]; emptyText: string; ar: boolean }) {
  const weeks = weeklyExecutionPlan.length > 0 ? weeklyExecutionPlan : weeklyPlan
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#94a3b8' }}>{ar ? 'خطة 4 أسابيع' : '4-week execution plan'}</p>
      {weeks.length === 0 ? (
        <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>{emptyText}</p>
      ) : (
        <div className="space-y-2 mt-2">
          {weeks.slice(0, 4).map((week, i) => {
            const label = firstText(week.week) || String(i + 1)
            const title = firstText(week.objective, week.theme, week.organicFocus) || emptyText
            const details = [firstText(week.keyMessage), ...listLabels(asArray(week.deliverables), 4), firstText(week.successMetric)].filter(Boolean)
            return (
              <div key={`${label}-${i}`} className="rounded-xl p-3" style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.06)' }}>
                <p className="text-sm font-bold" style={{ color: '#334155' }}>{ar ? 'الأسبوع' : 'Week'} {label}: {title}</p>
                {details.length > 0 && <ul className="mt-1 space-y-1">{details.map(detail => <li key={detail} className="text-sm leading-6" style={{ color: '#64748b' }}>{detail}</li>)}</ul>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function KpiList({ kpis, successMetrics, emptyText, baselineText, targetText, ar }: { kpis: Dict[]; successMetrics: string[]; emptyText: string; baselineText: string; targetText: string; ar: boolean }) {
  if (kpis.length === 0 && successMetrics.length === 0) return <p className="text-sm" style={{ color: '#94a3b8' }}>{emptyText}</p>
  if (kpis.length === 0) return <BriefList label={ar ? 'مقاييس للمتابعة' : 'Metrics to track'} items={successMetrics.map(metric => `${metric} (${baselineText})`)} emptyText={emptyText} />

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {kpis.map((kpi, i) => {
        const metric = firstText(kpi.metric, kpi.kpi, kpi.name) || `${ar ? 'مؤشر' : 'Metric'} ${i + 1}`
        const target = firstText(kpi.target, kpi.goal) || targetText
        const timeframe = firstText(kpi.timeframe, kpi.period) || baselineText
        return (
          <div key={`${metric}-${i}`} className="rounded-xl p-4" style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.06)' }}>
            <p className="text-sm font-bold" style={{ color: '#334155' }}>{metric}</p>
            <p className="text-sm mt-1 leading-6" style={{ color: '#64748b' }}>{target}</p>
            <span className="inline-flex mt-3 px-2 py-0.5 rounded-full text-[11px] font-semibold"
              style={{ background: '#ECFEFF', color: '#0e7490', border: '1px solid rgba(6,182,212,0.18)' }}>
              {ar ? 'فرضية' : 'Hypothesis'} · {timeframe}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function ReadinessList({ items, fallback, emptyText, ar }: { items: unknown[]; fallback: string[]; emptyText: string; ar: boolean }) {
  const normalized = items.length > 0
    ? items.map(item => {
      const record = objectValue(item)
      return { label: firstText(record?.label, record?.item, record?.name, item), done: Boolean(record?.done) }
    })
    : fallback.map(item => ({ label: item, done: false }))

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#94a3b8' }}>{ar ? 'قائمة الجاهزية' : 'Readiness checklist'}</p>
      {normalized.length === 0 ? (
        <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>{emptyText}</p>
      ) : (
        <div className="space-y-2 mt-2">
          {normalized.map((item, i) => (
            <div key={`${item.label}-${i}`} className="flex items-start gap-2 text-sm leading-6" style={{ color: '#475569' }}>
              <Circle className="w-3 h-3 mt-1.5 flex-shrink-0" style={{ color: item.done ? '#22c55e' : '#94a3b8' }} />
              <span>{item.label || emptyText}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
