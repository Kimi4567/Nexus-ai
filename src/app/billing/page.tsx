'use client'

import { useAuth } from '@/lib/auth-context'
import { useEffect, useState } from 'react'
import AppShell from '@/components/AppShell'

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 29,
    period: 'month',
    features: ['50 AI credits/month', '3 campaigns/month', '1 workspace', 'PDF exports', 'Email support'],
    color: 'border-dark-tertiary',
    badge: null,
    description: 'Perfect for solo creators',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 79,
    period: 'month',
    features: ['200 AI credits/month', 'Unlimited campaigns', '3 workspaces', 'Social publishing', 'Priority support'],
    color: 'border-accent',
    badge: 'Most Popular',
    description: 'For growing brands',
  },
  {
    id: 'agency',
    name: 'Agency',
    price: 199,
    period: 'month',
    features: ['Unlimited AI credits', 'Unlimited campaigns', '10 workspaces', 'White label exports', 'Dedicated support'],
    color: 'border-dark-tertiary',
    badge: null,
    description: 'For agencies & teams',
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
    // Read URL params for success/cancel
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === 'true') {
      setNotice({ type: 'success', msg: `🎉 Welcome to Nexus AI ${params.get('plan') || ''}! Your subscription is now active.` })
      window.history.replaceState({}, '', '/billing')
    } else if (params.get('cancelled') === 'true') {
      setNotice({ type: 'error', msg: 'Checkout was cancelled. No charge was made.' })
      window.history.replaceState({}, '', '/billing')
    }

    // Fetch subscription status
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
        setNotice({ type: 'error', msg: data.error || 'Failed to start checkout.' })
      }
    } catch {
      setNotice({ type: 'error', msg: 'Checkout failed. Please try again.' })
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
      else setNotice({ type: 'error', msg: 'Could not open billing portal.' })
    } catch {
      setNotice({ type: 'error', msg: 'Could not open billing portal.' })
    } finally {
      setOpeningPortal(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-dark flex items-center justify-center"><div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
  if (!isAuthenticated) return null

  const currentPlan = subscriptionStatus?.plan || 'FREE'
  const isActive = subscriptionStatus?.status === 'ACTIVE'
  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'User'

  return (
    <AppShell>

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
            <h1 className="text-3xl font-bold mb-1">Billing & Plans</h1>
            <p className="text-gray-400">Manage your subscription, {displayName}.</p>
          </div>
          {isActive && (
            <button
              onClick={handleManageSubscription}
              disabled={openingPortal}
              className="px-5 py-2.5 bg-dark-secondary border border-dark-tertiary rounded-lg text-sm font-semibold hover:border-accent/50 transition disabled:opacity-60"
            >
              {openingPortal ? 'Opening...' : '⚙️ Manage Subscription'}
            </button>
          )}
        </div>

        {/* Current Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {[
            { label: 'Current Plan', value: currentPlan, icon: '🏷️', accent: true },
            { label: 'Status', value: isActive ? 'Active' : 'Free', icon: '✅', accent: false },
            { label: 'AI Credits', value: subscriptionStatus?.credits === -1 ? 'Unlimited' : String(subscriptionStatus?.credits ?? '—'), icon: '⚡', accent: false },
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
          <div className="bg-accent/5 border border-accent/20 rounded-xl p-5 mb-10 flex items-center justify-between">
            <div>
              <div className="font-bold text-accent mb-1">You're on the Free plan</div>
              <div className="text-sm text-gray-400">Upgrade to unlock more AI credits, unlimited campaigns, and social publishing.</div>
            </div>
            <a href="#plans" className="px-5 py-2 bg-accent text-dark font-bold rounded-lg text-sm hover:bg-accent-light transition whitespace-nowrap">
              Upgrade Now
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
                  <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                  <p className="text-xs text-gray-500 mb-3">{plan.description}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black">${plan.price}</span>
                    <span className="text-gray-400 text-sm">/{plan.period}</span>
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
                    ✓ Current Plan
                  </div>
                ) : (
                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={checkingOut === plan.id}
                    className={`w-full py-3 rounded-xl font-bold transition text-sm disabled:opacity-60 ${plan.badge ? 'bg-accent text-dark hover:bg-accent-light' : 'bg-dark-tertiary hover:bg-dark-tertiary/70'}`}
                  >
                    {checkingOut === plan.id ? '→ Redirecting to Stripe...' : `Upgrade to ${plan.name}`}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* FAQ */}
        <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-8">
          <h2 className="text-xl font-bold mb-6">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {[
              { q: 'Can I cancel anytime?', a: 'Yes. Cancel anytime from the "Manage Subscription" button above. You keep access until the end of your billing period.' },
              { q: 'What are AI credits?', a: 'Each campaign generation uses AI credits. Credits reset monthly. Unused credits don\'t roll over.' },
              { q: 'Is my payment secure?', a: 'All payments are processed by Stripe — the same payment infrastructure used by Amazon, Google, and Shopify.' },
              { q: 'Do you offer refunds?', a: 'We offer a 7-day money-back guarantee. Contact support if you\'re not satisfied.' },
            ].map(faq => (
              <div key={faq.q} className="border-b border-dark-tertiary pb-6 last:border-0 last:pb-0">
                <h3 className="font-semibold mb-2">{faq.q}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}