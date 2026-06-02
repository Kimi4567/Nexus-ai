'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { Check, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'

const INDUSTRIES = [
  { value: 'ecommerce',   ar: 'تجارة إلكترونية', en: 'E-commerce',    icon: '🛍️' },
  { value: 'saas',        ar: 'برمجيات / تقنية',  en: 'Software / Tech', icon: '💻' },
  { value: 'agency',      ar: 'وكالة إعلانية',     en: 'Ad Agency',      icon: '🏢' },
  { value: 'fitness',     ar: 'لياقة وصحة',        en: 'Fitness & Health',icon: '💪' },
  { value: 'food',        ar: 'أغذية ومشروبات',    en: 'Food & Beverage', icon: '🍕' },
  { value: 'real_estate', ar: 'عقارات',             en: 'Real Estate',     icon: '🏠' },
  { value: 'beauty',      ar: 'جمال وعناية',        en: 'Beauty & Care',   icon: '✨' },
  { value: 'consulting',  ar: 'استشارات',           en: 'Consulting',      icon: '📊' },
  { value: 'other',       ar: 'أخرى',               en: 'Other',           icon: '🌐' },
]

const GOALS = [
  { id: 'grow_followers',   ar: 'زيادة المتابعين',        en: 'Grow Followers',    icon: '📈' },
  { id: 'generate_leads',   ar: 'توليد Leads',             en: 'Generate Leads',    icon: '🎯' },
  { id: 'launch_product',   ar: 'إطلاق منتج جديد',        en: 'Launch Product',    icon: '🚀' },
  { id: 'drive_sales',      ar: 'زيادة المبيعات',          en: 'Drive Sales',       icon: '💰' },
  { id: 'build_brand',      ar: 'بناء الوعي بالعلامة',    en: 'Build Brand',       icon: '🌟' },
  { id: 'retain_customers', ar: 'الاحتفاظ بالعملاء',       en: 'Retain Customers',  icon: '🤝' },
]

