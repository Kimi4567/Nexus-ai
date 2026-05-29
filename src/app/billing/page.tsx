'use client'

import { useAuth } from '@/lib/auth-context'
import { useEffect, useState } from 'react'
import AppShell from '@/components/AppShell'

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    nameAr: 'المبتدئ',
    price: 29,
    features: ['50 رصيد ذكاء اصطناعي / شهر', '3 حملات / شهر', 'مساحة عمل واحدة', 'تصدير PDF', 'دعم بالبريد الإلكتروني'],
    color: 'border-dark-tertiary',
    badge: null,
    description: 'مثالي للأفراد والمبدعين',
  },
  {
    id: 'pro',
    name: 'Pro',
    nameAr: 'الاحترافي',
    price: 79,
    features: ['200 رصيد ذكاء اصطناعي / شهر', 'حملات غير محدودة', '3 مساحات عمل', 'نشر على السوشيال ميديا', 'دعم متقدم'],
    color: 'border-accent',
    badge: 'الأكثر شيوعاً',
    description: 'للعلامات التجارية النامية',
  },
  {
    id: 'agency',
    name: 'Agency',
    nameAr: 'الوكالات',
    price: 199,
    features: ['رصيد ذكاء اصطناعي غير محدود', 'حملات غير محدودة', '10 مساحات عمل', 'تصدير بالعلامة البيضاء', 'دعم مخصص'],
    color: 'border-dark-tertiary',
    badge: null,
    description: 'للوكالات والفرق',
  },
]

