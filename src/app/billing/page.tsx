'use client'

import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import AppShell from '@/components/AppShell'

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 19,
    period: 'month',
    credits: 100,
    campaigns: 10,
    exports: 20,
    features: ['10 campaigns/month', '100 AI credits', 'All 5 platforms', 'Content calendar', 'Email support'],
    color: 'border-dark-tertiary',
    badge: null,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 49,
    period: 'month',
    credits: 500,
    campaigns: -1,
    exports: -1,
    features: ['Unlimited campaigns', '500 AI credits', 'All platforms', 'PDF exports', 'Priority support', 'Custom brand tone', 'Advanced analytics'],
    color: 'border-accent',
    badge: 'Most Popular',
  },
  {
    id: 'agency',
    name: 'Agency',
    price: 149,
    period: 'month',
    credits: -1,
    campaigns: -1,
    exports: -1,
    features: ['Unlimited everything', 'Multiple workspaces', 'Team collaboration', 'White-label exports', 'Dedicated support', 'API access'],
    color: 'border-dark-tertiary',
    badge: null,
  },
]

export default function BillingPage() {
  const { isAuthenticated, loading, user, authHeader } = useAuth()
  const [usage, setUsage] = useState<any>(null)
  const [checkingOut, setCheckingOut] = useState<string | null>(null)
  const [annual, setAnnual] = useState(false)
  const [billingNotice, setBillingNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) return
    const token = authHeader()
    fetch('/api/analytics/overview', { headers: { Authorization: token } })
      .then(r => r.json())
      .then(d => setUsage(d))
      .catch(() => {})
  }, [isAuthenticated, authHeader])

  const handleUpgrade = async (planId: string) => {
    setCheckingOut(planId)
    const token = authHeader()
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId, annual }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else setBillingNotice('Stripe is not configured yet. Add STRIPE_SECRET_KEY to your environment to enable payments.')
    } catch {
      setBillingNotice('Billing is not configured yet. Add your Stripe keys to enable payments.')
    } finally {
      setCheckingOut(null)
    }
  }

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
  if (!isAuthenticated) return null

  const currentPlan = 'FREE'
  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'User'

  return (
    <AppShell>

      {/* Billing notice banner */}
      {billingNotice && (
        <div className="flex items-center justify-between gap-4 px-6 py-3 bg-yellow-500/10 border-b border-yellow-500/20 text-yellow-300 text-sm">
          <span>⚠️ {billingNotice}</span>
          <button onClick={() => setBillingNotice(null)} className="text-yellow-400 hover:text-yellow-200 font-bold px-2">✕</button>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 py-12 page-enter">

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-1">Billing & Plans</h1>
          <p className="text-gray-400">Manage your subscription and usage, {displayName}.</p>
        </div>

        {/* Current Status */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
          {[
            { label: 'Current Plan', value: currentPlan, icon: '🏷️', accent: true },
            { label: 'Campaigns This Month', value: String(usage?.campaignsCount ?? '—'), icon: '📊', accent: false },
            { label: 'AI Generations', value: String(usage?.generationsCount ?? '—'), icon: '⚡', accent: false },
            { label: 'Exports', value: String(usage?.exportsCount ?? '—'), icon: '📦', accent: false },
          ].map(stat => (
            <div key={stat.label} className={`rounded-xl border p-5 ${stat.accent ? 'border-accent/40 bg-accent/5' : 'border-dark-tertiary bg-dark-secondary'}`}>
              <div className="text-2xl mb-2">{stat.icon}</div>
              <div className="text-xs text-gray-400 mb-1">{stat.label}</div>
              <div className={`text-2xl font-bold ${stat.accent ? 'text-accent' : ''}`}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Free plan notice */}
        <div className="bg-accent/5 border border-accent/20 rounded-xl p-5 mb-10 flex items-center justify-between">
          <div>
            <div className="font-bold text-accent mb-1">You're on the Free plan</div>
            <div className="text-sm text-gray-400">Upgrade to unlock unlimited campaigns, more AI credits, and PDF exports.</div>
          </div>
          <a href="#plans" className="px-5 py-2 bg-accent text-dark font-bold rounded-lg text-sm hover:bg-accent-light transition whitespace-nowrap">
            Upgrade Now
          </a>
        </div>

        {/* Billing toggle */}
        <div id="plans" className="flex items-center justify-center gap-4 mb-8">
          <span className={`text-sm font-semibold ${!annual ? 'text-white' : 'text-gray-500'}`}>Monthly</span>
          <button
            onClick={() => setAnnual(a => !a)}
            className={`w-12 h-6 rounded-full transition relative ${annual ? 'bg-accent' : 'bg-dark-tertiary'}`}
          >
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${annual ? 'left-7' : 'left-1'}`} />
          </button>
          <span className={`text-sm font-semibold ${annual ? 'text-white' : 'text-gray-500'}`}>
            Annual <span className="text-accent ml-1">Save 20%</span>
          </span>
        </div>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {PLANS.map(plan => {
            const displayPrice = annual ? Math.round(plan.price * 0.8) : plan.price
            const isCurrent = currentPlan === plan.name.toUpperCase()
            return (
              <div key={plan.id} className={`relative rounded-2xl border-2 p-8 ${plan.color} ${plan.badge ? 'bg-accent/5' : 'bg-dark-secondary'}`}>
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-dark text-xs font-bold px-4 py-1 rounded-full">
                    {plan.badge}
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-4xl font-black">${displayPrice}</span>
                    <span className="text-gray-400 text-sm">/{plan.period}</span>
                  </div>
                  {annual && <div className="text-xs text-accent">Billed ${displayPrice * 12}/year</div>}
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                      <span className="text-accent text-base">✓</span> {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="w-full py-3 text-center bg-dark-tertiary rounded-xl text-sm text-gray-400 font-semibold">
                    Current Plan
                  </div>
                ) : (
                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={checkingOut === plan.id}
                    className={`w-full py-3 rounded-xl font-bold transition text-sm disabled:opacity-60 ${plan.badge ? 'bg-accent text-dark hover:bg-accent-light' : 'bg-dark-tertiary hover:bg-dark-tertiary/70'}`}
                  >
                    {checkingOut === plan.id ? 'Redirecting...' : plan.id === 'agency' ? 'Contact Sales' : `Upgrade to ${plan.name}`}
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
              { q: 'Can I cancel anytime?', a: 'Yes. You can cancel your subscription at any time from this page. You\'ll keep access until the end of your billing period.' },
              { q: 'What are AI credits?', a: 'Each campaign generation uses AI credits. The more complex the campaign, the more credits it uses. Unused credits don\'t roll over.' },
              { q: 'Is my data secure?', a: 'Yes. All data is encrypted at rest and in transit. We never share your campaign data with third parties.' },
              { q: 'Do you offer refunds?', a: 'We offer a 7-day free trial on all plans. After that, all purchases are final. Contact support if you have issues.' },
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