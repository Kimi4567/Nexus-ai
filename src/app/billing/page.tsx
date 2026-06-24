'use client'

/**
 * Billing page — plan and credits transparency.
 */

import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { useEffect, useState } from 'react'
import AppShell from '@/components/AppShell'
import CreditHistoryModal from '@/components/CreditHistoryModal'
import { formatCreditDisplay } from '@/lib/creditDisplay'
import { getBillingDisplayTruth } from '@/lib/billingDisplayTruth'
import Link from 'next/link'
import {
  Sparkles, CheckCircle2, Settings2,
  Rocket, Brain, BarChart3, Shield, Globe, Image,
  MessageSquare, FileText, Gift, TrendingUp, Zap, History,
} from 'lucide-react'

// ─── Plan definitions ───────────────────────────────────────────────────────────

const PLANS = [
  {
    id: 'free',
    nameAr: 'مجاني',
    nameEn: 'Free',
    price: 0,
    creditsAr: '10 رصيد — مرة واحدة فقط',
    creditsEn: '10 credits — one-time only',
    accentColor: '#6b7280',
    featured: false,
    badgeAr: null as string | null,
    badgeEn: null as string | null,
    descAr: 'جرّب المنصة، لا بطاقة مطلوبة',
    descEn: 'Try the platform — no credit card needed',
    upgradeHintAr: null as string | null,
    upgradeHintEn: null as string | null,
    limitsAr: [
      '10 رصيد AI (مرة واحدة، لا يتجدد)',
      'مساحة عمل واحدة',
      'حملة واحدة كحد أقصى',
      '3 بوستات للتجربة',
      'منصة اجتماعية واحدة',
      'علامة مائية على الصادرات',
      'دعم مجتمعي',
    ],
    limitsEn: [
      '10 AI credits (one-time, never refreshes)',
      '1 workspace',
      '1 campaign maximum',
      '3 posts to try',
      '1 social platform',
      'Watermarked exports',
      'Community support',
    ],
  },
  {
    id: 'starter',
    nameAr: 'ستارتر',
    nameEn: 'Starter',
    price: 19,
    creditsAr: '50 رصيد / شهر — يتجدد تلقائياً',
    creditsEn: '50 credits / month — renews monthly',
    accentColor: '#3b82f6',
    featured: false,
    badgeAr: null as string | null,
    badgeEn: null as string | null,
    descAr: 'ابدأ ببناء حضور منتظم على منصتين',
    descEn: 'Build consistent presence on 1-2 platforms',
    upgradeHintAr: '10 بوستات/شهر مناسبة للبداية. عندما تحتاج وتيرة أعلى، يمكنك الترقية إلى Growth.' as string | null,
    upgradeHintEn: '10 posts/month is ideal to start. Upgrade to Growth when you need a higher publishing pace.' as string | null,
    limitsAr: [
      '50 رصيد AI / شهر (يتجدد شهرياً)',
      'مساحة عمل واحدة (براند واحد)',
      'حملتان / شهر',
      '10 بوستات / شهر',
      'منصتان اجتماعيتان',
      'Brand Brain الكامل + جميع الوكلاء',
      'ذاكرة الحملات (تعلّم من كل حملة)',
      'تصدير بدون علامة مائية',
      'دعم بريد إلكتروني',
    ],
    limitsEn: [
      '50 AI credits / month (renews monthly)',
      '1 workspace (1 brand)',
      '2 campaigns / month',
      '10 AI posts / month',
      '2 social platforms',
      'Full Brand Brain + all AI agents',
      'Campaign Memory (AI learns your brand)',
      'No-watermark exports',
      'Email support',
    ],
  },
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
    descAr: 'للفرق التي تنشر باستمرار عبر أكثر من قناة',
    descEn: 'For teams publishing consistently across channels',
    upgradeHintAr: null as string | null,
    upgradeHintEn: null as string | null,
    limitsAr: [
      '150 رصيد AI / شهر (يتجدد شهرياً)',
      '3 مساحات عمل (3 براندات)',
      '5 حملات / شهر',
      '25 بوست / شهر',
      'المنصات المدعومة حسب إعدادات مساحة العمل',
      'Brand Brain الكامل + ذاكرة الحملات',
      'تحميل الميديا + طبقات البراند',
      'اختبار A/B + إعادة كتابة بالـ AI',
      'تحليلات متقدمة',
      'تصدير PDF + DOCX',
      'دعم بريد إلكتروني بأولوية',
    ],
    limitsEn: [
      '150 AI credits / month (renews monthly)',
      '3 workspaces (3 brands)',
      '5 campaigns / month',
      '25 AI posts / month',
      'Supported social platforms based on workspace setup',
      'Full Brand Brain + Campaign Memory',
      'Media uploads + Brand overlays',
      'A/B Testing + AI Rewrite',
      'Advanced analytics',
      'PDF + DOCX export',
      'Priority email support',
    ],
  },
  {
    id: 'business',
    nameAr: 'وكالة',
    nameEn: 'Agency',
    price: 99,
    creditsAr: '500 رصيد / شهر — يتجدد تلقائياً',
    creditsEn: '500 credits / month — renews monthly',
    accentColor: '#10b981',
    featured: false,
    badgeAr: 'للوكالات',
    badgeEn: 'For agencies',
    descAr: 'للوكالات التي تدير عدة براندات من مكان واحد',
    descEn: 'For agencies managing multiple brands from one workspace',
    upgradeHintAr: null as string | null,
    upgradeHintEn: null as string | null,
    limitsAr: [
      '500 رصيد AI / شهر (يتجدد شهرياً)',
      '10 مساحات عمل (10 براندات أو عملاء)',
      'حملات غير محدودة / شهر',
      '60 بوست / شهر',
      'المنصات المدعومة + نشر متعدد الحسابات حسب الإتاحة',
      'مقعدان للفريق مضمّنان (+$19/إضافي)',
      'تقارير White-label (شعارك)',
      'وصول API (حسب إتاحة البيتا)',
      'تحليلات متقدمة',
      'قنوات دعم أولوية (حسب إتاحة البيتا)',
    ],
    limitsEn: [
      '500 AI credits / month (renews monthly)',
      '10 workspaces (10 brands / clients)',
      'Unlimited campaigns / month',
      '60 AI posts / month',
      'Supported platforms + multi-account publishing as available',
      '2 team seats included (+$19/extra)',
      'White-label reports (your logo)',
      'API access (as available in beta)',
      'Advanced analytics',
      'Priority support channels (as available in beta)',
    ],
  },
]

