'use client'

/**
 * Billing page — conversion-optimized
 * Plans: Starter $29 · Pro $79 · Agency $199
 * Payment provider: LemonSqueezy (env: LEMONSQUEEZY_API_KEY, LS_STORE_ID, LS_VARIANT_*)
 *
 * Sprint T-D — Billing Intelligence
 */

import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { useEffect, useState } from 'react'
import AppShell from '@/components/AppShell'
import Link from 'next/link'
import {
  Sparkles, Zap, CheckCircle2, Settings2, ArrowUpRight,
  Rocket, Brain, BarChart3, Shield, Globe, X, Star,
} from 'lucide-react'

// ─── Plan data ────────────────────────────────────────────────────────────────

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    nameAr: 'المبتدئ',
    price: 29,
    accentColor: '#6C63FF',
    featured: false,
    badgeAr: null as string | null,
    badgeEn: null as string | null,
    descAr: 'للأفراد والمبدعين المستقلين',
    descEn: 'For solo creators and independents',
    roiAr: 'يوفر عليك 20+ ساعة شهرياً',
    roiEn: 'Saves 20+ hours per month',
    featuresAr: [
      '50 رصيد AI / شهر',
      '3 حملات / شهر',
      'مساحة عمل واحدة',
      'استراتيجية + محتوى + تقويم',
      'تصدير PDF',
      'دعم بالبريد الإلكتروني',
    ],
    featuresEn: [
      '50 AI credits / month',
      '3 campaigns / month',
      '1 workspace',
      'Strategy + content + calendar',
      'PDF export',
      'Email support',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    nameAr: 'الاحترافي',
    price: 79,
    accentColor: '#6C63FF',
    featured: true,
    badgeAr: 'الأكثر شيوعاً',
    badgeEn: 'Most Popular',
    descAr: 'للعلامات التجارية النامية والفرق الصغيرة',
    descEn: 'For growing brands and small teams',
    roiAr: 'يغني عن موظف تسويق بـ $2,000',
    roiEn: 'Replaces a $2,000/mo marketing hire',
    featuresAr: [
      '200 رصيد AI / شهر',
      'حملات غير محدودة',
      '3 مساحات عمل',
      'نشر تلقائي على السوشيال ميديا',
      'تحليلات أداء حقيقية',
      'Creative Brief + Sentinel Review',
      'دعم أولوية',
    ],
    featuresEn: [
      '200 AI credits / month',
      'Unlimited campaigns',
      '3 workspaces',
      'Auto-publish to social media',
      'Real performance analytics',
      'Creative Brief + Sentinel Review',
      'Priority support',
    ],
  },
  {
    id: 'agency',
    name: 'Agency',
    nameAr: 'الوكالات',
    price: 199,
    accentColor: '#00BFA6',
    featured: false,
    badgeAr: null as string | null,
    badgeEn: null as string | null,
    descAr: 'للوكالات التي تدير عدة عملاء',
    descEn: 'For agencies managing multiple clients',
    roiAr: 'يغني عن وكالة تسويق بـ $3,000+',
    roiEn: 'Replaces a $3,000+/mo marketing agency',
    featuresAr: [
      'رصيد AI غير محدود',
      'حملات غير محدودة',
      '10 مساحات عمل',
      'White-label export',
      'جميع مميزات Pro',
      'API access (قريباً)',
      'مدير حساب مخصص',
    ],
    featuresEn: [
      'Unlimited AI credits',
      'Unlimited campaigns',
      '10 workspaces',
      'White-label export',
      'All Pro features',
      'API access (coming soon)',
      'Dedicated account manager',
    ],
  },
]

// ─── Feature comparison rows ──────────────────────────────────────────────────

