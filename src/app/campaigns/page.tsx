'use client'

import AppShell from '@/components/AppShell'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { getCampaignPlatformSummary } from '@/lib/campaignPlatforms'
import { resolveCampaignCounts, type CampaignCounts } from '@/lib/campaignSummary'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Archive,
  ArrowUpRight,
  BadgeCheck,
  Download,
  FolderKanban,
  Info,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Target,
  Trash2,
  Wand2,
  X,
} from 'lucide-react'

interface Campaign {
  id: string
  name: string
  description?: string
  goal: string
  status: string
  favorite: boolean
  thumbnail: string
  platforms: string[]
  createdAt: string
  updatedAt: string
  _count: { activities: number }
}

function MetricCard({
  title,
  value,
  helper,
  icon,
  trend,
}: {
  title: string
  value: string
  helper: string
  icon: React.ReactNode
  trend?: string
}) {
  return (
    <div className="rounded-[18px] border border-[#e5eaf5] bg-white p-4 shadow-[0_16px_42px_rgba(13,24,63,0.045)]">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#f1f0ff] text-[#4f46e5]">{icon}</span>
        {trend ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">{trend}</span> : null}
      </div>
      <p className="text-[12px] font-semibold text-[#687692]">{title}</p>
      <p className="mt-1 text-[26px] font-black tracking-[-0.03em] text-[#071236]">{value}</p>
      <p className="mt-1 text-[11px] leading-5 text-[#7b87a3]">{helper}</p>
    </div>
  )
}

function Donut({
  value,
  label,
}: {
  value: number
  label: string
}) {
  const safeValue = Math.max(0, Math.min(100, value))
  return (
    <div className="flex items-center justify-center">
      <div
        className="flex h-36 w-36 items-center justify-center rounded-full"
        style={{ background: `conic-gradient(#4f46e5 ${safeValue * 3.6}deg, #e8edf7 0deg)` }}
      >
        <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-white">
          <span className="text-[30px] font-black text-[#071236]">{safeValue}%</span>
          <span className="mt-1 text-[12px] font-semibold text-[#687692]">{label}</span>
        </div>
      </div>
    </div>
  )
}

export default function CampaignsPage() {
  const { authHeader, isAuthenticated, loading: authLoading } = useAuth()
  const { t, locale } = useI18n()
  const router = useRouter()
  const cT = t('campaigns') as Record<string, string>
  const ar = locale === 'ar'
  const copy = (arabic: string, english: string) => (ar ? arabic : english)

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [counts, setCounts] = useState<CampaignCounts | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy] = useState<'createdAt' | 'updatedAt' | 'name'>('updatedAt')
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [decisionCampaign, setDecisionCampaign] = useState<{
    id: string
    name: string
    kind: 'archive' | 'delete'
  } | null>(null)
  const [decisionError, setDecisionError] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)

  const statusMap: Record<string, { label: string; dot: string; pill: string }> = {
    DRAFT: {
      label: cT?.statusDraft || copy('مسودة', 'Draft'),
      dot: 'bg-slate-400',
      pill: 'bg-slate-50 text-slate-600 border-slate-200',
    },
    ACTIVE: {
      label: copy('استراتيجية معتمدة', 'Strategy approved'),
      dot: 'bg-emerald-500',
      pill: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    },
    PAUSED: {
      label: cT?.statusPaused || copy('متوقفة', 'Paused'),
      dot: 'bg-amber-500',
      pill: 'bg-amber-50 text-amber-700 border-amber-100',
    },
    COMPLETED: {
      label: cT?.statusCompleted || copy('مكتملة', 'Completed'),
      dot: 'bg-blue-500',
      pill: 'bg-blue-50 text-blue-700 border-blue-100',
    },
    ARCHIVED: {
      label: cT?.statusArchived || copy('مؤرشفة', 'Archived'),
      dot: 'bg-slate-300',
      pill: 'bg-slate-50 text-slate-500 border-slate-200',
    },
  }

  const goalMap: Record<string, string> = {
    SALES: cT?.goalSales || copy('مبيعات', 'Sales'),
    AWARENESS: cT?.goalAwareness || copy('وعي', 'Awareness'),
    ENGAGEMENT: cT?.goalEngagement || copy('تفاعل', 'Engagement'),
    LEADS: cT?.goalLeads || copy('عملاء محتملون', 'Leads'),
    TRAFFIC: cT?.goalTraffic || copy('زيارات', 'Traffic'),
  }

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/login')
  }, [authLoading, isAuthenticated, router])

  const load = useCallback(async () => {
    if (authLoading || !isAuthenticated) return
    const token = authHeader()
    if (!token) return
    setLoading(true)
    setLoadError(false)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      if (favoriteOnly) params.set('favorite', 'true')
      params.set('sort', sortBy)
      params.set('limit', '50')

      const res = await fetch(`/api/campaigns?${params}`, {
        headers: { Authorization: token },
      })
      if (res.ok) {
        const data = await res.json()
        setCampaigns(data.campaigns || [])
        setCounts(resolveCampaignCounts(data))
      } else {
        setLoadError(true)
      }
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [authHeader, authLoading, favoriteOnly, isAuthenticated, search, sortBy, statusFilter])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!openMenuId) return
    const handler = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpenMenuId(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openMenuId])

  const toggleFavorite = async (id: string, current: boolean) => {
    setTogglingId(id)
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
        body: JSON.stringify({ favorite: !current }),
      })
      if (!res.ok) return
      setCampaigns((prev) => prev.map((campaign) => campaign.id === id ? { ...campaign, favorite: !current } : campaign))
    } finally {
      setTogglingId(null)
    }
  }

  const archiveCampaign = async (id: string) => {
    setDecisionError('')
    setDeletingId(id)
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
        body: JSON.stringify({ status: 'ARCHIVED' }),
      })
      if (!res.ok) throw new Error('archive_failed')
      setCampaigns((prev) => prev.map((campaign) => campaign.id === id ? { ...campaign, status: 'ARCHIVED' } : campaign))
      setDecisionCampaign(null)
    } catch {
      setDecisionError(copy('تعذر أرشفة الحملة. لم تتغير حالتها.', 'Could not archive the campaign. Its state was not changed.'))
    } finally {
      setDeletingId(null)
    }
  }

  const deleteCampaign = async (id: string) => {
    setDecisionError('')
    setDeletingId(id)
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: authHeader(),
          'X-Nexus-Confirm-Campaign-Delete': id,
        },
      })
      const responseBody = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (responseBody?.error === 'CAMPAIGN_HAS_CONTENT') {
          setDecisionError(copy(
            `لا يمكن حذف هذه الحملة لأن لديها ${responseBody.socialPostCount || 1} منشورًا في Content Hub. استخدم الأرشفة للحفاظ على سجل التشغيل.`,
            `This campaign has ${responseBody.socialPostCount || 1} Content Hub post(s) and cannot be permanently deleted. Archive it to preserve the operating record.`,
          ))
          return
        }
        throw new Error('delete_failed')
      }
      setCampaigns((prev) => prev.filter((campaign) => campaign.id !== id))
      setDecisionCampaign(null)
    } catch {
      setDecisionError(copy('تعذر حذف الحملة. لم تُحذف أي بيانات.', 'Could not delete the campaign. No data was deleted.'))
    } finally {
      setDeletingId(null)
    }
  }

  const summary = useMemo(() => {
    const total = counts?.total ?? campaigns.length
    const active = counts?.active ?? campaigns.filter((campaign) => campaign.status === 'ACTIVE').length
    const draft = counts?.draft ?? campaigns.filter((campaign) => campaign.status === 'DRAFT').length
    const completed = campaigns.filter((campaign) => campaign.status === 'COMPLETED').length
    const archived = campaigns.filter((campaign) => campaign.status === 'ARCHIVED').length
    const health = total > 0 ? Math.round(((active + completed) / total) * 100) : 0
    return { total, active, draft, completed, archived, health }
  }, [campaigns, counts])

  const platformDistribution = useMemo(() => {
    const totals = new Map<string, number>()
    let campaignsWithPlatforms = 0

    campaigns.forEach((campaign) => {
      const summary = getCampaignPlatformSummary(campaign.platforms, locale)
      if (!summary.isEmpty) campaignsWithPlatforms += 1
      summary.labels.forEach((label) => totals.set(label, (totals.get(label) || 0) + 1))
    })

    const assignments = Array.from(totals.values()).reduce((sum, count) => sum + count, 0)
    const entries = Array.from(totals.entries())
      .map(([label, count]) => ({
        label,
        count,
        percentage: assignments ? Math.round((count / assignments) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, 5)

    return {
      entries,
      coverage: campaigns.length ? Math.round((campaignsWithPlatforms / campaigns.length) * 100) : 0,
    }
  }, [campaigns, locale])

  const goalDistribution = useMemo(() => {
    const totals = new Map<string, number>()
    campaigns.forEach((campaign) => {
      const key = campaign.goal?.trim()
      if (key) totals.set(key, (totals.get(key) || 0) + 1)
    })

    return Array.from(totals.entries())
      .map(([goal, count]) => ({
        label: goalMap[goal] || goal,
        count,
        percentage: campaigns.length ? Math.round((count / campaigns.length) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, 3)
  }, [campaigns, goalMap])

  const campaignBriefCoverage = useMemo(() => {
    if (!campaigns.length) return 0
    const completedFields = campaigns.reduce((total, campaign) => {
      return total
        + Number(Boolean(campaign.name?.trim()))
        + Number(Boolean(campaign.description?.trim()))
        + Number(Boolean(campaign.goal?.trim()))
        + Number(Boolean(campaign.platforms?.length))
    }, 0)
    return Math.round((completedFields / (campaigns.length * 4)) * 100)
  }, [campaigns])

  const dateLocale = locale === 'ar' ? 'ar-EG' : 'en-US'
  const latestCampaign = campaigns[0]
  const latestCampaignStrategyHref = latestCampaign ? `/campaigns/${latestCampaign.id}?tab=strategy` : '/campaigns/new'
  const latestCampaignContentHref = latestCampaign ? `/campaigns/${latestCampaign.id}/content-hub` : '/content-hub'

  const exportCampaigns = () => {
    if (!campaigns.length) return
    const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
    const rows = campaigns.map((campaign) => [
      campaign.name,
      goalMap[campaign.goal] || campaign.goal,
      statusMap[campaign.status]?.label || campaign.status,
      campaign.platforms.join(' | '),
      campaign.favorite ? copy('نعم', 'Yes') : copy('لا', 'No'),
      new Date(campaign.createdAt).toLocaleString(dateLocale),
      new Date(campaign.updatedAt).toLocaleString(dateLocale),
    ])
    const header = [
      copy('الحملة', 'Campaign'),
      copy('الهدف', 'Goal'),
      copy('الحالة', 'Status'),
      copy('المنصات', 'Platforms'),
      copy('مفضلة', 'Favorite'),
      copy('تاريخ الإنشاء', 'Created at'),
      copy('آخر تحديث', 'Last updated'),
    ]
    const csv = [header, ...rows].map(row => row.map(escapeCsv).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `nexus-campaigns-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <AppShell>
      <main dir={ar ? 'rtl' : 'ltr'} className="nx-os-page">
        <div className="nx-os-container">
          <LuxuryWorkspaceHeader
            pageTitle={copy('الحملات', 'Campaigns')}
            pageSubtitle={copy('محفظة الحملات: النطاق، المرحلة، الجاهزية، والقرار التالي. الإنتاج التفصيلي يعيش داخل Content Hub.', 'Campaign portfolio: scope, stage, readiness, and next decision. Detailed production lives inside Content Hub.')}
            primaryHref="/campaigns/new"
            primaryLabel={cT?.btnNewCampaign || copy('حملة جديدة', 'New campaign')}
            secondaryHref="/connections"
            secondaryLabel={copy('الربط والتكاملات', 'Connections')}
          />

          <div className="nx-os-action-strip mb-4">
            <div className="min-w-0">
              <p className="nx-os-section-title">{copy(`${summary.total} حملة في مساحة العمل`, `${summary.total} campaigns in this workspace`)}</p>
              <p className="nx-os-section-copy">
                {copy(
                  `${summary.active} معتمدة و${summary.draft} تحتاج مراجعة.`,
                  `${summary.active} approved and ${summary.draft} need review.`,
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={load}
                className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-[#e3e8f3] bg-white text-[#53617f] transition hover:border-[#cbd4ff]"
                aria-label={copy('تحديث الحملات', 'Refresh campaigns')}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={exportCampaigns}
                disabled={loading || campaigns.length === 0}
                className="flex h-10 items-center gap-2 rounded-[10px] border border-[#e3e8f3] bg-white px-3 text-[12px] font-bold text-[#111b3f] transition hover:border-[#cbd4ff] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {copy('تصدير CSV', 'Export CSV')}
                <Download size={15} />
              </button>
            </div>
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-3 rounded-[16px] border border-[#e3e8f3] bg-white p-3">
            <div className="relative min-w-[240px] flex-1">
              <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aa5bb]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={cT?.searchPlaceholder || copy('ابحث باسم الحملة أو الهدف', 'Search by campaign or goal')}
                className="h-10 w-full rounded-[12px] border border-[#e3e8f3] bg-[#fbfcff] px-11 text-sm font-semibold text-[#111b3f] outline-none transition focus:border-[#b8c2ff]"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-10 rounded-[13px] border border-[#e3e8f3] bg-white px-4 text-sm font-semibold text-[#53617f] outline-none"
            >
              <option value="">{cT?.filterAll || copy('كل الحالات', 'All statuses')}</option>
              {Object.entries(statusMap).map(([value, status]) => (
                <option key={value} value={value}>{status.label}</option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as 'createdAt' | 'updatedAt' | 'name')}
              className="h-10 rounded-[13px] border border-[#e3e8f3] bg-white px-4 text-sm font-semibold text-[#53617f] outline-none"
            >
              <option value="updatedAt">{cT?.sortNewest || copy('آخر تحديث', 'Recently updated')}</option>
              <option value="createdAt">{cT?.sortOldest || copy('تاريخ الإنشاء', 'Created date')}</option>
              <option value="name">{cT?.sortName || copy('الاسم', 'Name')}</option>
            </select>
            <button
              type="button"
              onClick={() => setFavoriteOnly((value) => !value)}
              className={`flex h-10 items-center gap-2 rounded-[13px] border px-4 text-sm font-semibold transition ${
                favoriteOnly ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-[#e3e8f3] bg-white text-[#53617f]'
              }`}
            >
              <Star size={15} />
              {cT?.btnFavorites || copy('المفضلة', 'Favorites')}
            </button>
          </div>

          <div className="hidden">
            <MetricCard title={copy('إجمالي الحملات', 'Total campaigns')} value={String(summary.total)} helper={copy('كل الحملات المحفوظة', 'All saved campaigns')} icon={<FolderKanban size={18} />} />
            <MetricCard title={copy('استراتيجيات معتمدة', 'Approved strategies')} value={String(summary.active)} helper={copy('اعتماد سير عمل، وليس دليلاً على نشر أو صرف', 'Workflow approval, not proof of publishing or spend')} icon={<BadgeCheck size={18} />} />
            <MetricCard title={copy('المسودات', 'Drafts')} value={String(summary.draft)} helper={copy('تحتاج إكمال أو مراجعة', 'Need completion or review')} icon={<Wand2 size={18} />} />
            <MetricCard title={copy('المكتملة', 'Completed')} value={String(summary.completed)} helper={copy('أغلقت أو اكتملت', 'Closed or completed')} icon={<Target size={18} />} />
            <MetricCard title={copy('المؤرشفة', 'Archived')} value={String(summary.archived)} helper={copy('مخفية من التشغيل اليومي', 'Hidden from daily operation')} icon={<Archive size={18} />} />
            <MetricCard title="Brand Brain" value={summary.total ? copy('سياق متاح', 'Context available') : copy('ينتظر', 'Waiting')} helper={copy('يُراجع الارتباط الفعلي داخل كل حملة، وليس من رقم أداء افتراضي.', 'Actual linkage is reviewed per campaign, not inferred from a performance score.')} icon={<Sparkles size={18} />} />
          </div>

          <section className="hidden">
            {[
              {
                title: copy('١. اختر الحملة', '1. Choose campaign'),
                body: copy('الحملات هي محفظة العمل: الهدف، النطاق، المرحلة، والمخاطر.', 'Campaigns are the portfolio layer: goal, scope, stage, and risks.'),
                href: '/campaigns',
                label: copy('ابقَ في المحفظة', 'Stay in portfolio'),
              },
              {
                title: copy('٢. راجع الاستراتيجية', '2. Review strategy'),
                body: copy('الاستراتيجية تحدد الاتجاه، الجمهور، التنفيذ، القياس، والقيود.', 'Strategy sets direction, audience, execution, measurement, and limits.'),
                href: latestCampaignStrategyHref,
                label: copy('فتح الاستراتيجية', 'Open strategy'),
              },
              {
                title: copy('٣. أنتج في Content Hub', '3. Produce in Content Hub'),
                body: copy('المحتوى والوسائط النهائية ومراجعة المنشورات تعيش هناك فقط.', 'Final posts, media decisions, and post reviews live there only.'),
                href: latestCampaignContentHref,
                label: copy('فتح الإنتاج', 'Open production'),
              },
              {
                title: copy('٤. نفّذ بعد الجاهزية', '4. Execute after readiness'),
                body: copy('النشر أو المدفوع يحتاج حسابات، صلاحيات، موافقة، وحدود تكلفة واضحة.', 'Publishing or paid execution needs accounts, permissions, approval, and clear cost boundaries.'),
                href: '/connections',
                label: copy('فحص الربط', 'Check connections'),
              },
            ].map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="nx-os-card nx-os-card-interactive group p-4"
              >
                <p className="text-[13px] font-black text-[#071236]">{item.title}</p>
                <p className="mt-2 min-h-[44px] text-[12px] leading-5 text-[#687692]">{item.body}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-black text-[#4f46e5]">
                  {item.label}
                  <ArrowUpRight size={13} className="transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </section>

          {loadError && campaigns.length === 0 && (
            <div className="mb-5 rounded-[18px] border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {cT?.loadErrorMsg || copy('تعذر تحميل الحملات. جرّب التحديث.', 'Could not load campaigns. Try refreshing.')}
            </div>
          )}

          <div className="grid grid-cols-12 items-start gap-5">
            <section className="hidden">
              <h2 className="mb-4 flex items-center justify-between text-[15px] font-black text-[#111b3f]">
                {copy('تقدم محفظة الحملات', 'Campaign portfolio progress')}
                <Sparkles size={18} className="text-[#4f46e5]" />
              </h2>
              <Donut value={summary.health} label={copy('معتمدة أو مكتملة', 'Approved or complete')} />
              <div className="mt-5 space-y-2">
                {[
                  [copy('استراتيجية معتمدة', 'Strategy approved'), summary.active, 'bg-emerald-500'],
                  [copy('تحتاج مراجعة', 'Needs review'), summary.draft, 'bg-amber-500'],
                  [copy('مكتملة', 'Completed'), summary.completed, 'bg-blue-500'],
                  [copy('مؤرشفة', 'Archived'), summary.archived, 'bg-slate-300'],
                ].map(([label, value, dot]) => (
                  <div key={String(label)} className="flex items-center justify-between rounded-[12px] bg-[#fbfcff] px-3 py-2 text-sm">
                    <span className="flex items-center gap-2 text-[#53617f]"><span className={`h-2 w-2 rounded-full ${dot}`} />{label}</span>
                    <span className="font-black text-[#111b3f]">{value}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="hidden">
              <h2 className="mb-4 text-[15px] font-black text-[#111b3f]">{copy('توزيع المنصات', 'Platform mix')}</h2>
              <Donut value={platformDistribution.coverage} label={copy('تغطية الحملات', 'Campaign coverage')} />
              <div className="mt-4 space-y-2">
                {platformDistribution.entries.map((platform) => (
                  <div key={platform.label} className="flex items-center justify-between text-sm">
                    <span className="text-[#53617f]">{platform.label}</span>
                    <span className="font-bold text-[#111b3f]">{platform.percentage}%</span>
                  </div>
                ))}
                {!platformDistribution.entries.length ? (
                  <p className="rounded-[12px] bg-[#fbfcff] px-3 py-3 text-xs leading-5 text-[#7b87a3]">
                    {copy('لا توجد منصات محفوظة في بريفات الحملات بعد.', 'No platforms are saved in campaign briefs yet.')}
                  </p>
                ) : null}
              </div>
              <p className="mt-4 text-xs leading-5 text-[#7b87a3]">
                {copy('هذا توزيع تخطيطي من إعدادات الحملات وليس إنفاقاً فعلياً.', 'This is a planning mix from campaign setup, not actual spend.')}
              </p>
            </section>

            <section className="hidden">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[15px] font-black text-[#111b3f]">{copy('أهداف الحملات', 'Campaign goals')}</h2>
                <Link href="/strategy" className="text-xs font-bold text-[#4f46e5]">{copy('عرض منطق الاستراتيجية', 'View strategy logic')}</Link>
              </div>
              <div className="space-y-3">
                {goalDistribution.map((goal) => (
                  <div key={goal.label} className="grid grid-cols-[1fr_120px] items-center gap-3 rounded-[14px] border border-[#edf1f8] bg-[#fbfcff] px-4 py-3">
                    <span className="text-sm font-bold text-[#111b3f]">{goal.label}</span>
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e8edf7]">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#4f46e5] to-[#63a4ff]" style={{ width: `${goal.percentage}%` }} />
                      </div>
                      <span className="w-8 text-end text-[11px] font-black text-[#53617f]">{goal.percentage}%</span>
                    </div>
                  </div>
                ))}
                {!goalDistribution.length ? (
                  <p className="rounded-[14px] border border-[#edf1f8] bg-[#fbfcff] px-4 py-4 text-xs leading-5 text-[#7b87a3]">
                    {copy('لا توجد أهداف حملات محفوظة بعد.', 'No campaign goals are saved yet.')}
                  </p>
                ) : null}
              </div>
              <p className="mt-4 text-xs text-[#7b87a3]">
                {copy('الأهداف هنا للتنظيم والمراجعة، ولا تعني نتائج أداء منشورة.', 'Goals here organize review and do not imply published performance results.')}
              </p>
            </section>

            <aside className="hidden">
              <section className="nx-os-card p-5">
                <h2 className="mb-4 flex items-center gap-2 text-[15px] font-black text-[#111b3f]">
                  <Sparkles size={18} className="text-[#4f46e5]" />
                  {copy('الخطوة التالية الموصى بها', 'Recommended next step')}
                </h2>
                <div className="rounded-[18px] border border-[#e5eaf5] bg-[#fbfcff] p-4 text-center">
                  <p className="text-sm font-black text-[#111b3f]">{copy('راجع حملة واحدة حتى النهاية', 'Review one campaign end to end')}</p>
                  <p className="mt-2 text-xs leading-5 text-[#6f7c98]">
                    {copy('افتح الحملة الأحدث وتحقق من الاستراتيجية، المحتوى، الإبداع، والنشر قبل أي تشغيل.', 'Open the latest campaign and check strategy, content, creative, and publishing before execution.')}
                  </p>
                  <Link href={latestCampaignStrategyHref} className="mt-4 flex h-10 items-center justify-center rounded-[13px] bg-[#071236] text-sm font-bold text-white">
                    {copy('فتح المسار المقترح', 'Open suggested path')}
                  </Link>
                </div>
              </section>

            </aside>

            <section className="nx-os-card col-span-12 p-5">
              <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-[15px] font-black text-[#111b3f]">{copy('قائمة الحملات', 'Campaign list')}</h2>
                  <p className="mt-1 text-xs text-[#7b87a3]">{copy('اختر حملة لمراجعة الاستراتيجية والقرار التالي.', 'Choose a campaign to review its strategy and next decision.')}</p>
                </div>
                <p className="text-xs font-semibold text-[#7b87a3]">
                  {copy(`عرض ${campaigns.length} حملة`, `Showing ${campaigns.length} campaigns`)}
                </p>
              </div>

              {loading ? (
                <div className="flex min-h-[340px] items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-[#4f46e5]" />
                </div>
              ) : loadError && campaigns.length === 0 ? (
                <div className="rounded-[18px] border border-rose-100 bg-rose-50 p-8 text-center text-sm font-semibold text-rose-700">
                  {copy('لا يمكن تأكيد حالة الحملات الآن بسبب خطأ تحميل.', 'Campaign state cannot be confirmed because loading failed.')}
                </div>
              ) : campaigns.length === 0 ? (
                <div className="rounded-[18px] border border-dashed border-[#d5dded] bg-[#fbfcff] p-10 text-center">
                  <FolderKanban className="mx-auto mb-4 h-12 w-12 text-[#a5b0c6]" />
                  <h3 className="text-lg font-black text-[#111b3f]">{search || statusFilter ? cT?.emptyNoResults : cT?.emptyNoCampaigns}</h3>
                  <p className="mt-2 text-sm text-[#7b87a3]">{search || statusFilter ? cT?.emptyNoResultsDesc : cT?.emptyNoCampaignsDesc}</p>
                  {!search && !statusFilter && (
                    <Link href="/campaigns/new" className="mt-5 inline-flex h-11 items-center gap-2 rounded-[14px] bg-[#071236] px-5 text-sm font-bold text-white">
                      <Plus size={16} />
                      {cT?.btnNewCampaign || copy('حملة جديدة', 'New campaign')}
                    </Link>
                  )}
                </div>
              ) : (
                <div className="overflow-hidden rounded-[18px] border border-[#edf1f8]">
                  <div className="grid grid-cols-[minmax(260px,1.8fr)_120px_120px_170px_120px_80px] gap-0 bg-[#fbfcff] px-4 py-3 text-[11px] font-black uppercase tracking-[0.08em] text-[#7b87a3] max-xl:hidden">
                    <span>{copy('الحملة', 'Campaign')}</span>
                    <span>{copy('الحالة', 'Status')}</span>
                    <span>{copy('المرحلة', 'Stage')}</span>
                    <span>{copy('المنصات', 'Platforms')}</span>
                    <span>{copy('آخر تحديث', 'Updated')}</span>
                    <span />
                  </div>
                  <div className="divide-y divide-[#edf1f8]">
                    {campaigns.map((campaign) => {
                      const status = statusMap[campaign.status] || statusMap.DRAFT
                      const platforms = getCampaignPlatformSummary(campaign.platforms, locale)
                      return (
                        <div key={campaign.id} className="grid grid-cols-1 gap-3 px-4 py-4 transition hover:bg-[#fbfcff] xl:grid-cols-[minmax(260px,1.8fr)_120px_120px_170px_120px_80px] xl:items-center">
                          <Link href={`/campaigns/${campaign.id}?tab=strategy`} className="flex min-w-0 items-center gap-3">
                            <span className="flex h-14 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-gradient-to-br from-[#eef2ff] to-[#dbeafe] text-2xl">
                              {campaign.thumbnail || '🎯'}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-black text-[#111b3f]">{campaign.name}</span>
                              <span className="mt-1 block truncate text-xs text-[#7b87a3]">{campaign.description || goalMap[campaign.goal] || campaign.goal}</span>
                            </span>
                          </Link>
                          <span className={`inline-flex w-max items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${status.pill}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                            {status.label}
                          </span>
                          <span className="w-max rounded-full bg-[#f3f1ff] px-3 py-1 text-xs font-bold text-[#4f46e5]">
                            {campaign.status === 'ACTIVE' ? copy('اعتماد', 'Approved') : campaign.status === 'DRAFT' ? copy('تخطيط', 'Plan') : copy('مراجعة', 'Review')}
                          </span>
                          <span className="flex flex-wrap gap-1">
                            {platforms.isEmpty ? (
                              <span className="text-xs font-semibold text-[#9aa5bb]">{platforms.emptyLabel}</span>
                            ) : platforms.labels.slice(0, 3).map((label) => (
                              <span key={label} className="rounded-md bg-[#f4f7fb] px-2 py-1 text-[11px] font-bold text-[#53617f]">{label}</span>
                            ))}
                          </span>
                          <span className="text-xs font-semibold text-[#7b87a3]">
                            {new Date(campaign.updatedAt || campaign.createdAt).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' })}
                          </span>
                          <div className="relative justify-self-start xl:justify-self-end" ref={openMenuId === campaign.id ? menuRef : undefined}>
                            <button
                              type="button"
                              onClick={() => setOpenMenuId((value) => value === campaign.id ? null : campaign.id)}
                              disabled={deletingId === campaign.id}
                              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#e3e8f3] bg-white text-[#53617f] transition hover:border-[#cbd4ff]"
                            >
                              {deletingId === campaign.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal size={16} />}
                            </button>
                            {openMenuId === campaign.id && (
                              <div className="absolute end-0 top-full z-50 mt-2 w-40 overflow-hidden rounded-[16px] border border-[#e3e8f3] bg-white shadow-[0_22px_50px_rgba(13,24,63,0.16)]">
                                <button type="button" onClick={() => router.push(`/campaigns/${campaign.id}?tab=strategy`)} className="flex w-full items-center gap-2 px-4 py-3 text-xs font-bold text-[#53617f] hover:bg-[#fbfcff]">
                                  <ArrowUpRight size={14} />
                                  {cT?.menuOpen || copy('فتح', 'Open')}
                                </button>
                                <button type="button" onClick={() => toggleFavorite(campaign.id, campaign.favorite)} disabled={togglingId === campaign.id} className="flex w-full items-center gap-2 px-4 py-3 text-xs font-bold text-[#53617f] hover:bg-[#fbfcff]">
                                  <Star size={14} />
                                  {campaign.favorite ? copy('إزالة من المفضلة', 'Unfavorite') : cT?.btnFavorites || copy('المفضلة', 'Favorite')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null)
                                    setDecisionError('')
                                    setDecisionCampaign({ id: campaign.id, name: campaign.name, kind: 'archive' })
                                  }}
                                  className="flex w-full items-center gap-2 px-4 py-3 text-xs font-bold text-[#53617f] hover:bg-[#fbfcff]"
                                >
                                  <Archive size={14} />
                                  {cT?.menuArchive || copy('أرشفة', 'Archive')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null)
                                    setDecisionError('')
                                    setDecisionCampaign({ id: campaign.id, name: campaign.name, kind: 'delete' })
                                  }}
                                  className="flex w-full items-center gap-2 px-4 py-3 text-xs font-bold text-rose-500 hover:bg-rose-50"
                                >
                                  <Trash2 size={14} />
                                  {cT?.menuDelete || copy('حذف', 'Delete')}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </section>

            <aside className="hidden">
              <section className="nx-os-card p-5">
                <h2 className="mb-4 text-[15px] font-black text-[#111b3f]">{copy('معلومات ذكية من NEXUS', 'NEXUS intelligence')}</h2>
                <div className="space-y-3">
                  {[
                    copy('وقت النشر المقترح يظهر بعد ربط المنصات ووجود بيانات.', 'A suggested posting time appears after platform data exists.'),
                    copy('فرص المحتوى تعتمد على الاستراتيجية وسجلات Content Hub.', 'Content opportunities depend on strategy and Content Hub records.'),
                    copy('تعلم الأداء يتطلب analyticsData حقيقية.', 'Performance learning requires real analyticsData.'),
                  ].map((note) => (
                    <div key={note} className="rounded-[14px] border border-[#edf1f8] bg-[#fbfcff] p-3 text-xs leading-5 text-[#5f6d89]">
                      {note}
                    </div>
                  ))}
                </div>
              </section>

              <section className="nx-os-card p-5">
                <h2 className="mb-4 text-[15px] font-black text-[#111b3f]">{copy('تغطية بريف الحملة', 'Campaign brief coverage')}</h2>
                <Donut value={campaignBriefCoverage} label={copy('حقول محفوظة', 'Fields saved')} />
                <p className="mt-4 text-center text-xs leading-5 text-[#7b87a3]">
                  {copy('تقيس اكتمال الاسم والوصف والهدف والمنصات في الحملات المحملة؛ وليست نتيجة أداء أو ادعاء محاذاة دلالية.', 'Measures saved campaign name, description, goal, and platforms; it is not performance or a semantic-alignment claim.')}
                </p>
              </section>

              <section className="nx-os-card p-5">
                <h2 className="mb-4 flex items-center gap-2 text-[15px] font-black text-[#111b3f]">
                  <Info size={17} className="text-[#4f46e5]" />
                  {copy('حدود الحقيقة', 'Truth boundary')}
                </h2>
                <div className="space-y-3 text-xs leading-5 text-[#60708f]">
                  <p>{copy('لا تظهر نتائج أداء أو ROAS هنا قبل وجود تحليلات حقيقية.', 'No ROAS or performance claims appear before real analytics exists.')}</p>
                  <p>{copy('إنشاء حملة لا يعني نشرها أو تشغيل إعلانات.', 'Creating a campaign does not publish it or launch ads.')}</p>
                  <p>{copy('Content Hub هو مساحة إنتاج المنشورات؛ هذه الصفحة مساحة قيادة واختيار الحملة.', 'Content Hub is the post production workspace; this page is the campaign command and selection layer.')}</p>
                  <p>{copy('النشر والمدفوعات تحتاج موافقة وجاهزية منصة منفصلة.', 'Publishing and paid execution require separate approval and platform readiness.')}</p>
                </div>
              </section>
            </aside>
          </div>
        </div>

        {decisionCampaign && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#071236]/45 p-4 backdrop-blur-sm" role="presentation">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="campaign-decision-title"
              className="w-full max-w-lg rounded-[18px] border border-white/70 bg-white p-6 shadow-[0_30px_90px_rgba(7,18,54,0.28)]"
            >
              <div className="flex items-start justify-between gap-4">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] ${decisionCampaign.kind === 'delete' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-700'}`}>
                  {decisionCampaign.kind === 'delete' ? <Trash2 size={20} /> : <Archive size={20} />}
                </span>
                <button
                  type="button"
                  aria-label={copy('إغلاق', 'Close')}
                  onClick={() => { setDecisionCampaign(null); setDecisionError('') }}
                  disabled={deletingId === decisionCampaign.id}
                  className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#e3e8f3] text-[#64748b] disabled:opacity-40"
                >
                  <X size={17} />
                </button>
              </div>

              <h2 id="campaign-decision-title" className="mt-5 text-xl font-black text-[#071236]">
                {decisionCampaign.kind === 'delete'
                  ? copy('حذف الحملة نهائيًا؟', 'Permanently delete campaign?')
                  : copy('أرشفة الحملة؟', 'Archive campaign?')}
              </h2>
              <p className="mt-2 text-sm font-bold text-[#334155]">{decisionCampaign.name}</p>
              <p className="mt-3 text-sm leading-6 text-[#64748b]">
                {decisionCampaign.kind === 'delete'
                  ? copy('هذا حذف دائم للحملة وسجلها المرتبط. لا علاقة له بإيقاف إعلان على منصة خارجية، ولا يمكن التراجع عنه من الواجهة.', 'This permanently deletes the campaign and its related record. It does not stop any external platform ad, and it cannot be undone from this interface.')
                  : copy('ستخرج الحملة من محفظة العمل اليومية مع الاحتفاظ ببياناتها. الأرشفة لا توقف نشرًا أو إعلانًا على منصة خارجية.', 'The campaign leaves the daily portfolio while its data is retained. Archiving does not stop publishing or ads on an external platform.')}
              </p>

              <div className="mt-4 flex items-start gap-2 rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-900">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                {copy('راجع الحسابات والمنصات المتصلة بشكل منفصل قبل تغيير أي تشغيل خارجي.', 'Review connected accounts and platforms separately before changing any external execution.')}
              </div>

              {decisionError && (
                <p className="mt-4 rounded-[12px] border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{decisionError}</p>
              )}

              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => { setDecisionCampaign(null); setDecisionError('') }}
                  disabled={deletingId === decisionCampaign.id}
                  className="h-11 flex-1 rounded-[12px] border border-[#dfe5f0] bg-white text-sm font-black text-[#53617f] disabled:opacity-40"
                >
                  {copy('إلغاء', 'Cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => decisionCampaign.kind === 'delete'
                    ? deleteCampaign(decisionCampaign.id)
                    : archiveCampaign(decisionCampaign.id)}
                  disabled={deletingId === decisionCampaign.id}
                  className={`flex h-11 flex-[1.4] items-center justify-center gap-2 rounded-[12px] text-sm font-black text-white disabled:opacity-55 ${decisionCampaign.kind === 'delete' ? 'bg-rose-600' : 'bg-[#071236]'}`}
                >
                  {deletingId === decisionCampaign.id ? <Loader2 size={16} className="animate-spin" /> : null}
                  {decisionCampaign.kind === 'delete' ? copy('تأكيد الحذف الدائم', 'Confirm permanent delete') : copy('تأكيد الأرشفة', 'Confirm archive')}
                </button>
              </div>
            </section>
          </div>
        )}
      </main>
    </AppShell>
  )
}
