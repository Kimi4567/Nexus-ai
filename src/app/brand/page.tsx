'use client'

import AppShell from '@/components/AppShell'
import { BrainTimeline } from '@/components/brain/BrainTimeline'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { useBrandBrain, getBrandCompleteness, normalizeBrandProfile, type BrandProfile } from '@/hooks/useBrandBrain'
import { getStrategyCapabilities } from '@/lib/brandReadiness'
import { getBrandIndicators } from '@/lib/brandIndicators'
import BrandIndicatorsPanel from '@/components/BrandIndicatorsPanel'
import ReviewSuggestions, { type AssistSuggestion, type SuggestionSource } from '@/components/brand/ReviewSuggestions'
import { type AssistFieldSuggestion } from '@/lib/ai/assistSuggestions'
import { fieldLabel, isRenderableField } from '@/lib/brand/assistFieldLabels'
import { commitTag } from '@/lib/tagInput'
import {
  Loader2, Brain, Check, ChevronDown, Save,
  Target, Mic, Package, Users, Globe, BarChart2, AlertTriangle,
  CheckCircle2, ArrowLeft, ArrowRight, Zap, Sparkles, Wand2, X,
  Upload, ImageIcon, Link2, FileText, ScanSearch, ChevronRight
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   BRAND BRAIN — Premium Visual Redesign
   ═══════════════════════════════════════════════════════════════ */

type StepId = 'identity' | 'product' | 'audience' | 'voice' | 'platforms' | 'competitors' | 'goals'

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
  // PR-M3.2 — Goals & Strategy is now a real wizard step (step 7). labelKey/descKey
  // are rendered via inline EN/AR fallbacks below (no i18n file change).
  { id: 'goals',       labelKey: 'brand.stepGoalsLabel',       descKey: 'brand.stepGoalsDesc',       icon: Target,  color: '#5E5CE6', fieldCheck: 'businessGoal'    },
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

/* ── Sub-components ───────────────────────────────────────────── */
function TagInput({ label, placeholder, values, onChange, accentColor, onSuggest, suggesting, locale }: {
  label: string; placeholder: string; values: string[]; onChange: (v: string[]) => void;
  accentColor?: string; onSuggest?: () => void; suggesting?: boolean; locale?: string
}) {
  const [input, setInput] = useState('')
  const accent = accentColor || '#f59e0b'
  const isAr = locale === 'ar'
  const safeValues = Array.isArray(values) ? values.filter((v): v is string => typeof v === 'string') : []
  // PR-H1: Enter, comma, and blur all commit through the shared pure helper so
  // typed text is never silently lost. Only fire onChange when it actually adds.
  const add = (val: string) => { const next = commitTag(safeValues, val); if (next.length !== safeValues.length) onChange(next); setInput('') }
  const remove = (i: number) => onChange(safeValues.filter((_, idx) => idx !== i))
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748B' }}>{label}</label>
        {/* PR-M3.0 — field-level AI Assist button removed. Brand Brain is no longer
            filled by per-field AI guesses; assisted setup is centralized through the
            Website Scanner / Content Analyzer (draft → review → apply). */}
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
            // PR-H1 Tag Input Safety: commit any pending text on blur so it is
            // never silently lost when the user clicks Save All, presses Next, or
            // taps elsewhere. Blur fires before those click handlers run, so the
            // committed value is in state before save/navigation reads it.
            onBlur={() => add(input)}
            placeholder={safeValues.length ? '' : placeholder}
            className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-slate-400"
            style={{ color: '#0F172A' }} />
        )}
      </div>
      {/* PR-H1: clear affordance — typed text becomes a chip on Enter/comma/blur. */}
      <p className="text-[10px]" style={{ color: '#94A3B8' }}>
        {isAr ? 'اضغط Enter للإضافة' : 'Press Enter to add'}
      </p>
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
        {/* PR-M3.0 — field-level AI Assist button removed (see TagInput note). */}
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
                {/* PR-A: status-aware subtitle — never claims "ready" while the
                    Brand Brain is still Building (score < 80). Uses the same score
                    shown on this page (getBrandCompleteness) so copy matches the bar. */}
                <p className="text-xs mt-0.5 text-slate-500">
                  {score >= 80 ? t('brand.summarySubtitleActive') : t('brand.summarySubtitleBuilding')}
                </p>
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
          {/* PR-D: strategy-first CTA now routes to the real /strategy page (the
              official next stage after Brand Brain), not the run-full modal. */}
          <a href="/strategy"
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all"
            style={{ background: '#111827', color: '#FFFFFF' }}>
            <Sparkles size={15}/> {t('brand.summaryCtaLabel')}
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
  const { brand, loading, error, saving, saveBrand, refetch } = useBrandBrain()
  // PR-1D: track whether a loaded brand has been applied to the form, so we never
  // flash the "Needs Data" empty state between load-complete and form hydration.
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/login')
  }, [authLoading, isAuthenticated, router])

  const [step, setStep]     = useState<StepId>('identity')
  // PR-M3.1 — guided wizard shell. 'start' = setup-choice screen, 'edit' = the
  // existing one-step-at-a-time workspace (unchanged), 'review' = readiness summary.
  // Display/UX only: field state (`form`), Save, score/readiness and Scanner/Analyzer
  // behaviour are all untouched — this only gates which section is visible.
  // PR-M3.3A — 'assistReview' renders the (display-only) Review Suggestions shell
  // reached from the Assisted-setup "Create draft" button. No scan/analyze/apply runs.
  const [wizardStage, setWizardStage] = useState<'start' | 'edit' | 'review' | 'assistReview'>('start')
  // PR-M3.1.2 — two-path Start screen. Assisted-card inputs use isolated local state
  // (NOT the Scanner/Analyzer state) — display/IA only, nothing is scanned/analyzed/
  // applied/saved here. The real Create-draft → review → apply flow is PR-M3.3.
  const ASSIST_SCAN_COST = 3
  const ASSIST_ANALYZE_COST = 2
  const [assistUrl, setAssistUrl] = useState('')
  const [assistContent, setAssistContent] = useState('')
  const [assistDraftNotice, setAssistDraftNotice] = useState(false)
  // PR-M3.3C — real Create-draft → scan/analyze → review state. These hold ONLY the
  // returned suggestions for display in the Review Suggestions shell. They are NEVER
  // written back to `form`; Apply stays disabled (apply-on-approval is PR-M3.3D).
  const [creatingDraft, setCreatingDraft]       = useState(false)
  const [draftError, setDraftError]             = useState<string | null>(null)
  const [draftSuggestions, setDraftSuggestions] = useState<AssistSuggestion[]>([])
  const [draftMissing, setDraftMissing]         = useState<string[]>([])
  const [draftSafetyNotes, setDraftSafetyNotes] = useState<string[]>([])
  const [draftCreditNote, setDraftCreditNote]   = useState('')
  const [draftPartialNote, setDraftPartialNote] = useState<string | null>(null)
  const [draftSources, setDraftSources]         = useState<SuggestionSource[]>([])
  // PR-M3.2 — Scanner/Analyzer/learned-timeline group is no longer shown in Edit or
  // Review (kept in code, reserved for Assisted setup + PR-M3.3's review-before-apply).
  const SHOW_BRAND_IMPROVE_GROUP = false
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
    // PR-H2 — Brand Brain v2 (persisted)
    languagePreference: '', verifiedProof: [],
  })
  // PR-H2 — Strategy intent (visible choices). UI-only in PR-H2 — NOT wired to
  // generation (that is PR-I) and NOT persisted to a DB column yet.
  const [strategyType, setStrategyType] = useState<'organic' | 'paid' | 'full'>('organic')
  const [strategyDuration, setStrategyDuration] = useState<'30' | '90' | '180' | 'custom'>('90')
  // PR-H2: campaign objective is UI-only here (no Brand Brain column; persistence/
  // wiring deferred to PR-I per scope).
  const [campaignObjective, setCampaignObjective] = useState<'leads' | 'sales' | 'awareness' | 'traffic' | ''>('')
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError]         = useState<string | null>(null)

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
    if (brand === null) return // not loaded yet, or a genuinely empty account
    try {
      const normalized = normalizeBrandProfile(brand)
      if (normalized) setForm(b => ({ ...b, ...normalized }))
    } catch (err) {
      console.error('[BrandBrain] normalizeBrandProfile failed:', err)
    } finally {
      setHydrated(true)
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

  const refreshBrainAfterLearning = () => {
    refetch()
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

  // ── PR-M3.3C — Assisted "Create draft": run the real Scanner/Analyzer routes and
  //    populate the Review Suggestions shell. This NEVER applies, saves, or mutates
  //    Brand Brain (no setForm). Apply stays disabled (apply-on-approval = PR-M3.3D).
  //    Credits are deducted/refunded entirely server-side inside the routes; the
  //    client only DISPLAYS what was charged/refunded.
  const ar = locale === 'ar'
  const cvOf = (v: unknown): string =>
    Array.isArray(v) ? (v as unknown[]).filter(Boolean).map(String).join(', ') : (v ? String(v) : '')

  // Map a (server-built, guarded) suggestion → the presentational shell shape.
  // No confidence upgrade, no invented evidence — pure projection.
  const toShell = (s: AssistFieldSuggestion): AssistSuggestion => ({
    field: s.field,
    label: fieldLabel(s.field, locale),
    currentValue: cvOf((form as Record<string, unknown>)[s.field]),
    suggestedValue: s.suggested,
    evidence: s.evidence || undefined,
    safetyNote: s.safetyNote || undefined,
    basis: s.basis,
    confidence: s.confidence,
    source: s.source,
  })

  const handleCreateDraft = async () => {
    if (creatingDraft) return // re-entrancy guard — no double-charge, no auto-retry
    const url = assistUrl.trim()
    const content = assistContent.trim()
    if (!url && !content) return

    const sources: SuggestionSource[] = []
    if (url) sources.push('website')
    if (content) sources.push('content')

    // Reset + show the review view in a loading state.
    setCreatingDraft(true)
    setDraftError(null)
    setDraftSuggestions([])
    setDraftMissing([])
    setDraftSafetyNotes([])
    setDraftCreditNote('')
    setDraftPartialNote(null)
    setDraftSources(sources)
    setWizardStage('assistReview')

    type Outcome = {
      kind: 'website' | 'content'; cost: number; ok: boolean; status: number; refunded: boolean
      suggestions: AssistFieldSuggestion[]; missing: string[]; safetyNotes: string[]; errorMsg: string
    }
    const runRoute = async (
      kind: 'website' | 'content', endpoint: string, payload: unknown, cost: number,
    ): Promise<Outcome> => {
      const base: Outcome = { kind, cost, ok: false, status: 0, refunded: false, suggestions: [], missing: [], safetyNotes: [], errorMsg: '' }
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
          body: JSON.stringify(payload),
        })
        const data = await res.json().catch(() => ({} as Record<string, unknown>))
        if (!res.ok) {
          const msg = res.status === 402
            ? (ar ? 'رصيد غير كافٍ — يرجى الترقية' : 'Not enough credits — please upgrade')
            : res.status === 422
              ? (ar ? 'تعذّر قراءة الموقع — قد يحتاج إلى JavaScript' : 'Could not read the website — it may require JavaScript')
              : (typeof (data as Record<string, unknown>).error === 'string'
                  ? String((data as Record<string, unknown>).error)
                  : (ar ? 'فشل التحليل' : 'Analysis failed'))
          return { ...base, status: res.status, refunded: !!(data as Record<string, unknown>).refunded, errorMsg: msg }
        }
        const d = data as Record<string, unknown>
        return {
          ...base, ok: true, status: res.status,
          suggestions: Array.isArray(d.suggestions) ? (d.suggestions as AssistFieldSuggestion[]) : [],
          missing: Array.isArray(d.missing) ? (d.missing as string[]) : [],
          safetyNotes: Array.isArray(d.safetyNotes) ? (d.safetyNotes as string[]) : [],
        }
      } catch {
        return { ...base, errorMsg: ar ? 'تعذّر الاتصال، حاول مرة أخرى' : 'Connection failed, please try again' }
      }
    }

    try {
      const tasks: Promise<Outcome>[] = []
      if (url) tasks.push(runRoute('website', '/api/brand/scan-website', { url }, ASSIST_SCAN_COST))
      if (content) {
        const samples = content.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean).slice(0, 3)
        tasks.push(runRoute('content', '/api/brand/analyze-content', { samples: samples.length ? samples : [content] }, ASSIST_ANALYZE_COST))
      }
      const outcomes = await Promise.all(tasks) // runRoute never rejects
      const okOutcomes = outcomes.filter(o => o.ok)
      const failed = outcomes.filter(o => !o.ok)

      // Merge suggestions across sources, deduped by field. Client allowlist + never-show
      // set are enforced here (defense-in-depth on top of the server policy).
      const rankBasis = (b: string) => (b === 'inferred' ? 1 : 0)
      const rankConf = (c: string) => ({ high: 0, medium: 1, low: 2 } as Record<string, number>)[c] ?? 2
      const score = (s: AssistFieldSuggestion) => rankBasis(s.basis) * 10 + rankConf(s.confidence)
      const byField = new Map<string, AssistFieldSuggestion>()
      for (const o of okOutcomes) {
        for (const s of o.suggestions) {
          if (!isRenderableField(s.field)) continue
          const existing = byField.get(s.field)
          if (!existing) { byField.set(s.field, s); continue }
          // Both sources suggested this field. For array fields, union items; otherwise
          // keep the stronger (lower-score) entry. Never upgrade basis/confidence.
          if (existing.items || s.items) {
            const items = Array.from(new Set([...(existing.items || []), ...(s.items || [])])).filter(Boolean)
            const stronger = score(s) < score(existing) ? s : existing
            byField.set(s.field, {
              ...stronger,
              items,
              suggested: items.join(', '),
              evidence: [existing.evidence, s.evidence].filter(Boolean).join(' · ').slice(0, 180),
            })
          } else {
            byField.set(s.field, score(s) < score(existing) ? s : existing)
          }
        }
      }
      const merged = Array.from(byField.values()).sort((a, b) => score(a) - score(b))
      setDraftSuggestions(merged.map(toShell))

      const missingFields = Array.from(new Set(okOutcomes.flatMap(o => o.missing)))
        .filter(isRenderableField)
        .filter(f => !byField.has(f))
      setDraftMissing(missingFields.map(f => fieldLabel(f, locale)))
      setDraftSafetyNotes(Array.from(new Set(okOutcomes.flatMap(o => o.safetyNotes))))

      // Honest credit messaging from real outcomes.
      const charged = okOutcomes.reduce((n, o) => n + o.cost, 0)
      const refunded = failed.filter(o => o.refunded).reduce((n, o) => n + o.cost, 0)
      let note = charged > 0
        ? (ar ? `تم خصم ${charged} كردت.` : `Charged ${charged} credit${charged === 1 ? '' : 's'}.`)
        : ''
      if (refunded > 0) note += (note ? ' ' : '') + (ar ? `وتمّ ردّ ${refunded} كردت عن خطوة فشلت.` : `Refunded ${refunded} credit${refunded === 1 ? '' : 's'} for the step that failed.`)
      setDraftCreditNote(note)

      const whichLabel = (k: 'website' | 'content') =>
        k === 'website' ? (ar ? 'مسح الموقع' : 'Website scan') : (ar ? 'تحليل المحتوى' : 'Content analysis')

      if (okOutcomes.length === 0) {
        // Total failure — no cards.
        const msgs = outcomes.map(o => `${whichLabel(o.kind)}: ${o.errorMsg}${o.refunded ? (ar ? ' (تمّ الردّ)' : ' (refunded)') : ''}`)
        setDraftError(msgs.join(' · '))
      } else if (failed.length > 0) {
        const f = failed[0]
        setDraftPartialNote(`${whichLabel(f.kind)}: ${f.errorMsg}${f.refunded ? (ar ? ' (تمّ الردّ)' : ' (refunded)') : ''}`)
      }
    } finally {
      setCreatingDraft(false)
    }
  }

  const { score, missing } = getBrandCompleteness(form, locale)
  // PR-J — separated, honest indicators (same source the campaign Strategy panel uses).
  const brandIndicators = getBrandIndicators(form, {
    acceptedLearningCount: typeof form?.acceptedLearningCount === 'number' ? form.acceptedLearningCount : 0,
  })
  const currentStepIdx = STEPS.findIndex(s => s.id === step)
  const currentStep    = STEPS[currentStepIdx] ?? STEPS[0]
  const scoreColor     = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#64748B'

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
  // PR-1D: a transient /api/brand fetch failure must NOT render as "0/100 Needs Data".
  // Show an honest error + Retry instead. The real empty-account state is preserved
  // only when the fetch succeeded (no error) and the account is genuinely empty.
  if (error && !brand) return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: '#06071A' }}>
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <Brain size={28} className="text-amber-400" />
        </div>
        <p className="text-sm" style={{ color: '#cbd5e1' }}>
          {locale === 'ar'
            ? 'تعذّر تحميل ذاكرة العلامة التجارية. تحقّق من اتصالك وحاول مرة أخرى.'
            : 'Could not load your Brand Brain. Check your connection and try again.'}
        </p>
        <button onClick={() => refetch()}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: '#f59e0b' }}>
          {locale === 'ar' ? 'إعادة المحاولة' : 'Retry'}
        </button>
      </div>
    </div>
  )
  // Avoid a one-frame flash of the empty form between load-complete and hydration.
  if (brand && !hydrated) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#06071A' }}>
      <Loader2 className="animate-spin text-amber-400/60" size={18} />
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

        {/* PR-L — flex column so enrichment tools (Scanner/Analyzer/Learned) can be
            ordered BELOW the core brand profile via CSS order, without moving large
            JSX blocks. Core sections keep source order (order:0); enrichment = 49-52;
            footer = 60. PR-M1.1 widened the shell to max-w-6xl so the desktop
            workspace uses the viewport without large empty side-bands. */}
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-5">

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

            <div className="p-5 space-y-4">
              {/* PR-M1 — compact workspace header. Replaces the tall hero (big ring,
                  sparkline, full maturity bar, 4-indicator panel). The maturity number
                  is kept as a calm chip (math unchanged); the readiness indicators now
                  live in the sticky rail below. */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: '#FFFBEB', border: '1px solid rgba(245,158,11,0.22)' }}>
                    <Brain size={22} className="text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-xl font-black text-slate-950 tracking-tight">Brand Brain</h1>
                      {/* PR-N1 — stage-first: lead with the maturity STAGE; the 45/100
                          number is secondary/muted. Chip tooltip + the "Why?" disclosure
                          below explain that maturity = depth (setup + learned memory),
                          NOT setup completeness and NOT organic readiness. Math unchanged. */}
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1.5"
                        style={{ background: `${scoreColor}14`, color: scoreColor, border: `1px solid ${scoreColor}33` }}
                        title={locale === 'ar'
                          ? 'نضج ذاكرة العلامة: عمق طويل المدى (إعدادك المحفوظ + ما تعلّمته NEXUS بمرور الوقت). ليس اكتمال الإعداد وليس جاهزية المحتوى العضوي.'
                          : 'Brand Brain maturity: long-term depth — your saved setup plus what NEXUS learns over time. Not setup completeness, not organic readiness.'}>
                        {score >= 80 ? (locale === 'ar' ? 'ناضجة' : 'Mature') : score >= 50 ? (locale === 'ar' ? 'قيد التطور' : 'Developing') : (locale === 'ar' ? 'مبكرة' : 'Early')}
                        <span className="font-semibold tabular-nums opacity-60">{score}/100</span>
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {(() => {
                        const o = brandIndicators.organicReadiness, p = brandIndicators.paidReadiness, m = brandIndicators.memoryRichness
                        const memLvl = m.level === 'high' ? (locale === 'ar' ? 'غنية' : 'rich') : m.level === 'medium' ? (locale === 'ar' ? 'تتكوّن' : 'building') : (locale === 'ar' ? 'مبكرة' : 'early')
                        return [
                          o.ready ? (locale === 'ar' ? 'العضوي جاهز' : 'Organic ready') : (locale === 'ar' ? 'العضوي غير مكتمل' : 'Organic incomplete'),
                          p.ready ? (locale === 'ar' ? 'المدفوع جاهز' : 'Paid ready') : (locale === 'ar' ? 'المدفوع تخطيط فقط' : 'Paid planning-only'),
                          (locale === 'ar' ? 'الذاكرة ' : 'Memory ') + memLvl,
                        ].join('  ·  ')
                      })()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-60"
                    style={{ background: saved ? 'rgba(16,185,129,0.15)' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: saved ? '#10b981' : '#0a0a0a', border: saved ? '1px solid rgba(16,185,129,0.35)' : 'none' }}>
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

              {/* PR-N1 — compact "Why this?" disclosure for the maturity stage. Collapsed
                  by default (no clutter); explains 45-vs-100% so it never reads as a
                  contradiction. Display/copy only — no math. */}
              <details className="group">
                <summary className="cursor-pointer select-none list-none inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-700">
                  <span>{locale === 'ar' ? 'لماذا النضج «مبكر» مع اكتمال 100%؟' : 'Why is maturity “Early” when completeness is 100%?'}</span>
                  <ChevronDown size={12} className="transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-2 text-[12px] text-slate-500 leading-relaxed" style={{ maxWidth: '72ch' }}>
                  {locale === 'ar'
                    ? 'النضج يقيس العمق طويل المدى — إعدادك المحفوظ + ما تعلّمته NEXUS بمرور الوقت. لذلك قد يكون اكتمال إعداد علامتك 100% بينما يبقى النضج «مبكراً»، لأن الذاكرة تنمو من الحملات والنشر والنتائج الحقيقية. كما يمكن أن تكون استراتيجيتك العضوية «جاهزة» بينما ذاكرتك طويلة المدى لا تزال تتكوّن. النضج ليس اكتمال الإعداد وليس جاهزية المحتوى العضوي.'
                    : 'Maturity measures long-term depth — your saved setup plus what NEXUS learns over time. So your brand setup can be 100% complete while maturity stays “Early,” because memory grows from real campaigns, publishing, and results. Likewise your organic strategy can be “Ready” while long-term memory is still building. Maturity is not setup completeness and not organic readiness.'}
                </p>
              </details>

              {/* PR-L — single, indicator-driven next-action card (replaces the old
                  generic "Next step" banner + the alarmist low-completeness warning).
                  Leads with the honest positive, then names the real next gap from the
                  same separated indicators shown above. Display only — reads existing
                  indicator state, never mutates data or recomputes scores. */}
              {/* PR-M3.2 — this "what NEXUS knows / what's missing" card now belongs to
                  the Review & Readiness step only (removed from Edit to keep edit focused). */}
              {wizardStage === 'review' && (() => {
                const organic = brandIndicators.organicReadiness
                const paid = brandIndicators.paidReadiness
                const ar = locale === 'ar'
                const LABELS: Record<string, { en: string; ar: string }> = {
                  brandName: { en: 'brand name', ar: 'اسم العلامة' },
                  industry: { en: 'industry', ar: 'المجال' },
                  description: { en: 'business description', ar: 'وصف النشاط' },
                  primaryOffer: { en: 'primary offer', ar: 'العرض الأساسي' },
                  targetAudience: { en: 'target audience', ar: 'الجمهور المستهدف' },
                  audiencePainPoints: { en: 'audience pain points', ar: 'نقاط ألم الجمهور' },
                  businessGoal: { en: 'business goal', ar: 'الهدف التجاري' },
                  topPlatforms: { en: 'platforms', ar: 'المنصات' },
                  marketingBudget: { en: 'monthly budget', ar: 'الميزانية الشهرية' },
                  conversionDestination: { en: 'conversion destination', ar: 'وجهة التحويل' },
                  audienceLocation: { en: 'location', ar: 'الموقع الجغرافي' },
                  pixel: { en: 'tracking / pixel', ar: 'التتبع / البكسل' },
                }
                const labelFor = (keys: string[]) =>
                  keys.map(k => LABELS[k] ? (ar ? LABELS[k].ar : LABELS[k].en) : k)
                     .join(ar ? '، ' : ', ')

                return (
                  <div className="mt-4 rounded-2xl p-4 sm:p-5 space-y-2.5"
                    style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.08)' }}>
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} style={{ color: '#5E5CE6' }} className="flex-shrink-0" />
                      <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                        {ar ? 'الخطوة التالية' : 'Your next step'}
                      </span>
                    </div>

                    {!organic.ready ? (
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {ar
                          ? `أكمل أساس المحتوى العضوي بإضافة: ${labelFor(organic.missingKeys)} — ثم احفظ لتثبيته.`
                          : `Finish your organic foundation by adding: ${labelFor(organic.missingKeys)} — then save to lock it in.`}
                      </p>
                    ) : (
                      <>
                        <p className="text-sm text-slate-700 leading-relaxed">
                          <span className="font-semibold text-emerald-600">
                            {ar ? 'أساسك العضوي جاهز.' : 'Your organic foundation is ready.'}
                          </span>{' '}
                          <button onClick={() => router.push('/strategy')} className="font-semibold underline" style={{ color: '#5E5CE6' }}>
                            {ar ? 'أنشئ أول استراتيجية' : 'Create your first strategy'}
                          </button>
                          {ar ? ' — سيستخدم NEXUS ذاكرة علامتك.' : ' — NEXUS will use your brand memory.'}
                        </p>
                        {!paid.ready && (
                          <p className="text-[13px] leading-relaxed" style={{ color: '#b45309' }}>
                            {ar
                              ? `المدفوع تخطيط فقط — لتجهيزه أضف: ${labelFor(paid.missingKeys)}. لا تُطلق إعلانات ولا تُصرف ميزانية دون موافقتك.`
                              : `Paid is planning-only — to prepare it, add: ${labelFor(paid.missingKeys)}. No ads run and no budget is spent without your approval.`}
                          </p>
                        )}
                      </>
                    )}

                    <p className="text-[12px] text-slate-400 leading-relaxed">
                      {ar
                        ? 'ثراء الذاكرة ينمو مع موافقتك على المحتوى وتعديل المسودات وتشغيل الحملات وجمع النتائج — ليس مطلوباً للبدء.'
                        : 'Memory richness grows as you approve content, edit drafts, run campaigns, and gather results — it’s not required to start.'}
                    </p>
                  </div>
                )
              })()}
            </div>
          </div>

          {/* PR-M3.1 — Start screen: guided setup choices. "Start manually" enters the
              step editor; the assisted options point to the (unchanged) Website Scanner /
              Content Analyzer, which create a draft for review and never auto-save. */}
          {wizardStage === 'start' && (
            <div className="rounded-2xl p-6 sm:p-8" style={{ background:'#FFFFFF', border:'1px solid rgba(15,23,42,0.08)', boxShadow:'0 1px 2px rgba(15,23,42,0.04)' }}>
              <h2 className="text-lg font-bold text-slate-950">
                {locale === 'ar' ? 'لنبدأ ببناء ذاكرة علامتك' : 'Let’s build your Brand Brain'}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {locale === 'ar' ? 'اختر طريقة البدء — يمكنك تغييرها في أي وقت.' : 'Choose how you’d like to start — you can change this anytime.'}
              </p>
              {(() => {
                const ar = locale === 'ar'
                const scanCost = assistUrl.trim() ? ASSIST_SCAN_COST : 0
                const analyzeCost = assistContent.trim() ? ASSIST_ANALYZE_COST : 0
                const total = scanCost + analyzeCost
                const safety = ar
                  ? ['يُنشئ NEXUS مسودة لمراجعتك.', 'لا يُحفظ شيء تلقائياً.', 'لا يُطبَّق شيء على ذاكرة علامتك حتى توافق عليه.', 'تظهر تكلفة الكردت قبل أي إجراء.']
                  : ['NEXUS creates a draft for your review.', 'Nothing is saved automatically.', 'Nothing is applied to Brand Brain until you approve it.', 'Credit costs are shown before any action.']
                return (
                <div className="grid lg:grid-cols-[1.6fr_1fr] gap-3 mt-6 items-start">

                  {/* ── ASSISTED SETUP ── */}
                  <div className="rounded-2xl p-5" style={{ background:'#FBFBFD', border:'1px solid rgba(15,23,42,0.10)' }}>
                    <div className="flex items-center gap-2.5 mb-1">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background:'rgba(245,158,11,0.10)', border:'1px solid rgba(245,158,11,0.25)' }}>
                        <ScanSearch size={17} style={{ color:'#f59e0b' }} />
                      </div>
                      <p className="text-sm font-bold text-slate-950">{ar ? 'دع NEXUS يُجهّز مسودة ذاكرة علامتك' : 'Let NEXUS draft your Brand Brain'}</p>
                    </div>
                    <p className="text-xs text-slate-500 mb-4">{ar ? 'من موقعك أو من محتوى موجود — تراجعه قبل تطبيق أي شيء.' : 'From your website or existing content — you review it before anything is applied.'}</p>

                    {/* Website URL */}
                    <label className="block text-[11px] font-semibold tracking-wide text-slate-500 mb-1">{ar ? 'رابط الموقع الإلكتروني' : 'WEBSITE URL'}</label>
                    <div className="flex items-center gap-2 px-3 rounded-xl mb-3" style={{ background:'#FFFFFF', border:'1px solid rgba(15,23,42,0.10)', height:42 }}>
                      <Link2 size={14} style={{ color:'#64748B', flexShrink:0 }} />
                      <input value={assistUrl} onChange={e => { setAssistUrl(e.target.value); setAssistDraftNotice(false) }}
                        placeholder={ar ? 'https://your-brand.com' : 'https://your-brand.com'} dir="ltr"
                        className="flex-1 bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400" />
                    </div>

                    {/* Content samples */}
                    <label className="block text-[11px] font-semibold tracking-wide text-slate-500 mb-1">{ar ? 'عيّنات من محتواك' : 'CONTENT SAMPLES'}</label>
                    <textarea value={assistContent} onChange={e => { setAssistContent(e.target.value); setAssistDraftNotice(false) }}
                      rows={3} placeholder={ar ? 'الصق أفضل منشور/إعلان/بريد أدّى أداءً جيداً…' : 'Paste a caption, ad, email or post that performed well…'}
                      className="w-full rounded-xl px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none mb-3 resize-y" style={{ background:'#FFFFFF', border:'1px solid rgba(15,23,42,0.10)' }} />

                    {/* Credit breakdown */}
                    <div className="rounded-xl px-3 py-2 mb-3 space-y-1" style={{ background:'#F8FAFC', border:'1px solid rgba(15,23,42,0.06)' }}>
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-slate-500">{ar ? 'مسح الموقع' : 'Website scan'}</span>
                        <span className={assistUrl.trim() ? 'font-semibold text-slate-700' : 'text-slate-400'}>{ASSIST_SCAN_COST} {ar ? 'كردت' : 'credits'}</span>
                      </div>
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-slate-500">{ar ? 'تحليل المحتوى' : 'Content analysis'}</span>
                        <span className={assistContent.trim() ? 'font-semibold text-slate-700' : 'text-slate-400'}>{ASSIST_ANALYZE_COST} {ar ? 'كردت' : 'credits'}</span>
                      </div>
                    </div>

                    {/* Create draft button (dynamic total, disabled when nothing provided).
                        PR-M3.3C — runs the REAL Scanner/Analyzer routes (credits deducted
                        server-side), then opens the Review Suggestions shell with the returned
                        suggestions for review. Nothing is applied or saved — Apply stays
                        disabled (apply-on-approval is PR-M3.3D). */}
                    <button onClick={handleCreateDraft} disabled={total === 0 || creatingDraft}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:cursor-not-allowed"
                      style={ total === 0 || creatingDraft
                        ? { background:'#E2E8F0', color:'#94A3B8' }
                        : { background:'linear-gradient(135deg,#f59e0b,#d97706)', color:'#0a0a0a' } }>
                      {creatingDraft
                        ? <><Loader2 size={15} className="animate-spin" /> {ar ? 'جارٍ إنشاء المسودة…' : 'Creating draft…'}</>
                        : <>{ar ? 'إنشاء مسودة' : 'Create draft'}{total > 0 ? ` · ${total} ${ar ? 'كردت' : 'credits'}` : ''}</>}
                    </button>

                    {/* Safety copy */}
                    <ul className="mt-3 space-y-1">
                      {safety.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-[11px] text-slate-500">
                          <Check size={12} style={{ color:'#16a34a' }} className="flex-shrink-0 mt-0.5" /> {s}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* ── MANUAL SETUP ── */}
                  <button onClick={() => setWizardStage('edit')}
                    className="text-start rounded-2xl p-5 transition-all hover:border-amber-300 h-full flex flex-col"
                    style={{ background:'#FBFBFD', border:'1px solid rgba(15,23,42,0.10)' }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background:'#F8FAFC', border:'1px solid rgba(15,23,42,0.10)' }}>
                      <Brain size={17} style={{ color:'#64748b' }} />
                    </div>
                    <p className="text-sm font-bold text-slate-950">{ar ? 'ابدأ يدوياً' : 'Start manually'}</p>
                    <p className="text-xs text-slate-500 mt-1 flex-1">{ar ? 'املأ ذاكرة علامتك خطوة بخطوة.' : 'Fill your Brand Brain step by step.'}</p>
                    <span className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold self-start" style={{ background:'#0f172a', color:'#ffffff' }}>
                      {ar ? 'ابدأ يدوياً' : 'Start manually'} <ArrowLeft size={14} className="rtl:rotate-180" />
                    </span>
                  </button>

                </div>
                )
              })()}
            </div>
          )}

          {/* PR-M3.3C — Assisted Review Suggestions. Real Scanner/Analyzer suggestions
              (server-built, guarded, evidence-based) rendered for review. The client
              NEVER applies, saves, or mutates Brand Brain here — Apply stays disabled
              (apply-on-approval is PR-M3.3D). Loading / error / partial-success handled. */}
          {wizardStage === 'assistReview' && (
            creatingDraft ? (
              <div className="rounded-2xl p-10 flex flex-col items-center justify-center text-center" style={{ background:'#FFFFFF', border:'1px solid rgba(15,23,42,0.08)', boxShadow:'0 1px 2px rgba(15,23,42,0.04)' }}>
                <Loader2 size={26} className="animate-spin text-amber-500 mb-3" />
                <p className="text-sm font-semibold text-slate-700">
                  {ar ? 'يقرأ NEXUS مصادرك ويُجهّز مسودة للمراجعة…' : 'NEXUS is reading your sources and preparing a draft to review…'}
                </p>
                <p className="text-[12px] text-slate-400 mt-1">
                  {ar ? 'لا يُطبَّق ولا يُحفظ شيء — ستراجع كل اقتراح أولاً.' : 'Nothing is applied or saved — you’ll review every suggestion first.'}
                </p>
              </div>
            ) : draftError ? (
              <div className="rounded-2xl p-6" style={{ background:'#FFFFFF', border:'1px solid rgba(15,23,42,0.08)', boxShadow:'0 1px 2px rgba(15,23,42,0.04)' }}>
                <div className="flex items-start gap-2.5">
                  <AlertTriangle size={18} className="flex-shrink-0 mt-0.5 text-amber-500" />
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-slate-950">{ar ? 'تعذّر إنشاء المسودة' : 'Couldn’t create the draft'}</h2>
                    <p className="text-sm text-slate-600 mt-1 break-words">{draftError}</p>
                    {draftCreditNote && <p className="text-[12px] text-slate-500 mt-2">{draftCreditNote}</p>}
                    <p className="text-[12px] text-slate-400 mt-2">{ar ? 'لم يُطبَّق ولم يُحفظ أي شيء على ذاكرة علامتك.' : 'Nothing was applied or saved to your Brand Brain.'}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <button onClick={() => setWizardStage('start')} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold" style={{ background:'#0f172a', color:'#fff' }}>
                    <ArrowRight size={13} className="rtl:rotate-180" /> {ar ? 'العودة للإعداد المُساعد' : 'Back to Assisted setup'}
                  </button>
                </div>
              </div>
            ) : (
              <ReviewSuggestions
                suggestions={draftSuggestions}
                sourcesUsed={draftSources.length ? draftSources : ['website']}
                locale={locale}
                onBack={() => setWizardStage('start')}
                missing={draftMissing}
                safetyNotes={draftSafetyNotes}
                creditNote={draftCreditNote || undefined}
                partialNote={draftPartialNote || undefined}
              />
            )
          )}

          {/* PR-M3.1 — Review & Readiness step. Reuses the same honest indicators as the
              rail / campaign panel; display-only, no recompute. */}
          {wizardStage === 'review' && (
            <div className="rounded-2xl p-6" style={{ background:'#FFFFFF', border:'1px solid rgba(15,23,42,0.08)', boxShadow:'0 1px 2px rgba(15,23,42,0.04)' }}>
              <div className="flex items-center justify-between gap-3 mb-1">
                <h2 className="text-lg font-bold text-slate-950">{locale === 'ar' ? 'المراجعة والجاهزية' : 'Review & Readiness'}</h2>
                <button onClick={() => setWizardStage('edit')} className="text-xs font-semibold text-slate-500 hover:text-slate-800 inline-flex items-center gap-1">
                  <ArrowRight size={13} className="rtl:rotate-180" /> {locale === 'ar' ? 'العودة للتحرير' : 'Back to editing'}
                </button>
              </div>
              <p className="text-sm text-slate-500 mb-4">
                {locale === 'ar' ? 'هذا ما تعرفه NEXUS عن علامتك حتى الآن.' : 'Here’s what NEXUS knows about your brand so far.'}
              </p>
              <BrandIndicatorsPanel indicators={brandIndicators} locale={locale} theme="light" completeHref="#" />
              <div className="mt-5">
                {brandIndicators.organicReadiness.ready ? (
                  <button onClick={() => router.push('/strategy')}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
                    style={{ background:'linear-gradient(135deg,#f59e0b,#d97706)', color:'#0a0a0a' }}>
                    {locale === 'ar' ? 'أنشئ أول استراتيجية' : 'Create your first strategy'}
                    <ArrowLeft size={15} className="rtl:rotate-180" />
                  </button>
                ) : (
                  <p className="text-[13px]" style={{ color:'#b45309' }}>
                    {locale === 'ar' ? 'أكمل الأساس العضوي لتفعيل إنشاء الاستراتيجية.' : 'Complete your organic foundation to enable strategy creation.'}
                  </p>
                )}
              </div>

              {/* PR-M3.2 — "What NEXUS has learned" kept here as an optional collapsed
                  block (moved out of Edit). Display only — no scan/analyze/apply. */}
              <details className="group mt-5 rounded-xl overflow-hidden" style={{ border:'1px solid rgba(15,23,42,0.08)' }}>
                <summary className="cursor-pointer select-none list-none flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-sm font-bold text-slate-950">{locale === 'ar' ? 'ما تعلّمته NEXUS' : 'What NEXUS has learned'}</span>
                  <ChevronDown size={15} className="flex-shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-2 pb-2">
                  <BrainTimeline onUpdate={refreshBrainAfterLearning} />
                </div>
              </details>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              GROW YOUR BRAND BRAIN — enrichment group (moved below the core
              profile via CSS order). Heading (49) → Learned (50) → Scanner (51)
              → Analyzer (52). These enrich the brand; they are not the main task.
              ══════════════════════════════════════════════════════ */}
          {/* PR-M2.1 — "Improve your Brand Brain": one collapsed group holding the
              optional enrichment tools as accordion rows. Collapsed by default so the
              default page stays short. Theme polish is reserved for PR-M2.2. */}
          {/* PR-M3.2 — Scanner / Analyzer / learned timeline are removed from Edit AND
              Review (no lower-page clutter). They belong to the Start-screen Assisted
              setup path + the real review-before-apply flow in PR-M3.3, so this whole
              group is gated off for now (code preserved for M3.3). "What NEXUS has
              learned" is surfaced instead as a collapsed block inside Review & Readiness. */}
          {SHOW_BRAND_IMPROVE_GROUP && (
          <details style={{ order: 49 }} className="group pt-2">
            <summary className="cursor-pointer select-none list-none flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
              style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-slate-950">
                  {locale === 'ar' ? 'طوّر ذاكرة علامتك' : 'Improve your Brand Brain'}
                </span>
                <span className="block text-xs mt-0.5 text-slate-500">
                  {locale === 'ar'
                    ? 'أدوات اختيارية تثري ذاكرة علامتك — ليست مطلوبة للبدء.'
                    : 'Optional tools that enrich your brand memory — not required to start.'}
                </span>
              </span>
              <ChevronDown size={16} className="flex-shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
            </summary>

            <div className="mt-3 flex flex-col gap-3">

              {/* WHAT NEXUS HAS LEARNED — single consolidated learned surface (BrainTimeline) */}
              <details className="rounded-2xl overflow-hidden group/row" style={{ border: '1px solid rgba(15,23,42,0.08)', background: '#FFFFFF' }}>
                <summary className="cursor-pointer select-none list-none flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-sm font-bold text-slate-950">
                    {locale === 'ar' ? 'ما تعلّمته NEXUS' : 'What NEXUS has learned'}
                  </span>
                  <ChevronDown size={15} className="flex-shrink-0 text-slate-400 transition-transform group-open/row:rotate-180" />
                </summary>
                <div className="px-2 pb-2">
                  <BrainTimeline onUpdate={refreshBrainAfterLearning} />
                </div>
              </details>

              {/* WEBSITE SCANNER — accordion row (input hidden until opened) */}
              <details className="rounded-2xl overflow-hidden group/row" style={{ border: '1px solid rgba(15,23,42,0.08)', background: '#FFFFFF' }}>
                <summary className="cursor-pointer select-none list-none flex items-center justify-between gap-3 px-4 py-3">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-bold text-slate-950">
                      {locale === 'ar' ? 'مسح الموقع الإلكتروني' : 'Website Scanner'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: 'rgba(15,23,42,0.05)', color: '#64748b', border: '1px solid rgba(15,23,42,0.08)' }}>
                      3 {locale === 'ar' ? 'كردت' : 'credits'} · {locale === 'ar' ? 'اختياري' : 'optional'}
                    </span>
                  </span>
                  <ChevronDown size={15} className="flex-shrink-0 text-slate-400 transition-transform group-open/row:rotate-180" />
                </summary>

          {/* ══════════════════════════════════════════════════════
              WEBSITE INTELLIGENCE SCANNER
              ══════════════════════════════════════════════════════ */}
            <div className="px-4 pb-4 pt-1">
              <p className="text-xs mb-3 text-slate-500">
                {locale === 'ar'
                  ? 'أدخل رابط موقعك — سيحلله الذكاء الاصطناعي ويملأ Brand Brain تلقائياً'
                  : 'Enter your website URL — AI reads your pages and auto-fills Brand Brain fields'}
              </p>

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
          </details>

          {/* CONTENT ANALYZER — accordion row (textareas hidden until opened) */}
          <details className="rounded-2xl overflow-hidden group/row" style={{ border: '1px solid rgba(15,23,42,0.08)', background: '#FFFFFF' }}>
            <summary className="cursor-pointer select-none list-none flex items-center justify-between gap-3 px-4 py-3">
              <span className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-bold text-slate-950">
                  {locale === 'ar' ? 'تحليل المحتوى الناجح' : 'Content Analyzer'}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: 'rgba(15,23,42,0.05)', color: '#64748b', border: '1px solid rgba(15,23,42,0.08)' }}>
                  2 {locale === 'ar' ? 'كردت' : 'credits'} · {locale === 'ar' ? 'اختياري' : 'optional'}
                </span>
              </span>
              <ChevronDown size={15} className="flex-shrink-0 text-slate-400 transition-transform group-open/row:rotate-180" />
            </summary>
            <div className="px-4 pb-4 pt-1">
              <p className="text-xs mb-3 text-slate-500">
                {locale === 'ar'
                  ? 'الصق أفضل محتواك — سيستخرج الذكاء أنماط الـ hooks والأسلوب والزوايا الناجحة'
                  : 'Paste your best-performing content — AI extracts hooks, angles, and tone patterns'}
              </p>

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
          </details>

            </div>{/* ── end Improve group rows ── */}
          </details>
          )}{/* ── end Improve your Brand Brain group ── */}

          {/* ══════════════════════════════════════════════════════
              PR-M1 — WORKSPACE GRID
              Sticky left rail (vertical step nav + readiness summary + save) ·
              right active-section content. Replaces the full-width horizontal
              stepper so editing feels like a workspace, not an endless form.
              ══════════════════════════════════════════════════════ */}
          {wizardStage === 'edit' && (
          <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 items-start">

            {/* ── Sticky left rail ── */}
            <aside className="lg:sticky lg:top-6 self-start space-y-3">
              {/* Vertical step navigation */}
              <nav className="rounded-2xl p-2 space-y-0.5"
                style={{ background:'#FFFFFF', border:'1px solid rgba(15,23,42,0.08)', boxShadow:'0 1px 2px rgba(15,23,42,0.04)' }}>
                {STEPS.map((s, idx) => {
                  const active    = step === s.id
                  const fieldVal  = form[s.fieldCheck]
                  const completed = fieldVal && (Array.isArray(fieldVal) ? (fieldVal as string[]).length > 0 : String(fieldVal).length > 0)
                  return (
                    <button key={s.id} onClick={() => setStep(s.id)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all duration-200 text-start"
                      style={{ background: active ? `${s.color}10` : 'transparent', border:`1px solid ${active ? s.color+'30' : 'transparent'}` }}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: active ? `${s.color}14` : completed ? `${s.color}0e` : '#F8FAFC', border:`1px solid ${active ? s.color+'40' : completed ? s.color+'25' : 'rgba(15,23,42,0.08)'}` }}>
                        <s.icon size={14} style={{ color: active ? s.color : completed ? s.color+'bb' : '#94A3B8' }}/>
                      </div>
                      <span className="text-[10px] font-mono flex-shrink-0" style={{ color: active ? s.color+'99' : 'rgba(71,85,105,0.45)' }}>0{idx+1}</span>
                      <span className="text-[13px] font-semibold leading-tight flex-1 min-w-0 truncate" style={{ color: active ? '#0f172a' : '#475569' }}>{s.id === 'goals' ? (locale === 'ar' ? 'الأهداف والاستراتيجية' : 'Goals & Strategy') : t(s.labelKey)}</span>
                      {completed && <Check size={13} style={{ color: s.color }} strokeWidth={3} className="flex-shrink-0"/>}
                    </button>
                  )
                })}
                {/* PR-M3.2 — step 8: Review & Readiness (enters the review stage) */}
                <button onClick={() => setWizardStage('review')}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all duration-200 text-start"
                  style={{ background: 'transparent', border: '1px solid transparent' }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.08)' }}>
                    <CheckCircle2 size={14} style={{ color: '#94A3B8' }}/>
                  </div>
                  <span className="text-[10px] font-mono flex-shrink-0" style={{ color: 'rgba(71,85,105,0.45)' }}>08</span>
                  <span className="text-[13px] font-semibold leading-tight flex-1 min-w-0 truncate" style={{ color: '#475569' }}>{locale === 'ar' ? 'المراجعة والجاهزية' : 'Review & Readiness'}</span>
                </button>
              </nav>
              {/* Readiness summary */}
              <div className="rounded-2xl p-3" style={{ background:'#FFFFFF', border:'1px solid rgba(15,23,42,0.08)', boxShadow:'0 1px 2px rgba(15,23,42,0.04)' }}>
                <BrandIndicatorsPanel indicators={brandIndicators} locale={locale} theme="light" completeHref="#" />
              </div>
              {/* Save (always reachable) */}
              <button onClick={handleSave} disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-60"
                style={{ background: saved ? 'rgba(16,185,129,0.12)' : '#111827', color: saved ? '#10b981' : '#FFFFFF', border: saved ? '1px solid rgba(16,185,129,0.3)' : 'none' }}>
                {saving ? <Loader2 size={14} className="animate-spin"/> : saved ? <CheckCircle2 size={14}/> : <Save size={14}/>}
                {saving ? t('brand.savingBtn') : saved ? t('brand.savedBtn') : t('brand.saveAllBtn')}
              </button>
            </aside>

            {/* ── Right workspace content (active step) ── */}
            <div className="min-w-0 space-y-5">

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
                <h2 className="text-lg font-bold text-slate-950">{currentStep.id === 'goals' ? (locale === 'ar' ? 'الأهداف والاستراتيجية' : 'Goals & Strategy') : t(currentStep.labelKey)}</h2>
                <p className="text-xs mt-0.5 text-slate-500">{currentStep.id === 'goals' ? (locale === 'ar' ? 'حدّد هدفك ونوع استراتيجيتك ولغة المخرجات.' : 'Set your goal, strategy type, and output language.') : t(currentStep.descKey)}</p>
              </div>
              {/* PR-M3.2 — denominator is STEPS.length + 1 so Review & Readiness counts as the final step (X / 8). */}
              <div className="text-xs font-mono font-bold px-3 py-1.5 rounded-lg flex-shrink-0"
                style={{ background:`${currentStep.color}0e`, color:`${currentStep.color}bb`, border:`1px solid ${currentStep.color}20` }}>
                {currentStepIdx+1} / {STEPS.length + 1}
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
                    accentColor={currentStep.color}>
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
                    accentColor={currentStep.color}>
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
                    locale={locale}/>
                  <Field label={t('brand.productPriceLabel')}>
                    <RadioGroup options={PRICE_OPTIONS.map(o=>({v:o.v,l:locale==='ar'?o.l:o.lEn}))}
                      value={form.pricePoint||''} onChange={v=>set('pricePoint',v)} color={currentStep.color}/>
                  </Field>
                  <TagInput label={t('brand.productAdvantagesLabel')} placeholder={t('brand.productAdvantagesPlaceholder')}
                    values={form.uniqueAdvantages||[]} onChange={v=>set('uniqueAdvantages',v)} accentColor={currentStep.color}
                    locale={locale}/>
                </div>
              )}

              {step === 'audience' && (
                <div className="space-y-5">
                  <Field label={t('brand.audienceDescLabel')}
                    accentColor={currentStep.color}>
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
                    locale={locale}/>
                  <TagInput label={t('brand.audienceDesireLabel')} placeholder={t('brand.audienceDesirePlaceholder')}
                    values={form.audienceDesires||[]} onChange={v=>set('audienceDesires',v)} accentColor={currentStep.color}
                    locale={locale}/>
                </div>
              )}

              {step === 'voice' && (
                <div className="space-y-5">
                  <Field label={t('brand.voiceToneLabel')}>
                    <ToggleGrid options={locale==='ar'?TONE_OPTIONS_AR:TONE_OPTIONS_EN}
                      selected={form.toneKeywords||[]} onChange={v=>set('toneKeywords',v)} color={currentStep.color}/>
                  </Field>
                  <Field label={t('brand.voiceStyleLabel')}
                    accentColor={currentStep.color}>
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
                    locale={locale}/>
                  {/* PR-H1: winningHooks moved out of the beginner input path into the
                      read-only Learned Memory view — these are observed over time, not
                      asked upfront. */}
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
                  {/* PR-H1: winningAngles & failedAngles moved out of the beginner
                      input path into the read-only Learned Memory view. */}
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
                    accentColor={currentStep.color}>
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

              {/* PR-M3.2 — Goals & Strategy is now step 7 (relocated from the old review
                  stage). Existing fields/state only; paid stays planning-only. */}
              {step === 'goals' && (() => {
                const ar = locale === 'ar'
                const pill = (selected: boolean, color = '#5E5CE6') => ({
                  background: selected ? `${color}12` : '#FFFFFF',
                  border: `1px solid ${selected ? color + '45' : 'rgba(15,23,42,0.10)'}`,
                  color: selected ? color : '#64748b',
                }) as React.CSSProperties
                const labelCls = 'block text-xs font-semibold uppercase tracking-wider mb-2'
                const caps = getStrategyCapabilities(form)
                return (
                  <div className="space-y-5">
                    <Field label={ar ? 'الهدف التجاري الرئيسي' : 'Main business goal'}>
                      <NxInput value={form.businessGoal||''} onChange={v=>set('businessGoal',v)}
                        placeholder={ar ? 'مثال: المزيد من المشتركين المدفوعين' : 'e.g. more paying subscribers'} accentColor="#5E5CE6"/>
                    </Field>

                    <div>
                      <label className={labelCls} style={{ color:'#64748B' }}>{ar ? 'نوع الاستراتيجية' : 'Strategy type'}</label>
                      <div className="flex flex-wrap gap-2">
                        {([['organic', ar?'عضوي فقط':'Organic only'],['paid', ar?'مدفوع فقط':'Paid only'],['full', ar?'استراتيجية كاملة':'Full strategy']] as const).map(([v,l])=>(
                          <button key={v} onClick={()=>setStrategyType(v)} className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all" style={pill(strategyType===v)}>
                            {strategyType===v&&'● '}{l}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className={labelCls} style={{ color:'#64748B' }}>{ar ? 'مدة الاستراتيجية' : 'Strategy duration'}</label>
                      <div className="flex flex-wrap gap-2">
                        {([['30', ar?'30 يوماً':'30 days'],['90', ar?'90 يوماً':'90 days'],['180', ar?'6 أشهر':'6 months'],['custom', ar?'مخصص':'Custom']] as const).map(([v,l])=>(
                          <button key={v} onClick={()=>setStrategyDuration(v)} className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all" style={pill(strategyDuration===v)}>
                            {strategyDuration===v&&'● '}{l}
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1.5">{ar ? 'موصى به: 90 يوماً مع أول 30 يوماً قابلة للتنفيذ.' : 'Recommended: 90 days, with the first 30 days actionable.'}</p>
                    </div>

                    <div>
                      <label className={labelCls} style={{ color:'#64748B' }}>{ar ? 'لغة المخرجات' : 'Output language'}</label>
                      <div className="flex flex-wrap gap-2">
                        {([['en','English'],['ar','العربية'],['both', ar?'كلاهما':'Both']] as const).map(([v,l])=>(
                          <button key={v} onClick={()=>set('languagePreference', v)} className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all" style={pill(form.languagePreference===v, '#06b6d4')}>
                            {form.languagePreference===v&&'● '}{l}
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1.5">{ar ? 'اختيارك أنت — لا يُستنتَج من لغة الواجهة.' : 'Your choice — not inferred from the interface language.'}</p>
                    </div>

                    {(strategyType==='organic' || strategyType==='full') && (
                      <div className="rounded-xl px-3 py-2.5" style={{ background:'#FBFBFD', border:'1px solid rgba(15,23,42,0.06)' }}>
                        <p className="text-[12px] font-semibold text-slate-700 mb-0.5">{ar ? 'إعداد المحتوى العضوي' : 'Organic content setup'}</p>
                        <p className="text-[11px] text-slate-500">{ar ? 'منصاتك ونبرتك من الأقسام أعلاه تُستخدم لبناء خطة المحتوى العضوي.' : 'Your platforms and voice from the sections above power the organic content plan.'}</p>
                      </div>
                    )}

                    {(strategyType==='paid' || strategyType==='full') && (
                      <div className="rounded-xl px-3 py-3 space-y-3" style={{ background:'#FBFBFD', border:'1px solid rgba(15,23,42,0.06)' }}>
                        <p className="text-[12px] font-semibold text-slate-700">{ar ? 'إعداد الحملة المدفوعة' : 'Paid campaign setup'}</p>
                        <Field label={ar ? 'الميزانية الشهرية' : 'Monthly budget'}>
                          <NxInput value={form.marketingBudget||''} onChange={v=>set('marketingBudget',v)}
                            placeholder={ar ? 'مثال: 1000$ شهرياً' : 'e.g. $1,000 / month'} accentColor="#5E5CE6"/>
                        </Field>
                        <Field label={ar ? 'وجهة التحويل' : 'Conversion destination'}>
                          <NxInput value={form.conversionDestination||''} onChange={v=>set('conversionDestination',v)}
                            placeholder={ar ? 'صفحة هبوط / نموذج / واتساب' : 'landing page / form / WhatsApp'} accentColor="#5E5CE6"/>
                        </Field>
                        <div>
                          <label className={labelCls} style={{ color:'#64748B' }}>{ar ? 'هدف الحملة' : 'Campaign objective'}</label>
                          <div className="flex flex-wrap gap-2">
                            {([['leads', ar?'عملاء محتملون':'Leads'],['sales', ar?'مبيعات':'Sales'],['awareness', ar?'وعي':'Awareness'],['traffic', ar?'زيارات':'Traffic']] as const).map(([v,l])=>(
                              <button key={v} onClick={()=>setCampaignObjective(v)} className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all" style={pill(campaignObjective===v, '#f59e0b')}>
                                {campaignObjective===v&&'● '}{l}
                              </button>
                            ))}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">{ar ? 'يُحفظ مع الاستراتيجية لاحقاً.' : 'Saved with the strategy later.'}</p>
                        </div>
                        <div className="rounded-lg px-3 py-2" style={{ background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)' }}>
                          <p className="text-[12px] font-semibold" style={{ color:'#b45309' }}>{ar ? 'تخطيط فقط — غير جاهز للإطلاق' : 'Planning only — not launch-ready'}</p>
                          <p className="text-[11px] text-slate-600 mt-0.5">
                            {ar
                              ? 'لن يتم إنفاق أي ميزانية أو إطلاق إعلانات دون موافقتك الصريحة. اربط البكسل/حساب الإعلانات وتتبّع التحويل في صفحة الربط للجاهزية.'
                              : 'No budget is spent and no ads launch without your explicit approval. Connect your pixel / ad account and conversion tracking in Connections to become launch-ready.'}
                          </p>
                          {!caps.paidStrategy.ready && (
                            <p className="text-[11px] mt-1" style={{ color:'#b45309' }}>
                              {ar ? 'ما زال ناقصاً: الميزانية ووجهة التحويل والموقع والعرض.' : 'Still missing: budget, conversion destination, location, and offer.'}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <div>
                      <TagInput
                        label={ar ? 'إثبات موثّق — مؤكَّد منك فقط' : 'Verified proof — user-confirmed only'}
                        placeholder={ar ? 'أضف شهادة/نتيجة حقيقية ثم Enter' : 'Add a real, verified proof point, then Enter'}
                        values={form.verifiedProof||[]} onChange={v=>set('verifiedProof',v)} accentColor="#10b981" locale={locale}/>
                      <p className="text-[11px] text-slate-400 mt-1.5">
                        {ar
                          ? 'أضف فقط شهادات/نتائج/أرقاماً حقيقية يمكنك تأكيدها. NEXUS لا يضيف إثباتات مفترضة أو شهادات وهمية.'
                          : 'Add only real testimonials/results/numbers you can verify. NEXUS never adds assumed proof or fake testimonials.'}
                      </p>
                    </div>
                  </div>
                )
              })()}

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
                  /* PR-M3.1 — last step advances to the Review & Readiness screen.
                     Saving stays available via "Save All" in the rail (handleSave). */
                  <button onClick={() => setWizardStage('review')}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all"
                    style={{ background:'linear-gradient(135deg,#f59e0b,#d97706)', color:'#0a0a0a', boxShadow:'0 0 24px rgba(245,158,11,0.25)' }}>
                    {locale === 'ar' ? 'المراجعة والجاهزية' : 'Review & Readiness'} <ArrowLeft size={14}/>
                  </button>
                )}
              </div>
            </div>
          </div>

            </div>{/* ── end right workspace content ── */}
          </div>
          )}{/* ── end PR-M1 workspace grid ── */}

          {/* PR-M2.1 — the standalone read-only "Learned Memory" chips card was removed
              to consolidate learned surfaces. "What NEXUS has learned" (BrainTimeline)
              inside the "Improve your Brand Brain" group is now the single learned view. */}

          {/* PR-M3.2 — Goals & Strategy (formerly a review-stage block) is now wizard
              step 7, rendered inside the workspace step card above. */}

          {/* ══ Strategy readiness + data requirements (PR-2A) ══
              Capture-only + advisory. Optional fields; never block the organic flow.
              No generation logic reads these — they drive calm readiness warnings. */}
          {wizardStage === 'review' && (() => {
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
              <details className="group rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
                <summary className="cursor-pointer select-none list-none flex items-center justify-between gap-3 px-5 py-4">
                  <span className="flex items-center gap-2 min-w-0">
                    <BarChart2 size={16} style={{ color: '#5E5CE6' }} />
                    <h3 className="text-sm font-bold text-slate-950">{ar ? 'تفاصيل الجاهزية والبيانات الاختيارية' : 'Readiness detail & optional data'}</h3>
                  </span>
                  <ChevronDown size={16} className="flex-shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-5 pb-5">
                <p className="text-[12px] text-slate-500 mb-4">
                  {ar ? 'تفصيل لحالة ذاكرة العلامة بالأعلى — وما يمكنك إضافته لفتح تخطيط المدفوع ومؤشرات الأداء.' : 'A detailed breakdown of the Brand Brain status above — and the optional data you can add to unlock paid & KPI planning.'}
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
              </details>
            )
          })()}

          {/* PR-L — the 4 static, non-actionable agent cards (NEX/VEX/PULSE/Sentinel)
              are replaced by one quiet footer line. They were decorative, visually
              noisy, and mildly overclaimed; this keeps the "what it powers" signal
              without the decoration. order:60 keeps it last, below the enrichment group. */}
          <p style={{ order: 60 }} className="text-center text-[11px] text-slate-400 pt-1 pb-2">
            {locale === 'ar'
              ? 'ذاكرة علامتك تُشغّل NEX Studio · VEX Ads · PULSE · Sentinel'
              : 'Your Brand Brain powers NEX Studio · VEX Ads · PULSE · Sentinel'}
          </p>

        </div>
      </div>
    </AppShell>
  )
}
