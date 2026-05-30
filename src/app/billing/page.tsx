'use client'

import { useAuth } from '@/lib/auth-context'
import { useEffect, useState } from 'react'
import AppShell from '@/components/AppShell'
import { Sparkles, Zap, CheckCircle2, Settings2 } from 'lucide-react'

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    nameAr: 'المبتدئ',
    price: 29,
    accentColor: '#6C63FF',
    featured: false,
    badge: null,
    description: 'مثالي للأفراد والمبدعين',
    features: ['50 رصيد ذكاء اصطناعي / شهر', '3 حملات / شهر', 'مساحة عمل واحدة', 'تصدير PDF', 'دعم بالبريد الإلكتروني'],
  },
  {
    id: 'pro',
    name: 'Pro',
    nameAr: 'الاحترافي',
    price: 79,
    accentColor: '#6C63FF',
    featured: true,
    badge: 'الأكثر شيوعاً',
    description: 'للعلامات التجارية النامية',
    features: ['200 رصيد ذكاء اصطناعي / شهر', 'حملات غير محدودة', '3 مساحات عمل', 'نشر على السوشيال ميديا', 'دعم متقدم'],
  },
  {
    id: 'agency',
    name: 'Agency',
    nameAr: 'الوكالات',
    price: 199,
    accentColor: '#00BFA6',
    featured: false,
    badge: null,
    description: 'للوكالات والفرق',
    features: ['رصيد ذكاء اصطناعي غير محدود', 'حملات غير محدودة', '10 مساحات عمل', 'تصدير بالعلامة البيضاء', 'دعم مخصص'],
  },
]

