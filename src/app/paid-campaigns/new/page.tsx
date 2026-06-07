'use client'

/**
 * /paid-campaigns/new — AI-Powered Ad Campaign Builder
 *
 * 5-step wizard:
 *   1. Platform + Ad Account selection
 *   2. Objective + Budget + Schedule
 *   3. AI Strategy Generation (Brand Brain powered)
 *   4. AI Copy Variants
 *   5. Review + Launch
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabaseClient'
import { useI18n } from '@/lib/i18n-context'

// ── Types ──────────────────────────────────────────────────────────────────
interface AdAccount {
  id: string
  platform: string
  platformAccountId: string
  platformAccountName: string | null
  businessName: string | null
  currency: string
  status: string
}

interface CopyVariant {
  id: string
  label: string
  angle: string
  primaryText: string
  headline: string
  description: string
  callToAction: string
  hook: string
}

interface WizardData {
  // Step 1
  platform: string
  adAccountId: string
  // Step 2
  name: string
  objective: string
  budgetType: string
  dailyBudget: string
  lifetimeBudget: string
  currency: string
  startDate: string
  endDate: string
  // Step 3 — AI output
  aiStrategy: Record<string, unknown> | null
  // Step 4 — AI copy
  copyVariants: CopyVariant[]
  selectedVariantIds: string[]
  // Step 5
  destinationUrl: string
  utmCampaign: string
}

// ── Platform data ──────────────────────────────────────────────────────────
const PLATFORMS = [
  { id: 'META',     label: 'Meta Ads',    sub: 'Facebook + Instagram', color: '#1877F2', available: true },
  { id: 'GOOGLE',   label: 'Google Ads',  sub: 'Search, Display, P-Max', color: '#4285F4', available: false },
  { id: 'TIKTOK',   label: 'TikTok Ads',  sub: 'In-Feed, TopView, Spark', color: '#FF0050', available: false },
  { id: 'LINKEDIN', label: 'LinkedIn Ads', sub: 'Sponsored Content, InMail', color: '#0A66C2', available: false },
]

const OBJECTIVES = [
  { id: 'TRAFFIC',      label: 'Traffic',      icon: '🔗', desc: 'Drive people to your website' },
  { id: 'CONVERSIONS',  label: 'Conversions',  icon: '💳', desc: 'Get purchases, sign-ups, form fills' },
  { id: 'LEAD_GENERATION', label: 'Leads',     icon: '📋', desc: 'Collect leads with instant forms' },
  { id: 'BRAND_AWARENESS', label: 'Awareness', icon: '📢', desc: 'Reach people likely to remember you' },
  { id: 'ENGAGEMENT',   label: 'Engagement',   icon: '❤️', desc: 'Boost post likes, comments, shares' },
  { id: 'VIDEO_VIEWS',  label: 'Video Views',  icon: '▶️', desc: 'Maximize video watch time' },
]

// ── Step indicator ─────────────────────────────────────────────────────────
function StepBar({ step, total }: { step: number; total: number }) {
  const labels = ['Platform', 'Budget', 'AI Strategy', 'Ad Copy', 'Review']
  return (
    <div className="flex items-center gap-0 mb-8">
      {labels.map((label, i) => {
        const idx = i + 1
        const done = idx < step
        const active = idx === step
        return (
          <div key={i} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all"
                style={{
                  background: done ? '#10B981' : active ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.06)',
                  border: done ? '1px solid #10B981' : active ? '1px solid #F97316' : '1px solid rgba(255,255,255,0.1)',
                  color: done ? 'white' : active ? '#F97316' : 'var(--text-muted)',
                }}
              >
                {done ? '✓' : idx}
              </div>
              <span className="text-[10px] hidden sm:block"
                style={{ color: active ? '#F97316' : done ? '#10B981' : 'var(--text-muted)' }}>
                {label}
              </span>
            </div>
            {i < total - 1 && (
              <div className="flex-1 h-px mx-1 mb-4"
                style={{ background: done ? '#10B981' : 'rgba(255,255,255,0.08)' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function NewPaidCampaignPage() {
  const { user } = useAuth()
  const { locale } = useI18n()
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [accounts, setAccounts] = useState<AdAccount[]>([])
  const [campaignId, setCampaignId] = useState<string | null>(null)

  const [data, setData] = useState<WizardData>({
    platform: '',
    adAccountId: '',
    name: '',
    objective: 'TRAFFIC',
    budgetType: 'DAILY',
    dailyBudget: '50',
    lifetimeBudget: '',
    currency: 'USD',
    startDate: '',
    endDate: '',
    aiStrategy: null,
    copyVariants: [],
    selectedVariantIds: [],
    destinationUrl: '',
    utmCampaign: '',
  })

  const set = (k: keyof WizardData, v: unknown) =>
    setData(prev => ({ ...prev, [k]: v }))

  // Fetch ad accounts
  useEffect(() => {
    if (!user) return
    ;(async () => {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (!token) return
      try {
        const res = await fetch('/api/ad-accounts', { headers: { Authorization: `Bearer ${token}` } })
        if (res.ok) {
          const d = await res.json()
          setAccounts(d.accounts || [])
        }
      } catch { /* ok */ }
    })()
  }, [user])

  const getToken = async () => {
    const { data: session } = await supabase.auth.getSession()
    return session.session?.access_token || ''
  }

  // ── Step handlers ──────────────────────────────────────────────────────

  const handleStep2 = async () => {
    if (!data.name || !data.platform) {
      setError('Please fill all required fields.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const token = await getToken()
      const res = await fetch('/api/ad-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: data.name,
          platform: data.platform,
          adAccountId: data.adAccountId || undefined,
          objective: data.objective,
          budgetType: data.budgetType,
          dailyBudget: data.budgetType === 'DAILY' ? data.dailyBudget : undefined,
          lifetimeBudget: data.budgetType === 'LIFETIME' ? data.lifetimeBudget : undefined,
          currency: data.currency,
          startDate: data.startDate || undefined,
          endDate: data.endDate || undefined,
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to create campaign')
      setCampaignId(result.campaign.id)
      setStep(3)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error creating campaign')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateStrategy = async () => {
    if (!campaignId) return
    setLoading(true)
    setError('')
    try {
      const token = await getToken()
      const res = await fetch(`/api/ad-campaigns/${campaignId}/generate-strategy`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Strategy generation failed')
      set('aiStrategy', result.strategy)
      setStep(4)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error generating strategy')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateCopy = async () => {
    if (!campaignId) return
    setLoading(true)
    setError('')
    try {
      const token = await getToken()
      const res = await fetch(`/api/ad-campaigns/${campaignId}/generate-copy`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Copy generation failed')
      const variants = (result.ads || []).map((ad: Record<string, unknown>) => ({
        id: ad.id as string,
        label: ad.name as string,
        angle: ad.aiAngle as string,
        primaryText: ad.primaryText as string,
        headline: ad.headline as string,
        description: ad.description as string,
        callToAction: ad.callToAction as string,
        hook: ad.aiHook as string,
      }))
      set('copyVariants', variants)
      set('selectedVariantIds', variants.slice(0, 2).map((v: CopyVariant) => v.id))
      setStep(5)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error generating copy')
    } finally {
      setLoading(false)
    }
  }

  const handleLaunch = () => {
    if (campaignId) router.push(`/paid-campaigns/${campaignId}`)
  }

  const toggleVariant = (id: string) => {
    set('selectedVariantIds',
      data.selectedVariantIds.includes(id)
        ? data.selectedVariantIds.filter(v => v !== id)
        : [...data.selectedVariantIds, id]
    )
  }

  // ── Render steps ───────────────────────────────────────────────────────
  const renderStep = () => {
    switch (step) {
      // ── STEP 1: Platform + Account ─────────────────────────────────────
      case 1:
        return (
          <div>
            <h2 className="text-[18px] font-bold text-white mb-1">Choose Platform</h2>
            <p className="text-text-muted text-[13px] mb-6">Select the advertising platform for this campaign</p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {PLATFORMS.map(p => (
                <button
                  key={p.id}
                  disabled={!p.available}
                  onClick={() => { if (p.available) set('platform', p.id) }}
                  className="relative flex flex-col items-start gap-1.5 p-4 rounded-[14px] text-left transition-all"
                  style={{
                    background: data.platform === p.id
                      ? `rgba(${p.color === '#1877F2' ? '24,119,242' : p.color === '#4285F4' ? '66,133,244' : '255,0,80'},0.12)`
                      : 'var(--nx-surface-2)',
                    border: data.platform === p.id
                      ? `1px solid ${p.color}`
                      : '1px solid rgba(255,255,255,0.08)',
                    opacity: p.available ? 1 : 0.4,
                    cursor: p.available ? 'pointer' : 'not-allowed',
                  }}
                >
                  {!p.available && (
                    <span className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(107,114,128,0.2)', color: '#6B7280' }}>
                      Coming Soon
                    </span>
                  )}
                  <span className="text-[13px] font-bold" style={{ color: p.available ? 'white' : '#6B7280' }}>
                    {p.label}
                  </span>
                  <span className="text-[11px] text-text-muted">{p.sub}</span>
                  {data.platform === p.id && (
                    <span className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full font-bold"
                      style={{ background: p.color, color: 'white' }}>✓</span>
                  )}
                </button>
              ))}
            </div>

            {/* Ad Account selection */}
            {data.platform && (
              <div>
                <label className="text-[12px] text-text-muted block mb-2 font-medium">
                  Ad Account {accounts.filter(a => a.platform === data.platform).length === 0 && (
                    <span className="text-orange-400 ml-1">— no connected account yet</span>
                  )}
                </label>
                {accounts.filter(a => a.platform === data.platform).length > 0 ? (
                  <div className="space-y-2">
                    {accounts.filter(a => a.platform === data.platform).map(acc => (
                      <button
                        key={acc.id}
                        onClick={() => set('adAccountId', acc.id)}
                        className="w-full flex items-center justify-between p-3 rounded-xl text-left transition-all"
                        style={{
                          background: data.adAccountId === acc.id ? 'rgba(16,185,129,0.1)' : 'var(--nx-surface-2)',
                          border: data.adAccountId === acc.id ? '1px solid #10B981' : '1px solid rgba(255,255,255,0.08)',
                        }}
                      >
                        <div>
                          <p className="text-[13px] font-medium text-white">
                            {acc.platformAccountName || acc.platformAccountId}
                          </p>
                          <p className="text-[11px] text-text-muted">{acc.currency} · {acc.status}</p>
                        </div>
                        {data.adAccountId === acc.id && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full"
                            style={{ background: '#10B981', color: 'white' }}>Selected</span>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl text-[12px] text-text-muted"
                    style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)' }}>
                    No {data.platform} ad account connected.{' '}
                    <button className="text-orange-400 underline" onClick={() => router.push('/connections')}>
                      Connect one →
                    </button>
                    <br />
                    <span className="text-[11px] opacity-70">You can still create the campaign draft without an account.</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 mt-8">
              <button onClick={() => router.push('/paid-campaigns')}
                className="px-4 py-2.5 rounded-xl text-[13px] font-medium text-text-muted hover:text-white transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                Cancel
              </button>
              <button
                disabled={!data.platform}
                onClick={() => setStep(2)}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all"
                style={{
                  background: data.platform ? 'linear-gradient(135deg, #F97316, #EF4444)' : 'rgba(255,255,255,0.06)',
                  cursor: data.platform ? 'pointer' : 'not-allowed',
                }}
              >
                Continue →
              </button>
            </div>
          </div>
        )

      // ── STEP 2: Budget + Objective ─────────────────────────────────────
      case 2:
        return (
          <div>
            <h2 className="text-[18px] font-bold text-white mb-1">Campaign Details</h2>
            <p className="text-text-muted text-[13px] mb-6">Name your campaign, set the objective and budget</p>

            <div className="space-y-4">
              {/* Campaign name */}
              <div>
                <label className="block text-[12px] font-medium text-text-muted mb-1.5">Campaign Name *</label>
                <input
                  value={data.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="e.g. Summer Sale 2025 — Meta"
                  className="w-full px-3 py-2.5 rounded-xl text-[13px] text-white placeholder:text-text-muted focus:outline-none transition-all"
                  style={{ background: 'var(--nx-surface-2)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>

              {/* Objective */}
              <div>
                <label className="block text-[12px] font-medium text-text-muted mb-2">Campaign Objective *</label>
                <div className="grid grid-cols-3 gap-2">
                  {OBJECTIVES.map(obj => (
                    <button
                      key={obj.id}
                      onClick={() => set('objective', obj.id)}
                      className="flex flex-col items-start gap-1 p-3 rounded-xl text-left transition-all"
                      style={{
                        background: data.objective === obj.id ? 'rgba(249,115,22,0.12)' : 'var(--nx-surface-2)',
                        border: data.objective === obj.id ? '1px solid #F97316' : '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <span className="text-base">{obj.icon}</span>
                      <span className="text-[12px] font-semibold text-white">{obj.label}</span>
                      <span className="text-[10px] text-text-muted leading-tight">{obj.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Budget */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-text-muted mb-1.5">Budget Type</label>
                  <select
                    value={data.budgetType}
                    onChange={e => set('budgetType', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-[13px] text-white focus:outline-none"
                    style={{ background: 'var(--nx-surface-2)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <option value="DAILY">Daily Budget</option>
                    <option value="LIFETIME">Lifetime Budget</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-text-muted mb-1.5">
                    {data.budgetType === 'DAILY' ? 'Daily Budget' : 'Total Budget'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-text-muted">{data.currency}</span>
                    <input
                      type="number"
                      min="1"
                      value={data.budgetType === 'DAILY' ? data.dailyBudget : data.lifetimeBudget}
                      onChange={e => set(data.budgetType === 'DAILY' ? 'dailyBudget' : 'lifetimeBudget', e.target.value)}
                      className="w-full pl-12 pr-3 py-2.5 rounded-xl text-[13px] text-white focus:outline-none"
                      style={{ background: 'var(--nx-surface-2)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                  </div>
                </div>
              </div>

              {/* Currency */}
              <div>
                <label className="block text-[12px] font-medium text-text-muted mb-1.5">Currency</label>
                <select
                  value={data.currency}
                  onChange={e => set('currency', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-[13px] text-white focus:outline-none"
                  style={{ background: 'var(--nx-surface-2)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <option value="USD">USD — US Dollar</option>
                  <option value="SAR">SAR — Saudi Riyal</option>
                  <option value="AED">AED — UAE Dirham</option>
                  <option value="EGP">EGP — Egyptian Pound</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="GBP">GBP — British Pound</option>
                </select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-text-muted mb-1.5">Start Date (optional)</label>
                  <input
                    type="date"
                    value={data.startDate}
                    onChange={e => set('startDate', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-[13px] text-white focus:outline-none"
                    style={{ background: 'var(--nx-surface-2)', border: '1px solid rgba(255,255,255,0.1)', colorScheme: 'dark' }}
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-text-muted mb-1.5">End Date (optional)</label>
                  <input
                    type="date"
                    value={data.endDate}
                    onChange={e => set('endDate', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-[13px] text-white focus:outline-none"
                    style={{ background: 'var(--nx-surface-2)', border: '1px solid rgba(255,255,255,0.1)', colorScheme: 'dark' }}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button onClick={() => setStep(1)}
                className="px-4 py-2.5 rounded-xl text-[13px] font-medium text-text-muted hover:text-white transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                ← Back
              </button>
              <button
                disabled={!data.name || loading}
                onClick={handleStep2}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all"
                style={{
                  background: data.name ? 'linear-gradient(135deg, #F97316, #EF4444)' : 'rgba(255,255,255,0.06)',
                  cursor: data.name && !loading ? 'pointer' : 'not-allowed',
                }}
              >
                {loading ? 'Creating...' : 'Create & Generate Strategy →'}
              </button>
            </div>
          </div>
        )

      // ── STEP 3: AI Strategy ─────────────────────────────────────────────
      case 3: {
        const strategy = data.aiStrategy
        return (
          <div>
            <h2 className="text-[18px] font-bold text-white mb-1">AI Campaign Strategy</h2>
            <p className="text-text-muted text-[13px] mb-6">
              Your Brand Brain is powering the strategy. This generates audience targeting, budget plan, and creative brief.
            </p>

            {!strategy ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)' }}>
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <path d="M14 4C8.5 4 4 8.5 4 14s4.5 10 10 10 10-4.5 10-10S19.5 4 14 4z" stroke="#F97316" strokeWidth="1.5"/>
                    <path d="M10 14h4l3-5" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p className="text-white font-medium mb-2">Ready to generate your AI strategy</p>
                <p className="text-text-muted text-[12px] mb-6 max-w-xs mx-auto">
                  Uses your Brand Brain data, campaign objective, budget, and platform to produce a complete, brand-specific strategy.
                </p>
                <button
                  disabled={loading}
                  onClick={handleGenerateStrategy}
                  className="px-6 py-3 rounded-xl text-[13px] font-bold text-white transition-all"
                  style={{ background: loading ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #8B5CF6, #6366F1)' }}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                      Generating strategy...
                    </span>
                  ) : '✨ Generate AI Strategy (2 credits)'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Positioning */}
                {(strategy.positioning as Record<string, unknown>) && (
                  <div className="p-4 rounded-[12px]"
                    style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)' }}>
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-accent-purple mb-3">Campaign Positioning</h3>
                    <p className="text-[13px] text-white font-medium mb-1">
                      {String((strategy.positioning as Record<string, unknown>)?.core_message || '')}
                    </p>
                    <p className="text-[12px] text-text-muted">
                      {String((strategy.positioning as Record<string, unknown>)?.value_proposition || '')}
                    </p>
                  </div>
                )}

                {/* Audience */}
                {(strategy.audience as Record<string, unknown>) && (
                  <div className="p-4 rounded-[12px]"
                    style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <h3 className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: '#10B981' }}>Target Audience</h3>
                    <p className="text-[13px] text-white font-medium">
                      {String(((strategy.audience as Record<string, unknown>)?.primary_segment as Record<string, unknown>)?.description || '')}
                    </p>
                  </div>
                )}

                {/* Budget plan */}
                {(strategy.budget_plan as Record<string, unknown>) && (
                  <div className="p-4 rounded-[12px]"
                    style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)' }}>
                    <h3 className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: '#F97316' }}>Budget Plan</h3>
                    <p className="text-[12px] text-text-muted mb-2">
                      {String((strategy.budget_plan as Record<string, unknown>)?.expected_results || '')}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-center">
                        <p className="text-[11px] text-text-muted">Est. Reach</p>
                        <p className="text-[13px] font-bold text-white">
                          {(() => {
                            const r = (strategy.budget_plan as Record<string, unknown>)?.estimated_reach as Record<string, number> | undefined
                            return r ? `${(r.min / 1000).toFixed(0)}K – ${(r.max / 1000).toFixed(0)}K` : '—'
                          })()}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[11px] text-text-muted">Est. Impressions</p>
                        <p className="text-[13px] font-bold text-white">
                          {(() => {
                            const i = (strategy.budget_plan as Record<string, unknown>)?.estimated_impressions as Record<string, number> | undefined
                            return i ? `${(i.min / 1000).toFixed(0)}K – ${(i.max / 1000).toFixed(0)}K` : '—'
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 mt-8">
              <button onClick={() => setStep(2)}
                className="px-4 py-2.5 rounded-xl text-[13px] font-medium text-text-muted hover:text-white transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                ← Back
              </button>
              {strategy && (
                <button
                  onClick={handleGenerateCopy}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all"
                  style={{ background: loading ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #F97316, #EF4444)' }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                      Generating copy...
                    </span>
                  ) : '✨ Generate Ad Copy (2 credits) →'}
                </button>
              )}
            </div>
          </div>
        )
      }

      // ── STEP 4: Copy Variants ──────────────────────────────────────────
      case 4:
        return (
          <div>
            <h2 className="text-[18px] font-bold text-white mb-1">Ad Copy Variants</h2>
            <p className="text-text-muted text-[13px] mb-6">
              AI generated {data.copyVariants.length} variants. Select the ones you want to run.
            </p>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {data.copyVariants.map(variant => {
                const isSelected = data.selectedVariantIds.includes(variant.id)
                return (
                  <button
                    key={variant.id}
                    onClick={() => toggleVariant(variant.id)}
                    className="w-full text-left p-4 rounded-[12px] transition-all"
                    style={{
                      background: isSelected ? 'rgba(249,115,22,0.08)' : 'var(--nx-surface-2)',
                      border: isSelected ? '1px solid #F97316' : '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider"
                        style={{ color: isSelected ? '#F97316' : '#6B7280' }}>
                        {variant.label}
                      </span>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{
                          background: isSelected ? '#F97316' : 'transparent',
                          border: isSelected ? '1px solid #F97316' : '1px solid rgba(255,255,255,0.2)',
                        }}>
                        {isSelected && <span className="text-[10px] text-white">✓</span>}
                      </div>
                    </div>
                    <p className="text-[13px] font-semibold text-white mb-1">{variant.headline}</p>
                    <p className="text-[12px] text-text-muted line-clamp-2 leading-relaxed">{variant.primaryText}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(139,92,246,0.15)', color: '#8B5CF6' }}>
                        {variant.angle.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] text-text-muted">{variant.callToAction}</span>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(3)}
                className="px-4 py-2.5 rounded-xl text-[13px] font-medium text-text-muted hover:text-white transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                ← Back
              </button>
              <button
                onClick={() => setStep(5)}
                disabled={data.selectedVariantIds.length === 0}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all"
                style={{
                  background: data.selectedVariantIds.length > 0 ? 'linear-gradient(135deg, #F97316, #EF4444)' : 'rgba(255,255,255,0.06)',
                }}
              >
                Continue with {data.selectedVariantIds.length} variant{data.selectedVariantIds.length !== 1 ? 's' : ''} →
              </button>
            </div>
          </div>
        )

      // ── STEP 5: Review + Launch ────────────────────────────────────────
      case 5:
        return (
          <div>
            <h2 className="text-[18px] font-bold text-white mb-1">Review & Launch</h2>
            <p className="text-text-muted text-[13px] mb-6">Your campaign is ready. Review the details and go to the campaign manager.</p>

            {/* Summary card */}
            <div className="p-4 rounded-[14px] mb-6 space-y-3"
              style={{ background: 'var(--nx-surface-2)', border: '1px solid rgba(139,92,246,0.1)' }}>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-text-muted">Campaign</span>
                <span className="text-[13px] font-semibold text-white">{data.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-text-muted">Platform</span>
                <span className="text-[13px] font-semibold text-white">{data.platform}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-text-muted">Objective</span>
                <span className="text-[13px] font-semibold text-white">{data.objective.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-text-muted">Budget</span>
                <span className="text-[13px] font-semibold text-white">
                  {data.currency} {data.budgetType === 'DAILY' ? `${data.dailyBudget}/day` : `${data.lifetimeBudget} total`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-text-muted">Ad Variants</span>
                <span className="text-[13px] font-semibold text-white">{data.selectedVariantIds.length} selected</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-text-muted">AI Strategy</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }}>
                  ✓ Generated
                </span>
              </div>
            </div>

            {/* Next steps */}
            <div className="p-4 rounded-[12px] mb-6"
              style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)' }}>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: '#F97316' }}>Next Steps</p>
              <ul className="space-y-1.5 text-[12px] text-text-muted">
                <li>• Open the Campaign Manager to review targeting</li>
                <li>• Upload your creative assets (image / video)</li>
                <li>• Export to {data.platform} Ads Manager or launch via API</li>
                <li>• Track performance in the dashboard</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(4)}
                className="px-4 py-2.5 rounded-xl text-[13px] font-medium text-text-muted hover:text-white transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                ← Back
              </button>
              <button
                onClick={handleLaunch}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all"
                style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
              >
                Open Campaign Manager →
              </button>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <AppShell>
      <div className="min-h-screen flex items-start justify-center pt-8" style={{ background: 'var(--nx-bg)' }}>
        <div className="w-full max-w-[600px] px-4">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => router.push('/paid-campaigns')}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-text-muted hover:text-white transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 2L4 7l5 5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div>
              <h1 className="text-[15px] font-bold text-white">
                {locale === 'ar' ? 'حملة إعلانية جديدة' : 'New Paid Campaign'}
              </h1>
              <p className="text-[11px] text-text-muted">AI-powered across Meta, Google, TikTok, LinkedIn</p>
            </div>
          </div>

          {/* Step bar */}
          <StepBar step={step} total={5} />

          {/* Card */}
          <div className="rounded-[18px] p-6"
            style={{ background: 'var(--nx-surface)', border: '1px solid rgba(139,92,246,0.12)' }}>
            {error && (
              <div className="mb-4 p-3 rounded-xl text-[12px]"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444' }}>
                {error}
              </div>
            )}
            {renderStep()}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
