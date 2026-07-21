'use client'

/**
 * UpgradeModal — conversion-optimized upgrade prompt.
 * Shown when:
 *   - User hits INSUFFICIENT_CREDITS
 *   - User clicks upgrade CTA anywhere in the app
 *
 * Usage:
 *   const [showUpgrade, setShowUpgrade] = useState(false)
 *   <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useI18n } from '@/lib/i18n-context'
import { PUBLIC_PAID_PLANS } from '@/lib/commercialPlans'

const GROWTH = PUBLIC_PAID_PLANS[0]
const AUTOPILOT = PUBLIC_PAID_PLANS[1]

interface Props {
  open: boolean
  onClose: () => void
  /** Why the modal was triggered — shown in headline */
  reason?: 'no_credits' | 'low_credits' | 'upgrade_cta' | 'first_campaign'
}

const PLANS = [
  {
    id: 'pro',
    name: 'Growth',
    price: `$${GROWTH.priceUsd}`,
    color: '#2563EB',
    featured: true,
    featuresEn: [`${GROWTH.monthlyCredits} AI credits / month`, `Up to ${GROWTH.campaignLimit} campaign workspaces; AI operations use credits`, '1 Full Standard workflow to drafts or 4 reviewed Organic Light strategies', `Up to ${GROWTH.postsPerMonth} planned copy drafts / month`, 'Separate approvals before execution', 'Analytics + exports'],
    featuresAr: [`${GROWTH.monthlyCredits} كريديت AI شهريًا`, `حتى ${GROWTH.campaignLimit} مساحات حملات؛ عمليات AI بالكريديت`, 'رحلة Full Standard واحدة إلى المسودات أو 4 استراتيجيات Organic Light مراجعة', `حتى ${GROWTH.postsPerMonth} مسودة نص مخططة شهريًا`, 'موافقات منفصلة قبل التنفيذ', 'تحليلات وتصدير'],
  },
  {
    id: 'business',
    name: 'Autopilot',
    price: `$${AUTOPILOT.priceUsd}`,
    color: '#059669',
    featuresEn: [`${AUTOPILOT.monthlyCredits} AI credits / month`, `Up to ${AUTOPILOT.campaignLimit} campaign workspaces; AI operations use credits`, '3 Full Standard workflows to drafts or 12 reviewed Organic Light strategies', `Up to ${AUTOPILOT.postsPerMonth} planned copy drafts / month`, 'Operations center', 'Scheduled monitoring + action queue'],
    featuresAr: [`${AUTOPILOT.monthlyCredits} كريديت AI شهريًا`, `حتى ${AUTOPILOT.campaignLimit} مساحة حملة؛ عمليات AI بالكريديت`, '3 رحلات Full Standard إلى المسودات أو 12 استراتيجية Organic Light مراجعة', `حتى ${AUTOPILOT.postsPerMonth} مسودة نص مخططة شهريًا`, 'مركز العمليات', 'مراقبة مجدولة وقائمة قرارات'],
  },
]

