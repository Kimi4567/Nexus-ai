'use client'

import AppShell from '@/components/AppShell'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { mapBrandIndustryToAnalytics } from '@/lib/analyticsIndustry'
import Link from 'next/link'
import {
  Loader2, BarChart2, Wand2, Sparkles, TrendingUp,
  Copy, Check, ChevronDown, Zap, Target,
  Activity, ArrowUpRight, Megaphone, Image, Send,
  BrainCircuit, RefreshCw
} from 'lucide-react'
import { useBrandBrain } from '@/hooks/useBrandBrain'
import { formatCreditDisplay } from '@/lib/creditDisplay'

/* ═══════════════════════════════════════════════════════════════
   PULSE — Analytics & Market Intelligence
   Real campaign data + AI-powered analysis engine
   ═══════════════════════════════════════════════════════════════ */

type AnalysisType = 'performance' | 'competitors' | 'trends' | 'content' | 'forecast'
type Period = '7d' | '30d' | '90d' | '6m' | '1y'

interface InsightResult {
  id: string
  type: AnalysisType
  query: string
  output: string
  createdAt: Date
}

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

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const { t } = useI18n()
  const handle = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  return (
    <button onClick={handle}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
      style={{ background: copied ? '#ECFDF5' : '#F8FAFC', color: copied ? '#059669' : '#475569', border: `1px solid ${copied ? '#BBF7D0' : '#E2E8F0'}` }}>
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? t('common.copied') : t('common.copy')}
    </button>
  )
}

function PulseSelect<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-slate-500">{label}</label>
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value as T)}
          className="w-full appearance-none px-3 py-2.5 rounded-xl text-sm pr-8"
          style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.1)', color: '#0F172A', outline: 'none' }}>
          {options.map(o => <option key={o.value} value={o.value} style={{ background: '#FFFFFF' }}>{o.label}</option>)}
        </select>
        <ChevronDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>
    </div>
  )
}