export default function BillingPage() {
  const { isAuthenticated, loading, user, authHeader } = useAuth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [subscriptionStatus, setSubscriptionStatus] = useState<any>(null)
  const [checkingOut, setCheckingOut] = useState<string | null>(null)
  const [openingPortal, setOpeningPortal] = useState(false)
  const [notice, setNotice] = useState<{ type: 'success' | 'error', msg: string } | null>(null)

  useEffect(() => {
    if (!isAuthenticated) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === 'true') {
      setNotice({ type: 'success', msg: `🎉 مرحباً بك في Nexus AI ${params.get('plan') || ''}! اشتراكك الآن نشط.` })
      window.history.replaceState({}, '', '/billing')
    } else if (params.get('cancelled') === 'true') {
      setNotice({ type: 'error', msg: 'تم إلغاء عملية الدفع. لم يتم خصم أي مبلغ.' })
      window.history.replaceState({}, '', '/billing')
    }
    fetch('/api/billing/status', { headers: { Authorization: authHeader() } })
      .then(r => r.json())
      .then(d => setSubscriptionStatus(d))
      .catch(() => {})
  }, [isAuthenticated, authHeader])

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
      else setNotice({ type: 'error', msg: data.error || 'فشل بدء عملية الدفع.' })
    } catch {
      setNotice({ type: 'error', msg: 'فشلت عملية الدفع. يرجى المحاولة مجدداً.' })
    } finally { setCheckingOut(null) }
  }

  const handleManageSubscription = async () => {
    setOpeningPortal(true)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST', headers: { Authorization: authHeader() } })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else setNotice({ type: 'error', msg: 'تعذّر فتح بوابة الفواتير.' })
    } catch {
      setNotice({ type: 'error', msg: 'تعذّر فتح بوابة الفواتير.' })
    } finally { setOpeningPortal(false) }
  }

  if (loading) return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-accent-purple/20 border-t-accent-purple animate-spin" />
    </div>
  )
  if (!isAuthenticated) return null

  const currentPlan = subscriptionStatus?.plan || 'FREE'
  const isActive = subscriptionStatus?.status === 'ACTIVE'
  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'المستخدم'

  const glassCard = { background: 'rgba(17,21,54,0.5)', border: '1px solid rgba(108,99,255,0.1)', backdropFilter: 'blur(12px)' }

  return (
    <AppShell>
      <div dir="rtl">

        {/* Notice banner */}
        {notice && (
          <div className={`flex items-center justify-between gap-4 px-6 py-3 border-b text-sm ${notice.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 border-rose-500/20 text-rose-300'}`}>
            <span>{notice.msg}</span>
            <button onClick={() => setNotice(null)} className="font-bold px-2 opacity-70 hover:opacity-100">✕</button>
          </div>
        )}

        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

          {/* Header */}
          <div className="flex items-center justify-between mb-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-accent-purple" />
                <span className="text-xs font-mono uppercase tracking-widest text-text-muted">الاشتراك</span>
              </div>
              <h1 className="text-3xl font-bold font-heading text-white mb-1">الفواتير والخطط</h1>
              <p className="text-text-secondary text-sm">إدارة اشتراكك، {displayName}.</p>
            </div>
            {isActive && (
              <button onClick={handleManageSubscription} disabled={openingPortal}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-60"
                style={glassCard}>
                <Settings2 className="w-4 h-4 text-accent-purple" />
                {openingPortal ? 'جارٍ الفتح...' : 'إدارة الاشتراك'}
              </button>
            )}
          </div>

          {/* Current Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
            {[
              { label: 'الخطة الحالية',        value: currentPlan,    icon: '🏷️', featured: true },
              { label: 'الحالة',               value: isActive ? 'نشط' : 'مجاني', icon: '✅', featured: false },
              { label: 'أرصدة الذكاء الاصطناعي', value: subscriptionStatus?.credits === -1 ? 'غير محدودة' : String(subscriptionStatus?.credits ?? '—'), icon: '⚡', featured: false },
            ].map(stat => (
              <div key={stat.label} className="rounded-xl p-5" style={{
                background: stat.featured ? 'rgba(108,99,255,0.08)' : 'rgba(17,21,54,0.5)',
                border: stat.featured ? '1px solid rgba(108,99,255,0.3)' : '1px solid rgba(108,99,255,0.1)',
                backdropFilter: 'blur(12px)',
              }}>
                <div className="text-2xl mb-2">{stat.icon}</div>
                <div className="text-xs text-text-muted mb-1">{stat.label}</div>
                <div className={`text-2xl font-bold ${stat.featured ? 'text-accent-purple' : 'text-white'}`}>{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Upgrade prompt for free users */}
          {!isActive && (
            <div className="rounded-xl p-5 mb-10 flex items-center justify-between gap-4"
              style={{ background: 'rgba(108,99,255,0.06)', border: '1px solid rgba(108,99,255,0.2)' }}>
              <div>
                <div className="font-bold text-accent-purple mb-1">أنت على الخطة المجانية</div>
                <div className="text-sm text-text-secondary">قم بالترقية للحصول على المزيد من أرصدة الذكاء الاصطناعي وحملات غير محدودة والنشر على السوشيال ميديا.</div>
              </div>
              <a href="#plans" className="btn-gradient px-5 py-2.5 rounded-xl font-bold text-sm text-white whitespace-nowrap">
                الترقية الآن
              </a>
            </div>
          )}

          {/* Plan Cards */}
          <div id="plans" className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {PLANS.map(plan => {
              const isCurrent = currentPlan === plan.name.toUpperCase() && isActive
              return (
                <div key={plan.id} className="relative rounded-2xl p-8 transition-all duration-300"
                  style={{
                    background: plan.featured ? 'rgba(108,99,255,0.08)' : 'rgba(17,21,54,0.5)',
                    border: plan.featured ? '2px solid rgba(108,99,255,0.4)' : '1px solid rgba(108,99,255,0.12)',
                    backdropFilter: 'blur(12px)',
                    boxShadow: plan.featured ? '0 0 40px rgba(108,99,255,0.15)' : 'none',
                  }}>

                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-white text-xs font-bold px-4 py-1 rounded-full"
                      style={{ background: 'linear-gradient(135deg, #6C63FF, #9333EA)' }}>
                      {plan.badge}
                    </div>
                  )}

                  <div className="mb-2">
                    <h3 className="text-xl font-bold font-heading mb-1 text-white">{plan.nameAr}</h3>
                    <p className="text-xs text-text-muted mb-3">{plan.description}</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black text-white">${plan.price}</span>
                      <span className="text-text-muted text-sm">/شهر</span>
                    </div>
                  </div>

                  <ul className="space-y-3 mb-8 mt-6">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-sm text-text-secondary">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: plan.accentColor }} />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <div className="w-full py-3 text-center rounded-xl text-sm font-semibold"
                      style={{ background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.3)', color: '#6C63FF' }}>
                      ✓ خطتك الحالية
                    </div>
                  ) : (
                    <button onClick={() => handleUpgrade(plan.id)} disabled={checkingOut === plan.id}
                      className={`w-full py-3 rounded-xl font-bold transition-all text-sm disabled:opacity-60 ${plan.featured ? 'btn-gradient text-white' : 'text-white hover:opacity-90'}`}
                      style={!plan.featured ? { background: 'rgba(108,99,255,0.12)', border: '1px solid rgba(108,99,255,0.2)' } : {}}>
                      {checkingOut === plan.id ? '→ جارٍ التوجيه...' : `الترقية إلى ${plan.nameAr}`}
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* FAQ */}
          <div className="rounded-2xl p-8" style={glassCard}>
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="w-4 h-4 text-accent-purple" />
              <h2 className="text-xl font-bold font-heading text-white">الأسئلة الشائعة</h2>
            </div>
            <div className="space-y-6">
              {[
                { q: 'هل يمكنني الإلغاء في أي وقت؟',  a: 'نعم. يمكنك الإلغاء في أي وقت من خلال زر "إدارة الاشتراك". ستحتفظ بالوصول حتى نهاية فترة الفوترة.' },
                { q: 'ما هي أرصدة الذكاء الاصطناعي؟',  a: 'كل توليد للحملات يستهلك أرصدة. تتجدد الأرصدة شهرياً ولا تُنقل الأرصدة غير المستخدمة.' },
                { q: 'هل المدفوعات آمنة؟',              a: 'جميع المدفوعات تتم عبر Lemon Squeezy — بنية تحتية موثوقة للمدفوعات.' },
                { q: 'هل تقدمون استردادًا للمبالغ؟',   a: 'نقدم ضمان استرداد الأموال خلال 7 أيام. تواصل مع الدعم إذا لم تكن راضياً.' },
              ].map(faq => (
                <div key={faq.q} className="pb-6 last:pb-0" style={{ borderBottom: '1px solid rgba(108,99,255,0.08)' }}>
                  <h3 className="font-semibold mb-2 text-white">{faq.q}</h3>
                  <p className="text-text-secondary text-sm leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
