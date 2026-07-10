'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Filter,
  Gauge,
  Megaphone,
  MousePointer2,
  Plus,
  RadioTower,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  WalletCards,
  type LucideIcon,
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'

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

const PLATFORMS = {
  META: { label: 'Meta Ads', mark: '∞', color: '#315efb', tint: 'bg-blue-50 text-blue-700' },
  GOOGLE: { label: 'Google Ads', mark: 'G', color: '#1a73e8', tint: 'bg-sky-50 text-sky-700' },
  TIKTOK: { label: 'TikTok Ads', mark: '♪', color: '#111827', tint: 'bg-slate-100 text-slate-900' },
  LINKEDIN: { label: 'LinkedIn Ads', mark: 'in', color: '#0a66c2', tint: 'bg-blue-50 text-blue-700' },
} as const

const STATUS_COPY = {
  DRAFT: { ar: 'مسودة تخطيط', en: 'Planning draft', tone: 'bg-slate-100 text-slate-700' },
  PENDING_REVIEW: { ar: 'قيد المراجعة', en: 'Setup review', tone: 'bg-amber-50 text-amber-700' },
  ACTIVE: { ar: 'سجل نشط على المنصة', en: 'Platform active record', tone: 'bg-emerald-50 text-emerald-700' },
  PAUSED: { ar: 'مسودة منصة متوقفة', en: 'Paused platform draft', tone: 'bg-orange-50 text-orange-700' },
  COMPLETED: { ar: 'مكتملة', en: 'Completed', tone: 'bg-violet-50 text-violet-700' },
  ARCHIVED: { ar: 'مؤرشفة', en: 'Archived', tone: 'bg-slate-100 text-slate-600' },
  REJECTED: { ar: 'مرفوضة', en: 'Rejected', tone: 'bg-rose-50 text-rose-700' },
} as const

