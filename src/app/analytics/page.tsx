'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  BrainCircuit,
  CreditCard,
  Database,
  Eye,
  Gauge,
  Loader2,
  Megaphone,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  type LucideIcon,
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { formatCreditDisplay } from '@/lib/creditDisplay'

interface MonthActivity {
  label: string
  month: number
  year: number
  generations: number
  creditsUsed: number
}

interface TopCampaign {
  id: string
  name: string
  status: string
  updatedAt: string
  _count: { generations: number }
}

interface OverviewData {
  campaigns: number
  activeCampaigns: number
  draftCampaigns: number
  generations: number
  publishedPosts: number
  visualsCount: number
  creditsRemaining: number
  creditsUsedThisMonth: number
  monthlyTotal: number
  isUnlimited: boolean
  plan: string
  monthlyActivity: MonthActivity[]
  topCampaigns: TopCampaign[]
  performance: {
    hasEvidence: boolean
    organicEvidenceCount: number
    paidEvidenceCount: number
    totalEvidenceRows: number
    totals: {
      impressions: number
      reach: number
      engagements: number
      clicks: number
      conversions: number
      spend: number
      organicEngagementRate: number | null
      paidCtr: number | null
      paidRoas: number | null
    }
    channels: Array<{
      platform: string
      evidenceRows: number
      impressions: number
      reach: number
      engagements: number
      clicks: number
      conversions: number
      spend: number
    }>
    trend: Array<{
      date: string
      impressions: number
      engagements: number
      clicks: number
      conversions: number
      spend: number
    }>
    lastUpdatedAt: string | null
  }
}

interface SystemInsight {
  id: string
  type: 'action' | 'info' | 'warning' | 'success'
  icon: string
  message: string
  href?: string
}

const INSIGHT_TONE = {
  action: 'border-violet-100 bg-violet-50 text-violet-700',
  info: 'border-sky-100 bg-sky-50 text-sky-700',
  warning: 'border-amber-100 bg-amber-50 text-amber-700',
  success: 'border-emerald-100 bg-emerald-50 text-emerald-700',
} as const