// ─── Credit cost breakdown ────────────────────────────────────────────────────
// Keep in sync with src/lib/credits.ts → CREDIT_COSTS

const CREDIT_ACTIONS = [
  {
    icon: Rocket,
    labelAr: 'توليد الحملة الكاملة',
    labelEn: 'Full campaign generation',
    cost: 5,
    noteAr: 'استراتيجية + محتوى + خطة تنفيذ',
    noteEn: 'Strategy + content + execution plan',
  },
  {
    icon: Brain,
    labelAr: 'تشغيل الاستراتيجية الكاملة',
    labelEn: 'Run full strategy',
    cost: 8,
    noteAr: 'كل الوكلاء: NEX + VEX + PULSE + SENTINEL',
    noteEn: 'All agents: NEX + VEX + PULSE + SENTINEL',
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
    qAr: 'لماذا Starter أقل من 16 بوست / شهر؟',
    qEn: 'Why is Starter below 16 posts / month?',
    aAr: 'هذا مقصود. Starter مناسب لبداية ثابتة على منصة أو منصتين، وGrowth مناسب عندما تحتاج وتيرة نشر أعلى وتغطية قنوات أوسع.',
    aEn: 'Starter is designed for a steady start on 1-2 platforms. Growth is for teams that need a higher publishing pace and broader channel coverage.',
  },
  {
    qAr: 'هل تتجدد الأرصدة كل شهر؟',
    qEn: 'Do credits renew every month?',
    aAr: 'نعم، لجميع الخطط المدفوعة (Starter وGrowth وAgency). الخطة المجانية تمنحك 10 أرصدة مرة واحدة فقط لا تتجدد — لتجربة المنصة قبل الالتزام.',
    aEn: 'Yes, for all paid plans (Starter, Growth, Agency). The Free plan gives you 10 credits once — they never refresh — so you can experience the platform before committing.',
  },
  {
    qAr: 'ما الفرق بين Growth وAgency؟',
    qEn: 'What is the difference between Growth and Agency?',
    aAr: 'Growth مناسب لبراند واحد يحتاج وتيرة محتوى أسرع. Agency مناسب لفرق تدير عدة عملاء أو براندات من مكان واحد.',
    aEn: 'Growth is built for one brand with a faster content pace. Agency is built for multi-client teams that manage multiple brands from one place.',
  },
  {
    qAr: 'ماذا يحدث إذا نفدت أرصدتي قبل نهاية الشهر؟',
    qEn: 'What happens if I run out of credits?',
    aAr: 'ستتوقف عمليات الـ AI حتى تترقى أو يبدأ شهر جديد. يمكنك دائماً عرض حملاتك وبياناتك الموجودة. ستظهر رسالة واضحة مع رابط ترقية.',
    aEn: 'AI actions pause until you upgrade or your billing cycle renews. You can always view existing campaigns and data. A clear message appears with an upgrade link.',
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
    if (!session?.access_token) return
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

  const currentPlan = billingStatus?.plan?.toLowerCase() || 'free'
  const billingEnabled = billingStatus?.billingEnabled !== false
  const currentCredits = billingStatus?.credits?.remaining ?? 0
  const monthlyCredits = billingStatus?.credits?.max ?? 20

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
            {ar ? 'اختر الخطة المناسبة لك' : 'Choose the right plan'}
          </h2>
          <p className="text-sm text-slate-500 mb-8">
            {ar
              ? 'جميع الخطط المدفوعة تجدد أرصدتها شهرياً. الفيديو بحصة مستقلة لضمان الاستقرار.'
              : 'All paid plans refresh monthly. Video generation has a separate quota for pricing stability.'
            }
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
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

                  {/* Upgrade hint — only for Starter */}
                  {(ar ? plan.upgradeHintAr : plan.upgradeHintEn) && (
                    <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                      <p className="text-xs text-amber-300/80 leading-relaxed flex items-start gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                        {ar ? plan.upgradeHintAr : plan.upgradeHintEn}
                      </p>
                    </div>
                  )}

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
                      disabled={upgrading === plan.id || !billingEnabled}
                      className={`w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 ${
                        isPopular
                          ? 'bg-slate-950 hover:bg-slate-800 shadow-[0_12px_28px_rgba(15,23,42,0.16)]'
                          : 'bg-slate-950 hover:bg-slate-800 border border-slate-950'
                      }`}
                    >
                      {upgrading === plan.id
                        ? (ar ? 'جاري التحويل...' : 'Redirecting...')
                        : !billingEnabled
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

        {/* ── Credit cost breakdown ───────────────────────────────────────── */}
        <div>
          <h2 className="text-xl font-bold text-slate-950 mb-1">
            {ar ? 'كم يكلف كل إجراء؟' : 'Credit cost per action'}
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            {ar
              ? 'قيمة الرصيد: Starter = $0.38/رصيد · Growth = $0.33/رصيد · Agency = $0.20/رصيد (توفر أكثر مع الترقية)'
              : 'Credit value: Starter = $0.38/cr · Growth = $0.33/cr · Agency = $0.20/cr (better value as you scale)'
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
                      {action.cost} <span className="text-slate-500 text-xs font-normal">{ar ? 'رصيد' : 'cr'}</span>
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
                    <span className="text-slate-950 font-semibold">Growth (150 رصيد)</span> = 30 حملة كاملة · أو 50 صورة · أو 18 استراتيجية كاملة · أو أي مزيج —
                     {' '}<span className="text-violet-700">وتناسب فرقًا تحتاج وتيرة نشر أعلى عبر قنوات متعددة</span>
                  </>
                ) : (
                  <>
                    <span className="text-slate-950 font-semibold">Growth (150 credits)</span> = 30 campaigns · or 50 images · or 18 full strategies · or any mix —
                     {' '}<span className="text-violet-700">built for teams that need a higher publishing pace across channels</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Referral bonus */}
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start gap-3">
              <Gift className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
              <p className="text-sm text-slate-600">
                {ar
                  ? <><span className="text-slate-950 font-semibold">اربح أرصدة إضافية!</span> ادعُ صديقاً واحصلا معاً على <span className="text-emerald-700 font-semibold">+20 رصيد</span> مجاناً. <Link href="/settings#referral" className="text-emerald-700 underline">احصل على رابط الإحالة →</Link></>
                  : <><span className="text-slate-950 font-semibold">Earn free credits!</span> Refer a friend and you both get <span className="text-emerald-700 font-semibold">+20 credits</span> free. <Link href="/settings#referral" className="text-emerald-700 underline">Get your referral link →</Link></>
                }
              </p>
            </div>
          </div>
        </div>

        {/* ── Plan comparison table ───────────────────────────────────────── */}
        <div>
          <h2 className="text-xl font-bold text-slate-950 mb-6">
            {ar ? 'مقارنة الخطط' : 'Plan comparison'}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-start pb-3 text-slate-500 font-medium w-[30%]">
                    {ar ? 'الميزة' : 'Feature'}
                  </th>
                  <th className="text-center pb-3 text-slate-500 font-medium">
                    {ar ? 'مجاني' : 'Free'}
                  </th>
                  <th className="text-center pb-3 text-blue-400 font-medium">
                    {ar ? 'ستارتر' : 'Starter'} <span className="text-blue-500/70">$19</span>
                  </th>
                  <th className="text-center pb-3 text-violet-400 font-bold">
                    {ar ? 'جروث' : 'Growth'} <span className="text-violet-500">$49</span>
                    <span className="block text-[10px] text-violet-400/60">{ar ? '★ الأكثر شعبية' : '★ Popular'}</span>
                  </th>
                  <th className="text-center pb-3 text-emerald-400 font-medium">
                    {ar ? 'وكالة' : 'Agency'} <span className="text-emerald-500/80">$99</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  {
                    labelAr: 'أرصدة AI / شهر', labelEn: 'AI credits / month',
                    free: ar ? '10 (مرة واحدة)' : '10 (one-time)',
                    starter: '50', pro: '150', biz: '500',
                  },
                  {
                    labelAr: 'بوستات / شهر', labelEn: 'Posts / month',
                    free: '3', starter: '10', pro: '25', biz: '60',
                  },
                  {
                    labelAr: 'حملات / شهر', labelEn: 'Campaigns / month',
                    free: '1', starter: '2', pro: '5', biz: ar ? 'غير محدود' : 'Unlimited',
                  },
                  {
                    labelAr: 'مساحات العمل', labelEn: 'Workspaces',
                    free: '1', starter: '1', pro: '3', biz: '10',
                  },
                  {
                    labelAr: 'المنصات الاجتماعية', labelEn: 'Social platforms',
                    free: '1', starter: '2', pro: ar ? 'حسب الإتاحة' : 'As available', biz: ar ? 'حسب الإتاحة' : 'As available',
                  },
                  {
                    labelAr: 'Brand Brain + وكلاء AI', labelEn: 'Brand Brain + AI agents',
                    free: ar ? 'أساسي' : 'Basic', starter: ar ? 'كامل' : 'Full', pro: ar ? 'كامل' : 'Full', biz: ar ? 'كامل' : 'Full',
                  },
                  {
                    labelAr: 'ذاكرة الحملات', labelEn: 'Campaign Memory',
                    free: '—', starter: '✓', pro: '✓', biz: '✓',
                  },
                  {
                    labelAr: 'اختبار A/B', labelEn: 'A/B Testing',
                    free: '—', starter: '—', pro: '✓', biz: '✓',
                  },
                  {
                    labelAr: 'تصدير بدون علامة', labelEn: 'No-watermark exports',
                    free: '—', starter: '✓', pro: ar ? 'PDF + DOCX' : 'PDF + DOCX', biz: ar ? 'White-label' : 'White-label',
                  },
                  {
                    labelAr: 'أعضاء الفريق', labelEn: 'Team seats',
                    free: '1', starter: '1', pro: '1', biz: '2+',
                  },
                  {
                    labelAr: 'الدعم', labelEn: 'Support',
                    free: ar ? 'مجتمعي' : 'Community', starter: ar ? 'إيميل' : 'Email', pro: ar ? 'إيميل أولوية' : 'Priority email', biz: ar ? 'قنوات أولوية (حسب الإتاحة)' : 'Priority channels (as available)',
                  },
                ].map(row => (
                  <tr key={ar ? row.labelAr : row.labelEn}>
                    <td className="py-2.5 text-slate-700">{ar ? row.labelAr : row.labelEn}</td>
                    <td className="py-2.5 text-center text-slate-500">{row.free}</td>
                    <td className="py-2.5 text-center text-blue-700">{row.starter}</td>
                    <td className="py-2.5 text-center text-violet-700 font-medium">{row.pro}</td>
                    <td className="py-2.5 text-center text-emerald-700">{row.biz}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Research footnote */}
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
            <TrendingUp className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
            <p className="text-sm text-slate-600">
              {ar
                ? <><span className="text-amber-800 font-semibold">ملاحظة عن وتيرة النشر:</span> زيادة وتيرة المحتوى قد تحسن النتائج، لكن الأداء يختلف حسب السوق وجودة المحتوى والقنوات.</>
                : <><span className="text-amber-800 font-semibold">Publishing pace note:</span> A higher posting cadence can improve outcomes, but results vary by market, channel mix, and content quality.</>
              }
            </p>
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
          {ar
            ? 'المدفوعات معالجة بأمان عبر Stripe · يمكن الإلغاء في أي وقت · لا رسوم خفية'
            : 'Payments processed securely via Stripe · Cancel anytime · No hidden fees'
          }
        </p>

      </div>

      <CreditHistoryModal
        open={showCreditHistory}
        onClose={() => setShowCreditHistory(false)}
      />
    </AppShell>
  )
}
