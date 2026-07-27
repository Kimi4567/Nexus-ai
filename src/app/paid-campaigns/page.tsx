'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronRight,
  Filter,
  Megaphone,
  Plus,
  Search,
  ShieldCheck,
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import type { PaidStrategySourceTruth } from '@/lib/paidStrategySource'
import WorkspaceRouteLoading from '@/components/WorkspaceRouteLoading'

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
  organicCampaignId: string | null
  sourceStrategy: { id: string; name: string; status: string; updatedAt: string } | null
  strategySnapshot: { id: string; version: number; scope: string; payloadHash: string; createdAt: string } | null
  budgetApprovalSnapshot: { id: string; version: number; scope: string; payloadHash: string; createdAt: string } | null
  launchApprovalSnapshot: { id: string; version: number; scope: string; payloadHash: string; createdAt: string } | null
  sourceRevision: { state: 'current' | 'stale' | 'missing'; latestSnapshotId: string | null; latestVersion: number | null }
}

interface AdAccount {
  id: string
  platform: string
  platformAccountName: string | null
  status: string
  currency: string
}

const PLATFORMS = {
  META: { label: 'Meta Ads', mark: '∞', color: '#315efb', tint: 'bg-blue-50 text-blue-700' },
  GOOGLE: { label: 'Google Ads', mark: 'G', color: '#1a73e8', tint: 'bg-sky-50 text-sky-700' },
  TIKTOK: { label: 'TikTok Ads', mark: '♪', color: '#111827', tint: 'bg-slate-100 text-slate-900' },
  LINKEDIN: { label: 'LinkedIn Ads', mark: 'in', color: '#0a66c2', tint: 'bg-blue-50 text-blue-700' },
} as const

const STATUS_COPY = {
  DRAFT: { ar: 'مسودة تنفيذ', en: 'Execution draft', tone: 'bg-slate-100 text-slate-700' },
  PENDING_REVIEW: { ar: 'قيد المراجعة', en: 'Setup review', tone: 'bg-amber-50 text-amber-700' },
  ACTIVE: { ar: 'سجل نشط على المنصة', en: 'Platform active record', tone: 'bg-emerald-50 text-emerald-700' },
  PAUSED: { ar: 'مسودة منصة متوقفة', en: 'Paused platform draft', tone: 'bg-orange-50 text-orange-700' },
  COMPLETED: { ar: 'مكتملة', en: 'Completed', tone: 'bg-violet-50 text-violet-700' },
  ARCHIVED: { ar: 'مؤرشفة', en: 'Archived', tone: 'bg-slate-100 text-slate-600' },
  REJECTED: { ar: 'مرفوضة', en: 'Rejected', tone: 'bg-rose-50 text-rose-700' },
} as const

function PlatformBadge({ platform }: { platform: keyof typeof PLATFORMS }) {
  const config = PLATFORMS[platform]
  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-[13px] bg-white text-[13px] font-black shadow-sm ring-1 ring-[#e3e8f3]" style={{ color: config.color }}>
      {config.mark}
    </span>
  )
}

