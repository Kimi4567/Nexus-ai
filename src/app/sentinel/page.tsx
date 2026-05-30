'use client'

import AppShell from '@/components/AppShell'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { useBrandBrain } from '@/hooks/useBrandBrain'
import {
  Loader2, Shield, Wand2, Sparkles, AlertTriangle, Eye, Bell,
  Copy, Check, ChevronDown, Zap, Globe, TrendingUp, Search,
  Radio, Activity, Target, BarChart2
} from 'lucide-react'
import StarField from '@/components/ui/StarField'

/* ═══════════════════════════════════════════════════════════════
   SENTINEL — 24/7 Market & Competitor Monitoring
   Nothing escapes the watch.
   ═══════════════════════════════════════════════════════════════ */

type MonitorType = 'competitors' | 'market' | 'reputation' | 'opportunities' | 'threats'

interface Alert {
  id: string
  type: 'warning' | 'opportunity' | 'info'
  title: string
  body: string
  time: string
}

interface MonitorResult {
  id: string
  type: MonitorType
  query: string
  output: string
  createdAt: Date
}

function SentinelOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      <div className="absolute rounded-full blur-[160px] opacity-15"
        style={{ width: 700, height: 700, background: 'radial-gradient(circle, rgba(255,215,0,0.12), transparent 70%)', bottom: '-10%', left: '-10%', animation: 'float 20s ease-in-out infinite' }} />
      <div className="absolute rounded-full blur-[100px] opacity-12"
        style={{ width: 500, height: 500, background: 'radial-gradient(circle, rgba(139,92,246,0.1), transparent 70%)', top: '-5%', right: '-5%', animation: 'float 15s ease-in-out infinite reverse' }} />
    </div>
  )
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const { locale } = useI18n()
  const handle = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  return (
    <button onClick={handle}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
      style={{ background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)', color: copied ? '#10b981' : '#9ca3af', border: `1px solid ${copied ? '#10b98130' : 'rgba(255,255,255,0.08)'}` }}>
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? (locale === 'ar' ? 'تم النسخ' : 'Copied!') : (locale === 'ar' ? 'نسخ' : 'Copy')}
    </button>
  )
}

function SentinelSelect<T extends string>({ label, value, options, onChange }: {
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

// Live alert card
function AlertCard({ alert }: { alert: Alert }) {
  const colors: Record<Alert['type'], { bg: string; border: string; text: string; icon: React.ElementType }> = {
    warning:     { bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.25)',  text: '#f59e0b', icon: AlertTriangle },
    opportunity: { bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.25)',  text: '#10b981', icon: TrendingUp },
    info:        { bg: 'rgba(6,182,212,0.08)',   border: 'rgba(6,182,212,0.25)',   text: '#06b6d4', icon: Bell },
  }
  const c = colors[alert.type]
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: `${c.text}20` }}>
        <c.icon size={14} style={{ color: c.text }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{alert.title}</p>
        <p className="text-xs text-gray-400 mt-0.5">{alert.body}</p>
      </div>
      <span className="text-xs text-gray-600 flex-shrink-0">{alert.time}</span>
    </div>
  )
}

// Demo alerts are now rendered inside the component for locale support

