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
     • Paid = planning only. Auto-publishing = off. Analytics = not connected.
     • Arabic copy = neutral, professional Modern Standard Arabic.
     • Nothing here touches wallet / credits / billing / subscriptions.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'

// ── Option lists (no emojis) ────────────────────────────────────────────────
const INDUSTRIES: { value: string; ar: string; en: string }[] = [
  { value: 'ecommerce',   ar: 'تجارة إلكترونية',  en: 'E-commerce' },
  { value: 'saas',        ar: 'برمجيات وتقنية',    en: 'Software & Tech' },
  { value: 'agency',      ar: 'وكالة تسويق',        en: 'Marketing Agency' },
  { value: 'fitness',     ar: 'لياقة وصحة',          en: 'Fitness & Health' },
  { value: 'food',        ar: 'أغذية ومشروبات',     en: 'Food & Beverage' },
  { value: 'real_estate', ar: 'عقارات',              en: 'Real Estate' },
  { value: 'beauty',      ar: 'جمال وعناية',         en: 'Beauty & Care' },
  { value: 'consulting',  ar: 'استشارات',            en: 'Consulting' },
  { value: 'education',   ar: 'تعليم وتدريب',        en: 'Education & Training' },
  { value: 'healthcare',  ar: 'رعاية صحية',          en: 'Healthcare' },
  { value: 'other',       ar: 'أخرى',                en: 'Other' },
]

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

const TOTAL_STEPS = 4

