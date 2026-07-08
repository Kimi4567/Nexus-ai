'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  BrainCircuit,
  Check,
  Copy,
  CreditCard,
  Database,
  Eye,
  Gauge,
  Info,
  Loader2,
  Megaphone,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Wand2,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { mapBrandIndustryToAnalytics } from '@/lib/analyticsIndustry'
import { useBrandBrain } from '@/hooks/useBrandBrain'
import { formatCreditDisplay } from '@/lib/creditDisplay'

type AnalysisType = 'performance' | 'competitors' | 'trends' | 'content' | 'forecast'
type Period = '7d' | '30d' | '90d' | '6m' | '1y'

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
    <div className="h-full rounded-[22px] border border-[#e3e8f3] bg-white/90 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] transition hover:border-[#cbd5ef]">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[12px] font-bold text-[#64708f]">{title}</p>
        <span className="flex h-10 w-10 items-center justify-center rounded-[15px] bg-[#f4f6ff] text-[#5366f6]">
          <Icon size={19} />
        </span>
      </div>
      {loading ? (
        <div className="h-8 w-24 animate-pulse rounded-lg bg-[#edf1f8]" />
      ) : (
        <p className="text-[28px] font-black tracking-[-0.03em] text-[#071236]">{value}</p>
      )}
      <p className="mt-1 text-[12px] font-bold leading-5 text-[#7b87a3]">{helper}</p>
    </div>
  )

  return href ? <Link href={href}>{body}</Link> : body
}

function CopyButton({ text, copiedLabel, copyLabel }: { text: string; copiedLabel: string; copyLabel: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
      }}
      className="inline-flex h-9 items-center gap-2 rounded-[13px] border border-[#d7def0] bg-white px-3 text-[12px] font-black text-[#5366f6]"
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? copiedLabel : copyLabel}
    </button>
  )
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