const TONES = [
  { id: 'bold',         ar: 'جريء ومباشر',       en: 'Bold & Direct',      descAr: 'قوي، واثق، بلا تعقيد',       descEn: 'Strong, confident, no fluff' },
  { id: 'friendly',     ar: 'ودود ودافئ',          en: 'Friendly & Warm',    descAr: 'قريب، محادثاتي، إنساني',      descEn: 'Approachable, conversational, human' },
  { id: 'professional', ar: 'راقي واحترافي',       en: 'Premium & Pro',      descAr: 'متطور، موثوق، رسمي',          descEn: 'Sophisticated, trusted, formal' },
  { id: 'playful',      ar: 'مرح وإبداعي',         en: 'Playful & Creative', descAr: 'حيوي، ملهم، طازج',            descEn: 'Vibrant, inspiring, fresh' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const { user, isAuthenticated, loading, authHeader } = useAuth()
  const { locale, dir, t } = useI18n()
  const [step, setStep] = useState(0)

  const [brandName,  setBrandName]  = useState('')
  const [industry,   setIndustry]   = useState('')
  const [audience,   setAudience]   = useState('')
  const [tone,       setTone]       = useState('')
  const [goal,       setGoal]       = useState('')
  const [strategy,   setStrategy]   = useState<any>(null)

  const ob = t('onboarding')

  const displayName =
    user?.user_metadata?.name?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    (ob?.defaultName as string) ||
    ''

  // Redirect unauthenticated users
  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/auth/login')
  }, [loading, isAuthenticated, router])

  // Skip onboarding if workspace already exists
  useEffect(() => {
    if (!isAuthenticated) return
    const token = authHeader()
    if (!token) return
    fetch('/api/workspaces', { headers: { Authorization: token } })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) router.push('/dashboard')
      })
      .catch(() => {})
  }, [isAuthenticated, authHeader, router])

  const handleFinishSetup = async () => {
    setStep(3) // show generating state immediately
    const token  = authHeader()
    const name   = brandName.trim() || (locale === 'ar' ? 'علامتي' : 'My Brand')
    const slug   = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now()

    try {
      await fetch('/api/workspaces', {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug, description: industry }),
      })

      await fetch('/api/brand', {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandName: name,
          industry: industry || 'other',
          targetAudience: audience,
          toneKeywords: tone ? [tone] : ['professional'],
        }),
      }).catch(() => {})

      const res  = await fetch('/api/strategy/generate', {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: goal || 'drive_sales', timeframe: '30', platform: 'multi', budget: 'bootstrap' }),
      })
      const data = await res.json()
      if (data.strategy) setStrategy(data.strategy)
    } catch {
      // fail silently — still proceed to done step
    }

    setStep(4)
  }

  // ── Loading / unauthenticated guard ─────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    )
  }
  if (!isAuthenticated) return null

  // ── Shared card wrapper ──────────────────────────────────────────────────
  const Card = ({ children }: { children: ReactNode }) => (
    <div
      className="w-full max-w-md rounded-2xl glass-panel p-8"
      style={{ boxShadow: '0 0 60px rgba(255,149,0,0.07), 0 4px 32px rgba(0,0,0,0.5)' }}
      dir={dir}
    >
      {children}
    </div>
  )

  // Generation steps list
  const genSteps = [ob?.genStep1, ob?.genStep2, ob?.genStep3, ob?.genStep4] as string[]

  // "What awaits" items
  const awaitItems = [
    { icon: '📅', label: ob?.awaitItem1 as string },
    { icon: '🎯', label: ob?.awaitItem2 as string },
    { icon: '⚡', label: ob?.awaitItem3 as string },
    { icon: '📊', label: ob?.awaitItem4 as string },
  ]

  // Mini-feature cards for welcome step
  const features = [
    { icon: '🧠', label: ob?.featureAiStrategy as string },
    { icon: '📅', label: ob?.featureAutoCalendar as string },
    { icon: '📊', label: ob?.featureLiveAnalytics as string },
  ]

  return (
    <div
      className="min-h-screen bg-bg-base flex flex-col items-center justify-center px-4 py-12"
      style={{ backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(139,92,246,0.12), transparent)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-10">
        <div className="w-8 h-8 rounded-[8px] flex items-center justify-center" style={{ background: "linear-gradient(135deg,#8B5CF6,#10B981)" }}>
          <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
            <path d="M7 7L14 21L21 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M7 7H21"          stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
        <span className="font-bold text-white text-lg tracking-tight">Nexus</span>
      </div>

      {/* Progress bar — visible on steps 1 & 2 */}
      {step >= 1 && step <= 2 && (
        <div className="w-full max-w-md mb-8" dir={dir}>
          <div className="flex justify-between text-xs text-t3 mb-2">
            <span>{(ob?.stepOf as string)?.replace('{step}', String(step))}</span>
            <span>{step === 1 ? ob?.brandStepLabel : ob?.goalStepLabel}</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(139,92,246,0.15)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ background: "linear-gradient(90deg,#8B5CF6,#10B981)", width: `${(step / 2) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* ── STEP 0 — WELCOME ──────────────────────────────────────────────── */}
      {step === 0 && (
        <Card>
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 text-3xl" style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)" }}>
              👋
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              {(ob?.welcomeTitle as string)?.replace('{name}', displayName)}
            </h1>
            <p className="text-t2 text-sm mb-8 leading-relaxed">
              {ob?.welcomeSubtitle}
            </p>

            <div className="grid grid-cols-3 gap-3 mb-8">
              {features.map(f => (
                <div
                  key={f.label}
                  className="p-3 rounded-xl text-center" style={{ background: 'rgba(12,13,36,0.6)', border: '1px solid rgba(139,92,246,0.12)' }}
                >
                  <div className="text-xl mb-1">{f.icon}</div>
                  <div className="text-[11px] font-semibold text-t2">{f.label}</div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep(1)}
              className="btn-gradient w-full py-3.5 text-white font-bold rounded-xl transition-all text-sm"
              style={{ boxShadow: '0 0 24px rgba(255,149,0,0.25)' }}
            >
              {ob?.welcomeCta}
            </button>
          </div>
        </Card>
      )}

      {/* ── STEP 1 — BRAND ────────────────────────────────────────────────── */}
      {step === 1 && (
        <Card>
          <h2 className="text-xl font-bold text-white mb-1">{ob?.brandTitle}</h2>
          <p className="text-t2 text-sm mb-6">{ob?.brandSubtitle}</p>

          <div className="space-y-5">
            {/* Brand name */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-t3 mb-2 block">
                {ob?.brandNameLabel2}
              </label>
              <input
                type="text"
                value={brandName}
                onChange={e => setBrandName(e.target.value)}
                placeholder={ob?.brandNamePlaceholder2 as string}
                className="w-full px-4 py-3 rounded-xl text-white placeholder-text-muted text-sm focus:outline-none transition-all" style={{ background: "rgba(12,13,36,0.65)", border: "1px solid rgba(139,92,246,0.15)" }}
                autoFocus
              />
            </div>

            {/* Industry */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-t3 mb-2 block">
                {ob?.industryLabel}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {INDUSTRIES.map(ind => (
                  <button
                    key={ind.value}
                    onClick={() => setIndustry(ind.value)}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      industry === ind.value
                        ? 'border-[rgba(139,92,246,0.5)] text-white' : 'border-[rgba(139,92,246,0.12)]'
                    }`}
                  >
                    <div className="text-lg mb-0.5">{ind.icon}</div>
                    <div className="text-[10px] font-semibold leading-tight">{locale === 'ar' ? ind.ar : ind.en}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Audience */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-t3 mb-2 block">
                {ob?.audienceLabel}{' '}
                <span className="text-t4 normal-case font-normal">{ob?.audienceOptional}</span>
              </label>
              <input
                type="text"
                value={audience}
                onChange={e => setAudience(e.target.value)}
                placeholder={ob?.audiencePlaceholder as string}
                className="w-full px-4 py-3 rounded-xl text-white placeholder-text-muted text-sm focus:outline-none transition-all" style={{ background: "rgba(12,13,36,0.65)", border: "1px solid rgba(139,92,246,0.15)" }}
              />
            </div>

            {/* Tone */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-t3 mb-2 block">
                {ob?.toneLabel2}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {TONES.map(tn => (
                  <button
                    key={tn.id}
                    onClick={() => setTone(tn.id)}
                    className={`p-3 rounded-xl border text-right transition-all ${
                      tone === tn.id
                        ? 'border-[rgba(139,92,246,0.4)] bg-[rgba(139,92,246,0.1)]'
                         : 'border-[rgba(139,92,246,0.12)] bg-[rgba(12,13,36,0.6)] hover:border-[rgba(139,92,246,0.25)]'
                    }`}
                  >
                    <div className="text-xs font-bold text-white">{locale === 'ar' ? tn.ar : tn.en}</div>
                    <div className="text-[10px] text-t3 mt-0.5">{locale === 'ar' ? tn.descAr : tn.descEn}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Hint — shown only when brand name is empty */}
          {!brandName.trim() && (
            <p className="text-[11px] text-amber-400/80 text-center mt-4">
              {locale === 'ar' ? '⚠️ اكتب اسم علامتك التجارية للمتابعة' : '⚠️ Enter your brand name to continue'}
            </p>
          )}

          <button
            onClick={() => setStep(2)}
            disabled={!brandName.trim()}
            className="btn-gradient w-full py-3.5 mt-3 text-white font-bold rounded-xl transition-all text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {ob?.nextBtn}
          </button>
        </Card>
      )}

      {/* ── STEP 2 — GOAL ─────────────────────────────────────────────────── */}
      {step === 2 && (
        <Card>
          <h2 className="text-xl font-bold text-white mb-1">{ob?.goalTitle}</h2>
          <p className="text-t2 text-sm mb-6">{ob?.goalSubtitle}</p>

          <div className="grid grid-cols-2 gap-2 mb-6">
            {GOALS.map(g => (
              <button
                key={g.id}
                onClick={() => setGoal(g.id)}
                className={`p-4 rounded-xl border text-right transition-all ${
                  goal === g.id
                    ? 'border-[rgba(139,92,246,0.4)] bg-[rgba(139,92,246,0.1)]'
                     : 'border-[rgba(139,92,246,0.12)] bg-[rgba(12,13,36,0.6)] hover:border-[rgba(139,92,246,0.25)]'
                }`}
              >
                <div className="text-xl mb-1.5">{g.icon}</div>
                <div className="text-xs font-semibold text-white leading-tight">{locale === 'ar' ? g.ar : g.en}</div>
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setStep(1)}
              className="flex-none px-4 py-3.5 rounded-xl border text-text-muted hover:text-white text-sm transition-all" style={{ borderColor: "rgba(139,92,246,0.2)" }}
            >
              {ob?.backBtn}
            </button>
            <button
              onClick={handleFinishSetup}
              className="btn-gradient flex-1 py-3.5 text-white font-bold rounded-xl transition-all text-sm"
              style={{ boxShadow: '0 0 24px rgba(255,149,0,0.25)' }}
            >
              {ob?.generateBtn}
            </button>
          </div>
        </Card>
      )}

      {/* ── STEP 3 — GENERATING ───────────────────────────────────────────── */}
      {step === 3 && (
        <Card>
          <div className="text-center">
            <div className="relative w-16 h-16 mx-auto mb-6">
              <div className="absolute inset-0 w-16 h-16 border-2 border-accent/20 rounded-full" />
              <div className="absolute inset-0 w-16 h-16 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center text-2xl">🧠</div>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">{ob?.generatingTitle}</h2>
            <p className="text-t2 text-sm mb-6">{ob?.generatingSubtitle}</p>
            <div className="space-y-2.5 text-right max-w-xs mx-auto">
              {genSteps.map((s, i) => (
                <div
                  key={s}
                  className="flex items-center gap-3 text-sm text-t2 animate-pulse"
                  style={{ animationDelay: `${i * 0.4}s` }}
                >
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#8B5CF6" }} />
                  {s}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* ── STEP 4 — DONE ─────────────────────────────────────────────────── */}
      {step === 4 && (
        <div
          className="w-full max-w-md rounded-2xl glass-panel overflow-hidden"
          style={{ boxShadow: '0 0 60px rgba(255,149,0,0.12), 0 4px 32px rgba(0,0,0,0.5)' }}
          dir={dir}
        >
          {/* Header */}
          <div
            className="p-6 border-b"
            style={{ borderColor: "rgba(139,92,246,0.12)", background: 'linear-gradient(135deg, rgba(139,92,246,0.10), transparent)' }}
          >
            <div className="text-2xl mb-2">🎉</div>
            <h2 className="text-xl font-bold text-white mb-1">{ob?.doneTitle}</h2>
            <p className="text-t2 text-sm">
              {strategy?.title || ob?.doneSubtitle}
            </p>
          </div>

          {/* Quick wins */}
          {strategy?.quickWins?.length > 0 && (
            <div className="p-5 border-b" style={{ borderColor: "rgba(139,92,246,0.12)" }}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-3">
                {ob?.startTodayLabel}
              </div>
              <div className="space-y-2">
                {strategy.quickWins.slice(0, 3).map((win: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-t1">
                    <span className="text-accent shrink-0 mt-0.5">←</span>
                    <span>{win}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* What awaits */}
          <div className="p-5 border-b" style={{ borderColor: "rgba(139,92,246,0.12)" }}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-3">
              {ob?.awaitingLabel}
            </div>
            <div className="space-y-2.5">
              {awaitItems.map(item => (
                <div key={item.label} className="flex items-center gap-3 text-sm text-t1">
                  <span className="text-base">{item.icon}</span>
                  <span>{item.label}</span>
                  <Check className="w-3.5 h-3.5 text-accent mr-auto" />
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="p-5 space-y-2">
            <button
              onClick={() => router.push('/strategy')}
              className="btn-gradient w-full py-3 text-white font-bold rounded-xl transition-all text-sm"
              style={{ boxShadow: '0 0 20px rgba(255,149,0,0.20)' }}
            >
              {ob?.viewStrategyBtn}
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full py-2.5 border text-text-muted hover:text-white rounded-xl transition-all text-sm" style={{ borderColor: "rgba(139,92,246,0.2)" }}
            >
              {ob?.goDashboardBtn}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
