'use client'

/**
 * /paid-campaigns — Paid Advertising Command Center
 *
 * Shows all paid ad campaigns across platforms (Meta, Google, TikTok, LinkedIn).
 * Separate from organic campaigns (/campaigns) — these run through Ad Manager,
 * not as regular posts.
 *
 * Features:
 * - Platform-filtered view (All / Meta / Google / TikTok / LinkedIn)
 * - Campaign cards with live spend + CTR + ROAS
 * - Quick actions: New Campaign, Connect Ad Account
 * - Empty state with onboarding guide
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────
interface AdCampaign {
  id: string
  name: string
  platform: 'META' | 'GOOGLE' | 'TIKTOK' | 'LINKEDIN'
  status: 'DRAFT' | 'PENDING_REVIEW' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED' | 'REJECTED'
  objective: string
  dailyBudget: number | null
  lifetimeBudget: number | null
  currency: string
  startDate: string | null
  endDate: string | null
  totalSpend: number
  totalImpressions: number
  totalClicks: number
  avgCTR: number | null
  avgROAS: number | null
  createdAt: string
}

interface AdAccount {
  id: string
  platform: string
  platformAccountName: string | null
  status: string
  currency: string
}

// ── Platform icons + colors ────────────────────────────────────────────────
const PLATFORMS = {
  META:     { label: 'Meta',     color: '#1877F2', bg: 'rgba(24,119,242,0.1)' },
  GOOGLE:   { label: 'Google',   color: '#4285F4', bg: 'rgba(66,133,244,0.1)' },
  TIKTOK:   { label: 'TikTok',   color: '#FF0050', bg: 'rgba(255,0,80,0.1)'   },
  LINKEDIN: { label: 'LinkedIn', color: '#0A66C2', bg: 'rgba(10,102,194,0.1)' },
}

const STATUS_CONFIG = {
  DRAFT:          { label: 'Draft',          color: '#6B7280', bg: 'rgba(107,114,128,0.1)' },
  PENDING_REVIEW: { label: 'In Review',      color: '#F59E0B', bg: 'rgba(245,158,11,0.1)'  },
  ACTIVE:         { label: 'Active',         color: '#10B981', bg: 'rgba(16,185,129,0.1)'  },
  PAUSED:         { label: 'Paused',         color: '#F97316', bg: 'rgba(249,115,22,0.1)'  },
  COMPLETED:      { label: 'Completed',      color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)'  },
  ARCHIVED:       { label: 'Archived',       color: '#4B5563', bg: 'rgba(75,85,99,0.1)'    },
  REJECTED:       { label: 'Rejected',       color: '#EF4444', bg: 'rgba(239,68,68,0.1)'   },
}

// ── Platform icon SVGs ─────────────────────────────────────────────────────
function MetaIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

function TikTokIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#FF0050">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"/>
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#0A66C2">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  )
}

function PlatformIcon({ platform }: { platform: string }) {
  switch (platform) {
    case 'META': return <MetaIcon />
    case 'GOOGLE': return <GoogleIcon />
    case 'TIKTOK': return <TikTokIcon />
    case 'LINKEDIN': return <LinkedInIcon />
    default: return null
  }
}

// ── Campaign Card ──────────────────────────────────────────────────────────
function CampaignCard({ campaign }: { campaign: AdCampaign }) {
  const router = useRouter()
  const platform = PLATFORMS[campaign.platform] || { label: campaign.platform, color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)' }
  const statusCfg = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.DRAFT

  const budget = campaign.dailyBudget
    ? `${campaign.currency} ${campaign.dailyBudget}/day`
    : campaign.lifetimeBudget
    ? `${campaign.currency} ${campaign.lifetimeBudget} total`
    : 'No budget set'

  return (
    <div
      className="rounded-xl p-4 cursor-pointer transition-all duration-200 hover:shadow-md bg-white"
      style={{
        border: '1px solid rgba(15,23,42,0.08)',
      }}
      onClick={() => router.push(`/paid-campaigns/${campaign.id}`)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: platform.bg }}>
            <PlatformIcon platform={campaign.platform} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-slate-950 truncate leading-tight">{campaign.name}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{platform.label} · {campaign.objective.replace(/_/g, ' ')}</p>
          </div>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
          style={{ background: statusCfg.bg, color: statusCfg.color }}>
          {statusCfg.label}
        </span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {[
          { label: 'Spend', value: campaign.totalSpend > 0 ? `$${campaign.totalSpend.toFixed(0)}` : '—' },
          { label: 'Impressions', value: campaign.totalImpressions > 0 ? formatNum(campaign.totalImpressions) : '—' },
          { label: 'CTR', value: campaign.avgCTR != null ? `${campaign.avgCTR.toFixed(2)}%` : '—' },
          { label: 'ROAS', value: campaign.avgROAS != null ? `${campaign.avgROAS.toFixed(1)}x` : '—' },
        ].map(kpi => (
          <div key={kpi.label} className="text-center">
            <p className="text-[13px] font-bold text-slate-950">{kpi.value}</p>
            <p className="text-[10px] text-slate-500">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-500">{budget}</span>
        {campaign.status === 'DRAFT' && (
          <span className="text-[10px] text-indigo-600 font-medium">Ready to launch →</span>
        )}
      </div>
    </div>
  )
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

// ── Empty state ────────────────────────────────────────────────────────────
function EmptyState({ hasAccounts, onConnect }: { hasAccounts: boolean; onConnect: () => void }) {
  const router = useRouter()
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      {/* Animated icon */}
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
        style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)' }}>
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <rect x="3" y="8" width="30" height="20" rx="4" stroke="#F97316" strokeWidth="1.8"/>
          <path d="M11 18h5M17 14l5 4-5 4" stroke="#F97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M11 22h8" stroke="#F97316" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      </div>

      <h3 className="text-[18px] font-bold text-slate-950 mb-2">No paid campaigns yet</h3>
      <p className="text-slate-500 text-[13px] max-w-[360px] leading-relaxed mb-8">
        {hasAccounts
          ? 'Your ad account is connected. Create your first AI-powered campaign and launch it across Meta, Google, TikTok, or LinkedIn.'
          : 'Connect your ad account first, then build AI-powered campaigns that run through the real Ad Manager — not just social posts.'}
      </p>

      <div className="flex items-center gap-3">
        {!hasAccounts && (
          <button
            onClick={onConnect}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all"
            style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)', color: '#F97316' }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="3.5" cy="8" r="2"/><circle cx="12.5" cy="3.5" r="2"/><circle cx="12.5" cy="12.5" r="2"/>
              <path d="M5.5 8h3.5M10.5 5l-1.5 3M10.5 11l-1.5-3" strokeLinecap="round"/>
            </svg>
            Connect Ad Account
          </button>
        )}
        <button
          onClick={() => router.push('/paid-campaigns/new')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all"
          style={{ background: '#F97316' }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2">
            <path d="M8 2v12M2 8h12" strokeLinecap="round"/>
          </svg>
          Create Campaign
        </button>
      </div>

      {/* How it works */}
      <div className="mt-12 grid grid-cols-3 gap-6 max-w-[560px]">
        {[
          { step: '01', title: 'Connect', desc: 'Link your Meta, Google, TikTok, or LinkedIn ad account' },
          { step: '02', title: 'Build with AI', desc: 'AI generates audience, copy, budget plan using your Brand Brain' },
          { step: '03', title: 'Launch & Track', desc: 'Export to Ad Manager or launch directly via API' },
        ].map(item => (
          <div key={item.step} className="text-center">
            <div className="text-[11px] font-bold mb-1.5" style={{ color: '#F97316' }}>{item.step}</div>
            <p className="text-[12px] font-semibold text-slate-950 mb-1">{item.title}</p>
            <p className="text-[11px] text-slate-500 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function PaidCampaignsPage() {
  const { user } = useAuth()
  const { locale } = useI18n()
  const router = useRouter()

  const [campaigns, setCampaigns] = useState<AdCampaign[]>([])
  const [accounts, setAccounts] = useState<AdAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [platformFilter, setPlatformFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [connectingMeta, setConnectingMeta] = useState(false)

  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const session = await import('@/lib/supabaseClient')
        .then(m => m.supabase.auth.getSession())
      const token = session.data?.session?.access_token
      if (!token) {
        setLoading(false)
        return
      }

      const headers = { Authorization: `Bearer ${token}` }
      const [campaignsRes, accountsRes] = await Promise.all([
        fetch('/api/ad-campaigns', { headers }),
        fetch('/api/ad-accounts', { headers }),
      ])

      if (campaignsRes.ok) {
        const data = await campaignsRes.json()
        setCampaigns(data.campaigns || [])
      }
      if (accountsRes.ok) {
        const data = await accountsRes.json()
        setAccounts(data.accounts || [])
      }
    } catch (err) {
      console.error('[PaidCampaigns]', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchData() }, [fetchData])

  // Handle ?connected=meta query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('connected')) {
      window.history.replaceState({}, '', '/paid-campaigns')
      fetchData()
    }
  }, [fetchData])

  const handleConnectMeta = async () => {
    setConnectingMeta(true)
    try {
      const session = await import('@/lib/supabaseClient')
        .then(m => m.supabase.auth.getSession())
      const token = session.data?.session?.access_token
      if (!token) return
      const res = await fetch('/api/social/connect/meta-ads', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch { /* ignore */ } finally {
      setConnectingMeta(false)
    }
  }

  // Filter campaigns
  const filtered = campaigns.filter(c => {
    if (platformFilter !== 'ALL' && c.platform !== platformFilter) return false
    if (statusFilter !== 'ALL' && c.status !== statusFilter) return false
    return true
  })

  // KPI totals
  const totalSpend = campaigns.reduce((s, c) => s + c.totalSpend, 0)
  const totalImpressions = campaigns.reduce((s, c) => s + c.totalImpressions, 0)
  const activeCount = campaigns.filter(c => c.status === 'ACTIVE').length
  const avgROAS = campaigns.filter(c => c.avgROAS != null).reduce((s, c) => s + (c.avgROAS || 0), 0) /
    Math.max(campaigns.filter(c => c.avgROAS != null).length, 1) || null

  return (
    <AppShell>
      <div className="min-h-screen bg-[#f5f5f7]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

          {/* Page header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.1)' }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#F97316" strokeWidth="1.5">
                    <rect x="1" y="3" width="14" height="10" rx="2"/>
                    <path d="M5 8h2.5M8.5 6.5l2 1.5-2 1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h1 className="text-[20px] font-bold text-slate-950">
                  {locale === 'ar' ? 'الحملات المدفوعة' : 'Paid Campaigns'}
                </h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid rgba(249,115,22,0.2)' }}>
                  AI-POWERED
                </span>
              </div>
              <p className="text-slate-500 text-[13px]">
                {locale === 'ar'
                  ? 'إدارة حملاتك الإعلانية المدفوعة عبر جميع المنصات'
                  : 'Manage paid ad campaigns across Meta, Google, TikTok and LinkedIn'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {accounts.length > 0 && (
                <button
                  onClick={handleConnectMeta}
                  disabled={connectingMeta}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium text-slate-600 transition-all hover:bg-white"
                  style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.1)' }}
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="3.5" cy="8" r="2"/><circle cx="12.5" cy="3.5" r="2"/><circle cx="12.5" cy="12.5" r="2"/>
                    <path d="M5.5 8h3.5M10.5 5l-1.5 3M10.5 11l-1.5-3" strokeLinecap="round"/>
                  </svg>
                  {connectingMeta ? 'Connecting...' : 'Add Account'}
                </button>
              )}
              <Link
                href="/paid-campaigns/new"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-bold text-white transition-all"
                style={{ background: '#F97316' }}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2">
                  <path d="M8 2v12M2 8h12" strokeLinecap="round"/>
                </svg>
                {locale === 'ar' ? 'حملة جديدة' : 'New Campaign'}
              </Link>
            </div>
          </div>

          {/* KPI Bar */}
          {campaigns.length > 0 && (
            <div className="grid grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Active Campaigns', value: String(activeCount), icon: '📡', color: '#059669' },
                { label: 'Total Spend', value: totalSpend > 0 ? `$${totalSpend.toFixed(0)}` : '$0', icon: '💰', color: '#ea580c' },
                { label: 'Total Impressions', value: totalImpressions > 0 ? formatNum(totalImpressions) : '0', icon: '👁️', color: '#6366f1' },
                { label: 'Avg ROAS', value: avgROAS ? `${avgROAS.toFixed(1)}x` : '—', icon: '📈', color: '#0284c7' },
              ].map(kpi => (
                <div key={kpi.label} className="rounded-xl p-3.5 bg-white"
                  style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{kpi.icon}</span>
                    <span className="text-[11px] text-slate-500">{kpi.label}</span>
                  </div>
                  <p className="text-[22px] font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Connected accounts pill */}
          {accounts.length > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[11px] text-slate-500">Connected accounts:</span>
              {accounts.map(acc => (
                <span key={acc.id} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full"
                  style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <PlatformIcon platform={acc.platform} />
                  {acc.platformAccountName || acc.platform}
                </span>
              ))}
            </div>
          )}

          {/* Filters */}
          {campaigns.length > 0 && (
            <div className="flex items-center gap-2 mb-5 flex-wrap">
              {/* Platform filter */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-white"
                style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
                {['ALL', 'META', 'GOOGLE', 'TIKTOK', 'LINKEDIN'].map(p => (
                  <button
                    key={p}
                    onClick={() => setPlatformFilter(p)}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all"
                    style={{
                      background: platformFilter === p ? '#f1f5f9' : 'transparent',
                      color: platformFilter === p ? '#0f172a' : '#64748b',
                    }}
                  >
                    {p === 'ALL' ? 'All Platforms' : PLATFORMS[p as keyof typeof PLATFORMS]?.label || p}
                  </button>
                ))}
              </div>

              {/* Status filter */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-white"
                style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
                {['ALL', 'ACTIVE', 'DRAFT', 'PAUSED', 'COMPLETED'].map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all"
                    style={{
                      background: statusFilter === s ? '#f1f5f9' : 'transparent',
                      color: statusFilter === s ? '#0f172a' : '#64748b',
                    }}
                  >
                    {s === 'ALL' ? 'All Status' : STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]?.label || s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Campaign grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-xl h-40 animate-pulse bg-white"
                  style={{ border: '1px solid rgba(15,23,42,0.08)' }} />
              ))}
            </div>
          ) : campaigns.length === 0 ? (
            <EmptyState
              hasAccounts={accounts.length > 0}
              onConnect={handleConnectMeta}
            />
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-[14px]">
              No campaigns match the selected filters.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(campaign => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
