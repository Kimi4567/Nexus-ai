'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Check, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'

const INDUSTRIES = [
  { value: 'ecommerce',   label: 'تجارة إلكترونية', icon: '🛍️' },
  { value: 'saas',        label: 'برمجيات / تقنية',  icon: '💻' },
  { value: 'agency',      label: 'وكالة إعلانية',     icon: '🏢' },
  { value: 'fitness',     label: 'لياقة وصحة',        icon: '💪' },
  { value: 'food',        label: 'أغذية ومشروبات',    icon: '🍕' },
  { value: 'real_estate', label: 'عقارات',             icon: '🏠' },
  { value: 'beauty',      label: 'جمال وعناية',        icon: '✨' },
  { value: 'consulting',  label: 'استشارات',           icon: '📊' },
  { value: 'other',       label: 'أخرى',               icon: '🌐' },
]

const GOALS = [
  { id: 'grow_followers',   label: 'زيادة المتابعين',        icon: '📈' },
  { id: 'generate_leads',   label: 'توليد Leads',             icon: '🎯' },
  { id: 'launch_product',   label: 'إطلاق منتج جديد',        icon: '🚀' },
  { id: 'drive_sales',      label: 'زيادة المبيعات',          icon: '💰' },
  { id: 'build_brand',      label: 'بناء الوعي بالعلامة',    icon: '🌟' },
  { id: 'retain_customers', label: 'الاحتفاظ بالعملاء',       icon: '🤝' },
]

const TONES = [
  { id: 'bold',         label: 'جريء ومباشر',       desc: 'قوي، واثق، بلا تعقيد' },
  { id: 'friendly',     label: 'ودود ودافئ',          desc: 'قريب، محادثاتي، إنساني' },
  { id: 'professional', label: 'راقي واحترافي',       desc: 'متطور، موثوق، رسمي' },
  { id: 'playful',      label: 'مرح وإبداعي',         desc: 'حيوي، ملهم، طازج' },
]

// Generating steps — shown during AI loading
const GENERATING_STEPS = [
  'إعداد مساحة العمل',
  'تدريب الـ AI على علامتك',
  'تحليل جمهورك المستهدف',
  'بناء استراتيجيتك لـ 30 يوم',
]

