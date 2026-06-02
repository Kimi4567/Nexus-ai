'use client'

/**
 * Billing page — Sprint AI (professional repricing)
 * Plans: Free $0 · Pro $49 · Business $99
 * Credits: 20 (one-time) · 300/mo · 1,000/mo
 * Video quota: 0 · 5/mo · 20/mo  (separate from credits)
 *
 * Cost model: Pro margins 87–94% per action. Video quota decoupled
 * from credits to protect margins ($0.30–$1.00/video via Replicate).
 */

import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { useEffect, useState } from 'react'
import AppShell from '@/components/AppShell'
import Link from 'next/link'
import {
  Sparkles, Zap, CheckCircle2, Settings2, ArrowUpRight,
  Rocket, Brain, BarChart3, Shield, Globe, Video, Image,
  MessageSquare, FileText, Star, Gift, Users,
} from 'lucide-react'

// ─── Plan definitions ─────────────────────────────────────────────────────────

const PLANS = [
  {
    id: 'free',
    nameAr: 'مجاني',
    nameEn: 'Free',
    price: 0,
    creditsAr: '20 رصيد — مرة واحدة فقط',
    creditsEn: '20 credits — one-time only',
    accentColor: '#6b7280',
    featured: false,
    badgeAr: null as string | null,
    badgeEn: null as string | null,
    descAr: 'للتجربة بدون بطاقة ائتمانية',
    descEn: 'Try it — no credit card needed',
    limitsAr: [
      '20 رصيد AI (مرة واحدة، لا يتجدد)',
      'مساحة عمل واحدة',
      'حملتان كحد أقصى (للأبد)',
      'منصتان اجتماعيتان',
      'لا توليد فيديو',
      'علامة مائية على الصادرات',
      'دعم مجتمعي',
    ],
    limitsEn: [
      '20 AI credits (one-time, never refreshes)',
      '1 workspace',
      '2 campaigns maximum (forever)',
      '2 social platforms',
      'No video generation',
      'Watermarked exports',
      'Community support',
    ],
  },
  {
    id: 'pro',
    nameAr: 'برو',
    nameEn: 'Pro',
    price: 49,
    creditsAr: '300 رصيد / شهر — يتجدد تلقائياً',
    creditsEn: '300 credits / month — renews monthly',
    accentColor: '#8b5cf6',
    featured: true,
    badgeAr: 'الأكثر شعبية',
    badgeEn: 'Most Popular',
    descAr: 'لأصحاب الأعمال والفرق الصغيرة',
    descEn: 'For growing businesses & small teams',
    limitsAr: [
      '300 رصيد AI / شهر (يتجدد شهرياً)',
      '3 مساحات عمل',
      '20 حملة / شهر',
      '100 بوست / شهر',
      'جميع المنصات الـ 5',
      '5 فيديوهات مولّدة / شهر',
      'Brand Brain الكامل + جميع الوكلاء',
      'لوحة تحليلات متقدمة',
      'تصدير بدون علامة مائية',
      'دعم بريد إلكتروني',
    ],
    limitsEn: [
      '300 AI credits / month (renews monthly)',
      '3 workspaces',
      '20 campaigns / month',
      '100 posts / month',
      'All 5 social platforms',
      '5 AI-generated videos / month',
      'Full Brand Brain + all AI agents',
      'Analytics dashboard',
      'No-watermark exports (PDF + DOCX)',
      'Email support',
    ],
  },
  {
    id: 'business',
    nameAr: 'بيزنس',
    nameEn: 'Business',
    price: 99,
    creditsAr: '1,000 رصيد / شهر — يتجدد تلقائياً',
    creditsEn: '1,000 credits / month — renews monthly',
    accentColor: '#10b981',
    featured: false,
    badgeAr: 'للوكالات والفرق',
    badgeEn: 'For agencies & teams',
    descAr: 'للوكالات والفرق الكبيرة',
    descEn: 'For agencies and larger teams',
    limitsAr: [
      '1,000 رصيد AI / شهر (يتجدد شهرياً)',
      '10 مساحات عمل',
      '60 حملة / شهر',
      'بوستات غير محدودة',
      'جميع المنصات الـ 5',
      '20 فيديو مولّد / شهر',
      '3 مقاعد لأعضاء الفريق',
      'تصدير بدون علامة مائية (White-label)',
      'تحليلات متقدمة + API',
      'دعم ذو أولوية',
    ],
    limitsEn: [
      '1,000 AI credits / month (renews monthly)',
      '10 workspaces',
      '60 campaigns / month',
      'Unlimited posts',
      'All 5 social platforms',
      '20 AI-generated videos / month',
      'Team collaboration (3 seats)',
      'White-label PDF/DOCX exports',
      'Advanced analytics + API access',
      'Priority support',
    ],
  },
]

