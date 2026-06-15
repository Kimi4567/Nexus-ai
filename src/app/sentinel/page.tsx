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

/* ═══════════════════════════════════════════════════════════════
   SENTINEL — Market & Competitor Scans (runs periodically)
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

// ── Lightweight inline markdown renderer ─────────────────────────────────────
function MarkdownOutput({ text }: { text: string }) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let keyIdx = 0

  const inlineStyle = (raw: string): React.ReactNode => {
    // Handle **bold** and *italic* inline
    const parts = raw.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
    return parts.map((p, i) => {
      if (p.startsWith('**') && p.endsWith('**'))
        return <strong key={i} style={{ color: '#0F172A', fontWeight: 700 }}>{p.slice(2, -2)}</strong>
      if (p.startsWith('*') && p.endsWith('*'))
        return <em key={i} style={{ color: '#475569', fontStyle: 'italic' }}>{p.slice(1, -1)}</em>
      return p
    })
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={keyIdx++} className="text-sm font-semibold mt-4 mb-1.5" style={{ color: '#B45309' }}>
          {inlineStyle(line.slice(4))}
        </h3>
      )
    } else if (line.startsWith('## ')) {
      elements.push(
        <h2 key={keyIdx++} className="text-base font-semibold mt-5 mb-2" style={{ color: '#B45309' }}>
          {inlineStyle(line.slice(3))}
        </h2>
      )
    } else if (line.startsWith('# ')) {
      elements.push(
        <h1 key={keyIdx++} className="text-lg font-semibold mt-5 mb-2" style={{ color: '#B45309' }}>
          {inlineStyle(line.slice(2))}
        </h1>
      )
    } else if (/^[-•–]\s/.test(line)) {
      elements.push(
        <div key={keyIdx++} className="flex items-start gap-2 text-sm my-0.5" style={{ color: '#334155' }}>
          <span style={{ color: '#B45309', marginTop: 1, flexShrink: 0 }}>•</span>
          <span>{inlineStyle(line.replace(/^[-•–]\s/, ''))}</span>
        </div>
      )
    } else if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\.\s/)![1]
      elements.push(
        <div key={keyIdx++} className="flex items-start gap-2 text-sm my-0.5" style={{ color: '#334155' }}>
          <span style={{ color: '#B45309', fontWeight: 600, flexShrink: 0 }}>{num}.</span>
          <span>{inlineStyle(line.replace(/^\d+\.\s/, ''))}</span>
        </div>
      )
    } else if (line.trim() === '') {
      elements.push(<div key={keyIdx++} style={{ height: 8 }} />)
    } else {
      elements.push(
        <p key={keyIdx++} className="text-sm leading-relaxed my-0.5" style={{ color: '#334155' }}>
          {inlineStyle(line)}
        </p>
      )
    }
    i++
  }
  return (
    <div className="space-y-0.5" style={{ maxHeight: '500px', overflowY: 'auto' }}>
      {elements}
    </div>
  )
}
// ─────────────────────────────────────────────────────────────────────────────

// Static monitor tab config — uses translation keys
const MONITOR_TABS: { id: MonitorType; labelKey: string; icon: React.ElementType }[] = [
  { id: 'competitors',   labelKey: 'sentinel.tabCompetitors',   icon: Eye },
  { id: 'market',        labelKey: 'sentinel.tabMarket',        icon: Activity },
  { id: 'reputation',    labelKey: 'sentinel.tabReputation',    icon: Shield },
  { id: 'opportunities', labelKey: 'sentinel.tabOpportunities', icon: TrendingUp },
  { id: 'threats',       labelKey: 'sentinel.tabThreats',       icon: AlertTriangle },
]

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const { t } = useI18n()
  const handle = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  return (
    <button onClick={handle}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
      style={{ background: copied ? '#FFFBEB' : '#F8FAFC', color: copied ? '#B45309' : '#475569', border: `1px solid ${copied ? '#FDE68A' : '#E2E8F0'}` }}>
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

// Live alert card
function AlertCard({ alert }: { alert: Alert }) {
  const colors: Record<Alert['type'], { bg: string; border: string; text: string; icon: React.ElementType }> = {
    warning:     { bg: '#FFFBEB', border: '#FDE68A', text: '#B45309', icon: AlertTriangle },
    opportunity: { bg: '#F0FDF4', border: '#BBF7D0', text: '#047857', icon: TrendingUp },
    info:        { bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8', icon: Bell },
  }
  const c = colors[alert.type]
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: `${c.text}20` }}>
        <c.icon size={14} style={{ color: c.text }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900">{alert.title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{alert.body}</p>
      </div>
      <span className="text-xs text-slate-400 flex-shrink-0">{alert.time}</span>
    </div>
  )
}

export default function SentinelPage() {
  const { isAuthenticated, loading: authLoading, authHeader } = useAuth()
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
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
      <Loader2 className="animate-spin" size={32} style={{ color: '#F59E0B' }} />
    </div>
  )
  if (!isAuthenticated) return null

  // Resolve translated tabs from static config
  const monitorTabs = MONITOR_TABS.map(tab => ({
    ...tab,
    label: t(tab.labelKey) as string,
  }))

  // Build brand-specific context block from Brand Brain fields
  const bn = brand?.brandName || (locale === 'ar' ? 'علامتك التجارية' : 'your brand')
  const brandSpecificLines = [
    brand?.uniqueAdvantages?.length
      ? (locale === 'ar' ? `المزايا التنافسية لـ${bn}: ${brand.uniqueAdvantages.join('، ')}` : `${bn}'s competitive advantages: ${brand.uniqueAdvantages.join(', ')}`)
      : '',
    brand?.audiencePainPoints?.length
      ? (locale === 'ar' ? `نقاط ألم الجمهور: ${brand.audiencePainPoints.join('، ')}` : `Audience pain points: ${brand.audiencePainPoints.join(', ')}`)
      : '',
    brand?.competitorNotes
      ? (locale === 'ar' ? `المنافسون المعروفون: ${brand.competitorNotes}` : `Known competitors: ${brand.competitorNotes}`)
      : '',
    brand?.pricePoint
      ? (locale === 'ar' ? `موضع السعر: ${brand.pricePoint}` : `Price positioning: ${brand.pricePoint}`)
      : '',
    brand?.winningAngles?.length
      ? (locale === 'ar' ? `الزوايا التسويقية الرابحة: ${(brand.winningAngles as string[]).join('، ')}` : `Winning angles: ${(brand.winningAngles as string[]).join(', ')}`)
      : '',
  ].filter(Boolean).join('\n')

  const brandMemoryBlock = brandSpecificLines
    ? (locale === 'ar'
        ? `\n\nمعطيات ذاكرة العلامة:\n${brandSpecificLines}\n`
        : `\n\nBrand memory data:\n${brandSpecificLines}\n`)
    : ''

  const systemPrompts: Record<MonitorType, string> = {
    competitors: locale === 'ar'
      ? `${brandContext}${brandMemoryBlock}\nأنت Sentinel، محلل استراتيجي يعمل حصرياً لصالح ${bn}. القطاع: ${industry}. المنطقة: ${region}.\n\nمهمتك: رصد المنافسين وتحليلهم من زاوية ${bn} تحديداً. لكل منافس تذكره:\n1. استراتيجيته التسويقية الحالية\n2. كيف يؤثر على مكانة ${bn} في السوق\n3. نقطة الضعف التي يمكن لـ${bn} استغلالها\n4. الخطوة العملية الفورية التي يجب أن تتخذها ${bn} للتفوق عليه\n\nقدم توصيات مخصصة لـ${bn}، ليس نصائح عامة.`
      : `${brandContext}${brandMemoryBlock}\nYou are Sentinel, a strategic analyst working exclusively for ${bn}. Sector: ${industry}. Region: ${region}.\n\nYour mission: monitor and analyze competitors specifically through the lens of ${bn}. For each competitor:\n1. Their current marketing strategy\n2. How they threaten ${bn}'s market position\n3. The weakness ${bn} can exploit\n4. The immediate practical step ${bn} should take to outperform them\n\nDeliver ${bn}-specific recommendations, not generic advice.`,

    market: locale === 'ar'
      ? `${brandContext}${brandMemoryBlock}\nأنت Sentinel، محلل نبض السوق يعمل لصالح ${bn}. القطاع: ${industry}. المنطقة: ${region}.\n\nرصد حالة السوق من منظور ${bn}: الاتجاهات السائدة وكيف تؤثر على ${bn}، التغيرات في سلوك الجمهور المستهدف لـ${bn}، أفضل المنصات أداءً لقطاع ${industry}، والكلمات المفتاحية والمحتوى الصاعد الذي يجب أن ينتبه له ${bn}.`
      : `${brandContext}${brandMemoryBlock}\nYou are Sentinel, a market pulse analyst working for ${bn}. Sector: ${industry}. Region: ${region}.\n\nMonitor market conditions through ${bn}'s lens: trends that directly impact ${bn}, behavioral shifts in ${bn}'s target audience, top-performing platforms for ${industry}, and rising keywords/content formats ${bn} should capitalize on.`,

    reputation: locale === 'ar'
      ? `${brandContext}${brandMemoryBlock}\nأنت Sentinel، خبير سمعة يعمل لصالح ${bn}. القطاع: ${industry}.\n\nحلل إدارة سمعة ${bn} تحديداً: المؤشرات الأهم لمتابعتها، كيف يجب أن يستجيب ${bn} للتعليقات والمراجعات، استراتيجية بناء الصورة الذهنية لـ${bn}، وكيفية التعامل مع أي أزمة سمعة محتملة بما يتناسب مع هوية ${bn} ونبرته.`
      : `${brandContext}${brandMemoryBlock}\nYou are Sentinel, a reputation expert working for ${bn}. Sector: ${industry}.\n\nAnalyze reputation management specifically for ${bn}: the most critical indicators to monitor, how ${bn} should respond to reviews and comments, strategies to build ${bn}'s brand image, and how to handle any reputation crisis in a way that aligns with ${bn}'s identity and tone.`,

    opportunities: locale === 'ar'
      ? `${brandContext}${brandMemoryBlock}\nأنت Sentinel، محلل فرص النمو لـ${bn}. القطاع: ${industry}. المنطقة: ${region}.\n\nحدد الفرص التي تناسب ${bn} تحديداً: الشرائح المهملة في السوق التي يمكن لـ${bn} خدمتها، الاتجاهات الناشئة التي تتوافق مع مزايا ${bn}، الميزات التنافسية الجديدة التي يمكن لـ${bn} بناؤها، وخطوات عملية محددة ليبدأ بها ${bn} اليوم.`
      : `${brandContext}${brandMemoryBlock}\nYou are Sentinel, a growth opportunity analyst for ${bn}. Sector: ${industry}. Region: ${region}.\n\nIdentify opportunities that fit ${bn} specifically: underserved market segments ${bn} can capture, emerging trends that align with ${bn}'s strengths, new competitive advantages ${bn} can build, and concrete next steps ${bn} can start today.`,

    threats: locale === 'ar'
      ? `${brandContext}${brandMemoryBlock}\nأنت Sentinel، محلل مخاطر لـ${bn}. القطاع: ${industry}. المنطقة: ${region}.\n\nحدد التهديدات التي تواجه ${bn} تحديداً: المنافسون الصاعدون الذين يستهدفون نفس جمهور ${bn}، التغييرات في السوق التي تهدد مكانة ${bn}، نقاط الضعف التي يجب أن يعالجها ${bn} الآن، وخطة استعداد مخصصة لـ${bn}.`
      : `${brandContext}${brandMemoryBlock}\nYou are Sentinel, a risk analyst for ${bn}. Sector: ${industry}. Region: ${region}.\n\nIdentify threats specifically facing ${bn}: rising competitors targeting ${bn}'s audience, market shifts that threaten ${bn}'s positioning, vulnerabilities ${bn} must address now, and a tailored readiness plan for ${bn}.`,
  }

  async function generate() {
    if (!prompt.trim() || loading) return
    setLoading(true)
    setResult('')
    try {
      const token = authHeader()
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: token } : {}) },
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

  const glassCard = { background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }
  const sentinelColor = '#F59E0B'

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
    { icon: Eye,           color: '#EAB308', labelKey: 'sentinel.capCompetitorsLabel', descKey: 'sentinel.capCompetitorsDesc' },
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
      <div className="min-h-screen bg-[#f5f5f7]" dir={dir}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                  <Shield size={26} style={{ color: sentinelColor }} />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full"
                  style={{ background: pulse ? sentinelColor : '#FDE68A', transition: 'all 0.5s ease' }} />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-semibold text-slate-950">Sentinel</h1>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ background: '#FFFBEB', color: '#B45309', border: '1px solid #FDE68A' }}>
                    {t('sentinel.badge')}
                  </span>
                </div>
                <p className="text-slate-500 text-sm mt-0.5">{t('sentinel.subheading')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {brand?.brandName ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
                  style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#B45309' }}>
                  <span>🧠</span>
                  <span>Brain: {brand.brandName}</span>
                </div>
              ) : (
                <a href="/brand" className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-all hover:opacity-80"
                  style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#B45309' }}>
                  <span>⚡</span>
                  <span>{t('sentinel.activateBrain')}</span>
                </a>
              )}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
                style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.08)', color: '#475569' }}>
                <Radio size={12} className={pulse ? 'opacity-100' : 'opacity-30'} style={{ transition: 'opacity 0.5s' }} />
                <span>{t('sentinel.watching')}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
                style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', color: '#6D28D9' }}>
                <Sparkles size={12} />
                <span>GPT-4o</span>
              </div>
            </div>
          </div>

          {/* Live alerts feed */}
          <div className="rounded-2xl p-5" style={glassCard}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Bell size={14} style={{ color: sentinelColor }} />
                {t('sentinel.liveAlerts')}
              </h3>
              <div className="flex items-center gap-2 text-xs" style={{ color: sentinelColor }}>
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: sentinelColor }} />
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
                  background: monitorType === mon.id ? '#FFFBEB' : '#FFFFFF',
                  color: monitorType === mon.id ? '#B45309' : '#64748B',
                  border: `1px solid ${monitorType === mon.id ? '#FDE68A' : 'rgba(15,23,42,0.08)'}`,
                }}>
                <mon.icon size={15} />
                <span>{mon.label}</span>
              </button>
            ))}
          </div>

          {/* Brand context bar — shown when Brand Brain has data */}
          {brand?.brandName && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl flex-wrap"
              style={{
                background: '#FFFFFF',
                border: '1px solid rgba(15,23,42,0.08)',
                boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
              }}
            >
              <div className="flex items-center gap-2 flex-shrink-0">
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center"
                  style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}
                >
                  <Target size={12} style={{ color: '#B45309' }} />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: '#B45309' }}>
                  {locale === 'ar' ? `يرصد لصالح: ${brand.brandName}` : `Monitoring for: ${brand.brandName}`}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 flex-1">
                {brand.industry && (
                  <span className="text-[10px] px-2 py-0.5 rounded-md font-medium"
                    style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8' }}>
                    {brand.industry}
                  </span>
                )}
                {brand.uniqueAdvantages?.slice(0, 2).map((a, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-md font-medium"
                    style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', color: '#6D28D9' }}>
                    {a}
                  </span>
                ))}
                {brand.competitorNotes && (
                  <span className="text-[10px] px-2 py-0.5 rounded-md font-medium"
                    style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C' }}>
                    {locale === 'ar' ? '⚔ منافسون محددون' : '⚔ Known competitors'}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Config */}
            <div className="lg:col-span-1 space-y-4">
              <div className="rounded-2xl p-5 space-y-4" style={glassCard}>
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Target size={14} style={{ color: sentinelColor }} />
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
                <h3 className="text-xs font-semibold text-slate-500 mb-3">{t('sentinel.quickQueries')}</h3>
                <div className="space-y-2">
                  {(locale === 'ar' ? [
                    brand?.brandName
                      ? `من هم أقوى منافسي ${brand.brandName} وكيف يؤثرون على مكانتنا؟`
                      : 'من هم أقوى منافسيّ الحاليين وما استراتيجيتهم؟',
                    brand?.brandName
                      ? `ما الفرص غير المستغلة التي يمكن لـ${brand.brandName} استغلالها الآن؟`
                      : 'ما الفرص غير المستغلة في سوقي الآن؟',
                    brand?.brandName
                      ? `كيف أحمي سمعة ${brand.brandName} وأرصد ما يقال عنها؟`
                      : 'كيف أتحقق من سمعة علامتي التجارية؟',
                    brand?.brandName
                      ? `ما التهديدات التي تواجه ${brand.brandName} في هذا الربع وكيف نستعد؟`
                      : 'ما التهديدات القادمة في قطاعي لهذا الربع؟',
                  ] : [
                    brand?.brandName
                      ? `Who are ${brand.brandName}'s strongest competitors and how do they affect our positioning?`
                      : 'Who are my strongest competitors and what is their strategy?',
                    brand?.brandName
                      ? `What untapped opportunities can ${brand.brandName} capitalize on right now?`
                      : 'What untapped opportunities exist in my market right now?',
                    brand?.brandName
                      ? `How should ${brand.brandName} monitor and protect its online reputation?`
                      : 'How do I monitor my brand reputation?',
                    brand?.brandName
                      ? `What threats does ${brand.brandName} face this quarter and how should we prepare?`
                      : 'What threats are coming in my industry this quarter?',
                  ]).map((q, i) => (
                    <button key={i} onClick={() => setPrompt(q)}
                      className={`w-full text-xs px-3 py-2 rounded-lg transition-all hover:text-amber-700 ${locale === 'ar' ? 'text-right' : 'text-left'}`}
                      style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.08)', color: '#475569' }}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Query + Output */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-2xl p-5 space-y-4" style={glassCard}>
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  {(() => {
                    const mon = monitorTabs.find(m => m.id === monitorType)!
                    return <><mon.icon size={14} style={{ color: sentinelColor }} />{mon.label}</>
                  })()}
                </h3>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) generate() }}
                  placeholder={t('sentinel.promptPlaceholder') as string}
                  rows={5}
                  className="w-full resize-none text-sm rounded-xl p-4 focus:outline-none"
                  style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.1)', color: '#0F172A' }} />
                <div className="flex justify-end">
                  <button onClick={generate} disabled={!prompt.trim() || loading}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      background: prompt.trim() && !loading ? '#F59E0B' : '#E2E8F0',
                      color: prompt.trim() && !loading ? '#FFFFFF' : '#64748B',
                      boxShadow: prompt.trim() && !loading ? '0 10px 24px rgba(245,158,11,0.18)' : 'none',
                    }}>
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                    {loading ? t('sentinel.monitoringVerb') : t('sentinel.monitorNow')}
                  </button>
                </div>
              </div>

              {(result || loading) && (
                <div className="rounded-2xl p-5 space-y-4" style={{ ...glassCard, border: '1px solid #FDE68A' }}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: sentinelColor }}>
                      <Sparkles size={14} />{t('sentinel.reportTitle')}
                    </h3>
                    {result && !loading && <CopyBtn text={result} />}
                  </div>
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                      <div className="w-16 h-16 rounded-full border-2 border-amber-200 border-t-amber-500 animate-spin" />
                      <p className="text-sm text-slate-500 animate-pulse">{t('sentinel.processing')}</p>
                    </div>
                  ) : (
                    <MarkdownOutput text={result} />
                  )}
                </div>
              )}

              {!result && !loading && (
                <div className="rounded-2xl p-10 flex flex-col items-center gap-4" style={glassCard}>
                  <div className="w-20 h-20 rounded-full flex items-center justify-center"
                    style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                    <Shield size={32} style={{ color: '#F59E0B' }} />
                  </div>
                  <div className="text-center">
                    <p className="text-slate-500 text-sm">{t('sentinel.emptyTitle')}</p>
                    <p className="text-slate-400 text-xs mt-1">{t('sentinel.emptySub')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="rounded-2xl p-5" style={glassCard}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-800">{t('sentinel.historyTitle')}</h3>
                <button onClick={() => setHistory([])} className="text-xs text-slate-400 hover:text-red-600 transition-colors">
                  {t('sentinel.clearAll')}
                </button>
              </div>
              <div className="space-y-2">
                {history.map(h => (
                  <div key={h.id} onClick={() => { setResult(h.output); setMonitorType(h.type) }}
                    className="flex items-center justify-between p-3 rounded-xl cursor-pointer hover:bg-slate-50 transition-all"
                    style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: 'rgba(234,179,8,0.1)', color: sentinelColor, border: `1px solid rgba(234,179,8,0.2)` }}>
                        {t(monitorTabs.find(tab => tab.id === h.type)?.labelKey ?? '')}
                      </span>
                      <span className="text-xs text-slate-500 truncate">{h.query}</span>
                    </div>
                    <span className="text-xs text-slate-400 flex-shrink-0">{h.createdAt.toLocaleTimeString(locale === 'ar' ? 'ar' : 'en', { hour: '2-digit', minute: '2-digit' })}</span>
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
                <p className="text-slate-800 text-xs font-medium">{t(cap.labelKey)}</p>
                <p className="text-slate-400 text-xs mt-1">{t(cap.descKey)}</p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </AppShell>
  )
}
