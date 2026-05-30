'use client'

import AppShell from '@/components/AppShell'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import {
  Loader2, BarChart2, Wand2, Sparkles, TrendingUp, TrendingDown,
  Copy, Check, ChevronDown, Zap, Target, RefreshCw, Calendar,
  Globe, Activity, Eye, ArrowUpRight, ArrowDownRight
} from 'lucide-react'
import StarField from '@/components/ui/StarField'
import { useBrandBrain } from '@/hooks/useBrandBrain'

/* ═══════════════════════════════════════════════════════════════
   PULSE — Analytics & Market Intelligence
   Hear the market's heartbeat.
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
  const handle = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  return (
    <button onClick={handle}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
      style={{ background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)', color: copied ? '#10b981' : '#9ca3af', border: `1px solid ${copied ? '#10b98130' : 'rgba(255,255,255,0.08)'}` }}>
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'تم النسخ' : 'نسخ'}
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
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e5e7eb', outline: 'none' }}>
          {options.map(o => <option key={o.value} value={o.value} style={{ background: '#0d0d1a' }}>{o.label}</option>)}
        </select>
        <ChevronDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
      </div>
    </div>
  )
}

// Metric card
function MetricCard({ label, labelEn, value, change, up, color }: {
  label: string; labelEn: string; value: string; change: string; up: boolean; color: string
}) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <p className="text-xs text-gray-500 mb-2">{label} · {labelEn}</p>
      <p className="text-xl font-bold text-white mb-1">{value}</p>
      <div className="flex items-center gap-1">
        {up ? <ArrowUpRight size={12} style={{ color: '#10b981' }} /> : <ArrowDownRight size={12} style={{ color: '#ef4444' }} />}
        <span className="text-xs" style={{ color: up ? '#10b981' : '#ef4444' }}>{change}</span>
      </div>
    </div>
  )
}

// Simple bar chart visual (pure CSS)
function MiniBarChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data)
  return (
    <div className="flex items-end gap-1 h-16">
      {data.map((v, i) => (
        <div key={i} className="flex-1 rounded-sm transition-all"
          style={{ height: `${(v / max) * 100}%`, background: `${color}40`, border: `1px solid ${color}60` }} />
      ))}
    </div>
  )
}

export default function PulsePage() {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/login')
  }, [authLoading, isAuthenticated, router])

  const { brandContext, brand } = useBrandBrain()
  const [analysisType, setAnalysisType] = useState<AnalysisType>('performance')
  const [period, setPeriod] = useState<Period>('30d')
  const [industry, setIndustry] = useState('ecommerce')
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [history, setHistory] = useState<InsightResult[]>([])

  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#030309' }}>
      <Loader2 className="animate-spin" size={32} style={{ color: '#8b5cf6' }} />
    </div>
  )
  if (!isAuthenticated) return null

  const analysisTabs: { id: AnalysisType; label: string; labelEn: string; icon: React.ElementType }[] = [
    { id: 'performance',  label: 'أداء الحملات',   labelEn: 'Performance',  icon: BarChart2 },
    { id: 'competitors',  label: 'المنافسون',       labelEn: 'Competitors',  icon: Target },
    { id: 'trends',       label: 'الاتجاهات',       labelEn: 'Trends',       icon: TrendingUp },
    { id: 'content',      label: 'أداء المحتوى',    labelEn: 'Content',      icon: Activity },
    { id: 'forecast',     label: 'توقعات AI',        labelEn: 'AI Forecast',  icon: Zap },
  ]

  const systemPrompts: Record<AnalysisType, string> = {
    performance: `${brandContext}أنت PULSE، محلل بيانات تسويقية خبير. الفترة: ${period}. القطاع: ${industry}. حلل أداء حملات العلامة التجارية أعلاه وقدم: KPIs الرئيسية، نقاط القوة والضعف، والتوصيات العملية المخصصة لهذه العلامة.`,
    competitors:  `${brandContext}أنت PULSE، خبير تحليل منافسين. القطاع: ${industry}. قدم تحليل منافسين مخصصاً للعلامة التجارية أعلاه: من هم منافسوهم الفعليون، نقاط قوتهم وضعفهم، وفرص التمايز المتاحة.`,
    trends:       `${brandContext}أنت PULSE، محلل اتجاهات سوقية. القطاع: ${industry}. اكشف عن الاتجاهات الأكثر صلة بالعلامة التجارية أعلاه: محتوى، إعلانات، سلوك جمهور، وفرص موسمية قادمة.`,
    content:      `${brandContext}أنت PULSE، محلل أداء محتوى. القطاع: ${industry}. الفترة: ${period}. حلل ما هو أفضل نوع محتوى للعلامة التجارية أعلاه: أوقات النشر، أنواع المحتوى، هاشتاقات فعّالة لجمهورهم المحدد.`,
    forecast:     `${brandContext}أنت PULSE، متخصص في التوقعات التسويقية. القطاع: ${industry}. بناءً على بيانات العلامة التجارية أعلاه، توقع الأداء للأشهر الثلاثة القادمة وقدم خطة عمل استباقية مخصصة.`,
  }

  async function generate() {
    if (!prompt.trim() || loading) return
    setLoading(true)
    setResult('')
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt: systemPrompts[analysisType], userPrompt: prompt, maxTokens: 1400 }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      const output = data.content || data.result || ''
      setResult(output)
      setHistory(prev => [{ id: crypto.randomUUID(), type: analysisType, query: prompt, output, createdAt: new Date() }, ...prev.slice(0, 9)])
    } catch {
      setResult('⚠️ فشل الاتصال بـ PULSE. حاول مجدداً.')
    } finally {
      setLoading(false)
    }
  }

  const glassCard = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }
  const purpleColor = '#8b5cf6'

  // Sample chart data (representative, not fake stats)
  const chartData = [30, 45, 38, 62, 55, 70, 58, 80, 75, 90, 85, 95, 88, 72]

  return (
    <AppShell>
      <div className="min-h-screen relative" style={{ background: '#030309' }} dir="rtl">
        <StarField />
        <PulseOrbs />

        <div className="relative z-10 max-w-7xl mx-auto px-4 py-8 space-y-8">

          {/* Header */}
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
                    Analytics
                  </span>
                </div>
                <p className="text-gray-400 text-sm mt-0.5">لوحة التحليلات والرؤى الذكية · Analytics & Market Intelligence</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
              style={{ background: 'rgba(139,92,246,0.1)', border: `1px solid rgba(139,92,246,0.2)`, color: purpleColor }}>
              <Sparkles size={12} />
              <span>GPT-4o · نشط</span>
            </div>
          </div>

          {/* Metrics overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="الوصول"       labelEn="Reach"       value="—" change="اربط حساباتك" up={true}  color={purpleColor} />
            <MetricCard label="التفاعل"      labelEn="Engagement"  value="—" change="لرؤية البيانات" up={true}  color="#06b6d4" />
            <MetricCard label="التحويلات"    labelEn="Conversions" value="—" change="من Connections" up={false} color="#10b981" />
            <MetricCard label="معدل النمو"   labelEn="Growth"      value="—" change="للوحة التحليل"  up={true}  color="#f59e0b" />
          </div>

          {/* Chart preview */}
          <div className="rounded-2xl p-5" style={glassCard}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity size={16} style={{ color: purpleColor }} />
                <span className="text-sm font-semibold text-gray-300">نشاط الحملات · Campaign Activity</span>
              </div>
              <div className="flex items-center gap-2">
                {(['7d','30d','90d'] as Period[]).map(p => (
                  <button key={p} onClick={() => setPeriod(p)}
                    className="text-xs px-3 py-1 rounded-lg transition-all"
                    style={{ background: period === p ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.03)', color: period === p ? purpleColor : '#6b7280', border: `1px solid ${period === p ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.06)'}` }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <MiniBarChart data={chartData} color={purpleColor} />
            <p className="text-xs text-gray-600 mt-2 text-center">ربط المنصات يتيح عرض البيانات الحقيقية · Connect platforms to see real data</p>
          </div>

          {/* Analysis tabs */}
          <div className="flex flex-wrap gap-2">
            {analysisTabs.map(t => (
              <button key={t.id} onClick={() => { setAnalysisType(t.id); setResult('') }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: analysisType === t.id ? 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(139,92,246,0.08))' : 'rgba(255,255,255,0.04)',
                  color: analysisType === t.id ? purpleColor : '#9ca3af',
                  border: `1px solid ${analysisType === t.id ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.07)'}`,
                }}>
                <t.icon size={15} />
                <span>{t.label}</span>
                <span className="opacity-50 text-xs">{t.labelEn}</span>
              </button>
            ))}
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Config */}
            <div className="lg:col-span-1 space-y-4">
              <div className="rounded-2xl p-5 space-y-4" style={glassCard}>
                <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                  <Target size={14} style={{ color: purpleColor }} />
                  إعدادات التحليل
                </h3>
                <PulseSelect label="القطاع · Industry" value={industry} onChange={setIndustry}
                  options={[
                    { value: 'ecommerce',   label: 'تجارة إلكترونية · E-commerce' },
                    { value: 'food',        label: 'مطاعم وأغذية · Food & Beverage' },
                    { value: 'fashion',     label: 'موضة وأزياء · Fashion' },
                    { value: 'tech',        label: 'تقنية · Technology' },
                    { value: 'health',      label: 'صحة وجمال · Health & Beauty' },
                    { value: 'realestate',  label: 'عقارات · Real Estate' },
                    { value: 'education',   label: 'تعليم · Education' },
                    { value: 'services',    label: 'خدمات · Services' },
                  ]} />
                <PulseSelect<Period> label="الفترة الزمنية · Period" value={period} onChange={setPeriod}
                  options={[
                    { value: '7d',  label: 'آخر 7 أيام' },
                    { value: '30d', label: 'آخر 30 يوم' },
                    { value: '90d', label: 'آخر 3 أشهر' },
                    { value: '6m',  label: 'آخر 6 أشهر' },
                    { value: '1y',  label: 'آخر سنة' },
                  ]} />
              </div>

              {/* Quick queries */}
              <div className="rounded-2xl p-4" style={glassCard}>
                <h3 className="text-xs font-semibold text-gray-500 mb-3">أسئلة سريعة</h3>
                <div className="space-y-2">
                  {[
                    'ما هي أفضل أوقات النشر على Instagram؟',
                    'كيف أحسّن معدل التحويل في إعلاناتي؟',
                    'ما الاتجاهات السائدة في قطاعي هذا الشهر؟',
                    'كيف تقارن حملتي بالمعايير المعتادة في السوق؟',
                  ].map((q, i) => (
                    <button key={i} onClick={() => setPrompt(q)}
                      className="w-full text-right text-xs px-3 py-2 rounded-lg transition-all hover:text-purple-400"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#9ca3af' }}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Query + Output */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-2xl p-5 space-y-4" style={glassCard}>
                <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                  {(() => { const t = analysisTabs.find(t => t.id === analysisType)!; return <><t.icon size={14} style={{ color: purpleColor }} />{t.label} · {t.labelEn}</> })()}
                </h3>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) generate() }}
                  placeholder="صف ما تريد تحليله — حملتك، منتجك، قطاعك، أو سؤالك التسويقي..."
                  rows={5}
                  className="w-full resize-none text-sm rounded-xl p-4 focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#e5e7eb' }} />
                <div className="flex justify-end">
                  <button onClick={generate} disabled={!prompt.trim() || loading}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      background: prompt.trim() && !loading ? `linear-gradient(135deg, ${purpleColor}, #7c3aed)` : 'rgba(255,255,255,0.05)',
                      color: prompt.trim() && !loading ? '#fff' : '#4b5563',
                      boxShadow: prompt.trim() && !loading ? `0 0 30px rgba(139,92,246,0.3)` : 'none',
                    }}>
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                    {loading ? 'جاري التحليل...' : 'حلّل الآن · Analyze'}
                  </button>
                </div>
              </div>

              {(result || loading) && (
                <div className="rounded-2xl p-5 space-y-4" style={{ ...glassCard, border: `1px solid rgba(139,92,246,0.2)`, boxShadow: 'rgba(139,92,246,0.05) 0 0 40px' }}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: purpleColor }}>
                      <Sparkles size={14} />الرؤية · Insight
                    </h3>
                    {result && !loading && <CopyBtn text={result} />}
                  </div>
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                      <div className="w-16 h-16 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(139,92,246,0.3)', borderTopColor: purpleColor }} />
                      <p className="text-sm text-gray-400 animate-pulse">PULSE يحلل البيانات...</p>
                    </div>
                  ) : (
                    <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans"
                      style={{ color: '#d1d5db', maxHeight: '500px', overflowY: 'auto' }}>
                      {result}
                    </pre>
                  )}
                </div>
              )}

              {!result && !loading && (
                <div className="rounded-2xl p-10 flex flex-col items-center gap-4" style={glassCard}>
                  <div className="w-20 h-20 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}>
                    <BarChart2 size={32} style={{ color: 'rgba(139,92,246,0.4)' }} />
                  </div>
                  <div className="text-center">
                    <p className="text-gray-400 text-sm">اختر نوع التحليل وحدد القطاع</p>
                    <p className="text-gray-600 text-xs mt-1">واكتب سؤالك ليقدم PULSE رؤية عميقة</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="rounded-2xl p-5" style={glassCard}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-300">سجل التحليلات · History</h3>
                <button onClick={() => setHistory([])} className="text-xs text-gray-600 hover:text-red-400 transition-colors">مسح الكل</button>
              </div>
              <div className="space-y-2">
                {history.map(h => (
                  <div key={h.id} onClick={() => { setResult(h.output); setAnalysisType(h.type) }}
                    className="flex items-center justify-between p-3 rounded-xl cursor-pointer hover:bg-white/[0.03] transition-all"
                    style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: 'rgba(139,92,246,0.1)', color: purpleColor, border: `1px solid rgba(139,92,246,0.2)` }}>
                        {analysisTabs.find(t => t.id === h.type)?.label}
                      </span>
                      <span className="text-xs text-gray-500 truncate">{h.query}</span>
                    </div>
                    <span className="text-xs text-gray-700 flex-shrink-0">{h.createdAt.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Capabilities */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { icon: BarChart2,  color: '#8b5cf6', label: 'أداء الحملات', desc: 'KPIs وتوصيات' },
              { icon: Target,     color: '#06b6d4', label: 'تحليل المنافسين', desc: 'فرص التمايز' },
              { icon: TrendingUp, color: '#10b981', label: 'الاتجاهات',    desc: 'توجهات السوق' },
              { icon: Activity,   color: '#f59e0b', label: 'أداء المحتوى', desc: 'أفضل أوقات النشر' },
              { icon: Zap,        color: '#ec4899', label: 'توقعات AI',    desc: 'خطة 90 يوم' },
            ].map((c, i) => (
              <div key={i} className="rounded-xl p-4" style={glassCard}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                  style={{ background: `${c.color}18`, border: `1px solid ${c.color}30` }}>
                  <c.icon size={16} style={{ color: c.color }} />
                </div>
                <p className="text-white text-xs font-medium">{c.label}</p>
                <p className="text-gray-600 text-xs mt-1">{c.desc}</p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </AppShell>
  )
}