export default function UpgradeModal({ open, onClose, reason = 'upgrade_cta' }: Props) {
  const router = useRouter()
  const { locale, dir } = useI18n()
  const ar = locale === 'ar'
  const [loading, setLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  if (!open) return null

  const headline =
    reason === 'no_credits'      ? (ar ? 'استخدمت كل الكريديت المتاح' : "You've used all your credits") :
    reason === 'low_credits'     ? (ar ? 'رصيدك يقترب من النفاد' : 'Running low on credits') :
    reason === 'first_campaign'  ? (ar ? '🎉 مسودة حملتك جاهزة' : '🎉 Your campaign draft is ready') :
    (ar ? 'وسّع قدرة تشغيل NEXUS' : 'Unlock the full power of Nexus AI')

  const subline =
    reason === 'no_credits'      ? (ar ? 'اختر باقة أو اشترِ كريديت إضافيًا لمتابعة الاستراتيجية والمحتوى.' : 'Choose a plan or buy more credits to continue strategy and content work.') :
    reason === 'low_credits'     ? (ar ? 'تجنب توقف العمل في منتصف الحملة مع رصيد شهري أكبر.' : "Avoid an interruption mid-campaign with more monthly credits.") :
    reason === 'first_campaign'  ? (ar ? 'وسّع سعة الحملات الشهرية مع بقاء كل تنفيذ تحت موافقتك.' : 'Increase monthly campaign capacity while every execution stays under your approval.') :
    (ar ? 'شغّل الاستراتيجية والمحتوى والصور والتقارير بكريديت شهري واضح.' : 'Run strategy, content, images, and reporting with clear monthly credits.')

  const handleUpgrade = async (planId: string) => {
    setLoading(planId)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/auth/login'); return }

    try {
      const requestId = globalThis.crypto?.randomUUID?.()
        ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan: planId, requestId }),
      })
      const { url, code } = await res.json()
      if (url) window.location.href = url
      else if (code === 'MANAGE_EXISTING_SUBSCRIPTION') {
        onClose()
        router.push('/billing')
      }
      else if (code === 'BILLING_NOT_CONFIGURED') {
        setMessage(ar
          ? 'الباقات المدفوعة متوقفة مؤقتًا في النسخة التجريبية. يظل رصيدك الحالي متاحًا حتى اكتمال إعداد Stripe.'
          : 'Paid plans are temporarily disabled during beta. Your current credits still work while Stripe setup is completed.')
      }
    } catch {
      setMessage(ar ? 'تعذر بدء الدفع. حاول مرة أخرى لاحقًا.' : 'Could not start checkout. Please try again later.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      dir={dir}
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
      style={{ background: 'rgba(15,23,42,0.24)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>

      <div className="w-full max-w-2xl rounded-2xl overflow-hidden"
        style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 24px 70px rgba(15,23,42,0.16)' }}>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 text-center"
          style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
          <div className="text-2xl mb-1">⚡</div>
          <h2 id="upgrade-modal-title" className="text-xl font-bold text-slate-950 mb-1">{headline}</h2>
          <p className="text-sm text-slate-500">{subline}</p>
        </div>

        {/* Plans */}
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {message && (
            <div className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {message}
            </div>
          )}

          {PLANS.map((plan) => (
            <div key={plan.id}
              className="rounded-xl p-4 flex flex-col relative"
              style={{
                background: plan.featured ? '#F8FAFF' : '#FFFFFF',
                border: `1px solid ${plan.featured ? 'rgba(37,99,235,0.24)' : 'rgba(15,23,42,0.08)'}`,
                boxShadow: plan.featured ? '0 14px 34px rgba(37,99,235,0.10)' : '0 1px 2px rgba(15,23,42,0.04)',
              }}>
              {plan.featured && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold text-white"
                  style={{ background: '#2563EB' }}>
                  {ar ? 'الخطة الأساسية' : 'CORE PLAN'}
                </div>
              )}

              <div className="mb-3">
                <div className="text-xs font-semibold mb-1" style={{ color: plan.color }}>{plan.name}</div>
                <div className="text-2xl font-black text-slate-950">{plan.price}
                  <span className="text-xs font-normal text-slate-500">/{ar ? 'شهر' : 'mo'}</span>
                </div>
              </div>

              <ul className="space-y-1.5 flex-1 mb-4">
                {(ar ? plan.featuresAr : plan.featuresEn).map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-[11px] text-slate-600">
                    <span style={{ color: plan.color }} className="mt-0.5 flex-shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleUpgrade(plan.id)}
                disabled={!!loading}
                className="w-full py-2 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: plan.featured ? '#111827' : '#F9FAFB',
                  color: plan.featured ? 'white' : '#111827',
                  border: plan.featured ? 'none' : `1px solid ${plan.color}40`,
                  opacity: loading && loading !== plan.id ? 0.5 : 1,
                }}>
                {loading === plan.id ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {ar ? 'جارٍ التحويل…' : 'Loading…'}
                  </span>
                ) : ar ? `ابدأ ${plan.name}` : `Start ${plan.name}`}
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 text-center space-y-2">
          <p className="text-[11px] text-text-muted">
            {ar
              ? 'Stripe Sandbox أثناء الاختبار · المدفوعات الأولى المؤهلة لها نافذة استرداد 14 يومًا · الإلغاء متاح في أي وقت'
              : 'Stripe Sandbox during testing · Qualified first payments have a 14-day refund window · Cancel any time'}
          </p>
          <button onClick={onClose}
            className="text-[11px] text-text-muted hover:text-text-secondary transition-colors underline underline-offset-2">
            {ar ? 'الاستمرار بالرصيد الحالي' : 'Continue with current credits'}
          </button>
        </div>
      </div>
    </div>
  )
}
