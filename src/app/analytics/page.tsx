'use client'

import AppShell from '@/components/AppShell'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import Link from 'next/link'
import {
  Loader2, BarChart2, Wand2, Sparkles, TrendingUp,
  Copy, Check, ChevronDown, Zap, Target,
  Activity, ArrowUpRight, Megaphone, Image, Send,
  BrainCircuit, RefreshCw
} from 'lucide-react'
import StarField from '@/components/ui/StarField'
import { useBrandBrain } from '@/hooks/useBrandBrain'

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

function PulseOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      <div className="absolute rounded-full blur-[160px] opacity-15"
        style={{ width: 700, height: 700, background: 'radial-gradient(circle, rgba(139,92,246,0.18), transparent 70%)', top: '-15%', left: '-10%', animation: 'float 18s ease-in-out infinite' }} />
      <div className="absolute rounded-full blur-[100px] opacity-12"
        style={{ width: 500, height: 500, background: 'radial-gradient(circle, rgba(6,182,212,0.1), transparent 70%)', bottom: '5%', right: '-10%', animation: 'float 13s ease-in-out infinite reverse' }} />
    </div>
  )
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const { t } = useI18n()
  const handle = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  return (
    <button onClick={handle}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
      style={{ background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)', color: copied ? '#10b981' : '#9ca3af', border: `1px solid ${copied ? '#10b98130' : 'rgba(255,255,255,0.08)'}` }}>
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
      <label className="text-xs text-gray-500">{label}</label>
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value as T)}
          className="w-full appearance-none px-3 py-2.5 rounded-xl text-sm pr-8"
          style={{ background: 'rgba(17,21,54,0.4)', border: '1px solid rgba(108,99,255,0.12)', color: '#f8fafc', outline: 'none' }}>
          {options.map(o => <option key={o.value} value={o.value} style={{ background: '#111536' }}>{o.label}</option>)}
        </select>
        <ChevronDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
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
    <div className="rounded-xl p-4 h-full transition-all hover:brightness-110"
      style={{ background: 'rgba(17,21,54,0.5)', border: `1px solid rgba(255,255,255,0.06)` }}>
      <div className="flex items-center justify-between mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
          <Icon size={16} style={{ color }} />
        </div>
        {href && <ArrowUpRight size={12} style={{ color: 'rgba(255,255,255,0.2)' }} />}
      </div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      {loading
        ? <div className="h-6 w-16 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
        : <p className="text-2xl font-bold text-white">{value}</p>
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
            style={{ height: `${40 + Math.random() * 60}%`, background: 'rgba(255,255,255,0.04)' }} />
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
                  background: d.generations > 0 ? 'rgba(139,92,246,0.35)' : 'rgba(255,255,255,0.04)',
                  border: d.generations > 0 ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(255,255,255,0.05)',
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
          <div key={i} className="flex-1 text-center text-[10px] text-gray-600">{d.label}</div>
        ))}
      </div>
      {!hasData && (
        <p className="text-xs text-gray-600 mt-1 text-center">
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
  const color = isUnlimited ? '#00BFA6' : low ? '#f59e0b' : '#6C63FF'
  return (
    <div className="mt-2">
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

// ── Insight badge ────────────────────────────────────────────────────────────
const INSIGHT_COLORS = {
  action:  { bg: 'rgba(108,99,255,0.08)', border: 'rgba(108,99,255,0.2)',  text: '#a5a0ff' },
  info:    { bg: 'rgba(6,182,212,0.06)',  border: 'rgba(6,182,212,0.15)',  text: '#22d3ee' },
  warning: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', text: '#fbbf24' },
  success: { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', text: '#34d399' },
}

export default function PulsePage() {
  const { isAuthenticated, loading: authLoading, authHeader } = useAuth()
  const { locale, dir, t } = useI18n()
  const router = useRouter()
  const ar = locale === 'ar'

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/login')
  }, [authLoading, isAuthenticated, router])

  const { brandContext } = useBrandBrain()

  // ── AI Analysis state ────────────────────────────────────────────────────
  const [analysisType, setAnalysisType] = useState<AnalysisType>('performance')
  const [period, setPeriod] = useState<Period>('30d')
  const [industry, setIndustry] = useState('ecommerce')
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
      setDataLoading(false)
    })
  }, [isAuthenticated, authHeader])

  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0A0E27' }}>
      <Loader2 className="animate-spin" size={32} style={{ color: '#8b5cf6' }} />
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

  const systemPrompts: Record<AnalysisType, string> = {
    performance: `${brandContext}You are PULSE, an expert marketing analyst. Period: ${period}. Sector: ${industry}. Analyze the brand's campaign performance and provide: key KPIs, strengths, weaknesses, and specific actionable recommendations.`,
    competitors:  `${brandContext}You are PULSE, a competitor intelligence expert. Sector: ${industry}. Provide a competitor analysis for the brand above: who their real competitors are, their strengths and weaknesses, and differentiation opportunities.`,
    trends:       `${brandContext}You are PULSE, a market trends analyst. Sector: ${industry}. Reveal the most relevant trends for the brand above: content trends, ad formats, audience behavior, and upcoming seasonal opportunities.`,
    content:      `${brandContext}You are PULSE, a content performance analyst. Sector: ${industry}. Period: ${period}. Analyze the optimal content strategy for this brand: best posting times, content types, effective hashtags, and platform-specific tactics.`,
    forecast:     `${brandContext}You are PULSE, a marketing forecasting specialist. Sector: ${industry}. Based on the brand data above, forecast performance for the next 3 months and provide a proactive action plan.`,
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

  const glassCard = { background: 'rgba(17,21,54,0.5)', border: '1px solid rgba(108,99,255,0.1)', backdropFilter: 'blur(20px)' }
  const purpleColor = '#8b5cf6'

  // Derived label for plan credits display
  const creditLabel = overview?.isUnlimited
    ? (ar ? 'غير محدود' : 'Unlimited')
    : overview
      ? `${overview.creditsRemaining} ${ar ? 'متبقي' : 'left'}`
      : '—'

  const creditSub = overview?.isUnlimited
    ? `${overview.creditsUsedThisMonth} ${ar ? 'هذا الشهر' : 'used this month'}`
    : overview
      ? `${overview.creditsUsedThisMonth} / ${overview.monthlyTotal} ${ar ? 'مستخدم' : 'used'}`
      : ''

  return (
    <AppShell>
      <div className="min-h-screen relative" style={{ background: '#0A0E27' }} dir={dir}>
        <StarField />
        <PulseOrbs />

        <div className="relative z-10 max-w-7xl mx-auto px-4 py-8 space-y-8">

          {/* ── Header ────────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(139,92,246,0.08))', border: '1px solid rgba(139,92,246,0.3)', boxShadow: '0 0 30px rgba(139,92,246,0.15)' }}>
                  <BarChart2 size={26} style={{ color: purpleColor }} />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-pulse"
                  style={{ background: purpleColor, boxShadow: `0 0 8px ${purpleColor}` }} />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-white">PULSE</h1>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ background: 'rgba(139,92,246,0.15)', color: purpleColor, border: `1px solid rgba(139,92,246,0.3)` }}>
                    {t('analytics.badge')}
                  </span>
                </div>
                <p className="text-gray-400 text-sm mt-0.5">{t('analytics.subheading')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
              style={{ background: 'rgba(139,92,246,0.1)', border: `1px solid rgba(139,92,246,0.2)`, color: purpleColor }}>
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
              color={purpleColor}
              href="/campaigns"
              loading={dataLoading}
            />
            <MetricCard
              icon={Send}
              label={ar ? 'منشورات منشورة' : 'Published Posts'}
              value={dataLoading ? '—' : (overview?.publishedPosts ?? 0)}
              sub={overview && !dataLoading && overview.publishedPosts > 0 ? (ar ? 'عبر السوشيال' : 'via social') : undefined}
              color="#00BFA6"
              href="/connections"
              loading={dataLoading}
            />
            <MetricCard
              icon={BrainCircuit}
              label={ar ? 'توليدات AI' : 'AI Generations'}
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
              color={overview && !overview.isUnlimited && overview.creditsRemaining < 5 ? '#f59e0b' : '#6C63FF'}
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
                  <Activity size={16} style={{ color: purpleColor }} />
                  <span className="text-sm font-semibold text-gray-300">
                    {ar ? 'نشاط توليد AI الشهري' : 'Monthly AI Activity'}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <RefreshCw size={11} />
                  <span>{ar ? 'آخر 6 أشهر' : 'Last 6 months'}</span>
                </div>
              </div>
              <ActivityChart
                data={overview?.monthlyActivity ?? []}
                loading={dataLoading}
              />
              {overview && !dataLoading && (
                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                  <div className="text-xs text-gray-500">
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
                    style={{ color: purpleColor }}>
                    {ar ? 'ترقية ←' : 'Upgrade →'}
                  </Link>
                </div>
              )}
            </div>

            {/* System Insights */}
            <div className="rounded-2xl p-5 flex flex-col" style={glassCard}>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={14} style={{ color: purpleColor }} />
                <span className="text-sm font-semibold text-gray-300">
                  {ar ? 'رؤى النظام' : 'System Insights'}
                </span>
              </div>
              {dataLoading ? (
                <div className="space-y-3 flex-1">
                  {[1,2,3].map(i => (
                    <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
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
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-xs text-gray-600 text-center">
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
                  <Megaphone size={14} style={{ color: purpleColor }} />
                  <span className="text-sm font-semibold text-gray-300">
                    {ar ? 'الحملات الأخيرة' : 'Recent Campaigns'}
                  </span>
                </div>
                <Link href="/campaigns"
                  className="text-xs font-semibold transition-all hover:brightness-125"
                  style={{ color: purpleColor }}>
                  {ar ? 'عرض الكل ←' : 'View all →'}
                </Link>
              </div>
              <div className="space-y-2">
                {overview.topCampaigns.map(c => {
                  const statusColor = c.status === 'ACTIVE' ? '#00BFA6' : c.status === 'DRAFT' ? '#f59e0b' : '#6b7280'
                  const hoursAgo = Math.floor((Date.now() - new Date(c.updatedAt).getTime()) / 3600000)
                  const timeLabel = hoursAgo < 1 ? (ar ? 'الآن' : 'now')
                    : hoursAgo < 24 ? `${hoursAgo}h`
                    : `${Math.floor(hoursAgo / 24)}d`
                  return (
                    <Link key={c.id} href={`/campaigns/${c.id}`}
                      className="flex items-center justify-between p-3 rounded-xl transition-all hover:bg-white/[0.03]"
                      style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: statusColor }} />
                        <span className="text-sm text-gray-300 truncate">{c.name}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs text-gray-600">{c._count.generations} gen</span>
                        <span className="text-xs text-gray-700">{timeLabel}</span>
                        <ArrowUpRight size={12} style={{ color: 'rgba(255,255,255,0.15)' }} />
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── AI Analysis Engine ─────────────────────────────────────────── */}
          <div className="rounded-2xl p-1 overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(6,182,212,0.04))', border: '1px solid rgba(139,92,246,0.15)' }}>
            <div className="rounded-xl p-5" style={{ background: 'rgba(10,14,39,0.95)' }}>

              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)' }}>
                  <BrainCircuit size={16} style={{ color: purpleColor }} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">{ar ? 'محرك التحليل الذكي' : 'AI Analysis Engine'}</h2>
                  <p className="text-xs text-gray-500">{ar ? 'رؤى مخصصة لعلامتك التجارية' : 'Custom insights for your brand'}</p>
                </div>
              </div>

              {/* Analysis tabs */}
              <div className="flex flex-wrap gap-2 mb-5">
                {analysisTabs.map(tab => (
                  <button key={tab.id} onClick={() => { setAnalysisType(tab.id); setResult('') }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                    style={{
                      background: analysisType === tab.id ? 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(139,92,246,0.08))' : 'rgba(255,255,255,0.04)',
                      color: analysisType === tab.id ? purpleColor : '#9ca3af',
                      border: `1px solid ${analysisType === tab.id ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.07)'}`,
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
                  <div className="rounded-xl p-4 space-y-4" style={{ background: 'rgba(17,21,54,0.4)', border: '1px solid rgba(108,99,255,0.08)' }}>
                    <PulseSelect
                      label={t('analytics.industryLabel') as string}
                      value={industry}
                      onChange={setIndustry}
                      options={[
                        { value: 'ecommerce',  label: t('analytics.industryEcommerce') as string },
                        { value: 'food',       label: t('analytics.industryFood') as string },
                        { value: 'fashion',    label: t('analytics.industryFashion') as string },
                        { value: 'tech',       label: t('analytics.industryTech') as string },
                        { value: 'health',     label: t('analytics.industryHealth') as string },
                        { value: 'realestate', label: t('analytics.industryRealEstate') as string },
                        { value: 'education',  label: t('analytics.industryEducation') as string },
                        { value: 'services',   label: t('analytics.industryServices') as string },
                      ]} />
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
                  <div className="rounded-xl p-4" style={{ background: 'rgba(17,21,54,0.4)', border: '1px solid rgba(108,99,255,0.08)' }}>
                    <h3 className="text-xs font-semibold text-gray-500 mb-3">{t('analytics.quickQuestions')}</h3>
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
                          className={`w-full text-xs px-3 py-2 rounded-lg transition-all hover:text-purple-400 ${ar ? 'text-right' : 'text-left'}`}
                          style={{ background: 'rgba(17,21,54,0.5)', border: '1px solid rgba(108,99,255,0.08)', color: '#94a3b8' }}>
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Query + Output */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="rounded-xl p-5 space-y-4" style={{ background: 'rgba(17,21,54,0.4)', border: '1px solid rgba(108,99,255,0.08)' }}>
                    <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                      {(() => {
                        const tab = analysisTabs.find(tab => tab.id === analysisType)!
                        return <><tab.icon size={14} style={{ color: purpleColor }} />{t(tab.labelKey)}</>
                      })()}
                    </h3>
                    <textarea
                      value={prompt}
                      onChange={e => setPrompt(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) generate() }}
                      placeholder={t('analytics.promptPlaceholder') as string}
                      rows={4}
                      className="w-full resize-none text-sm rounded-xl p-4 focus:outline-none"
                      style={{ background: 'rgba(17,21,54,0.5)', border: '1px solid rgba(108,99,255,0.12)', color: '#f8fafc' }} />
                    <div className="flex justify-end">
                      <button onClick={generate} disabled={!prompt.trim() || aiLoading}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all"
                        style={{
                          background: prompt.trim() && !aiLoading ? `linear-gradient(135deg, ${purpleColor}, #7c3aed)` : 'rgba(255,255,255,0.05)',
                          color: prompt.trim() && !aiLoading ? '#fff' : '#4b5563',
                          boxShadow: prompt.trim() && !aiLoading ? `0 0 30px rgba(139,92,246,0.3)` : 'none',
                        }}>
                        {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                        {aiLoading ? t('analytics.analyzing') : t('analytics.analyzeNow')}
                      </button>
                    </div>
                  </div>

                  {(result || aiLoading) && (
                    <div className="rounded-xl p-5 space-y-4"
                      style={{ background: 'rgba(17,21,54,0.5)', border: `1px solid rgba(139,92,246,0.2)`, boxShadow: 'rgba(139,92,246,0.05) 0 0 40px' }}>
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: purpleColor }}>
                          <Sparkles size={14} />{t('analytics.insightTitle')}
                        </h3>
                        {result && !aiLoading && <CopyBtn text={result} />}
                      </div>
                      {aiLoading ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-4">
                          <div className="w-12 h-12 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(139,92,246,0.3)', borderTopColor: purpleColor }} />
                          <p className="text-sm text-gray-400 animate-pulse">{t('analytics.processing')}</p>
                        </div>
                      ) : (
                        <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans"
                          style={{ color: '#d1d5db', maxHeight: '500px', overflowY: 'auto' }}>
                          {result}
                        </pre>
                      )}
                    </div>
                  )}

                  {!result && !aiLoading && (
                    <div className="rounded-xl p-8 flex flex-col items-center gap-4"
                      style={{ background: 'rgba(17,21,54,0.4)', border: '1px solid rgba(108,99,255,0.08)' }}>
                      <Image size={28} style={{ color: 'rgba(139,92,246,0.3)' }} />
                      <div className="text-center">
                        <p className="text-gray-400 text-sm">{t('analytics.emptyTitle')}</p>
                        <p className="text-gray-600 text-xs mt-1">{t('analytics.emptySub')}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* History */}
              {history.length > 0 && (
                <div className="mt-5 pt-5 border-t border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-gray-500">{t('analytics.historyTitle')}</h3>
                    <button onClick={() => setHistory([])} className="text-xs text-gray-600 hover:text-red-400 transition-colors">{t('analytics.clearAll')}</button>
                  </div>
                  <div className="space-y-1">
                    {history.map(h => (
                      <div key={h.id} onClick={() => { setResult(h.output); setAnalysisType(h.type) }}
                        className="flex items-center justify-between p-2.5 rounded-xl cursor-pointer hover:bg-white/[0.03] transition-all"
                        style={{ border: '1px solid rgba(108,99,255,0.08)' }}>
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: 'rgba(139,92,246,0.1)', color: purpleColor, border: `1px solid rgba(139,92,246,0.2)` }}>
                            {t(analysisTabs.find(tab => tab.id === h.type)?.labelKey ?? '')}
                          </span>
                          <span className="text-xs text-gray-500 truncate">{h.query}</span>
                        </div>
                        <span className="text-xs text-gray-700 flex-shrink-0">{h.createdAt.toLocaleTimeString(ar ? 'ar' : 'en', { hour: '2-digit', minute: '2-digit' })}</span>
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
