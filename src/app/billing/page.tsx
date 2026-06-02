'use client'

/**
 * Billing page — Sprint AH
 * Plans: Free $0 · Pro $29 · Business $79
 * Credits: 10 · 150 · 600  (see src/lib/stripe.ts + src/lib/credits.ts)
 */

import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { useEffect, useState } from 'react'
import AppShell from '@/components/AppShell'
import Link from 'next/link'
import {
  Sparkles, Zap, CheckCircle2, Settings2, ArrowUpRight,
  Rocket, Brain, BarChart3, Shield, Globe, X, Star, Gift,
} from 'lucide-react'

// ─── Plan data ────────────────────────────────────────────────────────────────

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    nameAr: 'مجاني',
    price: 0,
    credits: 10,
    accentColor: '#6366f1',
    featured: false,
    badgeAr: null as string | null,
    badgeEn: null as string | null,
    descAr: 'للتجربة والبدء بدون تكلفة',
    descEn: 'Try it out — no credit card needed',
    roiAr: 'ابدأ مجاناً اليوم',
    roiEn: 'Start building for free today',
    featuresAr: [
      '10 رصيد AI / شهر',
      'حملة واحدة نشطة',
      'Brand Brain (الحقول الأساسية)',
      'توليد الاستراتيجية',
      'عرض تقويم المحتوى',
    ],
    featuresEn: [
      '10 AI credits / month',
      '1 active campaign',
      'Brand Brain (core fields)',
      'AI Strategy generation',
      'Content calendar view',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    nameAr: 'الاحترافي',
    price: 29,
    credits: 150,
    accentColor: '#8B5CF6',
    featured: true,
    badgeAr: 'الأكثر شيوعاً',
    badgeEn: 'Most Popular',
    descAr: 'للعلامات التجارية النامية',
    descEn: 'For growing brands and creators',
    roiAr: 'يوفر 20+ ساعة تسويق شهرياً',
    roiEn: 'Saves 20+ hours of marketing work',
    featuresAr: [
      '150 رصيد AI / شهر',
      'حملات غير محدودة',
      'Brand Brain كامل',
      'جميع وكلاء AI (Strategist, Sentinel, Visual Director)',
      'توليد فيديو بالذكاء الاصطناعي (مفاهيم + Replicate)',
      'نشر على Meta · LinkedIn · TikTok',
      'Autopilot — جدولة تلقائية لـ 4 أسابيع',
      'تحليلات الأداء',
      'بريد ذكاء أسبوعي',
      'تصدير PDF + DOCX',
    ],
    featuresEn: [
      '150 AI credits / month',
      'Unlimited campaigns',
      'Full Brand Brain',
      'All AI agents (Strategist, Sentinel, Visual Director)',
      'AI video generation (concepts + Replicate render)',
      'Publish to Meta · LinkedIn · TikTok',
      'Autopilot — auto-schedule for 4 weeks',
      'Analytics dashboard',
      'Weekly Intelligence Brief email',
      'Export campaigns (PDF + DOCX)',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    nameAr: 'الأعمال',
    price: 79,
    credits: 600,
    accentColor: '#10B981',
    featured: false,
    badgeAr: null as string | null,
    badgeEn: null as string | null,
    descAr: 'للوكالات والفرق المتعددة',
    descEn: 'For agencies and multi-brand teams',
    roiAr: 'يغني عن وكالة تسويق بـ $3,000+',
    roiEn: 'Replaces a $3,000+/mo marketing agency',
    featuresAr: [
      '600 رصيد AI / شهر',
      'كل مميزات Pro',
      '3 مساحات عمل (للوكالات / الفرق)',
      'تصدير PDF بالعلامة التجارية الخاصة',
      'تحليلات متقدمة',
      'دعم أولوية بالبريد الإلكتروني',
    ],
    featuresEn: [
      '600 AI credits / month',
      'Everything in Pro',
      '3 workspaces (for agencies / teams)',
      'White-label PDF exports',
      'Advanced analytics',
      'Priority email support',
    ],
  },
]

