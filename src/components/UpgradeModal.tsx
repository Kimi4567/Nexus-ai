'use client'

/**
 * UpgradeModal — shown when user hits credit limit or tries a gated feature.
 *
 * Usage:
 *   <UpgradeModal
 *     isOpen={showUpgrade}
 *     onClose={() => setShowUpgrade(false)}
 *     trigger="campaign"  // which action triggered it
 *     creditsRemaining={3}
 *   />
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n-context'
import { Zap, X, CheckCircle2, ArrowUpRight, Sparkles } from 'lucide-react'

type UpgradeTrigger =
  | 'campaign'
  | 'strategy'
  | 'creative-brief'
  | 'sentinel'
  | 'video'
  | 'generic'

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  trigger?: UpgradeTrigger
  creditsRemaining?: number
}

const TRIGGER_COPY = {
  campaign: {
    ar: { title: 'لإنشاء حملة جديدة تحتاج أرصدة AI', desc: 'توليد الحملة يستهلك 5 أرصدة' },
    en: { title: 'You need AI credits to create a campaign', desc: 'Campaign generation costs 5 credits' },
  },
  strategy: {
    ar: { title: 'لتشغيل الاستراتيجية الكاملة تحتاج أرصدة AI', desc: 'Run Full Strategy يستهلك 5 أرصدة' },
    en: { title: 'You need AI credits to run a full strategy', desc: 'Run Full Strategy costs 5 credits' },
  },
  'creative-brief': {
    ar: { title: 'Creative Brief يحتاج أرصدة AI', desc: 'توليد البريف يستهلك 2 رصيد' },
    en: { title: 'Creative Brief requires AI credits', desc: 'Brief generation costs 2 credits' },
  },
  sentinel: {
    ar: { title: 'Sentinel Review يحتاج رصيد AI', desc: 'مراجعة الجودة تستهلك رصيداً واحداً' },
    en: { title: 'Sentinel Review requires AI credits', desc: 'Quality review costs 1 credit' },
  },
  video: {
    ar: { title: 'توليد الفيديو يحتاج أرصدة AI', desc: 'Video Generation يستهلك 5 أرصدة' },
    en: { title: 'Video generation requires AI credits', desc: 'Video generation costs 5 credits' },
  },
  generic: {
    ar: { title: 'نفدت أرصدة AI الخاصة بك', desc: 'قم بالترقية للمتابعة' },
    en: { title: 'You\'ve run out of AI credits', desc: 'Upgrade to continue' },
  },
}

export default function UpgradeModal({ isOpen, onClose, trigger = 'generic', creditsRemaining = 0 }: UpgradeModalProps) {
  const { locale } = useI18n()
  const router = useRouter()
  const ar = locale === 'ar'

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const copy = TRIGGER_COPY[trigger][ar ? 'ar' : 'en']

  const plans = [
    {
      id: 'starter', name: ar ? 'المبتدئ' : 'Starter', price: 29,
      credits: '50', color: '#6C63FF', featured: false,
      ctaAr: 'ابدأ بـ Starter', ctaEn: 'Start Starter',
    },
    {
      id: 'pro', name: ar ? 'الاحترافي' : 'Pro', price: 79,
      credits: '200', color: '#6C63FF', featured: true,
      ctaAr: 'ترقية إلى Pro', ctaEn: 'Upgrade to Pro',
    },
    {
      id: 'agency', name: ar ? 'الوكالات' : 'Agency', price: 199,
      credits: ar ? 'غير محدود' : 'Unlimited', color: '#00BFA6', featured: false,
      ctaAr: 'ترقية إلى Agency', ctaEn: 'Upgrade to Agency',
    },
  ]

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(10,14,39,0.98)',
          border: '1px solid rgba(108,99,255,0.25)',
          boxShadow: '0 0 60px rgba(108,99,255,0.15)',
        }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4" style={{ borderBottom: '1px solid rgba(108,99,255,0.1)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(255,107,53,0.12)', border: '1px solid rgba(255,107,53,0.2)' }}>
                <Zap className="w-5 h-5" style={{ color: '#FF6B35' }} />
              </div>
              <div>
                <h3 className="font-bold text-white text-base leading-tight">{copy.title}</h3>
                <p className="text-xs text-text-muted mt-0.5">
                  {ar
                    ? `رصيدك الحالي: ${creditsRemaining} وحدة — ${copy.desc}`
                    : `Current balance: ${creditsRemaining} credit${creditsRemaining !== 1 ? 's' : ''} — ${copy.desc}`}
                </p>
              </div>
            </div>
            <button onClick={onClose}
              className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/5 transition-all flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Plans */}
        <div className="p-4 space-y-3">
          {plans.map(plan => (
            <div key={plan.id}
              className="flex items-center justify-between p-4 rounded-xl transition-all"
              style={{
                background: plan.featured ? 'rgba(108,99,255,0.08)' : 'rgba(255,255,255,0.03)',
                border: plan.featured ? '1px solid rgba(108,99,255,0.3)' : '1px solid rgba(255,255,255,0.05)',
              }}>
              <div className="flex items-center gap-3">
                {plan.featured && (
                  <Sparkles className="w-4 h-4 flex-shrink-0" style={{ color: plan.color }} />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-white">{plan.name}</p>
                    {plan.featured && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(108,99,255,0.2)', color: '#a5a0ff' }}>
                        {ar ? 'الأشهر' : 'Popular'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted">
                    {ar ? `${plan.credits} رصيد` : `${plan.credits} credits`}
                    {' · '}
                    <span className="text-white font-medium">${plan.price}/{ar ? 'شهر' : 'mo'}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => { onClose(); router.push(`/billing?plan=${plan.id}`) }}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg transition-all hover:brightness-110"
                style={{
                  background: plan.featured ? 'rgba(108,99,255,0.2)' : 'rgba(255,255,255,0.05)',
                  color: plan.featured ? '#a5a0ff' : '#9ca3af',
                  border: `1px solid ${plan.featured ? 'rgba(108,99,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
                }}>
                {ar ? plan.ctaAr : plan.ctaEn}
                <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-text-muted">
              {ar ? '✓ ضمان استرداد 7 أيام · إلغاء في أي وقت' : '✓ 7-day refund · Cancel anytime'}
            </p>
            <button onClick={onClose} className="text-xs text-text-muted hover:text-white transition-all">
              {ar ? 'لاحقاً' : 'Maybe later'}
            </button>
          </div>

          {/* Feature highlights */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              { textAr: 'Brand Brain', textEn: 'Brand Brain' },
              { textAr: 'نشر تلقائي', textEn: 'Auto-publish' },
              { textAr: 'تحليلات', textEn: 'Analytics' },
            ].map(f => (
              <div key={f.textEn} className="flex items-center gap-1.5 text-[10px] text-text-muted">
                <CheckCircle2 className="w-3 h-3 text-accent-teal flex-shrink-0" />
                {ar ? f.textAr : f.textEn}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
