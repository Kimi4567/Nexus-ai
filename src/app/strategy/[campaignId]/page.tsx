'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { getCampaignPlatformSummary } from '@/lib/campaignPlatforms'
import AppShell from '@/components/AppShell'
import {
  ArrowLeft, ArrowRight, BarChart3, Brain, CalendarDays, CheckCircle2,
  Circle, FileText, Layers, Loader2, Megaphone, ShieldCheck, Sparkles,
  Target, Users,
} from 'lucide-react'

interface CampaignLite {
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

interface BriefItem {
  label: string
  value: string
  muted?: boolean
}

function objectValue(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

function asRecords(v: unknown): Record<string, unknown>[] {
  return asArray(v).map(objectValue).filter((item): item is Record<string, unknown> => Boolean(item))
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
    if (value && typeof value === 'object') {
      const o = value as Record<string, unknown>
      const nested = firstText(o.name, o.title, o.summary, o.text, o.value, o.description, o.label, o.item, o.metric)
      if (nested) return nested
    }
  }
  return ''
}

function listLabels(values: unknown[], limit = 8): string[] {
  return values.map(value => firstText(value)).filter(Boolean).slice(0, limit)
}

function formatDate(value: string, locale: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en', { month: 'short', day: 'numeric', year: 'numeric' }).format(d)
}

export default function StrategyReviewPage() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const { authHeader, isAuthenticated, loading: authLoading } = useAuth()
  const { locale } = useI18n()
  const router = useRouter()
  const ar = locale === 'ar'

  const [loading, setLoading] = useState(true)
  const [campaign, setCampaign] = useState<CampaignLite | null>(null)

