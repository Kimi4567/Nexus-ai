'use client'

/**
 * /paid-campaigns/new — Paid Planning Draft Builder
 *
 * 5-step wizard:
 *   1. Platform + Ad Account selection
 *   2. Objective + Budget + Planning Dates
 *   3. Paid planning strategy (Brand Brain powered)
 *   4. Ad copy drafts
 *   5. Review + Setup
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
  language: string
  // Step 3 — AI output
  aiStrategy: Record<string, unknown> | null
  // Step 4 — AI copy
  copyVariants: CopyVariant[]
  selectedVariantIds: string[]
  // Step 5
  destinationUrl: string
  utmCampaign: string
  // AI Assist
  aiSuggested: boolean
  aiSuggestionRationale: string
}

// ── Platform data ──────────────────────────────────────────────────────────
const PLATFORMS = [
  { id: 'META',     label: 'Meta Ads',    sub: 'Facebook + Instagram', color: '#1877F2', badge: 'Draft + API path' },
  { id: 'GOOGLE',   label: 'Google Ads',  sub: 'Search, Display, P-Max', color: '#4285F4', badge: 'Planning draft' },
  { id: 'TIKTOK',   label: 'TikTok Ads',  sub: 'In-Feed, TopView, Spark', color: '#FF0050', badge: 'Planning draft' },
  { id: 'LINKEDIN', label: 'LinkedIn Ads', sub: 'Sponsored Content, InMail', color: '#0A66C2', badge: 'Planning draft' },
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
  const labels = ['Platform', 'Budget', 'Planning', 'Ad Copy', 'Review']
  return (
    <div className="mb-8 rounded-2xl border border-slate-200 bg-white/85 p-3 shadow-sm">
      <div className="flex items-center gap-0">
      {labels.map((label, i) => {
        const idx = i + 1
        const done = idx < step
        const active = idx === step
        return (
          <div key={i} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-9 h-9 rounded-2xl flex items-center justify-center text-[12px] font-black transition-all"
                style={{
                  background: done ? '#ECFDF5' : active ? '#EEF2FF' : '#F8FAFC',
                  border: done ? '1px solid rgba(16,185,129,0.24)' : active ? '1px solid rgba(94,92,230,0.35)' : '1px solid rgba(15,23,42,0.08)',
                  color: done ? '#059669' : active ? '#5E5CE6' : '#94a3b8',
                }}
              >
                {done ? '✓' : idx}
              </div>
              <span className="text-[10px] hidden sm:block"
                style={{ color: active ? '#F97316' : done ? '#059669' : '#94a3b8' }}>
                {label}
              </span>
            </div>
            {i < total - 1 && (
              <div className="flex-1 h-px mx-1 mb-4"
                style={{ background: done ? '#10B981' : '#e2e8f0' }} />
            )}
          </div>
        )
      })}
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function NewPaidCampaignPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth()
  const { locale } = useI18n()
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [accounts, setAccounts] = useState<AdAccount[]>([])
  const [campaignId, setCampaignId] = useState<string | null>(null)

  const [previewVariantId, setPreviewVariantId] = useState<string | null>(null)
  const [aiSuggestLoading, setAiSuggestLoading] = useState(false)

  const [data, setData] = useState<WizardData>({
    platform: '',
    adAccountId: '',
    name: '',
    objective: 'TRAFFIC',
    budgetType: 'DAILY',
    dailyBudget: '',
    lifetimeBudget: '',
    currency: 'USD',
    startDate: '',
    endDate: '',
    language: 'en',
    aiStrategy: null,
    copyVariants: [],
    selectedVariantIds: [],
    destinationUrl: '',
    utmCampaign: '',
    aiSuggested: false,
    aiSuggestionRationale: '',
  })

  const set = (k: keyof WizardData, v: unknown) =>
    setData(prev => ({ ...prev, [k]: v }))

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/login')
  }, [authLoading, isAuthenticated, router])

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
      if (!res.ok) throw new Error(result.error || 'Failed to create planning draft')
      setCampaignId(result.campaign.id)
      setStep(3)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error creating planning draft')
    } finally {
      setLoading(false)
    }
  }

  // ── AI Assist: let AI plan the campaign from Brand Brain ──────────────────
  const handleAiSuggest = async () => {
    setAiSuggestLoading(true)
    setError('')
    try {
      const token = await getToken()
      const res = await fetch('/api/ad-campaigns/ai-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'AI suggestion failed')
      set('platform', result.platform || 'META')
      set('objective', result.objective || 'LEAD_GENERATION')
      set('dailyBudget', result.dailyBudget ? String(result.dailyBudget) : '')
      set('currency', result.currency || 'USD')
      set('name', result.name || '')
      set('language', result.language || 'en')
      set('aiSuggested', true)
      set('aiSuggestionRationale', result.rationale || '')
      setStep(2)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'AI suggestion failed')
    } finally {
      setAiSuggestLoading(false)
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ language: data.language }),
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ language: data.language }),
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
      setStep(4)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error generating copy')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDraft = () => {
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
            <h2 className="text-[18px] font-bold text-slate-950 mb-1">Choose planning platform</h2>
            <p className="text-slate-500 text-[13px] mb-6">Select the advertising platform for this planning draft.</p>

            {/* AI Assist Card */}
            <div className="mb-5 p-4 rounded-[14px] relative overflow-hidden"
              style={{ background: '#faf5ff', border: '1px solid rgba(109,40,217,0.15)' }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[14px]">⚡</span>
                    <span className="text-[13px] font-bold text-slate-950">Let AI Plan This</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                      style={{ background: '#ede9fe', color: '#6d28d9' }}>FREE</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    AI reads your Brand Brain and suggests a planning platform, objective, budget assumption, and draft name.
                  </p>
                </div>
                <button
                  onClick={handleAiSuggest}
                  disabled={aiSuggestLoading}
                  className="flex-shrink-0 px-4 py-2 rounded-xl text-[12px] font-bold text-white transition-all"
                  style={{
                    background: aiSuggestLoading ? '#e5e7eb' : '#6d28d9',
                    color: aiSuggestLoading ? '#94a3b8' : 'white',
                    cursor: aiSuggestLoading ? 'wait' : 'pointer',
                  }}
                >
                  {aiSuggestLoading ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin inline-block" />
                      Planning...
                    </span>
                  ) : 'AI Suggest →'}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 h-px" style={{ background: '#e2e8f0' }} />
              <span className="text-[11px] text-slate-400">or choose manually</span>
              <div className="flex-1 h-px" style={{ background: '#e2e8f0' }} />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {PLATFORMS.map(p => (
                <button
                  key={p.id}
                  onClick={() => set('platform', p.id)}
                  className="relative flex flex-col items-start gap-1.5 p-4 rounded-[14px] text-left transition-all"
                  style={{
                    background: data.platform === p.id
                      ? `rgba(${p.color === '#1877F2' ? '24,119,242' : p.color === '#4285F4' ? '66,133,244' : '255,0,80'},0.06)`
                      : '#fff',
                    border: data.platform === p.id
                      ? `1px solid ${p.color}`
                      : '1px solid rgba(15,23,42,0.08)',
                    cursor: 'pointer',
                  }}
                >
                  {data.platform !== p.id && (
                    <span className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded"
                      style={{ background: p.id === 'META' ? 'rgba(24,119,242,0.08)' : '#f1f5f9', color: p.id === 'META' ? '#1877F2' : '#64748b' }}>
                      {p.badge}
                    </span>
                  )}
                  <span className="text-[13px] font-bold" style={{ color: '#0f172a' }}>
                    {p.label}
                  </span>
                  <span className="text-[11px] text-slate-500">{p.sub}</span>
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
                <label className="text-[12px] text-slate-500 block mb-2 font-medium">
                  Ad Account {accounts.filter(a => a.platform === data.platform).length === 0 && (
                    <span className="text-orange-600 ml-1">— no connected account yet</span>
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
                          background: data.adAccountId === acc.id ? 'rgba(5,150,105,0.06)' : '#fff',
                          border: data.adAccountId === acc.id ? '1px solid #059669' : '1px solid rgba(15,23,42,0.08)',
                        }}
                      >
                        <div>
                          <p className="text-[13px] font-medium text-slate-950">
                            {acc.platformAccountName || acc.platformAccountId}
                          </p>
                          <p className="text-[11px] text-slate-500">{acc.currency} · {acc.status}</p>
                        </div>
                        {data.adAccountId === acc.id && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full"
                            style={{ background: '#10B981', color: 'white' }}>Selected</span>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl text-[12px] text-slate-500"
                    style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)' }}>
                    No {data.platform} ad account connected.{' '}
                    <button className="text-orange-400 underline" onClick={() => router.push('/connections')}>
                      Connect one →
                    </button>
                    <br />
                    <span className="text-[11px] opacity-70">You can still create the planning draft without an account.</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 mt-8">
              <button onClick={() => router.push('/paid-campaigns')}
                className="px-4 py-2.5 rounded-xl text-[13px] font-medium text-slate-500 hover:text-slate-950 transition-all"
                style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.1)' }}>
                Cancel
              </button>
              <button
                disabled={!data.platform}
                onClick={() => setStep(2)}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all"
                style={{
                  background: data.platform ? '#F97316' : '#e2e8f0',
                  color: data.platform ? 'white' : '#94a3b8',
                  cursor: data.platform ? 'pointer' : 'not-allowed',
                }}
              >
                Continue →
              </button>
            </div>
          </div>
        )

      // ── STEP 2: Budget + Objective ─────────────────────────────────────
      case 2: {
        // Client-side budget estimate (MENA CPM benchmarks)
        const CPM_BENCH: Record<string, { min: number; max: number }> = {
          META: { min: 1.5, max: 5 }, GOOGLE: { min: 0.8, max: 3.5 },
          TIKTOK: { min: 2, max: 7 }, LINKEDIN: { min: 20, max: 55 },
        }
        const bench = CPM_BENCH[data.platform] || { min: 3, max: 8 }
        const bud = parseFloat(data.dailyBudget) || 0
        const totalEst = bud * 14
        const impMin = Math.round((totalEst / bench.max) * 1000)
        const impMax = Math.round((totalEst / bench.min) * 1000)
        const reachMin = Math.round(impMin / 2.5)
        const reachMax = Math.round(impMax / 1.5)

        return (
          <div>
            <h2 className="text-[18px] font-bold text-slate-950 mb-1">Planning Draft Details</h2>
            <p className="text-slate-500 text-[13px] mb-6">Name your paid planning draft and add budget assumptions for review.</p>

            {/* AI Suggestion banner */}
            {data.aiSuggested && data.aiSuggestionRationale && (
              <div className="mb-4 p-3 rounded-xl text-[11px]"
                style={{ background: '#faf5ff', border: '1px solid rgba(109,40,217,0.2)' }}>
                <span className="font-bold" style={{ color: '#6d28d9' }}>⚡ AI Suggestion: </span>
                <span className="text-slate-500">{data.aiSuggestionRationale}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Campaign name */}
              <div>
                <label className="block text-[12px] font-medium text-slate-500 mb-1.5">Planning Draft Name *</label>
                <input
                  value={data.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="e.g. Summer Sale 2025 — Meta"
                  className="w-full px-3 py-2.5 rounded-xl text-[13px] text-slate-950 placeholder:text-slate-400 focus:outline-none transition-all"
                  style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.12)' }}
                />
              </div>

              {/* Objective */}
              <div>
                <label className="block text-[12px] font-medium text-slate-500 mb-2">Planning Objective *</label>
                <div className="grid grid-cols-3 gap-2">
                  {OBJECTIVES.map(obj => (
                    <button
                      key={obj.id}
                      onClick={() => set('objective', obj.id)}
                      className="flex flex-col items-start gap-1 p-3 rounded-xl text-left transition-all"
                      style={{
                        background: data.objective === obj.id ? '#fff7ed' : '#fff',
                        border: data.objective === obj.id ? '1px solid #F97316' : '1px solid rgba(15,23,42,0.08)',
                      }}
                    >
                      <span className="text-base">{obj.icon}</span>
                      <span className="text-[12px] font-semibold text-slate-950">{obj.label}</span>
                      <span className="text-[10px] text-slate-500 leading-tight">{obj.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Budget */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-slate-500 mb-1.5">Budget Type</label>
                  <select
                    value={data.budgetType}
                    onChange={e => set('budgetType', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-[13px] text-slate-950 focus:outline-none"
                    style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.12)' }}
                  >
                    <option value="DAILY">Daily Budget</option>
                    <option value="LIFETIME">Lifetime Budget</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-slate-500 mb-1.5">
                    {data.budgetType === 'DAILY' ? 'Daily Budget' : 'Total Budget'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400">{data.currency}</span>
                    <input
                      type="number"
                      min="1"
                      value={data.budgetType === 'DAILY' ? data.dailyBudget : data.lifetimeBudget}
                      onChange={e => set(data.budgetType === 'DAILY' ? 'dailyBudget' : 'lifetimeBudget', e.target.value)}
                      placeholder="Planning assumption"
                      className="w-full pl-12 pr-3 py-2.5 rounded-xl text-[13px] text-slate-950 focus:outline-none"
                      style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.12)' }}
                    />
                  </div>
                </div>
              </div>

              {/* Currency */}
              <div>
                <label className="block text-[12px] font-medium text-slate-500 mb-1.5">Currency</label>
                <select
                  value={data.currency}
                  onChange={e => set('currency', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-[13px] text-slate-950 focus:outline-none"
                  style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.12)' }}
                >
                  <option value="USD">USD — US Dollar</option>
                  <option value="SAR">SAR — Saudi Riyal</option>
                  <option value="AED">AED — UAE Dirham</option>
                  <option value="EGP">EGP — Egyptian Pound</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="GBP">GBP — British Pound</option>
                </select>
              </div>

              {/* Budget estimate */}
              {data.dailyBudget && parseFloat(data.dailyBudget) > 0 && (
                <div className="p-3 rounded-xl"
                  style={{ background: '#fff7ed', border: '1px solid rgba(249,115,22,0.2)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#c2410c' }}>
                    Planning estimate (14 days · benchmark assumptions)
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[11px] text-slate-500">Reach</p>
                      <p className="text-[12px] font-bold text-slate-950">{(reachMin/1000).toFixed(0)}K–{(reachMax/1000).toFixed(0)}K</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500">Impressions</p>
                      <p className="text-[12px] font-bold text-slate-950">{(impMin/1000).toFixed(0)}K–{(impMax/1000).toFixed(0)}K</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500">CPM</p>
                      <p className="text-[12px] font-bold text-slate-950">${bench.min}–${bench.max}</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">
                    This is not approved spend. Confirm budget, tracking, creative, and platform readiness before any ad launch or spend.
                  </p>
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-slate-500 mb-1.5">Start Date (optional)</label>
                  <input
                    type="date"
                    value={data.startDate}
                    onChange={e => set('startDate', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-[13px] text-slate-950 focus:outline-none"
                    style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.12)' }}
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-slate-500 mb-1.5">End Date (optional)</label>
                  <input
                    type="date"
                    value={data.endDate}
                    onChange={e => set('endDate', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-[13px] text-slate-950 focus:outline-none"
                    style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.12)' }}
                  />
                </div>
              </div>

              {/* AI Output Language */}
              <div>
                <label className="block text-[12px] font-medium text-slate-500 mb-2">
                  AI Output Language
                  <span className="ml-1 text-[10px] text-slate-400">— strategy + ad copy will be written in this language</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'en', label: '🇺🇸 English', desc: 'Global / EN market' },
                    { id: 'ar', label: '🇸🇦 Arabic', desc: 'MENA / Gulf market' },
                    { id: 'bilingual', label: '⚡ Bilingual', desc: 'AI decides per post' },
                  ].map(lang => (
                    <button
                      key={lang.id}
                      onClick={() => set('language', lang.id)}
                      className="flex flex-col items-start gap-0.5 p-3 rounded-xl text-left transition-all"
                      style={{
                        background: data.language === lang.id ? 'rgba(5,150,105,0.06)' : '#fff',
                        border: data.language === lang.id ? '1px solid #059669' : '1px solid rgba(15,23,42,0.08)',
                      }}
                    >
                      <span className="text-[12px] font-semibold text-slate-950">{lang.label}</span>
                      <span className="text-[10px] text-slate-500">{lang.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button onClick={() => setStep(1)}
                className="px-4 py-2.5 rounded-xl text-[13px] font-medium text-slate-500 hover:text-slate-950 transition-all"
                style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.1)' }}>
                ← Back
              </button>
              <button
                disabled={!data.name || loading}
                onClick={handleStep2}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all"
                style={{
                  background: data.name ? '#F97316' : '#e2e8f0',
                  color: data.name ? 'white' : '#94a3b8',
                  cursor: data.name && !loading ? 'pointer' : 'not-allowed',
                }}
              >
                {loading ? 'Saving...' : 'Save planning draft & continue →'}
              </button>
            </div>
          </div>
        )
      }

      // ── STEP 3: AI Strategy ─────────────────────────────────────────────
      case 3: {
        const strategy = data.aiStrategy
        return (
          <div>
            <h2 className="text-[18px] font-bold text-slate-950 mb-1">Paid Planning Strategy</h2>
            <p className="text-slate-500 text-[13px] mb-6">
              Your Brand Brain is powering a planning draft. This generates audience targeting, budget planning notes, and creative brief.
            </p>

            {!strategy ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: '#fff7ed', border: '1px solid rgba(249,115,22,0.2)' }}>
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <path d="M14 4C8.5 4 4 8.5 4 14s4.5 10 10 10 10-4.5 10-10S19.5 4 14 4z" stroke="#F97316" strokeWidth="1.5"/>
                    <path d="M10 14h4l3-5" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p className="text-slate-950 font-medium mb-2">Ready to generate your paid planning strategy</p>
                <p className="text-slate-500 text-[12px] mb-6 max-w-xs mx-auto">
                  Uses your Brand Brain data, campaign objective, budget assumption, and platform to produce a planning strategy for review.
                </p>
                <button
                  disabled={loading}
                  onClick={handleGenerateStrategy}
                  className="px-6 py-3 rounded-xl text-[13px] font-bold text-white transition-all"
                  style={{ background: loading ? '#e5e7eb' : '#6d28d9', color: loading ? '#94a3b8' : 'white' }}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                      Generating strategy...
                    </span>
                  ) : '✨ Generate planning strategy (2 credits)'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Positioning */}
                {(strategy.positioning as Record<string, unknown>) && (
                  <div className="p-4 rounded-[12px]"
                    style={{ background: '#faf5ff', border: '1px solid rgba(109,40,217,0.15)' }}>
                    <h3 className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: '#6d28d9' }}>Planning Positioning</h3>
                    <p className="text-[13px] text-slate-950 font-medium mb-1">
                      {String((strategy.positioning as Record<string, unknown>)?.core_message || '')}
                    </p>
                    <p className="text-[12px] text-slate-500">
                      {String((strategy.positioning as Record<string, unknown>)?.value_proposition || '')}
                    </p>
                  </div>
                )}

                {/* Audience */}
                {(strategy.audience as Record<string, unknown>) && (
                  <div className="p-4 rounded-[12px]"
                    style={{ background: 'rgba(5,150,105,0.05)', border: '1px solid rgba(5,150,105,0.15)' }}>
                    <h3 className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: '#059669' }}>Target Audience</h3>
                    <p className="text-[13px] text-slate-950 font-medium">
                      {String(((strategy.audience as Record<string, unknown>)?.primary_segment as Record<string, unknown>)?.description || '')}
                    </p>
                  </div>
                )}

                {/* Budget plan */}
                {(strategy.budget_plan as Record<string, unknown>) && (
                  <div className="p-4 rounded-[12px]"
                    style={{ background: '#fff7ed', border: '1px solid rgba(249,115,22,0.2)' }}>
                    <h3 className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: '#c2410c' }}>Budget Plan</h3>
                    <p className="text-[12px] text-slate-500 mb-2">
                      {String((strategy.budget_plan as Record<string, unknown>)?.expected_results || '')}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-center">
                        <p className="text-[11px] text-slate-500">Est. Reach</p>
                        <p className="text-[13px] font-bold text-slate-950">
                          {(() => {
                            const r = (strategy.budget_plan as Record<string, unknown>)?.estimated_reach as Record<string, number> | undefined
                            return r ? `${(r.min / 1000).toFixed(0)}K – ${(r.max / 1000).toFixed(0)}K` : '—'
                          })()}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[11px] text-slate-500">Est. Impressions</p>
                        <p className="text-[13px] font-bold text-slate-950">
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
                className="px-4 py-2.5 rounded-xl text-[13px] font-medium text-slate-500 hover:text-slate-950 transition-all"
                style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.1)' }}>
                ← Back
              </button>
              {strategy && (
                <button
                  onClick={handleGenerateCopy}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all"
                  style={{ background: loading ? '#e2e8f0' : '#F97316', color: loading ? '#94a3b8' : 'white' }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                      Generating copy...
                    </span>
                ) : '✨ Generate ad copy drafts (2 credits) →'}
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
            <h2 className="text-[18px] font-bold text-slate-950 mb-1">Ad Copy Drafts</h2>
            <p className="text-slate-500 text-[13px] mb-6">
              AI generated {data.copyVariants.length} variants. Select the ones to keep in this planning draft.
            </p>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {data.copyVariants.map(variant => {
                const isSelected = data.selectedVariantIds.includes(variant.id)
                const isPreviewing = previewVariantId === variant.id
                return (
                  <div key={variant.id} className="rounded-[12px] overflow-hidden transition-all"
                    style={{ border: isSelected ? '1px solid #F97316' : '1px solid rgba(15,23,42,0.08)' }}>

                    {/* ── Selection card ─────────────────────────────────────── */}
                    <div
                      onClick={() => toggleVariant(variant.id)}
                      className="w-full text-left p-4 transition-all"
                      style={{
                        background: isSelected ? '#fff7ed' : '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider"
                          style={{ color: isSelected ? '#F97316' : '#94a3b8' }}>
                          {variant.label}
                        </span>
                        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{
                            background: isSelected ? '#F97316' : 'transparent',
                            border: isSelected ? '1px solid #F97316' : '1px solid rgba(15,23,42,0.15)',
                          }}>
                          {isSelected && <span className="text-[10px] text-white">✓</span>}
                        </div>
                      </div>
                      <p className="text-[13px] font-semibold text-slate-950 mb-1">{variant.headline}</p>
                      <p className="text-[12px] text-slate-500 line-clamp-2 leading-relaxed">{variant.primaryText}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] px-2 py-0.5 rounded-full"
                          style={{ background: '#ede9fe', color: '#6d28d9' }}>
                          {variant.angle.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-slate-500">{variant.callToAction}</span>
                        <button
                          onClick={e => { e.stopPropagation(); setPreviewVariantId(isPreviewing ? null : variant.id) }}
                          className="ml-auto text-[10px] px-2 py-0.5 rounded-full transition-all"
                          style={{
                            background: isPreviewing ? 'rgba(59,130,246,0.1)' : '#f8fafc',
                            color: isPreviewing ? '#2563eb' : '#64748b',
                            border: isPreviewing ? '1px solid rgba(59,130,246,0.25)' : '1px solid rgba(15,23,42,0.08)',
                          }}
                        >
                          {isPreviewing ? '✕ Hide' : '👁 Preview'}
                        </button>
                      </div>
                    </div>

                    {/* ── Facebook Feed Preview Mockup ──────────────────────── */}
                    {isPreviewing && (
                      <div style={{ background: '#f8fafc', borderTop: '1px solid rgba(15,23,42,0.06)', padding: '12px 12px 16px' }}>
                        <p className="text-center text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: '#6B7280' }}>
                          {data.platform === 'GOOGLE' ? 'Google Search Preview' : data.platform === 'LINKEDIN' ? 'LinkedIn Feed Preview' : 'Facebook Feed Preview'}
                        </p>

                        {/* Google Search mockup */}
                        {data.platform === 'GOOGLE' ? (
                          <div style={{ background: '#fff', borderRadius: 8, padding: '12px 14px', maxWidth: 320, margin: '0 auto' }}>
                            <p style={{ fontSize: 10, color: '#006621', margin: '0 0 1px' }}>Ad · yourbrand.com</p>
                            <p style={{ fontSize: 14, color: '#1a0dab', margin: '0 0 2px', fontWeight: 400, textDecoration: 'underline', cursor: 'default' }}>
                              {variant.headline}
                            </p>
                            <p style={{ fontSize: 12, color: '#545454', margin: 0, lineHeight: 1.4 }}>
                              {variant.description || variant.primaryText.slice(0, 100)}
                            </p>
                          </div>
                        ) : data.platform === 'LINKEDIN' ? (
                          /* LinkedIn mockup */
                          <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', maxWidth: 320, margin: '0 auto' }}>
                            <div style={{ padding: '10px 12px 8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <div style={{ width: 40, height: 40, borderRadius: 8, background: 'linear-gradient(135deg, #0A66C2, #004182)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>N</div>
                                <div>
                                  <p style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a', margin: 0 }}>Your Brand</p>
                                  <p style={{ fontSize: 10, color: '#666', margin: 0 }}>Promoted · 🌐</p>
                                </div>
                              </div>
                              <p style={{ fontSize: 12, color: '#1a1a1a', margin: '0 0 8px', lineHeight: 1.4 }}>
                                {variant.primaryText.length > 140 ? variant.primaryText.slice(0, 140) + '…' : variant.primaryText}
                              </p>
                            </div>
                            <div style={{ height: 130, background: 'linear-gradient(135deg, #e5e7eb, #d1d5db)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                              <span style={{ fontSize: 18 }}>🖼</span>
                              <span style={{ fontSize: 10, color: '#6b7280' }}>1200×627</span>
                            </div>
                            <div style={{ background: '#f3f2ef', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <p style={{ fontSize: 11, fontWeight: 600, color: '#1a1a1a', margin: '0 0 1px' }}>{variant.headline}</p>
                                {variant.description && <p style={{ fontSize: 10, color: '#666', margin: 0 }}>{variant.description}</p>}
                              </div>
                              <div style={{ fontSize: 11, fontWeight: 600, color: '#0A66C2', background: '#fff', border: '1px solid #0A66C2', borderRadius: 20, padding: '4px 10px', flexShrink: 0 }}>
                                {variant.callToAction.replace(/_/g, ' ')}
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* Facebook / Instagram Feed mockup */
                          <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', maxWidth: 320, margin: '0 auto' }}>
                            <div style={{ padding: '10px 12px 6px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #F97316, #EF4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>N</div>
                                <div>
                                  <p style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Your Brand</p>
                                  <p style={{ fontSize: 10, color: '#65676b', margin: 0 }}>Sponsored · 🌐</p>
                                </div>
                              </div>
                              <p style={{ fontSize: 12, color: '#1a1a1a', margin: 0, lineHeight: 1.4 }}>
                                {variant.primaryText.length > 150 ? variant.primaryText.slice(0, 150) + '…' : variant.primaryText}
                              </p>
                            </div>
                            <div style={{ height: 160, background: 'linear-gradient(135deg, #e5e7eb, #d1d5db)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                              <span style={{ fontSize: 22 }}>🖼</span>
                              <span style={{ fontSize: 10, color: '#6b7280' }}>Ad Creative (1080×1080)</span>
                            </div>
                            <div style={{ background: '#f0f2f5', padding: '8px 12px' }}>
                              <p style={{ fontSize: 11, fontWeight: 700, color: '#1a1a1a', margin: '0 0 2px' }}>{variant.headline}</p>
                              {variant.description && <p style={{ fontSize: 10, color: '#65676b', margin: 0 }}>{variant.description}</p>}
                            </div>
                            <div style={{ background: '#fff', padding: '8px 12px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e4e6ea' }}>
                              <div style={{ fontSize: 11, fontWeight: 600, color: '#1877F2', background: '#e7f3ff', border: '1px solid #b0c4de', borderRadius: 6, padding: '4px 12px' }}>
                                {variant.callToAction.replace(/_/g, ' ')}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(3)}
                className="px-4 py-2.5 rounded-xl text-[13px] font-medium text-slate-500 hover:text-slate-950 transition-all"
                style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.1)' }}>
                ← Back
              </button>
              <button
                onClick={() => setStep(5)}
                disabled={data.selectedVariantIds.length === 0}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all"
                style={{
                  background: data.selectedVariantIds.length > 0 ? '#F97316' : '#e2e8f0',
                  color: data.selectedVariantIds.length > 0 ? 'white' : '#94a3b8',
                }}
              >
                Continue with {data.selectedVariantIds.length} variant{data.selectedVariantIds.length !== 1 ? 's' : ''} →
              </button>
            </div>
          </div>
        )

      // ── STEP 5: Review + Setup ─────────────────────────────────────────
      case 5:
        return (
          <div>
            <h2 className="text-[18px] font-bold text-slate-950 mb-1">Review & Setup</h2>
            <p className="text-slate-500 text-[13px] mb-6">Your paid planning draft is saved for review. NEXUS has not launched ads or approved spend.</p>

            {/* Summary card */}
            <div className="p-4 rounded-[14px] mb-6 space-y-3 bg-white"
              style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-slate-500">Planning draft</span>
                <span className="text-[13px] font-semibold text-slate-950">{data.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-slate-500">Platform</span>
                <span className="text-[13px] font-semibold text-slate-950">{data.platform}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-slate-500">Objective</span>
                <span className="text-[13px] font-semibold text-slate-950">{data.objective.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-slate-500">Budget</span>
                <span className="text-[13px] font-semibold text-slate-950">
                  {data.currency} {data.budgetType === 'DAILY' ? `${data.dailyBudget}/day` : `${data.lifetimeBudget} total`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-slate-500">Ad Variants</span>
                <span className="text-[13px] font-semibold text-slate-950">{data.selectedVariantIds.length} selected</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-slate-500">AI Strategy</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(5,150,105,0.1)', color: '#059669' }}>
                  ✓ Generated
                </span>
              </div>
            </div>

            {/* Next steps */}
            <div className="p-4 rounded-[12px] mb-6"
              style={{ background: '#fff7ed', border: '1px solid rgba(249,115,22,0.2)' }}>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: '#c2410c' }}>Next Steps</p>
              <ul className="space-y-1.5 text-[12px] text-slate-500">
                <li>• Open the paid planning draft detail to review targeting</li>
                <li>• Upload your creative assets (image / video)</li>
                <li>
                  • {data.platform === 'META'
                    ? 'Create paused Meta platform drafts only after readiness is confirmed'
                    : `Export to ${data.platform} Ads Manager until its API connector is enabled`}
                </li>
                <li>• Track performance only after real platform metrics exist or are manually reported</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(4)}
                className="px-4 py-2.5 rounded-xl text-[13px] font-medium text-slate-500 hover:text-slate-950 transition-all"
                style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.1)' }}>
                ← Back
              </button>
              <button
                onClick={handleOpenDraft}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all"
                style={{ background: '#059669' }}
              >
                Open paid planning draft →
              </button>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  if (authLoading) {
    return (
      <AppShell>
        <div className="flex min-h-screen items-center justify-center bg-[#f6f8fc]">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
        </div>
      </AppShell>
    )
  }

  if (!isAuthenticated) return null

  return (
    <AppShell>
      <main className="min-h-screen bg-[#f6f8fc] text-[#071236]">
        <div className="mx-auto grid w-full max-w-[1540px] gap-6 px-4 py-6 pb-12 sm:px-6 lg:grid-cols-[minmax(0,780px)_360px] lg:px-8">
          {/* Header */}
          <div className="lg:col-span-2 flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_22px_70px_rgba(15,23,42,0.08)] sm:p-6">
            <div className="flex items-center gap-4">
            <button onClick={() => router.push('/paid-campaigns')}
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-slate-500 hover:text-slate-950 transition-all"
              style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.1)' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 2L4 7l5 5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div>
              <div className="mb-2 inline-flex rounded-full border border-orange-100 bg-orange-50 px-3 py-1 text-xs font-bold text-orange-600">
                {locale === 'ar' ? 'مسار موافقة مدفوع' : 'Approval-gated paid path'}
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950">
                {locale === 'ar' ? 'مسودة تخطيط مدفوع جديدة' : 'New Paid Planning Draft'}
              </h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                {locale === 'ar'
                  ? 'ابدأ بالمسودة، ثم أنشئ مسودة منصة متوقفة، ثم فعّل فقط بعد موافقة نهائية.'
                  : 'Start with a draft, create paused platform objects, then activate only after final approval.'}
              </p>
            </div>
            </div>
            <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
              {[
                locale === 'ar' ? 'لا إنفاق بدون موافقة' : 'No spend without approval',
                locale === 'ar' ? 'الميزانية افتراض تخطيطي' : 'Budget is a planning assumption',
                locale === 'ar' ? 'التحليلات بعد بيانات حقيقية' : 'Analytics after real data',
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 font-semibold">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="min-w-0">
          {/* Step bar */}
          <StepBar step={step} total={5} />

          {/* Card */}
          <div className="rounded-[26px] bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,0.06)]"
            style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
            {error && (
              <div className="mb-4 p-3 rounded-xl text-[12px]"
                style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#dc2626' }}>
                {error}
              </div>
            )}
            {renderStep()}
          </div>
          </div>

          <aside className="space-y-4 lg:pt-[92px]">
            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
              <p className="text-sm font-black text-slate-950">{locale === 'ar' ? 'حقيقة التنفيذ' : 'Execution truth'}</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {locale === 'ar'
                  ? 'هذه الصفحة تنشئ تخطيطاً أو مسودة مراجعة. لا يتم إطلاق إعلان، ولا صرف ميزانية، ولا تفعيل منصة إلا من شاشة تأكيد منفصلة.'
                  : 'This page creates planning or review drafts. No ad launches, budget spend, or platform activation happens without a separate confirmation screen.'}
              </p>
            </div>
            <div className="rounded-[24px] border border-indigo-100 bg-indigo-50/70 p-5">
              <p className="text-sm font-black text-slate-950">{locale === 'ar' ? 'مسار صحيح' : 'Correct path'}</p>
              <ol className="mt-3 space-y-3 text-sm text-slate-600">
                {(locale === 'ar'
                  ? ['اختيار المنصة والحساب', 'إدخال ميزانية كافتراض', 'إنشاء استراتيجية ونصوص للمراجعة', 'إنشاء مسودة منصة متوقفة لاحقاً', 'تفعيل فقط بعد موافقة صريحة']
                  : ['Choose platform and account', 'Enter budget as an assumption', 'Generate strategy and copy for review', 'Create paused platform draft later', 'Activate only after explicit approval']
                ).map((item, index) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-indigo-600">{index + 1}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        </div>
      </main>
    </AppShell>
  )
}