// ── Real metric card ─────────────────────────────────────────────────────────
function MetricCard({
  icon: Icon, label, value, sub, color, href, loading
}: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  color: string
  href?: string
  loading?: boolean
}) {
  const inner = (
    <div className="rounded-2xl p-4 h-full transition-all hover:-translate-y-0.5"
      style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
          <Icon size={16} style={{ color }} />
        </div>
        {href && <ArrowUpRight size={12} className="text-slate-300" />}
      </div>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      {loading
        ? <div className="h-6 w-16 rounded animate-pulse bg-slate-100" />
        : <p className="text-2xl font-semibold text-slate-950">{value}</p>
      }
      {sub && !loading && <p className="text-xs mt-1" style={{ color: `${color}aa` }}>{sub}</p>}
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

// ── Real bar chart ─────────────────────────────────────────────────────────
function ActivityChart({ data, loading }: { data: MonthActivity[]; loading: boolean }) {
  const { locale } = useI18n()
  const ar = locale === 'ar'

  if (loading) {
    return (
      <div className="flex items-end gap-2 h-24">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex-1 rounded-sm animate-pulse"
            style={{ height: `${40 + Math.random() * 60}%`, background: '#E2E8F0' }} />
        ))}
      </div>
    )
  }

  const maxVal = Math.max(...data.map(d => d.generations), 1)
  const hasData = data.some(d => d.generations > 0)

  return (
    <div>
      <div className="flex items-end gap-2 h-24">
        {data.map((d, i) => {
          const pct = hasData ? Math.max((d.generations / maxVal) * 100, d.generations > 0 ? 8 : 3) : 3
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full rounded-sm transition-all duration-700 group relative"
                style={{
                  height: `${pct}%`,
                  background: d.generations > 0 ? '#0EA5E9' : '#E2E8F0',
                  border: d.generations > 0 ? '1px solid rgba(14,165,233,0.25)' : '1px solid rgba(148,163,184,0.22)',
                  minHeight: 4,
                }}>
                {d.generations > 0 && (
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                    {d.generations} gen
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {/* Month labels */}
      <div className="flex gap-2 mt-2">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[10px] text-slate-400">{d.label}</div>
        ))}
      </div>
      {!hasData && (
        <p className="text-xs text-slate-400 mt-1 text-center">
          {ar ? 'لا توجد نشاطات بعد — قم بإنشاء حملتك الأولى' : 'No activity yet — create your first campaign'}
        </p>
      )}
    </div>
  )
}

// ── Credit bar ──────────────────────────────────────────────────────────────
function CreditBar({ used, total, isUnlimited }: { used: number; total: number; isUnlimited: boolean }) {
  const pct = isUnlimited ? 50 : total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
  const low = !isUnlimited && pct > 80
  const color = isUnlimited ? '#10B981' : low ? '#f59e0b' : '#10B981'
  return (
    <div className="mt-2">
      <div className="w-full h-1.5 rounded-full overflow-hidden bg-slate-100">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

// ── Insight badge ────────────────────────────────────────────────────────────
const INSIGHT_COLORS = {
  action:  { bg: '#F5F3FF', border: '#DDD6FE', text: '#6D28D9' },
  info:    { bg: '#ECFEFF', border: '#A5F3FC', text: '#0E7490' },
  warning: { bg: '#FFFBEB', border: '#FDE68A', text: '#B45309' },
  success: { bg: '#ECFDF5', border: '#BBF7D0', text: '#047857' },
}

export default function PulsePage() {
  const { isAuthenticated, loading: authLoading, authHeader } = useAuth()
  const { locale, dir, t } = useI18n()
  const router = useRouter()
  const ar = locale === 'ar'

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/login')
  }, [authLoading, isAuthenticated, router])

  const { brand, brandContext } = useBrandBrain()

  // ── AI Analysis state ────────────────────────────────────────────────────
  const [analysisType, setAnalysisType] = useState<AnalysisType>('performance')
  const [period, setPeriod] = useState<Period>('30d')
  // PR-1L: never default to a guessed sector. Start unset; derive from the real
  // Brand Brain industry once it loads (unless the user picks one manually).
  const [industry, setIndustry] = useState('')
  const [industryTouched, setIndustryTouched] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [result, setResult] = useState('')
  const [history, setHistory] = useState<InsightResult[]>([])

  // ── Real data state ──────────────────────────────────────────────────────
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [insights, setInsights] = useState<SystemInsight[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated) return
    const hdr = authHeader()

    Promise.all([
      fetch('/api/analytics/overview', { headers: { Authorization: hdr } }).then(r => r.json()).catch(() => null),
      fetch('/api/analytics/insights',  { headers: { Authorization: hdr } }).then(r => r.json()).catch(() => ({ insights: [] })),
    ]).then(([ov, ins]) => {
      if (ov && !ov.error) setOverview(ov)
      if (ins?.insights) setInsights(ins.insights)
    }).catch(() => {
      // never leave skeletons stuck — swallow any unexpected throws
    }).finally(() => {
      setDataLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  // PR-1L: seed the sector from the real Brand Brain industry (truthful default).
  // If the brand has no/unknown industry, stays '' (unset) — never "E-commerce".
  useEffect(() => {
    if (industryTouched) return
    const mapped = mapBrandIndustryToAnalytics(brand?.industry)
    if (mapped) setIndustry(mapped)
  }, [brand, industryTouched])

  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
      <Loader2 className="animate-spin" size={32} style={{ color: '#0EA5E9' }} />
    </div>
  )
  if (!isAuthenticated) return null

  const analysisTabs: { id: AnalysisType; labelKey: string; icon: React.ElementType }[] = [
    { id: 'performance',  labelKey: 'analytics.tabPerformance', icon: BarChart2 },
    { id: 'competitors',  labelKey: 'analytics.tabCompetitors', icon: Target },
    { id: 'trends',       labelKey: 'analytics.tabTrends',      icon: TrendingUp },
    { id: 'content',      labelKey: 'analytics.tabContent',     icon: Activity },
    { id: 'forecast',     labelKey: 'analytics.tabForecast',    icon: Zap },
  ]

  // PR-1L: pass a truthful sector to the analyst — the selected sector, else the
  // real brand industry, else "not specified". Never a hardcoded "ecommerce".
  const sectorForPrompt = industry || brand?.industry || 'not specified'
  const systemPrompts: Record<AnalysisType, string> = {
    performance: `${brandContext}You are PULSE, an expert marketing analyst. Period: ${period}. Sector: ${sectorForPrompt}. Analyze the brand's campaign performance and provide: key KPIs, strengths, weaknesses, and specific actionable recommendations.`,
    competitors:  `${brandContext}You are PULSE, a competitor intelligence expert. Sector: ${sectorForPrompt}. Provide a competitor analysis for the brand above: who their real competitors are, their strengths and weaknesses, and differentiation opportunities.`,
    trends:       `${brandContext}You are PULSE, a market trends analyst. Sector: ${sectorForPrompt}. Reveal the most relevant trends for the brand above: content trends, ad formats, audience behavior, and upcoming seasonal opportunities.`,
    content:      `${brandContext}You are PULSE, a content performance analyst. Sector: ${sectorForPrompt}. Period: ${period}. Analyze the optimal content strategy for this brand: best posting times, content types, effective hashtags, and platform-specific tactics.`,
    forecast:     `${brandContext}You are PULSE, a marketing forecasting specialist. Sector: ${sectorForPrompt}. Based on the brand data above, forecast performance for the next 3 months and provide a proactive action plan.`,
  }

  async function generate() {
    if (!prompt.trim() || aiLoading) return
    setAiLoading(true)
    setResult('')
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
        body: JSON.stringify({ systemPrompt: systemPrompts[analysisType], userPrompt: prompt, maxTokens: 1400, language: locale }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      const output = data.content || data.result || ''
      setResult(output)
      setHistory(prev => [{ id: crypto.randomUUID(), type: analysisType, query: prompt, output, createdAt: new Date() }, ...prev.slice(0, 9)])
    } catch {
      setResult(t('analytics.errorConnect') as string)
    } finally {
      setAiLoading(false)
    }
  }

  const glassCard = { background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }
  const pulseColor = '#0EA5E9'

  // Derived label for plan credits display
  const creditLabel = overview?.isUnlimited
    ? (ar ? 'غير محدود' : 'Unlimited')
    : overview
      ? `${overview.creditsRemaining} ${ar ? 'متبقي' : 'left'}`
      : '—'

  // PR-1H: "used this month" is real ledger spend and can legitimately exceed the
  // monthly grant when the user has rollover/bonus credits. Never frame it as
  // "159 / 150" (reads like an error). Show it as a standalone "used this month"
  // figure; the monthly quota + over-grant explanation live in the detail row below.
  const creditSub = overview
    ? `${overview.creditsUsedThisMonth} ${ar ? 'مستخدم هذا الشهر' : 'used this month'}`
    : ''

  return (
    <AppShell>
      <div className="min-h-screen bg-[#f5f5f7]" dir={dir}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

          {/* ── Header ────────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: '#E0F2FE', border: '1px solid rgba(14,165,233,0.18)' }}>
                  <BarChart2 size={26} style={{ color: pulseColor }} />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-semibold text-slate-950">PULSE</h1>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ background: '#ECFEFF', color: '#0E7490', border: '1px solid #A5F3FC' }}>
                    {t('analytics.badge')}
                  </span>
                </div>
                <p className="text-slate-500 text-sm mt-0.5">{t('analytics.subheading')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
              style={{ background: '#ECFDF5', border: '1px solid #BBF7D0', color: '#047857' }}>
              <Sparkles size={12} />
              <span>{t('analytics.gptActive')}</span>
            </div>
          </div>

          {/* ── Real Metric Cards ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard
              icon={Megaphone}
              label={ar ? 'إجمالي الحملات' : 'Total Campaigns'}
              value={dataLoading ? '—' : (overview?.campaigns ?? 0)}
              sub={overview && !dataLoading ? `${overview.activeCampaigns} ${ar ? 'نشطة' : 'active'}` : undefined}
              color={pulseColor}
              href="/campaigns"
              loading={dataLoading}
            />
            <MetricCard
              icon={Send}
              label={ar ? 'منشورات منشورة' : 'Published Posts'}
              value={dataLoading ? '—' : (overview?.publishedPosts ?? 0)}
              sub={overview && !dataLoading && overview.publishedPosts > 0 ? (ar ? 'عبر السوشيال' : 'via social') : undefined}
              color="#10B981"
              href="/connections"
              loading={dataLoading}
            />
            <MetricCard
              icon={BrainCircuit}
              label={ar ? 'المسودات المُولّدة' : 'Drafts generated'}
              value={dataLoading ? '—' : (overview?.generations ?? 0)}
              sub={overview && !dataLoading ? (ar ? 'إجمالي الحملات' : 'across all campaigns') : undefined}
              color="#06b6d4"
              href="/campaigns"
              loading={dataLoading}
            />
            <MetricCard
              icon={Zap}
              label={ar ? 'الأرصدة' : 'AI Credits'}
              value={dataLoading ? '—' : creditLabel}
              sub={creditSub || undefined}
              color={overview && !overview.isUnlimited && overview.creditsRemaining < 5 ? '#f59e0b' : '#10B981'}
              href="/billing"
              loading={dataLoading}
            />
          </div>

          {/* ── Activity Chart + System Insights ─────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Chart */}
            <div className="lg:col-span-2 rounded-2xl p-5" style={glassCard}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity size={16} style={{ color: pulseColor }} />
                  <span className="text-sm font-semibold text-slate-800">
                    {ar ? 'نشاط توليد AI الشهري' : 'Monthly AI Activity'}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <RefreshCw size={11} />
                  <span>{ar ? 'آخر 6 أشهر' : 'Last 6 months'}</span>
                </div>
              </div>
              <ActivityChart
                data={overview?.monthlyActivity ?? []}
                loading={dataLoading}
              />
              {overview && !dataLoading && (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-500">
                      {ar
                        ? `${overview.creditsUsedThisMonth} رصيد مستخدم هذا الشهر`
                        : `${overview.creditsUsedThisMonth} credits used this month`}
                    </div>
                    {!overview.isUnlimited && (
                      <div className="flex-1 max-w-32 mx-4">
                        <CreditBar
                          used={overview.creditsUsedThisMonth}
                          total={overview.monthlyTotal}
                          isUnlimited={false}
                        />
                      </div>
                    )}
                    <Link href="/billing"
                      className="text-xs font-semibold transition-all hover:brightness-125"
                      style={{ color: pulseColor }}>
                      {ar ? 'ترقية ←' : 'Upgrade →'}
                    </Link>
                  </div>
                  {/* PR-1H: clarify the four distinct numbers — remaining, used this
                      month, monthly quota — and explain over-grant balances instead
                      of presenting them as a contradiction. */}
                  {!overview.isUnlimited && (() => {
                    const disp = formatCreditDisplay({
                      availableCredits: overview.creditsRemaining,
                      monthlyCredits: overview.monthlyTotal,
                      locale: ar ? 'ar' : 'en',
                    })
                    return (
                      <p className="text-[11px] text-slate-400 leading-snug">
                        {ar
                          ? `${overview.creditsRemaining} متبقي · حصة الخطة ${overview.monthlyTotal} رصيد/شهر`
                          : `${overview.creditsRemaining} remaining · plan quota ${overview.monthlyTotal} credits/month`}
                        {disp.secondary ? ` — ${disp.secondary}` : ''}
                      </p>
                    )
                  })()}
                </div>
              )}
            </div>

            {/* System Insights */}
            <div className="rounded-2xl p-5 flex flex-col" style={glassCard}>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={14} style={{ color: pulseColor }} />
                <span className="text-sm font-semibold text-slate-800">
                  {ar ? 'رؤى النظام' : 'System Insights'}
                </span>
              </div>
              {dataLoading ? (
                <div className="space-y-3 flex-1">
                  {[1,2,3].map(i => (
                    <div key={i} className="h-12 rounded-xl animate-pulse bg-slate-100" />
                  ))}
                </div>
              ) : insights.length > 0 ? (
                <div className="space-y-2 flex-1">
                  {insights.map(ins => {
                    const c = INSIGHT_COLORS[ins.type]
                    const inner = (
                      <div className="flex items-start gap-2.5 p-3 rounded-xl transition-all hover:brightness-110"
                        style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                        <span className="text-base flex-shrink-0">{ins.icon}</span>
                        <p className="text-xs leading-relaxed" style={{ color: c.text }}>{ins.message}</p>
                      </div>
                    )
                    return ins.href ? <Link key={ins.id} href={ins.href}>{inner}</Link> : <div key={ins.id}>{inner}</div>
                  })}
                </div>
              ) : (overview?.publishedPosts ?? 0) > 0 ? (
                // Posts are live but engagement data hasn't arrived yet — be honest, no fake numbers.
                <div className="flex-1 flex flex-col items-center justify-center text-center px-4 gap-1.5">
                  <span className="text-base">⏳</span>
                  <p className="text-xs font-medium text-slate-500">
                    {ar ? 'بانتظار بيانات الأداء' : 'Waiting for performance data'}
                  </p>
                  <p className="text-[11px] text-slate-400 leading-relaxed max-w-[240px]">
                    {ar
                      ? 'منشوراتك منشورة. بمجرد أن تجمع تفاعلاً، سيتعلم Brand Brain من النتائج تلقائياً ويحسّن حملتك التالية.'
                      : 'Your posts are published. Once they gather engagement, your Brand Brain learns from the results automatically and improves your next campaign.'}
                  </p>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-xs text-slate-400 text-center">
                    {ar ? 'لا توجد رؤى بعد' : 'No insights yet'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Top Campaigns ─────────────────────────────────────────────── */}
          {!dataLoading && overview && overview.topCampaigns.length > 0 && (
            <div className="rounded-2xl p-5" style={glassCard}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Megaphone size={14} style={{ color: pulseColor }} />
                  <span className="text-sm font-semibold text-slate-800">
                    {ar ? 'الحملات الأخيرة' : 'Recent Campaigns'}
                  </span>
                </div>
                <Link href="/campaigns"
                  className="text-xs font-semibold transition-all hover:brightness-125"
                  style={{ color: pulseColor }}>
                  {ar ? 'عرض الكل ←' : 'View all →'}
                </Link>
              </div>
              <div className="space-y-2">
                {overview.topCampaigns.map(c => {
                  const statusColor = c.status === 'ACTIVE' ? '#10B981' : c.status === 'DRAFT' ? '#f59e0b' : '#6b7280'
                  const hoursAgo = Math.floor((Date.now() - new Date(c.updatedAt).getTime()) / 3600000)
                  const timeLabel = hoursAgo < 1 ? (ar ? 'الآن' : 'now')
                    : hoursAgo < 24 ? `${hoursAgo}h`
                    : `${Math.floor(hoursAgo / 24)}d`
                  return (
                    <Link key={c.id} href={`/campaigns/${c.id}`}
                      className="flex items-center justify-between p-3 rounded-xl transition-all hover:bg-white/[0.03]"
                      style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: statusColor }} />
                        <span className="text-sm text-slate-700 truncate">{c.name}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs text-slate-400">{c._count.generations} gen</span>
                        <span className="text-xs text-slate-400">{timeLabel}</span>
                        <ArrowUpRight size={12} className="text-slate-300" />
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── AI Analysis Engine ─────────────────────────────────────────── */}
          <div className="rounded-2xl p-1 overflow-hidden"
            style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
            <div className="rounded-xl p-5 bg-white">

              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: '#E0F2FE', border: '1px solid rgba(14,165,233,0.18)' }}>
                  <BrainCircuit size={16} style={{ color: pulseColor }} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-950">{ar ? 'محرك التحليل الذكي' : 'AI Analysis Engine'}</h2>
                  <p className="text-xs text-slate-500">{ar ? 'رؤى مخصصة لعلامتك التجارية' : 'Custom insights for your brand'}</p>
                </div>
              </div>

              {/* Analysis tabs */}
              <div className="flex flex-wrap gap-2 mb-5">
                {analysisTabs.map(tab => (
                  <button key={tab.id} onClick={() => { setAnalysisType(tab.id); setResult('') }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                    style={{
                      background: analysisType === tab.id ? '#E0F2FE' : '#F8FAFC',
                      color: analysisType === tab.id ? '#0369A1' : '#64748B',
                      border: `1px solid ${analysisType === tab.id ? 'rgba(14,165,233,0.25)' : 'rgba(15,23,42,0.08)'}`,
                    }}>
                    <tab.icon size={15} />
                    <span>{t(tab.labelKey)}</span>
                  </button>
                ))}
              </div>

              {/* Main grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Config */}
                <div className="lg:col-span-1 space-y-4">
                  <div className="rounded-xl p-4 space-y-4 bg-slate-50 border border-slate-200">
                    <PulseSelect
                      label={t('analytics.industryLabel') as string}
                      value={industry}
                      onChange={(v: string) => { setIndustry(v); setIndustryTouched(true) }}
                      options={[
                        { value: '',           label: ar ? 'لم يتم تحديد المجال' : 'Industry not set' },
                        { value: 'ecommerce',  label: t('analytics.industryEcommerce') as string },
                        { value: 'food',       label: t('analytics.industryFood') as string },
                        { value: 'fashion',    label: t('analytics.industryFashion') as string },
                        { value: 'tech',       label: t('analytics.industryTech') as string },
                        { value: 'health',     label: t('analytics.industryHealth') as string },
                        { value: 'realestate', label: t('analytics.industryRealEstate') as string },
                        { value: 'education',  label: t('analytics.industryEducation') as string },
                        { value: 'services',   label: t('analytics.industryServices') as string },
                      ]} />
                    {/* PR-1L: honest unset state — never imply an industry we can't prove. */}
                    {industry === '' && (
                      <p className="text-[11px] text-slate-400 leading-snug -mt-2">
                        {ar
                          ? 'أضفه في ذاكرة العلامة التجارية لتحسين التحليلات.'
                          : 'Add it in Brand Brain for sharper analytics.'}
                      </p>
                    )}
                    <PulseSelect<Period>
                      label={t('analytics.periodLabel') as string}
                      value={period}
                      onChange={setPeriod}
                      options={[
                        { value: '7d',  label: t('analytics.period7d') as string },
                        { value: '30d', label: t('analytics.period30d') as string },
                        { value: '90d', label: t('analytics.period90d') as string },
                        { value: '6m',  label: t('analytics.period6m') as string },
                        { value: '1y',  label: t('analytics.period1y') as string },
                      ]} />
                  </div>

                  {/* Quick queries */}
                  <div className="rounded-xl p-4 bg-slate-50 border border-slate-200">
                    <h3 className="text-xs font-semibold text-slate-500 mb-3">{t('analytics.quickQuestions')}</h3>
                    <div className="space-y-2">
                      {(ar ? [
                        'ما هي أفضل أوقات النشر على Instagram؟',
                        'كيف أحسّن معدل التحويل في إعلاناتي؟',
                        'ما الاتجاهات السائدة في قطاعي هذا الشهر؟',
                        'كيف تقارن حملتي بالمعايير المعتادة في السوق؟',
                      ] : [
                        'What are the best times to post on Instagram?',
                        'How do I improve my ad conversion rate?',
                        'What are the top trends in my industry this month?',
                        'How does my campaign compare to market benchmarks?',
                      ]).map((q, i) => (
                        <button key={i} onClick={() => setPrompt(q)}
                          className={`w-full text-xs px-3 py-2 rounded-lg transition-all hover:text-blue-700 ${ar ? 'text-right' : 'text-left'}`}
                          style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.08)', color: '#475569' }}>
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Query + Output */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="rounded-xl p-5 space-y-4 bg-slate-50 border border-slate-200">
                    <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      {(() => {
                        const tab = analysisTabs.find(tab => tab.id === analysisType)!
                        return <><tab.icon size={14} style={{ color: pulseColor }} />{t(tab.labelKey)}</>
                      })()}
                    </h3>
                    <textarea
                      value={prompt}
                      onChange={e => setPrompt(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) generate() }}
                      placeholder={t('analytics.promptPlaceholder') as string}
                      rows={4}
                      className="w-full resize-none text-sm rounded-xl p-4 focus:outline-none"
                      style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.1)', color: '#0F172A' }} />
                    <div className="flex justify-end">
                      <button onClick={generate} disabled={!prompt.trim() || aiLoading}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all"
                        style={{
                          background: prompt.trim() && !aiLoading ? '#0071E3' : '#E2E8F0',
                          color: prompt.trim() && !aiLoading ? '#fff' : '#64748B',
                          boxShadow: prompt.trim() && !aiLoading ? '0 10px 24px rgba(0,113,227,0.18)' : 'none',
                        }}>
                        {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                        {aiLoading ? t('analytics.analyzing') : t('analytics.analyzeNow')}
                      </button>
                    </div>
                  </div>

                  {(result || aiLoading) && (
                    <div className="rounded-xl p-5 space-y-4"
                      style={{ background: '#F8FAFC', border: '1px solid rgba(14,165,233,0.18)' }}>
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: pulseColor }}>
                          <Sparkles size={14} />{t('analytics.insightTitle')}
                        </h3>
                        {result && !aiLoading && <CopyBtn text={result} />}
                      </div>
                      {aiLoading ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-4">
                          <div className="w-12 h-12 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(16,185,129,0.3)', borderTopColor: pulseColor }} />
                          <p className="text-sm text-slate-500 animate-pulse">{t('analytics.processing')}</p>
                        </div>
                      ) : (
                        <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans"
                          style={{ color: '#334155', maxHeight: '500px', overflowY: 'auto' }}>
                          {result}
                        </pre>
                      )}
                    </div>
                  )}

                  {!result && !aiLoading && (
                    <div className="rounded-xl p-8 flex flex-col items-center gap-4"
                      style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.08)' }}>
                      <Image size={28} style={{ color: 'rgba(16,185,129,0.3)' }} />
                      <div className="text-center">
                        <p className="text-slate-500 text-sm">{t('analytics.emptyTitle')}</p>
                        <p className="text-slate-400 text-xs mt-1">{t('analytics.emptySub')}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* History */}
              {history.length > 0 && (
                <div className="mt-5 pt-5 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-slate-500">{t('analytics.historyTitle')}</h3>
                    <button onClick={() => setHistory([])} className="text-xs text-slate-400 hover:text-red-600 transition-colors">{t('analytics.clearAll')}</button>
                  </div>
                  <div className="space-y-1">
                    {history.map(h => (
                      <div key={h.id} onClick={() => { setResult(h.output); setAnalysisType(h.type) }}
                        className="flex items-center justify-between p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 transition-all"
                        style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: 'rgba(16,185,129,0.1)', color: pulseColor, border: `1px solid rgba(16,185,129,0.2)` }}>
                            {t(analysisTabs.find(tab => tab.id === h.type)?.labelKey ?? '')}
                          </span>
                          <span className="text-xs text-slate-500 truncate">{h.query}</span>
                        </div>
                        <span className="text-xs text-slate-400 flex-shrink-0">{h.createdAt.toLocaleTimeString(ar ? 'ar' : 'en', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </AppShell>
  )
}
