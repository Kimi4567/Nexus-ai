'use client'

import AppShell from '@/components/AppShell'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { useBrandBrain, getBrandCompleteness, type BrandProfile } from '@/hooks/useBrandBrain'
import {
  Loader2, Brain, Check, ChevronDown, Save,
  Target, Mic, Package, Users, Globe, BarChart2, AlertTriangle,
  CheckCircle2, ArrowLeft, ArrowRight, Zap, Sparkles
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
  { id: 'platforms',   labelKey: 'brand.stepPlatformsLabel',   descKey: 'brand.stepPlatformsDesc',   icon: Globe,   color: '#ec4899', fieldCheck: 'visualStyle'     },
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
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(139,92,246,0.1)" strokeWidth="7"/>
        <circle cx="50" cy="50" r={r} fill="none" stroke={color}
          strokeWidth="7" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.5s ease', filter: `drop-shadow(0 0 8px ${glow})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black tabular-nums" style={{ color, lineHeight: 1 }}>{score}</span>
        <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>/ 100</span>
      </div>
    </div>
  )
}

/* ── Sub-components ───────────────────────────────────────────── */
function TagInput({ label, placeholder, values, onChange, accentColor }: {
  label: string; placeholder: string; values: string[]; onChange: (v: string[]) => void; accentColor?: string
}) {
  const [input, setInput] = useState('')
  const accent = accentColor || '#f59e0b'
  const add = (val: string) => { const v = val.trim(); if (v && !values.includes(v)) onChange([...values, v]); setInput('') }
  const remove = (i: number) => onChange(values.filter((_, idx) => idx !== i))
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(148,163,184,0.6)' }}>{label}</label>
      <div className="flex flex-wrap gap-1.5 p-3 rounded-xl min-h-[52px]"
        style={{ background: 'rgba(8,9,28,0.7)', border: '1px solid rgba(139,92,246,0.2)' }}>
        {values.map((v, i) => (
          <span key={i} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{ background: `${accent}15`, border: `1px solid ${accent}35`, color: accent }}>
            {v}
            <button onClick={() => remove(i)} className="opacity-40 hover:opacity-100 hover:text-red-400 transition-all ml-0.5 text-sm leading-none">×</button>
          </span>
        ))}
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key==='Enter'||e.key===','){e.preventDefault();add(input)} }}
          placeholder={values.length ? '' : placeholder}
          className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder-gray-600"
          style={{ color: '#e2e8f0' }} />
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(148,163,184,0.6)' }}>{label}</label>
      {children}
    </div>
  )
}

function NxInput({ value, onChange, placeholder, textarea, accentColor }: {
  value: string; onChange: (v: string) => void; placeholder?: string; textarea?: boolean; accentColor?: string
}) {
  const accent = accentColor || '#8b5cf6'
  const [focused, setFocused] = useState(false)
  const cls = "w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-all duration-200 placeholder-gray-600"
  const style = {
    background: 'rgba(8,9,28,0.7)',
    border: `1px solid ${focused ? accent + '60' : 'rgba(139,92,246,0.2)'}`,
    color: '#f1f5f9',
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
  const toggle = (v: string) => selected.includes(v) ? onChange(selected.filter(x => x !== v)) : onChange([...selected, v])
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => {
        const active = selected.includes(o)
        return (
          <button key={o} onClick={() => toggle(o)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
            style={{
              background: active ? `${c}20` : 'rgba(12,13,36,0.6)',
              border: `1px solid ${active ? c+'55' : 'rgba(139,92,246,0.18)'}`,
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
            background: value === o.v ? `${c}18` : 'rgba(12,13,36,0.6)',
            border: `1px solid ${value === o.v ? c+'50' : 'rgba(139,92,246,0.18)'}`,
            color: value === o.v ? c : '#64748b',
            boxShadow: value === o.v ? `0 0 14px ${c}18` : 'none',
          }}>
          {value === o.v ? '● ' : '○ '}{o.l}
        </button>
      ))}
    </div>
  )
}