  const load = useCallback(async () => {
    if (!isAuthenticated || !campaignId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        headers: { Authorization: authHeader() },
      })
      if (res.ok) {
        const data = await res.json()
        setCampaign(data.campaign ?? null)
        return
      }
      setCampaign(null)
    } catch {
      setCampaign(null)
    } finally {
      setLoading(false)
    }
  }, [authHeader, campaignId, isAuthenticated])

  useEffect(() => {
    if (!authLoading && isAuthenticated) load()
  }, [authLoading, isAuthenticated, load])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/login')
  }, [authLoading, isAuthenticated, router])

  const copy = useMemo(() => ({
    empty: ar ? 'غير مذكور في مسودة الاستراتيجية' : 'Not included in this strategy draft',
    noPaid: ar ? 'لم يتم إنشاء خطة مدفوعة بعد' : 'No paid plan generated yet',
    baseline: ar ? 'يحتاج إلى خط أساس' : 'Baseline needed',
    targetLater: ar ? 'يتم تحديد الهدف بعد أول 30 يوما' : 'Target to define after first 30 days',
    notConnected: ar ? 'غير متصل' : 'Not connected',
    notEnabled: ar ? 'غير مفعّل' : 'Not enabled',
  }), [ar])

  const derived = useMemo(() => {
    const ai = objectValue(campaign?.aiOutput)
    const strategy = objectValue(ai?.strategy) ?? ai
    const paid = objectValue(ai?.paidPlan) ?? objectValue(ai?.paidCampaignPlan) ?? objectValue(strategy?.paidPlan)
    const diagnosis = objectValue(strategy?.diagnosisDetails)
    const business = objectValue(strategy?.businessObjective)
    const assetRequirements = objectValue(strategy?.assetRequirements)
    const adSetup = objectValue(strategy?.adSetupPlan)
    const platformSummary = getCampaignPlatformSummary(campaign?.platforms ?? [], locale)

    const topHooks = listLabels([...asArray(ai?.topHooks), ...asArray(strategy?.topHooks), ...asArray(strategy?.hooks)], 10)
    const ctas = listLabels([...asArray(ai?.ctaVariations), ...asArray(strategy?.ctaVariations), ...asArray(strategy?.ctas)], 8)
    const valueProps = listLabels([...asArray(strategy?.valueProps), ...asArray(strategy?.valuePropositions), ...asArray(ai?.valueProps)], 8)
    const contentPillars = listLabels([...asArray(strategy?.contentPillars), ...asArray(ai?.contentPillars)], 8)
    const contentAngles = listLabels([...asArray(strategy?.contentAngles), ...asArray(strategy?.contentAnglesDetailed), ...asArray(ai?.contentAngles)], 8)
    const channelMix = listLabels([...asArray(strategy?.channelStrategy), ...asArray(strategy?.channels), ...asArray(paid?.channels)], 8)
    const paidNotes = listLabels([...asArray(paid?.recommendations), ...asArray(paid?.notes), ...asArray(paid?.channels)], 8)

    return {
      ai,
      strategy,
      paid,
      diagnosis,
      business,
      assetRequirements,
      adSetup,
      platformSummary,
      direction: firstText(strategy?.executiveSummary, strategy?.summary, strategy?.direction, strategy?.bigIdea, ai?.summary, campaign?.description),
      goal: firstText(strategy?.goal, strategy?.objective, campaign?.goal),
      timeframe: firstText(strategy?.timeframe, strategy?.duration, strategy?.horizon),
      strategyType: firstText(strategy?.strategyType, strategy?.type),
      audience: firstText(strategy?.targetAudience, strategy?.audience, campaign?.audience),
      positioning: firstText(strategy?.positioning, strategy?.brandPositioning, strategy?.promise),
      keyMessage: firstText(strategy?.keyMessage, strategy?.message),
      differentiation: firstText(strategy?.differentiation),
      ninetyDayDirection: firstText(strategy?.ninetyDayDirection, strategy?.['90DayDirection'], strategy?.quarterlyDirection),
      firstThirtyDays: firstText(strategy?.first30Days, strategy?.firstThirtyDays, strategy?.initialDirection),
      weeklyDirection: firstText(strategy?.weeklyDirection, strategy?.weekByWeekDirection),
      diagnosisRows: [
        { label: ar ? 'مرحلة النشاط' : 'Business stage', value: firstText(diagnosis?.businessStage, strategy?.businessStage) },
        { label: ar ? 'العائق الرئيسي' : 'Main bottleneck', value: firstText(diagnosis?.mainBottleneck, diagnosis?.biggestChallenge, strategy?.mainBottleneck) },
        { label: ar ? 'فجوة الثقة' : 'Trust gap', value: firstText(diagnosis?.trustGap, strategy?.trustGap) },
        { label: ar ? 'الخطر الرئيسي' : 'Main risk', value: firstText(diagnosis?.mainRisk, strategy?.mainRisk) },
        { label: ar ? 'جاهزية التخطيط المدفوع' : 'Paid readiness', value: firstText(diagnosis?.paidReadiness, strategy?.readyForPaidAdsReason) },
        { label: ar ? 'سبب الاتجاه' : 'Why this direction', value: firstText(diagnosis?.whyThisStrategy, diagnosis?.marketOpportunity, strategy?.whyThisStrategy) },
      ],
      businessRows: [
        { label: ar ? 'هدف النشاط' : 'Business objective', value: firstText(business?.primary, business?.primaryGoal, strategy?.businessObjective) },
        { label: ar ? 'هدف التسويق' : 'Marketing objective', value: firstText(business?.marketing, business?.marketingObjective, strategy?.marketingObjective) },
        { label: ar ? 'إجراء التحويل' : 'Conversion action', value: firstText(business?.conversionAction, strategy?.conversionAction) },
        { label: ar ? 'الإجراء المتوقع' : 'Expected user action', value: firstText(business?.expectedUserAction, strategy?.expectedUserAction) },
        { label: ar ? 'لماذا الآن' : 'Why now', value: firstText(business?.whyNow, strategy?.whyNow) },
        { label: ar ? 'تعريف النجاح' : 'Success definition', value: firstText(business?.successDefinition, business?.successLooksLike, business?.successIn30Days, strategy?.successDefinition) },
      ],
      audienceSegmentsDetailed: asRecords(strategy?.audienceSegmentsDetailed),
      audienceSegments: listLabels(asArray(strategy?.audienceSegments), 8),
      topHooks,
      ctas,
      valueProps,
      contentPillars,
      contentAngles,
      channelMix,
      paidNotes,
      funnelStages: asRecords(strategy?.funnelStages),
      weeklyExecutionPlan: asRecords(strategy?.weeklyExecutionPlan),
      weeklyPlan: asRecords(strategy?.weeklyPlan),
      kpis: [...asRecords(strategy?.kpis), ...asRecords(strategy?.successMetricsDetailed)],
      successMetrics: listLabels(asArray(strategy?.successMetrics), 8),
      readinessChecklist: asArray(strategy?.readinessChecklist),
      executionChecklist: listLabels(asArray(strategy?.executionChecklist), 8),
      riskNotes: listLabels([...asArray(strategy?.riskNotes), ...asArray(strategy?.complianceNotes)], 8),
      doNotDoYet: listLabels(asArray(strategy?.doNotDoYet), 8),
    }
  }, [ar, campaign, locale])

  const card = 'rounded-2xl p-5 sm:p-6'
  const cardStyle = { background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' } as const
  const sectionLabel = 'text-[10px] font-bold uppercase tracking-wider'

  if (!authLoading && !isAuthenticated) return null

  if (authLoading || loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-7 h-7 animate-spin" style={{ color: '#8B5CF6' }} />
        </div>
      </AppShell>
    )
  }

  if (!campaign) {
    return (
      <AppShell>
        <div className="max-w-[920px] mx-auto px-4 py-10">
          <div className={`${card} text-center`} style={cardStyle}>
            <Circle className="w-9 h-9 mx-auto mb-3" style={{ color: '#94a3b8' }} />
            <h1 className="text-xl font-black" style={{ color: '#0f172a' }}>
              {ar ? 'لا توجد استراتيجية للمراجعة' : 'No strategy to review'}
            </h1>
            <p className="text-sm mt-2" style={{ color: '#64748b' }}>
              {ar
                ? 'لم يتم العثور على مسودة استراتيجية لهذا المسار. ارجع إلى صفحة الاستراتيجية لإنشاء أو تحديث الاستراتيجية.'
                : 'No strategy draft was found for this route. Return to Strategy to create or update the strategy.'}
            </p>
            <Link href="/strategy" className="inline-flex items-center justify-center gap-2 mt-5 px-5 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: '#111827', color: '#FFFFFF' }}>
              <ArrowLeft className="w-4 h-4" />
              {ar ? 'العودة إلى الاستراتيجية' : 'Back to Strategy'}
            </Link>
          </div>
        </div>
      </AppShell>
    )
  }

  const diagnosisRows = withFallbackRows(derived.diagnosisRows, copy.empty)
  const businessRows = withFallbackRows(derived.businessRows, copy.empty)

  return (
    <AppShell>
      <div className="relative min-h-screen">
        <div className="max-w-[1120px] mx-auto px-4 py-8 sm:py-10">
          <div className="mb-6">
            <Link href="/strategy" className="inline-flex items-center gap-1 text-xs font-semibold mb-4" style={{ color: '#8B5CF6' }}>
              <ArrowLeft className="w-3 h-3" />
              {ar ? 'العودة إلى الاستراتيجية' : 'Back to Strategy'}
            </Link>
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4" style={{ color: '#8B5CF6' }} />
                  <span className="text-xs font-mono tracking-wider" style={{ color: 'rgba(139,92,246,0.8)' }}>
                    {ar ? 'مراجعة الاستراتيجية' : 'STRATEGY REVIEW'}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black" style={{ color: '#0f172a' }}>{campaign.name}</h1>
                <p className="text-sm mt-2 max-w-2xl leading-6" style={{ color: '#64748b' }}>
                  {ar
                    ? 'موجز تسويقي منظم لمسودة الاستراتيجية قبل تحويلها إلى خطة محتوى وتنفيذ.'
                    : 'A structured marketing strategy brief for reviewing the draft before it moves into content planning and execution.'}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Link href="/content-hub" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: '#111827', color: '#FFFFFF' }}>
                  <FileText className="w-4 h-4" />
                  {ar ? 'المتابعة إلى مركز المحتوى' : 'Continue to Content Hub'}
                </Link>
                <Link href="/strategy" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: '#FFFFFF', color: '#334155', border: '1px solid rgba(15,23,42,0.12)' }}>
                  {ar ? 'العودة إلى الاستراتيجية' : 'Back to Strategy'}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
            <MetaCard icon={Brain} label={ar ? 'المصدر' : 'Source'} value={ar ? 'ذاكرة العلامة' : 'Brand Brain'} />
            <MetaCard icon={CalendarDays} label={ar ? 'آخر تحديث' : 'Last updated'} value={formatDate(campaign.updatedAt, locale) || copy.empty} />
            <MetaCard icon={FileText} label={ar ? 'الحالة' : 'Status'} value={campaign.status.toLowerCase() === 'draft' ? (ar ? 'مسودة استراتيجية' : 'Draft strategy') : (ar ? 'مسودة قراءة فقط' : 'Read-only draft')} />
            <MetaCard icon={Layers} label={ar ? 'المنصات' : 'Platforms'} value={derived.platformSummary.isEmpty ? copy.empty : derived.platformSummary.labels.join(', ')} muted={derived.platformSummary.isEmpty} />
          </div>

          <section className={`${card} mb-4`} style={{ ...cardStyle, background: '#FAFAFF', border: '1px solid rgba(139,92,246,0.18)' }}>
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="w-4 h-4" style={{ color: '#8B5CF6' }} />
              <h2 className="text-sm font-bold" style={{ color: '#0f172a' }}>{ar ? 'ملخص الجاهزية' : 'Strategy Readiness Summary'}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                ar ? 'التخطيط المدفوع يبقى تخطيطا فقط حتى يتم توفير الميزانية ووجهة التحويل والموافقة.' : 'Paid planning remains planning-only until budget, conversion destination, and approval are provided.',
                ar ? 'التحليلات غير متصلة ما لم تظهر بيانات ربط مؤكدة.' : 'Analytics are not connected unless a confirmed connection exists.',
                ar ? 'النشر التلقائي غير مفعّل لهذه المراجعة.' : 'Automatic publishing is not enabled for this review.',
                ar ? 'لا يتم صرف أي ميزانية إعلانية بدون موافقة صريحة.' : 'No ad spend happens without explicit approval.',
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 text-sm leading-6" style={{ color: '#475569' }}>
                  <Circle className="w-3 h-3 mt-1.5 flex-shrink-0" style={{ color: '#94a3b8' }} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-4">
            <BriefSection icon={Sparkles} title={ar ? 'الاتجاه التنفيذي' : 'Executive Direction'} card={card} cardStyle={cardStyle}>
              <p className="text-sm leading-7" style={{ color: derived.direction ? '#334155' : '#94a3b8' }}>
                {derived.direction || copy.empty}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
                {[
                  { label: ar ? 'الهدف' : 'Goal', value: derived.goal || copy.empty, muted: !derived.goal },
                  { label: ar ? 'الإطار الزمني' : 'Timeframe', value: derived.timeframe || copy.empty, muted: !derived.timeframe },
                  { label: ar ? 'نوع الاستراتيجية' : 'Strategy type', value: derived.strategyType || copy.empty, muted: !derived.strategyType },
                ].map(item => <SmallFact key={item.label} {...item} />)}
              </div>
            </BriefSection>

            <BriefSection icon={Brain} title={ar ? 'التشخيص التسويقي' : 'Marketing Diagnosis'} card={card} cardStyle={cardStyle}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {diagnosisRows.map(item => <BriefLine key={item.label} {...item} />)}
              </div>
            </BriefSection>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-4 mt-4">
            <BriefSection icon={Target} title={ar ? 'هدف النشاط' : 'Business Objective'} card={card} cardStyle={cardStyle}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {businessRows.map(item => <BriefLine key={item.label} {...item} />)}
              </div>
            </BriefSection>

            <BriefSection icon={Layers} title={ar ? 'الاستراتيجية الأساسية' : 'Core Strategy'} card={card} cardStyle={cardStyle}>
              <div className="space-y-4">
                <BriefLine label={ar ? 'الرسالة الرئيسية' : 'Key Message'} value={derived.keyMessage || copy.empty} muted={!derived.keyMessage} />
                <BriefLine label={ar ? 'التموضع' : 'Positioning'} value={derived.positioning || copy.empty} muted={!derived.positioning} />
                <BriefLine label={ar ? 'التمايز' : 'Differentiation'} value={derived.differentiation || copy.empty} muted={!derived.differentiation} />
                <BriefLine label={ar ? 'اتجاه 90 يوما' : '90-day direction'} value={derived.ninetyDayDirection || copy.empty} muted={!derived.ninetyDayDirection} />
                <BriefLine label={ar ? 'اتجاه أول 30 يوما' : 'First 30 days'} value={derived.firstThirtyDays || derived.weeklyDirection || copy.empty} muted={!derived.firstThirtyDays && !derived.weeklyDirection} />
              </div>
            </BriefSection>
          </div>

          <BriefSection icon={Users} title={ar ? 'شرائح الجمهور' : 'Audience Segments'} card={`${card} mt-4`} cardStyle={cardStyle}>
            <AudienceSegments
              detailed={derived.audienceSegmentsDetailed}
              fallback={derived.audienceSegments}
              emptyText={copy.empty}
              ar={ar}
            />
          </BriefSection>

          <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-4 mt-4">
            <BriefSection icon={Megaphone} title={ar ? 'خطة المحتوى العضوي' : 'Organic Content Plan'} card={card} cardStyle={cardStyle}>
              <div className="space-y-4">
                <BriefLine
                  label={ar ? 'مزيج المنصات' : 'Platform mix'}
                  value={derived.platformSummary.isEmpty ? copy.empty : derived.platformSummary.labels.join(' · ')}
                  muted={derived.platformSummary.isEmpty}
                />
                <BriefList label={ar ? 'محاور المحتوى' : 'Content pillars'} items={derived.contentPillars} emptyText={copy.empty} pill />
                <BriefList label={ar ? 'عروض القيمة' : 'Value Propositions'} items={derived.valueProps} emptyText={copy.empty} />
                <BriefList label={ar ? 'الخطافات' : 'Top Hooks'} items={derived.topHooks} emptyText={copy.empty} />
                <BriefList label={ar ? 'دعوات الإجراء' : 'CTAs'} items={derived.ctas} emptyText={copy.empty} />
                <BriefList label={ar ? 'زوايا المحتوى' : 'Content angles'} items={derived.contentAngles} emptyText={copy.empty} />
              </div>
            </BriefSection>

            <BriefSection icon={ShieldCheck} title={ar ? 'التخطيط المدفوع' : 'Paid Planning'} card={card} cardStyle={cardStyle}>
              <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold mb-4"
                style={{ background: '#F1F5F9', color: '#64748b', border: '1px solid rgba(15,23,42,0.08)' }}>
                {ar ? 'تخطيط فقط' : 'Planning-only'}
              </span>
              <div className="space-y-4">
                <BriefList label={ar ? 'تفاصيل متاحة' : 'Available details'} items={derived.paidNotes} emptyText={copy.noPaid} />
                <BriefLine label={ar ? 'الميزانية' : 'Budget'} value={firstText(derived.adSetup?.budget, derived.paid?.budget) || copy.empty} muted={!firstText(derived.adSetup?.budget, derived.paid?.budget)} />
                <BriefLine label={ar ? 'وجهة التحويل' : 'Conversion destination'} value={firstText(derived.adSetup?.conversionDestination, derived.paid?.conversionDestination) || copy.empty} muted={!firstText(derived.adSetup?.conversionDestination, derived.paid?.conversionDestination)} />
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl"
                  style={{ background: '#FFF7ED', border: '1px solid rgba(249,115,22,0.18)' }}>
                  <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#ea580c' }} />
                  <p className="text-xs font-semibold leading-5" style={{ color: '#9a3412' }}>
                    {ar ? 'لا يتم صرف أي ميزانية إعلانية بدون موافقة صريحة.' : 'No ad spend happens without explicit approval.'}
                  </p>
                </div>
              </div>
            </BriefSection>
          </div>

          <BriefSection icon={CalendarDays} title={ar ? 'خطة التنفيذ' : 'Execution Plan'} card={`${card} mt-4`} cardStyle={cardStyle}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-4">
                <BriefList label={ar ? 'مزيج القنوات' : 'Channel mix'} items={derived.channelMix} emptyText={copy.empty} pill />
                <FunnelStages stages={derived.funnelStages} emptyText={copy.empty} ar={ar} />
              </div>
              <WeeklyPlan
                weeklyExecutionPlan={derived.weeklyExecutionPlan}
                weeklyPlan={derived.weeklyPlan}
                emptyText={copy.empty}
                ar={ar}
              />
            </div>
          </BriefSection>

          <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-4 mt-4">
            <BriefSection icon={BarChart3} title={ar ? 'المؤشرات والمقاييس' : 'KPIs / Metrics'} card={card} cardStyle={cardStyle}>
              <KpiList
                kpis={derived.kpis}
                successMetrics={derived.successMetrics}
                emptyText={copy.empty}
                baselineText={copy.baseline}
                targetText={copy.targetLater}
                ar={ar}
              />
            </BriefSection>

            <BriefSection icon={CheckCircle2} title={ar ? 'قائمة الجاهزية والمخاطر' : 'Readiness Checklist / Risks'} card={card} cardStyle={cardStyle}>
              <div className="space-y-5">
                <ReadinessList
                  items={derived.readinessChecklist}
                  fallback={derived.executionChecklist}
                  emptyText={copy.empty}
                  ar={ar}
                />
                <BriefList label={ar ? 'نواقص يجب توضيحها' : 'Missing items to clarify'} items={[
                  derived.platformSummary.isEmpty ? (ar ? 'تحديد المنصات المستهدفة' : 'Define target platforms') : '',
                  firstText(derived.adSetup?.budget, derived.paid?.budget) ? '' : (ar ? 'ميزانية التخطيط المدفوع' : 'Paid planning budget'),
                  firstText(derived.adSetup?.conversionDestination, derived.paid?.conversionDestination) ? '' : (ar ? 'وجهة التحويل' : 'Conversion destination'),
                  ar ? 'اتصال التحليلات' : 'Analytics connection',
                  ar ? 'إعداد النشر التلقائي' : 'Automatic publishing setup',
                ].filter(Boolean)} emptyText={copy.empty} />
                <BriefList label={ar ? 'ملاحظات المخاطر والامتثال' : 'Risk & Compliance Notes'} items={[...derived.riskNotes, ...derived.doNotDoYet]} emptyText={copy.empty} />
              </div>
            </BriefSection>
          </div>

          <section className={`${card} mt-4`} style={{ ...cardStyle, background: '#FAFAFF', border: '1px solid rgba(139,92,246,0.18)' }}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold" style={{ color: '#0f172a' }}>{ar ? 'الإجراء التالي' : 'Next Action'}</h2>
                <p className="text-sm mt-1 leading-6" style={{ color: '#64748b' }}>
                  {ar
                    ? 'بعد مراجعة هذا الموجز، انتقل إلى مركز المحتوى لتحويل الاستراتيجية إلى خطة محتوى قابلة للمراجعة.'
                    : 'After reviewing this brief, continue to Content Hub to turn the strategy into a reviewable content plan.'}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Link href="/content-hub" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: '#111827', color: '#FFFFFF' }}>
                  <FileText className="w-4 h-4" />
                  {ar ? 'المتابعة إلى مركز المحتوى' : 'Continue to Content Hub'}
                </Link>
                <Link href="/strategy" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: '#FFFFFF', color: '#334155', border: '1px solid rgba(15,23,42,0.12)' }}>
                  {ar ? 'العودة إلى الاستراتيجية' : 'Back to Strategy'}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  )
}

