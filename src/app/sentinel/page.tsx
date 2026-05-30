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

// Static monitor tab config — uses translation keys
const MONITOR_TABS: { id: MonitorType; labelKey: string; icon: React.ElementType }[] = [
  { id: 'competitors',   labelKey: 'sentinel.tabCompetitors',   icon: Eye },
  { id: 'market',        labelKey: 'sentinel.tabMarket',        icon: Activity },
  { id: 'reputation',    labelKey: 'sentinel.tabReputation',    icon: Shield },
  { id: 'opportunities', labelKey: 'sentinel.tabOpportunities', icon: TrendingUp },
  { id: 'threats',       labelKey: 'sentinel.tabThreats',       icon: AlertTriangle },
]

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

export default function SentinelPage() {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const { locale, dir, t } = useI18n()
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
    const timer = setInterval(() => setPulse(p => !p), 2000)
    return () => clearInterval(timer)
  }, [])

  // Auto-populate industry dropdown from Brand Brain
  useEffect(() => {
    if (!brand?.industry) return
    const val = brand.industry.toLowerCase().trim()
    const map: Record<string, string> = {
      'tech': 'tech', 'tech & apps': 'tech', 'تقنية': 'tech', 'تقنية وتطبيقات': 'tech',
      'ecommerce': 'ecommerce', 'e-commerce': 'ecommerce', 'تجارة': 'ecommerce', 'تجارة إلكترونية': 'ecommerce',
      'food': 'food', 'food & beverage': 'food', 'مطاعم': 'food', 'مطاعم وأغذية': 'food',
      'fashion': 'fashion', 'موضة': 'fashion', 'موضة وأزياء': 'fashion',
      'health': 'health', 'health & beauty': 'health', 'صحة': 'health', 'صحة وجمال': 'health',
      'realestate': 'realestate', 'real estate': 'realestate', 'عقارات': 'realestate',
      'education': 'education', 'تعليم': 'education', 'تعليم وتدريب': 'education',
      'services': 'services', 'خدمات': 'services',
    }
    const matched = map[val]
    if (matched) setIndustry(matched)
  }, [brand])

  // Auto-populate region dropdown from Brand Brain
  useEffect(() => {
    if (!brand?.audienceLocation) return
    const val = brand.audienceLocation.toLowerCase().trim()
    const map: Record<string, string> = {
      'uae': 'uae', 'dubai': 'uae', 'abu dhabi': 'uae', 'الإمارات': 'uae', 'دبي': 'uae',
      'saudi': 'saudi', 'saudi arabia': 'saudi', 'ksa': 'saudi', 'السعودية': 'saudi', 'المملكة العربية السعودية': 'saudi',
      'egypt': 'egypt', 'مصر': 'egypt',
      'gcc': 'gcc', 'الخليج': 'gcc', 'دول الخليج': 'gcc',
      'mena': 'mena', 'الشرق الأوسط': 'mena',
      'global': 'global', 'عالمي': 'global',
    }
    const matched = map[val]
    if (matched) setRegion(matched)
  }, [brand])

  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0A0E27' }}>
      <Loader2 className="animate-spin" size={32} style={{ color: '#10b981' }} />
    </div>
  )
  if (!isAuthenticated) return null

  // Resolve translated tabs from static config
  const monitorTabs = MONITOR_TABS.map(tab => ({
    ...tab,
    label: t(tab.labelKey) as string,
  }))

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
      setResult(t('sentinel.errorConnect') as string)
    } finally {
      setLoading(false)
    }
  }

  const glassCard = { background: 'rgba(17,21,54,0.5)', border: '1px solid rgba(108,99,255,0.1)', backdropFilter: 'blur(20px)' }
  const greenColor = '#10b981'

  const industryOptions = [
    { value: 'ecommerce',  label: t('sentinel.industryEcommerce') as string },
    { value: 'food',       label: t('sentinel.industryFood')       as string },
    { value: 'fashion',    label: t('sentinel.industryFashion')    as string },
    { value: 'tech',       label: t('sentinel.industryTech')       as string },
    { value: 'health',     label: t('sentinel.industryHealth')     as string },
    { value: 'realestate', label: t('sentinel.industryRealEstate') as string },
    { value: 'education',  label: t('sentinel.industryEducation')  as string },
    { value: 'services',   label: t('sentinel.industryServices')   as string },
  ]

  const regionOptions = [
    { value: 'mena',   label: t('sentinel.regionMena')   as string },
    { value: 'gcc',    label: t('sentinel.regionGcc')    as string },
    { value: 'saudi',  label: t('sentinel.regionSaudi')  as string },
    { value: 'uae',    label: t('sentinel.regionUae')    as string },
    { value: 'egypt',  label: t('sentinel.regionEgypt')  as string },
    { value: 'global', label: t('sentinel.regionGlobal') as string },
  ]

  const capabilities = [
    { icon: Eye,           color: '#10b981', labelKey: 'sentinel.capCompetitorsLabel', descKey: 'sentinel.capCompetitorsDesc' },
    { icon: Activity,      color: '#06b6d4', labelKey: 'sentinel.capMarketLabel',      descKey: 'sentinel.capMarketDesc' },
    { icon: Shield,        color: '#8b5cf6', labelKey: 'sentinel.capReputationLabel',  descKey: 'sentinel.capReputationDesc' },
    { icon: TrendingUp,    color: '#f59e0b', labelKey: 'sentinel.capOpportunitiesLabel', descKey: 'sentinel.capOpportunitiesDesc' },
    { icon: AlertTriangle, color: '#ef4444', labelKey: 'sentinel.capThreatsLabel',     descKey: 'sentinel.capThreatsDesc' },
  ]

  // Brand-aware alerts — read Brand Brain state instead of showing a hardcoded generic message
  const sg = t('sentinel') as Record<string, string>
  const hasBrainData = !!(brand?.industry || brand?.competitorNotes || brand?.targetAudience)
  const brandAlerts: Alert[] = hasBrainData
    ? [
        {
          id: 'ba-1',
          type: 'info' as const,
          title: sg.brainReadyTitle,
          body: sg.brainReadyBody,
          time: locale === 'ar' ? 'الآن' : 'Now',
        },
        ...(brand?.industry ? [{
          id: 'ba-2',
          type: 'opportunity' as const,
          title: `${sg.brainIndustry}: ${brand.industry}`,
          body: brand.competitorNotes
            ? `${sg.brainCompetitors}: ${brand.competitorNotes.slice(0, 80)}`
            : sg.addCompetitorsHint,
          time: locale === 'ar' ? 'نشط' : 'Active',
        }] : []),
        ...(brand?.audienceLocation ? [{
          id: 'ba-3',
          type: 'info' as const,
          title: `${sg.brainLocation}: ${brand.audienceLocation}`,
          body: brand.topPlatforms?.length
            ? `${sg.brainPlatforms}: ${brand.topPlatforms.join(', ')}`
            : locale === 'ar' ? 'المنطقة الجغرافية المستهدفة' : 'Target region defined',
          time: locale === 'ar' ? 'نشط' : 'Active',
        }] : []),
      ]
    : [
        {
          id: 'ba-1',
          type: 'info' as const,
          title: locale === 'ar' ? 'Sentinel جاهز للمراقبة' : 'Sentinel is ready to monitor',
          body: sg.addCompetitorsHint,
          time: locale === 'ar' ? 'الآن' : 'Now',
        },
        {
          id: 'ba-2',
          type: 'opportunity' as const,
          title: locale === 'ar' ? 'ربط المنصات يفتح رؤى أعمق' : 'Connect platforms for deeper insights',
          body: locale === 'ar'
            ? 'اذهب لـ Connections واربط حساباتك لتفعيل التنبيهات'
            : 'Go to Connections and link your accounts to enable alerts',
          time: locale === 'ar' ? 'نصيحة' : 'Tip',
        },
      ]

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
                    {t('sentinel.badge')}
                  </span>
                </div>
                <p className="text-gray-400 text-sm mt-0.5">{t('sentinel.subheading')}</p>
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
                  <span>{t('sentinel.activateBrain')}</span>
                </a>
              )}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
                style={{ background: 'rgba(16,185,129,0.08)', border: `1px solid rgba(16,185,129,0.2)`, color: greenColor }}>
                <Radio size={12} className={pulse ? 'opacity-100' : 'opacity-30'} style={{ transition: 'opacity 0.5s' }} />
                <span>{t('sentinel.watching')}</span>
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
                {t('sentinel.liveAlerts')}
              </h3>
              <div className="flex items-center gap-2 text-xs" style={{ color: greenColor }}>
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: greenColor }} />
                {t('sentinel.activeStatus')}
              </div>
            </div>
            <div className="space-y-2">
              {brandAlerts.map(a => <AlertCard key={a.id} alert={a} />)}
            </div>
          </div>

          {/* Monitor tabs */}
          <div className="flex flex-wrap gap-2">
            {monitorTabs.map(mon => (
              <button key={mon.id} onClick={() => { setMonitorType(mon.id); setResult('') }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: monitorType === mon.id ? 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.08))' : 'rgba(255,255,255,0.04)',
                  color: monitorType === mon.id ? greenColor : '#9ca3af',
                  border: `1px solid ${monitorType === mon.id ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.07)'}`,
                }}>
                <mon.icon size={15} />
                <span>{mon.label}</span>
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
                  {t('sentinel.monitorSettings')}
                </h3>
                <SentinelSelect
                  label={t('sentinel.industryLabel') as string}
                  value={industry}
                  onChange={setIndustry}
                  options={industryOptions}
                />
                <SentinelSelect
                  label={t('sentinel.regionLabel') as string}
                  value={region}
                  onChange={setRegion}
                  options={regionOptions}
                />
              </div>

              {/* Quick queries */}
              <div className="rounded-2xl p-4" style={glassCard}>
                <h3 className="text-xs font-semibold text-gray-500 mb-3">{t('sentinel.quickQueries')}</h3>
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
                  {(() => {
                    const mon = monitorTabs.find(m => m.id === monitorType)!
                    return <><mon.icon size={14} style={{ color: greenColor }} />{mon.label}</>
                  })()}
                </h3>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) generate() }}
                  placeholder={t('sentinel.promptPlaceholder') as string}
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
                    {loading ? t('sentinel.monitoringVerb') : t('sentinel.monitorNow')}
                  </button>
                </div>
              </div>

              {(result || loading) && (
                <div className="rounded-2xl p-5 space-y-4" style={{ ...glassCard, border: `1px solid rgba(16,185,129,0.2)`, boxShadow: 'rgba(16,185,129,0.05) 0 0 40px' }}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: greenColor }}>
                      <Sparkles size={14} />{t('sentinel.reportTitle')}
                    </h3>
                    {result && !loading && <CopyBtn text={result} />}
                  </div>
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                      <div className="w-16 h-16 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(16,185,129,0.3)', borderTopColor: greenColor }} />
                      <p className="text-sm text-gray-400 animate-pulse">{t('sentinel.processing')}</p>
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
                    <p className="text-gray-400 text-sm">{t('sentinel.emptyTitle')}</p>
                    <p className="text-gray-600 text-xs mt-1">{t('sentinel.emptySub')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="rounded-2xl p-5" style={glassCard}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-300">{t('sentinel.historyTitle')}</h3>
                <button onClick={() => setHistory([])} className="text-xs text-gray-600 hover:text-red-400 transition-colors">
                  {t('sentinel.clearAll')}
                </button>
              </div>
              <div className="space-y-2">
                {history.map(h => (
                  <div key={h.id} onClick={() => { setResult(h.output); setMonitorType(h.type) }}
                    className="flex items-center justify-between p-3 rounded-xl cursor-pointer hover:bg-white/[0.03] transition-all"
                    style={{ border: '1px solid rgba(108,99,255,0.08)' }}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: 'rgba(16,185,129,0.1)', color: greenColor, border: `1px solid rgba(16,185,129,0.2)` }}>
                        {t(monitorTabs.find(tab => tab.id === h.type)?.labelKey ?? '')}
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
            {capabilities.map((cap, i) => (
              <div key={i} className="rounded-xl p-4" style={glassCard}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                  style={{ background: `${cap.color}18`, border: `1px solid ${cap.color}30` }}>
                  <cap.icon size={16} style={{ color: cap.color }} />
                </div>
                <p className="text-white text-xs font-medium">{t(cap.labelKey)}</p>
                <p className="text-gray-600 text-xs mt-1">{t(cap.descKey)}</p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </AppShell>
  )
}
