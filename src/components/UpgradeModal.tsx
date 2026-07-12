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
  reason?: 'no_credits' | 'low_credits' | 'upgrade_cta' | 'first_campaign'
}

const PLANS = [
  {
    id: 'pro',
    name: 'Growth',
    price: '$49',
    color: '#2563EB',
    popular: true,
    features: ['150 AI credits / month', '10 campaigns / month', '3 workspaces', '25 planned posts / month', 'Analytics + exports'],
  },
  {
    id: 'business',
    name: 'Autopilot',
    price: '$99',
    color: '#059669',
    features: ['500 AI credits / month', 'Unlimited campaigns', '10 workspaces', '60 planned posts / month', 'Continuous monitoring'],
  },
]

export default function UpgradeModal({ open, onClose, reason = 'upgrade_cta' }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  if (!open) return null

  const headline =
    reason === 'no_credits'      ? "You've used all your credits" :
    reason === 'low_credits'     ? "Running low on credits" :
    reason === 'first_campaign'  ? "🎉 Your campaign is live!" :
    "Unlock the full power of Nexus AI"

  const subline =
    reason === 'no_credits'      ? "Upgrade now to keep generating campaigns, content, and strategies." :
    reason === 'low_credits'     ? "Don't get interrupted mid-campaign. Upgrade for more credits." :
    reason === 'first_campaign'  ? "You've seen what Nexus AI can do. Upgrade for more monthly campaign capacity and deeper AI workflows." :
    "Run strategy, content, images, and reporting with clear monthly credits."

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
      const { url, code } = await res.json()
      if (url) window.location.href = url
      else if (code === 'BILLING_NOT_CONFIGURED') {
        setMessage('Paid plans are temporarily disabled during beta. Your free credits still work while Stripe setup is completed.')
      }
    } catch {
      setMessage('Could not start checkout. Please try again later.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.24)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>

      <div className="w-full max-w-2xl rounded-2xl overflow-hidden"
        style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 24px 70px rgba(15,23,42,0.16)' }}>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 text-center"
          style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
          <div className="text-2xl mb-1">⚡</div>
          <h2 className="text-xl font-bold text-slate-950 mb-1">{headline}</h2>
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
                background: plan.popular ? '#F8FAFF' : '#FFFFFF',
                border: `1px solid ${plan.popular ? 'rgba(37,99,235,0.24)' : 'rgba(15,23,42,0.08)'}`,
                boxShadow: plan.popular ? '0 14px 34px rgba(37,99,235,0.10)' : '0 1px 2px rgba(15,23,42,0.04)',
              }}>
              {plan.popular && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold text-white"
                  style={{ background: '#2563EB' }}>
                  MOST POPULAR
                </div>
              )}

              <div className="mb-3">
                <div className="text-xs font-semibold mb-1" style={{ color: plan.color }}>{plan.name}</div>
                <div className="text-2xl font-black text-slate-950">{plan.price}
                  <span className="text-xs font-normal text-slate-500">/mo</span>
                </div>
              </div>

              <ul className="space-y-1.5 flex-1 mb-4">
                {plan.features.map((f) => (
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
                  background: plan.popular ? '#111827' : '#F9FAFB',
                  color: plan.popular ? 'white' : '#111827',
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