function withFallbackRows(rows: BriefItem[], fallback: string): BriefItem[] {
  return rows.map(row => row.value ? row : { ...row, value: fallback, muted: true })
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

function BriefSection({
  icon: Icon,
  title,
  children,
  card,
  cardStyle,
}: {
  icon: typeof Brain
  title: string
  children: React.ReactNode
  card: string
  cardStyle: React.CSSProperties
}) {
  return (
    <section className={card} style={cardStyle}>
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

function SmallFact({ label, value, muted }: BriefItem) {
  return (
    <div className="rounded-xl px-3 py-3" style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.06)' }}>
      <p className="text-[11px] font-semibold" style={{ color: '#94a3b8' }}>{label}</p>
      <p className="text-sm font-bold mt-1 leading-5" style={{ color: muted ? '#94a3b8' : '#334155' }}>{value}</p>
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
          {items.map((item, i) => (
            <li key={`${item}-${i}`} className="text-sm leading-6" style={{ color: '#334155' }}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AudienceSegments({ detailed, fallback, emptyText, ar }: { detailed: Record<string, unknown>[]; fallback: string[]; emptyText: string; ar: boolean }) {
  if (detailed.length === 0 && fallback.length === 0) {
    return <p className="text-sm" style={{ color: '#94a3b8' }}>{emptyText}</p>
  }

  if (detailed.length === 0) {
    return <BriefList label={ar ? 'الشرائح' : 'Segments'} items={fallback} emptyText={emptyText} />
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {detailed.map((segment, i) => {
        const name = firstText(segment.segment, segment.name, segment.title) || `${ar ? 'شريحة' : 'Segment'} ${i + 1}`
        const rows = [
          { label: ar ? 'الألم' : 'Pain', value: firstText(segment.pain, segment.painPoint) },
          { label: ar ? 'ما يريده' : 'Want', value: firstText(segment.want, segment.desire, segment.desiredOutcome) },
          { label: ar ? 'الاعتراض' : 'Objection', value: firstText(segment.objection) },
          { label: ar ? 'الرسالة' : 'Message', value: firstText(segment.message, segment.messagingAngle) },
          { label: ar ? 'المنصة المفضلة' : 'Preferred platform', value: firstText(segment.platform, segment.channel) },
        ]

        return (
          <div key={`${name}-${i}`} className="rounded-xl p-4" style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.06)' }}>
            <h3 className="text-sm font-bold mb-3" style={{ color: '#0f172a' }}>{name}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {withFallbackRows(rows, emptyText).map(row => <BriefLine key={row.label} {...row} />)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function FunnelStages({ stages, emptyText, ar }: { stages: Record<string, unknown>[]; emptyText: string; ar: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#94a3b8' }}>{ar ? 'مراحل القمع' : 'Funnel stages'}</p>
      {stages.length === 0 ? (
        <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>{emptyText}</p>
      ) : (
        <div className="space-y-2 mt-2">
          {stages.map((stage, i) => {
            const title = firstText(stage.stage, stage.name, stage.title) || `${ar ? 'مرحلة' : 'Stage'} ${i + 1}`
            const details = [
              firstText(stage.goal) && `${ar ? 'الهدف' : 'Goal'}: ${firstText(stage.goal)}`,
              firstText(stage.mechanism) && `${ar ? 'الآلية' : 'Mechanism'}: ${firstText(stage.mechanism)}`,
              listLabels(asArray(stage.tactics), 4).join(', '),
            ].filter(Boolean)
            return (
              <div key={`${title}-${i}`} className="rounded-xl p-3" style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.06)' }}>
                <p className="text-sm font-bold" style={{ color: '#334155' }}>{title}</p>
                {details.length > 0 ? (
                  <ul className="mt-1 space-y-1">
                    {details.map(detail => <li key={detail} className="text-sm leading-6" style={{ color: '#64748b' }}>{detail}</li>)}
                  </ul>
                ) : (
                  <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>{emptyText}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function WeeklyPlan({
  weeklyExecutionPlan,
  weeklyPlan,
  emptyText,
  ar,
}: {
  weeklyExecutionPlan: Record<string, unknown>[]
  weeklyPlan: Record<string, unknown>[]
  emptyText: string
  ar: boolean
}) {
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
            const title = firstText(week.theme, week.objective, week.organicFocus) || emptyText
            const details = [
              firstText(week.keyMessage),
              ...listLabels(asArray(week.deliverables), 4),
              firstText(week.successMetric) && `${ar ? 'فرضية القياس' : 'Metric hypothesis'}: ${firstText(week.successMetric)}`,
            ].filter(Boolean)
            return (
              <div key={`${label}-${i}`} className="rounded-xl p-3" style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.06)' }}>
                <p className="text-sm font-bold" style={{ color: '#334155' }}>{ar ? 'الأسبوع' : 'Week'} {label}: {title}</p>
                {details.length > 0 && (
                  <ul className="mt-1 space-y-1">
                    {details.map(detail => <li key={detail} className="text-sm leading-6" style={{ color: '#64748b' }}>{detail}</li>)}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function KpiList({
  kpis,
  successMetrics,
  emptyText,
  baselineText,
  targetText,
  ar,
}: {
  kpis: Record<string, unknown>[]
  successMetrics: string[]
  emptyText: string
  baselineText: string
  targetText: string
  ar: boolean
}) {
  if (kpis.length === 0 && successMetrics.length === 0) {
    return <p className="text-sm" style={{ color: '#94a3b8' }}>{emptyText}</p>
  }

  if (kpis.length === 0) {
    return <BriefList label={ar ? 'مقاييس للمتابعة' : 'Metrics to track'} items={successMetrics.map(metric => `${metric} (${baselineText})`)} emptyText={emptyText} />
  }

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

function ReadinessList({
  items,
  fallback,
  emptyText,
  ar,
}: {
  items: unknown[]
  fallback: string[]
  emptyText: string
  ar: boolean
}) {
  const normalized = items.length > 0
    ? items.map(item => {
      const record = objectValue(item)
      return {
        label: firstText(record?.label, record?.item, record?.name, item),
        done: Boolean(record?.done),
      }
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
