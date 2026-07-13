'use client'

/**
 * Billing page — plan and credits transparency.
 */

import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { useEffect, useState } from 'react'
import AppShell from '@/components/AppShell'
import CreditHistoryModal from '@/components/CreditHistoryModal'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import { formatCreditDisplay } from '@/lib/creditDisplay'
import { getBillingDisplayTruth } from '@/lib/billingDisplayTruth'
import {
  CREDIT_PURCHASE_POLICY,
  FREE_TRIAL_CREDITS,
  quoteCreditPurchase,
} from '@/lib/commercialPlans'
import Link from 'next/link'
import {
  Sparkles, CheckCircle2, Settings2,
  Rocket, Brain, Shield, Globe, Image,
  MessageSquare, FileText, Gift, Zap, History,
} from 'lucide-react'

// ─── Plan definitions ───────────────────────────────────────────────────────────

const PLANS = [
  {
    id: 'pro',
    nameAr: 'جروث',
    nameEn: 'Growth',
    price: 49,
    creditsAr: '150 رصيد / شهر — يتجدد تلقائياً',
    creditsEn: '150 credits / month — renews monthly',
    accentColor: '#8b5cf6',
    featured: true,
    badgeAr: 'الأكثر شعبية',
    badgeEn: 'Most Popular',
    descAr: 'للفرق التي تخطط وتنتج وتراجع المحتوى باستمرار',
    descEn: 'For teams planning, producing, and reviewing content consistently',
    limitsAr: [
      '150 رصيد AI / شهر (يتجدد شهرياً)',
      '3 مساحات عمل (3 براندات)',
      '10 حملات / شهر',
      '25 بوست / شهر',
      'Brand Brain الكامل + ذاكرة الحملات',
    ],
    limitsEn: [
      '150 AI credits / month (renews monthly)',
      '3 workspaces (3 brands)',
      '10 campaigns / month',
      '25 AI posts / month',
      'Full Brand Brain + Campaign Memory (reviewed signals across campaigns)',
    ],
  },
  {
    id: 'business',
    nameAr: 'أوتوبايلوت',
    nameEn: 'Autopilot',
    price: 99,
    creditsAr: '500 رصيد / شهر — يتجدد تلقائياً',
    creditsEn: '500 credits / month — renews monthly',
    accentColor: '#10b981',
    featured: false,
    badgeAr: 'تشغيل متقدم',
    badgeEn: 'Advanced operations',
    descAr: 'لتشغيل عدة براندات مع مراقبة مجدولة وقائمة قرارات',
    descEn: 'For multi-brand operations with scheduled monitoring and an action queue',
    limitsAr: [
      '500 رصيد AI / شهر (يتجدد شهرياً)',
      '10 مساحات عمل (10 براندات أو عملاء)',
      'حملات غير محدودة / شهر',
      '60 بوست / شهر',
      'مراقبة مجدولة + قائمة قرارات مبنية على الأدلة',
    ],
    limitsEn: [
      '500 AI credits / month (renews monthly)',
      '10 workspaces (10 brands / clients)',
      'Unlimited campaigns / month',
      '60 AI posts / month',
      'Scheduled monitoring + evidence-backed action queue',
    ],
  },
]

// ─── Credit cost breakdown ────────────────────────────────────────────────────
// Keep in sync with src/lib/credits.ts → CREDIT_COSTS