function formatNum(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`
  return String(value)
}

function PlatformBadge({ platform }: { platform: keyof typeof PLATFORMS }) {
  const config = PLATFORMS[platform]
  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-[13px] bg-white text-[13px] font-black shadow-sm ring-1 ring-[#e3e8f3]" style={{ color: config.color }}>
      {config.mark}
    </span>
  )
}

function MetricCard({
  title,
  value,
  helper,
  icon,
}: {
  title: string
  value: string
  helper: string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-[22px] border border-[#e3e8f3] bg-white/90 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[12px] font-bold text-[#64708f]">{title}</p>
        <span className="flex h-10 w-10 items-center justify-center rounded-[15px] bg-[#f4f6ff] text-[#5366f6]">{icon}</span>
      </div>
      <p className="text-[28px] font-black tracking-[-0.03em] text-[#071236]">{value}</p>
      <p className="mt-1 text-[12px] font-bold text-[#7b87a3]">{helper}</p>
    </div>
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
  const { user } = useAuth()
  const { locale } = useI18n()
  const router = useRouter()
  const ar = locale === 'ar'

  const [campaigns, setCampaigns] = useState<AdCampaign[]>([])
  const [accounts, setAccounts] = useState<AdAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [platformFilter, setPlatformFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [connectingMeta, setConnectingMeta] = useState(false)

  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const session = await import('@/lib/supabaseClient').then((module) => module.supabase.auth.getSession())
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
    } catch (error) {
      console.error('[PaidCampaigns]', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

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
    const totalSpend = campaigns.reduce((sum, campaign) => sum + campaign.totalSpend, 0)
    const totalImpressions = campaigns.reduce((sum, campaign) => sum + campaign.totalImpressions, 0)
    const roasRecords = campaigns.filter((campaign) => campaign.avgROAS != null)
    return {
      activeRecords: campaigns.filter((campaign) => campaign.status === 'ACTIVE').length,
      totalSpend,
      totalImpressions,
      avgROAS: roasRecords.length ? roasRecords.reduce((sum, campaign) => sum + (campaign.avgROAS || 0), 0) / roasRecords.length : null,
      planningDrafts: campaigns.filter((campaign) => campaign.status === 'DRAFT' || campaign.status === 'PENDING_REVIEW').length,
    }
  }, [campaigns])

  return (
    <AppShell>
      <main dir={ar ? 'rtl' : 'ltr'} className="min-h-screen bg-[#f6f8fc] text-[#071236]">
        <div className="mx-auto max-w-[1540px] px-6 py-7 lg:px-8">
          <LuxuryWorkspaceHeader
            pageTitle={ar ? 'الإعلانات المدفوعة' : 'Paid campaigns'}
            pageSubtitle={ar ? 'تخطيط وتنفيذ مدفوع لا يبدأ إلا بعد ربط الحسابات، التحقق من الصلاحيات، وموافقة صريحة.' : 'Paid planning and execution records only move forward after account access, permission checks, and explicit approval.'}
            primaryHref="/paid-campaigns/new"
            primaryLabel={ar ? 'مسودة تخطيط مدفوع' : 'Paid planning draft'}
            secondaryHref="/connections"
            secondaryLabel={ar ? 'التكاملات' : 'Integrations'}
          />

          <header className="mb-6 flex flex-col gap-5 rounded-[26px] border border-[#e3e8f3] bg-white p-5 shadow-[0_18px_55px_rgba(13,24,63,0.045)] xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-[12px] font-bold text-[#64708f]">{ar ? 'تشغيل مدفوع بموافقة صريحة' : 'Approval-gated paid execution'}</p>
              <h1 className="mt-1 flex items-center gap-2 text-[32px] font-black tracking-[-0.03em] text-[#071236]">
                {ar ? 'الإعلانات المدفوعة' : 'Paid campaigns'}
                <Sparkles className="text-[#5366f6]" size={24} />
              </h1>
              <p className="mt-2 max-w-3xl text-[14px] leading-7 text-[#64708f]">
                {ar
                  ? 'حوّل الاستراتيجية إلى تخطيط إعلاني، راجع الميزانية والجمهور والقيود، ثم نفّذ فقط بعد اتصال الحسابات والصلاحيات والموافقة النهائية.'
                  : 'Turn strategy into paid planning, review budget, audiences, and constraints, then execute only after account access, permissions, and final approval.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleConnectMeta}
                disabled={connectingMeta}
                className="inline-flex h-11 items-center gap-2 rounded-[15px] border border-[#d7def0] bg-white px-4 text-[13px] font-black text-[#111b3f] shadow-sm transition hover:border-[#bfc9df] disabled:opacity-60"
              >
                <ShieldCheck className="h-4 w-4 text-[#5366f6]" />
                {connectingMeta ? (ar ? 'جاري فتح الربط...' : 'Opening connection...') : (ar ? 'راجع ربط Meta Ads' : 'Review Meta Ads connection')}
              </button>
              <Link
                href="/paid-campaigns/new"
                className="inline-flex h-11 items-center gap-2 rounded-[15px] bg-[#071236] px-5 text-[13px] font-black text-white shadow-[0_18px_38px_rgba(7,18,54,0.2)] transition hover:bg-[#111f4b]"
              >
                <Plus className="h-4 w-4" />
                {ar ? 'مسودة تخطيط مدفوع' : 'Paid planning draft'}
              </Link>
            </div>
          </header>

          <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard title={ar ? 'سجلات نشطة على المنصات' : 'Platform-active records'} value={String(summary.activeRecords)} helper={ar ? 'حسب سجلات الحملات المتصلة فقط' : 'From connected campaign records only'} icon={<RadioTower size={19} />} />
            <MetricCard title={ar ? 'إنفاق مبلغ عنه' : 'Reported spend'} value={summary.totalSpend > 0 ? formatNum(summary.totalSpend) : '0'} helper={ar ? 'لا يعني إنفاقاً جديداً من NEXUS' : 'Does not imply new NEXUS spend'} icon={<CircleDollarSign size={19} />} />
            <MetricCard title={ar ? 'مرات ظهور مبلغ عنها' : 'Reported impressions'} value={summary.totalImpressions > 0 ? formatNum(summary.totalImpressions) : '0'} helper={ar ? 'من بيانات المنصات عند توفرها' : 'From platform data when available'} icon={<MousePointer2 size={19} />} />
            <MetricCard title={ar ? 'ROAS مبلغ عنه' : 'Reported ROAS'} value={summary.avgROAS != null ? `${summary.avgROAS.toFixed(2)}x` : '—'} helper={ar ? 'يظهر فقط عند وجود مقاييس فعلية' : 'Shown only with actual metrics'} icon={<BarChart3 size={19} />} />
          </section>

          <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
            <div className="space-y-5">
              <div className="rounded-[24px] border border-[#e3e8f3] bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-[18px] font-black text-[#071236]">{ar ? 'محفظة التخطيط المدفوع' : 'Paid planning portfolio'}</h2>
                    <p className="mt-1 text-[12px] font-bold text-[#64708f]">
                      {ar ? 'كل صف هنا يمثل تخطيطاً أو سجلاً منصة؛ الإطلاق والإنفاق لهما موافقة منفصلة.' : 'Each row is planning or a platform record; launch and spend require a separate approval.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex h-10 min-w-[220px] items-center gap-2 rounded-[14px] border border-[#e3e8f3] bg-[#fbfcff] px-3 text-[12px] font-bold text-[#64708f] focus-within:border-[#8f98ff]">
                      <Search className="h-4 w-4" />
                      <input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder={ar ? 'ابحث في التخطيط المدفوع' : 'Search paid planning'}
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
                    <h3 className="mt-5 text-[20px] font-black text-[#071236]">{ar ? 'لا توجد مسودات تخطيط مدفوع بعد' : 'No paid planning drafts yet'}</h3>
                    <p className="mx-auto mt-2 max-w-xl text-[13px] leading-7 text-[#64708f]">
                      {ar
                        ? 'ابدأ من استراتيجية حملة أو أنشئ مسودة تخطيط. NEXUS لن ينشئ إنفاقاً أو يفعّل حملة منصة بدون تأكيد نهائي.'
                        : 'Start from a campaign strategy or create a planning draft. NEXUS will not create spend or activate a platform campaign without final confirmation.'}
                    </p>
                    <div className="mt-6 flex justify-center">
                      <Link href="/paid-campaigns/new" className="inline-flex h-11 items-center gap-2 rounded-[15px] bg-[#071236] px-5 text-[13px] font-black text-white">
                        <Plus className="h-4 w-4" />
                        {ar ? 'ابدأ مسودة تخطيط' : 'Create planning draft'}
                      </Link>
                    </div>
                  </div>
                ) : filteredCampaigns.length === 0 ? (
                  <div className="rounded-[20px] border border-[#e3e8f3] bg-[#fbfcff] p-8 text-center text-[14px] font-bold text-[#64708f]">
                    {ar ? 'لا توجد مسودات تطابق الفلاتر الحالية.' : 'No paid planning drafts match the selected filters.'}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredCampaigns.map((campaign) => (
                      <CampaignRow key={campaign.id} campaign={campaign} locale={locale} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <aside className="space-y-5">
              <div className="rounded-[24px] border border-[#e3e8f3] bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-[16px] font-black text-[#071236]">{ar ? 'جاهزية التنفيذ' : 'Execution readiness'}</h2>
                  <Gauge className="h-5 w-5 text-[#5366f6]" />
                </div>
                {[
                  [ar ? 'حسابات إعلانية متصلة' : 'Connected ad accounts', accounts.length ? `${accounts.length}` : ar ? 'غير متصل' : 'Not connected', Boolean(accounts.length)],
                  [ar ? 'الموافقات النهائية' : 'Final approvals', ar ? 'مطلوبة قبل الإطلاق' : 'Required before launch', false],
                  [ar ? 'الإنفاق' : 'Spend', ar ? 'لا يبدأ تلقائياً' : 'Never starts automatically', false],
                ].map(([label, value, ok]) => (
                  <div key={label as string} className="flex items-center justify-between border-b border-[#eef2f8] py-3 last:border-b-0">
                    <span className="text-[12px] font-bold text-[#64708f]">{label}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="rounded-[24px] border border-[#e3e8f3] bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                <h2 className="text-[16px] font-black text-[#071236]">{ar ? 'الحسابات المتاحة للمراجعة' : 'Accounts available for review'}</h2>
                <div className="mt-4 space-y-3">
                  {accounts.length ? accounts.map((account) => (
                    <div key={account.id} className="flex items-center justify-between rounded-[17px] border border-[#e8edf7] bg-[#fbfcff] p-3">
                      <div className="flex items-center gap-3">
                        <PlatformBadge platform={(account.platform in PLATFORMS ? account.platform : 'META') as keyof typeof PLATFORMS} />
                        <div>
                          <p className="text-[13px] font-black text-[#111b3f]">{account.platformAccountName || account.platform}</p>
                          <p className="text-[11px] font-bold text-[#7b87a3]">{account.status} · {account.currency}</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700">{ar ? 'متصل' : 'Connected'}</span>
                    </div>
                  )) : (
                    <p className="rounded-[17px] border border-dashed border-[#cfd8ee] bg-[#fbfcff] p-4 text-[12px] font-bold leading-6 text-[#64708f]">
                      {ar ? 'لا توجد حسابات إعلانية متصلة بعد. اربط الحسابات عندما تجهز صلاحيات المنصات.' : 'No ad accounts are connected yet. Connect accounts when platform permissions are ready.'}
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-[24px] border border-[#e3e8f3] bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                <h2 className="text-[16px] font-black text-[#071236]">{ar ? 'المسار الصحيح' : 'Correct workflow'}</h2>
                <div className="mt-4 space-y-3">
                  {([
                    { Icon: Target, title: ar ? 'استراتيجية واضحة' : 'Clear strategy', helper: ar ? 'الجمهور، العرض، الميزانية، والرسالة.' : 'Audience, offer, budget, and message.' },
                    { Icon: WalletCards, title: ar ? 'مسودة تخطيط' : 'Planning draft', helper: ar ? 'لا تنشئ إنفاقاً ولا منصة نشطة.' : 'No spend and no active platform object.' },
                    { Icon: ShieldCheck, title: ar ? 'موافقة نهائية' : 'Final approval', helper: ar ? 'قبل أي دفع أو تفعيل منصة.' : 'Before any spend or platform activation.' },
                    { Icon: Activity, title: ar ? 'قياس فعلي' : 'Actual measurement', helper: ar ? 'التعلم يبدأ فقط بعد بيانات منصة حقيقية.' : 'Learning starts only after real platform data.' },
                  ] satisfies Array<{ Icon: LucideIcon; title: string; helper: string }>).map(({ Icon, title, helper }) => (
                    <div key={title} className="flex gap-3 rounded-[17px] border border-[#eef2f8] bg-[#fbfcff] p-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-white text-[#5366f6] shadow-sm">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span>
                        <span className="block text-[13px] font-black text-[#111b3f]">{title}</span>
                        <span className="mt-1 block text-[11px] leading-5 text-[#64708f]">{helper}</span>
                      </span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => router.push('/connections')}
                  className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[14px] border border-[#d7def0] bg-white text-[12px] font-black text-[#5366f6]"
                >
                  {ar ? 'إدارة الربط والصلاحيات' : 'Manage connections and permissions'}
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              </div>
            </aside>
          </section>
        </div>
      </main>
    </AppShell>
  )
}