// ─── Credit cost breakdown ────────────────────────────────────────────────────
// Maps each AI action to credits consumed + icon + description.
// Keep in sync with src/lib/credits.ts → CREDIT_COSTS

const CREDIT_ACTIONS = [
  {
    icon: Rocket,
    labelAr: 'توليد الحملة الكاملة',
    labelEn: 'Full campaign generation',
    cost: 5,
    noteAr: 'استراتيجية + محتوى + خطة',
    noteEn: 'Strategy + content + plan',
  },
  {
    icon: Brain,
    labelAr: 'تشغيل الاستراتيجية الكاملة',
    labelEn: 'Run full strategy',
    cost: 8,
    noteAr: 'كل الوكلاء معاً: استراتيجي + بصري + سنتنيل',
    noteEn: 'All agents: Strategist + Visual + Sentinel',
  },
  {
    icon: Image,
    labelAr: 'توليد صورة (DALL-E 3)',
    labelEn: 'AI image generation (DALL-E 3)',
    cost: 3,
    noteAr: '1024×1024، بجودة عالية، مرتبطة بهوية البراند',
    noteEn: '1024×1024, brand-aware, high quality',
  },
  {
    icon: Video,
    labelAr: 'موجز الفيديو (Video Brief)',
    labelEn: 'Video brief generation',
    cost: 3,
    noteAr: 'سيناريو + ستوري بورد + توجيه بصري',
    noteEn: 'Script + storyboard + visual direction',
  },
  {
    icon: FileText,
    labelAr: 'موجز الإبداع (Creative Brief)',
    labelEn: 'Creative brief',
    cost: 3,
    noteAr: 'تحليل الأصول + توجيه بصري لحملتك',
    noteEn: 'Asset analysis + visual direction',
  },
  {
    icon: Globe,
    labelAr: 'نسخ إعلانية (Ad Copy)',
    labelEn: 'Ad copy generation',
    cost: 2,
    noteAr: 'عناوين + CTA + أوصاف مخصصة',
    noteEn: 'Headlines + CTAs + descriptions',
  },
  {
    icon: Shield,
    labelAr: 'مراجعة سنتنيل',
    labelEn: 'Sentinel quality review',
    cost: 2,
    noteAr: 'مراجعة الجودة والمخاطر قبل النشر',
    noteEn: 'Quality + risk gate before publishing',
  },
  {
    icon: MessageSquare,
    labelAr: 'رسالة دردشة AI',
    labelEn: 'AI chat message',
    cost: 1,
    noteAr: 'مساعد ذكي لأسئلتك التسويقية',
    noteEn: 'Marketing assistant chat',
  },
  {
    icon: Video,
    labelAr: 'توليد فيديو (Replicate)',
    labelEn: 'AI video generation (Replicate)',
    cost: 0,
    quotaAr: 'من حصة الفيديو الشهرية',
    quotaEn: 'From monthly video quota',
    noteAr: 'فيديو 5-30 ثانية بجودة إنتاجية عالية',
    noteEn: '5–30 second production-quality video',
  },
]

// ─── FAQ ──────────────────────────────────────────────────────────────────────