const CREDIT_ACTIONS = [
  {
    icon: Rocket,
    labelAr: 'المسار الأساسي من الاستراتيجية إلى المسودات',
    labelEn: 'Core strategy-to-drafts workflow',
    cost: 12,
    noteAr: '8 للاستراتيجية + 2 لفحص الجودة + 2 لمسودات المحتوى. الصور اختيارية وتكلفتها منفصلة.',
    noteEn: '8 strategy + 2 quality review + 2 content drafts. Optional images are charged separately.',
  },
  {
    icon: Brain,
    labelAr: 'إنشاء الاستراتيجية',
    labelEn: 'Strategy generation',
    cost: null,
    costAr: 'متغير',
    costEn: 'Varies',
    noteAr: 'التكلفة تعتمد على نوع الاستراتيجية والمدة وكثافة المحتوى.',
    noteEn: 'Cost depends on strategy scope, duration, and content intensity.',
  },
  {
    icon: Image,
    labelAr: 'توليد صورة AI',
    labelEn: 'AI image generation',
    cost: 3,
    noteAr: '1024×1024، جودة عالية، مرتبطة بهوية البراند',
    noteEn: '1024×1024, brand-aware, high quality',
  },
  {
    icon: FileText,
    labelAr: 'موجز الإبداع (Creative Brief)',
    labelEn: 'Creative brief',
    cost: 3,
    noteAr: 'تحليل الأصول + توجيه بصري للحملة',
    noteEn: 'Asset analysis + visual direction for campaign',
  },
  {
    icon: Globe,
    labelAr: 'نسخ إعلانية (Ad Copy)',
    labelEn: 'Ad copy generation',
    cost: 2,
    noteAr: 'عناوين + CTA + أوصاف مخصصة للبراند',
    noteEn: 'Headlines + CTAs + brand-specific descriptions',
  },
  {
    icon: Shield,
    labelAr: 'مراجعة سنتنيل',
    labelEn: 'Sentinel quality review',
    cost: 2,
    noteAr: 'مراجعة الجودة والمخاطر قبل النشر',
    noteEn: 'Quality + risk review before publishing',
  },
  {
    icon: Zap,
    labelAr: 'إعادة كتابة بوست AI',
    labelEn: 'AI post rewrite',
    cost: 1,
    noteAr: 'حسّن أي بوست بنقرة واحدة',
    noteEn: 'Improve any post with one click',
  },
  {
    icon: MessageSquare,
    labelAr: 'رسالة دردشة AI',
    labelEn: 'AI chat message',
    cost: 1,
    noteAr: 'مساعد تسويقي ذكي يعرف براندك',
    noteEn: 'Marketing assistant that knows your brand',
  },
]

// ─── FAQ ──────────────────────────────────────────────────────────────────────