export default function SentinelPage() {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const { locale, dir } = useI18n()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/login')
  }, [authLoading, isAuthenticated, router])

  const { brandContext, brand } = useBrandBrain()

  const [monitorType, setMonitorType] = useState<MonitorType>('competitors')
  const [industry, setIndustry] = useState('ecommerce')
  const [region, setRegion] = useState('mena')
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [history, setHistory] = useState<MonitorResult[]>([])
  const [pulse, setPulse] = useState(true)

  // Heartbeat animation
  useEffect(() => {
    const t = setInterval(() => setPulse(p => !p), 2000)
    return () => clearInterval(t)
  }, [])

  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0A0E27' }}>
      <Loader2 className="animate-spin" size={32} style={{ color: '#10b981' }} />
    </div>
  )
  if (!isAuthenticated) return null

  const monitorTabs: { id: MonitorType; label: string; labelEn: string; icon: React.ElementType }[] = [
    { id: 'competitors',  label: 'مراقبة المنافسين',  labelEn: 'Competitors',   icon: Eye },
    { id: 'market',       label: 'نبض السوق',         labelEn: 'Market Pulse',  icon: Activity },
    { id: 'reputation',   label: 'سمعة العلامة',       labelEn: 'Brand Rep.',    icon: Shield },
    { id: 'opportunities',label: 'فرص السوق',          labelEn: 'Opportunities', icon: TrendingUp },
    { id: 'threats',      label: 'تحديات وتهديدات',   labelEn: 'Threats',       icon: AlertTriangle },
  ]

  const systemPrompts: Record<MonitorType, string> = {
    competitors: `${brandContext}أنت Sentinel، محلل استراتيجي متخصص في رصد المنافسين. القطاع: ${industry}. المنطقة: ${region}. حلل المنافسين: استراتيجياتهم التسويقية الحالية، نقاط قوتهم وضعفهم، تحركاتهم الأخيرة، وكيف يمكنك التفوق عليهم. قدم توصيات عملية فورية.`,
    market: `${brandContext}أنت Sentinel، محلل نبض السوق الرقمي. القطاع: ${industry}. المنطقة: ${region}. رصد حالة السوق: الاتجاهات السائدة، حجم الطلب، تغيرات سلوك المستهلك، أفضل المنصات أداءً، والكلمات المفتاحية الصاعدة. قدم صورة واضحة ومحدثة.`,
    reputation: `${brandContext}أنت Sentinel، خبير في إدارة سمعة العلامات التجارية. القطاع: ${industry}. حلل: كيفية مراقبة السمعة الرقمية، المؤشرات المهمة، كيفية الاستجابة للتعليقات، استراتيجيات بناء الصورة الإيجابية، وإدارة الأزمات.`,
    opportunities: `${brandContext}أنت Sentinel، خبير في رصد فرص النمو التسويقية. القطاع: ${industry}. المنطقة: ${region}. حدد: الفرص غير المستغلة في السوق، الشرائح المهملة، الاتجاهات الناشئة التي يمكن ركوبها، والميزات التنافسية القابلة للبناء.`,
    threats: `${brandContext}أنت Sentinel، محلل مخاطر تسويقية. القطاع: ${industry}. المنطقة: ${region}. حدد: التهديدات الرئيسية في السوق، المنافسون الصاعدون، التغييرات التنظيمية، التحولات في سلوك المستهلك، وكيفية الاستعداد والتكيف.`,
  }

  async function generate() {
    if (!prompt.trim() || loading) return
    setLoading(true)
    setResult('')
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt: systemPrompts[monitorType], userPrompt: prompt, maxTokens: 1400, language: locale }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      const output = data.content || data.result || ''
      setResult(output)
      setHistory(prev => [{ id: crypto.randomUUID(), type: monitorType, query: prompt, output, createdAt: new Date() }, ...prev.slice(0, 9)])
    } catch {
      setResult('⚠️ فشل الاتصال بـ Sentinel. حاول مجدداً.')
    } finally {
      setLoading(false)
    }
  }

  const glassCard = { background: 'rgba(17,21,54,0.5)', border: '1px solid rgba(108,99,255,0.1)', backdropFilter: 'blur(20px)' }
  const greenColor = '#10b981'

  return (
    <AppShell>
      <div className="min-h-screen relative" style={{ background: '#0A0E27' }} dir={dir}>
        <StarField />
        <SentinelOrbs />

        <div className="relative z-10 max-w-7xl mx-auto px-4 py-8 space-y-8">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.25), rgba(16,185,129,0.08))', border: '1px solid rgba(16,185,129,0.3)', boxShadow: '0 0 30px rgba(16,185,129,0.15)' }}>
                  <Shield size={26} style={{ color: greenColor }} />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full"
                  style={{ background: pulse ? greenColor : 'rgba(16,185,129,0.3)', boxShadow: pulse ? `0 0 12px ${greenColor}` : 'none', transition: 'all 0.5s ease' }} />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-white">Sentinel</h1>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ background: 'rgba(16,185,129,0.15)', color: greenColor, border: `1px solid rgba(16,185,129,0.3)` }}>
                    24/7 Monitor
                  </span>
                </div>
                <p className="text-gray-400 text-sm mt-0.5">{locale === 'ar' ? 'مراقبة السوق والمنافسين ٢٤/٧' : 'Market & Competitor Intel'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {brand?.brandName ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
                  style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981' }}>
                  <span>🧠</span>
                  <span>Brain: {brand.brandName}</span>
                </div>
              ) : (
                <a href="/brand" className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-all hover:opacity-80"
                  style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b' }}>
                  <span>⚡</span>
                  <span>{locale === 'ar' ? 'فعّل Brand Brain' : 'Activate Brand Brain'}</span>
                </a>
              )}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
                style={{ background: 'rgba(16,185,129,0.08)', border: `1px solid rgba(16,185,129,0.2)`, color: greenColor }}>
                <Radio size={12} className={pulse ? 'opacity-100' : 'opacity-30'} style={{ transition: 'opacity 0.5s' }} />
                <span>{locale === 'ar' ? 'يراقب' : 'Watching'}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
                style={{ background: 'rgba(139,92,246,0.1)', border: `1px solid rgba(139,92,246,0.2)`, color: '#8b5cf6' }}>
                <Sparkles size={12} />
                <span>GPT-4o</span>
              </div>
            </div>
          </div>

          {/* Live alerts feed */}
          <div className="rounded-2xl p-5" style={glassCard}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <Bell size={14} style={{ color: greenColor }} />
                {locale === 'ar' ? 'تنبيهات حية' : 'Live Alerts'}
              </h3>
              <div className="flex items-center gap-2 text-xs" style={{ color: greenColor }}>
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: greenColor }} />
                {locale === 'ar' ? 'نشط' : 'Active'}
              </div>
            </div>
            <div className="space-y-2">
              {(locale === 'ar' ? [
                { id: '1', type: 'info'        as const, title: 'Sentinel جاهز للمراقبة',    body: 'ابدأ بكتابة اسم منافسيك أو قطاعك لتفعيل المراقبة',         time: 'الآن' },
                { id: '2', type: 'opportunity' as const, title: 'ربط المنصات يفتح رؤى أعمق', body: 'اذهب لـ Connections واربط حساباتك لتفعيل التنبيهات الحية', time: 'نصيحة' },
              ] : [
                { id: '1', type: 'info'        as const, title: 'Sentinel is ready to monitor', body: 'Start by writing your competitors or industry to activate monitoring', time: 'Now' },
                { id: '2', type: 'opportunity' as const, title: 'Connect platforms for deeper insights', body: 'Go to Connections and link your accounts to enable live alerts', time: 'Tip' },
              ]).map(a => <AlertCard key={a.id} alert={a} />)}
            </div>
          </div>

          {/* Monitor tabs */}
          <div className="flex flex-wrap gap-2">
            {monitorTabs.map(t => (
              <button key={t.id} onClick={() => { setMonitorType(t.id); setResult('') }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: monitorType === t.id ? 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.08))' : 'rgba(255,255,255,0.04)',
                  color: monitorType === t.id ? greenColor : '#9ca3af',
                  border: `1px solid ${monitorType === t.id ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.07)'}`,
                }}>
                <t.icon size={15} />
                <span>{locale === 'ar' ? t.label : t.labelEn}</span>
              </button>
            ))}
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Config */}
            <div className="lg:col-span-1 space-y-4">
              <div className="rounded-2xl p-5 space-y-4" style={glassCard}>
                <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                  <Target size={14} style={{ color: greenColor }} />
                  {locale === 'ar' ? 'إعدادات المراقبة' : 'Monitor Settings'}
                </h3>
                <SentinelSelect label={locale === 'ar' ? 'القطاع' : 'Industry'} value={industry} onChange={setIndustry}
                  options={[
                    { value: 'ecommerce',  label: locale === 'ar' ? 'تجارة إلكترونية' : 'E-commerce' },
                    { value: 'food',       label: locale === 'ar' ? 'مطاعم وأغذية'    : 'Food & Beverage' },
                    { value: 'fashion',    label: locale === 'ar' ? 'موضة وأزياء'      : 'Fashion' },
                    { value: 'tech',       label: locale === 'ar' ? 'تقنية وتطبيقات'   : 'Tech & Apps' },
                    { value: 'health',     label: locale === 'ar' ? 'صحة وجمال'        : 'Health & Beauty' },
                    { value: 'realestate', label: locale === 'ar' ? 'عقارات'            : 'Real Estate' },
                    { value: 'education',  label: locale === 'ar' ? 'تعليم وتدريب'      : 'Education' },
                    { value: 'services',   label: locale === 'ar' ? 'خدمات'             : 'Services' },
                  ]} />
                <SentinelSelect label={locale === 'ar' ? 'المنطقة' : 'Region'} value={region} onChange={setRegion}
                  options={[
                    { value: 'mena',   label: locale === 'ar' ? 'الشرق الأوسط وشمال أفريقيا' : 'MENA' },
                    { value: 'gcc',    label: locale === 'ar' ? 'دول الخليج العربي'            : 'GCC' },
                    { value: 'saudi',  label: locale === 'ar' ? 'المملكة العربية السعودية'     : 'Saudi Arabia' },
                    { value: 'uae',    label: locale === 'ar' ? 'الإمارات العربية المتحدة'     : 'UAE' },
                    { value: 'egypt',  label: locale === 'ar' ? 'مصر'                          : 'Egypt' },
                    { value: 'global', label: locale === 'ar' ? 'عالمي'                        : 'Global' },
                  ]} />
              </div>

              {/* Quick queries */}
              <div className="rounded-2xl p-4" style={glassCard}>
                <h3 className="text-xs font-semibold text-gray-500 mb-3">{locale === 'ar' ? 'استفسارات سريعة' : 'Quick Queries'}</h3>
                <div className="space-y-2">
                  {(locale === 'ar' ? [
                    'من هم أقوى منافسيّ الحاليين وما استراتيجيتهم؟',
                    'ما الفرص غير المستغلة في سوقي الآن؟',
                    'كيف أتحقق من سمعة علامتي التجارية؟',
                    'ما التهديدات القادمة في قطاعي لهذا الربع؟',
                  ] : [
                    'Who are my strongest competitors and what is their strategy?',
                    'What untapped opportunities exist in my market right now?',
                    'How do I monitor my brand reputation?',
                    'What threats are coming in my industry this quarter?',
                  ]).map((q, i) => (
                    <button key={i} onClick={() => setPrompt(q)}
                      className={`w-full text-xs px-3 py-2 rounded-lg transition-all hover:text-green-400 ${locale === 'ar' ? 'text-right' : 'text-left'}`}
                      style={{ background: 'rgba(17,21,54,0.5)', border: '1px solid rgba(108,99,255,0.08)', color: '#94a3b8' }}>
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
                  {(() => { const t = monitorTabs.find(t => t.id === monitorType)!; return <><t.icon size={14} style={{ color: greenColor }} />{locale === 'ar' ? t.label : t.labelEn}</> })()}
                </h3>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) generate() }}
                  placeholder={locale === 'ar' ? 'صف ما تريد مراقبته — اسم منافسيك، قطاعك، أو سؤالك الاستراتيجي...' : 'Describe what to monitor — competitor names, your industry, or your strategic question...'}
                  rows={5}
                  className="w-full resize-none text-sm rounded-xl p-4 focus:outline-none"
                  style={{ background: 'rgba(17,21,54,0.5)', border: '1px solid rgba(108,99,255,0.12)', color: '#f8fafc' }} />
                <div className="flex justify-end">
                  <button onClick={generate} disabled={!prompt.trim() || loading}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      background: prompt.trim() && !loading ? `linear-gradient(135deg, ${greenColor}, #059669)` : 'rgba(255,255,255,0.05)',
                      color: prompt.trim() && !loading ? '#0a0a0a' : '#4b5563',
                      boxShadow: prompt.trim() && !loading ? `0 0 30px rgba(16,185,129,0.3)` : 'none',
                    }}>
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                    {loading ? (locale === 'ar' ? 'جاري الرصد...' : 'Monitoring...') : (locale === 'ar' ? 'رصد الآن' : 'Monitor')}
                  </button>
                </div>
              </div>

              {(result || loading) && (
                <div className="rounded-2xl p-5 space-y-4" style={{ ...glassCard, border: `1px solid rgba(16,185,129,0.2)`, boxShadow: 'rgba(16,185,129,0.05) 0 0 40px' }}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: greenColor }}>
                      <Sparkles size={14} />{locale === 'ar' ? 'تقرير Sentinel' : 'Intelligence Report'}
                    </h3>
                    {result && !loading && <CopyBtn text={result} />}
                  </div>
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                      <div className="w-16 h-16 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(16,185,129,0.3)', borderTopColor: greenColor }} />
                      <p className="text-sm text-gray-400 animate-pulse">{locale === 'ar' ? 'Sentinel يرصد ويحلل...' : 'Sentinel is monitoring and analyzing...'}</p>
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
                    style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
                    <Shield size={32} style={{ color: 'rgba(16,185,129,0.4)' }} />
                  </div>
                  <div className="text-center">
                    <p className="text-gray-400 text-sm">{locale === 'ar' ? 'اختر نوع المراقبة وحدد القطاع والمنطقة' : 'Choose monitor type, industry and region'}</p>
                    <p className="text-gray-600 text-xs mt-1">{locale === 'ar' ? 'واكتب سؤالك ليبدأ Sentinel في الرصد والتحليل' : 'then write your question and let Sentinel monitor and analyze'}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="rounded-2xl p-5" style={glassCard}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-300">{locale === 'ar' ? 'سجل الرصد' : 'Monitor History'}</h3>
                <button onClick={() => setHistory([])} className="text-xs text-gray-600 hover:text-red-400 transition-colors">{locale === 'ar' ? 'مسح الكل' : 'Clear all'}</button>
              </div>
              <div className="space-y-2">
                {history.map(h => (
                  <div key={h.id} onClick={() => { setResult(h.output); setMonitorType(h.type) }}
                    className="flex items-center justify-between p-3 rounded-xl cursor-pointer hover:bg-white/[0.03] transition-all"
                    style={{ border: '1px solid rgba(108,99,255,0.08)' }}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: 'rgba(16,185,129,0.1)', color: greenColor, border: `1px solid rgba(16,185,129,0.2)` }}>
                        {locale === 'ar' ? monitorTabs.find(t => t.id === h.type)?.label : monitorTabs.find(t => t.id === h.type)?.labelEn}
                      </span>
                      <span className="text-xs text-gray-500 truncate">{h.query}</span>
                    </div>
                    <span className="text-xs text-gray-700 flex-shrink-0">{h.createdAt.toLocaleTimeString(locale === 'ar' ? 'ar' : 'en', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Capabilities */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { icon: Eye,          color: '#10b981', label: 'رصد المنافسين',  labelEn: 'Competitors',   desc: 'استراتيجيات وتحركات',      descEn: 'Strategies & moves' },
              { icon: Activity,     color: '#06b6d4', label: 'نبض السوق',      labelEn: 'Market Pulse',  desc: 'الاتجاهات الحالية',         descEn: 'Current trends' },
              { icon: Shield,       color: '#8b5cf6', label: 'سمعة العلامة',   labelEn: 'Brand Rep.',    desc: 'مراقبة الصورة الرقمية',     descEn: 'Digital image monitoring' },
              { icon: TrendingUp,   color: '#f59e0b', label: 'فرص النمو',      labelEn: 'Opportunities', desc: 'ثغرات وفرص غير مستغلة',     descEn: 'Untapped gaps & chances' },
              { icon: AlertTriangle,color: '#ef4444', label: 'التهديدات',      labelEn: 'Threats',       desc: 'مخاطر السوق المبكرة',       descEn: 'Early market risks' },
            ].map((c, i) => (
              <div key={i} className="rounded-xl p-4" style={glassCard}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                  style={{ background: `${c.color}18`, border: `1px solid ${c.color}30` }}>
                  <c.icon size={16} style={{ color: c.color }} />
                </div>
                <p className="text-white text-xs font-medium">{locale === 'ar' ? c.label : c.labelEn}</p>
                <p className="text-gray-600 text-xs mt-1">{locale === 'ar' ? c.desc : c.descEn}</p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </AppShell>
  )
}
