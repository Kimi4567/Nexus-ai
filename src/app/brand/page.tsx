'use client'

import AppShell from '@/components/AppShell'
import { BrainTimeline } from '@/components/brain/BrainTimeline'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { useBrandBrain, getBrandCompleteness, normalizeBrandProfile, type BrandProfile } from '@/hooks/useBrandBrain'
import { getStrategyCapabilities } from '@/lib/brandReadiness'
import {
  Loader2, Brain, Check, ChevronDown, Save,
  Target, Mic, Package, Users, Globe, BarChart2, AlertTriangle,
  CheckCircle2, ArrowLeft, ArrowRight, Zap, Sparkles, Wand2, X, Rocket,
  Upload, ImageIcon, Link2, FileText, ScanSearch, ChevronRight
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   BRAND BRAIN — Premium Visual Redesign
   ═══════════════════════════════════════════════════════════════ */

type StepId = 'identity' | 'product' | 'audience' | 'voice' | 'platforms' | 'competitors'

interface Step {
  id: StepId
  labelKey: string
  descKey: string
  icon: React.ElementType
  color: string
  fieldCheck: keyof BrandProfile
}

const STEPS: Step[] = [
  { id: 'identity',    labelKey: 'brand.stepIdentityLabel',    descKey: 'brand.stepIdentityDesc',    icon: Brain,   color: '#f59e0b', fieldCheck: 'brandName'       },
  { id: 'product',     labelKey: 'brand.stepProductLabel',     descKey: 'brand.stepProductDesc',     icon: Package, color: '#06b6d4', fieldCheck: 'primaryOffer'    },
  { id: 'audience',    labelKey: 'brand.stepAudienceLabel',    descKey: 'brand.stepAudienceDesc',    icon: Users,   color: '#8b5cf6', fieldCheck: 'targetAudience'  },
  { id: 'voice',       labelKey: 'brand.stepVoiceLabel',       descKey: 'brand.stepVoiceDesc',       icon: Mic,     color: '#10b981', fieldCheck: 'writingStyle'    },
  { id: 'platforms',   labelKey: 'brand.stepPlatformsLabel',   descKey: 'brand.stepPlatformsDesc',   icon: Globe,   color: '#ec4899', fieldCheck: 'topPlatforms'    },
  { id: 'competitors', labelKey: 'brand.stepCompetitorsLabel', descKey: 'brand.stepCompetitorsDesc', icon: Target,  color: '#f97316', fieldCheck: 'competitorNotes' },
]

const INDUSTRIES_AR = ['تجارة إلكترونية','مطاعم وأغذية','موضة وأزياء','صحة وجمال','تقنية وتطبيقات','عقارات','تعليم وتدريب','خدمات مهنية','سياحة وسفر','رياضة ولياقة','ديكور وأثاث','سيارات','آخر']
const INDUSTRIES_EN = ['E-commerce','Restaurants & Food','Fashion & Apparel','Health & Beauty','Tech & Apps','Real Estate','Education & Training','Professional Services','Travel & Tourism','Sports & Fitness','Home & Furniture','Automotive','Other']
const PLATFORMS_LIST = ['Instagram','TikTok','Facebook','Snapchat','YouTube','LinkedIn','X / Twitter','Pinterest']
const TONE_OPTIONS_AR = ['حماسي','احترافي','مرح','عاطفي','جريء','هادئ','ملهم','مباشر','راقي','شبابي']
const TONE_OPTIONS_EN = ['Energetic','Professional','Playful','Emotional','Bold','Calm','Inspiring','Direct','Upscale','Youthful']
const PRICE_OPTIONS = [
  { v: 'budget',    l: 'اقتصادي', lEn: 'Budget'    },
  { v: 'mid-range', l: 'متوسط',   lEn: 'Mid-range' },
  { v: 'premium',   l: 'بريميوم', lEn: 'Premium'   },
  { v: 'luxury',    l: 'فاخر',    lEn: 'Luxury'    },
]
const AGE_OPTIONS_AR = ['13-17','18-24','25-34','35-44','45-54','55+','جميع الأعمار']
const AGE_OPTIONS_EN = ['13-17','18-24','25-34','35-44','45-54','55+','All ages']

/* ── Score Ring SVG ───────────────────────────────────────────── */
function ScoreRing({ score }: { score: number }) {
  const r = 44
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'
  const glow  = score >= 80 ? 'rgba(16,185,129,0.5)' : score >= 50 ? 'rgba(245,158,11,0.5)' : 'rgba(239,68,68,0.5)'
  return (
    <div className="relative flex items-center justify-center" style={{ width: 100, height: 100 }}>
      <svg width="100" height="100" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(15,23,42,0.08)" strokeWidth="7"/>
        <circle cx="50" cy="50" r={r} fill="none" stroke={color}
          strokeWidth="7" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.5s ease', filter: `drop-shadow(0 0 8px ${glow})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black tabular-nums" style={{ color, lineHeight: 1 }}>{score}</span>
        <span className="text-[10px] font-semibold" style={{ color: '#94A3B8' }}>/ 100</span>
      </div>
    </div>
  )
}

/* ── Score Sparkline SVG ──────────────────────────────────────── */
function ScoreSparkline({ history }: { history: number[] }) {
  if (history.length < 2) return null
  const W = 90; const H = 32; const pad = 4
  const min = Math.min(...history); const max = Math.max(...history)
  const range = Math.max(max - min, 10)
  const pts = history.map((v, i) => {
    const x = pad + (i / (history.length - 1)) * (W - pad * 2)
    const y = H - pad - ((v - min) / range) * (H - pad * 2)
    return `${x},${y}`
  })
  const last = pts[pts.length - 1].split(',')
  const trend = history[history.length - 1] >= history[0]
  const color = trend ? '#10b981' : '#f97316'
  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg width={W} height={H} className="overflow-visible">
        <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.5"
          strokeLinejoin="round" strokeLinecap="round" opacity="0.7" />
        <circle cx={last[0]} cy={last[1]} r="3" fill={color} />
      </svg>
      <span className="text-[9px] font-semibold" style={{ color: '#94A3B8' }}>
        {trend ? '▲' : '▼'} {history.length}d
      </span>
    </div>
  )
}

/* ── Sub-components ───────────────────────────────────────────── */
function TagInput({ label, placeholder, values, onChange, accentColor, onSuggest, suggesting, locale }: {
  label: string; placeholder: string; values: string[]; onChange: (v: string[]) => void;
  accentColor?: string; onSuggest?: () => void; suggesting?: boolean; locale?: string
}) {
  const [input, setInput] = useState('')
  const accent = accentColor || '#f59e0b'
  const isAr = locale === 'ar'
  const safeValues = Array.isArray(values) ? values.filter((v): v is string => typeof v === 'string') : []
  const add = (val: string) => { const v = val.trim(); if (v && !safeValues.includes(v)) onChange([...safeValues, v]); setInput('') }
  const remove = (i: number) => onChange(safeValues.filter((_, idx) => idx !== i))
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748B' }}>{label}</label>
        {onSuggest && (
          <button onClick={onSuggest} disabled={suggesting}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
            style={{
              background: suggesting ? `${accent}10` : `${accent}15`,
              border: `1px solid ${accent}35`,
              color: accent,
              boxShadow: suggesting ? 'none' : `0 0 8px ${accent}15`,
            }}>
            {suggesting
              ? <Loader2 size={11} className="animate-spin"/>
              : <Wand2 size={11}/>}
            {suggesting ? '...' : 'AI'}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 p-3 rounded-xl min-h-[52px]"
        style={{ background: '#FFFFFF', border: `1px solid ${suggesting ? accent+'40' : 'rgba(15,23,42,0.10)'}`, transition: 'border-color 0.3s' }}>
        {suggesting && (
          <div className="flex items-center gap-2 px-2 py-1">
            <Wand2 size={12} style={{ color: accent }} className="animate-pulse"/>
            <span className="text-xs" style={{ color: accent }}>
              {isAr ? 'جاري التفكير...' : 'Thinking...'}
            </span>
          </div>
        )}
        {!suggesting && safeValues.map((v, i) => (
          <span key={i} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{ background: `${accent}15`, border: `1px solid ${accent}35`, color: accent }}>
            {v}
            <button onClick={() => remove(i)} className="opacity-40 hover:opacity-100 hover:text-red-400 transition-all ml-0.5 text-sm leading-none">×</button>
          </span>
        ))}
        {!suggesting && (
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key==='Enter'||e.key===','){e.preventDefault();add(input)} }}
            placeholder={safeValues.length ? '' : placeholder}
            className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-slate-400"
            style={{ color: '#0F172A' }} />
        )}
      </div>
    </div>
  )
}

function Field({ label, children, onSuggest, suggesting, accentColor }: {
  label: string; children: React.ReactNode;
  onSuggest?: () => void; suggesting?: boolean; accentColor?: string
}) {
  const accent = accentColor || '#8b5cf6'
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748B' }}>{label}</label>
        {onSuggest && (
          <button onClick={onSuggest} disabled={suggesting}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
            style={{
              background: suggesting ? `${accent}10` : `${accent}15`,
              border: `1px solid ${accent}35`,
              color: accent,
              boxShadow: suggesting ? 'none' : `0 0 8px ${accent}15`,
            }}>
            {suggesting
              ? <Loader2 size={11} className="animate-spin"/>
              : <Wand2 size={11}/>}
            {suggesting ? '...' : 'AI'}
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

function SuggestionCard({ suggestion, onAccept, onDismiss, accent, locale }: {
  suggestion: string; onAccept: () => void; onDismiss: () => void; accent: string; locale: string
}) {
  return (
    <div className="p-3 rounded-xl text-sm" style={{ background: '#F8FAFC', border: `1px solid ${accent}28` }}>
      <p className="mb-2 leading-relaxed" style={{ color: '#334155' }}>✨ {suggestion}</p>
      <div className="flex gap-2">
        <button onClick={onAccept}
          className="text-xs px-3 py-1 rounded-lg font-semibold transition-all"
          style={{ background: `${accent}20`, color: accent, border: `1px solid ${accent}35` }}>
          {locale === 'ar' ? 'استخدم هذا' : 'Use this'}
        </button>
        <button onClick={onDismiss}
          className="text-xs px-3 py-1 rounded-lg transition-all"
          style={{ color: '#64748b' }}>
          {locale === 'ar' ? 'تجاهل' : 'Dismiss'}
        </button>
      </div>
    </div>
  )
}

function NxInput({ value, onChange, placeholder, textarea, accentColor }: {
  value: string; onChange: (v: string) => void; placeholder?: string; textarea?: boolean; accentColor?: string
}) {
  const accent = accentColor || '#8b5cf6'
  const [focused, setFocused] = useState(false)
  const cls = "w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-all duration-200 placeholder:text-slate-400"
  const style = {
    background: '#FFFFFF',
    border: `1px solid ${focused ? accent + '60' : 'rgba(15,23,42,0.10)'}`,
    color: '#0F172A',
    boxShadow: focused ? `0 0 0 3px ${accent}10` : 'none',
  }
  if (textarea) return (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      rows={3} className={`${cls} resize-none`} style={style}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
  )
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className={cls} style={style}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
  )
}

function ToggleGrid({ options, selected, onChange, color }: {
  options: string[]; selected: string[]; onChange: (v: string[]) => void; color?: string
}) {
  const c = color || '#8b5cf6'
  const safeSelected = Array.isArray(selected) ? selected : []
  const toggle = (v: string) => safeSelected.includes(v) ? onChange(safeSelected.filter(x => x !== v)) : onChange([...safeSelected, v])
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => {
        const active = safeSelected.includes(o)
        return (
          <button key={o} onClick={() => toggle(o)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
            style={{
              background: active ? `${c}12` : '#FFFFFF',
              border: `1px solid ${active ? c+'45' : 'rgba(15,23,42,0.10)'}`,
              color: active ? c : '#64748b',
              boxShadow: active ? `0 0 12px ${c}20` : 'none',
            }}>
            {active && '✓ '}{o}
          </button>
        )
      })}
    </div>
  )
}

