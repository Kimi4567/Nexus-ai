import { getPlanDisplayName } from '@/lib/creditDisplay'

export type BillingStatusTone = 'neutral' | 'success' | 'warning' | 'danger'

export interface BillingDisplayTruthInput {
  plan: string | null | undefined
  status: string | null | undefined
  hasActiveSubscription: boolean | null | undefined
  creditsRemaining: number | null | undefined
  creditsMax: number | null | undefined
  billingLoaded: boolean
  billingEnabled?: boolean
  locale?: string
}

export interface BillingDisplayTruth {
  planLabel: string
  statusLabel: string
  statusTone: BillingStatusTone
  creditTitle: string
  creditHelper: string
  ctaLabel: string
  ctaHref: string
  showManageSubscription: boolean
  showUpgrade: boolean
  isUnknown: boolean
  isZeroCredits: boolean
  isLowCredits: boolean
}

const ACTIVE_STATUSES = new Set(['active', 'trialing', 'current', 'valid'])

const norm = (v: string | null | undefined) => (v ?? '').toString().trim().toLowerCase()

export function getBillingDisplayTruth(input: BillingDisplayTruthInput): BillingDisplayTruth {
  const ar = (input.locale || '').toLowerCase().startsWith('ar')
  const status = norm(input.status)
  const billingLoaded = !!input.billingLoaded
  const hasActive = input.hasActiveSubscription === true
  // The API always returns a boolean once loaded. Treat an omitted value as
  // backwards-compatible/unknown, but an explicit false as a hard gate for
  // payment controls so a stale subscription record cannot expose a dead
  // Stripe portal or imply that checkout is currently available.
  const billingAvailable = input.billingEnabled !== false
  const billingUnavailableLabel = ar ? 'الفوترة غير مفعّلة' : 'Billing unavailable'
  const creditsRemaining = typeof input.creditsRemaining === 'number' ? input.creditsRemaining : 0
  const creditsMax = typeof input.creditsMax === 'number' ? input.creditsMax : 0
  const unlimited = creditsRemaining === -1 || creditsMax === -1

  const isUnknown = !billingLoaded || input.hasActiveSubscription == null

  if (isUnknown) {
    return {
      planLabel: ar ? 'غير معروف' : 'Unknown',
      statusLabel: ar ? 'حالة الخطة غير متاحة الآن' : 'Plan status unavailable',
      statusTone: 'neutral',
      creditTitle: ar ? 'حالة الرصيد غير متاحة' : 'Credits status unavailable',
      creditHelper: ar ? 'تعذر تحميل بيانات الفوترة حالياً. حاول التحديث بعد قليل.' : 'Billing data is temporarily unavailable. Please refresh in a moment.',
      ctaLabel: ar ? 'فتح الفوترة' : 'Open billing',
      ctaHref: '/billing',
      showManageSubscription: false,
      showUpgrade: false,
      isUnknown: true,
      isZeroCredits: false,
      isLowCredits: false,
    }
  }

  let statusLabel = ar ? 'حالة الخطة غير متاحة الآن' : 'Plan status unavailable'
  let statusTone: BillingStatusTone = 'neutral'

  if (hasActive && ACTIVE_STATUSES.has(status || '')) {
    statusLabel = ar ? 'نشط' : 'Active'
    statusTone = 'success'
  } else if (status === 'cancelled') {
    statusLabel = ar ? 'ملغاة' : 'Cancelled'
    statusTone = 'warning'
  } else if (status === 'past_due' || status === 'unpaid') {
    statusLabel = ar ? 'مشكلة في الدفع' : 'Payment issue'
    statusTone = 'danger'
  } else if (!hasActive) {
    statusLabel = ar ? 'بدون اشتراك نشط' : 'No active subscription'
    statusTone = 'neutral'
  }

  const planLabel = hasActive ? getPlanDisplayName(input.plan, ar ? 'ar' : 'en') : (ar ? 'مجاني' : 'Free')

  const isZeroCredits = !unlimited && creditsRemaining <= 0
  const isLowCredits = !unlimited && creditsRemaining > 0 && creditsRemaining <= 3

  if (isZeroCredits) {
    return {
      planLabel,
      statusLabel,
      statusTone,
      creditTitle: ar ? 'انتهى الرصيد' : 'Out of credits',
      creditHelper: ar
        ? 'انتهى رصيدك. أضف رصيدًا أو رقّي الخطة لمتابعة الإنشاء.'
        : 'You’re out of credits. Add credits or upgrade to continue generation.',
      ctaLabel: billingAvailable ? (ar ? 'ترقية الخطة' : 'Upgrade plan') : billingUnavailableLabel,
      ctaHref: '/billing',
      showManageSubscription: hasActive && billingAvailable,
      showUpgrade: billingAvailable,
      isUnknown: false,
      isZeroCredits: true,
      isLowCredits: false,
    }
  }

  if (isLowCredits) {
    return {
      planLabel,
      statusLabel,
      statusTone,
      creditTitle: ar ? 'رصيد منخفض' : 'Low credits',
      creditHelper: ar ? 'رصيدك أوشك على النفاد.' : 'Credits are running low.',
      ctaLabel: !billingAvailable
        ? billingUnavailableLabel
        : hasActive
          ? (ar ? 'إدارة الاشتراك' : 'Manage subscription')
          : (ar ? 'ترقية الخطة' : 'Upgrade plan'),
      ctaHref: '/billing',
      showManageSubscription: hasActive && billingAvailable,
      showUpgrade: !hasActive && billingAvailable,
      isUnknown: false,
      isZeroCredits: false,
      isLowCredits: true,
    }
  }

  return {
    planLabel,
    statusLabel,
    statusTone,
    creditTitle: ar ? 'الرصيد المتاح' : 'Credits available',
    creditHelper: ar
      ? 'يتم استخدام الرصيد عندما ينشئ NEXUS استراتيجية أو حملة أو محتوى أو أصولًا إبداعية.'
      : 'Credits are used when NEXUS generates strategy, campaigns, content, or creative assets.',
    ctaLabel: !billingAvailable
      ? billingUnavailableLabel
      : hasActive
        ? (ar ? 'إدارة الاشتراك' : 'Manage subscription')
        : (ar ? 'عرض الخطط' : 'View plans'),
    ctaHref: '/billing',
    showManageSubscription: hasActive && billingAvailable,
    showUpgrade: !hasActive && billingAvailable,
    isUnknown: false,
    isZeroCredits: false,
    isLowCredits: false,
  }
}