export default function OnboardingPage() {
  const router = useRouter()
  const { user, isAuthenticated, loading, authHeader } = useAuth()
  const [step, setStep] = useState(0)

  const [brandName,  setBrandName]  = useState('')
  const [industry,   setIndustry]   = useState('')
  const [audience,   setAudience]   = useState('')
  const [tone,       setTone]       = useState('')
  const [goal,       setGoal]       = useState('')
  const [strategy,   setStrategy]   = useState<any>(null)

  const displayName =
    user?.user_metadata?.name?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'صديق'

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
    const name   = brandName.trim() || 'علامتي'
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
          industry,
          targetAudience: audience,
          toneKeywords: tone ? [tone] : ['professional'],
        }),
      }).catch(() => {})

      const res  = await fetch('/api/strategy/generate', {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, timeframe: '30', platform: 'multi', budget: 'bootstrap' }),
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
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    )
  }
  if (!isAuthenticated) return null

  // ── Shared card wrapper ──────────────────────────────────────────────────
  const Card = ({ children }: { children: ReactNode }) => (
    <div
      className="w-full max-w-md rounded-2xl border border-dark-tertiary bg-dark-secondary p-8"
      style={{ boxShadow: '0 0 60px rgba(255,149,0,0.07), 0 4px 32px rgba(0,0,0,0.5)' }}
      dir="rtl"
    >
      {children}
    </div>
  )

  return (
    <div
      className="min-h-screen bg-dark flex flex-col items-center justify-center px-4 py-12"
      style={{ backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(255,149,0,0.10), transparent)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-10">
        <div className="w-8 h-8 rounded-[8px] flex items-center justify-center bg-accent">
          <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
            <path d="M7 7L14 21L21 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M7 7H21"          stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
        <span className="font-bold text-white text-lg tracking-tight">Nexus</span>
      </div>

      {/* Progress bar — visible on steps 1 & 2 */}
      {step >= 1 && step <= 2 && (
        <div className="w-full max-w-md mb-8" dir="rtl">
          <div className="flex justify-between text-xs text-t3 mb-2">
            <span>الخطوة {step} من 2</span>
            <span>{step === 1 ? 'علامتك التجارية' : 'هدفك الأول'}</span>
          </div>
          <div className="h-1 rounded-full bg-dark-tertiary overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${(step / 2) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* ── STEP 0 — WELCOME ──────────────────────────────────────────────── */}
      {step === 0 && (
        <Card>
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-5 text-3xl">
              👋
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              أهلاً، {displayName}
            </h1>
            <p className="text-t2 text-sm mb-8 leading-relaxed">
              أنت على وشك الحصول على فريق تسويق AI كامل — استراتيجية، حملات، تقويم محتوى، وتحليلات — كل ذلك في مكان واحد.
              60 ثانية فقط للإعداد.
            </p>

            <div className="grid grid-cols-3 gap-3 mb-8">
              {[
                { icon: '🧠', label: 'استراتيجية AI' },
                { icon: '📅', label: 'تقويم تلقائي' },
                { icon: '📊', label: 'تحليلات حية' },
              ].map(f => (
                <div
                  key={f.label}
                  className="p-3 rounded-xl bg-dark border border-dark-tertiary text-center"
                >
                  <div className="text-xl mb-1">{f.icon}</div>
                  <div className="text-[11px] font-semibold text-t2">{f.label}</div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep(1)}
              className="w-full py-3.5 bg-accent hover:bg-accent-light text-white font-bold rounded-xl transition-all text-sm"
              style={{ boxShadow: '0 0 24px rgba(255,149,0,0.25)' }}
            >
              ابني نظام التسويق →
            </button>
          </div>
        </Card>
      )}

      {/* ── STEP 1 — BRAND ────────────────────────────────────────────────── */}
      {step === 1 && (
        <Card>
          <h2 className="text-xl font-bold text-white mb-1">أخبرنا عن علامتك</h2>
          <p className="text-t2 text-sm mb-6">هذا يدرّب الـ AI على تفاصيل نشاطك التجاري.</p>

          <div className="space-y-5">
            {/* Brand name */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-t3 mb-2 block">
                اسم العلامة / الشركة
              </label>
              <input
                type="text"
                value={brandName}
                onChange={e => setBrandName(e.target.value)}
                placeholder="مثال: شركتي، متجر النور..."
                className="w-full px-4 py-3 rounded-xl bg-dark border border-dark-tertiary text-white placeholder-t4 text-sm focus:outline-none focus:border-accent/50 transition-all"
                autoFocus
              />
            </div>

            {/* Industry */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-t3 mb-2 block">
                القطاع
              </label>
              <div className="grid grid-cols-3 gap-2">
                {INDUSTRIES.map(ind => (
                  <button
                    key={ind.value}
                    onClick={() => setIndustry(ind.value)}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      industry === ind.value
                        ? 'border-accent bg-accent/10 text-white'
                        : 'border-dark-tertiary bg-dark text-t2 hover:border-accent/30'
                    }`}
                  >
                    <div className="text-lg mb-0.5">{ind.icon}</div>
                    <div className="text-[10px] font-semibold leading-tight">{ind.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Audience */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-t3 mb-2 block">
                الجمهور المستهدف{' '}
                <span className="text-t4 normal-case font-normal">(اختياري)</span>
              </label>
              <input
                type="text"
                value={audience}
                onChange={e => setAudience(e.target.value)}
                placeholder="مثال: شباب 18-35 مهتمون بالموضة في السعودية"
                className="w-full px-4 py-3 rounded-xl bg-dark border border-dark-tertiary text-white placeholder-t4 text-sm focus:outline-none focus:border-accent/50 transition-all"
              />
            </div>

            {/* Tone */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-t3 mb-2 block">
                أسلوب العلامة
              </label>
              <div className="grid grid-cols-2 gap-2">
                {TONES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTone(t.id)}
                    className={`p-3 rounded-xl border text-right transition-all ${
                      tone === t.id
                        ? 'border-accent bg-accent/10'
                        : 'border-dark-tertiary bg-dark hover:border-accent/30'
                    }`}
                  >
                    <div className="text-xs font-bold text-white">{t.label}</div>
                    <div className="text-[10px] text-t3 mt-0.5">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!brandName.trim() || !industry}
            className="w-full py-3.5 mt-6 bg-accent hover:bg-accent-light text-white font-bold rounded-xl transition-all text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            التالي →
          </button>
        </Card>
      )}

      {/* ── STEP 2 — GOAL ─────────────────────────────────────────────────── */}
      {step === 2 && (
        <Card>
          <h2 className="text-xl font-bold text-white mb-1">ما هو هدفك الرئيسي الآن؟</h2>
          <p className="text-t2 text-sm mb-6">سنبني استراتيجيتك الأولى لـ 30 يوماً حول هذا الهدف.</p>

          <div className="grid grid-cols-2 gap-2 mb-6">
            {GOALS.map(g => (
              <button
                key={g.id}
                onClick={() => setGoal(g.id)}
                className={`p-4 rounded-xl border text-right transition-all ${
                  goal === g.id
                    ? 'border-accent bg-accent/10'
                    : 'border-dark-tertiary bg-dark hover:border-accent/30'
                }`}
              >
                <div className="text-xl mb-1.5">{g.icon}</div>
                <div className="text-xs font-semibold text-white leading-tight">{g.label}</div>
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setStep(1)}
              className="flex-none px-4 py-3.5 rounded-xl border border-dark-tertiary text-t2 hover:text-white hover:border-accent/30 text-sm transition-all"
            >
              رجوع
            </button>
            <button
              onClick={handleFinishSetup}
              disabled={!goal}
              className="flex-1 py-3.5 bg-accent hover:bg-accent-light text-white font-bold rounded-xl transition-all text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ boxShadow: goal ? '0 0 24px rgba(255,149,0,0.25)' : 'none' }}
            >
              {goal ? 'ولّد استراتيجيتي →' : 'اختر هدفاً للمتابعة'}
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
            <h2 className="text-xl font-bold text-white mb-2">جاري بناء استراتيجيتك...</h2>
            <p className="text-t2 text-sm mb-6">الـ AI يتعلم علامتك ويولّد خطتك التسويقية لـ 30 يوماً.</p>
            <div className="space-y-2.5 text-right max-w-xs mx-auto">
              {GENERATING_STEPS.map((s, i) => (
                <div
                  key={s}
                  className="flex items-center gap-3 text-sm text-t2 animate-pulse"
                  style={{ animationDelay: `${i * 0.4}s` }}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
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
          className="w-full max-w-md rounded-2xl border border-accent/20 bg-dark-secondary overflow-hidden"
          style={{ boxShadow: '0 0 60px rgba(255,149,0,0.12), 0 4px 32px rgba(0,0,0,0.5)' }}
          dir="rtl"
        >
          {/* Header */}
          <div
            className="p-6 border-b border-dark-tertiary"
            style={{ background: 'linear-gradient(135deg, rgba(255,149,0,0.08), transparent)' }}
          >
            <div className="text-2xl mb-2">🎉</div>
            <h2 className="text-xl font-bold text-white mb-1">نظام التسويق جاهز!</h2>
            <p className="text-t2 text-sm">
              {strategy?.title || 'تم إنشاء استراتيجيتك لـ 30 يوماً.'}
            </p>
          </div>

          {/* Quick wins */}
          {strategy?.quickWins?.length > 0 && (
            <div className="p-5 border-b border-dark-tertiary">
              <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-3">
                ابدأ اليوم — أسرع نتائج
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
          <div className="p-5 border-b border-dark-tertiary">
            <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-3">
              ما ينتظرك في Nexus
            </div>
            <div className="space-y-2.5">
              {[
                { icon: '📅', label: 'تقويم المحتوى لـ 30 يوماً' },
                { icon: '🎯', label: 'تفصيل كامل لاستراتيجية الحملة' },
                { icon: '⚡', label: 'مولّد الحملات بالـ AI' },
                { icon: '📊', label: 'لوحة التحليلات الحية' },
              ].map(item => (
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
              className="w-full py-3 bg-accent hover:bg-accent-light text-white font-bold rounded-xl transition-all text-sm"
              style={{ boxShadow: '0 0 20px rgba(255,149,0,0.20)' }}
            >
              اعرض استراتيجيتي الكاملة →
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full py-2.5 border border-dark-tertiary hover:border-accent/30 text-t2 hover:text-white rounded-xl transition-all text-sm"
            >
              انتقل للـ Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
