'use client'

/**
 * /campaigns/[id]/paid-launch
 *
 * The Paid Planning Brief — a paid campaign brief/plan the user reviews before
 * running paid ads on Meta, Google, TikTok, and LinkedIn. Planning only: NEXUS
 * does not launch ads or spend budget.
 *
 * Architecture note: the data model maps 1:1 to Meta Marketing API fields.
 * When API approvals arrive, we add one function call on top of this page.
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import AppShell from '@/components/AppShell'
import CreditConfirmModal from '@/components/CreditConfirmModal'
// Mirror of CREDIT_COSTS.PAID_PACK_GENERATE in src/lib/credits.ts (server is the
// source of truth and still deducts/refunds; this literal is display-only).
const PAID_PACK_COST = 6
import {
  Target, Zap, Users, DollarSign, Copy, ExternalLink,
  CheckCircle, TrendingUp, Brain, ChevronDown, ChevronUp,
  RefreshCw, AlertCircle, BarChart3, ArrowLeft,
  Link2, BookOpen
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

interface CopyVariant {
  id: string
  label: string
  platform: string
  primaryText: string
  headline: string
  description: string
  cta: string
  hook: string
  angle: string
}

interface AudienceBrief {
  meta?: {
    ageMin: number; ageMax: number; genders: string[]; locations: string[]
    interests: string[]; behaviors: string[]; exclusions: string[]
    customAudienceSuggestions: string[]; placementRecommendation: string
    bidStrategy: string; estimatedAudienceSize: string
  }
  google?: {
    campaignType: string; keywords: string[]; negativeKeywords: string[]
    audienceSegments: string[]; matchTypes: string; locations: string[]; bidStrategy: string
  }
  tiktok?: {
    ageMin: number; ageMax: number; genders: string[]; locations: string[]
    interests: string[]; behaviors: string[]; videoFormat: string; creatorSuggestion: string
  }
  linkedin?: {
    jobTitles: string[]; industries: string[]; companySizes: string[]
    seniority: string[]; skills: string[]; adFormat: string
  }
}

interface EstimatedReach {
  [platform: string]: { impressionsMin: number; impressionsMax: number; cpmMin: number; cpmMax: number }
}

interface BudgetInsights {
  recommendation: string
  splitSuggestion: Record<string, number>
  phasingSuggestion: string
  competitorBenchmark: string
  expectedResults: string
}

interface PaidPack {
  id: string
  status: 'DRAFT' | 'GENERATED' | 'LAUNCHED' | 'COMPLETED'
  objective: string
  platforms: string[]
  dailyBudget: number | null
  totalBudget: number | null
  durationDays: number
  currency: string
  audienceBrief: AudienceBrief | null
  copyVariants: CopyVariant[] | null
  estimatedReach: EstimatedReach | null
  utmParams: { examples: Record<string, string>; campaign: string } | null
  platformGuides: Record<string, string[]> | null
  budgetInsights: BudgetInsights | null
  metrics: Record<string, number> | null
  learnings: Record<string, unknown> | null
  brandBrainUpdated: boolean
  generatedAt: string | null
}

interface Campaign {
  id: string
  name: string
  goal: string
}

// ─── Constants ──────────────────────────────────────────────────────────────

const OBJECTIVES = [
  { value: 'TRAFFIC',     label: 'Traffic',     icon: '🔗', desc: 'Website visits, link clicks' },
  { value: 'CONVERSIONS', label: 'Conversions',  icon: '💰', desc: 'Purchases, sign-ups, leads' },
  { value: 'AWARENESS',   label: 'Awareness',    icon: '👁️', desc: 'Reach & brand recognition' },
  { value: 'LEADS',       label: 'Lead Gen',     icon: '📋', desc: 'In-platform lead forms' },
  { value: 'ENGAGEMENT',  label: 'Engagement',   icon: '❤️', desc: 'Likes, shares, video views' },
]

const PLATFORMS = [
  { value: 'meta',     label: 'Meta',     icon: '𝓕', color: '#1877F2', bg: 'rgba(24,119,242,0.1)' },
  { value: 'google',   label: 'Google',   icon: 'G', color: '#4285F4', bg: 'rgba(66,133,244,0.1)' },
  { value: 'tiktok',   label: 'TikTok',   icon: '♪', color: '#E879F9', bg: 'rgba(232,121,249,0.1)' },
  { value: 'linkedin', label: 'LinkedIn', icon: 'in', color: '#0A66C2', bg: 'rgba(10,102,194,0.1)' },
]

const PLATFORM_LINKS: Record<string, string> = {
  meta:     'https://www.facebook.com/adsmanager/manage/campaigns/new',
  google:   'https://ads.google.com/aw/campaigns/new',
  tiktok:   'https://ads.tiktok.com/i18n/dashboard/campaign',
  linkedin: 'https://www.linkedin.com/campaignmanager/',
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT:     '#94a3b8',
  GENERATED: '#22d3ee',
  LAUNCHED:  '#4ade80',
  COMPLETED: '#a78bfa',
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Planning draft',
  GENERATED: 'Planning pack ready for review',
  LAUNCHED: 'External launch recorded',
  COMPLETED: 'External campaign ended',
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Section({ title, icon, children, defaultOpen = true }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, marginBottom: 16 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', color: '#e2e8f0' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: 15 }}>
          {icon}{title}
        </div>
        {open ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
      </button>
      {open && <div style={{ padding: '0 20px 20px' }}>{children}</div>}
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: copied ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)', color: copied ? '#4ade80' : '#94a3b8', fontSize: 11, cursor: 'pointer' }}
    >
      {copied ? <CheckCircle size={12} /> : <Copy size={12} />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

function Tag({ children }: { children: string }) {
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#a5b4fc', fontSize: 11, margin: '2px' }}>
      {children}
    </span>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function PaidLaunchPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { authHeader } = useAuth()

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [pack, setPack] = useState<PaidPack | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Setup form state
  const [objective, setObjective] = useState('TRAFFIC')
  const [platforms, setPlatforms] = useState<string[]>(['meta'])
  const [dailyBudget, setDailyBudget] = useState<number>(20)
  const [durationDays, setDurationDays] = useState<number>(7)
  const [currency, setCurrency] = useState('USD')

  // Metrics form
  const [showMetricsForm, setShowMetricsForm] = useState(false)
  const [metricsForm, setMetricsForm] = useState({ impressions: '', reach: '', clicks: '', spend: '', conversions: '', roas: '' })
  const [savingMetrics, setSavingMetrics] = useState(false)
  const [extractingLearnings, setExtractingLearnings] = useState(false)
  const [showExternalLaunchConfirm, setShowExternalLaunchConfirm] = useState(false)
  const [externalLaunchAcknowledged, setExternalLaunchAcknowledged] = useState(false)

  // Selected copy variant
  const [selectedVariant, setSelectedVariant] = useState<string>('v1')
  const [expandedPlatform, setExpandedPlatform] = useState<string>('meta')

  // ── Fetch ──
  const fetchData = useCallback(async () => {
    try {
      const [campRes, packRes] = await Promise.all([
        fetch(`/api/campaigns/${id}`, { headers: { Authorization: authHeader() } }),
        fetch(`/api/campaigns/${id}/paid-pack`, { headers: { Authorization: authHeader() } }),
      ])
      if (campRes.ok) {
        const campData = await campRes.json()
        setCampaign(campData.campaign ?? campData)
      }
      if (packRes.ok) {
        const packData = await packRes.json()
        if (packData.pack) {
          setPack(packData.pack)
          setObjective(packData.pack.objective ?? 'TRAFFIC')
          setPlatforms(packData.pack.platforms ?? ['meta'])
          setDailyBudget(packData.pack.dailyBudget ?? 20)
          setDurationDays(packData.pack.durationDays ?? 7)
          setCurrency(packData.pack.currency ?? 'USD')
        }
      }
    } catch (e) {
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [id, authHeader])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Save setup then generate ──
  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    try {
      // First save setup
      await fetch(`/api/campaigns/${id}/paid-pack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
        body: JSON.stringify({ objective, platforms, dailyBudget, durationDays, currency }),
      })
      // Then generate
      const res = await fetch(`/api/campaigns/${id}/paid-pack/generate`, {
        method: 'POST',
        headers: { Authorization: authHeader() },
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Generation failed')
      } else {
        setPack(data.pack)
      }
    } catch {
      setError('Generation failed. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  // ── Save metrics ──
  const handleSaveMetrics = async () => {
    setSavingMetrics(true)
    try {
      const res = await fetch(`/api/campaigns/${id}/paid-pack/metrics`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
        body: JSON.stringify({
          impressions: parseFloat(metricsForm.impressions) || 0,
          reach: parseFloat(metricsForm.reach) || 0,
          clicks: parseFloat(metricsForm.clicks) || 0,
          spend: parseFloat(metricsForm.spend) || 0,
          conversions: parseFloat(metricsForm.conversions) || 0,
          roas: parseFloat(metricsForm.roas) || 0,
          metricsSource: 'manual',
        }),
      })
      if (res.ok) { const data = await res.json(); setPack(data.pack); setShowMetricsForm(false) }
    } finally { setSavingMetrics(false) }
  }

  // ── Extract paid metrics signals ──
  const handleExtractLearnings = async () => {
    setExtractingLearnings(true)
    setError(null)
    try {
      const res = await fetch(`/api/campaigns/${id}/paid-pack/learn`, {
        method: 'POST',
        headers: { Authorization: authHeader() },
      })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Metrics signal extraction failed')
      else { await fetchData() }
    } catch { setError('Failed to extract metrics signals') }
    finally { setExtractingLearnings(false) }
  }

  // ── Mark launched ──
  const handleMarkLaunched = async () => {
    if (!externalLaunchAcknowledged) return
    await fetch(`/api/campaigns/${id}/paid-pack/metrics`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
      body: JSON.stringify({
        status: 'LAUNCHED',
        explicitExternalLaunchConfirmed: true,
        launchNotes: 'User confirmed this paid campaign was launched outside NEXUS. NEXUS did not launch ads or control spend.',
      }),
    })
    setShowExternalLaunchConfirm(false)
    setExternalLaunchAcknowledged(false)
    await fetchData()
  }

  // ── Mark completed ──
  const handleMarkCompleted = async () => {
    await fetch(`/api/campaigns/${id}/paid-pack/metrics`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
      body: JSON.stringify({ status: 'COMPLETED', explicitCompletionConfirmed: true, completedAt: new Date().toISOString() }),
    })
    setShowMetricsForm(true)
    await fetchData()
  }

  // ── Toggle platform ──
  const togglePlatform = (p: string) => {
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  const totalBudget = dailyBudget * durationDays
  const hasGenerated = pack?.status !== 'DRAFT' && pack?.audienceBrief
  const isLaunched = pack?.status === 'LAUNCHED'
  const isCompleted = pack?.status === 'COMPLETED'

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AppShell>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#94a3b8' }}>
          <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', marginRight: 8 }} />
          Loading...
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <button
            onClick={() => router.back()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, marginBottom: 16 }}
          >
            <ArrowLeft size={14} /> Back to Campaign
          </button>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <BookOpen size={22} color="#94a3b8" />
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#f1f5f9' }}>
                  Paid Planning Brief
                </h1>
                {pack?.status && (
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${STATUS_COLORS[pack.status]}20`, color: STATUS_COLORS[pack.status], border: `1px solid ${STATUS_COLORS[pack.status]}40` }}>
                    {STATUS_LABELS[pack.status] ?? pack.status}
                  </span>
                )}
              </div>
              <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>
                {campaign?.name ?? 'Campaign'} — a paid planning brief for review. Planning only — ads will not launch and no budget will be spent without explicit approval.
              </p>
              <button
                onClick={() => router.push('/paid-campaigns')}
                style={{ marginTop: 8, padding: 0, border: 'none', background: 'none', color: '#38bdf8', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                Open Paid Ads Planning hub →
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {hasGenerated && !isLaunched && !isCompleted && (
                <button
                  onClick={() => setShowExternalLaunchConfirm(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                  <CheckCircle size={14} /> Record external launch
                </button>
              )}
              {isLaunched && !isCompleted && (
                <button
                  onClick={handleMarkCompleted}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#a78bfa,#7c3aed)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                  <BarChart3 size={14} /> External campaign ended — enter reported metrics
                </button>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', marginBottom: 16, fontSize: 13 }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {/* ═══ SETUP SECTION ═══ */}
        <Section title="Paid Planning Setup" icon={<Target size={16} color="#f59e0b" />}>
          <div style={{ display: 'grid', gap: 20 }}>

            {/* Objective */}
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Planning Objective</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                {OBJECTIVES.map(obj => (
                  <button
                    key={obj.value}
                    onClick={() => setObjective(obj.value)}
                    style={{
                      padding: '10px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                      background: objective === obj.value ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.03)',
                      border: objective === obj.value ? '1.5px solid rgba(245,158,11,0.5)' : '1px solid rgba(255,255,255,0.08)',
                      color: '#e2e8f0',
                    }}
                  >
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{obj.icon}</div>
                    <div style={{ fontWeight: 700, fontSize: 12 }}>{obj.label}</div>
                    <div style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>{obj.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Platforms */}
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Platforms</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {PLATFORMS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => togglePlatform(p.value)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
                      background: platforms.includes(p.value) ? p.bg : 'rgba(255,255,255,0.03)',
                      border: platforms.includes(p.value) ? `1.5px solid ${p.color}60` : '1px solid rgba(255,255,255,0.08)',
                      color: platforms.includes(p.value) ? p.color : '#64748b',
                      fontWeight: 600, fontSize: 13,
                    }}
                  >
                    <span style={{ fontSize: 15, fontWeight: 800 }}>{p.icon}</span> {p.label}
                    {platforms.includes(p.value) && <CheckCircle size={12} />}
                  </button>
                ))}
              </div>
            </div>

            {/* Budget & Duration */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Daily Budget Planning Assumption</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <select
                    value={currency}
                    onChange={e => setCurrency(e.target.value)}
                    style={{ padding: '8px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', fontSize: 12 }}
                  >
                    <option value="USD">USD</option>
                    <option value="EGP">EGP</option>
                    <option value="SAR">SAR</option>
                    <option value="AED">AED</option>
                  </select>
                  <input
                    type="number" min={1} value={dailyBudget}
                    onChange={e => setDailyBudget(parseFloat(e.target.value) || 0)}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', fontSize: 14, fontWeight: 700 }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duration (days)</label>
                <input
                  type="number" min={1} max={90} value={durationDays}
                  onChange={e => setDurationDays(parseInt(e.target.value) || 7)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', fontSize: 14, fontWeight: 700 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Planning Assumption</label>
                <div style={{ padding: '8px 12px', borderRadius: 6, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbf24', fontSize: 16, fontWeight: 800 }}>
                  {currency} {totalBudget.toLocaleString()}
                </div>
              </div>
            </div>
            <p style={{ margin: '-6px 0 0', color: '#64748b', fontSize: 11, lineHeight: 1.5 }}>
              Budget values are planning assumptions for review. They are not approved spend and NEXUS will not launch ads or control spend from this page.
            </p>

            {/* Generate button — gated by a credit-confirmation modal */}
            <button
              onClick={() => setShowGenerateConfirm(true)}
              disabled={generating || platforms.length === 0}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '13px 24px', borderRadius: 10, border: 'none', cursor: generating ? 'wait' : 'pointer',
                background: generating ? 'rgba(245,158,11,0.2)' : 'linear-gradient(135deg,#f59e0b,#d97706)',
                color: '#fff', fontWeight: 800, fontSize: 14,
                opacity: platforms.length === 0 ? 0.5 : 1,
              }}
            >
              {generating ? (
                <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Generating paid planning pack...</>
              ) : (
                <><Zap size={16} /> {hasGenerated ? 'Regenerate paid planning pack' : 'Generate paid planning pack'} — {PAID_PACK_COST} credits</>
              )}
            </button>
          </div>
        </Section>

        {/* ═══ GENERATED CONTENT ═══ */}
        {hasGenerated && pack && (
          <>
            {/* Estimated Reach */}
            {pack.estimatedReach && (
              <Section title="Planning Reach Estimate" icon={<TrendingUp size={16} color="#22d3ee" />}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                  {Object.entries(pack.estimatedReach as Record<string, { impressionsMin?: number; impressionsMax?: number; cpmMin?: number; cpmMax?: number }>).map(([p, r]) => {
                    const plat = PLATFORMS.find(x => x.value === p)
                    const impMin = r?.impressionsMin ?? 0
                    const impMax = r?.impressionsMax ?? 0
                    const cpmMin = r?.cpmMin ?? 0
                    const cpmMax = r?.cpmMax ?? 0
                    return (
                      <div key={p} style={{ padding: '14px', borderRadius: 10, background: `${plat?.bg ?? 'rgba(255,255,255,0.03)'}`, border: `1px solid ${plat?.color ?? '#334155'}30` }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: plat?.color ?? '#94a3b8', marginBottom: 8 }}>
                          {plat?.icon} {plat?.label ?? p}
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9' }}>
                          {(impMin / 1000).toFixed(0)}K – {(impMax / 1000).toFixed(0)}K
                        </div>
                        <div style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>
                          planning impressions · CPM assumption ${cpmMin}–${cpmMax}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {pack.budgetInsights && (
                  <div style={{ marginTop: 16, padding: '14px', borderRadius: 10, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                    <div style={{ color: '#fbbf24', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>💡 Budget Planning Notes</div>
                    <p style={{ margin: '0 0 8px', color: '#cbd5e1', fontSize: 13, lineHeight: 1.6 }}>{pack.budgetInsights.recommendation}</p>
                    <p style={{ margin: '0 0 6px', color: '#94a3b8', fontSize: 12 }}><strong style={{ color: '#e2e8f0' }}>Phasing:</strong> {pack.budgetInsights.phasingSuggestion}</p>
                    <p style={{ margin: 0, color: '#94a3b8', fontSize: 12 }}><strong style={{ color: '#e2e8f0' }}>Planning assumption:</strong> {pack.budgetInsights.expectedResults}</p>
                  </div>
                )}
              </Section>
            )}

            {/* Audience Brief */}
            {pack.audienceBrief && (
              <Section title="AI Audience Brief" icon={<Users size={16} color="#a78bfa" />}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                  {(pack.platforms ?? []).map(p => (
                    <button
                      key={p}
                      onClick={() => setExpandedPlatform(p)}
                      style={{
                        padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        background: expandedPlatform === p ? PLATFORMS.find(x => x.value === p)?.bg ?? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.03)',
                        border: expandedPlatform === p ? `1.5px solid ${PLATFORMS.find(x => x.value === p)?.color ?? '#6366f1'}60` : '1px solid rgba(255,255,255,0.08)',
                        color: expandedPlatform === p ? PLATFORMS.find(x => x.value === p)?.color ?? '#a5b4fc' : '#64748b',
                      }}
                    >
                      {PLATFORMS.find(x => x.value === p)?.icon} {PLATFORMS.find(x => x.value === p)?.label ?? p}
                    </button>
                  ))}
                </div>

                {/* Meta audience */}
                {expandedPlatform === 'meta' && pack.audienceBrief.meta && (() => {
                  const m = pack.audienceBrief.meta
                  return (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>AGE · GENDER · LOCATION</div>
                          <div style={{ color: '#e2e8f0', fontSize: 13 }}>{m.ageMin}–{m.ageMax} years · {(m.genders ?? []).join(', ')}</div>
                          <div style={{ marginTop: 4 }}>{(m.locations ?? []).map(l => <Tag key={l}>{l}</Tag>)}</div>
                        </div>
                        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>PLACEMENTS · BID STRATEGY</div>
                          <div style={{ color: '#e2e8f0', fontSize: 12 }}>{m.placementRecommendation}</div>
                          <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>{m.bidStrategy} · Audience: {m.estimatedAudienceSize}</div>
                        </div>
                      </div>
                      <div style={{ padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>INTERESTS</div>
                        <div>{(m.interests ?? []).map(i => <Tag key={i}>{i}</Tag>)}</div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>BEHAVIORS</div>
                          <div>{(m.behaviors ?? []).map(b => <Tag key={b}>{b}</Tag>)}</div>
                        </div>
                        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>EXCLUSIONS</div>
                          <div>{(m.exclusions ?? []).map(e => <Tag key={e}>{e}</Tag>)}</div>
                        </div>
                      </div>
                      {(m.customAudienceSuggestions ?? []).length > 0 && (
                        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
                          <div style={{ color: '#a78bfa', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>💡 CUSTOM AUDIENCE IDEAS</div>
                          {(m.customAudienceSuggestions ?? []).map(c => (
                            <div key={c} style={{ color: '#c4b5fd', fontSize: 12, marginBottom: 3 }}>→ {c}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Google audience */}
                {expandedPlatform === 'google' && pack.audienceBrief.google && (() => {
                  const g = pack.audienceBrief.google
                  const keywords = g.keywords ?? []
                  const negKeywords = g.negativeKeywords ?? []
                  return (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>CAMPAIGN TYPE · BID</div>
                          <div style={{ color: '#e2e8f0', fontSize: 13 }}>{g.campaignType}</div>
                          <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>{g.bidStrategy} · {g.matchTypes}</div>
                        </div>
                        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>LOCATIONS</div>
                          <div>{(g.locations ?? []).map(l => <Tag key={l}>{l}</Tag>)}</div>
                        </div>
                      </div>
                      <div style={{ padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700 }}>KEYWORDS ({keywords.length})</div>
                          <CopyButton text={keywords.join('\n')} />
                        </div>
                        <div>{keywords.map(k => <Tag key={k}>{k}</Tag>)}</div>
                      </div>
                      <div style={{ padding: 12, borderRadius: 8, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
                        <div style={{ color: '#fca5a5', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>NEGATIVE KEYWORDS</div>
                        <div>{negKeywords.map(k => <Tag key={k}>{k}</Tag>)}</div>
                      </div>
                    </div>
                  )
                })()}

                {/* TikTok audience */}
                {expandedPlatform === 'tiktok' && pack.audienceBrief.tiktok && (() => {
                  const t = pack.audienceBrief.tiktok
                  return (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>DEMOGRAPHICS</div>
                          <div style={{ color: '#e2e8f0', fontSize: 13 }}>{t.ageMin}–{t.ageMax} · {(t.genders ?? []).join(', ')}</div>
                          <div>{(t.locations ?? []).map(l => <Tag key={l}>{l}</Tag>)}</div>
                        </div>
                        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>FORMAT · CREATOR</div>
                          <div style={{ color: '#e879f9', fontSize: 12, marginBottom: 4 }}>{t.videoFormat}</div>
                          <div style={{ color: '#94a3b8', fontSize: 11 }}>{t.creatorSuggestion}</div>
                        </div>
                      </div>
                      <div style={{ padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>INTERESTS</div>
                        <div>{(t.interests ?? []).map(i => <Tag key={i}>{i}</Tag>)}</div>
                      </div>
                    </div>
                  )
                })()}

                {/* LinkedIn audience */}
                {expandedPlatform === 'linkedin' && pack.audienceBrief.linkedin && (() => {
                  const l = pack.audienceBrief.linkedin
                  return (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>JOB TITLES</div>
                          <div>{(l.jobTitles ?? []).map(t => <Tag key={t}>{t}</Tag>)}</div>
                        </div>
                        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>SENIORITY</div>
                          <div>{(l.seniority ?? []).map(s => <Tag key={s}>{s}</Tag>)}</div>
                        </div>
                      </div>
                      <div style={{ padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>FORMAT: {l.adFormat} · INDUSTRIES</div>
                        <div>{(l.industries ?? []).map(i => <Tag key={i}>{i}</Tag>)}</div>
                      </div>
                    </div>
                  )
                })()}
              </Section>
            )}

            {/* Copy Variants */}
            {pack.copyVariants && pack.copyVariants.length > 0 && (
              <Section title="Ad Copy Variants" icon={<Copy size={16} color="#4ade80" />}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                  {pack.copyVariants.map(v => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariant(v.id)}
                      style={{
                        padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        background: selectedVariant === v.id ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.03)',
                        border: selectedVariant === v.id ? '1.5px solid rgba(74,222,128,0.4)' : '1px solid rgba(255,255,255,0.08)',
                        color: selectedVariant === v.id ? '#4ade80' : '#64748b',
                      }}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>

                {(() => {
                  const v = pack.copyVariants?.find(x => x.id === selectedVariant) ?? pack.copyVariants?.[0]
                  if (!v) return null
                  return (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ padding: 16, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Primary Text / Caption</div>
                          <CopyButton text={v.primaryText} />
                        </div>
                        <pre style={{ margin: 0, color: '#e2e8f0', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{v.primaryText}</pre>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div style={{ padding: 14, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700 }}>HEADLINE</div>
                            <CopyButton text={v.headline} />
                          </div>
                          <div style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 700 }}>{v.headline}</div>
                        </div>
                        <div style={{ padding: 14, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700 }}>DESCRIPTION</div>
                            <CopyButton text={v.description} />
                          </div>
                          <div style={{ color: '#cbd5e1', fontSize: 12 }}>{v.description}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(34,197,94,0.1)', color: '#4ade80', fontSize: 11, fontWeight: 700 }}>CTA: {v.cta}</span>
                        <span style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', fontSize: 11 }}>Angle: {v.angle}</span>
                        <span style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(245,158,11,0.1)', color: '#fbbf24', fontSize: 11 }}>Platform: {v.platform}</span>
                      </div>
                    </div>
                  )
                })()}
              </Section>
            )}

            {/* UTM Parameters */}
            {pack.utmParams && (
              <Section title="UTM Tracking Parameters" icon={<Link2 size={16} color="#22d3ee" />} defaultOpen={false}>
                <p style={{ color: '#64748b', fontSize: 12, margin: '0 0 14px' }}>
                  Add these to your destination URL in the ad platform to track performance in Google Analytics.
                </p>
                <div style={{ display: 'grid', gap: 10 }}>
                  {Object.entries(pack.utmParams.examples ?? {}).map(([p, utm]) => {
                    const plat = PLATFORMS.find(x => x.value === p)
                    return (
                      <div key={p} style={{ padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ color: plat?.color ?? '#94a3b8', fontSize: 12, fontWeight: 700 }}>{plat?.icon} {plat?.label ?? p}</span>
                          <CopyButton text={utm} />
                        </div>
                        <code style={{ color: '#94a3b8', fontSize: 11, wordBreak: 'break-all' }}>{utm}</code>
                      </div>
                    )
                  })}
                </div>
              </Section>
            )}

            {/* Platform Setup Guides */}
            {pack.platformGuides && (
              <Section title="Step-by-Step Setup Guides" icon={<BookOpen size={16} color="#f472b6" />} defaultOpen={false}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                  {(pack.platforms ?? []).map(p => (
                    <button
                      key={p}
                      onClick={() => setExpandedPlatform(p)}
                      style={{
                        padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        background: expandedPlatform === p ? PLATFORMS.find(x => x.value === p)?.bg ?? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)',
                        border: expandedPlatform === p ? `1.5px solid ${PLATFORMS.find(x => x.value === p)?.color ?? '#6366f1'}60` : '1px solid rgba(255,255,255,0.08)',
                        color: expandedPlatform === p ? PLATFORMS.find(x => x.value === p)?.color ?? '#a5b4fc' : '#64748b',
                      }}
                    >
                      {PLATFORMS.find(x => x.value === p)?.icon} {PLATFORMS.find(x => x.value === p)?.label ?? p}
                    </button>
                  ))}
                </div>

                {pack.platformGuides[expandedPlatform] && (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {pack.platformGuides[expandedPlatform].map((step: string, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: PLATFORMS.find(x => x.value === expandedPlatform)?.bg ?? 'rgba(99,102,241,0.1)', border: `1px solid ${PLATFORMS.find(x => x.value === expandedPlatform)?.color ?? '#6366f1'}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: PLATFORMS.find(x => x.value === expandedPlatform)?.color ?? '#a5b4fc', flexShrink: 0 }}>
                          {i + 1}
                        </div>
                        <div style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.5 }}>{step}</div>
                      </div>
                    ))}
                    <a
                      href={PLATFORM_LINKS[expandedPlatform]}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 20px', borderRadius: 8, border: 'none', background: PLATFORMS.find(x => x.value === expandedPlatform)?.bg ?? 'rgba(99,102,241,0.1)', color: PLATFORMS.find(x => x.value === expandedPlatform)?.color ?? '#a5b4fc', fontWeight: 700, fontSize: 13, textDecoration: 'none', marginTop: 8 }}
                    >
                      <ExternalLink size={14} /> Open {PLATFORMS.find(x => x.value === expandedPlatform)?.label ?? expandedPlatform} Ads Manager →
                    </a>
                  </div>
                )}
              </Section>
            )}

            {/* Metrics Entry */}
            {(isLaunched || isCompleted || showMetricsForm) && (
              <Section title="Campaign Performance" icon={<BarChart3 size={16} color="#4ade80" />}>
                {pack.metrics && !showMetricsForm ? (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
                      {[
                        { key: 'impressions', label: 'Impressions', fmt: (v: number) => v.toLocaleString() },
                        { key: 'reach',       label: 'Reach',        fmt: (v: number) => v.toLocaleString() },
                        { key: 'clicks',      label: 'Clicks',       fmt: (v: number) => v.toLocaleString() },
                        { key: 'spend',       label: 'Spend',        fmt: (v: number) => `$${v.toFixed(2)}` },
                        { key: 'conversions', label: 'Conversions',  fmt: (v: number) => v.toLocaleString() },
                        { key: 'roas',        label: 'ROAS',         fmt: (v: number) => `${v.toFixed(2)}x` },
                      ].map(m => {
                        const val = (pack.metrics as Record<string, number>)?.[m.key]
                        if (!val) return null
                        return (
                          <div key={m.key} style={{ padding: 12, borderRadius: 8, background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.15)', textAlign: 'center' }}>
                            <div style={{ color: '#64748b', fontSize: 10, marginBottom: 4 }}>{m.label}</div>
                            <div style={{ color: '#4ade80', fontSize: 18, fontWeight: 800 }}>{m.fmt(val)}</div>
                          </div>
                        )
                      })}
                    </div>
                    <button onClick={() => setShowMetricsForm(true)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>
                      Edit Metrics
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 12 }}>
                    <p style={{ margin: '0 0 8px', color: '#64748b', fontSize: 12 }}>
                      Enter your campaign results from the ad platform's reporting dashboard.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                      {[
                        { key: 'impressions', label: 'Impressions', placeholder: '50000' },
                        { key: 'reach',       label: 'Reach',       placeholder: '30000' },
                        { key: 'clicks',      label: 'Clicks',      placeholder: '1200' },
                        { key: 'spend',       label: 'Spend ($)',   placeholder: '140.00' },
                        { key: 'conversions', label: 'Conversions', placeholder: '24' },
                        { key: 'roas',        label: 'ROAS',        placeholder: '3.2' },
                      ].map(f => (
                        <div key={f.key}>
                          <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>{f.label}</label>
                          <input
                            type="number"
                            placeholder={f.placeholder}
                            value={metricsForm[f.key as keyof typeof metricsForm]}
                            onChange={e => setMetricsForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', fontSize: 13 }}
                          />
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={handleSaveMetrics}
                        disabled={savingMetrics}
                        style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                      >
                        {savingMetrics ? 'Saving...' : 'Save Metrics'}
                      </button>
                      <button onClick={() => setShowMetricsForm(false)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </Section>
            )}

            {/* Brand Brain paid metrics signals */}
            {(pack.metrics || isCompleted) && (
              <Section title="Brand Brain Paid Metrics Signals" icon={<Brain size={16} color="#a78bfa" />}>
                {pack.learnings ? (
                  <div style={{ display: 'grid', gap: 12 }}>
                    {pack.brandBrainUpdated && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)', color: '#c4b5fd', fontSize: 13 }}>
                        <CheckCircle size={14} /> Paid metrics signal saved for Brand Brain review
                      </div>
                    )}
                    <div style={{ padding: 14, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div style={{ color: '#a78bfa', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>EXECUTIVE SUMMARY</div>
                      <p style={{ margin: 0, color: '#cbd5e1', fontSize: 13, lineHeight: 1.6 }}>
                        {(pack.learnings as Record<string, unknown>)?.executiveSummary as string}
                      </p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      {!!(pack.learnings as Record<string, unknown>)?.keyInsight && (
                        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                          <div style={{ color: '#fbbf24', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>KEY INSIGHT</div>
                          <p style={{ margin: 0, color: '#fde68a', fontSize: 12, lineHeight: 1.5 }}>
                            {(pack.learnings as Record<string, unknown>)?.keyInsight as string}
                          </p>
                        </div>
                      )}
                      {!!(pack.learnings as Record<string, unknown>)?.nextCampaignRecommendation && (
                        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
                          <div style={{ color: '#4ade80', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>NEXT CAMPAIGN</div>
                          <p style={{ margin: 0, color: '#86efac', fontSize: 12, lineHeight: 1.5 }}>
                            {(pack.learnings as Record<string, unknown>)?.nextCampaignRecommendation as string}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <Brain size={28} color="#4b5563" style={{ marginBottom: 10 }} />
                    <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 14px' }}>
                      Enter your campaign metrics above, then create a paid metrics signal for Brand Brain review.
                    </p>
                    <button
                      onClick={handleExtractLearnings}
                      disabled={extractingLearnings || !pack.metrics}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px',
                        borderRadius: 8, border: 'none', cursor: (extractingLearnings || !pack.metrics) ? 'not-allowed' : 'pointer',
                        background: (extractingLearnings || !pack.metrics) ? 'rgba(167,139,250,0.2)' : 'linear-gradient(135deg,#a78bfa,#7c3aed)',
                        color: '#fff', fontWeight: 700, fontSize: 13,
                        opacity: !pack.metrics ? 0.5 : 1,
                      }}
                    >
                      {extractingLearnings ? (
                        <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Extracting...</>
                      ) : (
                        <><Brain size={14} /> Create Metrics Signal — 2 credits</>
                      )}
                    </button>
                  </div>
                )}
              </Section>
            )}
          </>
        )}

        <style>{`
          @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        `}</style>
      </div>

      <CreditConfirmModal
        isOpen={showGenerateConfirm}
        onClose={() => setShowGenerateConfirm(false)}
        onConfirm={handleGenerate}
        cost={PAID_PACK_COST}
        actionTitle="Generate paid planning pack"
        authHeader={authHeader}
        includedItems={['Audience brief', 'Copy variants', 'Budget plan', 'Platform setup guidance']}
        confirmLabel={`Confirm & Generate — ${PAID_PACK_COST} credits`}
      />
      {showExternalLaunchConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm external paid launch"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            background: 'rgba(2,6,23,0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div style={{ width: '100%', maxWidth: 460, borderRadius: 14, background: '#0f172a', border: '1px solid rgba(148,163,184,0.22)', padding: 20 }}>
            <h2 style={{ margin: '0 0 8px', color: '#f8fafc', fontSize: 18, fontWeight: 800 }}>
              Record external launch
            </h2>
            <p style={{ margin: '0 0 14px', color: '#94a3b8', fontSize: 13, lineHeight: 1.6 }}>
              NEXUS did not launch this campaign, publish ads, or control spend. This only records that you launched the paid campaign outside NEXUS after your own budget, tracking, creative, and platform review.
            </p>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: '#cbd5e1', fontSize: 13, lineHeight: 1.5, padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <input
                type="checkbox"
                checked={externalLaunchAcknowledged}
                onChange={(event) => setExternalLaunchAcknowledged(event.target.checked)}
                style={{ marginTop: 2 }}
              />
              <span>
                I confirm I launched this campaign outside NEXUS. Metrics and Brand Brain signals still require real reported metrics and review.
              </span>
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button
                onClick={() => {
                  setShowExternalLaunchConfirm(false)
                  setExternalLaunchAcknowledged(false)
                }}
                style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.28)', background: 'transparent', color: '#94a3b8', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleMarkLaunched}
                disabled={!externalLaunchAcknowledged}
                style={{
                  padding: '9px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: externalLaunchAcknowledged ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'rgba(34,197,94,0.22)',
                  color: '#fff',
                  fontWeight: 800,
                  cursor: externalLaunchAcknowledged ? 'pointer' : 'not-allowed',
                  opacity: externalLaunchAcknowledged ? 1 : 0.55,
                }}
              >
                Confirm I launched this outside NEXUS
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
