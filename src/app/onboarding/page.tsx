'use client'

/* ═══════════════════════════════════════════════════════════════════════════
   NEXUS — First-run onboarding: "Brand Brain Starter"
   ───────────────────────────────────────────────────────────────────────────
   This flow NO LONGER generates a strategy. It collects the minimum useful
   business information, saves it as the FIRST LAYER of Brand Brain, and shows
   an honest summary (what NEXUS knows / what still needs clarification /
   current readiness / one recommended next step).

   Hard rules honored here:
     • No call to /api/strategy/generate (or any strategy generator).
     • No "strategy ready" / celebratory success state.
     • No emojis in the first-run journey.
     • Calm white operator styling (no dark glassmorphism, no heavy gradients).
     • Paid = planning only. Publishing automation = off. Analytics = not connected.
     • Arabic copy = neutral, professional Modern Standard Arabic.
     • Nothing here touches wallet / credits / billing / subscriptions.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { Brain, CheckCircle2, Loader2, ShieldCheck, Sparkles, Workflow } from 'lucide-react'
import type { ReactNode } from 'react'
import { FIRST_INTENTS, buildOnboardingStrategicNotes } from '@/lib/onboardingContinuity'
import { getFirstRunJourney } from '@/lib/firstUserJourney'
import { getBrandBrainReadiness } from '@/lib/brandReadiness'
import { ONBOARDING_INDUSTRY_OPTIONS } from '@/lib/brandIndustries'
import { businessGoalLabel, campaignObjectiveForGoal } from '@/lib/businessGoals'

// ── Option lists (no emojis) ────────────────────────────────────────────────
const INDUSTRIES = ONBOARDING_INDUSTRY_OPTIONS

const LANGUAGES: { value: 'ar' | 'en' | 'both'; ar: string; en: string }[] = [
  { value: 'ar',   ar: 'العربية',                en: 'Arabic' },
  { value: 'en',   ar: 'الإنجليزية',             en: 'English' },
  { value: 'both', ar: 'العربية والإنجليزية',    en: 'Arabic and English' },
]

const GOALS: { value: string; ar: string; en: string }[] = [
  { value: 'increase_sales',  ar: 'زيادة المبيعات',        en: 'Increase sales' },
  { value: 'generate_leads',  ar: 'توليد عملاء محتملين',   en: 'Generate leads' },
  { value: 'build_awareness', ar: 'بناء الوعي بالعلامة',   en: 'Build brand awareness' },
  { value: 'launch_product',  ar: 'إطلاق منتج جديد',       en: 'Launch a new product' },
  { value: 'grow_followers',  ar: 'زيادة المتابعين',       en: 'Grow followers' },
  { value: 'retain_customers',ar: 'الاحتفاظ بالعملاء',     en: 'Retain customers' },
]

const MARKETING_STATUS: { value: string; ar: string; en: string }[] = [
  { value: 'not_started',  ar: 'لم أبدأ بعد',              en: 'Not started yet' },
  { value: 'irregular',    ar: 'أنشر بشكل غير منتظم',      en: 'Posting irregularly' },
  { value: 'regular',      ar: 'أنشر بانتظام',             en: 'Posting regularly' },
  { value: 'running_ads',  ar: 'أدير إعلانات مدفوعة',      en: 'Running paid ads' },
  { value: 'unsure',       ar: 'لست متأكدًا',              en: 'Not sure' },
]

const PLATFORMS: { value: string; ar: string; en: string }[] = [
  { value: 'Facebook',  ar: 'فيسبوك',   en: 'Facebook' },
  { value: 'Instagram', ar: 'إنستغرام', en: 'Instagram' },
  { value: 'TikTok',    ar: 'تيك توك',  en: 'TikTok' },
  { value: 'LinkedIn',  ar: 'لينكدإن',  en: 'LinkedIn' },
  { value: 'Snapchat',  ar: 'سناب شات', en: 'Snapchat' },
  { value: 'WhatsApp',  ar: 'واتساب',   en: 'WhatsApp' },
  { value: 'none',      ar: 'لا شيء بعد', en: 'None yet' },
]

const TOTAL_STEPS = 5

// ── Calm building-block components (defined OUTSIDE the page component so they
//    are not remounted on every keystroke) ─────────────────────────────────
function Shell({ children, dir }: { children: ReactNode; dir: 'rtl' | 'ltr' }) {
  const isRTL = dir === 'rtl'
  return (
    <main
      dir={dir}
      className="min-h-screen w-full bg-[#f6f8fc] px-4 py-6 text-[#071332] sm:px-6 lg:px-8"
      style={{
        backgroundImage:
          'radial-gradient(circle at 12% 6%, rgba(99,102,241,0.13), transparent 28%), radial-gradient(circle at 88% 12%, rgba(16,185,129,0.10), transparent 24%)',
      }}
    >
      <div className="mx-auto grid min-h-[calc(100vh-48px)] w-full max-w-[1180px] overflow-hidden rounded-[32px] border border-white/80 bg-white shadow-[0_26px_90px_rgba(15,23,42,0.12)] lg:grid-cols-[340px_1fr]">
        <aside className="relative hidden overflow-hidden bg-[#020817] p-8 text-white lg:block">
          <div
            className="absolute inset-0 opacity-80"
            style={{
              background:
                'radial-gradient(circle at 32% 18%, rgba(99,102,241,0.42), transparent 26%), radial-gradient(circle at 78% 72%, rgba(34,211,238,0.16), transparent 30%)',
            }}
          />
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 shadow-[0_0_30px_rgba(99,102,241,0.45)] ring-1 ring-white/15">
                  <Sparkles className="h-5 w-5 text-[#a5b4fc]" />
                </span>
                <span>
                  <span className="block text-2xl font-semibold tracking-[0.28em]">NEXUS</span>
                  <span className="block text-[10px] font-medium tracking-[0.34em] text-slate-400">AI MARKETING OS</span>
                </span>
              </div>

              <div className="mt-14">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-[#a5b4fc]">
                  {isRTL ? 'إعداد أول تشغيل' : 'First-run setup'}
                </p>
                <h1 className="text-3xl font-semibold leading-tight tracking-[-0.02em]">
                  {isRTL ? 'نبدأ بذاكرة علامة صحيحة قبل أي استراتيجية أو تنفيذ.' : 'Start with trusted brand memory before any strategy or execution.'}
                </h1>
                <p className="mt-5 text-sm leading-7 text-slate-300">
                  {isRTL
                    ? 'هذه الصفحة تجمع أساسيات النشاط فقط. لا توليد، لا نشر، لا إنفاق، ولا تشغيل تلقائي.'
                    : 'This page only captures business fundamentals. No generation, publishing, spend, or automation starts here.'}
                </p>
              </div>
            </div>

            <div className="grid gap-3">
              {[
                { icon: Brain, label: isRTL ? 'Brand Brain أولي' : 'Starter Brand Brain' },
                { icon: Workflow, label: isRTL ? 'رحلة تسويق واضحة' : 'Clear marketing journey' },
                { icon: ShieldCheck, label: isRTL ? 'حدود تنفيذ آمنة' : 'Safe execution boundary' },
              ].map(item => {
                const Icon = item.icon
                return (
                  <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-[#a5b4fc]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-medium text-slate-100">{item.label}</span>
                    <CheckCircle2 className={`${isRTL ? 'mr-auto' : 'ml-auto'} h-4 w-4 text-emerald-300`} />
                  </div>
                )
              })}
            </div>
          </div>
        </aside>

        <section className="flex items-center justify-center p-5 sm:p-8 lg:p-10">
          <div className="w-full max-w-[760px]">{children}</div>
        </section>
      </div>
    </main>
  )
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[28px] bg-white p-6 sm:p-8"
      style={{ border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 18px 55px rgba(15,23,42,0.08)' }}>
      {children}
    </div>
  )
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="block text-[13px] font-semibold mb-1.5" style={{ color: '#0F172A' }}>{children}</label>
}

function Helper({ children }: { children: ReactNode }) {
  return <p className="text-[12px] leading-relaxed mb-3" style={{ color: '#64748B' }}>{children}</p>
}

const inputClass =
  'w-full px-3.5 py-2.5 rounded-xl text-[14px] outline-none transition-colors bg-white'
const inputStyle = { border: '1px solid rgba(15,23,42,0.12)', color: '#0F172A' } as const

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className="px-3.5 py-2 rounded-xl text-[13px] font-medium transition-all"
      style={{
        background: active ? '#EEF2FF' : '#FFFFFF',
        border: `1px solid ${active ? 'rgba(94,92,230,0.45)' : 'rgba(15,23,42,0.12)'}`,
        color: active ? '#4F46E5' : '#334155',
      }}>
      {children}
    </button>
  )
}

function PrimaryButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="w-full py-3 rounded-xl text-[14px] font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ background: '#5E5CE6' }}>
      {children}
    </button>
  )
}

function QuietButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className="w-full py-2.5 rounded-xl text-[13px] font-medium transition-colors"
      style={{ color: '#64748B' }}>
      {children}
    </button>
  )
}

export default function OnboardingPage() {
  const router = useRouter()
  const { user, isAuthenticated, loading, authHeader } = useAuth()
  const { locale, dir } = useI18n()
  const ar = locale === 'ar'

  // view: 'welcome' | 'steps' (1..4) | 'summary' | 'limited'
  const [view, setView] = useState<'welcome' | 'steps' | 'summary' | 'limited'>('welcome')
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)

  // ── Starter fields (minimum useful Brand Brain layer) ──
  const [firstIntent, setFirstIntent] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [industry, setIndustry] = useState('')
  const [businessDescription, setBusinessDescription] = useState('')
  const [region, setRegion] = useState('')
  const [customerLanguage, setCustomerLanguage] = useState<'ar' | 'en' | 'both' | ''>('')
  const [offer, setOffer] = useState('')
  const [goal, setGoal] = useState('')
  const [idealCustomer, setIdealCustomer] = useState('')
  const [whyChoose, setWhyChoose] = useState('')
  const [marketingStatus, setMarketingStatus] = useState('')
  const [platforms, setPlatforms] = useState<string[]>([])

  const displayName =
    user?.user_metadata?.name?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    ''

  // Redirect unauthenticated users
  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/auth/login')
  }, [loading, isAuthenticated, router])

  // If a workspace already exists, avoid creating a duplicate. Route by Brand Brain
  // state instead of pretending workspace existence means onboarding is complete.
  useEffect(() => {
    if (!isAuthenticated) return
    const token = authHeader()
    if (!token) return
    fetch('/api/workspaces', { headers: { Authorization: token } })
      .then(r => r.json())
      .then(async data => {
        if (!Array.isArray(data) || data.length === 0) return
        const brandRes = await fetch('/api/brand', { headers: { Authorization: token } }).catch(() => null)
        const brandData = brandRes?.ok ? await brandRes.json() : null
        const brandProfile = brandData?.brandProfile ?? null
        const readiness = getBrandBrainReadiness(brandProfile)
        const hasBrandProfile = Boolean(brandProfile?.brandName || brandProfile?.industry || brandProfile?.description)
        router.push(readiness.ready && hasBrandProfile ? '/dashboard' : '/brand')
      })
      .catch(() => {})
  }, [isAuthenticated, authHeader, router])

  const togglePlatform = (value: string) => {
    setPlatforms(prev => {
      if (value === 'none') return prev.includes('none') ? [] : ['none']
      const withoutNone = prev.filter(p => p !== 'none')
      return withoutNone.includes(value) ? withoutNone.filter(p => p !== value) : [...withoutNone, value]
    })
  }

  // ── Save the starter as the first Brand Brain layer (NO strategy generation) ──
  const handleSaveBrandBrain = async () => {
    setSaving(true)
    setSaveError(false)
    const token = authHeader()
    const name = businessName.trim() || (ar ? 'نشاطي التجاري' : 'My Business')
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now()

    try {
      if (!token) throw new Error('Missing authenticated session')

      // 1) Ensure a workspace exists for this user. Every response is checked so
      // onboarding can never show a saved state when persistence failed.
      const workspaceListResponse = await fetch('/api/workspaces', {
        headers: { Authorization: token },
      })
      if (!workspaceListResponse.ok) throw new Error('Unable to verify workspace')
      const workspaces = await workspaceListResponse.json()

      if (!Array.isArray(workspaces) || workspaces.length === 0) {
        const workspaceResponse = await fetch('/api/workspaces', {
          method: 'POST',
          headers: { Authorization: token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, slug, description: businessDescription.trim() }),
        })
        if (!workspaceResponse.ok) throw new Error('Unable to create workspace')
      }

      // 2) Save the starter fields as Brand Brain memory. No strategy is created.
      const strategicNotes = buildOnboardingStrategicNotes({
        firstIntent,
        marketingStatus,
        marketingStatusOptions: MARKETING_STATUS,
        locale: ar ? 'ar' : 'en',
      })

      const brandResponse = await fetch('/api/brand', {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandName: name,
          industry: industry || 'other',
          description: businessDescription.trim(),
          audienceLocation: region.trim() || null,
          languagePreference: customerLanguage || null,
          primaryOffer: offer.trim() || null,
          businessGoal: businessGoalLabel(goal, 'en') || null,
          campaignObjective: campaignObjectiveForGoal(goal),
          strategyType: 'organic',
          strategyDuration: '30',
          targetAudience: idealCustomer.trim() || null,
          uniqueAdvantages: whyChoose.trim() ? [whyChoose.trim()] : [],
          topPlatforms: platforms.filter(p => p !== 'none'),
          strategicNotes,
        }),
      })
      if (!brandResponse.ok) throw new Error('Unable to save Brand Brain')
      const savedBrand = await brandResponse.json()
      if (!savedBrand?.success || savedBrand?.pending) throw new Error('Brand Brain was not persisted')

      // Preserve existing first-run referral behavior (credit logic untouched).
      const pendingRef = typeof window !== 'undefined' ? localStorage.getItem('pendingReferralCode') : null
      if (pendingRef) {
        // Referral credit is independent from Brand Brain persistence. Do not
        // hold the onboarding success screen behind a slow third-party/network
        // request after the user's profile is already safely stored.
        void fetch('/api/referral/claim', {
          method: 'POST',
          headers: { Authorization: token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ referralCode: pendingRef }),
        }).catch(() => {})
        localStorage.removeItem('pendingReferralCode')
      }
    } catch {
      // Saving failed — surface an honest retry, never a fake "done" state.
      setSaveError(true)
      setSaving(false)
      return
    }

    setSaving(false)
    setView('summary')
  }

  // ── Loading / auth guards ──
  if (loading) {
    return (
      <Shell dir={dir}>
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin" style={{ color: '#5E5CE6' }} /></div>
      </Shell>
    )
  }
  if (!isAuthenticated) return null

  // ════════════════════════════════════════════════════════════════════════
  // WELCOME
  // ════════════════════════════════════════════════════════════════════════
  if (view === 'welcome') {
    return (
      <Shell dir={dir}>
        <Panel>
          <p className="text-[12px] font-semibold tracking-wide mb-2" style={{ color: '#5E5CE6' }}>
            {ar ? `مرحبًا${displayName ? ` ${displayName}` : ''}` : `Welcome${displayName ? `, ${displayName}` : ''}`}
          </p>
          <h1 className="text-[22px] sm:text-[24px] font-bold leading-snug mb-2" style={{ color: '#0F172A' }}>
            {ar ? 'لنبدأ ببناء ذاكرة علامتك التجارية' : 'Let’s start building your Brand Brain'}
          </h1>
          <p className="text-[14px] leading-relaxed mb-6" style={{ color: '#475569' }}>
            {ar
              ? 'سنبدأ ببناء ذاكرة علامتك التجارية حتى يستطيع NEXUS فهم نشاطك واقتراح الخطوة التسويقية المناسبة.'
              : 'We’ll start building your Brand Brain so NEXUS can understand your business and recommend the right marketing next step.'}
          </p>

          <div className="rounded-xl p-4 mb-5" style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.07)' }}>
            <p className="text-[13px] font-semibold mb-2.5" style={{ color: '#0F172A' }}>
              {ar ? 'ماذا سيحدث بعد ذلك؟' : 'What happens next?'}
            </p>
            <ul className="space-y-2">
              {(ar
                ? ['سيتعرّف NEXUS على نشاطك الأساسي.', 'سيعرض لك ما يعرفه وما يحتاج إلى توضيح.', 'سيقترح الخطوة التسويقية التالية بوضوح.']
                : ['NEXUS learns the basics of your business.', 'It shows what it knows and what still needs clarification.', 'It recommends the next marketing step clearly.']
              ).map((b, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[13px]" style={{ color: '#475569' }}>
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#5E5CE6' }} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[13px] leading-relaxed mb-6" style={{ color: '#475569' }}>
            {ar
              ? 'لن ينشر NEXUS أي محتوى أو ينفق أي ميزانية بدون موافقتك.'
              : 'NEXUS will not publish content or spend budget without your approval.'}
          </p>

          <PrimaryButton onClick={() => { setStep(1); setView('steps') }}>
            {ar ? 'ابدأ ذاكرة علامتك' : 'Start Brand Brain setup'}
          </PrimaryButton>
          <div className="mt-1.5">
            <QuietButton onClick={() => setView('limited')}>
              {ar ? 'سأكمل ذلك لاحقًا' : 'I’ll do this later'}
            </QuietButton>
          </div>

          <p className="text-[12px] leading-relaxed mt-4 pt-4 text-center"
            style={{ color: '#94A3B8', borderTop: '1px solid rgba(15,23,42,0.06)' }}>
            {ar
              ? 'هذه الخطوة تحفظ الطبقة الأولى من ذاكرة العلامة فقط. لا يتم إنشاء استراتيجية كاملة أو تشغيل نشر أو إعلانات.'
              : 'This step only saves the first layer of brand memory. It does not create a full strategy, publish content, or run ads.'}
          </p>
        </Panel>
      </Shell>
    )
  }

  // ════════════════════════════════════════════════════════════════════════
  // LIMITED STATE (user chose "I’ll do this later")
  // ════════════════════════════════════════════════════════════════════════
  if (view === 'limited') {
    return (
      <Shell dir={dir}>
        <Panel>
          <h1 className="text-[20px] font-bold mb-3" style={{ color: '#0F172A' }}>
            {ar ? 'لنُكمل عندما تكون جاهزًا' : 'We can continue when you’re ready'}
          </h1>
          <p className="text-[14px] leading-relaxed mb-6" style={{ color: '#475569' }}>
            {ar
              ? 'يحتاج NEXUS إلى معلومات أساسية قبل أن يقدم توصيات أو محتوى مناسبًا لنشاطك.'
              : 'NEXUS needs essential information before it can provide recommendations or content suited to your business.'}
          </p>
          <PrimaryButton onClick={() => { setStep(1); setView('steps') }}>
            {ar ? 'ابدأ ذاكرة علامتك' : 'Start Brand Brain setup'}
          </PrimaryButton>
          <div className="mt-1.5">
            <QuietButton onClick={() => router.push('/dashboard')}>
              {ar ? 'فتح لوحة التحكم بإعداد محدود' : 'Open dashboard with limited setup'}
            </QuietButton>
          </div>
        </Panel>
      </Shell>
    )
  }

  // ════════════════════════════════════════════════════════════════════════
  // SUMMARY — Initial Brand Brain Summary (4 honest cards)
  // ════════════════════════════════════════════════════════════════════════
  if (view === 'summary') {
    const industryLabel = INDUSTRIES.find(i => i.value === industry)
    const intentLabel = FIRST_INTENTS.find(i => i.value === firstIntent)
    const goalLabel = GOALS.find(g => g.value === goal)
    const langLabel = LANGUAGES.find(l => l.value === customerLanguage)
    const statusLabel = MARKETING_STATUS.find(s => s.value === marketingStatus)
    const platformNames = platforms.filter(p => p !== 'none').map(p => {
      const f = PLATFORMS.find(x => x.value === p); return f ? (ar ? f.ar : f.en) : p
    })

    const known: { label: string; value: string }[] = []
    const push = (label: string, value?: string | null) => { if (value && value.trim()) known.push({ label, value: value.trim() }) }
    push(ar ? 'أول مساعدة مطلوبة' : 'First requested help', intentLabel ? (ar ? intentLabel.ar : intentLabel.en) : '')
    push(ar ? 'اسم النشاط' : 'Business name', businessName)
    push(ar ? 'المجال' : 'Industry', industryLabel ? (ar ? industryLabel.ar : industryLabel.en) : '')
    push(ar ? 'وصف النشاط' : 'Business description', businessDescription)
    push(ar ? 'المنطقة / السوق' : 'Region / market', region)
    push(ar ? 'لغة العملاء' : 'Customer language', langLabel ? (ar ? langLabel.ar : langLabel.en) : '')
    push(ar ? 'المنتج أو الخدمة' : 'Product or service', offer)
    push(ar ? 'الهدف التسويقي' : 'Marketing goal', goalLabel ? (ar ? goalLabel.ar : goalLabel.en) : '')
    push(ar ? 'العميل المثالي' : 'Ideal customer', idealCustomer)
    push(ar ? 'سبب الاختيار' : 'Why customers choose you', whyChoose)
    push(ar ? 'الوضع التسويقي' : 'Marketing status', statusLabel ? (ar ? statusLabel.ar : statusLabel.en) : '')
    if (platformNames.length) known.push({ label: ar ? 'المنصات التي تستخدمها حالياً' : 'Platforms you currently use', value: platformNames.join('، ') })

    const needs = ar
      ? ['المنافسون', 'أمثلة سابقة من المحتوى', 'نتائج أداء حقيقية', 'أصول بصرية أو صور', 'تفاصيل نبرة العلامة التجارية', 'الحسابات المتصلة']
      : ['Competitors', 'Past content examples', 'Real performance results', 'Visual assets or images', 'Brand tone details', 'Connected accounts']

    const starterReadiness = getBrandBrainReadiness({
      brandName: businessName.trim() || undefined,
      industry: industry || undefined,
      description: businessDescription.trim() || undefined,
      targetAudience: idealCustomer.trim() || undefined,
      topPlatforms: platforms.filter(p => p !== 'none'),
    })
    const starterReadyForInitialBrief = starterReadiness.ready

    const readiness: { label: string; state: string }[] = ar
      ? [
          { label: 'الاستراتيجية العضوية', state: starterReadyForInitialBrief ? 'جاهز لموجز أولي' : 'تحتاج بيانات أساسية' },
          { label: 'الاستراتيجية الكاملة', state: 'تحتاج معلومات إضافية' },
          { label: 'الإعلانات المدفوعة', state: 'للتخطيط فقط' },
          { label: 'أتمتة النشر', state: 'غير مفعّلة' },
          { label: 'التحليلات', state: 'غير متصلة' },
          { label: 'ذاكرة التعلّم', state: 'مبكرة' },
        ]
      : [
          { label: 'Organic strategy', state: starterReadyForInitialBrief ? 'Ready for an initial brief' : 'Needs core data' },
          { label: 'Full strategy', state: 'Needs more information' },
          { label: 'Paid ads', state: 'Planning only' },
          { label: 'Publishing automation', state: 'Not enabled' },
          { label: 'Analytics', state: 'Not connected' },
          { label: 'Learning memory', state: 'Early' },
        ]

    const recommendedStep = getFirstRunJourney({
      hasWorkspace: true,
      hasBrandProfile: true,
      brandBrainReady: starterReadyForInitialBrief,
      strategyState: 'none',
      hasCampaignOrContent: false,
      hasContent: false,
      contentApproved: false,
    })

    return (
      <Shell dir={dir}>
        <div className="mb-5">
          <h1 className="text-[22px] font-bold mb-1.5" style={{ color: '#0F172A' }}>
	            {ar ? 'تم حفظ بداية Brand Brain' : 'Starter Brand Brain saved'}
          </h1>
          <p className="text-[13px] leading-relaxed" style={{ color: '#64748B' }}>
            {ar
              ? 'بدأت ذاكرة علامتك التجارية. هذا ما حفظه NEXUS حتى الآن، وما زال يحتاج إلى توضيح قبل أن تصبح التوصيات أعمق.'
              : 'Your Brand Brain has started. This is what NEXUS has saved so far, and what still needs clarification before recommendations become deeper.'}
          </p>
        </div>

        <div className="space-y-4">
          {/* Card 1 — What NEXUS knows now */}
          <div className="rounded-2xl bg-white p-5" style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
            <p className="text-[14px] font-bold mb-3" style={{ color: '#0F172A' }}>
              {ar ? 'ما يعرفه NEXUS الآن' : 'What NEXUS knows now'}
            </p>
            {known.length === 0 ? (
              <p className="text-[13px]" style={{ color: '#94A3B8' }}>
                {ar ? 'لم تُدخل أي معلومات بعد.' : 'No information entered yet.'}
              </p>
            ) : (
              <ul className="space-y-2">
                {known.map((k, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px]">
                    <span className="font-medium flex-shrink-0" style={{ color: '#64748B' }}>{k.label}:</span>
                    <span style={{ color: '#0F172A' }}>{k.value}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Card 2 — What still needs clarification */}
          <div className="rounded-2xl bg-white p-5" style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
            <p className="text-[14px] font-bold mb-3" style={{ color: '#0F172A' }}>
              {ar ? 'ما يحتاج إلى توضيح لاحقًا' : 'What still needs clarification'}
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              {needs.map((n, i) => (
                <li key={i} className="flex items-center gap-2 text-[13px]" style={{ color: '#475569' }}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#CBD5E1' }} />
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Card 3 — Current readiness (honest labels) */}
          <div className="rounded-2xl bg-white p-5" style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
            <p className="text-[14px] font-bold mb-3" style={{ color: '#0F172A' }}>
              {ar ? 'الجاهزية الحالية' : 'Current readiness'}
            </p>
            <ul className="space-y-2.5">
              {readiness.map((r, i) => (
                <li key={i} className="flex items-center justify-between gap-3 text-[13px]">
                  <span style={{ color: '#475569' }}>{r.label}</span>
                  <span className="px-2.5 py-1 rounded-lg text-[12px] font-medium"
                    style={{ background: '#F1F5F9', color: '#475569', border: '1px solid rgba(15,23,42,0.06)' }}>
                    {r.state}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Card 4 — Recommended next step */}
          <div className="rounded-2xl p-5" style={{ background: '#F5F3FF', border: '1px solid rgba(94,92,230,0.22)' }}>
            <p className="text-[14px] font-bold mb-2" style={{ color: '#0F172A' }}>
              {ar ? 'الخطوة المقترحة' : 'Recommended next step'}
            </p>
            <p className="text-[13px] leading-relaxed mb-4" style={{ color: '#475569' }}>
              {ar ? recommendedStep.helperAr : recommendedStep.helper}
            </p>
            <Link
              href={recommendedStep.href}
              className="block w-full rounded-xl bg-[#5E5CE6] py-3 text-center text-[14px] font-semibold text-white transition-all hover:bg-[#4F46E5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5E5CE6] focus-visible:ring-offset-2"
            >
              {ar ? recommendedStep.buttonAr : recommendedStep.button}
            </Link>
          </div>
        </div>
      </Shell>
    )
  }

  // ════════════════════════════════════════════════════════════════════════
  // STEPS 1–4
  // ════════════════════════════════════════════════════════════════════════
  const canContinueStep1 = firstIntent.length > 0
  const canContinueStep2 = businessName.trim().length > 0
    && industry.length > 0
    && businessDescription.trim().length >= 12
  const canContinueStep3 = customerLanguage.length > 0 && goal.length > 0
  const canContinueStep4 = offer.trim().length > 0 && idealCustomer.trim().length > 0
  const canContinueStep5 = marketingStatus.length > 0 && platforms.length > 0
  const currentStepReady = step === 1
    ? canContinueStep1
    : step === 2
      ? canContinueStep2
      : step === 3
        ? canContinueStep3
        : step === 4
          ? canContinueStep4
          : canContinueStep5
  const goNext = () => {
    if (step < TOTAL_STEPS) setStep(step + 1)
    else handleSaveBrandBrain()
  }
  const goBack = () => {
    if (step > 1) setStep(step - 1)
    else setView('welcome')
  }

  const stepTitles: Record<number, { t: string; h: string }> = {
    1: ar ? { t: 'الخطوة التي تريدها أولًا', h: 'اختر ما تريد من NEXUS مساعدتك فيه الآن. هذا يوجّه الرحلة فقط ولا يشغّل أي توليد.' }
          : { t: 'Your first priority', h: 'Choose what you want NEXUS to help with now. This only guides the journey; it does not trigger generation.' },
    2: ar ? { t: 'أساسيات النشاط', h: 'عرّف NEXUS بنشاطك ومجاله وموقعه.' }
          : { t: 'Business basics', h: 'Tell NEXUS your business, its field, and where it operates.' },
    3: ar ? { t: 'الهدف واتجاه السوق', h: 'ما لغة عملائك، وما الهدف التسويقي الأهم لك الآن.' }
          : { t: 'Goal and market direction', h: 'Your customers’ language and the marketing goal that matters most now.' },
    4: ar ? { t: 'الجمهور والعرض', h: 'من هو عميلك المثالي، وما الذي يميّزك.' }
          : { t: 'Audience and offer', h: 'Who your ideal customer is, and what makes you different.' },
    5: ar ? { t: 'الوضع التسويقي الحالي', h: 'أين أنت الآن، وعلى أي منصات تنشط.' }
          : { t: 'Current marketing status', h: 'Where you are today, and which platforms you’re active on.' },
  }

  return (
    <Shell dir={dir}>
      <Panel>
        {/* Step indicator */}
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[12px] font-semibold" style={{ color: '#5E5CE6' }}>
            {ar ? `الخطوة ${step} من ${TOTAL_STEPS}` : `Step ${step} of ${TOTAL_STEPS}`}
          </span>
        </div>
        <div className="w-full h-1 rounded-full mb-5 overflow-hidden" style={{ background: '#EEF0F4' }}>
          <div className="h-full rounded-full transition-all duration-300"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%`, background: '#5E5CE6' }} />
        </div>

        <h2 className="text-[19px] font-bold mb-1" style={{ color: '#0F172A' }}>{stepTitles[step].t}</h2>
        <p className="text-[13px] leading-relaxed mb-6" style={{ color: '#64748B' }}>{stepTitles[step].h}</p>

        {/* ── Step 1: First intent ── */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <FieldLabel>{ar ? 'ما الذي تريد من NEXUS مساعدتك فيه أولًا؟' : 'What do you want NEXUS to help with first?'}</FieldLabel>
              <Helper>
                {ar
                  ? 'سيستخدم NEXUS هذا الاختيار لتوجيه الخطوة التالية بعد حفظ ذاكرة علامتك. لن يبدأ أي توليد أو نشر الآن.'
                  : 'NEXUS uses this choice to guide the next step after saving your Brand Brain. No generation or publishing starts now.'}
              </Helper>
              <div className="grid grid-cols-1 gap-2">
                {FIRST_INTENTS.map(i => (
                  <Chip key={i.value} active={firstIntent === i.value} onClick={() => setFirstIntent(i.value)}>
                    {ar ? i.ar : i.en}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Business basics ── */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <FieldLabel>{ar ? 'اسم النشاط التجاري' : 'Business name'}</FieldLabel>
              <input className={inputClass} style={inputStyle} value={businessName}
                onChange={e => setBusinessName(e.target.value)}
                placeholder={ar ? 'مثال: متجر نون للأزياء' : 'e.g. Noon Fashion Store'} />
            </div>
            <div>
              <FieldLabel>{ar ? 'المجال' : 'Industry'}</FieldLabel>
              <select className={inputClass} style={inputStyle} value={industry} onChange={e => setIndustry(e.target.value)}>
                <option value="">{ar ? 'اختر المجال' : 'Select an industry'}</option>
                {INDUSTRIES.map(i => <option key={i.value} value={i.value}>{ar ? i.ar : i.en}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>{ar ? 'وصف مختصر للنشاط' : 'Short business description'}</FieldLabel>
              <Helper>
                {ar
                  ? 'اشرح بوضوح ما الذي تبيعه أو تقدمه. هذا الوصف يدخل مباشرة في سياق الاستراتيجية.'
                  : 'Explain clearly what you sell or provide. This description becomes direct strategy context.'}
              </Helper>
              <textarea className={inputClass} style={{ ...inputStyle, minHeight: 84, resize: 'none' }} value={businessDescription}
                onChange={e => setBusinessDescription(e.target.value)}
                placeholder={ar ? 'مثال: منصة تساعد العيادات على تنظيم المواعيد ومتابعة المرضى.' : 'e.g. A platform that helps clinics manage appointments and patient follow-up.'} />
            </div>
            <div>
              <FieldLabel>{ar ? 'المنطقة أو السوق المستهدف' : 'Region / target market'}</FieldLabel>
              <Helper>{ar ? 'اختياري — يساعد NEXUS على فهم السوق واللغة والتوقيت.' : 'Optional — helps NEXUS understand market, language, and timing.'}</Helper>
              <input className={inputClass} style={inputStyle} value={region}
                onChange={e => setRegion(e.target.value)}
                placeholder={ar ? 'مثال: السعودية، دول الخليج' : 'e.g. Saudi Arabia, GCC'} />
            </div>
          </div>
        )}

        {/* ── Step 3: Goal and market direction ── */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <FieldLabel>{ar ? 'اللغة الأساسية لعملائك' : 'Main customer language'}</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map(l => (
                  <Chip key={l.value} active={customerLanguage === l.value} onClick={() => setCustomerLanguage(l.value)}>
                    {ar ? l.ar : l.en}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <FieldLabel>{ar ? 'الهدف التسويقي الأهم الآن' : 'Main marketing goal'}</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {GOALS.map(g => (
                  <Chip key={g.value} active={goal === g.value} onClick={() => setGoal(g.value)}>
                    {ar ? g.ar : g.en}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 4: Audience and offer ── */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <FieldLabel>{ar ? 'المنتج أو الخدمة الأساسية' : 'Main product or service'}</FieldLabel>
              <input className={inputClass} style={inputStyle} value={offer}
                onChange={e => setOffer(e.target.value)}
                placeholder={ar ? 'مثال: ملابس رياضية للنساء' : 'e.g. Activewear for women'} />
            </div>
            <div>
              <FieldLabel>{ar ? 'العميل المثالي' : 'Ideal customer'}</FieldLabel>
              <Helper>{ar ? 'صف بإيجاز من تخدمه عادةً.' : 'Briefly describe who you usually serve.'}</Helper>
              <input className={inputClass} style={inputStyle} value={idealCustomer}
                onChange={e => setIdealCustomer(e.target.value)}
                placeholder={ar ? 'مثال: نساء 25–40 يهتممن باللياقة' : 'e.g. Women 25–40 interested in fitness'} />
            </div>
            <div>
              <FieldLabel>{ar ? 'لماذا يختار العملاء نشاطك؟' : 'Why should customers choose you?'}</FieldLabel>
              <Helper>{ar ? 'ما الذي يميّزك فعلًا عن غيرك.' : 'What genuinely sets you apart.'}</Helper>
              <textarea className={inputClass} style={{ ...inputStyle, minHeight: 80, resize: 'none' }} value={whyChoose}
                onChange={e => setWhyChoose(e.target.value)}
                placeholder={ar ? 'مثال: جودة أعلى وأسعار مناسبة وخدمة سريعة' : 'e.g. Higher quality, fair pricing, fast service'} />
            </div>
          </div>
        )}

        {/* ── Step 5: Current marketing status ── */}
        {step === 5 && (
          <div className="space-y-6">
            <div>
              <FieldLabel>{ar ? 'وضعك التسويقي الحالي' : 'Your current marketing status'}</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {MARKETING_STATUS.map(s => (
                  <Chip key={s.value} active={marketingStatus === s.value} onClick={() => setMarketingStatus(s.value)}>
                    {ar ? s.ar : s.en}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <FieldLabel>{ar ? 'المنصات التي تستخدمها حالياً' : 'Platforms you currently use'}</FieldLabel>
              <Helper>{ar ? 'اختر كل ما ينطبق. لا يتم ربط أي حساب الآن.' : 'Select all that apply. No account is connected now.'}</Helper>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map(p => (
                  <Chip key={p.value} active={platforms.includes(p.value)} onClick={() => togglePlatform(p.value)}>
                    {ar ? p.ar : p.en}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        )}

        {saveError && (
          <p className="text-[12.5px] mt-5" style={{ color: '#DC2626' }}>
            {ar ? 'تعذّر حفظ المعلومات. يرجى المحاولة مرة أخرى.' : 'We couldn’t save your information. Please try again.'}
          </p>
        )}

        {/* Navigation */}
        <div className="mt-7">
          <PrimaryButton onClick={goNext} disabled={saving || !currentStepReady}>
            {saving
              ? (ar ? 'جارٍ الحفظ…' : 'Saving…')
              : step < TOTAL_STEPS
                ? (ar ? 'متابعة' : 'Continue')
                : (ar ? 'حفظ وعرض الملخص' : 'Save and view summary')}
          </PrimaryButton>
          <div className="mt-1.5">
            <QuietButton onClick={goBack}>{ar ? 'رجوع' : 'Back'}</QuietButton>
          </div>
        </div>
      </Panel>
    </Shell>
  )
}