const FAQS = [
  {
    qAr: 'هل التجربة المجانية باقة ثالثة؟',
    qEn: 'Is the free trial a third plan?',
    aAr: 'لا. توجد باقتان مدفوعتان فقط: Growth وAutopilot. أرصدة التجربة تساعدك على تقييم المنتج قبل الاشتراك.',
    aEn: 'No. There are exactly two paid plans: Growth and Autopilot. Trial credits let you evaluate the product before subscribing.',
  },
  {
    qAr: 'هل تتجدد الأرصدة كل شهر؟',
    qEn: 'Do credits renew every month?',
    aAr: 'نعم، في Growth وAutopilot. أرصدة التجربة لا تتجدد، والأرصدة الإضافية المشتراة صالحة لمدة 12 شهراً.',
    aEn: 'Yes, on Growth and Autopilot. Trial credits do not renew; purchased credits remain valid for 12 months.',
  },
  {
    qAr: 'ما الفرق بين Growth وAutopilot؟',
    qEn: 'What is the difference between Growth and Autopilot?',
    aAr: 'Growth مناسب للتخطيط والإنتاج اليومي، بينما Autopilot يضيف سعة أكبر ومراقبة مجدولة وقائمة قرارات وتشغيل عدة براندات.',
    aEn: 'Growth covers day-to-day planning and production; Autopilot adds more capacity, scheduled monitoring, an action queue, and multi-brand operations.',
  },
  {
    qAr: 'ماذا يحدث إذا نفدت أرصدتي قبل نهاية الشهر؟',
    qEn: 'What happens if I run out of credits?',
    aAr: 'يمكنك شراء العدد الذي تحتاجه من محفظة الرصيد أو الانتظار حتى التجديد. الرصيد المشترى لا يُمسح مع رصيد الباقة.',
    aEn: 'Buy the exact amount you need from the credit wallet or wait for renewal. Purchased credits are not cleared with plan credits.',
  },
  {
    qAr: 'هل يمكنني إلغاء اشتراكي في أي وقت؟',
    qEn: 'Can I cancel anytime?',
    aAr: 'نعم، من إعدادات الفوترة في أي وقت. ستبقى مشتركاً حتى نهاية دورة الفوترة الحالية.',
    aEn: 'Yes, cancel anytime from your billing settings. You retain access until the end of the current billing period.',
  },
  {
    qAr: 'كيف يعمل نظام الإحالة؟',
    qEn: 'How does the referral program work?',
    aAr: 'ادعُ صديقاً بالرابط الخاص بك — كلاكما يحصل على +20 رصيداً مجاناً عند إتمام الصديق الإعداد.',
    aEn: 'Invite a friend with your unique link — you both get +20 free credits when they complete onboarding.',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const { session } = useAuth()
  const { isRTL } = useI18n()
  const ar = isRTL

  const [billingStatus, setBillingStatus] = useState<{
    plan: string
    status: string
    hasActiveSubscription: boolean
    billingEnabled?: boolean
    creditPurchasesEnabled?: boolean
    creditBreakdown?: {
      monthly: number
      purchased: number
      trial: number
      other: number
      nextPurchasedExpiry: string | null
    } | null
    credits: {
      remaining: number
      used: number
      max: number
    }
    currentPeriodEnd: string | null
    cancelledAt: string | null
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const [creditQuantity, setCreditQuantity] = useState(100)
  const [buyingCredits, setBuyingCredits] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [billingMessage, setBillingMessage] = useState<string | null>(null)
  const [showCreditHistory, setShowCreditHistory] = useState(false)

  useEffect(() => {
    if (!session?.access_token) { setLoading(false); return }
    fetch('/api/billing/status', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(d => { if (d.plan) setBillingStatus(d) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [session])

  const handleUpgrade = async (planId: string) => {
    if (!session?.access_token) {
      window.location.href = `/auth/register?plan=${encodeURIComponent(planId)}`
      return
    }
    if (billingStatus?.billingEnabled === false) {
      setBillingMessage(ar
        ? 'الاشتراكات المدفوعة غير مفعلة مؤقتا أثناء مرحلة البيتا. يمكنك استخدام الأرصدة المجانية الآن.'
        : 'Paid subscriptions are temporarily disabled during beta. You can keep using the free credits for now.'
      )
      return
    }
    setUpgrading(planId)
    try {
      const r = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan: planId }),
      })
      const data = await r.json()
      if (data.url) window.location.href = data.url
      else if (data.error) setBillingMessage(data.error)
    } catch (e) { console.error(e) }
    finally { setUpgrading(null) }
  }

  const handlePortal = async () => {
    if (!session?.access_token) return
    try {
      const r = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await r.json()
      if (data.url) window.location.href = data.url
    } catch (e) { console.error(e) }
  }

  const handleBuyCredits = async () => {
    if (!session?.access_token) return
    const quote = quoteCreditPurchase(creditQuantity)
    if (!quote) {
      setBillingMessage(ar
        ? 'اختر كمية صحيحة بين 50 و5,000 رصيد، بزيادة 10 أرصدة.'
        : 'Choose a valid quantity from 50 to 5,000 credits in increments of 10.')
      return
    }
    setBuyingCredits(true)
    setBillingMessage(null)
    try {
      const requestId = globalThis.crypto?.randomUUID?.()
        ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const response = await fetch('/api/billing/credits/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ credits: quote.credits, requestId }),
      })
      const data = await response.json()
      if (data.url) window.location.href = data.url
      else setBillingMessage(data.error || (ar ? 'تعذر بدء عملية الشراء.' : 'Could not start checkout.'))
    } catch (error) {
      console.error(error)
      setBillingMessage(ar ? 'تعذر بدء عملية الشراء.' : 'Could not start checkout.')
    } finally {
      setBuyingCredits(false)
    }
  }

  const rawCurrentPlan = billingStatus?.plan?.toLowerCase() || 'free'
  const currentPlan = rawCurrentPlan === 'starter' ? 'pro' : rawCurrentPlan === 'agency' ? 'business' : rawCurrentPlan
  const isAuthenticated = Boolean(session?.access_token)
  const billingEnabled = billingStatus?.billingEnabled === true
  const currentCredits = billingStatus?.credits?.remaining ?? 0
  const monthlyCredits = billingStatus?.credits?.max ?? 20
  const creditPurchaseQuote = quoteCreditPurchase(creditQuantity)

  const billingDisplay = getBillingDisplayTruth({
    plan: billingStatus?.plan,
    status: billingStatus?.status,
    hasActiveSubscription: billingStatus?.hasActiveSubscription,
    creditsRemaining: billingStatus?.credits?.remaining,
    creditsMax: billingStatus?.credits?.max,
    billingLoaded: !loading,
    billingEnabled: billingStatus?.billingEnabled,
    locale: ar ? 'ar' : 'en',
  })

  // Honest, overflow-safe credit display. When the balance exceeds the monthly
  // grant (rollover / bonus / refunds), we show "N credits" + an explanation
  // instead of a confusing "246 / 150" with an overflowing bar.
  // No active subscription → one-time credits → no monthly denominator.
  const creditGrant = billingStatus?.hasActiveSubscription ? monthlyCredits : 0
  const creditDisp = formatCreditDisplay({
    availableCredits: currentCredits,
    monthlyCredits: creditGrant,
    locale: ar ? 'ar' : 'en',
  })
  const creditsPercent = creditDisp.percent

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-10">
        <LuxuryWorkspaceHeader
          pageTitle={ar ? 'الفوترة والكريدت' : 'Billing & credits'}
          pageSubtitle={ar ? 'اعرف باقتك ورصيدك وتكلفة كل إجراء قبل التشغيل.' : 'Understand your plan, balance, and action costs before you run anything.'}
          primaryHref="/settings"
          primaryLabel={ar ? 'إعدادات الحساب' : 'Account settings'}
          secondaryHref="/dashboard"
          secondaryLabel={ar ? 'العودة للرئيسية' : 'Back to Today'}
        />

        {/* ── Current plan status ─────────────────────────────────────────── */}
        {!loading && !billingEnabled && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  {ar ? 'وضع البيتا مفعّل' : 'Beta billing mode'}
                </p>
                <p className="text-sm text-amber-800 mt-1">
                  {ar
                    ? 'الدفع الحقيقي غير مفعّل حتى اكتمال الإعدادات القانونية وStripe. الحسابات المجانية والأرصدة التجريبية تعمل بشكل طبيعي.'
                    : 'Live payments are disabled until legal and Stripe setup is complete. Free accounts and trial credits continue to work normally.'
                  }
                </p>
              </div>
            </div>
          </div>
        )}

        {billingMessage && (
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-800">
            {billingMessage}
          </div>
        )}

        {!loading && billingStatus && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                  {ar ? 'خطتك الحالية' : 'Current plan'}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-slate-950">
                    {billingDisplay.planLabel}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${billingDisplay.statusTone === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : billingDisplay.statusTone === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-200' : billingDisplay.statusTone === 'danger' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                      {billingDisplay.statusLabel}
                    </span>
                </div>
              </div>

              <div className="flex-1 max-w-xs">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                  <span>{ar ? 'الأرصدة المتبقية' : 'Credits remaining'}</span>
                  <span className="font-mono text-slate-700">{creditDisp.primary}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${creditsPercent}%`,
                      background: creditsPercent > 30
                        ? 'linear-gradient(90deg, #8b5cf6, #6366f1)'
                        : 'linear-gradient(90deg, #ef4444, #f97316)',
                    }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">{billingDisplay.creditHelper}</p>
                {creditDisp.secondary && (
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">{creditDisp.secondary}</p>
                )}
                {billingStatus.creditBreakdown && (
                  <p className="mt-1 text-[11px] leading-snug text-slate-400">
                    {ar
                      ? `شهري ${billingStatus.creditBreakdown.monthly} · مشتَرى ${billingStatus.creditBreakdown.purchased} · تجريبي ${billingStatus.creditBreakdown.trial}`
                      : `Monthly ${billingStatus.creditBreakdown.monthly} · Purchased ${billingStatus.creditBreakdown.purchased} · Trial ${billingStatus.creditBreakdown.trial}`}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {billingDisplay.showManageSubscription && (
                  <button
                    onClick={handlePortal}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:border-violet-300 hover:text-slate-950 hover:bg-slate-50 text-sm transition-all"
                  >
                    <Settings2 className="w-4 h-4" />
                    {ar ? 'إدارة الاشتراك' : 'Manage subscription'}
                  </button>
                )}
                <button
                  onClick={() => setShowCreditHistory(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:border-violet-300 hover:text-slate-950 hover:bg-slate-50 text-sm transition-all"
                >
                  <History className="w-4 h-4" />
                  {ar ? 'سجل الكريديت' : 'Credit history'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Plan cards ─────────────────────────────────────────────────── */}
        <div>
          <h2 className="text-2xl font-bold text-slate-950 mb-2">
            {ar ? 'باقتان واضحتان، حسب مستوى التشغيل' : 'Two plans, matched to your operating level'}
          </h2>
          <p className="text-sm text-slate-500 mb-8">
            {ar
              ? 'Growth للتخطيط والإنتاج اليومي، وAutopilot للسعة الأكبر والمراقبة المجدولة. أرصدة التجربة ليست باقة ثالثة.'
              : 'Growth covers daily planning and production; Autopilot adds capacity and scheduled monitoring. Trial credits are not a third plan.'
            }
          </p>

          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
            <Gift className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
            <p className="text-sm leading-relaxed text-slate-600">
              {ar
                ? `ابدأ بـ${FREE_TRIAL_CREDITS} رصيداً تجريبياً لمدة 14 يوماً، بدون بطاقة. بعدها اختر واحدة من الباقتين المدفوعتين.`
                : `Start with ${FREE_TRIAL_CREDITS} trial credits for 14 days, with no card. Then choose one of the two paid plans.`}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {PLANS.map((plan) => {
              const isCurrent = currentPlan === plan.id
              const isPopular = plan.featured

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl border p-6 flex flex-col transition-all ${
                    isPopular
                      ? 'border-violet-200 bg-violet-50/60 shadow-[0_16px_42px_rgba(94,92,230,0.10)]'
                      : 'border-slate-200 bg-white hover:border-slate-300 shadow-[0_1px_2px_rgba(15,23,42,0.04)]'
                  }`}
                >
                  {/* Badge */}
                  {(plan.badgeAr || plan.badgeEn) && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="text-xs font-semibold px-3 py-1 rounded-full bg-violet-500 text-white">
                        {ar ? plan.badgeAr : plan.badgeEn}
                      </span>
                    </div>
                  )}

                  {/* Name + price */}
                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-slate-950 mb-1">
                      {ar ? plan.nameAr : plan.nameEn}
                    </h3>
                    <p className="text-xs text-slate-500 mb-3">
                      {ar ? plan.descAr : plan.descEn}
                    </p>
                    <div className="flex items-end gap-1">
                      {plan.price === 0 ? (
                        <span className="text-4xl font-black text-slate-950">
                          {ar ? 'مجاني' : 'Free'}
                        </span>
                      ) : (
                        <>
                          <span className="text-4xl font-black text-slate-950">${plan.price}</span>
                          <span className="text-slate-500 text-sm mb-1">/{ar ? 'شهر' : 'mo'}</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs mt-1" style={{ color: plan.accentColor }}>
                      {ar ? plan.creditsAr : plan.creditsEn}
                    </p>
                  </div>

                  {/* Features */}
                  <ul className="space-y-2 mb-6 flex-1">
                    {(ar ? plan.limitsAr : plan.limitsEn).map((feat) => (
                      <li key={feat} className="flex items-start gap-2 text-sm text-slate-600">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: plan.accentColor }} />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  {isCurrent ? (
                    <div className="w-full py-2.5 rounded-xl text-center text-sm font-semibold border border-slate-200 text-slate-500 bg-slate-50">
                      {ar ? 'خطتك الحالية' : 'Current plan'}
                    </div>
                  ) : plan.price === 0 ? (
                    <Link
                      href="/auth/register"
                      className="w-full py-2.5 rounded-xl text-center text-sm font-semibold border border-slate-200 text-slate-700 hover:border-slate-300 hover:text-slate-950 hover:bg-slate-50 transition-all block"
                    >
                      {ar ? 'ابدأ مجاناً' : 'Get started free'}
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={upgrading === plan.id || (isAuthenticated && !billingEnabled)}
                      className={`w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 ${
                        isPopular
                          ? 'bg-slate-950 hover:bg-slate-800 shadow-[0_12px_28px_rgba(15,23,42,0.16)]'
                          : 'bg-slate-950 hover:bg-slate-800 border border-slate-950'
                      }`}
                    >
                      {upgrading === plan.id
                        ? (ar ? 'جاري التحويل...' : 'Redirecting...')
                        : isAuthenticated && !billingEnabled
                        ? (ar ? 'قريبا' : 'Coming soon')
                        : (ar ? `ابدأ ${plan.nameAr} — $${plan.price}/شهر` : `Start ${plan.nameEn} — $${plan.price}/mo`)
                      }
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── One-time credit wallet ─────────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-600">
                {ar ? 'محفظة الرصيد' : 'Credit wallet'}
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">
                {ar ? 'أضف رصيداً بدون تغيير باقتك' : 'Add credits without changing your plan'}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {ar
                  ? 'الأرصدة المشتراة صالحة 12 شهراً ولا تُمسح عند التجديد أو إلغاء الاشتراك.'
                  : 'Purchased credits remain valid for 12 months and survive renewal or cancellation.'}
              </p>
            </div>
            {!billingStatus?.creditPurchasesEnabled && (
              <span className="w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                {ar ? 'بانتظار تفعيل Stripe والمحفظة' : 'Awaiting Stripe + wallet activation'}
              </span>
            )}
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <label htmlFor="credit-quantity" className="text-sm font-semibold text-slate-800">
                    {ar ? 'عدد الكريدت' : 'Credit amount'}
                  </label>
                  <div className="flex items-center gap-2" dir="ltr">
                    <input
                      id="credit-quantity"
                      type="number"
                      min={CREDIT_PURCHASE_POLICY.minimum}
                      max={CREDIT_PURCHASE_POLICY.maximum}
                      step={CREDIT_PURCHASE_POLICY.step}
                      value={creditQuantity}
                      onChange={(event) => setCreditQuantity(Number(event.target.value))}
                      className="w-28 rounded-xl border border-slate-300 bg-white px-3 py-2 text-right text-lg font-bold tabular-nums text-slate-950 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                    />
                    <span className="text-sm text-slate-500">{ar ? 'رصيد' : 'credits'}</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={CREDIT_PURCHASE_POLICY.minimum}
                  max={CREDIT_PURCHASE_POLICY.maximum}
                  step={CREDIT_PURCHASE_POLICY.step}
                  value={Math.min(CREDIT_PURCHASE_POLICY.maximum, Math.max(CREDIT_PURCHASE_POLICY.minimum, creditQuantity || CREDIT_PURCHASE_POLICY.minimum))}
                  onChange={(event) => setCreditQuantity(Number(event.target.value))}
                  className="mt-4 h-2 w-full cursor-pointer accent-violet-600"
                  aria-label={ar ? 'اختر عدد الكريدت' : 'Choose credit amount'}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {[100, 300, 500, 1000].map((quantity) => (
                    <button
                      key={quantity}
                      type="button"
                      onClick={() => setCreditQuantity(quantity)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${creditQuantity === quantity ? 'border-violet-300 bg-violet-100 text-violet-800' : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200'}`}
                    >
                      {quantity.toLocaleString(ar ? 'ar-EG' : 'en-US')}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-slate-500">
                  {ar
                    ? `الحد من ${CREDIT_PURCHASE_POLICY.minimum} إلى ${CREDIT_PURCHASE_POLICY.maximum.toLocaleString('ar-EG')} بزيادة ${CREDIT_PURCHASE_POLICY.step}. خصم تلقائي تدريجي للكميات الأكبر.`
                    : `${CREDIT_PURCHASE_POLICY.minimum}–${CREDIT_PURCHASE_POLICY.maximum.toLocaleString()} credits in ${CREDIT_PURCHASE_POLICY.step}-credit increments. Progressive volume pricing is applied automatically.`}
                </p>
              </div>

              <div className="min-w-56 rounded-xl border border-violet-200 bg-white p-4">
                {creditPurchaseQuote ? (
                  <>
                    <p className="text-xs text-slate-500">{ar ? 'الإجمالي — دفعة واحدة' : 'Total — one-time'}</p>
                    <p className="mt-1 text-3xl font-black tabular-nums text-slate-950" dir="ltr">
                      ${creditPurchaseQuote.amountUsd.toFixed(2)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {ar
                        ? `${creditPurchaseQuote.effectiveUnitAmountCents}¢ متوسط الكريدت · صالح 12 شهراً`
                        : `${creditPurchaseQuote.effectiveUnitAmountCents}¢ average / credit · valid 12 months`}
                    </p>
                  </>
                ) : (
                  <p className="text-sm font-medium text-rose-600">
                    {ar ? 'أدخل كمية صحيحة بزيادة 10.' : 'Enter a valid 10-credit increment.'}
                  </p>
                )}
                <button
                  onClick={handleBuyCredits}
                  disabled={!billingStatus?.creditPurchasesEnabled || buyingCredits || !creditPurchaseQuote}
                  className="mt-4 w-full rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {buyingCredits ? (ar ? 'جاري التحويل...' : 'Redirecting...') : (ar ? 'المتابعة إلى الدفع' : 'Continue to checkout')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Credit cost breakdown ───────────────────────────────────────── */}
        <div>
          <h2 className="text-xl font-bold text-slate-950 mb-1">
            {ar ? 'كم يكلف كل إجراء؟' : 'Credit cost per action'}
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            {ar
              ? 'قيمة الرصيد الشهري: Growth ≈ $0.33/رصيد · Autopilot ≈ $0.20/رصيد. تكلفة الاستراتيجية متغيرة حسب النطاق.'
              : 'Monthly credit value: Growth ≈ $0.33/cr · Autopilot ≈ $0.20/cr. Strategy cost varies by scope.'
            }
          </p>

          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            {CREDIT_ACTIONS.map((action, i) => {
              const Icon = action.icon
              return (
                <div
                  key={i}
                  className={`flex items-center gap-4 px-5 py-3.5 ${i < CREDIT_ACTIONS.length - 1 ? 'border-b border-slate-100' : ''}`}
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-950">
                      {ar ? action.labelAr : action.labelEn}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {ar ? action.noteAr : action.noteEn}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-bold text-slate-950 tabular-nums">
                      {typeof action.cost === 'number'
                        ? <>{action.cost} <span className="text-slate-500 text-xs font-normal">{ar ? 'رصيد' : 'cr'}</span></>
                        : (ar ? action.costAr : action.costEn)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Growth capacity note */}
          <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-violet-700 mt-0.5 shrink-0" />
              <div className="text-sm text-slate-600 leading-relaxed">
                {ar ? (
                  <>
                    <span className="text-slate-950 font-semibold">Growth (150 رصيد)</span> = حتى 12 مسارًا أساسيًا من الاستراتيجية إلى المسودات (12 رصيدًا لكل مسار) · أو 50 صورة · أو مزيج من الإجراءات. النطاقات الأكبر قد تكلف أكثر —
                     {' '}<span className="text-violet-700">وتناسب فرقًا تحتاج وتيرة نشر أعلى عبر قنوات متعددة</span>
                  </>
                ) : (
                  <>
                    <span className="text-slate-950 font-semibold">Growth (150 credits)</span> = up to 12 core strategy-to-drafts workflows (12 credits each) · or 50 images · or a mix of actions. Larger strategy scopes may cost more —
                     {' '}<span className="text-violet-700">built for teams that need a higher publishing pace across channels</span>
                  </>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* ── FAQ ────────────────────────────────────────────────────────── */}
        <div>
          <h2 className="text-xl font-bold text-slate-950 mb-6">
            {ar ? 'الأسئلة الشائعة' : 'Frequently asked questions'}
          </h2>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div
                key={i}
                className="rounded-xl border border-slate-200 bg-white overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-medium text-slate-950 hover:bg-slate-50 transition-colors"
                >
                  <span>{ar ? faq.qAr : faq.qEn}</span>
                  <span className="text-slate-400 ml-4 shrink-0">{openFaq === i ? '−' : '+'}</span>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-slate-600 leading-relaxed border-t border-slate-100">
                    <p className="pt-3">{ar ? faq.aAr : faq.aEn}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer note ─────────────────────────────────────────────────── */}
        <p className="text-center text-xs text-slate-400 pb-4">
          {billingEnabled
            ? (ar
                ? 'المدفوعات معالجة بأمان عبر Stripe · يمكن الإلغاء في أي وقت · لا رسوم خفية'
                : 'Payments processed securely via Stripe · Cancel anytime · No hidden fees')
            : (ar
                ? 'بنية الدفع والمحفظة جاهزة · يتم فتح الشراء بعد تفعيل إعدادات Stripe'
                : 'Billing and wallet infrastructure is ready · purchasing opens after Stripe configuration')}
        </p>

      </div>

      <CreditHistoryModal
        open={showCreditHistory}
        onClose={() => setShowCreditHistory(false)}
      />
    </AppShell>
  )
}