const FAQS = [
  {
    qAr: 'ما الفرق بين الأرصدة وحصة الفيديو؟',
    qEn: 'What is the difference between credits and video quota?',
    aAr: 'الأرصدة تُستهلك لتوليد النصوص والصور والاستراتيجيات. أما توليد الفيديو فله حصة شهرية مستقلة (5 فيديوهات للبرو، 20 للبيزنس) لأن تكلفة الفيديو تتراوح بين $0.30 و$1.00 للفيديو عبر Replicate — فصلها يضمن أن الأسعار تبقى ثابتة ومعقولة.',
    aEn: 'Credits are consumed for text, image, and strategy generation. Video generation has a separate monthly quota (5 for Pro, 20 for Business) because each video costs $0.30–$1.00 via Replicate. Keeping it separate ensures pricing stays predictable and fair.',
  },
  {
    qAr: 'هل تتجدد الأرصدة كل شهر؟',
    qEn: 'Do credits renew every month?',
    aAr: 'نعم، للمشتركين في برو وبيزنس. الخطة المجانية تمنحك 20 رصيداً مرة واحدة فقط لا تتجدد. هذا يشجعك على تجربة المنصة قبل الاشتراك.',
    aEn: 'Yes, for Pro and Business subscribers. The Free plan gives you 20 credits once — they never refresh. This lets you experience the platform before committing.',
  },
  {
    qAr: 'ماذا يحدث إذا نفدت أرصدتي قبل نهاية الشهر؟',
    qEn: 'What happens if I run out of credits before month-end?',
    aAr: 'ستتوقف عمليات الـ AI حتى تترقى خطتك أو حتى يبدأ شهر جديد. يمكنك دائماً عرض الحملات والبيانات الموجودة. رسالة واضحة ستظهر مع رابط ترقية.',
    aEn: 'AI actions will pause until you upgrade or the next billing cycle begins. You can always view existing campaigns and data. A clear message appears with an upgrade link.',
  },
  {
    qAr: 'هل يمكنني إلغاء اشتراكي في أي وقت؟',
    qEn: 'Can I cancel anytime?',
    aAr: 'نعم، يمكنك الإلغاء في أي وقت من إعدادات الفوترة. ستبقى مشتركاً حتى نهاية فترة الفوترة الحالية.',
    aEn: 'Yes, cancel anytime from your billing settings. You retain access until the end of the current billing period.',
  },
  {
    qAr: 'كيف يعمل نظام الإحالة؟',
    qEn: 'How does the referral program work?',
    aAr: 'ادعُ صديقاً بالرابط الخاص بك — كلاكما يحصل على +20 رصيداً مجاناً عند إتمام الصديق الإعداد. ابحث عن رابطك في الإعدادات > ادعُ أصدقاء.',
    aEn: 'Invite a friend with your unique link — you both get +20 free credits when they complete onboarding. Find your link in Settings → Refer & Earn.',
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
    credits: number
    status: string
    monthlyCredits: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

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
  const currentCredits = billingStatus?.credits ?? 0
  const monthlyCredits = billingStatus?.monthlyCredits ?? 20

  const creditsPercent = monthlyCredits > 0
    ? Math.min(100, Math.round((currentCredits / monthlyCredits) * 100))
    : 0

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-12">

        {/* ── Current plan status ─────────────────────────────────────────── */}
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
                  <span className="font-mono text-white/70">{currentCredits} / {monthlyCredits === 20 ? `20 ${ar ? '(مرة واحدة)' : '(one-time)'}` : `${monthlyCredits}${ar ? '/شهر' : '/mo'}`}</span>
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

              {currentPlan !== 'free' && (
                <button
                  onClick={handlePortal}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-white/70 hover:border-violet-500/40 hover:text-white text-sm transition-all"
                >
                  <Settings2 className="w-4 h-4" />
                  {ar ? 'إدارة الاشتراك' : 'Manage subscription'}
                </button>
              )}
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                      disabled={upgrading === plan.id}
                      className={`w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 ${
                        isPopular
                          ? 'bg-violet-500 hover:bg-violet-600 shadow-[0_0_20px_rgba(139,92,246,0.3)]'
                          : 'bg-white/10 hover:bg-white/15 border border-white/10'
                      }`}
                    >
                      {upgrading === plan.id
                        ? (ar ? 'جاري التحويل...' : 'Redirecting...')
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
              ? 'قيمة الرصيد في برو: $49 ÷ 300 = $0.163 / رصيد'
              : 'Credit value at Pro: $49 ÷ 300 = $0.163 / credit'
            }
          </p>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
            {CREDIT_ACTIONS.map((action, i) => {
              const Icon = action.icon
              const isVideo = action.cost === 0
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
                    {isVideo ? (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 font-medium">
                        {ar ? action.quotaAr : action.quotaEn}
                      </span>
                    ) : (
                      <span className="text-sm font-bold text-white tabular-nums">
                        {action.cost} <span className="text-white/40 text-xs font-normal">{ar ? 'رصيد' : 'cr'}</span>
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pro capacity note */}
          <div className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
              <div className="text-sm text-white/60 leading-relaxed">
                {ar ? (
                  <>
                    <span className="text-white font-semibold">برو (300 رصيد)</span> = 60 حملة كاملة · أو 100 صورة · أو 37 استراتيجية كاملة · أو أي مزيج منها —
                    {' '}<span className="text-violet-400">بالإضافة إلى 5 فيديوهات مولّدة / شهر (مستقلة عن الأرصدة)</span>
                  </>
                ) : (
                  <>
                    <span className="text-white font-semibold">Pro (300 credits)</span> = 60 campaigns · or 100 images · or 37 full strategies · or any mix —
                    {' '}<span className="text-violet-400">plus 5 AI-generated videos / month (separate from credits)</span>
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
                  <th className="text-start pb-3 text-white/40 font-medium w-1/2">
                    {ar ? 'الميزة' : 'Feature'}
                  </th>
                  <th className="text-center pb-3 text-white/60 font-medium">
                    {ar ? 'مجاني' : 'Free'}
                  </th>
                  <th className="text-center pb-3 text-violet-400 font-bold">
                    {ar ? 'برو' : 'Pro'} <span className="text-violet-500">$49</span>
                  </th>
                  <th className="text-center pb-3 text-emerald-400 font-medium">
                    {ar ? 'بيزنس' : 'Business'} <span className="text-emerald-500/80">$99</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {[
                  {
                    labelAr: 'أرصدة AI / شهر', labelEn: 'AI credits / month',
                    free: ar ? '20 (مرة واحدة)' : '20 (one-time)',
                    pro: '300',
                    biz: '1,000',
                  },
                  {
                    labelAr: 'مساحات العمل', labelEn: 'Workspaces',
                    free: '1', pro: '3', biz: '10',
                  },
                  {
                    labelAr: 'حملات / شهر', labelEn: 'Campaigns / month',
                    free: '2 total', pro: '20', biz: '60',
                  },
                  {
                    labelAr: 'بوستات / شهر', labelEn: 'Posts / month',
                    free: '10 total', pro: '100', biz: ar ? 'غير محدود' : 'Unlimited',
                  },
                  {
                    labelAr: 'المنصات الاجتماعية', labelEn: 'Social platforms',
                    free: '2', pro: ar ? 'الكل (5)' : 'All (5)', biz: ar ? 'الكل (5)' : 'All (5)',
                  },
                  {
                    labelAr: 'فيديوهات مولّدة / شهر', labelEn: 'AI videos / month',
                    free: '0', pro: '5', biz: '20',
                  },
                  {
                    labelAr: 'Brand Brain + وكلاء AI', labelEn: 'Brand Brain + AI agents',
                    free: ar ? 'أساسي' : 'Basic', pro: ar ? 'كامل' : 'Full', biz: ar ? 'كامل' : 'Full',
                  },
                  {
                    labelAr: 'تصدير PDF + DOCX', labelEn: 'PDF + DOCX export',
                    free: ar ? 'علامة مائية' : 'Watermarked', pro: ar ? 'بدون علامة' : 'No watermark', biz: ar ? 'White-label' : 'White-label',
                  },
                  {
                    labelAr: 'أعضاء الفريق', labelEn: 'Team seats',
                    free: '1', pro: '1', biz: '3',
                  },
                  {
                    labelAr: 'الدعم', labelEn: 'Support',
                    free: ar ? 'مجتمعي' : 'Community', pro: ar ? 'بريد إلكتروني' : 'Email', biz: ar ? 'أولوية' : 'Priority',
                  },
                ].map(row => (
                  <tr key={ar ? row.labelAr : row.labelEn}>
                    <td className="py-2.5 text-white/60">{ar ? row.labelAr : row.labelEn}</td>
                    <td className="py-2.5 text-center text-white/40">{row.free}</td>
                    <td className="py-2.5 text-center text-violet-300 font-medium">{row.pro}</td>
                    <td className="py-2.5 text-center text-emerald-300">{row.biz}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
    </AppShell>
  )
}
