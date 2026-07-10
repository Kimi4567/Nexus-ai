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
import { useI18n } from '@/lib/i18n-context'
import { resolveStrategyScope } from '@/lib/strategy/strategyScope'
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
  aiOutput?: unknown
}

// ─── Constants ──────────────────────────────────────────────────────────────

const OBJECTIVES = [
  { value: 'TRAFFIC', labelEn: 'Traffic', labelAr: 'الزيارات', icon: '🔗', descEn: 'Website visits and link clicks', descAr: 'زيارات الموقع والنقرات على الروابط' },
  { value: 'CONVERSIONS', labelEn: 'Conversions', labelAr: 'التحويلات', icon: '💰', descEn: 'Purchases, sign-ups, and qualified leads', descAr: 'الشراء والتسجيل والعملاء المحتملون المؤهلون' },
  { value: 'AWARENESS', labelEn: 'Awareness', labelAr: 'الوعي بالعلامة', icon: '👁️', descEn: 'Reach and brand recognition', descAr: 'الوصول وتذكّر العلامة' },
  { value: 'LEADS', labelEn: 'Lead generation', labelAr: 'توليد العملاء المحتملين', icon: '📋', descEn: 'In-platform lead forms', descAr: 'نماذج العملاء المحتملين داخل المنصة' },
  { value: 'ENGAGEMENT', labelEn: 'Engagement', labelAr: 'التفاعل', icon: '❤️', descEn: 'Likes, shares, and video views', descAr: 'الإعجابات والمشاركات ومشاهدات الفيديو' },
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

// ─── Sub-components ──────────────────────────────────────────────────────────

function Section({ title, icon, children, defaultOpen = true }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 16, marginBottom: 16, boxShadow: '0 12px 35px rgba(15,23,42,0.04)', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', color: '#0f172a', gap: 12 }}
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

function CopyButton({ text, isArabic }: { text: string; isArabic: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(15,23,42,0.1)', background: copied ? 'rgba(34,197,94,0.1)' : '#f8fafc', color: copied ? '#16a34a' : '#64748b', fontSize: 11, cursor: 'pointer' }}
    >
      {copied ? <CheckCircle size={12} /> : <Copy size={12} />}
      {copied ? (isArabic ? 'تم النسخ' : 'Copied') : (isArabic ? 'نسخ' : 'Copy')}
    </button>
  )
}

function Tag({ children }: { children: string }) {
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, background: '#eef2ff', border: '1px solid rgba(99,102,241,0.2)', color: '#4f46e5', fontSize: 11, margin: '2px' }}>
      {children}
    </span>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function PaidLaunchPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { authHeader } = useAuth()
  const { locale } = useI18n()
  const isArabic = locale === 'ar'
  const copy = (ar: string, en: string) => isArabic ? ar : en

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
  const strategyScope = resolveStrategyScope(campaign?.aiOutput)
  const paidPlanningInScope = strategyScope.includesPaid

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
      setError(copy('تعذر تحميل بيانات التخطيط المدفوع.', 'Failed to load paid planning data.'))
    } finally {
      setLoading(false)
    }
  }, [id, authHeader])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Save setup then generate ──
  const handleGenerate = async () => {
    if (!paidPlanningInScope) {
      setError(copy('هذه الاستراتيجية عضوية فقط. أنشئ استراتيجية مدفوعة أو شاملة قبل توليد حزمة مدفوعة.', 'This strategy is organic-only. Create a Paid or Full strategy before generating a paid pack.'))
      return
    }
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
        headers: { Authorization: authHeader(), 'x-output-language': isArabic ? 'ar' : 'en' },
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? copy('تعذر إنشاء حزمة التخطيط.', 'Planning pack generation failed.'))
      } else {
        setPack(data.pack)
      }
    } catch {
      setError(copy('تعذر إنشاء حزمة التخطيط. حاول مرة أخرى.', 'Planning pack generation failed. Please try again.'))
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
      if (!res.ok) setError(data.error ?? copy('تعذر إنشاء مقترح إشارة من المقاييس.', 'Metrics signal proposal failed.'))
      else { await fetchData() }
    } catch { setError(copy('تعذر إنشاء مقترح إشارة من المقاييس.', 'Metrics signal proposal failed.')) }
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
  const statusLabels: Record<string, string> = {
    DRAFT: copy('مسودة تخطيط', 'Planning draft'),
    GENERATED: copy('حزمة تخطيط جاهزة للمراجعة', 'Planning pack ready for review'),
    LAUNCHED: copy('تم تسجيل إطلاق خارجي', 'External launch recorded'),
    COMPLETED: copy('تم تسجيل انتهاء الحملة الخارجية', 'External campaign ended'),
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AppShell>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#64748b', background: '#f6f8fc' }}>
          <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', marginRight: 8 }} />
          {copy('جارٍ تحميل موجز التخطيط المدفوع...', 'Loading paid planning brief...')}
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <main style={{ minHeight: '100vh', background: '#f6f8fc', color: '#0f172a' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 16px 48px', minWidth: 0, overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <button
            type="button"
            onClick={() => router.back()}
            aria-label={copy('العودة إلى الحملة', 'Back to campaign')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, marginBottom: 16 }}
          >
            <ArrowLeft size={14} /> {copy('العودة إلى الحملة', 'Back to campaign')}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <BookOpen size={22} color="#94a3b8" />
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>
                  {copy('موجز التخطيط المدفوع', 'Paid Planning Brief')}
                </h1>
                {pack?.status && (
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${STATUS_COLORS[pack.status]}20`, color: STATUS_COLORS[pack.status], border: `1px solid ${STATUS_COLORS[pack.status]}40` }}>
                    {statusLabels[pack.status] ?? pack.status}
                  </span>
                )}
              </div>
              <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>
                {campaign?.name ?? copy('الحملة', 'Campaign')} — {copy('موجز مدفوع للمراجعة فقط. لن يتم إطلاق إعلان أو إنفاق ميزانية دون موافقة صريحة.', 'a paid brief for review only. No ad will launch and no budget will be spent without explicit approval.')}
              </p>
              <button
                type="button"
                onClick={() => router.push('/paid-campaigns')}
                style={{ marginTop: 8, padding: 0, border: 'none', background: 'none', color: '#38bdf8', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                {copy('فتح مركز تخطيط الإعلانات المدفوعة', 'Open paid planning hub')}
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {hasGenerated && !isLaunched && !isCompleted && (
                <button
                  type="button"
                  onClick={() => setShowExternalLaunchConfirm(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                  <CheckCircle size={14} /> {copy('تسجيل إطلاق خارجي', 'Record external launch')}
                </button>
              )}
              {isLaunched && !isCompleted && (
                <button
                  type="button"
                  onClick={handleMarkCompleted}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#a78bfa,#7c3aed)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                  <BarChart3 size={14} /> {copy('انتهت الحملة الخارجية — أدخل المقاييس المبلّغ عنها', 'External campaign ended — enter reported metrics')}
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

        {campaign && !paidPlanningInScope && (
          <div style={{ marginBottom: 16, padding: '16px', borderRadius: 14, background: '#fff7ed', border: '1px solid rgba(249,115,22,0.24)', color: '#9a3412' }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>
              {copy('التخطيط المدفوع خارج نطاق هذه الاستراتيجية', 'Paid planning is outside this strategy scope')}
            </div>
            <p style={{ margin: 0, color: '#7c2d12', fontSize: 12, lineHeight: 1.6 }}>
              {copy('الحملة الحالية عضوية فقط. يمكنك مراجعة أي حزمة محفوظة، لكن إنشاء أو إعادة إنشاء حزمة مدفوعة يحتاج استراتيجية Paid أو Full أولاً.', 'The current campaign is organic-only. You may review any saved pack, but generating or regenerating a paid pack requires a Paid or Full strategy first.')}
            </p>
            <button
              type="button"
              onClick={() => router.push('/strategy')}
              style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, border: 'none', background: '#9a3412', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
            >
              {copy('إنشاء استراتيجية مدفوعة أو شاملة', 'Create a Paid or Full strategy')}
            </button>
          </div>
        )}

        {/* ═══ SETUP SECTION ═══ */}
        <Section title={copy('إعداد موجز التخطيط المدفوع', 'Paid Planning Setup')} icon={<Target size={16} color="#f59e0b" />}>
          <div style={{ display: 'grid', gap: 20 }}>

            {/* Objective */}
            <div>
              <label style={{ display: 'block', color: '#64748b', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{copy('هدف التخطيط', 'Planning objective')}</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 8, minWidth: 0 }}>
                {OBJECTIVES.map(obj => (
                  <button
                    type="button"
                    key={obj.value}
                    onClick={() => setObjective(obj.value)}
                    aria-pressed={objective === obj.value}
                    disabled={!paidPlanningInScope}
                    style={{
                      padding: '12px', borderRadius: 10, cursor: 'pointer', textAlign: isArabic ? 'right' : 'left', minWidth: 0, overflowWrap: 'anywhere',
                      background: objective === obj.value ? '#fff7ed' : '#f8fafc',
                      border: objective === obj.value ? '1.5px solid rgba(245,158,11,0.55)' : '1px solid rgba(15,23,42,0.08)',
                      color: '#0f172a',
                    }}
                  >
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{obj.icon}</div>
                    <div style={{ fontWeight: 700, fontSize: 12 }}>{isArabic ? obj.labelAr : obj.labelEn}</div>
                    <div style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>{isArabic ? obj.descAr : obj.descEn}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Platforms */}
            <div>
              <label style={{ display: 'block', color: '#64748b', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{copy('المنصات المخططة', 'Planned platforms')}</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {PLATFORMS.map(p => (
                  <button
                    type="button"
                    key={p.value}
                    onClick={() => togglePlatform(p.value)}
                    aria-pressed={platforms.includes(p.value)}
                    disabled={!paidPlanningInScope}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
                      background: platforms.includes(p.value) ? p.bg : '#f8fafc',
                      border: platforms.includes(p.value) ? `1.5px solid ${p.color}60` : '1px solid rgba(15,23,42,0.08)',
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))', gap: 12, minWidth: 0 }}>
              <div>
                <label style={{ display: 'block', color: '#64748b', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{copy('افتراض الميزانية اليومية', 'Daily budget assumption')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <select
                    disabled={!paidPlanningInScope}
                    value={currency}
                    onChange={e => setCurrency(e.target.value)}
                    style={{ padding: '8px', borderRadius: 8, background: '#fff', border: '1px solid rgba(15,23,42,0.12)', color: '#0f172a', fontSize: 12, flexShrink: 0 }}
                  >
                    <option value="USD">USD</option>
                    <option value="EGP">EGP</option>
                    <option value="SAR">SAR</option>
                    <option value="AED">AED</option>
                  </select>
                  <input
                    type="number" min={1} value={dailyBudget}
                    disabled={!paidPlanningInScope}
                    onChange={e => setDailyBudget(parseFloat(e.target.value) || 0)}
                    style={{ flex: 1, minWidth: 0, width: '100%', padding: '8px 12px', borderRadius: 8, background: '#fff', border: '1px solid rgba(15,23,42,0.12)', color: '#0f172a', fontSize: 14, fontWeight: 700 }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', color: '#64748b', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{copy('المدة التخطيطية (أيام)', 'Planning duration (days)')}</label>
                <input
                  type="number" min={1} max={90} value={durationDays}
                  disabled={!paidPlanningInScope}
                  onChange={e => setDurationDays(parseInt(e.target.value) || 7)}
                  style={{ width: '100%', minWidth: 0, padding: '8px 12px', borderRadius: 8, background: '#fff', border: '1px solid rgba(15,23,42,0.12)', color: '#0f172a', fontSize: 14, fontWeight: 700 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', color: '#64748b', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{copy('إجمالي افتراض الميزانية', 'Total budget assumption')}</label>
                <div style={{ padding: '8px 12px', borderRadius: 6, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbf24', fontSize: 16, fontWeight: 800 }}>
                  {currency} {totalBudget.toLocaleString()}
                </div>
              </div>
            </div>
            <p style={{ margin: '-6px 0 0', color: '#64748b', fontSize: 11, lineHeight: 1.5 }}>
              {copy('قيم الميزانية افتراضات للمراجعة وليست إنفاقاً معتمداً. لا يطلق NEXUS إعلاناً ولا يتحكم في الإنفاق من هذه الصفحة.', 'Budget values are planning assumptions for review, not approved spend. NEXUS does not launch ads or control spend from this page.')}
            </p>

            {/* Generate button — gated by a credit-confirmation modal */}
            <button
              type="button"
              onClick={() => setShowGenerateConfirm(true)}
              disabled={generating || platforms.length === 0 || !paidPlanningInScope}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '13px 24px', borderRadius: 10, border: 'none', cursor: generating ? 'wait' : 'pointer',
                background: generating ? 'rgba(245,158,11,0.2)' : 'linear-gradient(135deg,#f59e0b,#d97706)',
                color: '#fff', fontWeight: 800, fontSize: 14,
                opacity: platforms.length === 0 || !paidPlanningInScope ? 0.5 : 1,
              }}
            >
              {generating ? (
                <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> {copy('جارٍ إنشاء حزمة التخطيط...', 'Generating paid planning pack...')}</>
              ) : (
                <><Zap size={16} /> {hasGenerated ? copy('إعادة إنشاء حزمة التخطيط', 'Regenerate paid planning pack') : copy('إنشاء حزمة التخطيط المدفوع', 'Generate paid planning pack')} — {PAID_PACK_COST} {copy('أرصدة', 'credits')}</>
              )}
            </button>
          </div>
        </Section>

        {/* ═══ GENERATED CONTENT ═══ */}
        {hasGenerated && pack && (
          <>
            {/* Estimated Reach */}
            {pack.estimatedReach && (
              <Section title={copy('تقدير الوصول التخطيطي', 'Planning Reach Estimate')} icon={<TrendingUp size={16} color="#2563eb" />}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                  {Object.entries(pack.estimatedReach as Record<string, { impressionsMin?: number; impressionsMax?: number; cpmMin?: number; cpmMax?: number }>).map(([p, r]) => {
                    const plat = PLATFORMS.find(x => x.value === p)
                    const impMin = r?.impressionsMin ?? 0
                    const impMax = r?.impressionsMax ?? 0
                    const cpmMin = r?.cpmMin ?? 0
                    const cpmMax = r?.cpmMax ?? 0
                    return (
                      <div key={p} style={{ padding: '14px', borderRadius: 10, background: `${plat?.bg ?? '#f8fafc'}`, border: `1px solid ${plat?.color ?? '#334155'}30` }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: plat?.color ?? '#94a3b8', marginBottom: 8 }}>
                          {plat?.icon} {plat?.label ?? p}
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>
                          {(impMin / 1000).toFixed(0)}K – {(impMax / 1000).toFixed(0)}K
                        </div>
                        <div style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>
                          {copy('مرات ظهور تخطيطية', 'planning impressions')} · {copy('افتراض CPM', 'CPM assumption')} ${cpmMin}–${cpmMax}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {pack.budgetInsights && (
                  <div style={{ marginTop: 16, padding: '14px', borderRadius: 10, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                    <div style={{ color: '#c2410c', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>💡 {copy('ملاحظات تخطيط الميزانية', 'Budget Planning Notes')}</div>
                    <p style={{ margin: '0 0 8px', color: '#334155', fontSize: 13, lineHeight: 1.6 }}>{pack.budgetInsights.recommendation}</p>
                    <p style={{ margin: '0 0 6px', color: '#64748b', fontSize: 12 }}><strong style={{ color: '#0f172a' }}>{copy('مراحل الميزانية:', 'Phasing:')}</strong> {pack.budgetInsights.phasingSuggestion}</p>
                    <p style={{ margin: 0, color: '#64748b', fontSize: 12 }}><strong style={{ color: '#0f172a' }}>{copy('افتراض تخطيطي:', 'Planning assumption:')}</strong> {pack.budgetInsights.expectedResults}</p>
                  </div>
                )}
              </Section>
            )}

            {/* Audience Brief */}
            {pack.audienceBrief && (
              <Section title={copy('موجز الجمهور المقترح بالذكاء الاصطناعي', 'AI Audience Brief')} icon={<Users size={16} color="#7c3aed" />}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                  {(pack.platforms ?? []).map(p => (
                    <button
                      type="button"
                      key={p}
                      onClick={() => setExpandedPlatform(p)}
                      style={{
                        padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        background: expandedPlatform === p ? PLATFORMS.find(x => x.value === p)?.bg ?? 'rgba(99,102,241,0.1)' : '#f8fafc',
                        border: expandedPlatform === p ? `1.5px solid ${PLATFORMS.find(x => x.value === p)?.color ?? '#6366f1'}60` : '1px solid rgba(15,23,42,0.08)',
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
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
                        <div style={{ padding: 12, borderRadius: 8, background: '#f8fafc', border: '1px solid rgba(15,23,42,0.06)' }}>
                          <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>{copy('العمر · الجنس · الموقع', 'AGE · GENDER · LOCATION')}</div>
                          <div style={{ color: '#0f172a', fontSize: 13 }}>{m.ageMin}–{m.ageMax} {copy('سنة', 'years')} · {(m.genders ?? []).join(', ')}</div>
                          <div style={{ marginTop: 4 }}>{(m.locations ?? []).map(l => <Tag key={l}>{l}</Tag>)}</div>
                        </div>
                        <div style={{ padding: 12, borderRadius: 8, background: '#f8fafc', border: '1px solid rgba(15,23,42,0.06)' }}>
                          <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>{copy('مواضع الظهور · استراتيجية المزايدة', 'PLACEMENTS · BID STRATEGY')}</div>
                          <div style={{ color: '#0f172a', fontSize: 12 }}>{m.placementRecommendation}</div>
                          <div style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>{m.bidStrategy} · {copy('حجم الجمهور:', 'Audience:')} {m.estimatedAudienceSize}</div>
                        </div>
                      </div>
                      <div style={{ padding: 12, borderRadius: 8, background: '#f8fafc', border: '1px solid rgba(15,23,42,0.06)' }}>
                        <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>{copy('الاهتمامات', 'INTERESTS')}</div>
                        <div>{(m.interests ?? []).map(i => <Tag key={i}>{i}</Tag>)}</div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
                        <div style={{ padding: 12, borderRadius: 8, background: '#f8fafc', border: '1px solid rgba(15,23,42,0.06)' }}>
                          <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>{copy('السلوكيات', 'BEHAVIORS')}</div>
                          <div>{(m.behaviors ?? []).map(b => <Tag key={b}>{b}</Tag>)}</div>
                        </div>
                        <div style={{ padding: 12, borderRadius: 8, background: '#f8fafc', border: '1px solid rgba(15,23,42,0.06)' }}>
                          <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>{copy('الاستبعادات', 'EXCLUSIONS')}</div>
                          <div>{(m.exclusions ?? []).map(e => <Tag key={e}>{e}</Tag>)}</div>
                        </div>
                      </div>
                      {(m.customAudienceSuggestions ?? []).length > 0 && (
                        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
                          <div style={{ color: '#7c3aed', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>💡 {copy('أفكار جمهور مخصص', 'CUSTOM AUDIENCE IDEAS')}</div>
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
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
                        <div style={{ padding: 12, borderRadius: 8, background: '#f8fafc', border: '1px solid rgba(15,23,42,0.06)' }}>
                          <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>{copy('نوع الحملة · المزايدة', 'CAMPAIGN TYPE · BID')}</div>
                          <div style={{ color: '#0f172a', fontSize: 13 }}>{g.campaignType}</div>
                          <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>{g.bidStrategy} · {g.matchTypes}</div>
                        </div>
                        <div style={{ padding: 12, borderRadius: 8, background: '#f8fafc', border: '1px solid rgba(15,23,42,0.06)' }}>
                          <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>{copy('المواقع', 'LOCATIONS')}</div>
                          <div>{(g.locations ?? []).map(l => <Tag key={l}>{l}</Tag>)}</div>
                        </div>
                      </div>
                      <div style={{ padding: 12, borderRadius: 8, background: '#f8fafc', border: '1px solid rgba(15,23,42,0.06)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700 }}>{copy('الكلمات المفتاحية', 'KEYWORDS')} ({keywords.length})</div>
                          <CopyButton text={keywords.join('\n')} isArabic={isArabic} />
                        </div>
                        <div>{keywords.map(k => <Tag key={k}>{k}</Tag>)}</div>
                      </div>
                      <div style={{ padding: 12, borderRadius: 8, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
                        <div style={{ color: '#dc2626', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>{copy('الكلمات المفتاحية المستبعدة', 'NEGATIVE KEYWORDS')}</div>
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
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
                        <div style={{ padding: 12, borderRadius: 8, background: '#f8fafc', border: '1px solid rgba(15,23,42,0.06)' }}>
                          <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>{copy('الخصائص الديموغرافية', 'DEMOGRAPHICS')}</div>
                          <div style={{ color: '#0f172a', fontSize: 13 }}>{t.ageMin}–{t.ageMax} · {(t.genders ?? []).join(', ')}</div>
                          <div>{(t.locations ?? []).map(l => <Tag key={l}>{l}</Tag>)}</div>
                        </div>
                        <div style={{ padding: 12, borderRadius: 8, background: '#f8fafc', border: '1px solid rgba(15,23,42,0.06)' }}>
                          <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>{copy('الصيغة · صانع المحتوى', 'FORMAT · CREATOR')}</div>
                          <div style={{ color: '#e879f9', fontSize: 12, marginBottom: 4 }}>{t.videoFormat}</div>
                          <div style={{ color: '#94a3b8', fontSize: 11 }}>{t.creatorSuggestion}</div>
                        </div>
                      </div>
                      <div style={{ padding: 12, borderRadius: 8, background: '#f8fafc', border: '1px solid rgba(15,23,42,0.06)' }}>
                        <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>{copy('الاهتمامات', 'INTERESTS')}</div>
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
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
                        <div style={{ padding: 12, borderRadius: 8, background: '#f8fafc', border: '1px solid rgba(15,23,42,0.06)' }}>
                          <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>{copy('المسميات الوظيفية', 'JOB TITLES')}</div>
                          <div>{(l.jobTitles ?? []).map(t => <Tag key={t}>{t}</Tag>)}</div>
                        </div>
                        <div style={{ padding: 12, borderRadius: 8, background: '#f8fafc', border: '1px solid rgba(15,23,42,0.06)' }}>
                          <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>{copy('المستوى الوظيفي', 'SENIORITY')}</div>
                          <div>{(l.seniority ?? []).map(s => <Tag key={s}>{s}</Tag>)}</div>
                        </div>
                      </div>
                      <div style={{ padding: 12, borderRadius: 8, background: '#f8fafc', border: '1px solid rgba(15,23,42,0.06)' }}>
                        <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>{copy('الصيغة:', 'FORMAT:')} {l.adFormat} · {copy('القطاعات', 'INDUSTRIES')}</div>
                        <div>{(l.industries ?? []).map(i => <Tag key={i}>{i}</Tag>)}</div>
                      </div>
                    </div>
                  )
                })()}
              </Section>
            )}

            {/* Copy Variants */}
            {pack.copyVariants && pack.copyVariants.length > 0 && (
              <Section title={copy('مسودات النصوص الإعلانية', 'Ad Copy Drafts')} icon={<Copy size={16} color="#16a34a" />}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                  {pack.copyVariants.map(v => (
                    <button
                      type="button"
                      key={v.id}
                      onClick={() => setSelectedVariant(v.id)}
                      style={{
                        padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        background: selectedVariant === v.id ? 'rgba(74,222,128,0.1)' : '#f8fafc',
                        border: selectedVariant === v.id ? '1.5px solid rgba(74,222,128,0.4)' : '1px solid rgba(15,23,42,0.08)',
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
                      <div style={{ padding: 16, borderRadius: 10, background: '#f8fafc', border: '1px solid rgba(15,23,42,0.08)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700 }}>{copy('النص الرئيسي / التعليق', 'Primary text / caption')}</div>
                          <CopyButton text={v.primaryText} isArabic={isArabic} />
                        </div>
                        <pre style={{ margin: 0, color: '#0f172a', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{v.primaryText}</pre>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
                        <div style={{ padding: 14, borderRadius: 10, background: '#f8fafc', border: '1px solid rgba(15,23,42,0.08)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700 }}>{copy('العنوان', 'HEADLINE')}</div>
                            <CopyButton text={v.headline} isArabic={isArabic} />
                          </div>
                          <div style={{ color: '#0f172a', fontSize: 14, fontWeight: 700 }}>{v.headline}</div>
                        </div>
                        <div style={{ padding: 14, borderRadius: 10, background: '#f8fafc', border: '1px solid rgba(15,23,42,0.08)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700 }}>{copy('الوصف', 'DESCRIPTION')}</div>
                            <CopyButton text={v.description} isArabic={isArabic} />
                          </div>
                          <div style={{ color: '#334155', fontSize: 12 }}>{v.description}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(34,197,94,0.1)', color: '#15803d', fontSize: 11, fontWeight: 700 }}>{copy('الدعوة للإجراء:', 'CTA:')} {v.cta}</span>
                        <span style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(99,102,241,0.1)', color: '#4f46e5', fontSize: 11 }}>{copy('الزاوية:', 'Angle:')} {v.angle}</span>
                        <span style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(245,158,11,0.1)', color: '#c2410c', fontSize: 11 }}>{copy('المنصة:', 'Platform:')} {v.platform}</span>
                      </div>
                    </div>
                  )
                })()}
              </Section>
            )}

            {/* UTM Parameters */}
            {pack.utmParams && (
              <Section title={copy('معلمات تتبع UTM', 'UTM Tracking Parameters')} icon={<Link2 size={16} color="#2563eb" />} defaultOpen={false}>
                <p style={{ color: '#64748b', fontSize: 12, margin: '0 0 14px' }}>
                  {copy('أضف هذه المعلمات إلى رابط الوجهة داخل منصة الإعلان لتتبع الأداء في Google Analytics.', 'Add these parameters to the destination URL in the ad platform to track performance in Google Analytics.')}
                </p>
                <div style={{ display: 'grid', gap: 10 }}>
                  {Object.entries(pack.utmParams.examples ?? {}).map(([p, utm]) => {
                    const plat = PLATFORMS.find(x => x.value === p)
                    return (
                      <div key={p} style={{ padding: 12, borderRadius: 8, background: '#f8fafc', border: '1px solid rgba(15,23,42,0.06)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ color: plat?.color ?? '#94a3b8', fontSize: 12, fontWeight: 700 }}>{plat?.icon} {plat?.label ?? p}</span>
                          <CopyButton text={utm} isArabic={isArabic} />
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
              <Section title={copy('دليل الإعداد خطوة بخطوة', 'Step-by-Step Setup Guides')} icon={<BookOpen size={16} color="#db2777" />} defaultOpen={false}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                  {(pack.platforms ?? []).map(p => (
                    <button
                      type="button"
                      key={p}
                      onClick={() => setExpandedPlatform(p)}
                      style={{
                        padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        background: expandedPlatform === p ? PLATFORMS.find(x => x.value === p)?.bg ?? '#f8fafc' : '#f8fafc',
                        border: expandedPlatform === p ? `1.5px solid ${PLATFORMS.find(x => x.value === p)?.color ?? '#6366f1'}60` : '1px solid rgba(15,23,42,0.08)',
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
                      <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 14px', borderRadius: 8, background: '#f8fafc', border: '1px solid rgba(15,23,42,0.06)' }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: PLATFORMS.find(x => x.value === expandedPlatform)?.bg ?? 'rgba(99,102,241,0.1)', border: `1px solid ${PLATFORMS.find(x => x.value === expandedPlatform)?.color ?? '#6366f1'}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: PLATFORMS.find(x => x.value === expandedPlatform)?.color ?? '#a5b4fc', flexShrink: 0 }}>
                          {i + 1}
                        </div>
                        <div style={{ color: '#334155', fontSize: 13, lineHeight: 1.5 }}>{step}</div>
                      </div>
                    ))}
                    <a
                      href={PLATFORM_LINKS[expandedPlatform]}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 20px', borderRadius: 8, border: 'none', background: PLATFORMS.find(x => x.value === expandedPlatform)?.bg ?? 'rgba(99,102,241,0.1)', color: PLATFORMS.find(x => x.value === expandedPlatform)?.color ?? '#a5b4fc', fontWeight: 700, fontSize: 13, textDecoration: 'none', marginTop: 8 }}
                    >
                      <ExternalLink size={14} /> {copy('فتح مدير إعلانات', 'Open')} {PLATFORMS.find(x => x.value === expandedPlatform)?.label ?? expandedPlatform}
                    </a>
                  </div>
                )}
              </Section>
            )}

            {/* Metrics Entry */}
            {(isLaunched || isCompleted || showMetricsForm) && (
              <Section title={copy('مقاييس الحملة المبلّغ عنها', 'Reported Campaign Metrics')} icon={<BarChart3 size={16} color="#16a34a" />}>
                {pack.metrics && !showMetricsForm ? (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
                      {[
                        { key: 'impressions', label: copy('مرات الظهور', 'Impressions'), fmt: (v: number) => v.toLocaleString() },
                        { key: 'reach',       label: copy('الوصول', 'Reach'), fmt: (v: number) => v.toLocaleString() },
                        { key: 'clicks',      label: copy('النقرات', 'Clicks'), fmt: (v: number) => v.toLocaleString() },
                        { key: 'spend',       label: copy('الإنفاق المبلّغ عنه', 'Reported spend'), fmt: (v: number) => `$${v.toFixed(2)}` },
                        { key: 'conversions', label: copy('التحويلات', 'Conversions'), fmt: (v: number) => v.toLocaleString() },
                        { key: 'roas',        label: 'ROAS',         fmt: (v: number) => `${v.toFixed(2)}x` },
                      ].map(m => {
                        const val = (pack.metrics as Record<string, number>)?.[m.key]
                        if (val === null || val === undefined || Number.isNaN(val)) return null
                        return (
                          <div key={m.key} style={{ padding: 12, borderRadius: 8, background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.15)', textAlign: 'center' }}>
                            <div style={{ color: '#64748b', fontSize: 10, marginBottom: 4 }}>{m.label}</div>
                            <div style={{ color: '#4ade80', fontSize: 18, fontWeight: 800 }}>{m.fmt(val)}</div>
                          </div>
                        )
                      })}
                    </div>
                    <button type="button" onClick={() => setShowMetricsForm(true)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid rgba(15,23,42,0.1)', background: '#f8fafc', color: '#64748b', fontSize: 12, cursor: 'pointer' }}>
                      {copy('تعديل المقاييس المبلّغ عنها', 'Edit reported metrics')}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 12 }}>
                    <p style={{ margin: '0 0 8px', color: '#64748b', fontSize: 12 }}>
                      {copy('أدخل النتائج من لوحة تقارير منصة الإعلان. ستُحفظ كسجل يدوي وليست دليلاً على تعلّم مدعوم بالتحليلات.', "Enter results from the ad platform's reporting dashboard. They are saved as a manual record, not analytics-backed learning.")}
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                      {[
                        { key: 'impressions', label: copy('مرات الظهور', 'Impressions'), placeholder: '50000' },
                        { key: 'reach',       label: copy('الوصول', 'Reach'), placeholder: '30000' },
                        { key: 'clicks',      label: copy('النقرات', 'Clicks'), placeholder: '1200' },
                        { key: 'spend',       label: copy('الإنفاق المبلّغ عنه ($)', 'Reported spend ($)'), placeholder: '140.00' },
                        { key: 'conversions', label: copy('التحويلات', 'Conversions'), placeholder: '24' },
                        { key: 'roas',        label: 'ROAS',        placeholder: '3.2' },
                      ].map(f => (
                        <div key={f.key}>
                          <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>{f.label}</label>
                          <input
                            type="number"
                            placeholder={f.placeholder}
                            value={metricsForm[f.key as keyof typeof metricsForm]}
                            onChange={e => setMetricsForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, background: '#f8fafc', border: '1px solid rgba(15,23,42,0.1)', color: '#0f172a', fontSize: 13 }}
                          />
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={handleSaveMetrics}
                        disabled={savingMetrics}
                        style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                      >
                        {savingMetrics ? copy('جارٍ الحفظ...', 'Saving...') : copy('حفظ المقاييس المبلّغ عنها', 'Save reported metrics')}
                      </button>
                      <button type="button" onClick={() => setShowMetricsForm(false)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.1)', background: 'none', color: '#64748b', fontSize: 12, cursor: 'pointer' }}>
                        {copy('إلغاء', 'Cancel')}
                      </button>
                    </div>
                  </div>
                )}
              </Section>
            )}

            {/* Brand Brain paid metrics signals */}
            {(pack.metrics || isCompleted) && (
              <Section title={copy('مقترحات إشارات من المقاييس المدفوعة', 'Paid Metrics Signal Proposals')} icon={<Brain size={16} color="#7c3aed" />}>
                {pack.learnings ? (
                  <div style={{ display: 'grid', gap: 12 }}>
                    {pack.brandBrainUpdated && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)', color: '#c4b5fd', fontSize: 13 }}>
                        <CheckCircle size={14} /> {copy('حُفظ مقترح إشارة لمراجعة Brand Brain؛ لم يُسجل كتعلّم أداء.', 'Metrics signal proposal saved for Brand Brain review; it is not recorded as performance learning.')}
                      </div>
                    )}
                    <div style={{ padding: 14, borderRadius: 10, background: '#f8fafc', border: '1px solid rgba(15,23,42,0.08)' }}>
                      <div style={{ color: '#7c3aed', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{copy('الملخص التنفيذي', 'EXECUTIVE SUMMARY')}</div>
                      <p style={{ margin: 0, color: '#334155', fontSize: 13, lineHeight: 1.6 }}>
                        {(pack.learnings as Record<string, unknown>)?.executiveSummary as string}
                      </p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
                      {!!(pack.learnings as Record<string, unknown>)?.keyInsight && (
                        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                          <div style={{ color: '#c2410c', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>{copy('الملاحظة الرئيسية', 'KEY INSIGHT')}</div>
                          <p style={{ margin: 0, color: '#fde68a', fontSize: 12, lineHeight: 1.5 }}>
                            {(pack.learnings as Record<string, unknown>)?.keyInsight as string}
                          </p>
                        </div>
                      )}
                      {!!(pack.learnings as Record<string, unknown>)?.nextCampaignRecommendation && (
                        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
                          <div style={{ color: '#15803d', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>{copy('الحملة التالية', 'NEXT CAMPAIGN')}</div>
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
                      {copy('أدخل المقاييس المبلّغ عنها أعلاه، ثم أنشئ مقترح إشارة لمراجعة Brand Brain. لا يصبح تعلّماً مدعوماً بالأداء دون تحليلات موثوقة.', 'Enter reported metrics above, then create a signal proposal for Brand Brain review. It does not become analytics-backed learning without trusted analytics.')}
                    </p>
                    <button
                      type="button"
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
                        <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> {copy('جارٍ إعداد المقترح...', 'Preparing proposal...')}</>
                      ) : (
                        <><Brain size={14} /> {copy('إنشاء مقترح إشارة من المقاييس', 'Create metrics signal proposal')} — 2 {copy('رصيد', 'credits')}</>
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
      </main>

      <CreditConfirmModal
        isOpen={showGenerateConfirm}
        onClose={() => setShowGenerateConfirm(false)}
        onConfirm={handleGenerate}
        cost={PAID_PACK_COST}
        actionTitle={copy('إنشاء حزمة التخطيط المدفوع', 'Generate paid planning pack')}
        authHeader={authHeader}
        includedItems={isArabic
          ? ['موجز الجمهور', 'مسودات النصوص الإعلانية', 'خطة الميزانية الافتراضية', 'إرشادات إعداد المنصات']
          : ['Audience brief', 'Ad copy drafts', 'Budget assumption plan', 'Platform setup guidance']}
        confirmLabel={copy(`تأكيد الإنشاء — ${PAID_PACK_COST} أرصدة`, `Confirm generation — ${PAID_PACK_COST} credits`)}
      />
      {showExternalLaunchConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={copy('تأكيد تسجيل إطلاق مدفوع خارجي', 'Confirm external paid launch record')}
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
          <div style={{ width: '100%', maxWidth: 460, borderRadius: 16, background: '#ffffff', border: '1px solid rgba(15,23,42,0.1)', padding: 20, boxShadow: '0 24px 80px rgba(15,23,42,0.2)' }}>
            <h2 style={{ margin: '0 0 8px', color: '#0f172a', fontSize: 18, fontWeight: 800 }}>
              {copy('تسجيل إطلاق خارجي', 'Record external launch')}
            </h2>
            <p style={{ margin: '0 0 14px', color: '#64748b', fontSize: 13, lineHeight: 1.6 }}>
              {copy('لم يطلق NEXUS هذه الحملة ولم ينشر إعلانات أو يتحكم في الإنفاق. هذا الإجراء يسجل فقط أنك أطلقت الحملة خارج NEXUS بعد مراجعتك للميزانية والتتبع والإبداع والمنصة.', 'NEXUS did not launch this campaign, publish ads, or control spend. This only records that you launched it outside NEXUS after reviewing budget, tracking, creative, and platform readiness.')}
            </p>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: '#334155', fontSize: 13, lineHeight: 1.5, padding: 12, borderRadius: 10, background: '#f8fafc', border: '1px solid rgba(15,23,42,0.08)' }}>
              <input
                type="checkbox"
                checked={externalLaunchAcknowledged}
                onChange={(event) => setExternalLaunchAcknowledged(event.target.checked)}
                style={{ marginTop: 2 }}
              />
              <span>
                {copy('أؤكد أنني أطلقت هذه الحملة خارج NEXUS. تظل المقاييس وإشارات Brand Brain بحاجة إلى بيانات حقيقية ومراجعة.', 'I confirm that I launched this campaign outside NEXUS. Metrics and Brand Brain signals still require real data and review.')}
              </span>
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button
                type="button"
                onClick={() => {
                  setShowExternalLaunchConfirm(false)
                  setExternalLaunchAcknowledged(false)
                }}
                style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(15,23,42,0.14)', background: 'transparent', color: '#64748b', fontWeight: 700, cursor: 'pointer' }}
              >
                {copy('إلغاء', 'Cancel')}
              </button>
              <button
                type="button"
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
                {copy('تأكيد أنني أطلقتها خارج NEXUS', 'Confirm external launch record')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