export default function BillingPage() {
  const { isAuthenticated, loading, user, authHeader } = useAuth()
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

    const token = authHeader()
    fetch('/api/billing/status', { headers: { Authorization: token } })
      .then(r => r.json())
      .then(d => setSubscriptionStatus(d))
      .catch(() => {})
  }, [isAuthenticated, authHeader])

  const handleUpgrade = async (planId: string) => {
    setCheckingOut(planId)
    const token = authHeader()
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setNotice({ type: 'error', msg: data.error || 'فشل بدء عملية الدفع.' })
      }
    } catch {
      setNotice({ type: 'error', msg: 'فشلت عملية الدفع. يرجى المحاولة مجدداً.' })
    } finally {
      setCheckingOut(null)
    }
  }

  const handleManageSubscription = async () => {
    setOpeningPortal(true)
    const token = authHeader()
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { Authorization: token },
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else setNotice({ type: 'error', msg: 'تعذّر فتح بوابة الفواتير.' })
    } catch {
      setNotice({ type: 'error', msg: 'تعذّر فتح بوابة الفواتير.' })
    } finally {
      setOpeningPortal(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-dark flex items-center justify-center"><div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
  if (!isAuthenticated) return null

  const currentPlan = subscriptionStatus?.plan || 'FREE'
  const isActive = subscriptionStatus?.status === 'ACTIVE'
  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'المستخدم'

  return (
    <AppShell>
      <div dir="rtl">

        {/* Notice banner */}
        {notice && (
          <div className={`flex items-center justify-between gap-4 px-6 py-3 border-b text-sm ${notice.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-300' : 'bg-red-500/10 border-red-500/20 text-red-300'}`}>
            <span>{notice.msg}</span>
            <button onClick={() => setNotice(null)} className="font-bold px-2 opacity-70 hover:opacity-100">✕</button>
          </div>
        )}

        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 page-enter">

          {/* Header */}
          <div className="flex items-center justify-between mb-10">
            <div>
              <h1 className="text-3xl font-bold mb-1">الفواتير والخطط</h1>
              <p className="text-gray-400">إدارة اشتراكك، {displayName}.</p>
            </div>
            {isActive && (
              <button
                onClick={handleManageSubscription}
                disabled={openingPortal}
                className="px-5 py-2.5 bg-dark-secondary border border-dark-tertiary rounded-lg text-sm font-semibold hover:border-accent/50 transition disabled:opacity-60"
              >
                {openingPortal ? 'جارٍ الفتح...' : '⚙️ إدارة الاشتراك'}
              </button>
            )}
          </div>

          {/* Current Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
            {[
              { label: 'الخطة الحالية', value: currentPlan, icon: '🏷️', accent: true },
              { label: 'الحالة', value: isActive ? 'نشط' : 'مجاني', icon: '✅', accent: false },
              { label: 'أرصدة الذكاء الاصطناعي', value: subscriptionStatus?.credits === -1 ? 'غير محدودة' : String(subscriptionStatus?.credits ?? '—'), icon: '⚡', accent: false },
            ].map(stat => (
              <div key={stat.label} className={`rounded-xl border p-5 ${stat.accent ? 'border-accent/40 bg-accent/5' : 'border-dark-tertiary bg-dark-secondary'}`}>
                <div className="text-2xl mb-2">{stat.icon}</div>
                <div className="text-xs text-gray-400 mb-1">{stat.label}</div>
                <div className={`text-2xl font-bold ${stat.accent ? 'text-accent' : ''}`}>{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Upgrade prompt for free users */}
          {!isActive && (
            <div className="bg-accent/5 border border-accent/20 rounded-xl p-5 mb-10 flex items-center justify-between gap-4">
              <div>
                <div className="font-bold text-accent mb-1">أنت على الخطة المجانية</div>
                <div className="text-sm text-gray-400">قم بالترقية للحصول على المزيد من أرصدة الذكاء الاصطناعي وحملات غير محدودة والنشر على السوشيال ميديا.</div>
              </div>
              <a href="#plans" className="px-5 py-2 bg-accent text-dark font-bold rounded-lg text-sm hover:bg-accent-light transition whitespace-nowrap">
                الترقية الآن
              </a>
            </div>
          )}

          {/* Plan Cards */}
          <div id="plans" className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {PLANS.map(plan => {
              const isCurrent = currentPlan === plan.name.toUpperCase() && isActive
              return (
                <div key={plan.id} className={`relative rounded-2xl border-2 p-8 ${plan.color} ${plan.badge ? 'bg-accent/5' : 'bg-dark-secondary'}`}>
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-dark text-xs font-bold px-4 py-1 rounded-full">
                      {plan.badge}
                    </div>
                  )}

                  <div className="mb-2">
                    <h3 className="text-xl font-bold mb-1">{plan.nameAr}</h3>
                    <p className="text-xs text-gray-500 mb-3">{plan.description}</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black">${plan.price}</span>
                      <span className="text-gray-400 text-sm">/شهر</span>
                    </div>
                  </div>

                  <ul className="space-y-3 mb-8 mt-6">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                        <span className="text-accent text-base">✓</span> {f}
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <div className="w-full py-3 text-center bg-accent/10 border border-accent/30 rounded-xl text-sm text-accent font-semibold">
                      ✓ خطتك الحالية
                    </div>
                  ) : (
                    <button
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={checkingOut === plan.id}
                      className={`w-full py-3 rounded-xl font-bold transition text-sm disabled:opacity-60 ${plan.badge ? 'bg-accent text-dark hover:bg-accent-light' : 'bg-dark-tertiary hover:bg-dark-tertiary/70'}`}
                    >
                      {checkingOut === plan.id ? '→ جارٍ التحويل إلى Stripe...' : `الترقية إلى ${plan.nameAr}`}
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* FAQ */}
          <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-8">
            <h2 className="text-xl font-bold mb-6">الأسئلة الشائعة</h2>
            <div className="space-y-6">
              {[
                { q: 'هل يمكنني الإلغاء في أي وقت؟', a: 'نعم. يمكنك الإلغاء في أي وقت من خلال زر "إدارة الاشتراك". ستحتفظ بالوصول حتى نهاية فترة الفوترة.' },
                { q: 'ما هي أرصدة الذكاء الاصطناعي؟', a: 'كل توليد للحملات يستهلك أرصدة. تتجدد الأرصدة شهرياً ولا تُنقل الأرصدة غير المستخدمة.' },
                { q: 'هل المدفوعات آمنة؟', a: 'جميع المدفوعات تتم عبر Stripe — البنية التحتية للمدفوعات المستخدمة من Amazon وGoogle وShopify.' },
                { q: 'هل تقدمون استردادًا للمبالغ؟', a: 'نقدم ضمان استرداد الأموال خلال 7 أيام. تواصل مع الدعم إذا لم تكن راضياً.' },
              ].map(faq => (
                <div key={faq.q} className="border-b border-dark-tertiary pb-6 last:border-0 last:pb-0">
                  <h3 className="font-semibold mb-2">{faq.q}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
