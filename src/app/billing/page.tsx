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
import { CREDIT_ACTION_COSTS } from '@/lib/creditActionTruth'
import {
  CURRENT_CREDIT_PRICING_EFFECTIVE_DATE,
  CURRENT_CREDIT_PRICING_VERSION,
} from '@/lib/credits/pricing'
import {
  getStrategyToDraftsJourneyCost,
  STRATEGY_PRICING_DISPLAY_TRUTH,
} from '@/lib/strategy/strategyPricingDisplayTruth'
import {
  CREDIT_PURCHASE_POLICY,
  FREE_TRIAL_CREDITS,
  PUBLIC_PAID_PLANS,
  quoteCreditPurchase,
} from '@/lib/commercialPlans'
import Link from 'next/link'
import {
  Sparkles, CheckCircle2, Settings2,
  Rocket, Brain, Shield, Globe, Image, Video,
  MessageSquare, FileText, Gift, Zap, History,
} from 'lucide-react'

// ─── Plan definitions ───────────────────────────────────────────────────────────

const GROWTH_PLAN = PUBLIC_PAID_PLANS.find((plan) => plan.slug === 'growth') ?? PUBLIC_PAID_PLANS[0]
const AUTOPILOT_PLAN = PUBLIC_PAID_PLANS.find((plan) => plan.slug === 'autopilot') ?? PUBLIC_PAID_PLANS[1]
const FULL_STANDARD_90_WORKFLOW_COST = getStrategyToDraftsJourneyCost(
  STRATEGY_PRICING_DISPLAY_TRUTH.fullStandard90.cost,
  CREDIT_ACTION_COSTS.SENTINEL_REVIEW,
  CREDIT_ACTION_COSTS.CONTENT_PLAN_GENERATION,
)
const TRIAL_STRATEGY_REVIEW_COST =
  STRATEGY_PRICING_DISPLAY_TRUTH.trialActivation.cost
  + CREDIT_ACTION_COSTS.SENTINEL_REVIEW

const PLANS = [
  {
    id: GROWTH_PLAN.id,
    nameAr: 'جروث',
    nameEn: GROWTH_PLAN.name,
    price: GROWTH_PLAN.priceUsd,
    creditsAr: `${GROWTH_PLAN.monthlyCredits} رصيد / شهر — يتجدد تلقائياً`,
    creditsEn: `${GROWTH_PLAN.monthlyCredits} credits / month — renews monthly`,
    accentColor: '#8b5cf6',
    featured: true,
    badgeAr: 'الخطة الأساسية',
    badgeEn: 'Core plan',
    descAr: 'للفرق التي تخطط وتنتج وتراجع المحتوى باستمرار',
    descEn: 'For teams planning, producing, and reviewing content consistently',
    limitsAr: [
      `${GROWTH_PLAN.monthlyCredits} رصيد AI / شهر (يتجدد شهرياً)`,
      'موافقات منفصلة للنص والوسائط والجدولة',
      `حتى ${GROWTH_PLAN.campaignLimit} مساحات حملات / شهر — عمليات AI تُحاسب بالكريديت`,
      `حتى ${GROWTH_PLAN.postsPerMonth} مسودة نص AI مخططة / شهر — الصور والفيديو منفصلة`,
      `مثال سعة: رحلة Full Standard واحدة إلى المسودات (${FULL_STANDARD_90_WORKFLOW_COST} كريديت) أو 4 استراتيجيات Organic Light مراجعة`,
      'Brand Brain الكامل + ذاكرة الحملات',
    ],
    limitsEn: [
      `${GROWTH_PLAN.monthlyCredits} AI credits / month (renews monthly)`,
      'Separate copy, media, and scheduling approvals',
      `Up to ${GROWTH_PLAN.campaignLimit} campaign workspaces / month — AI operations use credits`,
      `Up to ${GROWTH_PLAN.postsPerMonth} AI-planned copy drafts / month — image and video actions are separate`,
      `Capacity example: 1 Full Standard workflow to drafts (${FULL_STANDARD_90_WORKFLOW_COST} credits) or 4 reviewed Organic Light strategies`,
      'Full Brand Brain + Campaign Memory (reviewed signals across campaigns)',
    ],
  },
  {
    id: AUTOPILOT_PLAN.id,
    nameAr: 'أوتوبايلوت',
    nameEn: AUTOPILOT_PLAN.name,
    price: AUTOPILOT_PLAN.priceUsd,
    creditsAr: `${AUTOPILOT_PLAN.monthlyCredits} رصيد / شهر — يتجدد تلقائياً`,
    creditsEn: `${AUTOPILOT_PLAN.monthlyCredits} credits / month — renews monthly`,
    accentColor: '#10b981',
    featured: false,
    badgeAr: 'تشغيل متقدم',
    badgeEn: 'Advanced operations',
    descAr: 'لسعة أكبر مع مراقبة مجدولة وقائمة قرارات تشغيلية',
    descEn: 'For higher capacity with scheduled monitoring and an operating action queue',
    limitsAr: [
      `${AUTOPILOT_PLAN.monthlyCredits} رصيد AI / شهر (يتجدد شهرياً)`,
      'مركز عمليات ومراقبة مجدولة للحالات والأعطال',
      `حتى ${AUTOPILOT_PLAN.campaignLimit} مساحة حملة / شهر — عمليات AI تُحاسب بالكريديت`,
      `حتى ${AUTOPILOT_PLAN.postsPerMonth} مسودة نص AI مخططة / شهر — الصور والفيديو منفصلة`,
      `مثال سعة: 3 رحلات Full Standard إلى المسودات أو 12 استراتيجية Organic Light مراجعة`,
      'مراقبة مجدولة + قائمة قرارات مبنية على الأدلة',
    ],
    limitsEn: [
      `${AUTOPILOT_PLAN.monthlyCredits} AI credits / month (renews monthly)`,
      'Operations center with scheduled state and incident monitoring',
      `Up to ${AUTOPILOT_PLAN.campaignLimit} campaign workspaces / month — AI operations use credits`,
      `Up to ${AUTOPILOT_PLAN.postsPerMonth} AI-planned copy drafts / month — image and video actions are separate`,
      'Capacity example: 3 Full Standard workflows to drafts or 12 reviewed Organic Light strategies',
      'Scheduled monitoring + evidence-backed action queue',
    ],
  },
]

