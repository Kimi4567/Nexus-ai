'use client'

import AppShell from '@/components/AppShell'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { useBrandBrain, getBrandCompleteness, type BrandProfile } from '@/hooks/useBrandBrain'
import {
  Loader2, Brain, Check, ChevronDown, Sparkles, Save,
  Target, Mic, Package, Users, Globe, BarChart2, AlertTriangle,
  CheckCircle2, ArrowLeft, ArrowRight, Zap
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   BRAND BRAIN — عقل العلامة التجارية
   كل المعلومات هنا تُحقن تلقائياً في كل وكيل ذكاء اصطناعي
   ═══════════════════════════════════════════════════════════════ */

type StepId = 'identity' | 'product' | 'audience' | 'voice' | 'platforms' | 'competitors'

interface Step {
  id: StepId
  labelKey: string
  descKey: string
  icon: React.ElementType
  color: string
}

const STEPS: Step[] = [
  { id: 'identity',    labelKey: 'brand.stepIdentityLabel',    descKey: 'brand.stepIdentityDesc',    icon: Brain,   color: '#f59e0b' },
  { id: 'product',     labelKey: 'brand.stepProductLabel',     descKey: 'brand.stepProductDesc',     icon: Package, color: '#06b6d4' },
  { id: 'audience',    labelKey: 'brand.stepAudienceLabel',    descKey: 'brand.stepAudienceDesc',    icon: Users,   color: '#8b5cf6' },
  { id: 'voice',       labelKey: 'brand.stepVoiceLabel',       descKey: 'brand.stepVoiceDesc',       icon: Mic,     color: '#10b981' },
  { id: 'platforms',   labelKey: 'brand.stepPlatformsLabel',   descKey: 'brand.stepPlatformsDesc',   icon: Globe,   color: '#ec4899' },
  { id: 'competitors', labelKey: 'brand.stepCompetitorsLabel', descKey: 'brand.stepCompetitorsDesc', icon: Target,  color: '#f97316' },
]

const INDUSTRIES_AR = [
  'تجارة إلكترونية', 'مطاعم وأغذية', 'موضة وأزياء', 'صحة وجمال',
  'تقنية وتطبيقات', 'عقارات', 'تعليم وتدريب', 'خدمات مهنية',
  'سياحة وسفر', 'رياضة ولياقة', 'ديكور وأثاث', 'سيارات', 'آخر',
]
const INDUSTRIES_EN = [
  'E-commerce', 'Restaurants & Food', 'Fashion & Apparel', 'Health & Beauty',
  'Tech & Apps', 'Real Estate', 'Education & Training', 'Professional Services',
  'Travel & Tourism', 'Sports & Fitness', 'Home & Furniture', 'Automotive', 'Other',
]

const PLATFORMS_LIST = ['Instagram', 'TikTok', 'Facebook', 'Snapchat', 'YouTube', 'LinkedIn', 'X / Twitter', 'Pinterest']
const TONE_OPTIONS_AR = ['حماسي', 'احترافي', 'مرح', 'عاطفي', 'جريء', 'هادئ', 'ملهم', 'مباشر', 'راقي', 'شبابي']
const TONE_OPTIONS_EN = ['Energetic', 'Professional', 'Playful', 'Emotional', 'Bold', 'Calm', 'Inspiring', 'Direct', 'Upscale', 'Youthful']
const PRICE_OPTIONS = [
  { v: 'budget',    l: 'اقتصادي',  lEn: 'Budget' },
  { v: 'mid-range', l: 'متوسط',    lEn: 'Mid-range' },
  { v: 'premium',   l: 'بريميوم',  lEn: 'Premium' },
  { v: 'luxury',    l: 'فاخر',     lEn: 'Luxury' },
]
const AGE_OPTIONS_AR = ['13-17', '18-24', '25-34', '35-44', '45-54', '55+', 'جميع الأعمار']
const AGE_OPTIONS_EN = ['13-17', '18-24', '25-34', '35-44', '45-54', '55+', 'All ages']

// ── NEXUS glass tokens ──────────────────────────────────────────
const glass     = { background: 'rgba(12,13,36,0.65)', border: '1px solid rgba(139,92,246,0.15)', backdropFilter: 'blur(20px)' }
const glassHi   = { background: 'rgba(12,13,36,0.7)',  border: '1px solid rgba(139,92,246,0.25)', backdropFilter: 'blur(20px)' }
const inputBase = { background: 'rgba(8,9,28,0.8)', border: '1px solid rgba(139,92,246,0.18)', color: '#f8fafc' }
const chipBase  = { background: 'rgba(12,13,36,0.55)', border: '1px solid rgba(139,92,246,0.15)', color: '#64748b' }

// ── Sub-components ─────────────────────────────────────────────

function TagInput({ label, placeholder, values, onChange, suggestions }: {
  label: string; placeholder: string; values: string[]; onChange: (v: string[]) => void; suggestions?: string[]
}) {
  const [input, setInput] = useState('')
  const add = (val: string) => {
    const v = val.trim()
    if (v && !values.includes(v)) onChange([...values, v])
    setInput('')
  }
  const remove = (i: number) => onChange(values.filter((_, idx) => idx !== i))

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium" style={{ color: '#94a3b8' }}>{label}</label>
      <div className="flex flex-wrap gap-1.5 p-3 rounded-xl min-h-[48px]" style={inputBase}>
        {values.map((v, i) => (
          <span key={i} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
            style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b' }}>
            {v}
            <button onClick={() => remove(i)} className="opacity-50 hover:opacity-100 hover:text-red-400 transition-all ml-0.5">×</button>
          </span>
        ))}
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(input) } }}
          placeholder={values.length ? '' : placeholder}
          className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder-gray-600"
          style={{ color: '#e2e8f0' }}
        />
      </div>
      {suggestions && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.filter(s => !values.includes(s)).slice(0, 6).map(s => (
            <button key={s} onClick={() => add(s)}
              className="px-2.5 py-1 rounded-lg text-xs transition-all hover:border-violet-500/40 hover:text-violet-300"
              style={chipBase}>
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium" style={{ color: '#94a3b8' }}>{label}</label>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, textarea }: {
  value: string; onChange: (v: string) => void; placeholder?: string; textarea?: boolean
}) {
  const cls = "w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none transition-all placeholder-gray-600"
  const focusStyle = 'rgba(139,92,246,0.35)'
  const [focused, setFocused] = useState(false)
  const style = { ...inputBase, border: `1px solid ${focused ? focusStyle : 'rgba(139,92,246,0.18)'}` }
  if (textarea) return (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      rows={3} className={`${cls} resize-none`} style={style}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
  )
  return <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    className={cls} style={style} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
}

function ToggleGrid({ options, selected, onChange, color }: {
  options: string[]; selected: string[]; onChange: (v: string[]) => void; color?: string
}) {
  const c = color || '#8b5cf6'
  const toggle = (v: string) => {
    selected.includes(v) ? onChange(selected.filter(x => x !== v)) : onChange([...selected, v])
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => {
        const active = selected.includes(o)
        return (
          <button key={o} onClick={() => toggle(o)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: active ? `${c}1a` : 'rgba(12,13,36,0.55)',
              border: `1px solid ${active ? c + '55' : 'rgba(139,92,246,0.15)'}`,
              color: active ? c : '#64748b',
            }}>
            {active && <span className="mr-1 opacity-80">✓</span>}{o}
          </button>
        )
      })}
    </div>
  )
}

