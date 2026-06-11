'use client'

/**
 * Billing page — Research-backed 3-tier pricing (updated June 2025)
 * Plans: Free $0 · Starter $19 · Growth $49 · Agency $99
 * Credits: 10 (one-time) · 50/mo · 150/mo · 500/mo
 * Research: HubSpot — 16+ posts/month = 4.5× more leads
 * Starter is deliberately below 16/mo threshold → natural Growth upgrade
 */

import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { useEffect, useState } from 'react'
import AppShell from '@/components/AppShell'
import CreditHistoryModal from '@/components/CreditHistoryModal'
import Link from 'next/link'
import {
  Sparkles, CheckCircle2, Settings2,
  Rocket, Brain, BarChart3, Shield, Globe, Image,
  MessageSquare, FileText, Gift, TrendingUp, Zap, History,
} from 'lucide-react'

// ─── Plan definitions (research-backed June 2025) ─────────────────────────────
//
// Pricing logic:
//   Starter ($19) = 10 posts/mo → BELOW the 16-post lead-gen threshold (by design)
//   Growth  ($49) = 25 posts/mo → CROSSES the 16-post threshold (+4.5× leads)
//   Agency  ($99) = 60 posts/mo → 3-4 clients at 16-20/mo each (optimal agency load)
//
// This creates a real, research-grounded upgrade reason at every tier.

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
    upgradeHintAr: '10 بوستات/شهر = حضور ثابت. للوصول لعتبة الـ16+ بوست التي تولّد 4.5× أضعاف العملاء، جرّب Growth.' as string | null,
    upgradeHintEn: '10 posts/month builds a steady presence. To cross the 16+ posts threshold that generates 4.5× more leads, upgrade to Growth.' as string | null,
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
    descAr: '25 بوست/شهر = يتجاوز عتبة الـ16+ بوست (×4.5 عملاء)',
    descEn: '25 posts/month — crosses the lead-gen threshold',
    upgradeHintAr: null as string | null,
    upgradeHintEn: null as string | null,
    limitsAr: [
      '150 رصيد AI / شهر (يتجدد شهرياً)',
      '3 مساحات عمل (3 براندات)',
      '5 حملات / شهر',
      '25 بوست / شهر — يتجاوز عتبة الـ16+ بوست',
      'جميع المنصات (غير محدود)',
      'Brand Brain الكامل + ذاكرة الحملات',
      'تحميل الميديا + طبقات البراند',
      'اختبار A/B + إعادة كتابة بالـ AI',
      'تحليلات متقدمة + لوحة ROI',
      'تصدير PDF + DOCX',
      'دعم بريد إلكتروني بأولوية',
    ],
    limitsEn: [
      '150 AI credits / month (renews monthly)',
      '3 workspaces (3 brands)',
      '5 campaigns / month',
      '25 AI posts / month — crosses the 16+ lead-gen threshold',
      'All social platforms (unlimited)',
      'Full Brand Brain + Campaign Memory',
      'Media uploads + Brand overlays',
      'A/B Testing + AI Rewrite',
      'Analytics + ROI Dashboard',
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
    descAr: '10 براندات × 16-20 بوست / شهر = أقصى أداء للوكالة',
    descEn: '10 clients × 16-20 posts/month = max agency ROI',
    upgradeHintAr: null as string | null,
    upgradeHintEn: null as string | null,
    limitsAr: [
      '500 رصيد AI / شهر (يتجدد شهرياً)',
      '10 مساحات عمل (10 براندات أو عملاء)',
      'حملات غير محدودة / شهر',
      '60 بوست / شهر',
      'جميع المنصات + نشر متعدد الحسابات',
      'مقعدان للفريق مضمّنان (+$19/إضافي)',
      'تقارير White-label (شعارك)',
      'وصول API',
      'تحليلات متقدمة',
      'دعم مخصص عبر Slack + جلسة اونبوردنج',
    ],
    limitsEn: [
      '500 AI credits / month (renews monthly)',
      '10 workspaces (10 brands / clients)',
      'Unlimited campaigns / month',
      '60 AI posts / month',
      'All platforms + multi-account publishing',
      '2 team seats included (+$19/extra)',
      'White-label reports (your logo)',
      'API access',
      'Advanced analytics',
      'Dedicated Slack support + onboarding call',
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
    aAr: 'هذا مقصود. البحث يُثبت أن 16+ بوست/شهر = 4.5× أضعاف العملاء المحتملين (HubSpot). Starter يُعطيك حضوراً ثابتاً على منصة أو اثنتين — لكن Growth هو الذي يتجاوز هذا الحاجز ويُطلق تأثير الزخم الحقيقي.',
    aEn: 'Intentional. Research proves that 16+ posts/month = 4.5× more leads (HubSpot State of Marketing). Starter gives you a consistent presence on 1-2 platforms — but Growth is what crosses the threshold and unlocks the compounding lead-gen effect.',
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
    aAr: 'Growth = براند واحد يُريد الحصول على أقصى نتائج (25 بوست/شهر عبر 3 مساحات عمل). Agency = 10 عملاء أو براندات مع 60 بوست/شهر — يعني 16-20 بوست/شهر لكل عميل، وهو المعدل الأمثل.',
    aEn: 'Growth = one brand maximizing results (25 posts/month across 3 workspaces). Agency = 10 clients or brands with 60 posts/month — roughly 16-20 posts/month per client, which is the research-optimal level.',
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

  const creditsPercent = monthlyCredits > 0 && monthlyCredits !== -1
    ? Math.min(100, Math.round((currentCredits / monthlyCredits) * 100))
    : monthlyCredits === -1 ? 100 : 0

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-12">

        {/* ── Current plan status ─────────────────────────────────────────── */}
        {!loading && !billingEnabled && (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.07] p-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-100">
                  {ar ? 'وضع البيتا مفعّل' : 'Beta billing mode'}
                </p>
                <p className="text-sm text-amber-100/70 mt-1">
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
          <div className="rounded-2xl border border-violet-400/20 bg-violet-500/[0.07] p-4 text-sm text-violet-100">
            {billingMessage}
          </div>
        )}

        {!loading && billingStatus && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wider mb-1">
                  {ar ? 'خطتك الحالية' : 'Current plan'}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-white">
                    {ar
                      ? PLANS.find(p => p.id === currentPlan)?.nameAr ?? currentPlan
                      : PLANS.find(p => p.id === currentPlan)?.nameEn ?? currentPlan
                    }
                  </span>
                  {currentPlan !== 'free' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                      {ar ? 'نشط' : 'Active'}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-1 max-w-xs">
                <div className="flex items-center justify-between text-xs text-white/50 mb-1.5">
                  <span>{ar ? 'الأرصدة المتبقية' : 'Credits remaining'}</span>
                  <span className="font-mono text-white/70">{currentCredits} / {!billingStatus?.hasActiveSubscription ? `20 ${ar ? '(مرة واحدة)' : '(one-time)'}` : monthlyCredits === -1 ? (ar ? 'غير محدود' : 'unlimited') : `${monthlyCredits}${ar ? '/شهر' : '/mo'}`}</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
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
              </div>

              <div className="flex items-center gap-2">
                {currentPlan !== 'free' && (
                  <button
                    onClick={handlePortal}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-white/70 hover:border-violet-500/40 hover:text-white text-sm transition-all"
                  >
                    <Settings2 className="w-4 h-4" />
                    {ar ? 'إدارة الاشتراك' : 'Manage subscription'}
                  </button>
                )}
                <button
                  onClick={() => setShowCreditHistory(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-white/50 hover:border-violet-500/30 hover:text-white text-sm transition-all"
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
          <h2 className="text-2xl font-bold text-white mb-2">
            {ar ? 'اختر الخطة المناسبة لك' : 'Choose the right plan'}
          </h2>
          <p className="text-sm text-white/50 mb-8">
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
                      ? 'border-violet-500/50 bg-violet-500/5 shadow-[0_0_30px_rgba(139,92,246,0.1)]'
                      : 'border-white/10 bg-white/[0.02] hover:border-white/20'
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
                    <h3 className="text-lg font-bold text-white mb-1">
                      {ar ? plan.nameAr : plan.nameEn}
                    </h3>
                    <p className="text-xs text-white/40 mb-3">
                      {ar ? plan.descAr : plan.descEn}
                    </p>
                    <div className="flex items-end gap-1">
                      {plan.price === 0 ? (
                        <span className="text-4xl font-black text-white">
                          {ar ? 'مجاني' : 'Free'}
                        </span>
                      ) : (
                        <>
                          <span className="text-4xl font-black text-white">${plan.price}</span>
                          <span className="text-white/40 text-sm mb-1">/{ar ? 'شهر' : 'mo'}</span>
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
                      <li key={feat} className="flex items-start gap-2 text-sm text-white/70">
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
                    <div className="w-full py-2.5 rounded-xl text-center text-sm font-semibold border border-white/20 text-white/50">
                      {ar ? 'خطتك الحالية' : 'Current plan'}
                    </div>
                  ) : plan.price === 0 ? (
                    <Link
                      href="/auth/register"
                      className="w-full py-2.5 rounded-xl text-center text-sm font-semibold border border-white/20 text-white/70 hover:border-white/40 hover:text-white transition-all block"
                    >
                      {ar ? 'ابدأ مجاناً' : 'Get started free'}
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={upgrading === plan.id || !billingEnabled}
                      className={`w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 ${
                        isPopular
                          ? 'bg-violet-500 hover:bg-violet-600 shadow-[0_0_20px_rgba(139,92,246,0.3)]'
                          : 'bg-white/10 hover:bg-white/15 border border-white/10'
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
          <h2 className="text-xl font-bold text-white mb-1">
            {ar ? 'كم يكلف كل إجراء؟' : 'Credit cost per action'}
          </h2>
          <p className="text-sm text-white/40 mb-6">
            {ar
              ? 'قيمة الرصيد: Starter = $0.38/رصيد · Growth = $0.33/رصيد · Agency = $0.20/رصيد (توفر أكثر مع الترقية)'
              : 'Credit value: Starter = $0.38/cr · Growth = $0.33/cr · Agency = $0.20/cr (better value as you scale)'
            }
          </p>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
            {CREDIT_ACTIONS.map((action, i) => {
              const Icon = action.icon
              return (
                <div
                  key={i}
                  className={`flex items-center gap-4 px-5 py-3.5 ${i < CREDIT_ACTIONS.length - 1 ? 'border-b border-white/[0.06]' : ''}`}
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-white/50" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">
                      {ar ? action.labelAr : action.labelEn}
                    </p>
                    <p className="text-xs text-white/40 truncate">
                      {ar ? action.noteAr : action.noteEn}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-bold text-white tabular-nums">
                      {action.cost} <span className="text-white/40 text-xs font-normal">{ar ? 'رصيد' : 'cr'}</span>
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Growth capacity note */}
          <div className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
              <div className="text-sm text-white/60 leading-relaxed">
                {ar ? (
                  <>
                    <span className="text-white font-semibold">Growth (150 رصيد)</span> = 30 حملة كاملة · أو 50 صورة · أو 18 استراتيجية كاملة · أو أي مزيج —
                    {' '}<span className="text-violet-400">بالإضافة إلى 25 بوست/شهر تتجاوز عتبة الـ16+ بوست (+4.5× عملاء)</span>
                  </>
                ) : (
                  <>
                    <span className="text-white font-semibold">Growth (150 credits)</span> = 30 campaigns · or 50 images · or 18 full strategies · or any mix —
                    {' '}<span className="text-violet-400">plus 25 posts/month that cross the 16+ post lead-gen threshold (+4.5× leads)</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Referral bonus */}
          <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="flex items-start gap-3">
              <Gift className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <p className="text-sm text-white/60">
                {ar
                  ? <><span className="text-white font-semibold">اربح أرصدة إضافية!</span> ادعُ صديقاً واحصلا معاً على <span className="text-emerald-400 font-semibold">+20 رصيد</span> مجاناً. <Link href="/settings#referral" className="text-emerald-400 underline">احصل على رابط الإحالة →</Link></>
                  : <><span className="text-white font-semibold">Earn free credits!</span> Refer a friend and you both get <span className="text-emerald-400 font-semibold">+20 credits</span> free. <Link href="/settings#referral" className="text-emerald-400 underline">Get your referral link →</Link></>
                }
              </p>
            </div>
          </div>
        </div>

        {/* ── Plan comparison table ───────────────────────────────────────── */}
        <div>
          <h2 className="text-xl font-bold text-white mb-6">
            {ar ? 'مقارنة الخطط' : 'Plan comparison'}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-start pb-3 text-white/40 font-medium w-[30%]">
                    {ar ? 'الميزة' : 'Feature'}
                  </th>
                  <th className="text-center pb-3 text-white/50 font-medium">
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
              <tbody className="divide-y divide-white/[0.05]">
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
                    free: '1', starter: '2', pro: ar ? 'الكل' : 'All', biz: ar ? 'الكل' : 'All',
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
                    free: ar ? 'مجتمعي' : 'Community', starter: ar ? 'إيميل' : 'Email', pro: ar ? 'إيميل أولوية' : 'Priority email', biz: ar ? 'Slack مخصص' : 'Dedicated Slack',
                  },
                ].map(row => (
                  <tr key={ar ? row.labelAr : row.labelEn}>
                    <td className="py-2.5 text-white/60">{ar ? row.labelAr : row.labelEn}</td>
                    <td className="py-2.5 text-center text-white/30">{row.free}</td>
                    <td className="py-2.5 text-center text-blue-300">{row.starter}</td>
                    <td className="py-2.5 text-center text-violet-300 font-medium">{row.pro}</td>
                    <td className="py-2.5 text-center text-emerald-300">{row.biz}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Research footnote */}
          <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
            <TrendingUp className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-sm text-white/60">
              {ar
                ? <><span className="text-amber-300 font-semibold">لماذا 16+ بوست/شهر يُغيّر كل شيء؟</span> بحث HubSpot على 13,000+ شركة: الشركات التي تنشر 16+ بوست/شهر تحصل على <span className="text-amber-300 font-semibold">4.5× أضعاف العملاء المحتملين</span> مقارنة بمن ينشرون أقل من ذلك. خطة Growth تُعطيك 25 بوست/شهر — أول خطة تتجاوز هذا الحاجز.</>
                : <><span className="text-amber-300 font-semibold">Why does 16+ posts/month change everything?</span> HubSpot research across 13,000+ companies: brands publishing 16+ posts/month get <span className="text-amber-300 font-semibold">4.5× more leads</span> than those publishing less. Growth gives you 25 posts/month — the first plan to cross this threshold.</>
              }
            </p>
          </div>
        </div>

        {/* ── FAQ ────────────────────────────────────────────────────────── */}
        <div>
          <h2 className="text-xl font-bold text-white mb-6">
            {ar ? 'الأسئلة الشائعة' : 'Frequently asked questions'}
          </h2>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div
                key={i}
                className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-medium text-white hover:bg-white/5 transition-colors"
                >
                  <span>{ar ? faq.qAr : faq.qEn}</span>
                  <span className="text-white/40 ml-4 shrink-0">{openFaq === i ? '−' : '+'}</span>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-white/50 leading-relaxed border-t border-white/[0.06]">
                    <p className="pt-3">{ar ? faq.aAr : faq.aEn}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer note ─────────────────────────────────────────────────── */}
        <p className="text-center text-xs text-white/25 pb-4">
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