const COMPARISON_ROWS = {
  ar: [
    { label: 'رصيد AI / شهر',         starter: '50',   pro: '200',     agency: '∞' },
    { label: 'الحملات',               starter: '3',    pro: '∞',       agency: '∞' },
    { label: 'مساحات العمل',          starter: '1',    pro: '3',       agency: '10' },
    { label: 'نشر تلقائي على Meta',   starter: '✗',   pro: '✓',       agency: '✓' },
    { label: 'تحليلات الأداء',        starter: '✗',   pro: '✓',       agency: '✓' },
    { label: 'Sentinel Review',        starter: '✗',   pro: '✓',       agency: '✓' },
    { label: 'White-label export',     starter: '✗',   pro: '✗',       agency: '✓' },
  ],
  en: [
    { label: 'AI credits / month',     starter: '50',   pro: '200',     agency: '∞' },
    { label: 'Campaigns',              starter: '3',    pro: '∞',       agency: '∞' },
    { label: 'Workspaces',             starter: '1',    pro: '3',       agency: '10' },
    { label: 'Auto-publish to Meta',   starter: '✗',   pro: '✓',       agency: '✓' },
    { label: 'Performance analytics',  starter: '✗',   pro: '✓',       agency: '✓' },
    { label: 'Sentinel Review',        starter: '✗',   pro: '✓',       agency: '✓' },
    { label: 'White-label export',     starter: '✗',   pro: '✗',       agency: '✓' },
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

  const currentPlan = subscriptionStatus?.plan || 'FREE'
  const isActive = subscriptionStatus?.hasActiveSubscription || false
  const credits = subscriptionStatus?.credits ?? 0
  const isUnlimited = credits === -1
  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || ''

  const glassCard = { background: 'rgba(17,21,54,0.5)', border: '1px solid rgba(108,99,255,0.1)', backdropFilter: 'blur(12px)' }

  return (
    <AppShell>
      <div dir={dir}>

        {/* ── Notice banner ── */}
        {notice && (
          <div className={`flex items-center justify-between gap-4 px-6 py-3 border-b text-sm ${notice.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 border-rose-500/20 text-rose-300'}`}>
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
              style={{ background: 'rgba(108,99,255,0.08)', border: '1px solid rgba(108,99,255,0.2)', color: '#a5a0ff' }}>
              <Sparkles className="w-3 h-3" />
              {ar ? 'قسم الاشتراكات' : 'Subscription Plans'}
            </div>
            <h1 className="text-3xl sm:text-4xl font-black font-heading text-white leading-tight">
              {ar ? 'قسم التسويق الذكي بسعر ثابت' : 'Your AI Marketing Department'}
            </h1>
            <p className="text-text-secondary text-sm sm:text-base max-w-xl mx-auto">
              {ar
                ? 'بدلاً من دفع آلاف الدولارات لوكالة تسويق، Nexus AI يبني لك الاستراتيجية، المحتوى، والنشر كل شهر.'
                : 'Instead of paying thousands to a marketing agency, Nexus AI builds your strategy, content, and publishing every month.'}
            </p>
            {displayName && (
              <p className="text-xs text-text-muted">
                {ar ? `مرحباً ${displayName} —` : `Welcome ${displayName} —`}
                {' '}
                {isActive
                  ? (ar ? `أنت على خطة ${currentPlan}` : `you're on the ${currentPlan} plan`)
                  : (ar ? 'أنت على الخطة المجانية حالياً' : "you're currently on the free plan")}
              </p>
            )}
          </div>

          {/* ── Current Plan Status (for active subscribers) ── */}
          {isActive && (
            <div className="rounded-2xl p-5 flex items-center justify-between flex-wrap gap-4"
              style={{ background: 'rgba(0,191,166,0.05)', border: '1px solid rgba(0,191,166,0.2)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(0,191,166,0.12)' }}>
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
                      <span className="ml-2 text-text-muted">
                        · {ar ? 'يتجدد' : 'renews'}{' '}
                        {new Date(subscriptionStatus.currentPeriodEnd).toLocaleDateString(ar ? 'ar-SA' : 'en-US')}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button onClick={handleManageSubscription} disabled={openingPortal}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:brightness-110 disabled:opacity-60"
                style={{ background: 'rgba(0,191,166,0.1)', color: '#00BFA6', border: '1px solid rgba(0,191,166,0.25)' }}>
                <Settings2 className="w-3.5 h-3.5" />
                {openingPortal ? (ar ? 'جاري الفتح...' : 'Opening...') : (ar ? 'إدارة الاشتراك' : 'Manage Subscription')}
              </button>
            </div>
          )}

          {/* ── ROI banner for free users ── */}
          {!isActive && (
            <div className="rounded-2xl p-5 flex items-center gap-4 flex-wrap"
              style={{ background: 'rgba(108,99,255,0.06)', border: '1px solid rgba(108,99,255,0.2)' }}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="text-2xl flex-shrink-0">💡</div>
                <div>
                  <p className="text-sm font-bold text-white">
                    {ar ? 'وكالة تسويق متكاملة بأقل من ٨٠$' : 'A full marketing agency for under $80'}
                  </p>
                  <p className="text-xs text-text-muted">
                    {ar
                      ? 'استراتيجية · محتوى · نشر · تحليل — كل ما تدفعه لوكالة بـ $3,000+، الآن متاح بضغطة زر.'
                      : 'Strategy · content · publishing · analytics — everything a $3,000+/mo agency does, available on demand.'}
                  </p>
                </div>
              </div>
              <a href="#plans"
                className="btn-gradient flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white flex-shrink-0">
                {ar ? 'اختر خطتك' : 'Pick a Plan'} <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {/* ── Plan Cards ── */}
          <div id="plans" className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PLANS.map(plan => {
              const isCurrent = currentPlan === plan.id.toUpperCase() && isActive
              const badge = ar ? plan.badgeAr : plan.badgeEn
              const desc = ar ? plan.descAr : plan.descEn
              const roi = ar ? plan.roiAr : plan.roiEn
              const features = ar ? plan.featuresAr : plan.featuresEn

              return (
                <div key={plan.id} className="relative rounded-2xl p-7 flex flex-col transition-all duration-300 hover:translate-y-[-2px]"
                  style={{
                    background: plan.featured ? 'rgba(108,99,255,0.08)' : 'rgba(17,21,54,0.5)',
                    border: plan.featured ? '2px solid rgba(108,99,255,0.4)' : `1px solid ${plan.accentColor}18`,
                    backdropFilter: 'blur(12px)',
                    boxShadow: plan.featured ? '0 0 40px rgba(108,99,255,0.12)' : 'none',
                  }}>

                  {badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-white text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap"
                      style={{ background: 'linear-gradient(135deg, #6C63FF, #9333EA)' }}>
                      <Star className="w-2.5 h-2.5 inline mr-1" />
                      {badge}
                    </div>
                  )}

                  {isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold px-3 py-1 rounded-full"
                      style={{ background: 'rgba(0,191,166,0.2)', color: '#00BFA6', border: '1px solid rgba(0,191,166,0.3)' }}>
                      {ar ? '✓ خطتك الحالية' : '✓ Current Plan'}
                    </div>
                  )}

                  {/* Plan header */}
                  <div className="mb-5">
                    <h3 className="text-lg font-bold text-white mb-0.5">{ar ? plan.nameAr : plan.name}</h3>
                    <p className="text-xs text-text-muted mb-3">{desc}</p>
                    <div className="flex items-baseline gap-1 mb-2">
                      <span className="text-4xl font-black text-white">${plan.price}</span>
                      <span className="text-text-muted text-sm">{ar ? '/ شهر' : '/ mo'}</span>
                    </div>
                    {/* ROI line */}
                    <div className="flex items-center gap-1.5 text-[11px] font-medium"
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
                      style={{ background: 'rgba(0,191,166,0.08)', border: '1px solid rgba(0,191,166,0.2)', color: '#00BFA6' }}>
                      {ar ? '✓ خطتك النشطة' : '✓ Your Active Plan'}
                    </div>
                  ) : (
                    <button onClick={() => handleUpgrade(plan.id)} disabled={!!checkingOut}
                      className={`w-full py-3 rounded-xl font-bold transition-all text-sm disabled:opacity-50 ${
                        plan.featured
                          ? 'btn-gradient text-white'
                          : 'text-white hover:brightness-110'
                      }`}
                      style={!plan.featured ? {
                        background: `${plan.accentColor}12`,
                        border: `1px solid ${plan.accentColor}30`,
                        color: plan.accentColor,
                      } : {}}>
                      {checkingOut === plan.id
                        ? (ar ? 'جاري التحويل...' : 'Redirecting...')
                        : (ar ? `ابدأ ${plan.nameAr}` : `Start ${plan.name}`)}
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* ── What you replace (Value props) ── */}
          <div className="rounded-2xl p-6" style={glassCard}>
            <div className="flex items-center gap-2 mb-5">
              <Rocket className="w-4 h-4 text-accent-purple" />
              <h2 className="text-base font-bold text-white">
                {ar ? 'ماذا يغني Nexus AI عنه؟' : 'What does Nexus AI replace?'}
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { icon: Brain,    colorHex: '#6C63FF', labelAr: 'استراتيجي تسويق',     labelEn: 'Marketing strategist',  costAr: '$3,000/شهر',   costEn: '$3,000/mo' },
                { icon: Sparkles, colorHex: '#00BFA6', labelAr: 'كاتب محتوى',           labelEn: 'Content writer',         costAr: '$1,500/شهر',   costEn: '$1,500/mo' },
                { icon: BarChart3,colorHex: '#00D4FF', labelAr: 'محلل أداء',            labelEn: 'Performance analyst',    costAr: '$2,000/شهر',   costEn: '$2,000/mo' },
                { icon: Globe,    colorHex: '#FF6B35', labelAr: 'مدير سوشيال ميديا',    labelEn: 'Social media manager',   costAr: '$1,200/شهر',   costEn: '$1,200/mo' },
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
            <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(108,99,255,0.08)' }}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <p className="text-text-muted text-sm">
                  {ar ? 'التكلفة الفعلية لفريق التسويق:' : 'Actual cost of a marketing team:'}
                  <span className="text-white font-bold mx-1">{ar ? '$7,700+/شهر' : '$7,700+/mo'}</span>
                </p>
                <p className="text-sm font-bold" style={{ color: '#00BFA6' }}>
                  {ar ? 'Nexus AI Pro: $79/شهر ← وفر $7,621' : 'Nexus AI Pro: $79/mo ← save $7,621'}
                </p>
              </div>
            </div>
          </div>

          {/* ── Feature Comparison Table ── */}
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
              <div className="border-t" style={{ borderColor: 'rgba(108,99,255,0.1)' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(108,99,255,0.08)' }}>
                      <th className="text-left px-6 py-3 text-[11px] text-text-muted font-medium">
                        {ar ? 'الميزة' : 'Feature'}
                      </th>
                      {['Starter', 'Pro', 'Agency'].map(p => (
                        <th key={p} className="px-4 py-3 text-[11px] font-bold text-center" style={{ color: p === 'Pro' ? '#6C63FF' : '#a5a0ff' }}>
                          {p}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(ar ? COMPARISON_ROWS.ar : COMPARISON_ROWS.en).map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(108,99,255,0.05)' }}
                        className="hover:bg-white/2 transition-all">
                        <td className="px-6 py-2.5 text-text-muted text-xs">{row.label}</td>
                        {[row.starter, row.pro, row.agency].map((val, j) => (
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
                  a: 'كل إجراء AI (توليد حملة، Sentinel Review، Creative Brief...) يستهلك رصيداً محدداً. الأرصدة تتجدد كل شهر.',
                },
                {
                  q: 'ماذا يحدث إذا استهلكت كل أرصدتي؟',
                  a: 'لن تتمكن من تشغيل إجراءات AI جديدة حتى تجديد الأرصدة الشهري أو الترقية. لن يُحذف أي محتوى موجود.',
                },
                {
                  q: 'هل تقدمون استرداداً للمبالغ؟',
                  a: 'نقدم ضمان استرداد الأموال خلال 7 أيام من الاشتراك الأول. تواصل مع فريق الدعم.',
                },
                {
                  q: 'هل بيانات عملائي آمنة؟',
                  a: 'نعم. كل مساحة عمل معزولة تماماً. بيانات Brand Brain وحملاتك مخزنة بشكل مشفر ولا يشاركها Nexus AI مع أطراف ثالثة.',
                },
              ] : [
                {
                  q: 'Can I cancel at any time?',
                  a: 'Yes. Cancel any time via "Manage Subscription." You keep access until the end of your current billing period.',
                },
                {
                  q: 'What are AI credits?',
                  a: 'Each AI action (campaign generation, Sentinel Review, Creative Brief...) uses a specific credit amount. Credits renew monthly.',
                },
                {
                  q: 'What happens when I run out of credits?',
                  a: "You won't be able to run new AI actions until your monthly reset or upgrade. No existing content is deleted.",
                },
                {
                  q: 'Do you offer refunds?',
                  a: 'We offer a 7-day money-back guarantee on first-time subscriptions. Contact support.',
                },
                {
                  q: 'Is my client data safe?',
                  a: 'Yes. Each workspace is fully isolated. Your Brand Brain and campaign data is encrypted and never shared with third parties.',
                },
              ]).map(faq => (
                <div key={faq.q} className="pb-5 last:pb-0"
                  style={{ borderBottom: '1px solid rgba(108,99,255,0.06)' }}>
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
                <span className="text-white font-medium">Lemon Squeezy</span>
                {' · '}
                {ar ? 'ضمان استرداد 7 أيام' : '7-day refund guarantee'}
                {' · '}
                {ar ? 'إلغاء في أي وقت' : 'Cancel any time'}
              </p>
              <div className="flex items-center justify-center gap-3">
                <a href="#plans" className="btn-gradient inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white">
                  <Zap className="w-4 h-4" />
                  {ar ? 'ابدأ الآن' : 'Get Started'}
                </a>
                <Link href="/dashboard"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-text-muted hover:text-white transition-all"
                  style={{ border: '1px solid rgba(108,99,255,0.15)' }}>
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