function RadioGroup({ options, value, onChange, color }: {
  options: { v: string; l: string }[]; value: string; onChange: (v: string) => void; color?: string
}) {
  const c = color || '#f59e0b'
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)}
          className="px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-150"
          style={{
            background: value === o.v ? `${c}12` : '#FFFFFF',
            border: `1px solid ${value === o.v ? c+'45' : 'rgba(15,23,42,0.10)'}`,
            color: value === o.v ? c : '#64748b',
            boxShadow: value === o.v ? `0 0 14px ${c}18` : 'none',
          }}>
          {value === o.v ? '● ' : '○ '}{o.l}
        </button>
      ))}
    </div>
  )
}

/* ── Brand Summary Card (post-save moment of delight) ────────── */
function BrandSummaryCard({
  form, score, locale, t, onClose
}: {
  form: BrandProfile; score: number; locale: string; t: (k: string) => string; onClose: () => void
}) {
  const chips = [
    form.toneKeywords?.slice(0, 3),
    form.topPlatforms?.slice(0, 3),
  ].flat().filter(Boolean) as string[]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(15,23,42,0.28)', backdropFilter: 'blur(12px)' }}>
      <div className="w-full max-w-lg rounded-3xl overflow-hidden"
        style={{
          background: '#FFFFFF',
          border: '1px solid rgba(15,23,42,0.10)',
          boxShadow: '0 24px 80px rgba(15,23,42,0.16)',
        }}>

        {/* Top gradient bar */}
        <div className="h-1" style={{ background: 'linear-gradient(90deg, #f59e0b 0%, #8b5cf6 50%, #10b981 100%)' }}/>

        {/* Header */}
        <div className="p-6 pb-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: '#ECFDF5', border: '1px solid rgba(5,150,105,0.18)' }}>
                <CheckCircle2 size={24} style={{ color: '#10b981' }}/>
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-950">{t('brand.summaryTitle')}</h2>
                <p className="text-xs mt-0.5 text-slate-500">{t('brand.summarySubtitle')}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg transition-all text-slate-400 hover:text-slate-700 hover:bg-slate-100">
              <X size={16}/>
            </button>
          </div>

          {/* Score banner */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-5"
            style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.08)' }}>
            <div className="flex items-center gap-2 flex-1">
              <Brain size={16} style={{ color: '#8b5cf6' }}/>
              <span className="text-sm font-semibold text-slate-950">Brand Brain</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-32 rounded-full overflow-hidden" style={{ background: 'rgba(139,92,246,0.12)' }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${score}%`, background: score >= 80 ? 'linear-gradient(90deg,#10b981,#059669)' : 'linear-gradient(90deg,#f59e0b,#d97706)' }}/>
              </div>
              <span className="text-sm font-black tabular-nums"
                style={{ color: score >= 80 ? '#10b981' : '#f59e0b' }}>{score}%</span>
            </div>
          </div>

          {/* Brand details grid */}
          <div className="grid grid-cols-2 gap-3">
            {form.brandName && (
              <div className="px-4 py-3 rounded-xl" style={{ background: '#FFFBEB', border: '1px solid rgba(245,158,11,0.18)' }}>
                <p className="text-[10px] font-mono mb-1" style={{ color: 'rgba(245,158,11,0.5)' }}>{t('brand.summaryBrand')}</p>
                <p className="text-sm font-bold text-slate-950 truncate">{form.brandName}</p>
              </div>
            )}
            {form.industry && (
              <div className="px-4 py-3 rounded-xl" style={{ background: '#ECFEFF', border: '1px solid rgba(8,145,178,0.18)' }}>
                <p className="text-[10px] font-mono mb-1" style={{ color: 'rgba(6,182,212,0.5)' }}>{t('brand.summaryIndustry')}</p>
                <p className="text-sm font-bold text-slate-950 truncate">{form.industry}</p>
              </div>
            )}
            {form.targetAudience && (
              <div className="px-4 py-3 rounded-xl col-span-2" style={{ background: '#F5F3FF', border: '1px solid rgba(94,92,230,0.18)' }}>
                <p className="text-[10px] font-mono mb-1" style={{ color: 'rgba(139,92,246,0.5)' }}>{t('brand.summaryAudience')}</p>
                <p className="text-sm font-bold text-slate-950 line-clamp-1">{form.targetAudience}</p>
              </div>
            )}
          </div>

          {/* Tone + platforms chips */}
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {chips.map((c, i) => (
                <span key={i} className="px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{ background: '#F5F3FF', border: '1px solid rgba(94,92,230,0.18)', color: '#5E5CE6' }}>
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* CTA footer */}
        <div className="px-6 pb-6 flex items-center gap-3">
          <a href="/dashboard?runStrategy=1"
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all"
            style={{ background: '#111827', color: '#FFFFFF' }}>
            <Rocket size={15}/> {t('brand.summaryCtaLabel')}
          </a>
          <button onClick={onClose}
            className="px-4 py-3 rounded-xl text-sm font-semibold transition-all"
            style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.10)', color: '#64748b' }}>
            {t('brand.summaryDismiss')}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Main Page ────────────────────────────────────────────────── */
// Suspense wrapper is required because useSearchParams() is used inside.
// Without it Next.js 14 throws missing-suspense-with-csr-bailout during SSR,
// which triggers the error boundary and shows "Brand Brain Error".
export default function BrandBrainPage() {
  return (
    <Suspense fallback={null}>
      <BrandBrainInner />
    </Suspense>
  )
}

function BrandBrainInner() {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromBrief = searchParams?.get('from') === 'brief'
  const { locale, dir, t } = useI18n()
  const { brand, loading, saving, saveBrand, refetch } = useBrandBrain()

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/login')
  }, [authLoading, isAuthenticated, router])

  const [step, setStep]     = useState<StepId>('identity')
  const [briefBannerDismissed, setBriefBannerDismissed] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [suggesting, setSuggesting]   = useState<string | null>(null)
  const [suggestError, setSuggestError] = useState<string | null>(null)
  const [textSuggestion, setTextSuggestion] = useState<{ field: string; text: string } | null>(null)
  const [form, setForm]   = useState<BrandProfile>({
    brandName: '', industry: '', description: '',
    logoUrl: null,
    primaryOffer: '', secondaryOffers: [], pricePoint: 'mid-range', uniqueAdvantages: [],
    targetAudience: '', audienceAge: '', audienceLocation: '', audiencePainPoints: [], audienceDesires: [],
    toneKeywords: [], avoidKeywords: [], writingStyle: '',
    topPlatforms: [], visualStyle: '',
    winningHooks: [], winningAngles: [], failedAngles: [],
    competitors: [], competitorNotes: '', strategicNotes: '',
    websiteUrl: '', contentSamples: [],
    // PR-2A — strategy data requirements (optional; free-text)
    businessGoal: '', marketingBudget: '', conversionDestination: '', leadHandling: '',
    customerObjections: [], complianceNotes: '',
    averageOrderValue: '', grossMargin: '', customerLifetimeValue: '',
    salesCycleLength: '', seasonality: '', pastAdResults: '',
  })
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError]         = useState<string | null>(null)
  const [scoreHistory, setScoreHistory]   = useState<number[]>([])
  const [scoreRefresh, setScoreRefresh]   = useState(0)

  // ── Website Scanner state ─────────────────────────────────────
  const [websiteUrl, setWebsiteUrl]           = useState('')
  const [scanning, setScanning]               = useState(false)
  const [scanError, setScanError]             = useState<string | null>(null)
  const [scanResult, setScanResult]           = useState<Record<string, unknown> | null>(null)
  const [showScanPreview, setShowScanPreview] = useState(false)

  // ── Content Samples state ─────────────────────────────────────
  const [contentSamples, setContentSamples]     = useState(['', '', ''])
  const [analyzing, setAnalyzing]               = useState(false)
  const [analyzeError, setAnalyzeError]         = useState<string | null>(null)
  const [analyzeResult, setAnalyzeResult]       = useState<Record<string, unknown> | null>(null)
  const [showAnalyzePreview, setShowAnalyzePreview] = useState(false)

  useEffect(() => {
    try {
      const normalized = normalizeBrandProfile(brand)
      if (normalized) setForm(b => ({ ...b, ...normalized }))
    } catch (err) {
      console.error('[BrandBrain] normalizeBrandProfile failed:', err)
    }
  }, [brand])

  // When arriving from the Marketing Brief, auto-jump to the first incomplete step
  useEffect(() => {
    if (!fromBrief || loading) return
    const firstIncomplete = STEPS.find(s => {
      const val = (form as Record<string, unknown>)[s.fieldCheck]
      return !val || (Array.isArray(val) ? (val as unknown[]).length === 0 : String(val).trim().length === 0)
    })
    if (firstIncomplete) setStep(firstIncomplete.id)
  }, [fromBrief, loading]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: keyof BrandProfile, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    const ok = await saveBrand(form)
    if (ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      // Show summary card if brand has meaningful data
      if (form.brandName && form.industry) setShowSummary(true)
    }
  }

  const { authHeader } = useAuth()

  // ── Fetch score history for sparkline ────────────────────────
  useEffect(() => {
    fetch('/api/brain/score-history', { headers: { Authorization: authHeader() } })
      .then(r => r.ok ? r.json() : { snapshots: [] })
      .then(d => {
        if (Array.isArray(d.snapshots) && d.snapshots.length > 0) {
          setScoreHistory(d.snapshots.map((s: { score: number }) => s.score))
        }
      })
      .catch(() => null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved, scoreRefresh]) // re-fetch after saves and accepted learning proposals

  const refreshBrainAfterLearning = () => {
    refetch()
    setScoreRefresh(v => v + 1)
  }

  // ── handleSuggestText: for plain text fields ──────────────────
  const handleSuggestText = async (field: keyof BrandProfile) => {
    if (!form.brandName && !form.industry) {
      setSuggestError(locale === 'ar' ? 'أدخل اسم العلامة أو المجال أولاً' : 'Enter brand name or industry first')
      return
    }
    setSuggesting(field)
    setSuggestError(null)
    setTextSuggestion(null)
    try {
      const res = await fetch('/api/brand/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
        body: JSON.stringify({
          field,
          brandName:      form.brandName,
          industry:       form.industry,
          description:    form.description,
          primaryOffer:   form.primaryOffer,
          targetAudience: form.targetAudience,
          audienceLocation: form.audienceLocation,
          pricePoint:     form.pricePoint,
          uniqueAdvantages: form.uniqueAdvantages,
          toneKeywords:   form.toneKeywords,
          competitorNotes: form.competitorNotes,
          locale,
        }),
      })
      if (res.status === 402) {
        setSuggestError(locale === 'ar' ? 'رصيد غير كافٍ — يرجى الترقية' : 'Not enough credits — please upgrade')
        return
      }
      if (res.status === 401) {
        setSuggestError(locale === 'ar' ? 'يرجى تسجيل الدخول أولاً' : 'Please log in again')
        return
      }
      if (res.status === 429) {
        setSuggestError(locale === 'ar' ? 'طلبات كثيرة جداً — انتظر لحظة ثم حاول مرة أخرى' : 'Too many requests — wait a moment and try again')
        return
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        setSuggestError(errData.error || (locale === 'ar' ? 'حدث خطأ، حاول مرة أخرى' : 'Something went wrong, please try again'))
        return
      }
      const data = await res.json()
      if (data.suggestion) setTextSuggestion({ field, text: data.suggestion })
    } catch {
      setSuggestError(locale === 'ar' ? 'تعذّر الاتصال، حاول مرة أخرى' : 'Connection failed, please try again')
    }
    finally { setSuggesting(null) }
  }

  const handleSuggest = async (field: keyof BrandProfile) => {
    if (!form.brandName && !form.industry) {
      setSuggestError(locale === 'ar' ? 'أدخل اسم العلامة أو المجال أولاً' : 'Enter brand name or industry first')
      return
    }
    setSuggesting(field)
    setSuggestError(null)
    try {
      const res = await fetch('/api/brand/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
        body: JSON.stringify({
          field,
          brandName:      form.brandName,
          industry:       form.industry,
          description:    form.description,
          primaryOffer:   form.primaryOffer,
          targetAudience: form.targetAudience,
          audienceLocation: form.audienceLocation,
          pricePoint:     form.pricePoint,
          uniqueAdvantages: form.uniqueAdvantages,
          toneKeywords:   form.toneKeywords,
          competitorNotes: form.competitorNotes,
          locale,
        }),
      })
      if (res.status === 402) {
        setSuggestError(locale === 'ar' ? 'رصيد غير كافٍ — يرجى الترقية' : 'Not enough credits — please upgrade')
        return
      }
      if (res.status === 401) {
        setSuggestError(locale === 'ar' ? 'يرجى تسجيل الدخول أولاً' : 'Please log in again')
        return
      }
      if (res.status === 429) {
        setSuggestError(locale === 'ar' ? 'طلبات كثيرة جداً — انتظر لحظة ثم حاول مرة أخرى' : 'Too many requests — wait a moment and try again')
        return
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        setSuggestError(errData.error || (locale === 'ar' ? 'حدث خطأ، حاول مرة أخرى' : 'Something went wrong, please try again'))
        return
      }
      const { suggestions } = await res.json()
      // Guard: only accept string items — non-string values (objects, null, numbers)
      // would crash React when rendered as JSX children in TagInput
      const safeSuggestions: string[] = Array.isArray(suggestions)
        ? suggestions.filter((s: unknown): s is string => typeof s === 'string' && s.trim().length > 0)
        : []
      if (safeSuggestions.length) {
        const existing = Array.isArray(form[field]) ? (form[field] as string[]).filter((s): s is string => typeof s === 'string') : []
        const merged = [...new Set([...existing, ...safeSuggestions])]
        set(field, merged)
      } else {
        setSuggestError(locale === 'ar' ? 'لم يتم إرجاع اقتراحات، حاول مرة أخرى' : 'No suggestions returned, please try again')
      }
    } catch {
      setSuggestError(locale === 'ar' ? 'تعذّر الاتصال، حاول مرة أخرى' : 'Connection failed, please try again')
    }
    finally { setSuggesting(null) }
  }

  const handleLogoUpload = async (file: File) => {
    setLogoError(null)
    setLogoUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/brand/upload-logo', {
        method: 'POST',
        headers: { Authorization: authHeader() },
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) {
        setLogoError(data.error || 'Upload failed')
        return
      }
      set('logoUrl', data.logoUrl)
    } catch {
      setLogoError(locale === 'ar' ? 'تعذّر رفع الصورة' : 'Upload failed, please try again')
    } finally {
      setLogoUploading(false)
    }
  }

  // ── handleScanWebsite ─────────────────────────────────────────
  const handleScanWebsite = async () => {
    if (!websiteUrl.trim()) return
    setScanning(true)
    setScanError(null)
    setScanResult(null)
    setShowScanPreview(false)
    try {
      const res = await fetch('/api/brand/scan-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
        body: JSON.stringify({ url: websiteUrl }),
      })
      const data = await res.json()
      if (res.status === 402) {
        setScanError(locale === 'ar' ? 'رصيد غير كافٍ — يرجى الترقية' : 'Not enough credits — please upgrade')
        return
      }
      if (res.status === 422) {
        setScanError(locale === 'ar' ? 'تعذّر قراءة المحتوى — قد يحتاج الموقع إلى JavaScript' : 'Could not read website content — the site may require JavaScript')
        return
      }
      if (!res.ok) {
        setScanError(data.error || (locale === 'ar' ? 'حدث خطأ، حاول مرة أخرى' : 'Something went wrong'))
        return
      }
      setScanResult(data.extracted)
      setShowScanPreview(true)
    } catch {
      setScanError(locale === 'ar' ? 'تعذّر الاتصال، حاول مرة أخرى' : 'Connection failed, please try again')
    } finally {
      setScanning(false)
    }
  }

  const applyScanResult = () => {
    if (!scanResult) return
    const r = scanResult as Record<string, unknown>
    setForm(f => ({
      ...f,
      brandName:         r.brandName         ? String(r.brandName)         : f.brandName,
      industry:          r.industry          ? String(r.industry)          : f.industry,
      description:       r.description       ? String(r.description)       : f.description,
      targetAudience:    r.targetAudience    ? String(r.targetAudience)    : f.targetAudience,
      primaryOffer:      r.primaryOffer      ? String(r.primaryOffer)      : f.primaryOffer,
      writingStyle:      r.writingStyle      ? String(r.writingStyle)      : f.writingStyle,
      pricePoint:        r.pricePoint        ? String(r.pricePoint)        : f.pricePoint,
      strategicNotes:    r.strategicNotes    ? String(r.strategicNotes)    : f.strategicNotes,
      uniqueAdvantages:  Array.isArray(r.uniqueAdvantages)  ? [...new Set([...(f.uniqueAdvantages||[]), ...(r.uniqueAdvantages as string[])])]  : f.uniqueAdvantages,
      toneKeywords:      Array.isArray(r.toneKeywords)      ? [...new Set([...(f.toneKeywords||[]),     ...(r.toneKeywords      as string[])])]  : f.toneKeywords,
      audiencePainPoints:Array.isArray(r.audiencePainPoints)? [...new Set([...(f.audiencePainPoints||[]),...(r.audiencePainPoints as string[])])]  : f.audiencePainPoints,
      competitors:       Array.isArray(r.competitors)       ? [...new Set([...(f.competitors||[]),      ...(r.competitors       as string[])])]  : f.competitors,
      websiteUrl:        websiteUrl,
    }))
    setShowScanPreview(false)
    setScanResult(null)
  }

  // ── handleAnalyzeContent ──────────────────────────────────────
  const handleAnalyzeContent = async () => {
    const valid = contentSamples.filter(s => s.trim())
    if (valid.length === 0) return
    setAnalyzing(true)
    setAnalyzeError(null)
    setAnalyzeResult(null)
    setShowAnalyzePreview(false)
    try {
      const res = await fetch('/api/brand/analyze-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
        body: JSON.stringify({ samples: valid }),
      })
      const data = await res.json()
      if (res.status === 402) {
        setAnalyzeError(locale === 'ar' ? 'رصيد غير كافٍ — يرجى الترقية' : 'Not enough credits — please upgrade')
        return
      }
      if (!res.ok) {
        setAnalyzeError(data.error || (locale === 'ar' ? 'حدث خطأ، حاول مرة أخرى' : 'Something went wrong'))
        return
      }
      setAnalyzeResult(data.extracted)
      setShowAnalyzePreview(true)
    } catch {
      setAnalyzeError(locale === 'ar' ? 'تعذّر الاتصال، حاول مرة أخرى' : 'Connection failed, please try again')
    } finally {
      setAnalyzing(false)
    }
  }

  const applyAnalyzeResult = () => {
    if (!analyzeResult) return
    const r = analyzeResult as Record<string, unknown>
    setForm(f => ({
      ...f,
      writingStyle:      r.writingStyle      ? String(r.writingStyle)      : f.writingStyle,
      strategicNotes:    r.strategicNotes    ? (f.strategicNotes ? `${f.strategicNotes}\n\n${String(r.strategicNotes)}` : String(r.strategicNotes)) : f.strategicNotes,
      winningHooks:      Array.isArray(r.winningHooks)       ? [...new Set([...(f.winningHooks||[]),       ...(r.winningHooks       as string[])])] : f.winningHooks,
      winningAngles:     Array.isArray(r.winningAngles)      ? [...new Set([...(f.winningAngles||[]),      ...(r.winningAngles      as string[])])] : f.winningAngles,
      toneKeywords:      Array.isArray(r.toneKeywords)       ? [...new Set([...(f.toneKeywords||[]),       ...(r.toneKeywords       as string[])])] : f.toneKeywords,
      audiencePainPoints:Array.isArray(r.audiencePainPoints) ? [...new Set([...(f.audiencePainPoints||[]),...(r.audiencePainPoints  as string[])])] : f.audiencePainPoints,
      audienceDesires:   Array.isArray(r.audienceDesires)    ? [...new Set([...(f.audienceDesires||[]),   ...(r.audienceDesires    as string[])])] : f.audienceDesires,
      contentSamples:    contentSamples.filter(s => s.trim()),
    }))
    setShowAnalyzePreview(false)
    setAnalyzeResult(null)
  }

  const { score, missing } = getBrandCompleteness(form, locale)
  const currentStepIdx = STEPS.findIndex(s => s.id === step)
  const currentStep    = STEPS[currentStepIdx] ?? STEPS[0]
  const scoreColor     = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'

  if (authLoading || loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#06071A' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', boxShadow: '0 0 30px rgba(245,158,11,0.1)' }}>
          <Brain size={28} className="text-amber-400 animate-pulse" />
        </div>
        <Loader2 className="animate-spin text-amber-400/60" size={18} />
      </div>
    </div>
  )
  if (!isAuthenticated) return null

  return (
    <AppShell>
      {showSummary && (
        <BrandSummaryCard
          form={form} score={score} locale={locale}
          t={t as (k: string) => string}
          onClose={() => setShowSummary(false)}
        />
      )}
      <div className="relative min-h-screen" dir={dir}>

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-5">

          {/* ── Marketing Brief Focus Banner ───────────────────── */}
          {fromBrief && !briefBannerDismissed && (
            <div className="rounded-2xl overflow-hidden"
              style={{ background: '#FFFFFF', border: '1px solid rgba(94,92,230,0.18)', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
              <div className="h-0.5" style={{ background: 'linear-gradient(90deg, #8b5cf6, #06b6d4)' }} />
              <div className="p-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: '#F5F3FF', border: '1px solid rgba(94,92,230,0.18)' }}>
                    <Sparkles className="w-4 h-4" style={{ color: '#5E5CE6' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold mb-0.5 text-slate-950">
                      {locale === 'ar' ? 'NEXUS يقترح إكمال هذه البيانات' : 'NEXUS recommends completing these fields'}
                    </p>
                    <p className="text-xs leading-relaxed text-slate-500">
                      {locale === 'ar'
                        ? 'اكتمال Brand Brain يرفع نضج نظامك التسويقي ويجعل كل الوكلاء يعملون بشكل أذكى.'
                        : 'A complete Brand Brain raises your marketing maturity score and makes every agent smarter.'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setBriefBannerDismissed(true)}
                  className="p-1.5 rounded-lg transition-all hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex-shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              HERO HEADER CARD
              ══════════════════════════════════════════════════════ */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>

            {/* Gradient top bar */}
            <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #f59e0b 0%, #8b5cf6 50%, #06b6d4 100%)' }} />

            <div className="p-6">
              {/* Eyebrow */}
              <div className="flex items-center gap-2 mb-5">
                <div className="w-1 h-3.5 rounded-full" style={{ background: 'linear-gradient(180deg, #f59e0b, #f59e0b80)' }} />
                <span className="text-xs font-mono font-bold tracking-[0.2em] uppercase" style={{ color: 'rgba(245,158,11,0.65)' }}>
                  NEXUS BRAND BRAIN
                </span>
              </div>

              <div className="flex items-center justify-between gap-6 flex-wrap">
                {/* Icon + title */}
                <div className="flex items-center gap-5">
                  <div className="relative flex-shrink-0">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                      style={{ background: '#FFFBEB', border: '1px solid rgba(245,158,11,0.22)' }}>
                      <Brain size={30} className="text-amber-400" />
                    </div>
                    {score >= 80 && (
                      <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 0 14px rgba(16,185,129,0.5)' }}>
                        <Check size={12} className="text-white" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1.5">
                      <h1 className="text-3xl font-black text-slate-950 tracking-tight">Brand Brain</h1>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                        style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' }}>
                        {t('brand.badgeMemory')}
                      </span>
                    </div>
                    <p className="text-sm max-w-xs text-slate-500">{t('brand.aiInjected')}</p>
                  </div>
                </div>

                {/* Score ring + save */}
                <div className="flex items-center gap-6">
                  <div className="flex items-end gap-3">
                    <div className="flex flex-col items-center gap-1.5">
                    <ScoreRing score={score} />
                    <span className="text-xs font-bold" style={{ color: scoreColor }}>
                      {score >= 80 ? t('brand.scoreActiveBrain') :
                       score >= 50 ? t('brand.scoreBuilding') :
                       t('brand.scoreNeedsData')}
                    </span>
                  </div>
                  <ScoreSparkline history={scoreHistory} />
                  </div>
                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-60"
                    style={{
                      background: saved ? 'rgba(16,185,129,0.15)' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      color: saved ? '#10b981' : '#0a0a0a',
                      boxShadow: 'none',
                      border: saved ? '1px solid rgba(16,185,129,0.35)' : 'none',
                    }}>
                    {saving ? <Loader2 size={15} className="animate-spin"/> : saved ? <CheckCircle2 size={15}/> : <Save size={15}/>}
                    {saving ? t('brand.savingBtn') : saved ? t('brand.savedBtn') : t('brand.saveAllBtn')}
                  </button>
                  <button onClick={() => router.push('/brand/score-history')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
                    style={{ background: '#F5F3FF', border: '1px solid rgba(94,92,230,0.18)', color: '#5E5CE6' }}>
                    <BarChart2 size={13} />
                    {locale === 'ar' ? 'سجل النمو' : 'Score History'}
                  </button>
                </div>
              </div>

              {/* Progress bar + missing */}
              <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(15,23,42,0.08)' }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={12} className="text-amber-400" />
                    <span className="text-xs font-semibold text-slate-600">{t('brand.completeness')}</span>
                  </div>
                  {missing.length > 0 && (
                    <span className="text-xs text-slate-500">
                      {t('brand.missing')} {missing.slice(0,3).join(locale==='ar'?'، ':' · ')}{missing.length>3?'...':''}
                    </span>
                  )}
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#E2E8F0' }}>
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width:`${score}%`, background:score>=80?'linear-gradient(90deg,#10b981,#059669)':score>=50?'linear-gradient(90deg,#f59e0b,#d97706)':'linear-gradient(90deg,#ef4444,#dc2626)' }}/>
                </div>
              </div>

              {/* Next step — one clear instruction based on completion state */}
              <div className="flex items-center gap-2 mt-4 px-4 py-3 rounded-xl"
                style={{ background:'#F5F3FF', border:'1px solid rgba(94,92,230,0.18)' }}>
                <Sparkles size={14} style={{ color:'#5E5CE6' }} className="flex-shrink-0"/>
                {score >= 80 ? (
                  <p className="text-xs text-slate-600">
                    {locale === 'ar' ? 'ذاكرة علامتك جاهزة. الخطوة التالية: ' : 'Your brand memory is ready. Next step: '}
                    <button onClick={() => router.push('/campaigns/new')} className="font-bold underline" style={{ color:'#5E5CE6' }}>
                      {locale === 'ar' ? 'أنشئ حملة' : 'create a campaign'}
                    </button>
                    {locale === 'ar' ? ' — سيستخدم NEXUS هذه الذاكرة.' : ' — NEXUS will use this memory.'}
                  </p>
                ) : missing.length > 0 ? (
                  <p className="text-xs text-slate-600">
                    {locale === 'ar' ? 'الخطوة التالية: أكمل ' : 'Next step: complete '}
                    <span className="font-semibold" style={{ color:'#5E5CE6' }}>
                      {missing.slice(0,2).join(locale==='ar'?'، ':' & ')}
                    </span>
                    {locale === 'ar'
                      ? ' — أو امسح موقعك أدناه لتعبئتها تلقائياً.'
                      : ' — or scan your website below to auto-fill it.'}
                  </p>
                ) : (
                  <p className="text-xs text-slate-600">
                    {locale === 'ar'
                      ? 'الخطوة التالية: راجع الحقول وفعّل الحفظ لتقوية ذاكرة العلامة.'
                      : 'Next step: review your fields and save to strengthen your brand memory.'}
                  </p>
                )}
              </div>

              {score < 60 && (
                <div className="flex items-center gap-2 mt-4 px-4 py-3 rounded-xl"
                  style={{ background:'#FFFBEB', border:'1px solid rgba(245,158,11,0.22)' }}>
                  <AlertTriangle size={14} className="text-amber-500 flex-shrink-0"/>
                  <p className="text-xs text-amber-800">{t('brand.lowCompletenessWarning')}</p>
                </div>
              )}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════
              WHAT NEXUS LEARNED — timeline (Operator Foundation PR-1B)
              ══════════════════════════════════════════════════════ */}
          <BrainTimeline onUpdate={refreshBrainAfterLearning} />

          {/* ══════════════════════════════════════════════════════
              WEBSITE INTELLIGENCE SCANNER
              ══════════════════════════════════════════════════════ */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
            <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #06b6d4 0%, #8b5cf6 100%)' }} />
            <div className="p-5">
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: '#ECFEFF', border: '1px solid rgba(8,145,178,0.18)' }}>
                  <ScanSearch size={17} style={{ color: '#06b6d4' }} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-950">
                      {locale === 'ar' ? 'مسح الموقع الإلكتروني' : 'Website Intelligence Scanner'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: 'rgba(6,182,212,0.12)', color: '#67e8f9', border: '1px solid rgba(6,182,212,0.2)' }}>
                      3 {locale === 'ar' ? 'كردت' : 'credits'}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5 text-slate-500">
                    {locale === 'ar'
                      ? 'أدخل رابط موقعك — سيحلله الذكاء الاصطناعي ويملأ Brand Brain تلقائياً'
                      : 'Enter your website URL — AI reads your pages and auto-fills Brand Brain fields'}
                  </p>
                </div>
              </div>

              {/* URL input + scan button */}
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 rounded-xl"
                  style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.10)', height: 42 }}>
                  <Link2 size={14} style={{ color: '#64748B', flexShrink: 0 }} />
                  <input
                    type="url"
                    value={websiteUrl}
                    onChange={e => setWebsiteUrl(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !scanning && handleScanWebsite()}
                    placeholder={locale === 'ar' ? 'https://your-brand.com' : 'https://your-brand.com'}
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                    style={{ color: '#0F172A', direction: 'ltr' }}
                  />
                </div>
                <button
                  onClick={handleScanWebsite}
                  disabled={scanning || !websiteUrl.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-50 flex-shrink-0"
                  style={{
                    background: scanning ? '#ECFEFF' : '#111827',
                    color: scanning ? '#0891B2' : '#FFFFFF',
                    boxShadow: 'none',
                  }}>
                  {scanning
                    ? <><Loader2 size={14} className="animate-spin" /> {locale === 'ar' ? 'جاري المسح...' : 'Scanning...'}</>
                    : <><ScanSearch size={14} /> {locale === 'ar' ? 'مسح' : 'Scan'}</>
                  }
                </button>
              </div>

              {/* Error */}
              {scanError && (
                <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-xl"
                  style={{ background: '#FEF2F2', border: '1px solid rgba(220,38,38,0.18)' }}>
                  <AlertTriangle size={13} className="text-red-600 flex-shrink-0" />
                  <span className="text-xs text-red-700">{scanError}</span>
                </div>
              )}

              {/* Scan preview */}
              {showScanPreview && scanResult && (
                <div className="mt-4 rounded-xl overflow-hidden"
                  style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.08)' }}>
                  <div className="px-4 py-3 flex items-center justify-between"
                    style={{ borderBottom: '1px solid rgba(6,182,212,0.1)' }}>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={14} style={{ color: '#06b6d4' }} />
                      <span className="text-xs font-bold" style={{ color: '#0891B2' }}>
                        {locale === 'ar' ? 'تم استخراج بيانات الموقع' : 'Website data extracted'}
                      </span>
                    </div>
                    <button onClick={() => setShowScanPreview(false)}>
                      <X size={14} style={{ color: '#475569' }} />
                    </button>
                  </div>
                  <div className="p-4 space-y-2">
                    {[
                      { k: 'brandName',      label: locale === 'ar' ? 'اسم العلامة' : 'Brand Name' },
                      { k: 'industry',       label: locale === 'ar' ? 'المجال'       : 'Industry' },
                      { k: 'primaryOffer',   label: locale === 'ar' ? 'المنتج الرئيسي' : 'Primary Offer' },
                      { k: 'targetAudience', label: locale === 'ar' ? 'الجمهور المستهدف' : 'Target Audience' },
                      { k: 'writingStyle',   label: locale === 'ar' ? 'أسلوب الكتابة'   : 'Writing Style' },
                    ].map(({ k, label }) => scanResult[k] ? (
                      <div key={k} className="flex gap-2 text-xs">
                        <span className="flex-shrink-0 font-semibold" style={{ color: '#475569', width: 120 }}>{label}</span>
                        <span className="text-slate-700">{String(scanResult[k])}</span>
                      </div>
                    ) : null)}
                    {Array.isArray(scanResult.uniqueAdvantages) && (scanResult.uniqueAdvantages as string[]).length > 0 && (
                      <div className="flex gap-2 text-xs">
                        <span className="flex-shrink-0 font-semibold" style={{ color: '#475569', width: 120 }}>
                          {locale === 'ar' ? 'مزايا فريدة' : 'Unique Advantages'}
                        </span>
                        <span className="text-slate-700">{(scanResult.uniqueAdvantages as string[]).slice(0,3).join(' · ')}</span>
                      </div>
                    )}
                    {Array.isArray(scanResult.toneKeywords) && (scanResult.toneKeywords as string[]).length > 0 && (
                      <div className="flex gap-2 text-xs">
                        <span className="flex-shrink-0 font-semibold" style={{ color: '#475569', width: 120 }}>
                          {locale === 'ar' ? 'نبرة الصوت' : 'Tone Keywords'}
                        </span>
                        <span className="text-slate-700">{(scanResult.toneKeywords as string[]).join(', ')}</span>
                      </div>
                    )}
                  </div>
                  <div className="px-4 pb-4 flex gap-2">
                    <button
                      onClick={applyScanResult}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                      style={{ background: '#111827', color: '#FFFFFF' }}>
                      <Check size={12} strokeWidth={3} />
                      {locale === 'ar' ? 'تطبيق على Brand Brain' : 'Apply to Brand Brain'}
                    </button>
                    <button
                      onClick={() => setShowScanPreview(false)}
                      className="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                      style={{ background: 'rgba(139,92,246,0.08)', color: '#64748b', border: '1px solid rgba(139,92,246,0.12)' }}>
                      {locale === 'ar' ? 'تجاهل' : 'Dismiss'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════
              CONTENT SAMPLES ANALYZER
              ══════════════════════════════════════════════════════ */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
            <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #8b5cf6 0%, #ec4899 100%)' }} />
            <div className="p-5">
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: '#F5F3FF', border: '1px solid rgba(94,92,230,0.18)' }}>
                  <FileText size={17} style={{ color: '#a78bfa' }} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-950">
                      {locale === 'ar' ? 'تحليل المحتوى الناجح' : 'Content Samples Analyzer'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: '#F5F3FF', color: '#5E5CE6', border: '1px solid rgba(94,92,230,0.18)' }}>
                      2 {locale === 'ar' ? 'كردت' : 'credits'}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5 text-slate-500">
                    {locale === 'ar'
                      ? 'الصق أفضل محتواك — سيستخرج الذكاء أنماط الـ hooks والأسلوب والزوايا الناجحة'
                      : 'Paste your best-performing content — AI extracts hooks, angles, and tone patterns'}
                  </p>
                </div>
              </div>

              {/* 3 text areas */}
              <div className="space-y-2 mb-3">
                {(Array.isArray(contentSamples) ? contentSamples : ['', '', '']).map((sample, i) => (
                  <div key={i}>
                    <div className="text-[10px] font-mono mb-1" style={{ color: '#334155' }}>
                      {locale === 'ar' ? `نموذج ${i + 1}` : `Sample ${i + 1}`}
                    </div>
                    <textarea
                      value={sample}
                      onChange={e => {
                        const next = [...contentSamples]
                        next[i] = e.target.value
                        setContentSamples(next)
                      }}
                      rows={3}
                      placeholder={locale === 'ar'
                        ? 'الصق هنا caption أو إعلان أو سكريبت أثبت نجاحه...'
                        : 'Paste a caption, ad, email, or script that performed well...'}
                      className="w-full px-3 py-2.5 rounded-xl text-xs outline-none resize-none placeholder:text-slate-400"
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid rgba(15,23,42,0.10)',
                        color: '#0F172A',
                        caretColor: '#a78bfa',
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Analyze button */}
              <button
                onClick={handleAnalyzeContent}
                disabled={analyzing || contentSamples.every(s => !s.trim())}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-50"
                style={{
                  background: analyzing ? '#F5F3FF' : '#111827',
                  color: analyzing ? '#5E5CE6' : '#ffffff',
                  boxShadow: 'none',
                }}>
                {analyzing
                  ? <><Loader2 size={14} className="animate-spin" /> {locale === 'ar' ? 'جاري التحليل...' : 'Analyzing...'}</>
                  : <><Sparkles size={14} /> {locale === 'ar' ? 'تحليل المحتوى' : 'Analyze Content'}</>
                }
              </button>

              {/* Error */}
              {analyzeError && (
                <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-xl"
                  style={{ background: '#FEF2F2', border: '1px solid rgba(220,38,38,0.18)' }}>
                  <AlertTriangle size={13} className="text-red-600 flex-shrink-0" />
                  <span className="text-xs text-red-700">{analyzeError}</span>
                </div>
              )}

              {/* Analyze preview */}
              {showAnalyzePreview && analyzeResult && (
                <div className="mt-4 rounded-xl overflow-hidden"
                  style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.08)' }}>
                  <div className="px-4 py-3 flex items-center justify-between"
                    style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={14} style={{ color: '#a78bfa' }} />
                      <span className="text-xs font-bold" style={{ color: '#5E5CE6' }}>
                        {locale === 'ar' ? 'تم استخراج أنماط المحتوى' : 'Content patterns extracted'}
                      </span>
                    </div>
                    <button onClick={() => setShowAnalyzePreview(false)}>
                      <X size={14} style={{ color: '#475569' }} />
                    </button>
                  </div>
                  <div className="p-4 space-y-2.5">
                    {Array.isArray(analyzeResult.winningHooks) && (analyzeResult.winningHooks as string[]).length > 0 && (
                      <div>
                        <div className="text-[10px] font-mono font-bold mb-1.5" style={{ color: '#a78bfa' }}>
                          {locale === 'ar' ? 'الـ HOOKS الناجحة' : 'WINNING HOOKS'}
                        </div>
                        <div className="space-y-1">
                          {(analyzeResult.winningHooks as string[]).slice(0, 3).map((h, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs text-slate-700">
                              <ChevronRight size={11} style={{ color: '#a78bfa', flexShrink: 0, marginTop: 2 }} />
                              <span>{h}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {!!analyzeResult.writingStyle && (
                      <div className="flex gap-2 text-xs">
                        <span className="flex-shrink-0 font-semibold" style={{ color: '#475569', width: 120 }}>
                          {locale === 'ar' ? 'أسلوب الكتابة' : 'Writing Style'}
                        </span>
                        <span className="text-slate-700">{String(analyzeResult.writingStyle)}</span>
                      </div>
                    )}
                    {Array.isArray(analyzeResult.toneKeywords) && (analyzeResult.toneKeywords as string[]).length > 0 && (
                      <div className="flex gap-2 text-xs">
                        <span className="flex-shrink-0 font-semibold" style={{ color: '#475569', width: 120 }}>
                          {locale === 'ar' ? 'نبرة الصوت' : 'Tone Keywords'}
                        </span>
                        <span className="text-slate-700">{(analyzeResult.toneKeywords as string[]).join(', ')}</span>
                      </div>
                    )}
                    {Array.isArray(analyzeResult.winningAngles) && (analyzeResult.winningAngles as string[]).length > 0 && (
                      <div className="flex gap-2 text-xs">
                        <span className="flex-shrink-0 font-semibold" style={{ color: '#475569', width: 120 }}>
                          {locale === 'ar' ? 'زوايا المحتوى' : 'Content Angles'}
                        </span>
                        <span className="text-slate-700">{(analyzeResult.winningAngles as string[]).slice(0,3).join(' · ')}</span>
                      </div>
                    )}
                  </div>
                  <div className="px-4 pb-4 flex gap-2">
                    <button
                      onClick={applyAnalyzeResult}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                      style={{ background: '#111827', color: '#ffffff' }}>
                      <Check size={12} strokeWidth={3} />
                      {locale === 'ar' ? 'تطبيق على Brand Brain' : 'Apply to Brand Brain'}
                    </button>
                    <button
                      onClick={() => setShowAnalyzePreview(false)}
                      className="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                      style={{ background: 'rgba(139,92,246,0.08)', color: '#64748b', border: '1px solid rgba(139,92,246,0.12)' }}>
                      {locale === 'ar' ? 'تجاهل' : 'Dismiss'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════
              STEP STEPPER
              ══════════════════════════════════════════════════════ */}
          <div className="rounded-2xl p-3"
            style={{ background:'#FFFFFF', border:'1px solid rgba(15,23,42,0.08)', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
            <div className="flex gap-1.5 overflow-x-auto">
              {STEPS.map((s, idx) => {
                const active    = step === s.id
                const fieldVal  = form[s.fieldCheck]
                const completed = fieldVal && (Array.isArray(fieldVal) ? (fieldVal as string[]).length > 0 : String(fieldVal).length > 0)
                return (
                  <button key={s.id} onClick={() => setStep(s.id)}
                    className="flex-1 min-w-[80px] flex flex-col items-center gap-2 px-2 py-3 rounded-xl transition-all duration-200"
                    style={{
                      background: active ? `${s.color}10` : '#FFFFFF',
                      border: `1px solid ${active ? s.color+'35' : 'rgba(15,23,42,0.08)'}`,
                      boxShadow: 'none',
                    }}>
                    <div className="relative">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200"
                        style={{
                          background: active ? `${s.color}14` : completed ? `${s.color}0e` : '#F8FAFC',
                          border: `1px solid ${active ? s.color+'40' : completed ? s.color+'25' : 'rgba(15,23,42,0.08)'}`,
                        }}>
                        <s.icon size={16} style={{ color: active ? s.color : completed ? s.color+'bb' : '#334155' }}/>
                      </div>
                      {completed && !active && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                          style={{ background: s.color, boxShadow:`0 0 6px ${s.color}60` }}>
                          <Check size={9} className="text-white" strokeWidth={3}/>
                        </div>
                      )}
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] font-mono mb-0.5" style={{ color: active ? s.color+'99' : 'rgba(71,85,105,0.5)' }}>
                        0{idx+1}
                      </div>
                      <div className="text-xs font-semibold leading-tight" style={{ color: active ? s.color : completed ? '#64748b' : '#334155' }}>
                        {t(s.labelKey)}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════
              STEP CONTENT CARD
              ══════════════════════════════════════════════════════ */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background:'#FFFFFF', border:`1px solid rgba(15,23,42,0.08)`, boxShadow:'0 1px 2px rgba(15,23,42,0.04)' }}>

            {/* Step color top accent */}
            <div className="h-0.5" style={{ background:`linear-gradient(90deg, ${currentStep.color} 0%, ${currentStep.color}00 60%)` }}/>

            {/* Step header */}
            <div className="flex items-center gap-4 px-6 pt-5 pb-4"
              style={{ borderBottom:`1px solid rgba(15,23,42,0.08)` }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background:`${currentStep.color}18`, border:`1px solid ${currentStep.color}35`, boxShadow:`0 0 20px ${currentStep.color}15` }}>
                <currentStep.icon size={22} style={{ color:currentStep.color }}/>
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-slate-950">{t(currentStep.labelKey)}</h2>
                <p className="text-xs mt-0.5 text-slate-500">{t(currentStep.descKey)}</p>
              </div>
              <div className="text-xs font-mono font-bold px-3 py-1.5 rounded-lg flex-shrink-0"
                style={{ background:`${currentStep.color}0e`, color:`${currentStep.color}bb`, border:`1px solid ${currentStep.color}20` }}>
                {currentStepIdx+1} / {STEPS.length}
              </div>
            </div>

            {/* AI Suggest error banner */}
            {suggestError && (
              <div className="mx-6 mt-3 flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl"
                style={{ background: '#FEF2F2', border: '1px solid rgba(220,38,38,0.18)' }}>
                <div className="flex items-center gap-2">
                  <AlertTriangle size={13} className="text-red-600 flex-shrink-0"/>
                  <span className="text-xs font-medium text-red-700">{suggestError}</span>
                </div>
                <button onClick={() => setSuggestError(null)} className="text-xs opacity-50 hover:opacity-100 transition-opacity text-red-700">✕</button>
              </div>
            )}

            {/* Form content */}
            <div className="p-6 space-y-5">

              {step === 'identity' && (
                <div className="space-y-5">

                  {/* ── Brand Logo Upload ──────────────────────────── */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748B' }}>
                      {locale === 'ar' ? 'شعار العلامة التجارية' : 'Brand Logo'}
                    </label>
                    <div className="flex items-center gap-4">
                      {/* Logo preview */}
                      <div className="relative flex-shrink-0">
                        {form.logoUrl ? (
                          <div className="w-16 h-16 rounded-2xl overflow-hidden"
                            style={{ border: '2px solid rgba(245,158,11,0.4)', boxShadow: '0 0 20px rgba(245,158,11,0.15)' }}>
                            <img src={form.logoUrl} alt="Brand logo"
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                            style={{ background: '#F8FAFC', border: '2px dashed rgba(15,23,42,0.12)' }}>
                            <ImageIcon size={22} style={{ color: 'rgba(139,92,246,0.35)' }} />
                          </div>
                        )}
                        {logoUploading && (
                          <div className="absolute inset-0 rounded-2xl flex items-center justify-center"
                            style={{ background: 'rgba(255,255,255,0.75)' }}>
                            <Loader2 size={18} className="animate-spin" style={{ color: '#f59e0b' }} />
                          </div>
                        )}
                      </div>

                      {/* Upload button + hint */}
                      <div className="flex flex-col gap-2">
                        <label className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                          style={{
                            background: logoUploading ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.12)',
                            border: '1px solid rgba(245,158,11,0.3)',
                            color: logoUploading ? 'rgba(245,158,11,0.4)' : '#f59e0b',
                            pointerEvents: logoUploading ? 'none' : 'auto',
                          }}>
                          <Upload size={13} />
                          {locale === 'ar' ? 'رفع الشعار' : 'Upload Logo'}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                            className="hidden"
                            disabled={logoUploading}
                            onChange={e => {
                              const f = e.target.files?.[0]
                              if (f) handleLogoUpload(f)
                              e.target.value = ''
                            }}
                          />
                        </label>
                        <p className="text-[10px]" style={{ color: '#334155' }}>
                          {locale === 'ar' ? 'PNG, JPG, WebP أو SVG · حتى 5 ميجا' : 'PNG, JPG, WebP or SVG · max 5 MB'}
                        </p>
                        {form.logoUrl && !logoUploading && (
                          <button onClick={() => { set('logoUrl', null) }}
                            className="text-[10px] font-semibold transition-all"
                            style={{ color: '#ef4444', textAlign: 'left' }}>
                            {locale === 'ar' ? '✕ إزالة الشعار' : '✕ Remove logo'}
                          </button>
                        )}
                      </div>
                    </div>
                    {logoError && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                        <AlertTriangle size={12} style={{ color: '#f87171' }} />
                        <span className="text-xs" style={{ color: '#fca5a5' }}>{logoError}</span>
                      </div>
                    )}
                  </div>

                  <Field label={t('brand.identityBrandNameLabel')}>
                    <NxInput value={form.brandName||''} onChange={v=>set('brandName',v)}
                      placeholder={t('brand.identityBrandNamePlaceholder')} accentColor={currentStep.color}/>
                  </Field>
                  <Field label={t('brand.identityIndustryLabel')}>
                      <div className="relative">
                      <select value={form.industry||''} onChange={e=>set('industry',e.target.value)}
                        className="w-full appearance-none px-4 py-3 rounded-xl text-sm focus:outline-none transition-all"
                        style={{ background:'#FFFFFF', border:'1px solid rgba(15,23,42,0.10)', color:form.industry?'#0F172A':'#94A3B8' }}>
                        <option value="">{t('brand.identityIndustryPlaceholder')}</option>
                        {(locale==='ar'?INDUSTRIES_AR:INDUSTRIES_EN).map((ind,idx)=>(
                          <option key={idx} value={ind}>{ind}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{color:'#4b5563'}}/>
                    </div>
                  </Field>
                  <Field label={t('brand.identityDescLabel')}
                    onSuggest={() => handleSuggestText('description')}
                    suggesting={suggesting === 'description'} accentColor={currentStep.color}>
                    <NxInput textarea value={form.description||''} onChange={v=>set('description',v)}
                      placeholder={t('brand.identityDescPlaceholder')} accentColor={currentStep.color}/>
                  </Field>
                  {textSuggestion?.field === 'description' && (
                    <SuggestionCard suggestion={textSuggestion.text}
                      onAccept={() => { set('description', textSuggestion.text); setTextSuggestion(null) }}
                      onDismiss={() => setTextSuggestion(null)} accent={currentStep.color} locale={locale}/>
                  )}
                  <Field label={t('brand.identityNotesLabel')}>
                    <NxInput textarea value={form.strategicNotes||''} onChange={v=>set('strategicNotes',v)}
                      placeholder={t('brand.identityNotesPlaceholder')} accentColor={currentStep.color}/>
                  </Field>
                </div>
              )}

              {step === 'product' && (
                <div className="space-y-5">
                  <Field label={t('brand.productPrimaryLabel')}
                    onSuggest={() => handleSuggestText('primaryOffer')}
                    suggesting={suggesting === 'primaryOffer'} accentColor={currentStep.color}>
                    <NxInput textarea value={form.primaryOffer||''} onChange={v=>set('primaryOffer',v)}
                      placeholder={t('brand.productPrimaryPlaceholder')} accentColor={currentStep.color}/>
                  </Field>
                  {textSuggestion?.field === 'primaryOffer' && (
                    <SuggestionCard suggestion={textSuggestion.text}
                      onAccept={() => { set('primaryOffer', textSuggestion.text); setTextSuggestion(null) }}
                      onDismiss={() => setTextSuggestion(null)} accent={currentStep.color} locale={locale}/>
                  )}
                  <TagInput label={t('brand.productSecondaryLabel')} placeholder={t('brand.productSecondaryPlaceholder')}
                    values={form.secondaryOffers||[]} onChange={v=>set('secondaryOffers',v)} accentColor={currentStep.color}
                    onSuggest={() => handleSuggest('secondaryOffers')} suggesting={suggesting==='secondaryOffers'} locale={locale}/>
                  <Field label={t('brand.productPriceLabel')}>
                    <RadioGroup options={PRICE_OPTIONS.map(o=>({v:o.v,l:locale==='ar'?o.l:o.lEn}))}
                      value={form.pricePoint||''} onChange={v=>set('pricePoint',v)} color={currentStep.color}/>
                  </Field>
                  <TagInput label={t('brand.productAdvantagesLabel')} placeholder={t('brand.productAdvantagesPlaceholder')}
                    values={form.uniqueAdvantages||[]} onChange={v=>set('uniqueAdvantages',v)} accentColor={currentStep.color}
                    onSuggest={() => handleSuggest('uniqueAdvantages')} suggesting={suggesting==='uniqueAdvantages'} locale={locale}/>
                </div>
              )}

              {step === 'audience' && (
                <div className="space-y-5">
                  <Field label={t('brand.audienceDescLabel')}
                    onSuggest={() => handleSuggestText('targetAudience')}
                    suggesting={suggesting === 'targetAudience'} accentColor={currentStep.color}>
                    <NxInput textarea value={form.targetAudience||''} onChange={v=>set('targetAudience',v)}
                      placeholder={t('brand.audienceDescPlaceholder')} accentColor={currentStep.color}/>
                  </Field>
                  {textSuggestion?.field === 'targetAudience' && (
                    <SuggestionCard suggestion={textSuggestion.text}
                      onAccept={() => { set('targetAudience', textSuggestion.text); setTextSuggestion(null) }}
                      onDismiss={() => setTextSuggestion(null)} accent={currentStep.color} locale={locale}/>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label={t('brand.audienceAgeLabel')}>
                      <div className="flex flex-wrap gap-2">
                        {(locale==='ar'?AGE_OPTIONS_AR:AGE_OPTIONS_EN).map(a=>(
                          <button key={a} onClick={()=>set('audienceAge',a)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                            style={{
                              background:form.audienceAge===a?`${currentStep.color}12`:'#FFFFFF',
                              border:`1px solid ${form.audienceAge===a?currentStep.color+'45':'rgba(15,23,42,0.10)'}`,
                              color:form.audienceAge===a?currentStep.color:'#64748b',
                              boxShadow:form.audienceAge===a?`0 0 10px ${currentStep.color}18`:'none',
                            }}>
                            {form.audienceAge===a&&'● '}{a}
                          </button>
                        ))}
                      </div>
                    </Field>
                    <Field label={t('brand.audienceLocationLabel')}>
                      <NxInput value={form.audienceLocation||''} onChange={v=>set('audienceLocation',v)}
                        placeholder={t('brand.audienceLocationPlaceholder')} accentColor={currentStep.color}/>
                    </Field>
                  </div>
                  <TagInput label={t('brand.audiencePainLabel')} placeholder={t('brand.audiencePainPlaceholder')}
                    values={form.audiencePainPoints||[]} onChange={v=>set('audiencePainPoints',v)} accentColor={currentStep.color}
                    onSuggest={() => handleSuggest('audiencePainPoints')} suggesting={suggesting==='audiencePainPoints'} locale={locale}/>
                  <TagInput label={t('brand.audienceDesireLabel')} placeholder={t('brand.audienceDesirePlaceholder')}
                    values={form.audienceDesires||[]} onChange={v=>set('audienceDesires',v)} accentColor={currentStep.color}
                    onSuggest={() => handleSuggest('audienceDesires')} suggesting={suggesting==='audienceDesires'} locale={locale}/>
                </div>
              )}

              {step === 'voice' && (
                <div className="space-y-5">
                  <Field label={t('brand.voiceToneLabel')}>
                    <ToggleGrid options={locale==='ar'?TONE_OPTIONS_AR:TONE_OPTIONS_EN}
                      selected={form.toneKeywords||[]} onChange={v=>set('toneKeywords',v)} color={currentStep.color}/>
                  </Field>
                  <Field label={t('brand.voiceStyleLabel')}
                    onSuggest={() => handleSuggestText('writingStyle')}
                    suggesting={suggesting === 'writingStyle'} accentColor={currentStep.color}>
                    <NxInput value={form.writingStyle||''} onChange={v=>set('writingStyle',v)}
                      placeholder={t('brand.voiceStylePlaceholder')} accentColor={currentStep.color}/>
                  </Field>
                  {textSuggestion?.field === 'writingStyle' && (
                    <SuggestionCard suggestion={textSuggestion.text}
                      onAccept={() => { set('writingStyle', textSuggestion.text); setTextSuggestion(null) }}
                      onDismiss={() => setTextSuggestion(null)} accent={currentStep.color} locale={locale}/>
                  )}
                  <TagInput label={t('brand.voiceAvoidLabel')} placeholder={t('brand.voiceAvoidPlaceholder')}
                    values={form.avoidKeywords||[]} onChange={v=>set('avoidKeywords',v)} accentColor={currentStep.color}
                    onSuggest={() => handleSuggest('avoidKeywords')} suggesting={suggesting==='avoidKeywords'} locale={locale}/>
                  <TagInput label={t('brand.voiceHooksLabel')} placeholder={t('brand.voiceHooksPlaceholder')}
                    values={form.winningHooks||[]} onChange={v=>set('winningHooks',v)} accentColor={currentStep.color}
                    onSuggest={() => handleSuggest('winningHooks')} suggesting={suggesting==='winningHooks'} locale={locale}/>
                </div>
              )}

              {step === 'platforms' && (
                <div className="space-y-5">
                  <Field label={t('brand.platformsActiveLabel')}>
                    <ToggleGrid options={PLATFORMS_LIST} selected={form.topPlatforms||[]}
                      onChange={v=>set('topPlatforms',v)} color={currentStep.color}/>
                  </Field>
                  <Field label={t('brand.platformsVisualLabel')}>
                    <div className="flex flex-wrap gap-2">
                      {['minimalist','bold','lifestyle','corporate','playful','luxury','editorial'].map(style=>(
                        <button key={style} onClick={()=>set('visualStyle',style)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
                          style={{
                            background:form.visualStyle===style?`${currentStep.color}12`:'#FFFFFF',
                            border:`1px solid ${form.visualStyle===style?currentStep.color+'45':'rgba(15,23,42,0.10)'}`,
                            color:form.visualStyle===style?currentStep.color:'#64748b',
                            boxShadow:form.visualStyle===style?`0 0 10px ${currentStep.color}18`:'none',
                          }}>
                          {form.visualStyle===style&&'● '}{style}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <TagInput label={t('brand.platformsAnglesLabel')} placeholder={t('brand.platformsAnglesPlaceholder')}
                    values={form.winningAngles||[]} onChange={v=>set('winningAngles',v)} accentColor={currentStep.color}
                    onSuggest={() => handleSuggest('winningAngles')} suggesting={suggesting==='winningAngles'} locale={locale}/>
                  <TagInput label={t('brand.platformsFailedLabel')} placeholder={t('brand.platformsFailedPlaceholder')}
                    values={form.failedAngles||[]} onChange={v=>set('failedAngles',v)} accentColor={currentStep.color} locale={locale}/>
                </div>
              )}

              {step === 'competitors' && (
                <div className="space-y-5">

                  {/* ── Competitor Names (monitored daily) ──────────── */}
                  <div>
                    <TagInput
                      label={locale === 'ar' ? 'أسماء المنافسين للمتابعة اليومية' : 'Competitor Names — Daily Monitoring'}
                      placeholder={locale === 'ar' ? 'اكتب اسم المنافس ثم Enter' : 'Type competitor name, then Enter'}
                      values={form.competitors||[]}
                      onChange={v => set('competitors', v)}
                      accentColor={currentStep.color}
                      locale={locale}
                    />
                    <p className="mt-1.5 text-[11px]" style={{ color: '#334155' }}>
                      {locale === 'ar'
                        ? '🔍 سيراقب NEXUS هؤلاء المنافسين يومياً عبر الأخبار ويرفع تقارير ذكاء مباشر لـ Brand Brain'
                        : '🔍 NEXUS will monitor these competitors daily via news feeds and surface intelligence proposals to Brand Brain'}
                    </p>
                  </div>

                  {/* ── Competitor Notes (freeform context) ─────────── */}
                  <Field label={t('brand.competitorsNotesLabel')}
                    onSuggest={() => handleSuggestText('competitorNotes')}
                    suggesting={suggesting === 'competitorNotes'} accentColor={currentStep.color}>
                    <NxInput textarea value={form.competitorNotes||''} onChange={v=>set('competitorNotes',v)}
                      placeholder={t('brand.competitorsNotesPlaceholder')} accentColor={currentStep.color}/>
                  </Field>
                  {textSuggestion?.field === 'competitorNotes' && (
                    <SuggestionCard suggestion={textSuggestion.text}
                      onAccept={() => { set('competitorNotes', textSuggestion.text); setTextSuggestion(null) }}
                      onDismiss={() => setTextSuggestion(null)} accent={currentStep.color} locale={locale}/>
                  )}
                </div>
              )}

              {/* ── Navigation ─────────────────────────────────── */}
              <div className="flex items-center justify-between pt-5"
                style={{ borderTop:'1px solid rgba(15,23,42,0.08)' }}>

                <button
                  onClick={() => currentStepIdx > 0 && setStep(STEPS[currentStepIdx-1].id)}
                  disabled={currentStepIdx === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-20"
                  style={{ color:'#64748b', background:currentStepIdx===0?'transparent':'#FFFFFF', border:currentStepIdx===0?'none':'1px solid rgba(15,23,42,0.10)' }}>
                  <ArrowRight size={14}/> {t('brand.navPrevious')}
                </button>

                {/* Morphing dots */}
                <div className="flex items-center gap-1.5">
                  {STEPS.map(s => (
                    <button key={s.id} onClick={() => setStep(s.id)}
                      className="rounded-full transition-all duration-300"
                      style={{ width:step===s.id?'22px':'6px', height:'6px', background:step===s.id?s.color:'#CBD5E1' }}/>
                  ))}
                </div>

                {currentStepIdx < STEPS.length - 1 ? (
                  <button onClick={() => setStep(STEPS[currentStepIdx+1].id)}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all"
                    style={{ color:currentStep.color, background:`${currentStep.color}10`, border:`1px solid ${currentStep.color}28`, boxShadow:`0 0 14px ${currentStep.color}10` }}>
                    {t('brand.navNext')} <ArrowLeft size={14}/>
                  </button>
                ) : (
                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-60"
                    style={{ background:'linear-gradient(135deg,#f59e0b,#d97706)', color:'#0a0a0a', boxShadow:'0 0 24px rgba(245,158,11,0.25)' }}>
                    <Zap size={14}/> {t('brand.navSaveActivate')}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ══ Strategy readiness + data requirements (PR-2A) ══
              Capture-only + advisory. Optional fields; never block the organic flow.
              No generation logic reads these — they drive calm readiness warnings. */}
          {(() => {
            const ar = locale === 'ar'
            const caps = getStrategyCapabilities(form)
            const items = [caps.contentStrategy, caps.fullStrategy, caps.paidStrategy, caps.kpiBudget, caps.funnel, caps.competitorAnalysis, caps.retargeting]
            const dot = (c: { confidence: string }) => c.confidence === 'high' ? '#10b981' : c.confidence === 'low' ? '#f59e0b' : '#94a3b8'
            // Localize the (locale-agnostic) capability ids + missing field keys here in the UI.
            const CAP_LABELS: Record<string, [string, string]> = {
              contentStrategy:     ['Content strategy',         'استراتيجية المحتوى'],
              fullStrategy:        ['Full marketing strategy',  'استراتيجية تسويق كاملة'],
              paidStrategy:        ['Paid strategy',            'استراتيجية إعلانات مدفوعة'],
              kpiBudget:           ['KPI & budget',             'مؤشرات الأداء والميزانية'],
              funnel:              ['Funnel / journey',         'مسار العميل'],
              competitorAnalysis:  ['Competitor analysis',      'تحليل المنافسين'],
              retargeting:         ['Retargeting',              'إعادة الاستهداف'],
            }
            const KEY_LABELS: Record<string, [string, string]> = {
              brandName:             ['brand name',             'اسم العلامة'],
              industry:              ['industry',               'المجال'],
              description:           ['business description',   'وصف النشاط'],
              targetAudience:        ['target customer',        'العميل المستهدف'],
              topPlatforms:          ['channels',               'القنوات'],
              businessGoal:          ['main business goal',     'الهدف التجاري'],
              primaryOffer:          ['offer',                  'العرض'],
              audienceLocation:      ['location',               'الموقع'],
              uniqueAdvantages:      ['differentiator',         'الميزة التفضيلية'],
              marketingBudget:       ['monthly budget',         'الميزانية الشهرية'],
              conversionDestination: ['conversion destination', 'وجهة التحويل'],
              leadHandling:          ['lead handling',          'إدارة العملاء المحتملين'],
              competitors:           ['competitors',            'المنافسون'],
              pixel:                 ['analytics/pixel',        'تحليلات/بكسل'],
            }
            const L = (pair?: [string, string]) => pair ? (ar ? pair[1] : pair[0]) : ''
            const capLabel = (id: string) => L(CAP_LABELS[id]) || id
            const keyList = (keys: string[]) => keys.map(k => L(KEY_LABELS[k]) || k).join(ar ? '، ' : ', ')
            const capMessage = (c: { id: string; ready: boolean; missingKeys: string[] }) => {
              if (c.id === 'retargeting') return c.ready
                ? (ar ? 'تحليلات/بكسل متصل — يمكن التخطيط لإعادة الاستهداف.' : 'Analytics/pixel connected — retargeting can be planned.')
                : (ar ? 'غير مُفعّل بعد — لا يوجد تحليلات/بكسل. اعتبره إعداداً مستقبلياً.' : 'Not active yet — no analytics/pixel connected. Treat as future setup.')
              if (c.id === 'competitorAnalysis') return c.ready
                ? (ar ? 'يعتمد على ملاحظاتك فقط (وليس بيانات سوق حية).' : 'Uses your notes only — not live market data.')
                : (ar ? 'غير مكتمل — لم تتم إضافة منافسين.' : 'Incomplete — no competitors provided.')
              if (c.ready) return ar ? 'جاهز — مبني على Brand Brain.' : 'Ready — grounded in your Brand Brain.'
              const list = keyList(c.missingKeys)
              return ar ? `أضِف: ${list} لرفع الجاهزية.` : `Add ${list} to improve readiness.`
            }
            const inputCls = 'w-full text-[13px] rounded-lg px-3 py-2 text-slate-800 outline-none'
            const inputStyle = { background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.12)' }
            const field = (key: keyof BrandProfile, label: string, placeholder: string, multiline = false) => (
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">{label}</label>
                {multiline
                  ? <textarea rows={2} className={inputCls} style={inputStyle} placeholder={placeholder}
                      value={String((form as Record<string, unknown>)[key] ?? '')}
                      onChange={e => set(key, e.target.value)} />
                  : <input className={inputCls} style={inputStyle} placeholder={placeholder}
                      value={String((form as Record<string, unknown>)[key] ?? '')}
                      onChange={e => set(key, e.target.value)} />}
              </div>
            )
            return (
              <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <BarChart2 size={16} style={{ color: '#5E5CE6' }} />
                  <h3 className="text-sm font-bold text-slate-950">{ar ? 'جاهزية الاستراتيجية' : 'Strategy readiness'}</h3>
                </div>
                <p className="text-[12px] text-slate-500 mb-4">
                  {ar ? 'ما الذي يملك NEXUS بيانات كافية لإنتاجه بثقة — وما الذي ينقصه.' : 'What NEXUS has enough data to produce confidently — and what is still missing.'}
                </p>

                <div className="grid sm:grid-cols-2 gap-2 mb-5">
                  {items.map(c => (
                    <div key={c.id} className="flex items-start gap-2.5 rounded-xl px-3 py-2.5" style={{ background: '#FBFBFD', border: '1px solid rgba(15,23,42,0.06)' }}>
                      <span className="mt-1 w-2 h-2 rounded-full flex-shrink-0" style={{ background: dot(c) }} />
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-slate-800">{capLabel(c.id)}{c.ready ? ' ✓' : ''}</p>
                        <p className="text-[11px] leading-relaxed text-slate-500">{capMessage(c)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <details className="rounded-xl" style={{ border: '1px solid rgba(94,92,230,0.18)', background: 'rgba(94,92,230,0.04)' }}>
                  <summary className="cursor-pointer select-none px-4 py-3 text-[13px] font-semibold text-slate-800">
                    {ar ? 'بيانات الاستراتيجية (اختياري) — لفتح تخطيط الميزانية والإعلانات وKPIs' : 'Strategy data (optional) — unlock budget, paid & KPI planning'}
                  </summary>
                  <div className="px-4 pb-4 pt-1 space-y-3">
                    {field('businessGoal', ar ? 'الهدف التجاري الرئيسي' : 'Main business goal', ar ? 'مثال: حجوزات استشارات أكثر' : 'e.g. more booked consultations', true)}
                    {field('marketingBudget', ar ? 'ميزانية التسويق الشهرية' : 'Monthly marketing budget', ar ? 'مثال: ١٬٠٠٠–٣٬٠٠٠ شهرياً' : 'e.g. $1,000–3,000 / month')}
                    {field('conversionDestination', ar ? 'وجهة التحويل' : 'Conversion destination', ar ? 'صفحة هبوط / واتساب / نموذج' : 'landing page / WhatsApp / form')}
                    {field('leadHandling', ar ? 'كيف تُدار العملاء المحتملون' : 'Lead handling / sales process', ar ? 'من يتابع العملاء وكيف' : 'who follows up and how', true)}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">{ar ? 'أهم اعتراضات العملاء (افصل بفواصل)' : 'Main customer objections (comma-separated)'}</label>
                      <input className={inputCls} style={inputStyle} placeholder={ar ? 'مثال: السعر، الوقت، الثقة' : 'e.g. price, timing, trust'}
                        value={(form.customerObjections || []).join(', ')}
                        onChange={e => set('customerObjections', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
                    </div>
                    {field('complianceNotes', ar ? 'قيود امتثال (إن وجدت)' : 'Compliance restrictions (if any)', '', true)}
                  </div>
                </details>

                <details className="rounded-xl mt-2" style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
                  <summary className="cursor-pointer select-none px-4 py-3 text-[13px] font-semibold text-slate-800">
                    {ar ? 'اقتصاديات (اختياري) — ترفع الثقة' : 'Economics (optional) — raises confidence'}
                  </summary>
                  <div className="px-4 pb-4 pt-1 space-y-3">
                    {field('averageOrderValue', ar ? 'متوسط قيمة الطلب' : 'Average order value', '')}
                    {field('grossMargin', ar ? 'هامش الربح' : 'Gross margin', '')}
                    {field('customerLifetimeValue', ar ? 'قيمة العميل مدى الحياة' : 'Customer lifetime value', '')}
                    {field('salesCycleLength', ar ? 'طول دورة البيع' : 'Sales cycle length', ar ? 'مثال: أسبوع–أسبوعين' : 'e.g. 1–2 weeks')}
                    {field('seasonality', ar ? 'الموسمية' : 'Seasonality', '', true)}
                    {field('pastAdResults', ar ? 'نتائج إعلانات سابقة (CPL/CPA/ROAS)' : 'Past ad results (CPL/CPA/ROAS)', '', true)}
                  </div>
                </details>

                <p className="text-[11px] text-slate-400 mt-3">
                  {ar ? 'هذه الحقول اختيارية ولا تمنع استراتيجيتك العضوية الحالية.' : 'These fields are optional and never block your current organic strategy.'}
                </p>
              </div>
            )
          })()}

          {/* ══════════════════════════════════════════════════════
              AGENT INJECTION GRID
              ══════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { color:'#f59e0b', icon:Brain,     label:'NEX Studio',  descKey:'brand.nexCardDesc'      },
              { color:'#06b6d4', icon:Zap,       label:'VEX Ads',     descKey:'brand.vexCardDesc'      },
              { color:'#8b5cf6', icon:BarChart2, label:'PULSE',       descKey:'brand.pulseCardDesc'    },
              { color:'#10b981', icon:Target,    label:'Sentinel',    descKey:'brand.sentinelCardDesc' },
            ].map((c,i) => (
              <div key={i} className="rounded-xl p-4 transition-all duration-200"
                style={{ background:'#FFFFFF', border:'1px solid rgba(15,23,42,0.08)', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                  style={{ background:`${c.color}12`, border:`1px solid ${c.color}22` }}>
                  <c.icon size={16} style={{ color:c.color }}/>
                </div>
                <p className="text-xs font-bold text-slate-950 mb-1">{c.label}</p>
                <p className="text-[11px] leading-relaxed text-slate-500">{t(c.descKey)}</p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </AppShell>
  )
}