/* ── Main Page ────────────────────────────────────────────────── */
export default function BrandBrainPage() {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const router = useRouter()
  const { locale, dir, t } = useI18n()
  const { brand, loading, saving, saveBrand } = useBrandBrain()

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/login')
  }, [authLoading, isAuthenticated, router])

  const [step, setStep]   = useState<StepId>('identity')
  const [saved, setSaved] = useState(false)
  const [form, setForm]   = useState<BrandProfile>({
    brandName: '', industry: '', description: '',
    primaryOffer: '', secondaryOffers: [], pricePoint: 'mid-range', uniqueAdvantages: [],
    targetAudience: '', audienceAge: '', audienceLocation: '', audiencePainPoints: [], audienceDesires: [],
    toneKeywords: [], avoidKeywords: [], writingStyle: '',
    topPlatforms: [], visualStyle: '',
    winningHooks: [], winningAngles: [], failedAngles: [], competitorNotes: '', strategicNotes: '',
  })

  useEffect(() => { if (brand) setForm(b => ({ ...b, ...brand })) }, [brand])
  const set = (k: keyof BrandProfile, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    const ok = await saveBrand(form)
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 3000) }
  }

  const { score, missing } = getBrandCompleteness(form)
  const currentStepIdx = STEPS.findIndex(s => s.id === step)
  const currentStep    = STEPS[currentStepIdx]
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
      <div className="relative min-h-screen" dir={dir}>

        {/* ── Ambient background ─────────────────────────────── */}
        <div className="absolute inset-0 nx-bg-grid pointer-events-none opacity-25" />
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute rounded-full blur-[200px]"
            style={{ width: 800, height: 600, background: 'radial-gradient(ellipse, rgba(139,92,246,0.18) 0%, transparent 70%)', top: '-10%', right: '-20%' }} />
          <div className="absolute rounded-full blur-[160px]"
            style={{ width: 500, height: 500, background: 'radial-gradient(ellipse, rgba(245,158,11,0.1) 0%, transparent 70%)', bottom: '5%', left: '-10%' }} />
          <div className="absolute rounded-full blur-[120px] transition-all duration-1000"
            style={{ width: 400, height: 300, background: `radial-gradient(ellipse, ${currentStep.color}10 0%, transparent 70%)`, top: '30%', left: '35%' }} />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 py-8 space-y-5">

          {/* ══════════════════════════════════════════════════════
              HERO HEADER CARD
              ══════════════════════════════════════════════════════ */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(139,92,246,0.2)', backdropFilter: 'blur(24px)', boxShadow: '0 4px 40px rgba(0,0,0,0.4)' }}>

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
                      style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(245,158,11,0.05) 100%)', border: '1px solid rgba(245,158,11,0.3)', boxShadow: '0 0 40px rgba(245,158,11,0.12), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
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
                      <h1 className="text-3xl font-black text-white tracking-tight">Brand Brain</h1>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                        style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' }}>
                        {t('brand.badgeMemory')}
                      </span>
                    </div>
                    <p className="text-sm max-w-xs" style={{ color: '#475569' }}>{t('brand.aiInjected')}</p>
                  </div>
                </div>

                {/* Score ring + save */}
                <div className="flex items-center gap-6">
                  <div className="flex flex-col items-center gap-1.5">
                    <ScoreRing score={score} />
                    <span className="text-xs font-bold" style={{ color: scoreColor }}>
                      {score >= 80 ? (locale==='ar'?'عقل نشط':'Active Brain') :
                       score >= 50 ? (locale==='ar'?'قيد البناء':'Building...') :
                       (locale==='ar'?'يحتاج بيانات':'Needs Data')}
                    </span>
                  </div>
                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-60"
                    style={{
                      background: saved ? 'rgba(16,185,129,0.15)' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      color: saved ? '#10b981' : '#0a0a0a',
                      boxShadow: saved ? '0 0 20px rgba(16,185,129,0.2)' : '0 0 32px rgba(245,158,11,0.28), 0 4px 16px rgba(0,0,0,0.4)',
                      border: saved ? '1px solid rgba(16,185,129,0.35)' : 'none',
                    }}>
                    {saving ? <Loader2 size={15} className="animate-spin"/> : saved ? <CheckCircle2 size={15}/> : <Save size={15}/>}
                    {saving ? t('brand.savingBtn') : saved ? t('brand.savedBtn') : t('brand.saveAllBtn')}
                  </button>
                </div>
              </div>

              {/* Progress bar + missing */}
              <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(139,92,246,0.1)' }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={12} className="text-amber-400" />
                    <span className="text-xs font-semibold" style={{ color: '#94a3b8' }}>{t('brand.completeness')}</span>
                  </div>
                  {missing.length > 0 && (
                    <span className="text-xs" style={{ color: '#334155' }}>
                      {t('brand.missing')} {missing.slice(0,3).join(locale==='ar'?'، ':' · ')}{missing.length>3?'...':''}
                    </span>
                  )}
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(139,92,246,0.08)' }}>
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width:`${score}%`, background:score>=80?'linear-gradient(90deg,#10b981,#059669)':score>=50?'linear-gradient(90deg,#f59e0b,#d97706)':'linear-gradient(90deg,#ef4444,#dc2626)' }}/>
                </div>
              </div>

              {score < 60 && (
                <div className="flex items-center gap-2 mt-4 px-4 py-3 rounded-xl"
                  style={{ background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.15)' }}>
                  <AlertTriangle size={14} className="text-amber-500 flex-shrink-0"/>
                  <p className="text-xs" style={{ color:'rgba(245,158,11,0.8)' }}>{t('brand.lowCompletenessWarning')}</p>
                </div>
              )}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════
              STEP STEPPER
              ══════════════════════════════════════════════════════ */}
          <div className="rounded-2xl p-3"
            style={{ background:'rgba(10,11,28,0.7)', border:'1px solid rgba(139,92,246,0.15)', backdropFilter:'blur(20px)' }}>
            <div className="flex gap-1.5 overflow-x-auto">
              {STEPS.map((s, idx) => {
                const active    = step === s.id
                const fieldVal  = form[s.fieldCheck]
                const completed = fieldVal && (Array.isArray(fieldVal) ? (fieldVal as string[]).length > 0 : String(fieldVal).length > 0)
                return (
                  <button key={s.id} onClick={() => setStep(s.id)}
                    className="flex-1 min-w-[80px] flex flex-col items-center gap-2 px-2 py-3 rounded-xl transition-all duration-200"
                    style={{
                      background: active ? `${s.color}15` : 'transparent',
                      border: `1px solid ${active ? s.color+'40' : 'rgba(139,92,246,0.08)'}`,
                      boxShadow: active ? `0 0 20px ${s.color}18` : 'none',
                    }}>
                    <div className="relative">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200"
                        style={{
                          background: active ? `${s.color}22` : completed ? `${s.color}0e` : 'rgba(139,92,246,0.06)',
                          border: `1px solid ${active ? s.color+'50' : completed ? s.color+'25' : 'rgba(139,92,246,0.12)'}`,
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
            style={{ background:'rgba(10,11,28,0.85)', border:`1px solid ${currentStep.color}30`, backdropFilter:'blur(24px)', boxShadow:`0 0 50px ${currentStep.color}06, 0 4px 40px rgba(0,0,0,0.4)` }}>

            {/* Step color top accent */}
            <div className="h-0.5" style={{ background:`linear-gradient(90deg, ${currentStep.color} 0%, ${currentStep.color}00 60%)` }}/>

            {/* Step header */}
            <div className="flex items-center gap-4 px-6 pt-5 pb-4"
              style={{ borderBottom:`1px solid rgba(139,92,246,0.1)` }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background:`${currentStep.color}18`, border:`1px solid ${currentStep.color}35`, boxShadow:`0 0 20px ${currentStep.color}15` }}>
                <currentStep.icon size={22} style={{ color:currentStep.color }}/>
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-white">{t(currentStep.labelKey)}</h2>
                <p className="text-xs mt-0.5" style={{ color:'#475569' }}>{t(currentStep.descKey)}</p>
              </div>
              <div className="text-xs font-mono font-bold px-3 py-1.5 rounded-lg flex-shrink-0"
                style={{ background:`${currentStep.color}0e`, color:`${currentStep.color}bb`, border:`1px solid ${currentStep.color}20` }}>
                {currentStepIdx+1} / {STEPS.length}
              </div>
            </div>

            {/* Form content */}
            <div className="p-6 space-y-5">

              {step === 'identity' && (
                <div className="space-y-5">
                  <Field label={t('brand.identityBrandNameLabel')}>
                    <NxInput value={form.brandName||''} onChange={v=>set('brandName',v)}
                      placeholder={t('brand.identityBrandNamePlaceholder')} accentColor={currentStep.color}/>
                  </Field>
                  <Field label={t('brand.identityIndustryLabel')}>
                    <div className="relative">
                      <select value={form.industry||''} onChange={e=>set('industry',e.target.value)}
                        className="w-full appearance-none px-4 py-3 rounded-xl text-sm focus:outline-none transition-all"
                        style={{ background:'rgba(8,9,28,0.7)', border:'1px solid rgba(139,92,246,0.2)', color:form.industry?'#f1f5f9':'#4b5563' }}>
                        <option value="" style={{background:'#0c0d24'}}>{t('brand.identityIndustryPlaceholder')}</option>
                        {(locale==='ar'?INDUSTRIES_AR:INDUSTRIES_EN).map((ind,idx)=>(
                          <option key={idx} value={ind} style={{background:'#0c0d24'}}>{ind}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{color:'#4b5563'}}/>
                    </div>
                  </Field>
                  <Field label={t('brand.identityDescLabel')}>
                    <NxInput textarea value={form.description||''} onChange={v=>set('description',v)}
                      placeholder={t('brand.identityDescPlaceholder')} accentColor={currentStep.color}/>
                  </Field>
                  <Field label={t('brand.identityNotesLabel')}>
                    <NxInput textarea value={form.strategicNotes||''} onChange={v=>set('strategicNotes',v)}
                      placeholder={t('brand.identityNotesPlaceholder')} accentColor={currentStep.color}/>
                  </Field>
                </div>
              )}

              {step === 'product' && (
                <div className="space-y-5">
                  <Field label={t('brand.productPrimaryLabel')}>
                    <NxInput textarea value={form.primaryOffer||''} onChange={v=>set('primaryOffer',v)}
                      placeholder={t('brand.productPrimaryPlaceholder')} accentColor={currentStep.color}/>
                  </Field>
                  <TagInput label={t('brand.productSecondaryLabel')} placeholder={t('brand.productSecondaryPlaceholder')}
                    values={form.secondaryOffers||[]} onChange={v=>set('secondaryOffers',v)} accentColor={currentStep.color}/>
                  <Field label={t('brand.productPriceLabel')}>
                    <RadioGroup options={PRICE_OPTIONS.map(o=>({v:o.v,l:locale==='ar'?o.l:o.lEn}))}
                      value={form.pricePoint||''} onChange={v=>set('pricePoint',v)} color={currentStep.color}/>
                  </Field>
                  <TagInput label={t('brand.productAdvantagesLabel')} placeholder={t('brand.productAdvantagesPlaceholder')}
                    values={form.uniqueAdvantages||[]} onChange={v=>set('uniqueAdvantages',v)} accentColor={currentStep.color}/>
                </div>
              )}

              {step === 'audience' && (
                <div className="space-y-5">
                  <Field label={t('brand.audienceDescLabel')}>
                    <NxInput textarea value={form.targetAudience||''} onChange={v=>set('targetAudience',v)}
                      placeholder={t('brand.audienceDescPlaceholder')} accentColor={currentStep.color}/>
                  </Field>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label={t('brand.audienceAgeLabel')}>
                      <div className="flex flex-wrap gap-2">
                        {(locale==='ar'?AGE_OPTIONS_AR:AGE_OPTIONS_EN).map(a=>(
                          <button key={a} onClick={()=>set('audienceAge',a)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                            style={{
                              background:form.audienceAge===a?`${currentStep.color}18`:'rgba(12,13,36,0.6)',
                              border:`1px solid ${form.audienceAge===a?currentStep.color+'50':'rgba(139,92,246,0.18)'}`,
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
                    values={form.audiencePainPoints||[]} onChange={v=>set('audiencePainPoints',v)} accentColor={currentStep.color}/>
                  <TagInput label={t('brand.audienceDesireLabel')} placeholder={t('brand.audienceDesirePlaceholder')}
                    values={form.audienceDesires||[]} onChange={v=>set('audienceDesires',v)} accentColor={currentStep.color}/>
                </div>
              )}

              {step === 'voice' && (
                <div className="space-y-5">
                  <Field label={t('brand.voiceToneLabel')}>
                    <ToggleGrid options={locale==='ar'?TONE_OPTIONS_AR:TONE_OPTIONS_EN}
                      selected={form.toneKeywords||[]} onChange={v=>set('toneKeywords',v)} color={currentStep.color}/>
                  </Field>
                  <Field label={t('brand.voiceStyleLabel')}>
                    <NxInput value={form.writingStyle||''} onChange={v=>set('writingStyle',v)}
                      placeholder={t('brand.voiceStylePlaceholder')} accentColor={currentStep.color}/>
                  </Field>
                  <TagInput label={t('brand.voiceAvoidLabel')} placeholder={t('brand.voiceAvoidPlaceholder')}
                    values={form.avoidKeywords||[]} onChange={v=>set('avoidKeywords',v)} accentColor={currentStep.color}/>
                  <TagInput label={t('brand.voiceHooksLabel')} placeholder={t('brand.voiceHooksPlaceholder')}
                    values={form.winningHooks||[]} onChange={v=>set('winningHooks',v)} accentColor={currentStep.color}/>
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
                            background:form.visualStyle===style?`${currentStep.color}18`:'rgba(12,13,36,0.6)',
                            border:`1px solid ${form.visualStyle===style?currentStep.color+'50':'rgba(139,92,246,0.18)'}`,
                            color:form.visualStyle===style?currentStep.color:'#64748b',
                            boxShadow:form.visualStyle===style?`0 0 10px ${currentStep.color}18`:'none',
                          }}>
                          {form.visualStyle===style&&'● '}{style}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <TagInput label={t('brand.platformsAnglesLabel')} placeholder={t('brand.platformsAnglesPlaceholder')}
                    values={form.winningAngles||[]} onChange={v=>set('winningAngles',v)} accentColor={currentStep.color}/>
                  <TagInput label={t('brand.platformsFailedLabel')} placeholder={t('brand.platformsFailedPlaceholder')}
                    values={form.failedAngles||[]} onChange={v=>set('failedAngles',v)} accentColor={currentStep.color}/>
                </div>
              )}

              {step === 'competitors' && (
                <div className="space-y-5">
                  <Field label={t('brand.competitorsNotesLabel')}>
                    <NxInput textarea value={form.competitorNotes||''} onChange={v=>set('competitorNotes',v)}
                      placeholder={t('brand.competitorsNotesPlaceholder')} accentColor={currentStep.color}/>
                  </Field>
                </div>
              )}

              {/* ── Navigation ─────────────────────────────────── */}
              <div className="flex items-center justify-between pt-5"
                style={{ borderTop:'1px solid rgba(139,92,246,0.1)' }}>

                <button
                  onClick={() => currentStepIdx > 0 && setStep(STEPS[currentStepIdx-1].id)}
                  disabled={currentStepIdx === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-20"
                  style={{ color:'#64748b', background:currentStepIdx===0?'transparent':'rgba(12,13,36,0.6)', border:currentStepIdx===0?'none':'1px solid rgba(139,92,246,0.15)' }}>
                  <ArrowRight size={14}/> {t('brand.navPrevious')}
                </button>

                {/* Morphing dots */}
                <div className="flex items-center gap-1.5">
                  {STEPS.map(s => (
                    <button key={s.id} onClick={() => setStep(s.id)}
                      className="rounded-full transition-all duration-300"
                      style={{ width:step===s.id?'22px':'6px', height:'6px', background:step===s.id?s.color:'rgba(139,92,246,0.2)' }}/>
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
                style={{ background:'rgba(10,11,28,0.7)', border:'1px solid rgba(139,92,246,0.12)', backdropFilter:'blur(12px)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                  style={{ background:`${c.color}12`, border:`1px solid ${c.color}22` }}>
                  <c.icon size={16} style={{ color:c.color }}/>
                </div>
                <p className="text-xs font-bold text-white mb-1">{c.label}</p>
                <p className="text-[11px] leading-relaxed" style={{ color:'#475569' }}>{t(c.descKey)}</p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </AppShell>
  )
}