export default function AnalyticsPage() {
  const { isAuthenticated, loading: authLoading, authHeader } = useAuth()
  const { locale, dir } = useI18n()
  const router = useRouter()
  const ar = locale === 'ar'
  const { brand, brandContext } = useBrandBrain()

  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [insights, setInsights] = useState<SystemInsight[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [analysisType, setAnalysisType] = useState<AnalysisType>('performance')
  const [period, setPeriod] = useState<Period>('30d')
  const [industry, setIndustry] = useState('')
  const [industryTouched, setIndustryTouched] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [result, setResult] = useState('')

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

  useEffect(() => {
    if (industryTouched) return
    const mapped = mapBrandIndustryToAnalytics(brand?.industry)
    if (mapped) setIndustry(mapped)
  }, [brand, industryTouched])

  const analysisTabs = useMemo(() => ([
    { id: 'performance', label: ar ? 'الأداء' : 'Performance', icon: BarChart3 },
    { id: 'competitors', label: ar ? 'المنافسون' : 'Competitors', icon: Target },
    { id: 'trends', label: ar ? 'الاتجاهات' : 'Trends', icon: TrendingUp },
    { id: 'content', label: ar ? 'المحتوى' : 'Content', icon: Activity },
    { id: 'forecast', label: ar ? 'التوقع' : 'Forecast', icon: Zap },
  ] satisfies Array<{ id: AnalysisType; label: string; icon: LucideIcon }>), [ar])

  const creditDisplay = overview ? formatCreditDisplay({
    availableCredits: overview.creditsRemaining,
    monthlyCredits: overview.isUnlimited ? 0 : overview.monthlyTotal,
    locale: ar ? 'ar' : 'en',
  }) : null

  const dataQuality = overview?.publishedPosts
    ? ar ? 'تحتاج بيانات منصات فعلية' : 'Needs real platform data'
    : ar ? 'لا توجد بيانات أداء بعد' : 'No performance data yet'

  const sectorForPrompt = industry || brand?.industry || 'not specified'
  const systemPrompts: Record<AnalysisType, string> = {
    performance: `${brandContext}You are a careful marketing analyst. Analyze only available information. Period: ${period}. Sector: ${sectorForPrompt}. Do not invent platform metrics. Separate facts, assumptions, and next actions.`,
    competitors: `${brandContext}You are a competitor intelligence analyst. Sector: ${sectorForPrompt}. Provide practical competitor hypotheses and clearly mark what needs external validation. Do not claim live competitor data unless supplied.`,
    trends: `${brandContext}You are a market trends analyst. Sector: ${sectorForPrompt}. Give useful trend directions, but separate observed brand facts from general market assumptions.`,
    content: `${brandContext}You are a content performance analyst. Period: ${period}. Sector: ${sectorForPrompt}. Recommend content tests without claiming performance learning unless analytics data exists.`,
    forecast: `${brandContext}You are a forecasting analyst. Sector: ${sectorForPrompt}. Forecast scenarios with confidence levels and required data; do not guarantee outcomes.`,
  }

  const runAnalysis = async () => {
    if (!prompt.trim() || aiLoading) return
    setAiLoading(true)
    setResult('')
    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
        body: JSON.stringify({
          systemPrompt: systemPrompts[analysisType],
          userPrompt: prompt,
          maxTokens: 1400,
          language: locale,
        }),
      })
      if (!response.ok) throw new Error('AI analysis failed')
      const data = await response.json()
      setResult(data.content || data.result || '')
    } catch {
      setResult(ar ? 'تعذر تشغيل التحليل الآن. حاول مرة أخرى لاحقاً.' : 'Could not run analysis now. Try again later.')
    } finally {
      setAiLoading(false)
    }
  }

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
      <main dir={dir} className="min-h-screen bg-[#f6f8fc] text-[#071236]">
        <div className="mx-auto max-w-[1540px] px-6 py-7 lg:px-8">
          <header className="mb-6 flex flex-col gap-5 border-b border-[#dfe6f2] pb-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-[12px] font-bold text-[#64708f]">{ar ? 'قياس حقيقي قبل التعلم' : 'Real measurement before learning'}</p>
              <h1 className="mt-1 flex items-center gap-2 text-[32px] font-black tracking-[-0.03em] text-[#071236]">
                {ar ? 'التحليلات والأداء' : 'Analytics and performance'}
                <Sparkles className="text-[#5366f6]" size={24} />
              </h1>
              <p className="mt-2 max-w-3xl text-[14px] leading-7 text-[#64708f]">
                {ar
                  ? 'هذه الصفحة تعرض بيانات NEXUS الفعلية وما يصل من المنصات. لا يوجد تعلم أداء أو KPI حقيقي قبل وجود analyticsData أو مقاييس منصة موثوقة.'
                  : 'This page shows actual NEXUS data and connected platform metrics. No performance learning or true KPI exists before analyticsData or trusted platform metrics.'}
              </p>
            </div>
            <div className="flex gap-3">
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
          </header>

          <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard title={ar ? 'الحملات' : 'Campaigns'} value={overview?.campaigns ?? 0} helper={overview ? `${overview.activeCampaigns} ${ar ? 'نشطة' : 'active'} · ${overview.draftCampaigns} ${ar ? 'مسودة' : 'drafts'}` : dataQuality} icon={Megaphone} href="/campaigns" loading={dataLoading} />
            <MetricCard title={ar ? 'منشورات منشورة' : 'Published posts'} value={overview?.publishedPosts ?? 0} helper={ar ? 'لا يعني وجود بيانات أداء تلقائياً' : 'Does not imply analytics automatically'} icon={Send} href="/content-hub" loading={dataLoading} />
            <MetricCard title={ar ? 'توليدات AI' : 'AI generations'} value={overview?.generations ?? 0} helper={ar ? 'كل الوقت، من سجل NEXUS' : 'All-time, from NEXUS records'} icon={BrainCircuit} loading={dataLoading} />
            <MetricCard title={ar ? 'أصول بصرية' : 'Visual assets'} value={overview?.visualsCount ?? 0} helper={ar ? 'أصول مراجعة، ليست أداء' : 'Review assets, not performance'} icon={Eye} href="/media" loading={dataLoading} />
            <MetricCard title={ar ? 'الأرصدة' : 'Credits'} value={creditDisplay?.primary ?? '—'} helper={creditDisplay?.secondary || (ar ? 'رصيد متاح للتشغيل' : 'Available operating balance')} icon={CreditCard} href="/billing" loading={dataLoading} />
          </section>

          <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
            <div className="space-y-5">
              <div className="rounded-[24px] border border-[#e3e8f3] bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-[18px] font-black text-[#071236]">{ar ? 'نشاط NEXUS الشهري' : 'Monthly NEXUS activity'}</h2>
                    <p className="mt-1 text-[12px] font-bold text-[#64708f]">{ar ? 'يعرض التوليد واستهلاك الأرصدة، وليس أداء المنصات.' : 'Shows generation and credit usage, not platform performance.'}</p>
                  </div>
                  <Gauge className="h-5 w-5 text-[#5366f6]" />
                </div>
                <ActivityChart data={overview?.monthlyActivity ?? []} loading={dataLoading} emptyCopy={ar ? 'لا توجد نشاطات توليد بعد.' : 'No generation activity yet.'} />
              </div>

              <div className="rounded-[24px] border border-[#e3e8f3] bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-[18px] font-black text-[#071236]">{ar ? 'محرك التحليل الذكي' : 'AI analysis desk'}</h2>
                    <p className="mt-1 text-[12px] font-bold text-[#64708f]">
                      {ar ? 'اختياري وقد يستهلك رصيداً. التحليل يفرق بين الحقائق والافتراضات.' : 'Optional and may use credits. Analysis separates facts from assumptions.'}
                    </p>
                  </div>
                  <Wand2 className="h-5 w-5 text-[#5366f6]" />
                </div>

                <div className="mb-4 flex flex-wrap gap-2">
                  {analysisTabs.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setAnalysisType(id)
                        setResult('')
                      }}
                      className={`inline-flex h-10 items-center gap-2 rounded-[14px] px-4 text-[12px] font-black transition ${analysisType === id ? 'bg-[#5366f6] text-white' : 'border border-[#e3e8f3] bg-white text-[#64708f]'}`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>

                <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
                  <div className="space-y-3 rounded-[20px] border border-[#e8edf7] bg-[#fbfcff] p-4">
                    <label className="block text-[12px] font-black text-[#64708f]">{ar ? 'المجال' : 'Industry'}</label>
                    <select
                      value={industry}
                      onChange={(event) => {
                        setIndustry(event.target.value)
                        setIndustryTouched(true)
                      }}
                      className="h-11 w-full rounded-[14px] border border-[#dfe6f2] bg-white px-3 text-[13px] font-bold text-[#111b3f] outline-none"
                    >
                      <option value="">{ar ? 'غير محدد' : 'Not specified'}</option>
                      <option value="ecommerce">{ar ? 'تجارة إلكترونية' : 'E-commerce'}</option>
                      <option value="food">{ar ? 'مطاعم وأغذية' : 'Food and restaurants'}</option>
                      <option value="fashion">{ar ? 'أزياء وفخامة' : 'Fashion and luxury'}</option>
                      <option value="tech">{ar ? 'تقنية و SaaS' : 'Tech and SaaS'}</option>
                      <option value="health">{ar ? 'صحة وعيادات' : 'Health and clinics'}</option>
                      <option value="realestate">{ar ? 'عقارات' : 'Real estate'}</option>
                      <option value="education">{ar ? 'تعليم' : 'Education'}</option>
                      <option value="services">{ar ? 'خدمات' : 'Services'}</option>
                    </select>
                    <label className="block text-[12px] font-black text-[#64708f]">{ar ? 'الفترة' : 'Period'}</label>
                    <select
                      value={period}
                      onChange={(event) => setPeriod(event.target.value as Period)}
                      className="h-11 w-full rounded-[14px] border border-[#dfe6f2] bg-white px-3 text-[13px] font-bold text-[#111b3f] outline-none"
                    >
                      <option value="7d">{ar ? 'آخر 7 أيام' : 'Last 7 days'}</option>
                      <option value="30d">{ar ? 'آخر 30 يوم' : 'Last 30 days'}</option>
                      <option value="90d">{ar ? 'آخر 90 يوم' : 'Last 90 days'}</option>
                      <option value="6m">{ar ? 'آخر 6 أشهر' : 'Last 6 months'}</option>
                      <option value="1y">{ar ? 'آخر سنة' : 'Last year'}</option>
                    </select>
                    <p className="rounded-[14px] bg-white px-3 py-2 text-[11px] font-bold leading-5 text-[#64708f]">
                      {ar ? 'إذا لم تكن بيانات الأداء موجودة، سيعطي NEXUS فرضيات عمل لا نتائج مؤكدة.' : 'If performance data is missing, NEXUS gives working hypotheses, not confirmed outcomes.'}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <textarea
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                      rows={5}
                      placeholder={ar ? 'اكتب سؤالاً تحليلياً واضحاً عن الحملة أو السوق...' : 'Ask a clear analytical question about the campaign or market...'}
                      className="w-full resize-none rounded-[20px] border border-[#dfe6f2] bg-[#fbfcff] p-4 text-[14px] font-semibold leading-7 text-[#111b3f] outline-none focus:border-[#5366f6]"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="inline-flex items-center gap-2 text-[12px] font-bold text-[#8a96ad]">
                        <Info className="h-4 w-4" />
                        {ar ? 'لا يتم حفظ التحليل كتعلم أداء بدون analyticsData.' : 'Analysis is not saved as performance learning without analyticsData.'}
                      </p>
                      <button
                        type="button"
                        onClick={runAnalysis}
                        disabled={!prompt.trim() || aiLoading}
                        className="inline-flex h-11 items-center gap-2 rounded-[15px] bg-[#071236] px-5 text-[13px] font-black text-white shadow-[0_18px_38px_rgba(7,18,54,0.2)] disabled:cursor-not-allowed disabled:bg-[#c4ccdc]"
                      >
                        {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                        {aiLoading ? (ar ? 'جاري التحليل...' : 'Analyzing...') : (ar ? 'حلّل بذكاء' : 'Analyze with AI')}
                      </button>
                    </div>

                    {result ? (
                      <div className="rounded-[20px] border border-[#dfe6f2] bg-[#fbfcff] p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="text-[13px] font-black text-[#071236]">{ar ? 'نتيجة التحليل' : 'Analysis result'}</h3>
                          <CopyButton text={result} copyLabel={ar ? 'نسخ' : 'Copy'} copiedLabel={ar ? 'تم النسخ' : 'Copied'} />
                        </div>
                        <pre className="max-h-[420px] whitespace-pre-wrap font-sans text-[13px] leading-7 text-[#3d4a66]">{result}</pre>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <aside className="space-y-5">
              <div className="rounded-[24px] border border-[#e3e8f3] bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-[16px] font-black text-[#071236]">{ar ? 'حالة الثقة في البيانات' : 'Data confidence'}</h2>
                  <ShieldCheck className="h-5 w-5 text-[#5366f6]" />
                </div>
                {[
                  [ar ? 'بيانات NEXUS الداخلية' : 'NEXUS internal records', ar ? 'متاحة' : 'Available', true],
                  [ar ? 'بيانات منصات منشورة' : 'Published platform metrics', overview?.publishedPosts ? (ar ? 'بانتظار القياس' : 'Waiting') : (ar ? 'غير موجودة بعد' : 'Not available yet'), false],
                  [ar ? 'تعلم الأداء' : 'Performance learning', ar ? 'مشروط بالتحليلات' : 'Analytics-gated', false],
                ].map(([label, value, ok]) => (
                  <div key={label as string} className="flex items-center justify-between border-b border-[#eef2f8] py-3 last:border-b-0">
                    <span className="text-[12px] font-bold text-[#64708f]">{label}</span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{value}</span>
                  </div>
                ))}
              </div>

              <div className="rounded-[24px] border border-[#e3e8f3] bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
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

              <div className="rounded-[24px] border border-[#e3e8f3] bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
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