// ── Calm building-block components (defined OUTSIDE the page component so they
//    are not remounted on every keystroke) ─────────────────────────────────
function Shell({ children, dir }: { children: ReactNode; dir: 'rtl' | 'ltr' }) {
  return (
    <div dir={dir} className="min-h-screen w-full flex items-center justify-center px-4 py-10"
      style={{ background: '#F8FAFC', color: '#0F172A' }}>
      <div className="w-full max-w-xl">{children}</div>
    </div>
  )
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-7 sm:p-9"
      style={{ border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.05)' }}>
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
  const [businessName, setBusinessName] = useState('')
  const [industry, setIndustry] = useState('')
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

  // Skip onboarding entirely if a workspace already exists (returning users)
  useEffect(() => {
    if (!isAuthenticated) return
    const token = authHeader()
    if (!token) return
    fetch('/api/workspaces', { headers: { Authorization: token } })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data) && data.length > 0) router.push('/dashboard') })
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
      // 1) Ensure a workspace exists for this user.
      await fetch('/api/workspaces', {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug, description: industry }),
      })

      // 2) Save the starter fields as Brand Brain memory. No strategy is created.
      const statusOpt = MARKETING_STATUS.find(s => s.value === marketingStatus)
      const statusLabel = ar ? 'الوضع التسويقي الحالي' : 'Current marketing status'
      const strategicNotes = statusOpt
        ? `${statusLabel}: ${ar ? statusOpt.ar : statusOpt.en}`
        : null

      await fetch('/api/brand', {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandName: name,
          industry: industry || 'other',
          audienceLocation: region.trim() || null,
          languagePreference: customerLanguage || null,
          primaryOffer: offer.trim() || null,
          businessGoal: goal || null,
          targetAudience: idealCustomer.trim() || null,
          uniqueAdvantages: whyChoose.trim() ? [whyChoose.trim()] : [],
          topPlatforms: platforms.filter(p => p !== 'none'),
          strategicNotes,
        }),
      })

      // Preserve existing first-run referral behavior (credit logic untouched).
      const pendingRef = typeof window !== 'undefined' ? localStorage.getItem('pendingReferralCode') : null
      if (pendingRef) {
        try {
          await fetch('/api/referral/claim', {
            method: 'POST',
            headers: { Authorization: token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ referralCode: pendingRef }),
          })
        } catch { /* non-blocking */ }
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
            {ar ? 'لنبدأ بفهم نشاطك التجاري' : 'Let’s understand your business first'}
          </h1>
          <p className="text-[14px] leading-relaxed mb-6" style={{ color: '#475569' }}>
            {ar
              ? 'يحتاج NEXUS إلى بعض المعلومات الأساسية قبل أن يقترح اتجاهًا تسويقيًا أو خطة محتوى مناسبة لنشاطك.'
              : 'NEXUS needs a few essential details before it can suggest a useful marketing direction or content plan for your business.'}
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
              ? 'هذه المعلومات ستكون بداية ذاكرة علامتك التجارية، وهي الأساس الذي يعتمد عليه NEXUS في الاستراتيجيات والمحتوى والتوصيات القادمة.'
              : 'These details become the start of your Brand Brain — the foundation NEXUS uses for future strategies, content, and recommendations.'}
          </p>

          <PrimaryButton onClick={() => { setStep(1); setView('steps') }}>
            {ar ? 'ابدأ تعريف نشاطك التجاري' : 'Start business setup'}
          </PrimaryButton>
          <div className="mt-1.5">
            <QuietButton onClick={() => setView('limited')}>
              {ar ? 'سأكمل ذلك لاحقًا' : 'I’ll do this later'}
            </QuietButton>
          </div>

          <p className="text-[12px] leading-relaxed mt-4 pt-4 text-center"
            style={{ color: '#94A3B8', borderTop: '1px solid rgba(15,23,42,0.06)' }}>
            {ar
              ? 'لن ينشئ NEXUS استراتيجية كاملة أو ينشر أي محتوى قبل أن تكون المعلومات والموافقات المطلوبة واضحة.'
              : 'NEXUS will not create a full strategy or publish content until the required information and approvals are clear.'}
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
            {ar ? 'ابدأ تعريف نشاطك التجاري' : 'Start business setup'}
          </PrimaryButton>
          <div className="mt-1.5">
            <QuietButton onClick={() => router.push('/dashboard')}>
              {ar ? 'الذهاب إلى لوحة التحكم' : 'Go to dashboard'}
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
    const goalLabel = GOALS.find(g => g.value === goal)
    const langLabel = LANGUAGES.find(l => l.value === customerLanguage)
    const statusLabel = MARKETING_STATUS.find(s => s.value === marketingStatus)
    const platformNames = platforms.filter(p => p !== 'none').map(p => {
      const f = PLATFORMS.find(x => x.value === p); return f ? (ar ? f.ar : f.en) : p
    })

    const known: { label: string; value: string }[] = []
    const push = (label: string, value?: string | null) => { if (value && value.trim()) known.push({ label, value: value.trim() }) }
    push(ar ? 'اسم النشاط' : 'Business name', businessName)
    push(ar ? 'المجال' : 'Industry', industryLabel ? (ar ? industryLabel.ar : industryLabel.en) : '')
    push(ar ? 'المنطقة / السوق' : 'Region / market', region)
    push(ar ? 'لغة العملاء' : 'Customer language', langLabel ? (ar ? langLabel.ar : langLabel.en) : '')
    push(ar ? 'المنتج أو الخدمة' : 'Product or service', offer)
    push(ar ? 'الهدف التسويقي' : 'Marketing goal', goalLabel ? (ar ? goalLabel.ar : goalLabel.en) : '')
    push(ar ? 'العميل المثالي' : 'Ideal customer', idealCustomer)
    push(ar ? 'سبب الاختيار' : 'Why customers choose you', whyChoose)
    push(ar ? 'الوضع التسويقي' : 'Marketing status', statusLabel ? (ar ? statusLabel.ar : statusLabel.en) : '')
    if (platformNames.length) known.push({ label: ar ? 'المنصات النشطة' : 'Active platforms', value: platformNames.join('، ') })

    const needs = ar
      ? ['المنافسون', 'أمثلة سابقة من المحتوى', 'نتائج أداء حقيقية', 'أصول بصرية أو صور', 'تفاصيل نبرة العلامة التجارية', 'الحسابات المتصلة']
      : ['Competitors', 'Past content examples', 'Real performance results', 'Visual assets or images', 'Brand tone details', 'Connected accounts']

    const readiness: { label: string; state: string }[] = ar
      ? [
          { label: 'الاستراتيجية العضوية', state: 'جاهز لموجز أولي' },
          { label: 'الاستراتيجية الكاملة', state: 'تحتاج معلومات إضافية' },
          { label: 'الإعلانات المدفوعة', state: 'للتخطيط فقط' },
          { label: 'النشر التلقائي', state: 'غير مفعّل' },
          { label: 'التحليلات', state: 'غير متصلة' },
          { label: 'ذاكرة التعلّم', state: 'مبكرة' },
        ]
      : [
          { label: 'Organic strategy', state: 'Ready for an initial brief' },
          { label: 'Full strategy', state: 'Needs more information' },
          { label: 'Paid ads', state: 'Planning only' },
          { label: 'Auto publishing', state: 'Not enabled' },
          { label: 'Analytics', state: 'Not connected' },
          { label: 'Learning memory', state: 'Early' },
        ]

    return (
      <Shell dir={dir}>
        <div className="mb-5">
          <h1 className="text-[22px] font-bold mb-1.5" style={{ color: '#0F172A' }}>
            {ar ? 'الملخص الأولي لذاكرة العلامة' : 'Initial Brand Brain Summary'}
          </h1>
          <p className="text-[13px] leading-relaxed" style={{ color: '#64748B' }}>
            {ar
              ? 'هذا ما حفظه NEXUS حتى الآن. لا توجد استراتيجية كاملة بعد — فقط الأساس الذي ستُبنى عليه التوصيات.'
              : 'This is what NEXUS has saved so far. There is no full strategy yet — only the foundation future recommendations will build on.'}
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
              {ar
                ? 'بناءً على المعلومات الحالية، يستطيع NEXUS توجيهك إلى الخطوة التالية المناسبة داخل لوحة التحكم. سيتم إنشاء الموجز التشغيلي الكامل في مرحلة لاحقة عندما يكون مساره واضحًا ومبنيًا على بيانات كافية.'
                : 'Based on the information available, NEXUS can guide you to the next appropriate step in the dashboard. A dedicated operating brief flow should be added later once it is clearly defined and based on sufficient data.'}
            </p>
            <PrimaryButton onClick={() => router.push('/dashboard')}>
              {ar ? 'عرض الخطوة التالية' : 'View next step'}
            </PrimaryButton>
            <div className="mt-1.5">
              <QuietButton onClick={() => router.push('/brand')}>
                {ar ? 'عرض ذاكرة العلامة' : 'View Brand Brain'}
              </QuietButton>
            </div>
          </div>
        </div>
      </Shell>
    )
  }

  // ════════════════════════════════════════════════════════════════════════
  // STEPS 1–4
  // ════════════════════════════════════════════════════════════════════════
  const canContinueStep1 = businessName.trim().length > 0 && industry.length > 0
  const goNext = () => {
    if (step < TOTAL_STEPS) setStep(step + 1)
    else handleSaveBrandBrain()
  }
  const goBack = () => {
    if (step > 1) setStep(step - 1)
    else setView('welcome')
  }

  const stepTitles: Record<number, { t: string; h: string }> = {
    1: ar ? { t: 'أساسيات النشاط', h: 'عرّف NEXUS بنشاطك ومجاله وموقعه.' }
          : { t: 'Business basics', h: 'Tell NEXUS your business, its field, and where it operates.' },
    2: ar ? { t: 'الهدف واتجاه السوق', h: 'ما لغة عملائك، وما الهدف التسويقي الأهم لك الآن.' }
          : { t: 'Goal and market direction', h: 'Your customers’ language and the marketing goal that matters most now.' },
    3: ar ? { t: 'الجمهور والعرض', h: 'من هو عميلك المثالي، وما الذي يميّزك.' }
          : { t: 'Audience and offer', h: 'Who your ideal customer is, and what makes you different.' },
    4: ar ? { t: 'الوضع التسويقي الحالي', h: 'أين أنت الآن، وعلى أي منصات تنشط.' }
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

        {/* ── Step 1: Business basics ── */}
        {step === 1 && (
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
              <FieldLabel>{ar ? 'المنطقة أو السوق المستهدف' : 'Region / target market'}</FieldLabel>
              <Helper>{ar ? 'اختياري — يساعد NEXUS على فهم السوق واللغة والتوقيت.' : 'Optional — helps NEXUS understand market, language, and timing.'}</Helper>
              <input className={inputClass} style={inputStyle} value={region}
                onChange={e => setRegion(e.target.value)}
                placeholder={ar ? 'مثال: السعودية، دول الخليج' : 'e.g. Saudi Arabia, GCC'} />
            </div>
          </div>
        )}

        {/* ── Step 2: Goal and market direction ── */}
        {step === 2 && (
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

        {/* ── Step 3: Audience and offer ── */}
        {step === 3 && (
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

        {/* ── Step 4: Current marketing status ── */}
        {step === 4 && (
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
              <FieldLabel>{ar ? 'المنصات النشطة' : 'Active platforms'}</FieldLabel>
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
          <PrimaryButton onClick={goNext} disabled={saving || (step === 1 && !canContinueStep1)}>
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