// ─── Credit cost reference ────────────────────────────────────────────────────

const CREDIT_ACTIONS = {
  ar: [
    { action: 'حملة كاملة + استراتيجية',        cost: 5,  icon: '🚀' },
    { action: 'تشغيل الاستراتيجية الشاملة',     cost: 5,  icon: '🧠' },
    { action: 'توليد فيديو (Replicate)',          cost: 5,  icon: '🎬' },
    { action: 'Creative Brief مرئي',             cost: 2,  icon: '🎨' },
    { action: 'ملخص فيديو (Video Brief)',         cost: 2,  icon: '📋' },
    { action: 'توليد صورة بالذكاء الاصطناعي',   cost: 2,  icon: '🖼️' },
    { action: 'نسخة إعلانية (VEX)',               cost: 2,  icon: '✍️' },
    { action: 'Sentinel Review للجودة',           cost: 1,  icon: '🛡️' },
    { action: 'رسالة مساعد AI',                  cost: 1,  icon: '💬' },
  ],
  en: [
    { action: 'Full campaign + strategy',         cost: 5,  icon: '🚀' },
    { action: 'Run Full Strategy (all agents)',    cost: 5,  icon: '🧠' },
    { action: 'Video generation (Replicate)',      cost: 5,  icon: '🎬' },
    { action: 'Creative Brief (visuals)',          cost: 2,  icon: '🎨' },
    { action: 'Video Brief (concept + script)',    cost: 2,  icon: '📋' },
    { action: 'AI image generation',              cost: 2,  icon: '🖼️' },
    { action: 'Ad copy (VEX)',                    cost: 2,  icon: '✍️' },
    { action: 'Sentinel Review (quality gate)',   cost: 1,  icon: '🛡️' },
    { action: 'AI assistant message',             cost: 1,  icon: '💬' },
  ],
}

// ─── Comparison rows ──────────────────────────────────────────────────────────