function formatNum(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`
  return String(value)
}

function MetricCard({
  title,
  value,
  helper,
  icon: Icon,
  loading,
  href,
}: {
  title: string
  value: string | number
  helper: string
  icon: LucideIcon
  loading?: boolean
  href?: string
}) {
  const body = (
    <div className="nx-os-card nx-os-card-interactive h-full p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[12px] font-bold text-[#64708f]">{title}</p>
        <span className="flex h-10 w-10 items-center justify-center rounded-[15px] bg-[#f4f6ff] text-[#5366f6]">
          <Icon size={19} />
        </span>
      </div>
      {loading ? (
        <div className="h-8 w-24 animate-pulse rounded-lg bg-[#edf1f8]" />
      ) : (
        <p className="text-[28px] font-black text-[#071236]">{value}</p>
      )}
      <p className="mt-1 text-[12px] font-bold leading-5 text-[#7b87a3]">{helper}</p>
    </div>
  )

  return href ? <Link href={href}>{body}</Link> : body
}

function ActivityChart({ data, loading, emptyCopy }: { data: MonthActivity[]; loading: boolean; emptyCopy: string }) {
  const maxValue = Math.max(...data.map((item) => item.generations), 1)
  const hasData = data.some((item) => item.generations > 0)

  if (loading) {
    return (
      <div className="flex h-48 items-end gap-3">
        {[35, 58, 44, 72, 50, 66].map((height, index) => (
          <div key={index} className="flex-1 rounded-t-[14px] bg-[#edf1f8]" style={{ height: `${height}%` }} />
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="flex h-48 items-end gap-3">
        {(data.length ? data : Array.from({ length: 6 }, (_, index) => ({ label: String(index + 1), month: index, year: 2026, generations: 0, creditsUsed: 0 }))).map((item) => {
          const height = hasData ? Math.max((item.generations / maxValue) * 100, item.generations > 0 ? 10 : 3) : 3
          return (
            <div key={`${item.year}-${item.month}`} className="group flex flex-1 flex-col items-center gap-2">
              <div className="relative w-full rounded-t-[14px] border border-[#dfe6f2] bg-[#edf1f8]" style={{ height: `${height}%` }}>
                {item.generations > 0 ? <div className="h-full rounded-t-[13px] bg-gradient-to-t from-[#5366f6] to-[#8b7cf6]" /> : null}
              </div>
              <span className="text-[10px] font-bold text-[#8a96ad]">{item.label}</span>
            </div>
          )
        })}
      </div>
      {!hasData ? <p className="mt-4 text-center text-[12px] font-bold text-[#8a96ad]">{emptyCopy}</p> : null}
    </div>
  )
}

function EvidenceTrend({
  data,
  ar,
}: {
  data: OverviewData['performance']['trend']
  ar: boolean
}) {
  const visible = data.slice(-14)
  const max = Math.max(...visible.map(point => point.impressions), 1)

  if (!visible.length) {
    return (
      <div className="flex h-52 items-center justify-center rounded-[18px] border border-dashed border-[#d4dceb] bg-[#fbfcff] px-6 text-center text-[12px] font-bold leading-6 text-[#8792aa]">
        {ar ? 'لا توجد نقاط زمنية موثقة للرسم بعد.' : 'No verified time-series points are available yet.'}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex h-52 min-w-[540px] items-end gap-2 rounded-[18px] border border-[#edf1f7] bg-[#fbfcff] px-4 pt-5">
        {visible.map(point => (
          <div key={point.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
            <div className="flex w-full flex-1 items-end">
              <div
                className="w-full rounded-t-[9px] bg-[linear-gradient(180deg,#7c83ff,#5366f6)]"
                style={{ height: `${Math.max(5, (point.impressions / max) * 100)}%` }}
                title={`${point.date}: ${formatNum(point.impressions)}`}
              />
            </div>
            <span className="pb-3 text-[9px] font-bold text-[#8994aa]">{point.date.slice(5)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const { isAuthenticated, loading: authLoading, authHeader } = useAuth()
  const { locale, dir } = useI18n()
  const router = useRouter()
  const ar = locale === 'ar'

  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [insights, setInsights] = useState<SystemInsight[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/login')
  }, [authLoading, isAuthenticated, router])

  const loadAnalytics = useCallback(async () => {
    if (!isAuthenticated) return
    setDataLoading(true)
    try {
      const headers = { Authorization: authHeader() }
      const [overviewRes, insightsRes] = await Promise.all([
        fetch('/api/analytics/overview', { headers }).then((response) => response.json()).catch(() => null),
        fetch('/api/analytics/insights', { headers }).then((response) => response.json()).catch(() => ({ insights: [] })),
      ])
      if (overviewRes && !overviewRes.error) setOverview(overviewRes)
      if (insightsRes?.insights) setInsights(insightsRes.insights)
    } finally {
      setDataLoading(false)
    }
  }, [authHeader, isAuthenticated])

  useEffect(() => {
    loadAnalytics()
  }, [loadAnalytics])

  const creditDisplay = overview ? formatCreditDisplay({
    availableCredits: overview.creditsRemaining,
    monthlyCredits: overview.isUnlimited ? 0 : overview.monthlyTotal,
    locale: ar ? 'ar' : 'en',
  }) : null

  const dataQuality = overview?.performance.hasEvidence
    ? ar ? 'بيانات أداء موثقة' : 'Verified performance data'
    : overview?.publishedPosts
      ? ar ? 'منشور، بانتظار تحليلات المنصة' : 'Published, awaiting platform analytics'
      : ar ? 'لا توجد بيانات أداء بعد' : 'No performance data yet'

  if (authLoading) {
    return (
      <AppShell>
        <div className="flex min-h-screen items-center justify-center bg-[#f6f8fc]">
          <Loader2 className="h-9 w-9 animate-spin text-[#5366f6]" />
        </div>
      </AppShell>
    )
  }

  if (!isAuthenticated) return null

  return (
    <AppShell>
      <main dir={dir} className="nx-os-page">
        <div className="nx-os-container">
          <LuxuryWorkspaceHeader
            pageTitle={ar ? 'النتائج' : 'Results'}
            pageSubtitle={ar ? 'أداء موثّق من المنصات، وما الذي يجب تغييره بعد ذلك.' : 'Verified platform performance and what to change next.'}
            primaryHref="/connections"
            primaryLabel={ar ? 'إدارة مصادر البيانات' : 'Manage data sources'}
            secondaryHref="/campaigns"
            secondaryLabel={ar ? 'الحملات' : 'Campaigns'}
          />

          <section className="hidden">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#f1f3ff] text-[#5366f6]">
                <Sparkles size={21} />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[23px] font-black text-[#071236]">{ar ? 'قياس حقيقي قبل التعلّم' : 'Real measurement before learning'}</h1>
                  <span className="rounded-full bg-[#eefaf3] px-2.5 py-1 text-[10px] font-black text-emerald-700">
                    {ar ? 'بيانات NEXUS متاحة' : 'NEXUS data available'}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${overview?.performance.hasEvidence ? 'bg-[#eefaf3] text-emerald-700' : 'bg-[#fff7e8] text-amber-700'}`}>
                    {overview?.performance.hasEvidence ? (ar ? 'قياس منصة موثوق' : 'Verified platform measurement') : (ar ? 'قياس المنصات منتظر' : 'Platform measurement pending')}
                  </span>
                </div>
                <p className="mt-1 max-w-4xl text-[12px] font-bold leading-6 text-[#6f7b96]">
                  {ar
                    ? 'يفصل NEXUS بين سجل التشغيل ونتائج المنصات. لا يظهر KPI أو ROAS أو تعلّم أداء قبل وصول analyticsData أو مقاييس موثوقة.'
                    : 'NEXUS separates operating records from platform outcomes. KPI, ROAS, and performance learning stay hidden until analyticsData or trusted metrics arrive.'}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-3">
              <button
                type="button"
                onClick={loadAnalytics}
                className="inline-flex h-11 items-center gap-2 rounded-[15px] border border-[#d7def0] bg-white px-4 text-[13px] font-black text-[#111b3f] shadow-sm"
              >
                <RefreshCw className="h-4 w-4 text-[#5366f6]" />
                {ar ? 'تحديث البيانات' : 'Refresh data'}
              </button>
              <Link href="/connections" className="inline-flex h-11 items-center gap-2 rounded-[15px] bg-[#071236] px-5 text-[13px] font-black text-white shadow-[0_18px_38px_rgba(7,18,54,0.2)]">
                <Database className="h-4 w-4" />
                {ar ? 'إدارة مصادر البيانات' : 'Manage data sources'}
              </Link>
            </div>
          </section>

          {dataLoading ? (
            <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {[1, 2, 3, 4, 5].map(item => <div key={item} className="h-32 animate-pulse rounded-[22px] bg-white" />)}
            </section>
          ) : overview?.performance.hasEvidence ? (
            <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <MetricCard title={ar ? 'مرات الظهور' : 'Impressions'} value={formatNum(overview.performance.totals.impressions)} helper={ar ? `${overview.performance.totalEvidenceRows} صف قياس موثق` : `${overview.performance.totalEvidenceRows} verified measurement rows`} icon={Eye} />
              <MetricCard title={ar ? 'التفاعلات' : 'Engagements'} value={formatNum(overview.performance.totals.engagements)} helper={overview.performance.totals.organicEngagementRate === null ? (ar ? 'لا يوجد مقام ظهور كافٍ' : 'No impression denominator yet') : `${overview.performance.totals.organicEngagementRate.toFixed(2)}% ${ar ? 'عضوي' : 'organic'}`} icon={Activity} />
              <MetricCard title={ar ? 'النقرات' : 'Clicks'} value={formatNum(overview.performance.totals.clicks)} helper={overview.performance.totals.paidCtr === null ? (ar ? 'لا توجد CTR مدفوعة موثقة' : 'No verified paid CTR') : `${overview.performance.totals.paidCtr.toFixed(2)}% CTR`} icon={BarChart3} />
              <MetricCard title={ar ? 'التحويلات' : 'Conversions'} value={formatNum(overview.performance.totals.conversions)} helper={ar ? 'من بيانات منصة موثقة فقط' : 'From trusted platform data only'} icon={Target} />
              <MetricCard title={ar ? 'العائد على الإنفاق' : 'Paid ROAS'} value={overview.performance.totals.paidRoas === null ? '—' : overview.performance.totals.paidRoas.toFixed(2)} helper={overview.performance.paidEvidenceCount > 0 ? (ar ? `${overview.performance.paidEvidenceCount} لقطة مدفوعة موثقة` : `${overview.performance.paidEvidenceCount} verified paid snapshots`) : (ar ? 'لا يوجد قياس مدفوع' : 'No paid measurement')} icon={ShieldCheck} />
            </section>
          ) : (
            <section className="nx-os-card mb-5 grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[#f3f5ff] text-[#5366f6]"><Database className="h-6 w-6" /></span>
                <div>
                  <h2 className="text-[18px] font-black text-[#071236]">{ar ? 'اربط مصدر قياس لعرض النتائج' : 'Connect a measurement source to see results'}</h2>
                  <p className="mt-2 max-w-3xl text-[12px] font-bold leading-6 text-[#75819d]">
                    {overview?.publishedPosts
                      ? (ar ? `يوجد ${overview.publishedPosts} منشورًا بحالة منشور، لكن لم تصل نتائج موثقة من المنصة بعد.` : `${overview.publishedPosts} posts are marked published, but verified platform results have not arrived yet.`)
                      : (ar ? 'بعد النشر، اربط حسابات القياس ليعرض NEXUS النتائج الحقيقية ويقترح القرار التالي.' : 'After publishing, connect measurement accounts so NEXUS can show real results and recommend the next decision.')}
                  </p>
                </div>
              </div>
              <Link href="/connections" className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[#071236] px-5 text-[12px] font-black text-white">
                {ar ? 'إدارة مصادر القياس' : 'Manage measurement sources'}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </section>
          )}

          <section className="hidden">
            <MetricCard title={ar ? 'الحملات' : 'Campaigns'} value={overview?.campaigns ?? 0} helper={overview ? `${overview.activeCampaigns} ${ar ? 'نشطة' : 'active'} · ${overview.draftCampaigns} ${ar ? 'مسودة' : 'drafts'}` : dataQuality} icon={Megaphone} href="/campaigns" loading={dataLoading} />
            <MetricCard title={ar ? 'منشورات منشورة' : 'Published posts'} value={overview?.publishedPosts ?? 0} helper={ar ? 'لا يعني وجود بيانات أداء تلقائياً' : 'Does not imply analytics automatically'} icon={Send} href="/content-hub" loading={dataLoading} />
            <MetricCard title={ar ? 'توليدات AI' : 'AI generations'} value={overview?.generations ?? 0} helper={ar ? 'كل الوقت، من سجل NEXUS' : 'All-time, from NEXUS records'} icon={BrainCircuit} loading={dataLoading} />
            <MetricCard title={ar ? 'أصول بصرية' : 'Visual assets'} value={overview?.visualsCount ?? 0} helper={ar ? 'أصول مراجعة، ليست أداء' : 'Review assets, not performance'} icon={Eye} href="/media" loading={dataLoading} />
            <MetricCard title={ar ? 'الأرصدة' : 'Credits'} value={creditDisplay?.primary ?? '—'} helper={creditDisplay?.secondary || (ar ? 'رصيد متاح للتشغيل' : 'Available operating balance')} icon={CreditCard} href="/billing" loading={dataLoading} />
          </section>

          <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
            <div className="space-y-5">
              <div className="hidden">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-[18px] font-black text-[#071236]">{ar ? 'نشاط NEXUS الشهري' : 'Monthly NEXUS activity'}</h2>
                    <p className="mt-1 text-[12px] font-bold text-[#64708f]">{ar ? 'يعرض التوليد واستهلاك الأرصدة، وليس أداء المنصات.' : 'Shows generation and credit usage, not platform performance.'}</p>
                  </div>
                  <Gauge className="h-5 w-5 text-[#5366f6]" />
                </div>
                <ActivityChart data={overview?.monthlyActivity ?? []} loading={dataLoading} emptyCopy={ar ? 'لا توجد نشاطات توليد بعد.' : 'No generation activity yet.'} />
              </div>

              <div className="nx-os-card p-5">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-[18px] font-black text-[#071236]">{ar ? 'اتجاه الأداء الموثق' : 'Verified performance trend'}</h2>
                    <p className="mt-1 text-[12px] font-bold text-[#64708f]">
                      {ar ? 'كل عمود يأتي من تحليلات موثقة أو لقطة منصة حقيقية؛ لا توجد توقعات داخل الرسم.' : 'Every bar comes from verified analytics or a trusted platform snapshot; the chart contains no forecasts.'}
                    </p>
                  </div>
                  <BarChart3 className="h-5 w-5 text-[#5366f6]" />
                </div>
                <EvidenceTrend data={overview?.performance.trend ?? []} ar={ar} />

                <div className="mt-5 border-t border-[#edf1f7] pt-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-[14px] font-black text-[#071236]">{ar ? 'الأداء حسب القناة' : 'Performance by channel'}</h3>
                    <Link href="/learning" className="text-[11px] font-black text-[#5366f6]">{ar ? 'فتح التعلّم' : 'Open learning'}</Link>
                  </div>
                  {overview?.performance.channels.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[620px] text-start text-[11px]">
                        <thead className="text-[#8792aa]">
                          <tr className="border-b border-[#e9edf5]">
                            <th className="px-3 py-3 text-start font-black">{ar ? 'القناة' : 'Channel'}</th>
                            <th className="px-3 py-3 text-start font-black">{ar ? 'الدليل' : 'Evidence'}</th>
                            <th className="px-3 py-3 text-start font-black">{ar ? 'الظهور' : 'Impressions'}</th>
                            <th className="px-3 py-3 text-start font-black">{ar ? 'التفاعل' : 'Engagements'}</th>
                            <th className="px-3 py-3 text-start font-black">{ar ? 'النقرات' : 'Clicks'}</th>
                            <th className="px-3 py-3 text-start font-black">{ar ? 'التحويلات' : 'Conversions'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {overview.performance.channels.map(channel => (
                            <tr key={channel.platform} className="border-b border-[#f0f3f8] last:border-b-0">
                              <td className="px-3 py-3 font-black text-[#111b3f]">{channel.platform}</td>
                              <td className="px-3 py-3 font-bold text-[#64708f]">{channel.evidenceRows}</td>
                              <td className="px-3 py-3 font-bold text-[#64708f]">{formatNum(channel.impressions)}</td>
                              <td className="px-3 py-3 font-bold text-[#64708f]">{formatNum(channel.engagements)}</td>
                              <td className="px-3 py-3 font-bold text-[#64708f]">{formatNum(channel.clicks)}</td>
                              <td className="px-3 py-3 font-bold text-[#64708f]">{formatNum(channel.conversions)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="rounded-[17px] border border-dashed border-[#cfd8ee] bg-[#fbfcff] p-5 text-center text-[12px] font-bold text-[#7b87a3]">
                      {ar ? 'لا توجد قنوات لديها قياس موثق بعد.' : 'No channels have verified measurement yet.'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <aside className="space-y-5">
              <div className="nx-os-card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-[16px] font-black text-[#071236]">{ar ? 'حالة الثقة في البيانات' : 'Data confidence'}</h2>
                  <ShieldCheck className="h-5 w-5 text-[#5366f6]" />
                </div>
                {[
                  [ar ? 'بيانات NEXUS الداخلية' : 'NEXUS internal records', ar ? 'متاحة' : 'Available', true],
                  [
                    ar ? 'بيانات عضوية موثقة' : 'Verified organic metrics',
                    (overview?.performance.organicEvidenceCount ?? 0) > 0 ? String(overview?.performance.organicEvidenceCount) : (ar ? 'بانتظار القياس' : 'Waiting'),
                    (overview?.performance.organicEvidenceCount ?? 0) > 0,
                  ],
                  [
                    ar ? 'لقطات مدفوعة موثقة' : 'Verified paid snapshots',
                    (overview?.performance.paidEvidenceCount ?? 0) > 0 ? String(overview?.performance.paidEvidenceCount) : (ar ? 'غير متاحة' : 'Not available'),
                    (overview?.performance.paidEvidenceCount ?? 0) > 0,
                  ],
                  [
                    ar ? 'تعلم الأداء' : 'Performance learning',
                    overview?.performance.hasEvidence ? (ar ? 'يمكن المراجعة' : 'Reviewable') : (ar ? 'مغلق حتى التحليلات' : 'Locked until analytics'),
                    overview?.performance.hasEvidence ?? false,
                  ],
                ].map(([label, value, ok]) => (
                  <div key={label as string} className="flex items-center justify-between border-b border-[#eef2f8] py-3 last:border-b-0">
                    <span className="text-[12px] font-bold text-[#64708f]">{label}</span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{value}</span>
                  </div>
                ))}
              </div>

              <div className="nx-os-card p-5">
                <h2 className="text-[16px] font-black text-[#071236]">{ar ? 'رؤى النظام' : 'System insights'}</h2>
                <div className="mt-4 space-y-3">
                  {dataLoading ? [1, 2, 3].map((item) => (
                    <div key={item} className="h-16 animate-pulse rounded-[17px] bg-[#edf1f8]" />
                  )) : insights.length ? insights.map((insight) => {
                    const card = (
                      <div className={`rounded-[17px] border p-3 ${INSIGHT_TONE[insight.type]}`}>
                        <p className="text-[12px] font-bold leading-6">{insight.icon} {insight.message}</p>
                      </div>
                    )
                    return insight.href ? <Link key={insight.id} href={insight.href}>{card}</Link> : <div key={insight.id}>{card}</div>
                  }) : (
                    <div className="rounded-[17px] border border-dashed border-[#cfd8ee] bg-[#fbfcff] p-4 text-[12px] font-bold leading-6 text-[#64708f]">
                      {overview?.publishedPosts
                        ? (ar ? 'توجد منشورات منشورة، لكن لا توجد بيانات أداء كافية بعد.' : 'There are published posts, but not enough performance data yet.')
                        : (ar ? 'لا توجد رؤى أداء بعد. ابدأ من استراتيجية ومركز محتوى ثم اربط مصادر القياس.' : 'No performance insights yet. Start from strategy and Content Hub, then connect measurement sources.')}
                    </div>
                  )}
                </div>
              </div>

              <div className="hidden">
                <h2 className="text-[16px] font-black text-[#071236]">{ar ? 'الحملات الأخيرة' : 'Recent campaigns'}</h2>
                <div className="mt-4 space-y-3">
                  {dataLoading ? [1, 2, 3].map((item) => (
                    <div key={item} className="h-14 animate-pulse rounded-[17px] bg-[#edf1f8]" />
                  )) : overview?.topCampaigns?.length ? overview.topCampaigns.map((campaign) => (
                    <Link key={campaign.id} href={`/campaigns/${campaign.id}`} className="flex items-center justify-between rounded-[17px] border border-[#e8edf7] bg-[#fbfcff] p-3">
                      <span>
                        <span className="block text-[13px] font-black text-[#111b3f]">{campaign.name}</span>
                        <span className="mt-1 block text-[11px] font-bold text-[#7b87a3]">{campaign._count.generations} {ar ? 'توليد' : 'generations'}</span>
                      </span>
                      <ArrowUpRight className="h-4 w-4 text-[#5366f6]" />
                    </Link>
                  )) : (
                    <p className="rounded-[17px] border border-dashed border-[#cfd8ee] bg-[#fbfcff] p-4 text-[12px] font-bold text-[#64708f]">
                      {ar ? 'لا توجد حملات بعد.' : 'No campaigns yet.'}
                    </p>
                  )}
                </div>
              </div>
            </aside>
          </section>
        </div>
      </main>
    </AppShell>
  )
}