// ─── Credit cost breakdown ────────────────────────────────────────────────────

const CREDIT_ACTIONS = [
  {
    icon: Rocket,
    labelAr: 'مثال: Full Standard لمدة 90 يومًا إلى المسودات',
    labelEn: 'Example: Full Standard 90-day strategy to drafts',
    cost: FULL_STANDARD_90_WORKFLOW_COST,
    noteAr: `${STRATEGY_PRICING_DISPLAY_TRUTH.fullStandard90.cost} للاستراتيجية + ${CREDIT_ACTION_COSTS.SENTINEL_REVIEW} لفحص الجودة + ${CREDIT_ACTION_COSTS.CONTENT_PLAN_GENERATION} لخطة المحتوى. الصور منفصلة.`,
    noteEn: `${STRATEGY_PRICING_DISPLAY_TRUTH.fullStandard90.cost} strategy + ${CREDIT_ACTION_COSTS.SENTINEL_REVIEW} quality review + ${CREDIT_ACTION_COSTS.CONTENT_PLAN_GENERATION} content plan. Images are separate.`,
  },
  {
    icon: Brain,
    labelAr: 'إنشاء الاستراتيجية',
    labelEn: 'Strategy generation',
    cost: null,
    costAr: 'متغير',
    costEn: 'Varies',
    noteAr: `${STRATEGY_PRICING_DISPLAY_TRUTH.range.minimum}–${STRATEGY_PRICING_DISPLAY_TRUTH.range.maximum} كريديت حسب النطاق والمدة والكثافة؛ يظهر السعر النهائي قبل التنفيذ.`,
    noteEn: `${STRATEGY_PRICING_DISPLAY_TRUTH.range.minimum}–${STRATEGY_PRICING_DISPLAY_TRUTH.range.maximum} credits by scope, duration, and intensity; the exact quote appears before execution.`,
  },
  {
    icon: Image,
    labelAr: 'توليد صورة AI',
    labelEn: 'AI image generation',
    cost: CREDIT_ACTION_COSTS.IMAGE_GENERATION,
    noteAr: 'NEXUS Image Studio بجودة نهائية، مع هوية البراند ونص عربي/إنجليزي للمراجعة',
    noteEn: 'Final-quality NEXUS Image Studio creative with brand identity and reviewed Arabic/English copy',
  },
  {
    icon: Video,
    labelAr: 'Motion Design من فيديو حقيقي — 6 ثوانٍ',
    labelEn: 'Source-locked Motion Design — 6 seconds',
    cost: CREDIT_ACTION_COSTS.MOTION_DESIGN_VIDEO,
    noteAr: 'يحافظ على فيديو الواجهة أو الـDemo كما هو؛ لا يستخدم مزود فيديو توليدي، مع فحص 5 لقطات قبل الربط',
    noteEn: 'Preserves the supplied screen/demo video; no generative-video provider, with five-frame QA before attachment',
  },
  {
    icon: Video,
    labelAr: 'فيديو إعلاني احترافي — 8–10 ثوانٍ',
    labelEn: 'Professional video ad — 8–10 seconds',
    cost: CREDIT_ACTION_COSTS.VIDEO_GENERATION,
    noteAr: 'فيلم حملة من 3 لقطات أو إعلان يحافظ على المنتج؛ محاولة مزود واحدة، حفظ دائم، وإخراج وفحص قبل الربط',
    noteEn: 'A three-shot campaign film or product-fidelity ad; one provider attempt, durable storage, branded finishing, and QA before attachment',
  },
  {
    icon: FileText,
    labelAr: 'موجز الإبداع (Creative Brief)',
    labelEn: 'Creative brief',
    cost: CREDIT_ACTION_COSTS.CREATIVE_BRIEF,
    noteAr: 'تحليل الأصول + توجيه بصري للحملة',
    noteEn: 'Asset analysis + visual direction for campaign',
  },
  {
    icon: Sparkles,
    labelAr: 'تحليل ومطابقة وسائط الحملة',
    labelEn: 'Campaign media intelligence',
    cost: CREDIT_ACTION_COSTS.MEDIA_INTELLIGENCE_ANALYSIS,
    noteAr: 'تحليل مرئي حتى 8 أصول وترتيب أفضل تطابق لكل بوست؛ لا يرفق أو ينشر شيئًا تلقائيًا',
    noteEn: 'Visual analysis for up to 8 assets and ranked post matching; nothing is attached or published automatically',
  },
  {
    icon: Globe,
    labelAr: 'نسخ إعلانية (Ad Copy)',
    labelEn: 'Ad copy generation',
    cost: CREDIT_ACTION_COSTS.AD_COPY,
    noteAr: 'عناوين + CTA + أوصاف مخصصة للبراند',
    noteEn: 'Headlines + CTAs + brand-specific descriptions',
  },
  {
    icon: Shield,
    labelAr: 'مراجعة سنتنيل',
    labelEn: 'Sentinel quality review',
    cost: CREDIT_ACTION_COSTS.SENTINEL_REVIEW,
    noteAr: 'مراجعة الجودة والمخاطر قبل النشر',
    noteEn: 'Quality + risk review before publishing',
  },
  {
    icon: Zap,
    labelAr: 'إعادة كتابة بوست AI',
    labelEn: 'AI post rewrite',
    cost: CREDIT_ACTION_COSTS.AI_POST_REWRITE,
    noteAr: 'حسّن أي بوست بنقرة واحدة',
    noteEn: 'Improve any post with one click',
  },
  {
    icon: MessageSquare,
    labelAr: 'رسالة دردشة AI',
    labelEn: 'AI chat message',
    cost: CREDIT_ACTION_COSTS.CHAT_MESSAGE,
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
    aAr: 'بعد تفعيل الإطلاق التجاري والاشتراك المدفوع: تتجدد أرصدة Growth وAutopilot كل دورة شهرية. أرصدة التجربة لا تتجدد، والأرصدة الإضافية المشتراة صالحة لمدة 12 شهراً.',
    aEn: 'After commercial launch and activation of a paid subscription, Growth and Autopilot credits renew each monthly cycle. Trial credits do not renew; purchased credits remain valid for 12 months.',
  },
  {
    qAr: 'ما الفرق بين Growth وAutopilot؟',
    qEn: 'What is the difference between Growth and Autopilot?',
    aAr: 'Growth مناسب للتخطيط وإنتاج مسودات النصوص ومراجعتها؛ إنتاج الصور والفيديو يُحاسب كعمليات منفصلة. Autopilot يضيف سعة أكبر ومراقبة مجدولة وقائمة قرارات تشغيلية.',
    aEn: 'Growth covers planning plus copy-draft production and review; image and video production are metered separately. Autopilot adds more capacity, scheduled monitoring, and an operating action queue.',
  },
  {
    qAr: 'هل عدد الحملات يعني أن كل حملة Full مشمولة مجانًا؟',
    qEn: 'Does the campaign limit include that many Full workflows for free?',
    aAr: `لا. حد الحملات هو عدد مساحات العمل التي يمكن إنشاؤها شهريًا، بينما التوليد والمراجعة والمحتوى تُخصم بالكريديت حسب السعر الظاهر قبل التنفيذ. Growth يكفي مثلًا لرحلة Full Standard واحدة إلى المسودات (${FULL_STANDARD_90_WORKFLOW_COST} كريديت) أو 4 استراتيجيات Organic Light مراجعة.`,
    aEn: `No. The campaign limit is the number of campaign workspaces you can create each month. Generation, review, and content use credits at the quote shown before execution. Growth covers, for example, one Full Standard workflow to drafts (${FULL_STANDARD_90_WORKFLOW_COST} credits) or four reviewed Organic Light strategies.`,
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
    aAr: 'بعد تفعيل الإطلاق التجاري والفوترة الحقيقية، يمكنك الإلغاء من إعدادات الفوترة. ستبقى مشتركاً حتى نهاية دورة الفوترة الحالية.',
    aEn: 'After commercial launch and live billing are enabled, you can cancel from billing settings and retain access until the end of the current billing period.',
  },
  {
    qAr: 'كيف يعمل نظام الإحالة؟',
    qEn: 'How does the referral program work?',
    aAr: 'ادعُ صديقاً بالرابط الخاص بك — كلاكما يحصل على +5 أرصدة مجانية عند إتمام الصديق الإعداد.',
    aEn: 'Invite a friend with your unique link — you both get +5 free credits when they complete onboarding.',
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
    billingMode?: 'disabled' | 'sandbox' | 'live'
    creditPurchasesEnabled?: boolean
    creditPurchasesStatus?:
      | 'ready'
      | 'wallet_disabled'
      | 'billing_disabled'
      | 'migration_required'
      | 'price_ids_missing'
      | 'price_version_mismatch'
      | 'verification_failed'
    creditBreakdown?: {
      monthly: number
      purchased: number
      trial: number
      referral: number
      refund: number
      manual: number
      migrated: number
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
  const [creditQuantity, setCreditQuantity] = useState(50)
  const [buyingCredits, setBuyingCredits] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [billingMessage, setBillingMessage] = useState<string | null>(null)
  const [creditCheckoutErrorCode, setCreditCheckoutErrorCode] = useState<string | null>(null)
  const [showCreditHistory, setShowCreditHistory] = useState(false)

  useEffect(() => {
    const token = session?.access_token
    if (!token) {
      setBillingStatus(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setBillingStatus(null)
    setLoading(true)
    fetch('/api/billing/status', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => {
        if (!cancelled && d.plan) setBillingStatus(d)
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [session?.access_token])

  useEffect(() => {
    const token = session?.access_token
    if (!token || typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    const creditCheckoutResult = params.get('credits')
    const subscriptionSucceeded = params.get('success') === '1'
    const subscriptionCancelled = params.get('cancelled') === '1'
    const creditSucceeded = creditCheckoutResult === 'success'
    const creditCancelled = creditCheckoutResult === 'cancelled'
    if (!subscriptionSucceeded && !subscriptionCancelled && !creditSucceeded && !creditCancelled) return

    const succeeded = subscriptionSucceeded || creditSucceeded

    setBillingMessage(
      succeeded
        ? subscriptionSucceeded
          ? ar
            ? 'اكتمل الدفع في Stripe. تتم الآن مزامنة حالة الاشتراك والكريديت من الحدث الموقّع.'
            : 'Stripe checkout completed. Subscription and credits are now syncing from the signed webhook.'
          : ar
            ? 'تم الدفع في Stripe بنجاح. تتم مزامنة رصيدك الآن.'
            : 'Stripe payment succeeded. Your wallet is syncing now.'
        : ar
          ? 'تم إلغاء الدفع ولم يتم خصم أي مبلغ أو إضافة رصيد.'
          : 'Checkout was cancelled. No payment was taken and no credits were added.',
    )
    window.history.replaceState({}, '', window.location.pathname)

    if (!succeeded) return

    let cancelled = false
    const refreshStatus = async () => {
      try {
        const response = await fetch('/api/billing/status', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        const data = await response.json()
        if (!cancelled && data.plan) setBillingStatus(data)
      } catch (error) {
        console.error(error)
      }
    }
    const timers = [0, 1_000, 2_500, 5_000].map((delay) =>
      window.setTimeout(refreshStatus, delay),
    )
    return () => {
      cancelled = true
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [session?.access_token, ar])

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
      const requestId = globalThis.crypto?.randomUUID?.()
        ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const r = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan: planId, requestId }),
      })
      const data = await r.json()
      if (data.url) window.location.href = data.url
      else if (data.code === 'MANAGE_EXISTING_SUBSCRIPTION') await handlePortal()
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
        ? `اختر كمية صحيحة بين ${CREDIT_PURCHASE_POLICY.minimum} و${CREDIT_PURCHASE_POLICY.maximum} رصيد، بزيادة ${CREDIT_PURCHASE_POLICY.step} أرصدة.`
        : `Choose a valid quantity from ${CREDIT_PURCHASE_POLICY.minimum} to ${CREDIT_PURCHASE_POLICY.maximum} credits in increments of ${CREDIT_PURCHASE_POLICY.step}.`)
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
      else {
        setCreditCheckoutErrorCode(typeof data.code === 'string' ? data.code : 'CHECKOUT_UNAVAILABLE')
        setBillingMessage(data.error || (ar ? 'تعذر بدء عملية الشراء.' : 'Could not start checkout.'))
      }
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
  const creditCheckoutUnavailable = billingStatus?.creditPurchasesEnabled !== true || Boolean(creditCheckoutErrorCode)
  const creditCheckoutStatusMessage = creditCheckoutErrorCode === 'CREDIT_PRICE_VERSION_MISMATCH'
    || billingStatus?.creditPurchasesStatus === 'price_version_mismatch'
    ? (ar
        ? 'الشراء مقفول بأمان: أسعار Stripe لا تطابق إصدار التسعير الحالي. يجب تحديث Price IDs قبل استقبال أي دفعة.'
        : 'Purchasing is safely locked: Stripe prices do not match the current pricing version. Price IDs must be updated before accepting payment.')
    : billingStatus?.creditPurchasesStatus === 'migration_required'
      ? (ar
          ? 'الدفع مقفول بأمان حتى تطبيق والتحقق من ترحيل سجل Stripe Webhook.'
          : 'Checkout is safely locked until the Stripe webhook ledger migration is applied and verified.')
    : billingStatus?.creditPurchasesStatus === 'verification_failed'
      ? (ar
          ? 'الشراء مقفول مؤقتًا لأن النظام لم يستطع التحقق من أسعار Stripe.'
          : 'Purchasing is temporarily locked because Stripe prices could not be verified.')
      : (ar ? 'بانتظار تفعيل Stripe والمحفظة' : 'Awaiting Stripe + wallet activation')
  const nextPurchasedExpiry = billingStatus?.creditBreakdown?.nextPurchasedExpiry
    ? new Intl.DateTimeFormat(ar ? 'ar-EG' : 'en-US', { dateStyle: 'medium' }).format(
        new Date(billingStatus.creditBreakdown.nextPurchasedExpiry),
      )
    : null
  const creditBreakdownSummary = billingStatus?.creditBreakdown
    ? [
        ar ? `شهري ${billingStatus.creditBreakdown.monthly}` : `Monthly ${billingStatus.creditBreakdown.monthly}`,
        ar ? `مشتَرى ${billingStatus.creditBreakdown.purchased}` : `Purchased ${billingStatus.creditBreakdown.purchased}`,
        ar ? `تجريبي ${billingStatus.creditBreakdown.trial}` : `Trial ${billingStatus.creditBreakdown.trial}`,
        ...(billingStatus.creditBreakdown.migrated > 0
          ? [ar ? `رصيد قديم محمي ${billingStatus.creditBreakdown.migrated}` : `Protected legacy balance ${billingStatus.creditBreakdown.migrated}`]
          : []),
        ...(billingStatus.creditBreakdown.referral > 0
          ? [ar ? `إحالات ${billingStatus.creditBreakdown.referral}` : `Referrals ${billingStatus.creditBreakdown.referral}`]
          : []),
        ...(billingStatus.creditBreakdown.refund > 0
          ? [ar ? `مسترد ${billingStatus.creditBreakdown.refund}` : `Refunded ${billingStatus.creditBreakdown.refund}`]
          : []),
        ...(billingStatus.creditBreakdown.manual > 0
          ? [ar ? `إضافة إدارية ${billingStatus.creditBreakdown.manual}` : `Manual grant ${billingStatus.creditBreakdown.manual}`]
          : []),
        ...(billingStatus.creditBreakdown.other > 0
          ? [ar ? `أخرى ${billingStatus.creditBreakdown.other}` : `Other ${billingStatus.creditBreakdown.other}`]
          : []),
      ].join(' · ')
    : null

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
  // instead of a confusing "246 / 60" with an overflowing bar.
  // No active subscription → one-time credits → no monthly denominator.
  const creditGrant = billingStatus?.hasActiveSubscription ? monthlyCredits : 0
  const creditDisp = formatCreditDisplay({
    availableCredits: currentCredits,
    monthlyCredits: creditGrant,
    locale: ar ? 'ar' : 'en',
  })
  const nonMonthlyCredits = billingStatus?.creditBreakdown
    ? billingStatus.creditBreakdown.purchased
      + billingStatus.creditBreakdown.trial
      + billingStatus.creditBreakdown.migrated
      + billingStatus.creditBreakdown.referral
      + billingStatus.creditBreakdown.refund
      + billingStatus.creditBreakdown.manual
      + billingStatus.creditBreakdown.other
    : 0
  const hasMixedCreditBuckets = nonMonthlyCredits > 0
  const creditPrimary = hasMixedCreditBuckets
    ? (ar ? `${currentCredits} كريديت إجمالي متاح` : `${currentCredits} total credits available`)
    : creditDisp.primary
  const creditHelper = hasMixedCreditBuckets
    ? (ar
        ? 'الكريديت الشهري يتجدد وينتهي مع الدورة؛ الرصيد المشترى والقديم المحمي لهما قواعد صلاحية مستقلة موضحة أدناه.'
        : 'Monthly credits renew and expire with the cycle; purchased and protected legacy credits follow the separate expiry rules shown below.')
    : billingDisplay.creditHelper
  const creditsPercent = creditDisp.percent
  const scheduledCancellationDate = billingStatus?.hasActiveSubscription && billingStatus.cancelledAt
    ? new Date(billingStatus.cancelledAt)
    : null
  const scheduledCancellationLabel = scheduledCancellationDate && !Number.isNaN(scheduledCancellationDate.getTime())
    ? new Intl.DateTimeFormat(ar ? 'ar-EG' : 'en-US', { dateStyle: 'medium' }).format(scheduledCancellationDate)
    : null

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
        {!loading && (billingStatus?.billingMode === 'sandbox' || !billingEnabled) && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  {billingStatus?.billingMode === 'sandbox'
                    ? ar ? 'وضع Stripe التجريبي مفعّل' : 'Stripe Sandbox is active'
                    : ar ? 'وضع البيتا مفعّل' : 'Beta billing mode'}
                </p>
                <p className="text-sm text-amber-800 mt-1">
                  {billingStatus?.billingMode === 'sandbox'
                    ? ar
                      ? 'كل عمليات الدفع هنا تجريبية ولا تخصم أموالاً حقيقية. استخدم بيانات اختبار Stripe فقط.'
                      : 'All payments here are tests and no real money is charged. Use Stripe test payment details only.'
                    : ar
                      ? 'الدفع الحقيقي غير مفعّل حتى اكتمال الإعدادات القانونية وStripe. الحسابات المجانية والأرصدة التجريبية تعمل بشكل طبيعي.'
                      : 'Live payments are disabled until legal and Stripe setup is complete. Free accounts and trial credits continue to work normally.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {billingMessage && (
          <div
            className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-800"
            role="status"
            aria-live="polite"
          >
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
                {scheduledCancellationLabel && (
                  <p className="mt-2 text-xs font-medium text-amber-700" role="status">
                    {ar
                      ? `الإلغاء مجدول؛ يظل الوصول فعالًا حتى ${scheduledCancellationLabel}.`
                      : `Cancellation is scheduled; access remains active through ${scheduledCancellationLabel}.`}
                  </p>
                )}
              </div>

              <div className="flex-1 max-w-xs">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                  <span>{ar ? 'الأرصدة المتبقية' : 'Credits remaining'}</span>
                  <span className="font-mono text-slate-700">{creditPrimary}</span>
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
                <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">{creditHelper}</p>
                {creditDisp.secondary && (
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">{creditDisp.secondary}</p>
                )}
                {billingStatus.creditBreakdown && (
                  <div className="mt-1 space-y-0.5 text-[11px] leading-snug text-slate-400">
                    <p>{creditBreakdownSummary}</p>
                    {nextPurchasedExpiry && billingStatus.creditBreakdown.purchased > 0 && (
                      <p>
                        {ar
                          ? `أقرب انتهاء للرصيد المشترى: ${nextPurchasedExpiry}`
                          : `Next purchased-credit expiry: ${nextPurchasedExpiry}`}
                      </p>
                    )}
                  </div>
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
              ? 'Growth للتخطيط وإنتاج مسودات النصوص ومراجعتها؛ الصور والفيديو عمليات منفصلة. وAutopilot للسعة الأكبر والمراقبة المجدولة. أرصدة التجربة ليست باقة ثالثة.'
              : 'Growth covers planning plus copy-draft production and review; images and video are separate metered actions. Autopilot adds capacity and scheduled monitoring. Trial credits are not a third plan.'
            }
          </p>

          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
            <Gift className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
            <p className="text-sm leading-relaxed text-slate-600">
              {ar
                ? `ابدأ بـ${FREE_TRIAL_CREDITS} رصيداً تجريبياً لمرة واحدة، بدون بطاقة. بعدها اختر واحدة من الباقتين المدفوعتين.`
                : `Start with ${FREE_TRIAL_CREDITS} one-time trial credits, with no card. Then choose one of the two paid plans.`}
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
                      disabled={upgrading === plan.id || (isAuthenticated && (loading || !billingEnabled))}
                      className={`w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 ${
                        isPopular
                          ? 'bg-slate-950 hover:bg-slate-800 shadow-[0_12px_28px_rgba(15,23,42,0.16)]'
                          : 'bg-slate-950 hover:bg-slate-800 border border-slate-950'
                      }`}
                    >
                      {upgrading === plan.id
                        ? (ar ? 'جاري التحويل...' : 'Redirecting...')
                        : isAuthenticated && loading
                        ? (ar ? 'جارٍ التحقق من حالة الدفع...' : 'Checking billing status...')
                        : isAuthenticated && !billingEnabled
                        ? (ar ? 'قريبا' : 'Coming soon')
                        : billingStatus?.billingMode === 'sandbox'
                        ? (ar ? `اختبر Checkout لـ ${plan.nameAr}` : `Test ${plan.nameEn} checkout`)
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
              <p className="mt-2 max-w-2xl text-xs font-semibold text-slate-600">
                {ar
                  ? 'شراء الكريدت يزيد سعة عمليات AI فقط؛ لا يغيّر حدود الحملات أو المنشورات ولا يفتح مزايا الباقات.'
                  : 'Buying credits increases AI processing capacity only; it does not change campaign or post limits or unlock plan features.'}
              </p>
            </div>
            {!loading && creditCheckoutUnavailable && (
              <span className="w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                {creditCheckoutStatusMessage}
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
                  {[20, 50, 150, 300].map((quantity) => (
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
                    {ar ? `أدخل كمية صحيحة بزيادة ${CREDIT_PURCHASE_POLICY.step}.` : `Enter a valid ${CREDIT_PURCHASE_POLICY.step}-credit increment.`}
                  </p>
                )}
                <button
                  onClick={handleBuyCredits}
                  disabled={loading || creditCheckoutUnavailable || buyingCredits || !creditPurchaseQuote}
                  className="mt-4 w-full rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {buyingCredits
                    ? (ar ? 'جاري التحويل...' : 'Redirecting...')
                    : creditCheckoutUnavailable
                      ? (ar ? 'الدفع غير متاح حتى التحقق من الأسعار' : 'Checkout unavailable until prices are verified')
                      : (ar ? 'المتابعة إلى الدفع' : 'Continue to checkout')}
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
              ? `قيمة الرصيد الشهري: Growth ≈ $${(GROWTH_PLAN.priceUsd / GROWTH_PLAN.monthlyCredits).toFixed(2)}/رصيد · Autopilot ≈ $${(AUTOPILOT_PLAN.priceUsd / AUTOPILOT_PLAN.monthlyCredits).toFixed(2)}/رصيد. تكلفة الاستراتيجية متغيرة حسب النطاق.`
              : `Monthly credit value: Growth ≈ $${(GROWTH_PLAN.priceUsd / GROWTH_PLAN.monthlyCredits).toFixed(2)}/cr · Autopilot ≈ $${(AUTOPILOT_PLAN.priceUsd / AUTOPILOT_PLAN.monthlyCredits).toFixed(2)}/cr. Strategy cost varies by scope.`
            }
          </p>
          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold leading-5 text-slate-600">
            {ar
              ? `نسخة التسعير الحالية ${CURRENT_CREDIT_PRICING_VERSION}، سارية من ${CURRENT_CREDIT_PRICING_EFFECTIVE_DATE}. كل عملية تحفظ نسختها؛ لذلك قد يختلف سعر عملية قديمة عن عرض جديد مماثل دون تغيير السجل التاريخي.`
              : `Current pricing version ${CURRENT_CREDIT_PRICING_VERSION}, effective ${CURRENT_CREDIT_PRICING_EFFECTIVE_DATE}. Every operation stores its version, so a historical row can differ from a new quote without rewriting the ledger.`}
          </div>

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
                    <span className="text-slate-950 font-semibold">Growth ({GROWTH_PLAN.monthlyCredits} رصيد)</span> = مسار Full Standard واحد لمدة 90 يومًا إلى المسودات ({FULL_STANDARD_90_WORKFLOW_COST} كريديت) مع هامش صغير للمراجعة · أو {Math.floor(GROWTH_PLAN.monthlyCredits / CREDIT_ACTION_COSTS.IMAGE_GENERATION)} صورة · أو {Math.floor(GROWTH_PLAN.monthlyCredits / CREDIT_ACTION_COSTS.MOTION_DESIGN_VIDEO)} إعلانات Motion Design من فيديو حقيقي · أو {Math.floor(GROWTH_PLAN.monthlyCredits / CREDIT_ACTION_COSTS.VIDEO_GENERATION)} فيديوهات إعلانية احترافية · أو مزيج من الإجراءات. التجربة تغطي استراتيجية Organic Light وفحص الجودة فقط ({TRIAL_STRATEGY_REVIEW_COST} كريديت)، ولا تشمل إنتاج المحتوى.
                  </>
                ) : (
                  <>
                    <span className="text-slate-950 font-semibold">Growth ({GROWTH_PLAN.monthlyCredits} credits)</span> = one Full Standard 90-day strategy-to-drafts workflow ({FULL_STANDARD_90_WORKFLOW_COST} credits) with a small review reserve · or {Math.floor(GROWTH_PLAN.monthlyCredits / CREDIT_ACTION_COSTS.IMAGE_GENERATION)} images · or {Math.floor(GROWTH_PLAN.monthlyCredits / CREDIT_ACTION_COSTS.MOTION_DESIGN_VIDEO)} source-locked Motion Design ads · or {Math.floor(GROWTH_PLAN.monthlyCredits / CREDIT_ACTION_COSTS.VIDEO_GENERATION)} professional video ads · or a mix of actions. Trial covers Organic Light strategy plus quality review only ({TRIAL_STRATEGY_REVIEW_COST} credits); content production is excluded.
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
          {loading
            ? (ar
                ? 'جارٍ التحقق من حالة Stripe والمحفظة...'
                : 'Checking Stripe and wallet status...')
            : billingStatus?.billingMode === 'sandbox'
            ? (ar
                ? 'Stripe Sandbox فقط · لا تُخصم أموال حقيقية · استخدم بيانات الاختبار'
                : 'Stripe Sandbox only · no real money is charged · use test payment details')
            : billingEnabled
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