function CampaignRow({ campaign, locale }: { campaign: AdCampaign; locale: string }) {
  const platform = PLATFORMS[campaign.platform]
  const status = STATUS_COPY[campaign.status] || STATUS_COPY.DRAFT
  const budget = campaign.dailyBudget
    ? `${campaign.currency} ${campaign.dailyBudget} / ${locale === 'ar' ? 'يوم' : 'day'}`
    : campaign.lifetimeBudget
      ? `${campaign.currency} ${campaign.lifetimeBudget} ${locale === 'ar' ? 'إجمالي' : 'total'}`
      : locale === 'ar'
        ? 'لا توجد قيمة ميزانية مؤكدة'
        : 'No confirmed budget value'
  const pinnedSource = Boolean(
    campaign.sourceStrategy
    && campaign.strategySnapshot?.scope === 'STRATEGY_APPROVAL'
    && campaign.sourceRevision.state === 'current',
  )

  return (
    <Link
      href={`/paid-campaigns/${campaign.id}`}
      className="grid gap-4 rounded-[18px] border border-[#edf1f8] bg-white px-4 py-3 text-start transition hover:border-[#cfd8ee] hover:shadow-[0_18px_44px_rgba(15,23,42,0.08)] md:grid-cols-[1.25fr_0.75fr_0.75fr_0.75fr_0.75fr_auto]"
    >
      <div className="flex min-w-0 items-center gap-3">
        <PlatformBadge platform={campaign.platform} />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-black text-[#071236]">{campaign.name}</p>
          <p className="mt-1 text-[11px] font-bold text-[#7b87a3]">{platform.label} · {campaign.objective.replace(/_/g, ' ')}</p>
          <p className={`mt-1 truncate text-[10px] font-semibold ${pinnedSource ? 'text-emerald-700' : 'text-amber-700'}`}>
            {pinnedSource
              ? `${locale === 'ar' ? 'المصدر المعتمد' : 'Approved source'}: ${campaign.sourceStrategy?.name} · v${campaign.strategySnapshot?.version}`
              : campaign.sourceRevision.state === 'stale'
                ? locale === 'ar' ? `إصدار أحدث v${campaign.sourceRevision.latestVersion ?? '—'} — أعد بناء المسودة` : `Newer strategy v${campaign.sourceRevision.latestVersion ?? '—'} — rebuild draft`
                : locale === 'ar' ? 'لا يوجد إصدار استراتيجية مثبت — التنفيذ مقفل' : 'No pinned strategy revision — execution locked'}
          </p>
        </div>
      </div>
      <div>
        <p className="text-[11px] font-bold text-[#7b87a3]">{locale === 'ar' ? 'الحالة' : 'Status'}</p>
        <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${status.tone}`}>{locale === 'ar' ? status.ar : status.en}</span>
      </div>
      <div>
        <p className="text-[11px] font-bold text-[#7b87a3]">{locale === 'ar' ? 'الميزانية' : 'Budget'}</p>
        <p className="mt-1 text-[13px] font-black text-[#111b3f]">{budget}</p>
      </div>
      <div>
        <p className="text-[11px] font-bold text-[#7b87a3]">{locale === 'ar' ? 'إنفاق مبلغ عنه' : 'Reported spend'}</p>
        <p className="mt-1 text-[13px] font-black text-[#111b3f]">{campaign.totalSpend > 0 ? campaign.totalSpend.toFixed(0) : '—'}</p>
      </div>
      <div>
        <p className="text-[11px] font-bold text-[#7b87a3]">{locale === 'ar' ? 'ROAS مبلغ عنه' : 'Reported ROAS'}</p>
        <p className="mt-1 text-[13px] font-black text-[#111b3f]">{campaign.avgROAS != null ? `${campaign.avgROAS.toFixed(2)}x` : '—'}</p>
      </div>
      <div className="flex items-center justify-end text-[#5366f6]">
        <ChevronRight className="h-4 w-4" />
      </div>
    </Link>
  )
}

export default function PaidCampaignsPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth()
  const { locale } = useI18n()
  const router = useRouter()
  const ar = locale === 'ar'

  const [campaigns, setCampaigns] = useState<AdCampaign[]>([])
  const [accounts, setAccounts] = useState<AdAccount[]>([])
  const [strategySources, setStrategySources] = useState<PaidStrategySourceTruth[]>([])
  const [strategySourcesStatus, setStrategySourcesStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loading, setLoading] = useState(true)
  const [platformFilter, setPlatformFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [connectingMeta, setConnectingMeta] = useState(false)
  const [connectingGoogle, setConnectingGoogle] = useState(false)

  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    setStrategySourcesStatus('loading')
    try {
      const session = await import('@/lib/supabaseClient').then((module) => module.supabase.auth.getSession())
      const token = session.data?.session?.access_token
      if (!token) {
        setLoading(false)
        return
      }

      const headers = { Authorization: `Bearer ${token}` }
      const [campaignsRes, accountsRes, sourcesRes] = await Promise.all([
        fetch('/api/ad-campaigns', { headers }),
        fetch('/api/ad-accounts', { headers }),
        fetch('/api/paid-strategy-sources', { headers }),
      ])

      if (campaignsRes.ok) {
        const data = await campaignsRes.json()
        setCampaigns(data.campaigns || [])
      }
      if (accountsRes.ok) {
        const data = await accountsRes.json()
        setAccounts(data.accounts || [])
      }
      if (sourcesRes.ok) {
        const data = await sourcesRes.json()
        setStrategySources(data.sources || [])
        setStrategySourcesStatus('ready')
      } else {
        setStrategySourcesStatus('error')
      }
    } catch (error) {
      console.error('[PaidCampaigns]', error)
      setStrategySourcesStatus('error')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace('/auth/login')
  }, [authLoading, isAuthenticated, router])

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
      const session = await import('@/lib/supabaseClient').then((module) => module.supabase.auth.getSession())
      const token = session.data?.session?.access_token
      if (!token) return
      const response = await fetch('/api/social/connect/meta-ads', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      if (data.url) window.location.href = data.url
    } catch {
      // Connection errors stay silent here; the OAuth page/API owns the detailed error state.
    } finally {
      setConnectingMeta(false)
    }
  }

  const handleConnectGoogle = async () => {
    setConnectingGoogle(true)
    try {
      const session = await import('@/lib/supabaseClient').then((module) => module.supabase.auth.getSession())
      const token = session.data?.session?.access_token
      if (!token) return
      const response = await fetch('/api/social/connect/google-ads', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      if (data.url) window.location.href = data.url
    } catch {
      // Detailed configuration and OAuth errors are returned by the connection endpoint.
    } finally {
      setConnectingGoogle(false)
    }
  }

  const filteredCampaigns = useMemo(() => campaigns.filter((campaign) => {
    if (platformFilter !== 'ALL' && campaign.platform !== platformFilter) return false
    if (statusFilter !== 'ALL' && campaign.status !== statusFilter) return false
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLocaleLowerCase(locale)
      const haystack = `${campaign.name} ${campaign.objective} ${PLATFORMS[campaign.platform].label}`.toLocaleLowerCase(locale)
      if (!haystack.includes(query)) return false
    }
    return true
  }), [campaigns, locale, platformFilter, searchQuery, statusFilter])

  const summary = useMemo(() => {
    return {
      activeRecords: campaigns.filter((campaign) => campaign.status === 'ACTIVE').length,
      planningDrafts: campaigns.filter((campaign) => campaign.status === 'DRAFT' || campaign.status === 'PENDING_REVIEW').length,
    }
  }, [campaigns])
  const eligibleStrategySources = useMemo(
    () => strategySources.filter(source => source.eligible),
    [strategySources],
  )
  const approvedExecutionPlatforms = useMemo(() => new Set(
    eligibleStrategySources.flatMap(source => source.approvedPlatforms),
  ), [eligibleStrategySources])
  const hasApprovedPaidSource = strategySourcesStatus === 'ready' && eligibleStrategySources.length > 0
  const metaInApprovedStrategy = approvedExecutionPlatforms.has('META')
  const googleInApprovedStrategy = approvedExecutionPlatforms.has('GOOGLE')
  const hasMetaAccount = accounts.some(account => account.platform.toUpperCase() === 'META')
  const hasGoogleAccount = accounts.some(account => account.platform.toUpperCase() === 'GOOGLE')

  if (!authLoading && !isAuthenticated) return null

  if (authLoading) {
    return <WorkspaceRouteLoading labelAr="جارٍ تجهيز مركز الإعلانات المدفوعة" labelEn="Preparing paid campaigns" />
  }

  return (
    <AppShell>
      <main dir={ar ? 'rtl' : 'ltr'} className="nx-os-page text-[#071236]">
        <div className="nx-os-container">
          <LuxuryWorkspaceHeader
            pageTitle={ar ? 'الإعلانات المدفوعة' : 'Paid campaigns'}
            pageSubtitle={ar ? 'حوّل استراتيجية Paid أو Full معتمدة إلى تنفيذ منصة، ثم راجع كل شيء قبل أي إطلاق أو إنفاق.' : 'Turn an approved Paid or Full strategy into platform execution, then review everything before launch or spend.'}
            primaryHref={hasApprovedPaidSource ? '/paid-campaigns/new' : null}
            primaryLabel={ar ? 'ابدأ من استراتيجية معتمدة' : 'Start from approved strategy'}
            secondaryHref="/connections"
            secondaryLabel={ar ? 'التكاملات' : 'Integrations'}
          />

          <section className="nx-os-action-strip mb-5">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#eef1ff] text-[#5366f6]">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[13px] font-black text-[#071236]">
                  {strategySourcesStatus === 'error'
                    ? ar
                      ? 'تعذر التحقق من مصادر الاستراتيجية الآن'
                      : 'Approved strategy sources could not be verified right now'
                    : hasApprovedPaidSource
                    ? ar
                      ? `${eligibleStrategySources.length} استراتيجية معتمدة جاهزة للترجمة إلى تنفيذ`
                      : `${eligibleStrategySources.length} approved strateg${eligibleStrategySources.length === 1 ? 'y is' : 'ies are'} ready for execution translation`
                    : ar
                      ? 'لا توجد استراتيجية Paid أو Full معتمدة للتنفيذ'
                      : 'No approved Paid or Full strategy is ready for execution'}
                </p>
                <p className="mt-0.5 text-[11px] font-bold text-[#64708f]">
                  {ar
                    ? `${accounts.length} حسابات إعلانية متصلة · ${summary.planningDrafts} مسودات مراجعة · ${summary.activeRecords} سجلات نشطة على المنصات`
                    : `${accounts.length} connected ad accounts · ${summary.planningDrafts} review drafts · ${summary.activeRecords} platform-active records`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {strategySourcesStatus === 'ready' && googleInApprovedStrategy ? (
                <button
                  type="button"
                  onClick={handleConnectGoogle}
                  disabled={connectingGoogle}
                  className="inline-flex h-11 items-center gap-2 rounded-[15px] border border-[#d7def0] bg-white px-4 text-[13px] font-black text-[#111b3f] shadow-sm transition hover:border-[#bfc9df] disabled:opacity-60"
                >
                  <span className="text-[#4285f4]">G</span>
                  {connectingGoogle
                    ? (ar ? 'جاري فتح Google...' : 'Opening Google...')
                    : hasGoogleAccount
                      ? (ar ? 'تحقق من Google المعتمد' : 'Verify approved Google account')
                      : (ar ? 'اربط Google للاستراتيجية' : 'Connect Google for strategy')}
                </button>
              ) : strategySourcesStatus === 'ready' && hasGoogleAccount ? (
                <span className="inline-flex h-11 items-center rounded-[15px] border border-slate-200 bg-slate-50 px-4 text-[12px] font-bold text-slate-600">
                  {ar ? 'Google متصل · خارج الاستراتيجية المعتمدة' : 'Google connected · outside approved strategy'}
                </span>
              ) : null}
              {strategySourcesStatus === 'ready' && metaInApprovedStrategy ? (
                <button
                  type="button"
                  onClick={handleConnectMeta}
                  disabled={connectingMeta}
                  className="inline-flex h-11 items-center gap-2 rounded-[15px] border border-[#d7def0] bg-white px-4 text-[13px] font-black text-[#111b3f] shadow-sm transition hover:border-[#bfc9df] disabled:opacity-60"
                >
                  <ShieldCheck className="h-4 w-4 text-[#5366f6]" />
                  {connectingMeta
                    ? (ar ? 'جاري فتح الربط...' : 'Opening connection...')
                    : hasMetaAccount
                      ? (ar ? 'تحقق من Meta المعتمد' : 'Verify approved Meta account')
                      : (ar ? 'اربط Meta للاستراتيجية' : 'Connect Meta for strategy')}
                </button>
              ) : strategySourcesStatus === 'ready' && hasMetaAccount ? (
                <span className="inline-flex h-11 items-center rounded-[15px] border border-slate-200 bg-slate-50 px-4 text-[12px] font-bold text-slate-600">
                  {ar ? 'Meta متصل · خارج الاستراتيجية المعتمدة' : 'Meta connected · outside approved strategy'}
                </span>
              ) : null}
              {hasApprovedPaidSource ? (
                <Link
                  href="/paid-campaigns/new"
                  className="inline-flex h-11 items-center gap-2 rounded-[15px] bg-[#071236] px-5 text-[13px] font-black text-white shadow-[0_18px_38px_rgba(7,18,54,0.2)] transition hover:bg-[#111f4b]"
                >
                  <Plus className="h-4 w-4" />
                  {ar ? 'تنفيذ استراتيجية معتمدة' : 'Execute approved strategy'}
                </Link>
              ) : (
                <Link
                  href="/strategy"
                  className="inline-flex h-11 items-center gap-2 rounded-[15px] border border-[#d7def0] bg-white px-5 text-[13px] font-black text-[#5366f6] shadow-sm transition hover:border-[#aeb9d3]"
                >
                  <Plus className="h-4 w-4" />
                  {ar ? 'أنشئ واعتمد استراتيجية Paid أولًا' : 'Create and approve a Paid strategy first'}
                </Link>
              )}
            </div>
          </section>

          <section>
              <div className="rounded-[24px] border border-[#e3e8f3] bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-[18px] font-black text-[#071236]">{ar ? 'محفظة التنفيذ المدفوع' : 'Paid execution portfolio'}</h2>
                    <p className="mt-1 text-[12px] font-bold text-[#64708f]">
                      {ar ? 'كل صف يجب أن يرجع لاستراتيجية معتمدة؛ مسودة المنصة والتفعيل والإنفاق لكل منها بوابة مستقلة.' : 'Every row must trace to an approved strategy; platform draft, activation, and spend each have a separate gate.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex h-10 min-w-[220px] items-center gap-2 rounded-[14px] border border-[#e3e8f3] bg-[#fbfcff] px-3 text-[12px] font-bold text-[#64708f] focus-within:border-[#8f98ff]">
                      <Search className="h-4 w-4" />
                      <input
                        aria-label={ar ? 'ابحث في التنفيذ المدفوع' : 'Search paid execution'}
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder={ar ? 'ابحث في التنفيذ المدفوع' : 'Search paid execution'}
                        className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#9aa4b8]"
                      />
                    </label>
                    <span className="inline-flex h-10 items-center gap-2 rounded-[14px] border border-[#e3e8f3] bg-[#fbfcff] px-3 text-[12px] font-bold text-[#64708f]">
                      <Filter className="h-4 w-4" />
                      {filteredCampaigns.length} / {campaigns.length}
                    </span>
                  </div>
                </div>

                {campaigns.length > 0 ? (
                  <div className="mb-5 flex flex-wrap gap-2">
                    {['ALL', 'META', 'GOOGLE', 'TIKTOK', 'LINKEDIN'].map((platform) => (
                      <button
                        key={platform}
                        type="button"
                        onClick={() => setPlatformFilter(platform)}
                        className={`h-10 rounded-[14px] px-4 text-[12px] font-black transition ${platformFilter === platform ? 'bg-[#5366f6] text-white' : 'border border-[#e3e8f3] bg-white text-[#64708f]'}`}
                      >
                        {platform === 'ALL' ? (ar ? 'كل المنصات' : 'All platforms') : PLATFORMS[platform as keyof typeof PLATFORMS].label}
                      </button>
                    ))}
                    {['ALL', 'ACTIVE', 'DRAFT', 'PENDING_REVIEW', 'PAUSED', 'COMPLETED'].map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setStatusFilter(status)}
                        className={`h-10 rounded-[14px] px-4 text-[12px] font-black transition ${statusFilter === status ? 'bg-[#071236] text-white' : 'border border-[#e3e8f3] bg-white text-[#64708f]'}`}
                      >
                        {status === 'ALL' ? (ar ? 'كل الحالات' : 'All status') : ar ? STATUS_COPY[status as keyof typeof STATUS_COPY]?.ar : STATUS_COPY[status as keyof typeof STATUS_COPY]?.en}
                      </button>
                    ))}
                  </div>
                ) : null}

                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((item) => (
                      <div key={item} className="h-20 animate-pulse rounded-[18px] bg-[#f1f4fa]" />
                    ))}
                  </div>
                ) : campaigns.length === 0 ? (
                  <div className="rounded-[22px] border border-dashed border-[#cfd8ee] bg-[#fbfcff] px-6 py-12 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#fff7ed] text-[#f97316]">
                      <Megaphone className="h-8 w-8" />
                    </div>
                    <h3 className="mt-5 text-[20px] font-black text-[#071236]">{ar ? 'لا توجد مسودات تنفيذ مدفوع بعد' : 'No paid execution drafts yet'}</h3>
                    <p className="mx-auto mt-2 max-w-xl text-[13px] leading-7 text-[#64708f]">
                      {ar
                        ? 'ابدأ باستراتيجية Paid أو Full، راجعها واعتمدها، ثم حوّلها إلى تنفيذ منصة. لا يُسمح بمسودة مستقلة بلا مصدر.'
                        : 'Start with a Paid or Full strategy, review and approve it, then translate it into platform execution. Standalone drafts without a source are not allowed.'}
                    </p>
                    <div className="mt-6 flex justify-center">
                      {hasApprovedPaidSource ? (
                        <Link href="/paid-campaigns/new" className="inline-flex h-11 items-center gap-2 rounded-[15px] bg-[#071236] px-5 text-[13px] font-black text-white">
                          <Plus className="h-4 w-4" />
                          {ar ? 'اختر الاستراتيجية المعتمدة' : 'Choose approved strategy'}
                        </Link>
                      ) : (
                        <Link href="/strategy" className="inline-flex h-11 items-center gap-2 rounded-[15px] border border-[#d7def0] bg-white px-5 text-[13px] font-black text-[#5366f6]">
                          <Plus className="h-4 w-4" />
                          {ar ? 'أنشئ واعتمد استراتيجية Paid أولًا' : 'Create and approve a Paid strategy first'}
                        </Link>
                      )}
                    </div>
                  </div>
                ) : filteredCampaigns.length === 0 ? (
                  <div className="rounded-[20px] border border-[#e3e8f3] bg-[#fbfcff] p-8 text-center text-[14px] font-bold text-[#64708f]">
                    {ar ? 'لا توجد مسودات تنفيذ تطابق الفلاتر الحالية.' : 'No paid execution drafts match the selected filters.'}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredCampaigns.map((campaign) => (
                      <CampaignRow key={campaign.id} campaign={campaign} locale={locale} />
                    ))}
                  </div>
                )}
              </div>
          </section>
        </div>
      </main>
    </AppShell>
  )
}
