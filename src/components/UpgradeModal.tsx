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

interface Props {
  open: boolean
  onClose: () => void
  /** Why the modal was triggered — shown in headline */
  reason?: 'no_credits' | 'low_credits' | 'upgrade_cta'
}

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$29',
    color: '#6C63FF',
    features: ['50 AI credits / month', '3 campaigns / month', '1 workspace', 'PDF export'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$79',
    color: '#00BFA6',
    popular: true,
    features: ['200 AI credits / month', 'Unlimited campaigns', '3 workspaces', 'Auto-publish to social', 'Real performance analytics', 'Priority support'],
  },
  {
    id: 'agency',
    name: 'Agency',
    price: '$199',
    color: '#F59E0B',
    features: ['Unlimited AI credits', 'Unlimited campaigns', '10 workspaces', 'White-label export', 'API access', 'Dedicated account manager'],
  },
]

export default function UpgradeModal({ open, onClose, reason = 'upgrade_cta' }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  if (!open) return null

  const headline =
    reason === 'no_credits'  ? "You've used all your credits" :
    reason === 'low_credits' ? "Running low on credits" :
    "Unlock the full power of Nexus AI"

  const subline =
    reason === 'no_credits'  ? "Upgrade now to keep generating campaigns, content, and strategies." :
    reason === 'low_credits' ? "Don't get interrupted mid-campaign. Upgrade for more credits." :
    "Replace your entire marketing team with one AI platform."

  const handleUpgrade = async (planId: string) => {
    setLoading(planId)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/auth/login'); return }

    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan: planId }),
      })
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch {
      setLoading(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>

      <div className="w-full max-w-2xl rounded-2xl overflow-hidden"
        style={{ background: '#0F1430', border: '1px solid rgba(108,99,255,0.25)' }}>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 text-center"
          style={{ borderBottom: '1px solid rgba(108,99,255,0.1)' }}>
          <div className="text-2xl mb-1">⚡</div>
          <h2 className="text-xl font-bold text-white mb-1">{headline}</h2>
          <p className="text-sm text-text-muted">{subline}</p>
        </div>

        {/* Plans */}
        <div className="p-6 grid grid-cols-3 gap-3">
          {PLANS.map((plan) => (
            <div key={plan.id}
              className="rounded-xl p-4 flex flex-col relative"
              style={{
                background: plan.popular ? 'rgba(0,191,166,0.06)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${plan.popular ? 'rgba(0,191,166,0.3)' : 'rgba(108,99,255,0.15)'}`,
              }}>
              {plan.popular && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold text-white"
                  style={{ background: '#00BFA6' }}>
                  MOST POPULAR
                </div>
              )}

              <div className="mb-3">
                <div className="text-xs font-semibold mb-1" style={{ color: plan.color }}>{plan.name}</div>
                <div className="text-2xl font-black text-white">{plan.price}
                  <span className="text-xs font-normal text-text-muted">/mo</span>
                </div>
              </div>

              <ul className="space-y-1.5 flex-1 mb-4">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-[11px] text-text-secondary">
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
                  background: plan.popular ? '#00BFA6' : 'rgba(108,99,255,0.15)',
                  color: plan.popular ? 'white' : plan.color,
                  border: plan.popular ? 'none' : `1px solid ${plan.color}40`,
                  opacity: loading && loading !== plan.id ? 0.5 : 1,
                }}>
                {loading === plan.id ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Loading…
                  </span>
                ) : `Start ${plan.name}`}
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 text-center space-y-2">
          <p className="text-[11px] text-text-muted">
            Secure payment via Stripe · 7-day refund guarantee · Cancel any time
          </p>
          <button onClick={onClose}
            className="text-[11px] text-text-muted hover:text-text-secondary transition-colors underline underline-offset-2">
            Continue with free plan
          </button>
        </div>
      </div>
    </div>
  )
}