function RadioGroup({ options, value, onChange }: {
  options: { v: string; l: string }[]; value: string; onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)}
          className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
          style={{
            background: value === o.v ? 'rgba(245,158,11,0.15)' : 'rgba(12,13,36,0.55)',
            border: `1px solid ${value === o.v ? 'rgba(245,158,11,0.45)' : 'rgba(139,92,246,0.15)'}`,
            color: value === o.v ? '#f59e0b' : '#64748b',
          }}>
          {value === o.v && <span className="mr-1">●</span>}{o.l}
        </button>
      ))}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────
export default function BrandBrainPage() {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const router = useRouter()
  const { locale, dir, t } = useI18n()
  const { brand, loading, saving, saveBrand } = useBrandBrain()

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/login')
  }, [authLoading, isAuthenticated, router])

  const [step, setStep] = useState<StepId>('identity')
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState<BrandProfile>({
    brandName: '', industry: '', description: '',
    primaryOffer: '', secondaryOffers: [], pricePoint: 'mid-range', uniqueAdvantages: [],
    targetAudience: '', audienceAge: '', audienceLocation: '', audiencePainPoints: [], audienceDesires: [],
    toneKeywords: [], avoidKeywords: [], writingStyle: '',
    topPlatforms: [], visualStyle: '',
    winningHooks: [], winningAngles: [], failedAngles: [], competitorNotes: '', strategicNotes: '',
  })

  useEffect(() => {
    if (brand) setForm(b => ({ ...b, ...brand }))
  }, [brand])

  const set = (k: keyof BrandProfile, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    const ok = await saveBrand(form)
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 3000) }
  }

  const { score, missing } = getBrandCompleteness(form)
  const currentStepIdx = STEPS.findIndex(s => s.id === step)
  const currentStep = STEPS[currentStepIdx]

  if (authLoading || loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#06071A' }}>
      <Loader2 className="animate-spin text-amber-500" size={32} />
    </div>
  )
  if (!isAuthenticated) return null

  const scoreColor = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <AppShell>
      <div className="relative min-h-screen" dir={dir}>

        {/* ── Background ─────────────────────────────────────── */}
        <div className="absolute inset-0 nx-bg-grid pointer-events-none opacity-30" />
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
          <div className="absolute rounded-full blur-[180px] opacity-20"
            style={{ width: 700, height: 500, background: 'radial-gradient(ellipse, rgba(139,92,246,0.2) 0%, transparent 70%)', top: '-5%', right: '-15%' }} />
          <div className="absolute rounded-full blur-[120px] opacity-10"
            style={{ width: 400, height: 400, background: 'radial-gradient(ellipse, rgba(245,158,11,0.25) 0%, transparent 70%)', bottom: '20%', left: '-5%' }} />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 py-8 space-y-5">

          {/* ── Eyebrow + Header ────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-3.5 h-3.5 text-amber-400/70" />
              <span className="text-xs font-mono tracking-widest uppercase" style={{ color: 'rgba(245,158,11,0.6)' }}>
                NEXUS BRAND BRAIN
              </span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.06))', border: '1px solid rgba(245,158,11,0.3)', boxShadow: '0 0 32px rgba(245,158,11,0.12)' }}>
                    <Brain size={26} className="text-amber-400" />
                  </div>
                  {score >= 80 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: '#10b981', boxShadow: '0 0 8px rgba(16,185,129,0.5)' }}>
                      <Check size={10} className="text-white" />
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-2xl font-bold text-white">Brand Brain</h1>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>
                      {t('brand.badgeMemory')}
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: '#64748b' }}>{t('brand.aiInjected')}</p>
                </div>
              </div>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex-shrink-0 disabled:opacity-60"
                style={{
                  background: saved ? 'rgba(16,185,129,0.15)' : 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: saved ? '#10b981' : '#0a0a0a',
                  boxShadow: saved ? 'none' : '0 0 24px rgba(245,158,11,0.25)',
                  border: saved ? '1px solid rgba(16,185,129,0.3)' : 'none',
                }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
                {saving ? t('brand.savingBtn') : saved ? t('brand.savedBtn') : t('brand.saveAllBtn')}
              </button>
            </div>
          </div>

          {/* ── Completeness bar ────────────────────────────────── */}
          <div className="rounded-2xl p-5" style={glass}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-amber-400" />
                <span className="text-sm font-semibold text-white">{t('brand.completeness')}</span>
              </div>
              <span className="text-sm font-bold tabular-nums" style={{ color: scoreColor }}>
                {score}%
              </span>
            </div>
            {/* Track */}
            <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: 'rgba(139,92,246,0.1)' }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${score}%`, background: score >= 80 ? 'linear-gradient(90deg,#10b981,#059669)' : score >= 50 ? 'linear-gradient(90deg,#f59e0b,#d97706)' : 'linear-gradient(90deg,#ef4444,#dc2626)' }} />
            </div>
            {/* Step dots row */}
            <div className="flex gap-1.5 items-center">
              {STEPS.map(s => {
                const done = form[s.id === 'identity' ? 'brandName' : s.id === 'product' ? 'primaryOffer' : s.id === 'audience' ? 'targetAudience' : s.id === 'voice' ? 'writingStyle' : s.id === 'platforms' ? 'visualStyle' : 'competitorNotes'] as string
                return (
                  <div key={s.id} className="flex items-center gap-1 cursor-pointer" onClick={() => setStep(s.id)}>
                    <div className="w-1.5 h-1.5 rounded-full transition-all"
                      style={{ background: step === s.id ? s.color : done ? 'rgba(139,92,246,0.4)' : 'rgba(139,92,246,0.15)' }} />
                  </div>
                )
              })}
              {missing.length > 0 && (
                <p className="text-xs ml-2" style={{ color: '#475569' }}>
                  {t('brand.missing')} {missing.join(locale === 'ar' ? '، ' : ', ')}
                </p>
              )}
            </div>
            {score < 60 && (
              <div className="flex items-start gap-2 mt-3 p-3 rounded-xl"
                style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs" style={{ color: 'rgba(245,158,11,0.75)' }}>
                  {t('brand.lowCompletenessWarning')}
                </p>
              </div>
            )}
          </div>

          {/* ── Step tabs ───────────────────────────────────────── */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mb-1">
            {STEPS.map(s => {
              const active = step === s.id
              return (
                <button key={s.id} onClick={() => setStep(s.id)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex-shrink-0"
                  style={{
                    background: active ? `${s.color}18` : 'rgba(12,13,36,0.55)',
                    border: `1px solid ${active ? s.color + '45' : 'rgba(139,92,246,0.15)'}`,
                    color: active ? s.color : '#64748b',
                    boxShadow: active ? `0 0 16px ${s.color}20` : 'none',
                  }}>
                  <s.icon size={14} />
                  <span>{t(s.labelKey)}</span>
                </button>
              )
            })}
          </div>

          {/* ── Step content ────────────────────────────────────── */}
          <div className="rounded-2xl p-6 space-y-5"
            style={{ ...glassHi, borderColor: `${currentStep.color}30` }}>

            {/* Step header */}
            <div className="flex items-center gap-3 pb-4"
              style={{ borderBottom: `1px solid rgba(139,92,246,0.12)` }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${currentStep.color}18`, border: `1px solid ${currentStep.color}35` }}>
                <currentStep.icon size={18} style={{ color: currentStep.color }} />
              </div>
              <div>
                <h2 className="text-white font-bold text-base">{t(currentStep.labelKey)}</h2>
                <p className="text-xs mt-0.5" style={{ color: '#475569' }}>{t(currentStep.descKey)}</p>
              </div>
            </div>

            {/* IDENTITY */}
            {step === 'identity' && (
              <div className="space-y-4">
                <Field label={t('brand.identityBrandNameLabel')}>
                  <Input value={form.brandName || ''} onChange={v => set('brandName', v)}
                    placeholder={t('brand.identityBrandNamePlaceholder')} />
                </Field>
                <Field label={t('brand.identityIndustryLabel')}>
                  <div className="relative">
                    <select value={form.industry || ''} onChange={e => set('industry', e.target.value)}
                      className="w-full appearance-none px-3 py-2.5 rounded-xl text-sm pr-8 focus:outline-none"
                      style={{ ...inputBase, color: form.industry ? '#e2e8f0' : '#4b5563' }}>
                      <option value="" style={{ background: '#0c0d24' }}>{t('brand.identityIndustryPlaceholder')}</option>
                      {(locale === 'ar' ? INDUSTRIES_AR : INDUSTRIES_EN).map((ind, idx) => (
                        <option key={idx} value={ind} style={{ background: '#0c0d24' }}>{ind}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#4b5563' }} />
                  </div>
                </Field>
                <Field label={t('brand.identityDescLabel')}>
                  <Input textarea value={form.description || ''} onChange={v => set('description', v)}
                    placeholder={t('brand.identityDescPlaceholder')} />
                </Field>
                <Field label={t('brand.identityNotesLabel')}>
                  <Input textarea value={form.strategicNotes || ''} onChange={v => set('strategicNotes', v)}
                    placeholder={t('brand.identityNotesPlaceholder')} />
                </Field>
              </div>
            )}

            {/* PRODUCT */}
            {step === 'product' && (
              <div className="space-y-4">
                <Field label={t('brand.productPrimaryLabel')}>
                  <Input textarea value={form.primaryOffer || ''} onChange={v => set('primaryOffer', v)}
                    placeholder={t('brand.productPrimaryPlaceholder')} />
                </Field>
                <TagInput
                  label={t('brand.productSecondaryLabel')}
                  placeholder={t('brand.productSecondaryPlaceholder')}
                  values={form.secondaryOffers || []} onChange={v => set('secondaryOffers', v)} />
                <Field label={t('brand.productPriceLabel')}>
                  <RadioGroup
                    options={PRICE_OPTIONS.map(o => ({ v: o.v, l: locale === 'ar' ? o.l : o.lEn }))}
                    value={form.pricePoint || ''} onChange={v => set('pricePoint', v)} />
                </Field>
                <TagInput
                  label={t('brand.productAdvantagesLabel')}
                  placeholder={t('brand.productAdvantagesPlaceholder')}
                  values={form.uniqueAdvantages || []} onChange={v => set('uniqueAdvantages', v)} />
              </div>
            )}

            {/* AUDIENCE */}
            {step === 'audience' && (
              <div className="space-y-4">
                <Field label={t('brand.audienceDescLabel')}>
                  <Input textarea value={form.targetAudience || ''} onChange={v => set('targetAudience', v)}
                    placeholder={t('brand.audienceDescPlaceholder')} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label={t('brand.audienceAgeLabel')}>
                    <div className="flex flex-wrap gap-2">
                      {(locale === 'ar' ? AGE_OPTIONS_AR : AGE_OPTIONS_EN).map(a => (
                        <button key={a} onClick={() => set('audienceAge', a)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                          style={{
                            background: form.audienceAge === a ? 'rgba(139,92,246,0.18)' : 'rgba(12,13,36,0.55)',
                            border: `1px solid ${form.audienceAge === a ? 'rgba(139,92,246,0.45)' : 'rgba(139,92,246,0.15)'}`,
                            color: form.audienceAge === a ? '#a78bfa' : '#64748b',
                          }}>
                          {form.audienceAge === a && <span className="mr-1">●</span>}{a}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label={t('brand.audienceLocationLabel')}>
                    <Input value={form.audienceLocation || ''} onChange={v => set('audienceLocation', v)}
                      placeholder={t('brand.audienceLocationPlaceholder')} />
                  </Field>
                </div>
                <TagInput
                  label={t('brand.audiencePainLabel')}
                  placeholder={t('brand.audiencePainPlaceholder')}
                  values={form.audiencePainPoints || []} onChange={v => set('audiencePainPoints', v)} />
                <TagInput
                  label={t('brand.audienceDesireLabel')}
                  placeholder={t('brand.audienceDesirePlaceholder')}
                  values={form.audienceDesires || []} onChange={v => set('audienceDesires', v)} />
              </div>
            )}

            {/* VOICE */}
            {step === 'voice' && (
              <div className="space-y-4">
                <Field label={t('brand.voiceToneLabel')}>
                  <ToggleGrid options={locale === 'ar' ? TONE_OPTIONS_AR : TONE_OPTIONS_EN}
                    selected={form.toneKeywords || []} onChange={v => set('toneKeywords', v)} color="#10b981" />
                </Field>
                <Field label={t('brand.voiceStyleLabel')}>
                  <Input value={form.writingStyle || ''} onChange={v => set('writingStyle', v)}
                    placeholder={t('brand.voiceStylePlaceholder')} />
                </Field>
                <TagInput
                  label={t('brand.voiceAvoidLabel')}
                  placeholder={t('brand.voiceAvoidPlaceholder')}
                  values={form.avoidKeywords || []} onChange={v => set('avoidKeywords', v)} />
                <TagInput
                  label={t('brand.voiceHooksLabel')}
                  placeholder={t('brand.voiceHooksPlaceholder')}
                  values={form.winningHooks || []} onChange={v => set('winningHooks', v)} />
              </div>
            )}

            {/* PLATFORMS */}
            {step === 'platforms' && (
              <div className="space-y-4">
                <Field label={t('brand.platformsActiveLabel')}>
                  <ToggleGrid options={PLATFORMS_LIST} selected={form.topPlatforms || []}
                    onChange={v => set('topPlatforms', v)} color="#ec4899" />
                </Field>
                <Field label={t('brand.platformsVisualLabel')}>
                  <div className="flex flex-wrap gap-2">
                    {['minimalist', 'bold', 'lifestyle', 'corporate', 'playful', 'luxury', 'editorial'].map(style => (
                      <button key={style} onClick={() => set('visualStyle', style)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={{
                          background: form.visualStyle === style ? 'rgba(236,72,153,0.15)' : 'rgba(12,13,36,0.55)',
                          border: `1px solid ${form.visualStyle === style ? 'rgba(236,72,153,0.45)' : 'rgba(139,92,246,0.15)'}`,
                          color: form.visualStyle === style ? '#f472b6' : '#64748b',
                        }}>
                        {form.visualStyle === style && <span className="mr-1">●</span>}{style}
                      </button>
                    ))}
                  </div>
                </Field>
                <TagInput
                  label={t('brand.platformsAnglesLabel')}
                  placeholder={t('brand.platformsAnglesPlaceholder')}
                  values={form.winningAngles || []} onChange={v => set('winningAngles', v)} />
                <TagInput
                  label={t('brand.platformsFailedLabel')}
                  placeholder={t('brand.platformsFailedPlaceholder')}
                  values={form.failedAngles || []} onChange={v => set('failedAngles', v)} />
              </div>
            )}

            {/* COMPETITORS */}
            {step === 'competitors' && (
              <div className="space-y-4">
                <Field label={t('brand.competitorsNotesLabel')}>
                  <Input textarea value={form.competitorNotes || ''} onChange={v => set('competitorNotes', v)}
                    placeholder={t('brand.competitorsNotesPlaceholder')} />
                </Field>
              </div>
            )}

            {/* ── Navigation ────────────────────────────────────── */}
            <div className="flex items-center justify-between pt-4"
              style={{ borderTop: '1px solid rgba(139,92,246,0.12)' }}>
              <button
                onClick={() => currentStepIdx > 0 && setStep(STEPS[currentStepIdx - 1].id)}
                disabled={currentStepIdx === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all disabled:opacity-30"
                style={{ color: '#64748b', background: currentStepIdx === 0 ? 'transparent' : 'rgba(12,13,36,0.5)', border: currentStepIdx === 0 ? 'none' : '1px solid rgba(139,92,246,0.12)' }}>
                <ArrowRight size={14} />
                {t('brand.navPrevious')}
              </button>

              {/* Step dots */}
              <div className="flex items-center gap-1.5">
                {STEPS.map(s => (
                  <button key={s.id} onClick={() => setStep(s.id)}
                    className="rounded-full transition-all duration-200"
                    style={{
                      width: step === s.id ? '20px' : '6px',
                      height: '6px',
                      background: step === s.id ? s.color : 'rgba(139,92,246,0.2)',
                    }} />
                ))}
              </div>

              {currentStepIdx < STEPS.length - 1 ? (
                <button
                  onClick={() => setStep(STEPS[currentStepIdx + 1].id)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  {t('brand.navNext')}
                  <ArrowLeft size={14} />
                </button>
              ) : (
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#0a0a0a', boxShadow: '0 0 20px rgba(245,158,11,0.2)' }}>
                  <Zap size={14} />
                  {t('brand.navSaveActivate')}
                </button>
              )}
            </div>
          </div>

          {/* ── What this does ───────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { color: '#f59e0b', icon: Brain,     label: 'NEX Studio',  descKey: 'brand.nexCardDesc' },
              { color: '#06b6d4', icon: Zap,       label: 'VEX Ads',     descKey: 'brand.vexCardDesc' },
              { color: '#8b5cf6', icon: BarChart2, label: 'PULSE',       descKey: 'brand.pulseCardDesc' },
              { color: '#10b981', icon: Target,    label: 'Sentinel',    descKey: 'brand.sentinelCardDesc' },
            ].map((c, i) => (
              <div key={i} className="rounded-xl p-3.5 transition-all hover:border-opacity-30"
                style={{ background: 'rgba(12,13,36,0.6)', border: `1px solid rgba(139,92,246,0.15)`, backdropFilter: 'blur(12px)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2.5"
                  style={{ background: `${c.color}15`, border: `1px solid ${c.color}25` }}>
                  <c.icon size={15} style={{ color: c.color }} />
                </div>
                <p className="text-xs font-semibold text-white mb-0.5">{c.label}</p>
                <p className="text-[11px] leading-relaxed" style={{ color: '#475569' }}>{t(c.descKey)}</p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </AppShell>
  )
}