const COMPARISON_ROWS = {
  ar: [
    { label: 'رصيد AI / شهر',          free: '10',  pro: '150',   biz: '600' },
    { label: 'الحملات',                free: '1',   pro: '∞',     biz: '∞' },
    { label: 'مساحات العمل',           free: '1',   pro: '1',     biz: '3' },
    { label: 'Brand Brain كامل',        free: '✗',   pro: '✓',     biz: '✓' },
    { label: 'نشر على السوشيال',        free: '✗',   pro: '✓',     biz: '✓' },
    { label: 'Autopilot',               free: '✗',   pro: '✓',     biz: '✓' },
    { label: 'تحليلات الأداء',          free: '✗',   pro: '✓',     biz: '✓' },
    { label: 'تصدير PDF + DOCX',        free: '✗',   pro: '✓',     biz: '✓' },
    { label: 'White-label export',      free: '✗',   pro: '✗',     biz: '✓' },
    { label: 'مساحات متعددة',          free: '✗',   pro: '✗',     biz: '✓' },
  ],
  en: [
    { label: 'AI credits / month',      free: '10',  pro: '150',   biz: '600' },
    { label: 'Campaigns',               free: '1',   pro: '∞',     biz: '∞' },
    { label: 'Workspaces',              free: '1',   pro: '1',     biz: '3' },
    { label: 'Full Brand Brain',        free: '✗',   pro: '✓',     biz: '✓' },
    { label: 'Social publishing',       free: '✗',   pro: '✓',     biz: '✓' },
    { label: 'Autopilot scheduling',    free: '✗',   pro: '✓',     biz: '✓' },
    { label: 'Analytics dashboard',     free: '✗',   pro: '✓',     biz: '✓' },
    { label: 'PDF + DOCX export',       free: '✗',   pro: '✓',     biz: '✓' },
    { label: 'White-label export',      free: '✗',   pro: '✗',     biz: '✓' },
    { label: 'Multiple workspaces',     free: '✗',   pro: '✗',     biz: '✓' },
  ],
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const { isAuthenticated, loading, user, authHeader } = useAuth()
  const { locale, dir } = useI18n()
  const ar = locale === 'ar'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [subscriptionStatus, setSubscriptionStatus] = useState<any>(null)
  const [checkingOut, setCheckingOut] = useState<string | null>(null)
  const [openingPortal, setOpeningPortal] = useState(false)
  const [notice, setNotice] = useState<{ type: 'success' | 'error', msg: string } | null>(null)
  const [showComparison, setShowComparison] = useState(false)
  const [showCredits, setShowCredits] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === 'true') {
      setNotice({ type: 'success', msg: ar ? 'تم تفعيل اشتراكك بنجاح! 🎉' : 'Subscription activated successfully! 🎉' })
      window.history.replaceState({}, '', '/billing')
    } else if (params.get('cancelled') === 'true') {
      setNotice({ type: 'error', msg: ar ? 'تم إلغاء عملية الدفع.' : 'Checkout was cancelled.' })
      window.history.replaceState({}, '', '/billing')
    }
    fetch('/api/billing/status', { headers: { Authorization: authHeader() } })
      .then(r => r.json())
      .then(d => setSubscriptionStatus(d))
      .catch(() => {})
  }, [isAuthenticated, authHeader]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpgrade = async (planId: string) => {
    if (planId === 'free') return
    setCheckingOut(planId)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else setNotice({ type: 'error', msg: data.error || (ar ? 'خطأ في الدفع' : 'Checkout error') })
    } catch {
      setNotice({ type: 'error', msg: ar ? 'فشل إنشاء جلسة الدفع' : 'Failed to create checkout session' })
    } finally { setCheckingOut(null) }
  }

  const handleManageSubscription = async () => {
    setOpeningPortal(true)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST', headers: { Authorization: authHeader() } })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else setNotice({ type: 'error', msg: ar ? 'تعذر فتح بوابة الاشتراك' : 'Could not open subscription portal' })
    } catch {
      setNotice({ type: 'error', msg: ar ? 'خطأ في بوابة الاشتراك' : 'Portal error' })
    } finally { setOpeningPortal(false) }
  }

  if (loading) return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-accent-purple/20 border-t-accent-purple animate-spin" />
    </div>
  )
  if (!isAuthenticated) return null

  const currentPlan = (subscriptionStatus?.plan || 'FREE').toUpperCase()
  const isActive = subscriptionStatus?.hasActiveSubscription || false
  const creditsRaw = subscriptionStatus?.credits
  const credits = typeof creditsRaw === 'object' && creditsRaw !== null
    ? (creditsRaw as { remaining: number }).remaining
    : (creditsRaw as number ?? 0)
  const isUnlimited = credits === -1 || (subscriptionStatus as { credits?: { max?: number } })?.credits?.max === -1
  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || ''

  const glassCard = { background: 'rgba(12,13,36,0.6)', border: '1px solid rgba(139,92,246,0.1)', backdropFilter: 'blur(12px)' }

  return (
    <AppShell>
      <div dir={dir}>

        {/* ── Notice banner ── */}
        {notice && (
          <div className={`flex items-center justify-between gap-4 px-6 py-3 border-b text-sm ${
            notice.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
          }`}>
            <span>{notice.msg}</span>
            <button onClick={() => setNotice(null)} className="p-1 rounded-lg hover:bg-white/5 transition-all">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-10">

          {/* ── Hero Header ── */}
          <div className="text-center space-y-3 pt-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono tracking-wider"
              style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', color: '#a5a0ff' }}>
              <Sparkles className="w-3 h-3" />
              {ar ? 'خطط الاشتراك' : 'Subscription Plans'}
            </div>
            <h1 className="text-3xl sm:text-4xl font-black font-heading text-white leading-tight">
              {ar ? 'قسم التسويق الذكي بسعر ثابت' : 'Your AI Marketing Department'}
            </h1>
            <p className="text-text-secondary text-sm sm:text-base max-w-xl mx-auto">
              {ar
                ? 'استراتيجية · محتوى · نشر · تحليل — كل ما تحتاجه بضغطة زر.'
                : 'Strategy · content · publishing · analytics — everything you need, on demand.'}
            </p>
            {displayName && (
              <p className="text-xs text-text-muted">
                {ar ? `مرحباً ${displayName} —` : `Welcome back, ${displayName} —`}
                {' '}
                {isActive
                  ? (ar ? `أنت على خطة ${currentPlan}` : `you're on the ${currentPlan} plan`)
                  : (ar ? 'أنت على الخطة المجانية' : "you're on the Free plan")}
                {!isUnlimited && credits >= 0 && (
                  <span className="text-accent-purple font-semibold">
                    {' · '}{ar ? `${credits} رصيد متبقٍ` : `${credits} credits left`}
                  </span>
                )}
              </p>
            )}
          </div>

          {/* ── Active subscription status ── */}
          {isActive && (
            <div className="rounded-2xl p-5 flex items-center justify-between flex-wrap gap-4"
              style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(16,185,129,0.12)' }}>
                  <CheckCircle2 className="w-5 h-5 text-accent-teal" />
                </div>
                <div>
                  <p className="font-bold text-accent-teal text-sm">
                    {ar ? `خطة ${currentPlan} نشطة` : `${currentPlan} Plan Active`}
                  </p>
                  <p className="text-xs text-text-muted">
                    {ar
                      ? isUnlimited ? 'رصيد غير محدود' : `${credits} رصيد متبقٍ هذا الشهر`
                      : isUnlimited ? 'Unlimited credits' : `${credits} credits remaining this month`}
                    {subscriptionStatus?.currentPeriodEnd && (
                      <span className="ml-2">
                        · {ar ? 'يتجدد' : 'renews'}{' '}
                        {new Date(subscriptionStatus.currentPeriodEnd).toLocaleDateString(ar ? 'ar-SA' : 'en-US')}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button onClick={handleManageSubscription} disabled={openingPortal}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:brightness-110 disabled:opacity-60"
                style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.25)' }}>
                <Settings2 className="w-3.5 h-3.5" />
                {openingPortal ? (ar ? 'جاري الفتح...' : 'Opening...') : (ar ? 'إدارة الاشتراك' : 'Manage Subscription')}
              </button>
            </div>
          )}

          {/* ── ROI banner for free users ── */}
          {!isActive && (
            <div className="rounded-2xl p-5 flex items-center gap-4 flex-wrap"
              style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)' }}>
              <div className="text-2xl flex-shrink-0">💡</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">
                  {ar ? 'فريق تسويق كامل بأقل من $30 شهرياً' : 'A full marketing team for under $30/month'}
                </p>
                <p className="text-xs text-text-muted">
                  {ar
                    ? 'استراتيجية · محتوى · نشر تلقائي · تحليل — كل ما تدفعه لوكالة تسويق بـ $3,000+، الآن بـ $29.'
                    : 'Strategy · content · autopilot publishing · analytics — everything a $3,000+/mo agency does, now at $29.'}
                </p>
              </div>
              <a href="#plans"
                className="btn-gradient flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white flex-shrink-0">
                {ar ? 'اختر خطتك' : 'Pick a Plan'} <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {/* ── Referral bonus callout ── */}
          <div className="rounded-2xl p-4 flex items-center gap-3 flex-wrap"
            style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.15)' }}>
            <Gift className="w-4 h-4 text-accent-purple flex-shrink-0" />
            <p className="text-xs text-text-secondary flex-1">
              {ar
                ? 'ادعُ أصدقاءك واحصل على +20 رصيد مجاني لكل دعوة ناجحة — وصديقك يحصل على +20 أيضاً!'
                : 'Refer a friend and get +20 free credits for each successful signup — your friend gets +20 too!'}
            </p>
            <Link href="/settings#referral"
              className="text-xs font-semibold text-accent-purple hover:text-accent-purple/80 transition flex-shrink-0">
              {ar ? 'ابدأ الدعوة ←' : 'Start referring →'}
            </Link>
          </div>

          {/* ── Plan Cards ── */}
          <div id="plans" className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PLANS.map(plan => {
              const isCurrent = currentPlan === plan.id.toUpperCase() && (isActive || plan.id === 'free')
              const badge = ar ? plan.badgeAr : plan.badgeEn
              const desc = ar ? plan.descAr : plan.descEn
              const roi = ar ? plan.roiAr : plan.roiEn
              const features = ar ? plan.featuresAr : plan.featuresEn
              const isFree = plan.id === 'free'

              // What 1 credit = in each plan
              const perCreditCost = isFree ? '—' : `$${(plan.price / plan.credits).toFixed(2)}`

              return (
                <div key={plan.id} className="relative rounded-2xl p-7 flex flex-col transition-all duration-300 hover:translate-y-[-2px]"
                  style={{
                    background: plan.featured ? 'rgba(139,92,246,0.08)' : 'rgba(12,13,36,0.6)',
                    border: plan.featured
                      ? '2px solid rgba(139,92,246,0.4)'
                      : `1px solid ${plan.accentColor}18`,
                    backdropFilter: 'blur(12px)',
                    boxShadow: plan.featured ? '0 0 40px rgba(139,92,246,0.12)' : 'none',
                  }}>

                  {badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-white text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap"
                      style={{ background: 'linear-gradient(135deg, #8B5CF6, #9333EA)' }}>
                      <Star className="w-2.5 h-2.5 inline mr-1" />
                      {badge}
                    </div>
                  )}

                  {isCurrent && !badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap"
                      style={{ background: 'rgba(16,185,129,0.2)', color: '#10B981', border: '1px solid rgba(16,185,129,0.3)' }}>
                      {ar ? '✓ خطتك الحالية' : '✓ Current Plan'}
                    </div>
                  )}

                  {/* Plan header */}
                  <div className="mb-5">
                    <h3 className="text-lg font-bold text-white mb-0.5">{ar ? plan.nameAr : plan.name}</h3>
                    <p className="text-xs text-text-muted mb-3">{desc}</p>
                    <div className="flex items-baseline gap-1 mb-1">
                      {isFree ? (
                        <span className="text-4xl font-black text-white">{ar ? 'مجاني' : 'Free'}</span>
                      ) : (
                        <>
                          <span className="text-4xl font-black text-white">${plan.price}</span>
                          <span className="text-text-muted text-sm">{ar ? '/ شهر' : '/ mo'}</span>
                        </>
                      )}
                    </div>
                    {/* Credits per month */}
                    <div className="flex items-center gap-1.5 text-[12px] font-semibold mb-1" style={{ color: plan.accentColor }}>
                      <Zap className="w-3 h-3 flex-shrink-0" />
                      {ar ? `${plan.credits} رصيد AI / شهر` : `${plan.credits} AI credits / month`}
                    </div>
                    {/* Cost per credit (value anchor) */}
                    {!isFree && (
                      <p className="text-[10px] text-text-muted">
                        {ar ? `≈ ${perCreditCost} لكل رصيد` : `≈ ${perCreditCost} per credit`}
                      </p>
                    )}
                    {/* ROI line */}
                    <div className="flex items-center gap-1.5 text-[11px] font-medium mt-2"
                      style={{ color: plan.accentColor }}>
                      <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                      {roi}
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="space-y-2.5 mb-7 flex-1">
                    {features.map(f => (
                      <li key={f} className="flex items-start gap-2 text-sm text-text-secondary">
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: plan.accentColor }} />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  {isCurrent ? (
                    <div className="w-full py-3 text-center rounded-xl text-sm font-semibold"
                      style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#10B981' }}>
                      {ar ? '✓ خطتك النشطة' : '✓ Your Active Plan'}
                    </div>
                  ) : isFree ? (
                    <Link href="/dashboard"
                      className="w-full py-3 rounded-xl font-bold transition-all text-sm text-center block"
                      style={{ background: `${plan.accentColor}12`, border: `1px solid ${plan.accentColor}30`, color: plan.accentColor }}>
                      {ar ? 'الانتقال إلى الداشبورد' : 'Go to Dashboard'}
                    </Link>
                  ) : (
                    <button onClick={() => handleUpgrade(plan.id)} disabled={!!checkingOut}
                      className={`w-full py-3 rounded-xl font-bold transition-all text-sm disabled:opacity-50 ${
                        plan.featured ? 'btn-gradient text-white' : 'text-white hover:brightness-110'
                      }`}
                      style={!plan.featured ? {
                        background: `${plan.accentColor}12`,
                        border: `1px solid ${plan.accentColor}30`,
                        color: plan.accentColor,
                      } : {}}>
                      {checkingOut === plan.id
                        ? (ar ? 'جاري التحويل...' : 'Redirecting...')
                        : ar ? `ابدأ ${plan.nameAr} — $${plan.price}/شهر` : `Start ${plan.name} — $${plan.price}/mo`}
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* ── Credit cost reference ── */}
          <div className="rounded-2xl overflow-hidden" style={glassCard}>
            <button
              onClick={() => setShowCredits(!showCredits)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/3 transition-all">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-accent-purple" />
                <span className="text-sm font-bold text-white">
                  {ar ? 'كم يكلف كل إجراء AI؟' : 'What does each AI action cost?'}
                </span>
                <span className="text-[10px] text-text-muted">
                  {ar ? '— فهم قيمة أرصدتك' : '— understand your credits'}
                </span>
              </div>
              <span className="text-text-muted text-xs">{showCredits ? '▲' : '▼'}</span>
            </button>
            {showCredits && (
              <div className="border-t px-6 py-4 space-y-2" style={{ borderColor: 'rgba(139,92,246,0.1)' }}>
                {(ar ? CREDIT_ACTIONS.ar : CREDIT_ACTIONS.en).map(item => (
                  <div key={item.action} className="flex items-center justify-between py-1.5"
                    style={{ borderBottom: '1px solid rgba(139,92,246,0.05)' }}>
                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                      <span>{item.icon}</span>
                      {item.action}
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold" style={{ color: '#8B5CF6' }}>
                      <Zap className="w-3 h-3" />
                      {item.cost} {ar ? 'رصيد' : item.cost === 1 ? 'credit' : 'credits'}
                    </div>
                  </div>
                ))}
                <p className="text-[10px] text-text-muted pt-2">
                  {ar
                    ? '💡 خطة Pro (150 رصيد) = 30 حملة كاملة · أو 30 فيديو · أو 75 صورة · أو مزيج من كل الإجراءات'
                    : '💡 Pro (150 credits) = 30 full campaigns · or 30 videos · or 75 images · or any mix of actions'}
                </p>
              </div>
            )}
          </div>

          {/* ── What you replace ── */}
          <div className="rounded-2xl p-6" style={glassCard}>
            <div className="flex items-center gap-2 mb-5">
              <Rocket className="w-4 h-4 text-accent-purple" />
              <h2 className="text-base font-bold text-white">
                {ar ? 'ماذا يغني Nexus AI عنه؟' : 'What does Nexus AI replace?'}
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { icon: Brain,     colorHex: '#8B5CF6', labelAr: 'استراتيجي تسويق',   labelEn: 'Marketing strategist',  costAr: '$3,000/شهر',  costEn: '$3,000/mo' },
                { icon: Sparkles,  colorHex: '#10B981', labelAr: 'كاتب محتوى',         labelEn: 'Content writer',         costAr: '$1,500/شهر',  costEn: '$1,500/mo' },
                { icon: BarChart3, colorHex: '#00D4FF', labelAr: 'محلل أداء',          labelEn: 'Performance analyst',    costAr: '$2,000/شهر',  costEn: '$2,000/mo' },
                { icon: Globe,     colorHex: '#FF6B35', labelAr: 'مدير سوشيال ميديا', labelEn: 'Social media manager',   costAr: '$1,200/شهر',  costEn: '$1,200/mo' },
              ].map(item => {
                const Icon = item.icon
                return (
                  <div key={item.labelEn} className="rounded-xl p-4 text-center"
                    style={{ background: `${item.colorHex}08`, border: `1px solid ${item.colorHex}15` }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-2"
                      style={{ background: `${item.colorHex}15` }}>
                      <Icon className="w-4 h-4" style={{ color: item.colorHex }} />
                    </div>
                    <p className="text-[11px] font-medium text-white mb-0.5">
                      {ar ? item.labelAr : item.labelEn}
                    </p>
                    <p className="text-[10px] text-text-muted line-through">
                      {ar ? item.costAr : item.costEn}
                    </p>
                  </div>
                )
              })}
            </div>
            <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(139,92,246,0.08)' }}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <p className="text-text-muted text-sm">
                  {ar ? 'التكلفة الفعلية لفريق التسويق:' : 'Actual cost of a marketing team:'}
                  <span className="text-white font-bold mx-1">{ar ? '$7,700+/شهر' : '$7,700+/mo'}</span>
                </p>
                <p className="text-sm font-bold" style={{ color: '#10B981' }}>
                  {ar ? 'Nexus AI Pro: $29/شهر ← وفر $7,671' : 'Nexus AI Pro: $29/mo ← save $7,671'}
                </p>
              </div>
            </div>
          </div>

          {/* ── Feature comparison table ── */}
          <div className="rounded-2xl overflow-hidden" style={glassCard}>
            <button
              onClick={() => setShowComparison(!showComparison)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/3 transition-all">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-accent-purple" />
                <span className="text-sm font-bold text-white">
                  {ar ? 'مقارنة تفصيلية للخطط' : 'Detailed Plan Comparison'}
                </span>
              </div>
              <span className="text-text-muted text-xs">{showComparison ? '▲' : '▼'}</span>
            </button>

            {showComparison && (
              <div className="border-t" style={{ borderColor: 'rgba(139,92,246,0.1)' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(139,92,246,0.08)' }}>
                      <th className="text-left px-6 py-3 text-[11px] text-text-muted font-medium">
                        {ar ? 'الميزة' : 'Feature'}
                      </th>
                      {(ar ? ['مجاني', 'Pro', 'Business'] : ['Free', 'Pro', 'Business']).map((p, i) => (
                        <th key={p} className="px-4 py-3 text-[11px] font-bold text-center"
                          style={{ color: i === 1 ? '#8B5CF6' : '#a5a0ff' }}>
                          {p}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(ar ? COMPARISON_ROWS.ar : COMPARISON_ROWS.en).map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(139,92,246,0.05)' }}
                        className="hover:bg-white/2 transition-all">
                        <td className="px-6 py-2.5 text-text-muted text-xs">{row.label}</td>
                        {[row.free, row.pro, row.biz].map((val, j) => (
                          <td key={j} className={`px-4 py-2.5 text-center text-xs font-medium ${
                            val === '✓' ? 'text-accent-teal' :
                            val === '✗' ? 'text-text-muted opacity-30' :
                            val === '∞' ? 'text-accent-purple font-bold' :
                            'text-white'
                          }`}>
                            {val}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── FAQ ── */}
          <div className="rounded-2xl p-6" style={glassCard}>
            <div className="flex items-center gap-2 mb-5">
              <Sparkles className="w-4 h-4 text-accent-purple" />
              <h2 className="text-base font-bold text-white">{ar ? 'أسئلة شائعة' : 'FAQ'}</h2>
            </div>
            <div className="space-y-5">
              {(ar ? [
                {
                  q: 'هل يمكنني الإلغاء في أي وقت؟',
                  a: 'نعم. يمكنك الإلغاء في أي وقت من خلال "إدارة الاشتراك". ستحتفظ بالوصول حتى نهاية فترة الفوترة الحالية.',
                },
                {
                  q: 'ما هي أرصدة AI؟',
                  a: 'كل إجراء AI يستهلك عدداً محدداً من الأرصدة (مثلاً: حملة كاملة = 5 أرصدة، Sentinel Review = 1 رصيد). الأرصدة تتجدد تلقائياً كل شهر.',
                },
                {
                  q: 'ماذا يحدث إذا استهلكت كل أرصدتي؟',
                  a: 'لن تتمكن من تشغيل إجراءات AI جديدة حتى تجديد الأرصدة الشهري أو الترقية. لن يُحذف أي محتوى موجود.',
                },
                {
                  q: 'كيف يعمل نظام الإحالة؟',
                  a: 'شارك رابط دعوتك الخاص من إعدادات الحساب. عند تسجيل صديقك وإكمال الإعداد، تحصل أنت وهو على +20 رصيد إضافي مجاناً.',
                },
                {
                  q: 'هل تقدمون استرداداً للمبالغ؟',
                  a: 'نقدم ضمان استرداد الأموال خلال 7 أيام من الاشتراك الأول. تواصل مع فريق الدعم.',
                },
                {
                  q: 'هل بيانات علامتي التجارية آمنة؟',
                  a: 'نعم. كل مساحة عمل معزولة تماماً. بيانات Brand Brain وحملاتك مخزنة بشكل آمن ولا يشاركها Nexus AI مع أطراف ثالثة.',
                },
              ] : [
                {
                  q: 'Can I cancel at any time?',
                  a: 'Yes. Cancel any time via "Manage Subscription." You keep access until the end of your current billing period.',
                },
                {
                  q: 'What are AI credits?',
                  a: 'Each AI action uses a specific number of credits (e.g. full campaign = 5 credits, Sentinel Review = 1 credit). Credits reset automatically every month.',
                },
                {
                  q: 'What happens when I run out of credits?',
                  a: "You won't be able to run new AI actions until your monthly reset or you upgrade. No existing content is deleted.",
                },
                {
                  q: 'How does the referral program work?',
                  a: 'Share your unique referral link from Account Settings. When your friend signs up and completes setup, you both get +20 bonus credits — free.',
                },
                {
                  q: 'Do you offer refunds?',
                  a: 'We offer a 7-day money-back guarantee on first-time subscriptions. Contact support.',
                },
                {
                  q: 'Is my brand data safe?',
                  a: 'Yes. Each workspace is fully isolated. Your Brand Brain and campaign data is stored securely and never shared with third parties.',
                },
              ]).map(faq => (
                <div key={faq.q} className="pb-5 last:pb-0"
                  style={{ borderBottom: '1px solid rgba(139,92,246,0.06)' }}>
                  <h3 className="font-semibold text-sm mb-1.5 text-white">{faq.q}</h3>
                  <p className="text-text-secondary text-xs leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Bottom CTA ── */}
          {!isActive && (
            <div className="text-center py-6 space-y-3">
              <p className="text-text-muted text-xs">
                {ar ? 'الدفع آمن عبر' : 'Secure payment via'}{' '}
                <span className="text-white font-medium">Stripe</span>
                {' · '}
                {ar ? 'ضمان استرداد 7 أيام' : '7-day refund guarantee'}
                {' · '}
                {ar ? 'إلغاء في أي وقت' : 'Cancel any time'}
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <a href="#plans" className="btn-gradient inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white">
                  <Zap className="w-4 h-4" />
                  {ar ? 'ابدأ Pro بـ $29' : 'Start Pro — $29/mo'}
                </a>
                <Link href="/dashboard"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-text-muted hover:text-white transition-all"
                  style={{ border: '1px solid rgba(139,92,246,0.15)' }}>
                  {ar ? 'الداشبورد' : 'Dashboard'}
                </Link>
              </div>
            </div>
          )}

        </div>
      </div>
    </AppShell>
  )
}
