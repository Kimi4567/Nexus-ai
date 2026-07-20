'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Coins,
  Gauge,
  Loader2,
  LockKeyhole,
  Megaphone,
  PauseCircle,
  PlugZap,
  RefreshCw,
  Route,
  ShieldCheck,
  Workflow,
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import type { ExecutionPriority, ExecutionStage } from '@/lib/executionTruth'
import type { OperationsHealth, OperationsIssue, OperationsOverview } from '@/lib/operationsOverview'

type QueueFilter = 'all' | 'critical' | 'approval' | 'monitor'

const PRIORITY_LABELS: Record<ExecutionPriority, { ar: string; en: string }> = {
  critical: { ar: 'حرجة', en: 'Critical' },
  high: { ar: 'عالية', en: 'High' },
  medium: { ar: 'متوسطة', en: 'Medium' },
  low: { ar: 'منخفضة', en: 'Low' },
}

const STAGE_LABELS: Record<ExecutionStage, { ar: string; en: string }> = {
  ARCHIVED: { ar: 'مؤرشفة', en: 'Archived' },
  PAUSED: { ar: 'متوقفة', en: 'Paused' },
  STRATEGY_REQUIRED: { ar: 'استراتيجية مطلوبة', en: 'Strategy required' },
  STRATEGY_REVIEW: { ar: 'مراجعة الاستراتيجية', en: 'Strategy review' },
  CONTENT_PLANNING: { ar: 'تخطيط المحتوى', en: 'Content planning' },
  CONTENT_REVIEW: { ar: 'مراجعة المحتوى', en: 'Content review' },
  MEDIA_REVIEW: { ar: 'مراجعة الوسائط', en: 'Media review' },
  SCHEDULING: { ar: 'الجدولة', en: 'Scheduling' },
  IN_FLIGHT: { ar: 'قيد التنفيذ', en: 'In flight' },
  LEARNING: { ar: 'جمع الأدلة', en: 'Evidence collection' },
  OPTIMIZING: { ar: 'التحسين', en: 'Optimizing' },
  NEEDS_ATTENTION: { ar: 'يحتاج انتباهًا', en: 'Needs attention' },
}

const SOURCE_LABELS: Record<OperationsIssue['source'], { ar: string; en: string }> = {
  monitor: { ar: 'المراقب', en: 'Monitor' },
  execution: { ar: 'التنفيذ', en: 'Execution' },
  connection: { ar: 'الربط', en: 'Connection' },
  paid: { ar: 'الإعلانات', en: 'Paid' },
  analytics: { ar: 'القياس', en: 'Analytics' },
  credits: { ar: 'الكريديت', en: 'Credits' },
}

function formatDate(value: string | null, ar: boolean): string {
  if (!value) return ar ? 'لا يوجد سجل بعد' : 'No record yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ar ? 'وقت غير صالح' : 'Invalid time'
  return new Intl.DateTimeFormat(ar ? 'ar-AE' : 'en-US', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function relativeFreshness(value: string | null, ar: boolean): string {
  if (!value) return ar ? 'لا توجد بيانات' : 'No data'
  const diff = Date.now() - new Date(value).getTime()
  if (!Number.isFinite(diff)) return ar ? 'وقت غير صالح' : 'Invalid time'
  const minutes = Math.max(0, Math.round(diff / 60_000))
  if (minutes < 1) return ar ? 'الآن' : 'Just now'
  if (minutes < 60) return ar ? `منذ ${minutes} دقيقة` : `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  return ar ? `منذ ${hours} ساعة` : `${hours}h ago`
}

function toneForHealth(health: OperationsHealth): string {
  if (health === 'healthy') return 'border-emerald-100 bg-emerald-50 text-emerald-700'
  if (health === 'critical') return 'border-rose-100 bg-rose-50 text-rose-700'
  if (health === 'attention') return 'border-amber-100 bg-amber-50 text-amber-700'
  return 'border-slate-200 bg-slate-50 text-slate-600'
}

function HealthCard({
  title,
  value,
  helper,
  icon,
  tone,
}: {
  title: string
  value: string
  helper: string
  icon: ReactNode
  tone: 'ready' | 'warning' | 'critical' | 'neutral'
}) {
  const iconTone = {
    ready: 'bg-emerald-50 text-emerald-600',
    warning: 'bg-amber-50 text-amber-600',
    critical: 'bg-rose-50 text-rose-600',
    neutral: 'bg-[#f1f4ff] text-[#5366f6]',
  }[tone]

  return (
    <article className="nx-os-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.1em] text-[#7c88a2]">{title}</p>
          <p className="mt-2 text-[25px] font-black tracking-[-0.04em] text-[#071236]">{value}</p>
          <p className="mt-2 text-[11px] font-semibold leading-5 text-[#7b87a3]">{helper}</p>
        </div>
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[16px] ${iconTone}`}>{icon}</span>
      </div>
    </article>
  )
}

function StatusRow({
  icon,
  title,
  detail,
  status,
  statusLabel,
  href,
  actionLabel,
}: {
  icon: ReactNode
  title: string
  detail: string
  status: OperationsHealth
  statusLabel: string
  href: string
  actionLabel: string
}) {
  return (
    <div className="grid gap-3 border-b border-[#edf1f7] py-4 last:border-b-0 md:grid-cols-[auto_1fr_auto_auto] md:items-center">
      <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#f3f5ff] text-[#5366f6]">{icon}</span>
      <div className="min-w-0">
        <p className="text-[12px] font-black text-[#111b3f]">{title}</p>
        <p className="mt-1 text-[10px] font-semibold leading-5 text-[#7b87a3]">{detail}</p>
      </div>
      <span className={`w-fit rounded-full border px-3 py-1.5 text-[9px] font-black ${toneForHealth(status)}`}>{statusLabel}</span>
      <Link href={href} className="inline-flex h-9 w-fit items-center gap-1.5 rounded-[11px] border border-[#dbe2f0] px-3 text-[10px] font-black text-[#5366f6]">
        {actionLabel}
        <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}

export default function OperationsCenterPage() {
  const { isAuthenticated, loading: authLoading, authHeader } = useAuth()
  const { locale, dir } = useI18n()
  const router = useRouter()
  const ar = locale === 'ar'
  const [overview, setOverview] = useState<OperationsOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<QueueFilter>('all')
  const [pauseConfirmationId, setPauseConfirmationId] = useState<string | null>(null)
  const [pausingId, setPausingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const requestRef = useRef<AbortController | null>(null)

  const copy = useCallback((arabic: string, english: string) => ar ? arabic : english, [ar])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace('/auth/login')
  }, [authLoading, isAuthenticated, router])

  const load = useCallback(async (quiet = false) => {
    if (!isAuthenticated) return
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    if (!quiet) setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/operations/overview', {
        headers: { Authorization: authHeader() },
        cache: 'no-store',
        signal: controller.signal,
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || !body.overview) throw new Error(body.error || 'Operations overview unavailable')
      setOverview(body.overview)
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return
      setError(loadError instanceof Error ? loadError.message : 'Operations overview unavailable')
    } finally {
      if (requestRef.current === controller) setLoading(false)
    }
  }, [authHeader, isAuthenticated])

  useEffect(() => {
    void load()
    const interval = window.setInterval(() => void load(true), 60_000)
    return () => {
      window.clearInterval(interval)
      requestRef.current?.abort()
    }
  }, [load])

  const pauseAutopilot = useCallback(async (campaignId: string) => {
    const token = authHeader()
    if (!token) return
    setPausingId(campaignId)
    setNotice(null)
    try {
      const response = await fetch(`/api/autopilot/queue?campaignId=${encodeURIComponent(campaignId)}`, {
        method: 'DELETE',
        headers: { Authorization: token },
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || copy('تعذر إيقاف التشغيل الآلي.', 'Automation could not be paused.'))
      setNotice({
        tone: 'success',
        text: copy(
          `تم إيقاف التشغيل الآلي وإرجاع ${body.unscheduled ?? 0} منشور إلى المراجعة اليدوية.`,
          `Automation paused; ${body.unscheduled ?? 0} posts returned to manual review.`,
        ),
      })
      setPauseConfirmationId(null)
      await load(true)
    } catch (pauseError) {
      setNotice({
        tone: 'error',
        text: pauseError instanceof Error ? pauseError.message : copy('تعذر إيقاف التشغيل الآلي.', 'Automation could not be paused.'),
      })
    } finally {
      setPausingId(null)
    }
  }, [authHeader, copy, load])

  const queue = useMemo(() => {
    const rows = overview?.execution.queue ?? []
    if (filter === 'critical') return rows.filter(item => item.priority === 'critical' || item.priority === 'high')
    if (filter === 'approval') return rows.filter(item => item.requiresApproval)
    if (filter === 'monitor') return rows.filter(item => item.safety === 'monitor_only')
    return rows
  }, [filter, overview?.execution.queue])

  const healthRows = useMemo(() => {
    if (!overview) return []
    const connectionHealth: OperationsHealth = overview.connections.attention > 0
      ? 'attention'
      : overview.connections.total > 0 ? 'healthy' : 'not_started'
    const analyticsHealth: OperationsHealth = overview.analytics.publishedAwaitingEvidence > 0
      ? 'attention'
      : overview.execution.publishedPosts > 0 ? 'healthy' : 'not_started'
    const paidHealth: OperationsHealth = overview.paid.budgetIncidents > 0
      ? 'critical'
      : overview.paid.staleSyncs > 0
        ? 'attention'
        : overview.paid.activeCampaigns > 0 ? 'healthy' : 'not_started'
    const creditHealth: OperationsHealth = overview.credits.unversionedCharges30d > 0 || overview.credits.chargesWithoutArtifact30d > 0
      ? 'attention'
      : overview.credits.transactions30d > 0 ? 'healthy' : 'not_started'

    return [
      {
        key: 'monitor', icon: <Activity className="h-5 w-5" />,
        title: copy('مراقب التنفيذ 24/7', '24/7 execution monitor'),
        detail: overview.monitor.lastRunAt
          ? copy(`آخر نبض محفوظ ${formatDate(overview.monitor.lastRunAt, true)}. التشغيل القادم ${formatDate(overview.monitor.nextRunAt, true)}.`, `Last persisted heartbeat ${formatDate(overview.monitor.lastRunAt, false)}. Next run ${formatDate(overview.monitor.nextRunAt, false)}.`)
          : copy('لا يوجد نبض محفوظ بعد؛ لن نعرضه كتشغيل نشط.', 'No heartbeat is stored yet, so it is not presented as active.'),
        status: overview.monitor.health,
        statusLabel: overview.monitor.health === 'healthy' ? copy('يعمل', 'Healthy') : overview.monitor.health === 'not_started' ? copy('لم يبدأ', 'Not started') : copy('يحتاج انتباهًا', 'Needs attention'),
        href: '/operations', actionLabel: copy('التفاصيل', 'Details'),
      },
      {
        key: 'connections', icon: <PlugZap className="h-5 w-5" />,
        title: copy('اتصالات النشر والإعلانات', 'Publishing and ads connections'),
        detail: copy(`نشر ${overview.connections.social.connected}/${overview.connections.social.total} · إعلانات ${overview.connections.ads.connected}/${overview.connections.ads.total}`, `Publishing ${overview.connections.social.connected}/${overview.connections.social.total} · Ads ${overview.connections.ads.connected}/${overview.connections.ads.total}`),
        status: connectionHealth,
        statusLabel: connectionHealth === 'healthy' ? copy('متصلة', 'Connected') : connectionHealth === 'not_started' ? copy('غير مهيأة', 'Not configured') : copy('تحتاج إصلاحًا', 'Needs repair'),
        href: '/connections', actionLabel: copy('إدارة الربط', 'Manage'),
      },
      {
        key: 'analytics', icon: <BarChart3 className="h-5 w-5" />,
        title: copy('دليل التحليلات', 'Analytics evidence'),
        detail: overview.analytics.latestEvidenceAt
          ? copy(`آخر دليل مؤهل ${formatDate(overview.analytics.latestEvidenceAt, true)}؛ ${overview.analytics.publishedAwaitingEvidence} منشور ينتظر الدليل.`, `Latest eligible evidence ${formatDate(overview.analytics.latestEvidenceAt, false)}; ${overview.analytics.publishedAwaitingEvidence} published posts await evidence.`)
          : copy(`${overview.analytics.publishedAwaitingEvidence} منشور منشور ينتظر دليلًا مؤهلًا من المنصة.`, `${overview.analytics.publishedAwaitingEvidence} published posts await eligible provider evidence.`),
        status: analyticsHealth,
        statusLabel: analyticsHealth === 'healthy' ? copy('موثق', 'Verified') : analyticsHealth === 'not_started' ? copy('بانتظار النشر', 'Awaiting publish') : copy('دليل ناقص', 'Evidence missing'),
        href: '/analytics', actionLabel: copy('فتح القياس', 'Open'),
      },
      {
        key: 'paid', icon: <Megaphone className="h-5 w-5" />,
        title: copy('الإعلانات والحدود المالية', 'Paid delivery and budget guardrails'),
        detail: copy(`${overview.paid.activeCampaigns} حملة نشطة · ${overview.paid.reportedSpend.toFixed(2)} إنفاق مبلّغ · ${overview.paid.staleSyncs} مزامنة متأخرة`, `${overview.paid.activeCampaigns} active · ${overview.paid.reportedSpend.toFixed(2)} reported spend · ${overview.paid.staleSyncs} stale syncs`),
        status: paidHealth,
        statusLabel: paidHealth === 'healthy' ? copy('داخل الحدود', 'Within guardrails') : paidHealth === 'critical' ? copy('تجاوز مالي', 'Budget incident') : paidHealth === 'attention' ? copy('بيانات متأخرة', 'Stale data') : copy('لا إنفاق حي', 'No live spend'),
        href: '/paid-campaigns', actionLabel: copy('الحملات', 'Campaigns'),
      },
      {
        key: 'credits', icon: <Coins className="h-5 w-5" />,
        title: copy('سجل الكريديت والربحية', 'Credit and cost ledger'),
        detail: copy(`${overview.credits.spent30d} خُصمت و${overview.credits.refunded30d} استُردت خلال 30 يومًا.`, `${overview.credits.spent30d} spent and ${overview.credits.refunded30d} refunded in 30 days.`),
        status: creditHealth,
        statusLabel: creditHealth === 'healthy' ? copy('قابل للتتبع', 'Traceable') : creditHealth === 'attention' ? copy('تتبع ناقص', 'Traceability gap') : copy('لا معاملات', 'No transactions'),
        href: '/billing', actionLabel: copy('فتح السجل', 'Open ledger'),
      },
    ]
  }, [copy, overview])

  if (authLoading || (!isAuthenticated && !error)) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#5366f6]" />
        </div>
      </AppShell>
    )
  }

  const topAction = overview?.issues[0] ?? overview?.execution.queue[0]

  return (
    <AppShell>
      <main id="operations-center" dir={dir} className="nx-os-page">
        <div className="nx-os-container nx-os-stack">
          <LuxuryWorkspaceHeader
            journeyStage="execution"
            pageTitle={copy('مركز العمليات', 'Operations center')}
            pageSubtitle={copy('راقب التنفيذ، عالج الأعطال، واتخذ القرار التالي من لقطة واحدة موثقة.', 'Monitor execution, resolve incidents, and take the next decision from one verified snapshot.')}
            primaryHref={topAction?.href ?? '/approvals'}
            primaryLabel={topAction ? copy('نفّذ القرار الأول', 'Take top action') : copy('مراجعة الموافقات', 'Review approvals')}
            secondaryHref="/learning"
            secondaryLabel={copy('مركز التعلم', 'Learning center')}
          />

          <section className="nx-os-action-strip">
            <div className="flex min-w-0 items-center gap-3">
              <span className="nx-os-icon-box"><Workflow className="h-5 w-5" /></span>
              <div className="min-w-0">
                <p className="text-[12px] font-black text-[#111b3f]">{copy('لقطة تشغيل موحدة', 'Unified operations snapshot')}</p>
                <p className="mt-1 text-[10px] font-semibold text-[#7b87a3]">
                  {overview
                    ? copy(`حُدّثت ${relativeFreshness(overview.generatedAt, true)} · تحديث تلقائي كل دقيقة`, `Updated ${relativeFreshness(overview.generatedAt, false)} · refreshes every minute`)
                    : copy('جار تحميل الحقيقة التشغيلية', 'Loading operations truth')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-[13px] border border-[#dbe2f0] bg-white px-4 text-[11px] font-black text-[#5366f6] disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {copy('تحديث الآن', 'Refresh now')}
            </button>
          </section>

          {notice ? (
            <div role="status" className={`rounded-[16px] border px-4 py-3 text-[11px] font-bold ${notice.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
              {notice.text}
            </div>
          ) : null}

          {error ? (
            <section className="nx-os-card border-rose-100 p-8 text-center">
              <AlertTriangle className="mx-auto h-9 w-9 text-rose-500" />
              <p className="mt-3 text-[14px] font-black text-[#071236]">{copy('تعذر تحميل مركز العمليات', 'Operations center could not load')}</p>
              <p className="mt-2 text-[11px] font-semibold text-[#7b87a3]">{error}</p>
              <button type="button" onClick={() => void load()} className="mt-4 rounded-[13px] bg-[#071236] px-5 py-3 text-[11px] font-black text-white">{copy('إعادة المحاولة', 'Try again')}</button>
            </section>
          ) : (
            <>
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label={copy('صحة التشغيل', 'Operations health')}>
                <HealthCard
                  title={copy('نبض 24/7', '24/7 heartbeat')}
                  value={!overview ? '—' : overview.monitor.health === 'healthy' ? copy('يعمل', 'Healthy') : overview.monitor.health === 'not_started' ? copy('لم يبدأ', 'Not started') : copy('انتباه', 'Attention')}
                  helper={overview ? copy(`آخر تشغيل: ${formatDate(overview.monitor.lastRunAt, true)}`, `Last run: ${formatDate(overview.monitor.lastRunAt, false)}`) : copy('جار التحميل', 'Loading')}
                  tone={!overview ? 'neutral' : overview.monitor.health === 'healthy' ? 'ready' : overview.monitor.health === 'critical' ? 'critical' : 'warning'}
                  icon={<Activity className="h-5 w-5" />}
                />
                <HealthCard
                  title={copy('حوادث مثبتة', 'Verified incidents')}
                  value={overview ? String(overview.summary.incidents) : '—'}
                  helper={overview ? copy(`${overview.summary.critical} حرجة · ${overview.summary.attentionItems} عنصر انتباه`, `${overview.summary.critical} critical · ${overview.summary.attentionItems} attention items`) : copy('جار التحميل', 'Loading')}
                  tone={!overview ? 'neutral' : overview.summary.critical > 0 ? 'critical' : overview.summary.incidents > 0 ? 'warning' : 'ready'}
                  icon={<AlertTriangle className="h-5 w-5" />}
                />
                <HealthCard
                  title={copy('موافقات', 'Approvals')}
                  value={overview ? String(overview.summary.pendingApprovals) : '—'}
                  helper={overview ? copy(`${overview.summary.overdueApprovals} أقدم من 24 ساعة`, `${overview.summary.overdueApprovals} older than 24 hours`) : copy('جار التحميل', 'Loading')}
                  tone={!overview ? 'neutral' : overview.summary.overdueApprovals > 0 ? 'warning' : 'ready'}
                  icon={<LockKeyhole className="h-5 w-5" />}
                />
                <HealthCard
                  title={copy('حملات قيد التشغيل', 'Campaigns in motion')}
                  value={overview ? String(overview.execution.campaigns) : '—'}
                  helper={overview ? copy(`${overview.execution.needsAttention} تحتاج تدخلًا · ${overview.execution.scheduledPosts} مجدولة`, `${overview.execution.needsAttention} need intervention · ${overview.execution.scheduledPosts} scheduled`) : copy('جار التحميل', 'Loading')}
                  tone={!overview ? 'neutral' : overview.execution.needsAttention > 0 ? 'warning' : 'ready'}
                  icon={<Route className="h-5 w-5" />}
                />
              </section>

              <section className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
                <div className="nx-os-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-[17px] font-black text-[#071236]">{copy('القرار التالي', 'Next decision queue')}</h2>
                      <p className="mt-1 text-[11px] font-semibold text-[#7b87a3]">{copy('عنصر واحد لكل حملة، مرتب حسب الخطورة والحقيقة الحالية.', 'One next action per campaign, ordered by severity and current truth.')}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {([
                        ['all', copy('الكل', 'All')],
                        ['critical', copy('العاجل', 'Urgent')],
                        ['approval', copy('موافقة', 'Approval')],
                        ['monitor', copy('مراقبة', 'Monitor')],
                      ] as Array<[QueueFilter, string]>).map(([value, label]) => (
                        <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`rounded-full px-3 py-1.5 text-[9px] font-black ${filter === value ? 'bg-[#071236] text-white' : 'bg-[#f1f4f9] text-[#66728c]'}`}>{label}</button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    {loading && !overview ? [1, 2, 3].map(item => <div key={item} className="h-24 animate-pulse rounded-[18px] bg-[#eef2f8]" />) : queue.length ? queue.slice(0, 12).map(item => (
                      <article key={item.id} className="rounded-[18px] border border-[#e5ebf5] bg-[#fbfcff] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full px-2 py-1 text-[8px] font-black uppercase ${item.priority === 'critical' ? 'bg-rose-50 text-rose-700' : item.priority === 'high' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{ar ? PRIORITY_LABELS[item.priority].ar : PRIORITY_LABELS[item.priority].en}</span>
                              <span className="rounded-full bg-[#eef1ff] px-2 py-1 text-[8px] font-black text-[#5366f6]">{ar ? STAGE_LABELS[item.stage].ar : STAGE_LABELS[item.stage].en}</span>
                              {item.requiresApproval ? <span className="rounded-full bg-violet-50 px-2 py-1 text-[8px] font-black text-violet-700">{copy('قرار بشري', 'Human decision')}</span> : null}
                            </div>
                            <p className="mt-2 text-[10px] font-black uppercase tracking-[0.08em] text-[#8b96ab]">{item.campaignName}</p>
                            <h3 className="mt-1 text-[13px] font-black text-[#111b3f]">{ar ? item.title.ar : item.title.en}</h3>
                            <p className="mt-1 text-[10px] font-semibold leading-5 text-[#6f7b94]">{ar ? item.reason.ar : item.reason.en}</p>
                          </div>
                          <Link href={item.href} className="inline-flex h-9 items-center gap-1.5 rounded-[11px] bg-[#071236] px-3 text-[10px] font-black text-white">
                            {copy('تنفيذ', 'Open')}
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </article>
                    )) : (
                      <div className="rounded-[18px] border border-emerald-100 bg-emerald-50/70 p-6 text-center">
                        <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
                        <p className="mt-3 text-[12px] font-black text-emerald-900">{copy('لا يوجد قرار مطابق لهذا الفلتر', 'No decision matches this filter')}</p>
                        <p className="mt-1 text-[10px] font-semibold text-emerald-700">{copy('هذه لقطة حالية وليست وعدًا بعدم ظهور أعطال لاحقًا.', 'This is the current snapshot, not a promise that future incidents cannot occur.')}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-5">
                  <section className="nx-os-card p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-[17px] font-black text-[#071236]">{copy('صحة النظام', 'System health')}</h2>
                        <p className="mt-1 text-[10px] font-semibold text-[#7b87a3]">{copy('كل حالة مرتبطة بسجل فعلي أو معلّمة كغير مبدوءة.', 'Every state is evidence-backed or marked not started.')}</p>
                      </div>
                      <ShieldCheck className="h-5 w-5 text-[#5366f6]" />
                    </div>
                    <div className="mt-3">
                      {healthRows.map(({ key, ...row }) => <StatusRow key={key} {...row} />)}
                    </div>
                  </section>

                  <section className="nx-os-card p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-[17px] font-black text-[#071236]">{copy('خط الحملات', 'Campaign pipeline')}</h2>
                        <p className="mt-1 text-[10px] font-semibold text-[#7b87a3]">{copy('توزيع الحالات من مصدر التنفيذ نفسه.', 'Stage distribution from the same execution source.')}</p>
                      </div>
                      <Gauge className="h-5 w-5 text-[#5366f6]" />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {overview && Object.entries(overview.execution.stages).length ? Object.entries(overview.execution.stages).map(([stage, count]) => (
                        <span key={stage} className="rounded-[12px] border border-[#e1e7f1] bg-[#fafbfe] px-3 py-2 text-[9px] font-black text-[#53617f]">
                          {ar ? STAGE_LABELS[stage as ExecutionStage].ar : STAGE_LABELS[stage as ExecutionStage].en} · {count}
                        </span>
                      )) : <p className="text-[10px] font-semibold text-[#8792aa]">{copy('لا توجد حملات في مساحة العمل بعد.', 'No campaigns exist in this workspace yet.')}</p>}
                    </div>
                    {overview ? (
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <div className="rounded-[14px] bg-[#f7f9fd] p-3 text-center"><p className="text-[18px] font-black text-[#071236]">{overview.execution.awaitingApproval}</p><p className="text-[8px] font-black text-[#8792aa]">{copy('قرار حملة', 'Campaign decisions')}</p></div>
                        <div className="rounded-[14px] bg-[#f7f9fd] p-3 text-center"><p className="text-[18px] font-black text-[#071236]">{overview.execution.scheduledPosts}</p><p className="text-[8px] font-black text-[#8792aa]">{copy('مجدول', 'Scheduled')}</p></div>
                        <div className="rounded-[14px] bg-[#f7f9fd] p-3 text-center"><p className="text-[18px] font-black text-[#071236]">{overview.execution.publishedPosts}</p><p className="text-[8px] font-black text-[#8792aa]">{copy('منشور', 'Published')}</p></div>
                      </div>
                    ) : null}
                  </section>

                  <section className="nx-os-card p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-[17px] font-black text-[#071236]">{copy('أمان التشغيل الآلي', 'Automation safety')}</h2>
                        <p className="mt-1 text-[10px] font-semibold leading-5 text-[#7b87a3]">{copy('الإيقاف يعيد المنشورات المجدولة إلى مراجعة يدوية ولا يستهلك كريديت.', 'Pausing returns scheduled posts to manual review and consumes no credits.')}</p>
                      </div>
                      <PauseCircle className="h-5 w-5 text-[#5366f6]" />
                    </div>
                    <div className="mt-4 space-y-3">
                      {overview?.execution.autopilot.campaigns.length ? overview.execution.autopilot.campaigns.map(campaign => (
                        <article key={campaign.id} className="rounded-[16px] border border-[#e3e9f3] bg-[#fbfcff] p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-black text-[#111b3f]">{campaign.name}</p>
                              <p className="mt-1 text-[8px] font-bold text-[#8a95aa]">{copy(`${campaign.scheduledPosts} منشور مجدول · بدأ ${formatDate(campaign.activatedAt, true)}`, `${campaign.scheduledPosts} scheduled · enabled ${formatDate(campaign.activatedAt, false)}`)}</p>
                            </div>
                            {pauseConfirmationId === campaign.id ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <button type="button" onClick={() => setPauseConfirmationId(null)} disabled={pausingId !== null} className="h-9 rounded-[11px] border border-[#dbe2f0] px-3 text-[9px] font-black text-[#64708f]">{copy('إلغاء', 'Cancel')}</button>
                                <button type="button" onClick={() => void pauseAutopilot(campaign.id)} disabled={pausingId !== null} className="inline-flex h-9 items-center gap-2 rounded-[11px] bg-rose-600 px-3 text-[9px] font-black text-white disabled:opacity-50">{pausingId === campaign.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PauseCircle className="h-3.5 w-3.5" />}{copy('تأكيد الإيقاف', 'Confirm pause')}</button>
                              </div>
                            ) : (
                              <button type="button" onClick={() => setPauseConfirmationId(campaign.id)} disabled={pausingId !== null} className="inline-flex h-9 items-center gap-2 rounded-[11px] border border-rose-200 bg-rose-50 px-3 text-[9px] font-black text-rose-700 disabled:opacity-50"><PauseCircle className="h-3.5 w-3.5" />{copy('إيقاف آمن', 'Pause safely')}</button>
                            )}
                          </div>
                        </article>
                      )) : (
                        <div className="rounded-[16px] border border-emerald-100 bg-emerald-50/60 p-4">
                          <p className="text-[10px] font-black text-emerald-900">{copy('لا توجد حملة بتشغيل آلي نشط الآن.', 'No campaign has active automation now.')}</p>
                          <p className="mt-1 text-[8px] font-semibold leading-4 text-emerald-700">{copy('لا يعني ذلك أن النظام نشر أو أوقف شيئًا؛ هذه حالة الإعداد المحفوظة فقط.', 'This does not imply anything was published or paused; it is the persisted setting only.')}</p>
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </section>

              <section className="nx-os-card p-5" aria-labelledby="incident-title">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 id="incident-title" className="text-[17px] font-black text-[#071236]">{copy('سجل التنبيهات الحالي', 'Current incident snapshot')}</h2>
                    <p className="mt-1 text-[10px] font-semibold leading-5 text-[#7b87a3]">{copy('تنبيهات مشتقة من اللقطة الحالية؛ لا ندّعي أنها تذاكر تم إغلاقها أو إقرارها.', 'Snapshot-derived alerts; they are not presented as acknowledged or resolved tickets.')}</p>
                  </div>
                  <span className="rounded-full bg-[#f1f4f9] px-3 py-1.5 text-[9px] font-black text-[#66728c]">{overview ? `${overview.issues.length} ${copy('تنبيه', 'alerts')}` : '—'}</span>
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {overview?.issues.length ? overview.issues.slice(0, 12).map(issue => (
                    <article key={issue.id} className="rounded-[17px] border border-[#e6ebf4] bg-[#fbfcff] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2 py-1 text-[8px] font-black ${issue.priority === 'critical' ? 'bg-rose-50 text-rose-700' : issue.priority === 'high' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{ar ? PRIORITY_LABELS[issue.priority].ar : PRIORITY_LABELS[issue.priority].en}</span>
                            <span className="text-[8px] font-black uppercase tracking-[0.12em] text-[#8b96ab]">{ar ? SOURCE_LABELS[issue.source].ar : SOURCE_LABELS[issue.source].en}</span>
                          </div>
                          <h3 className="mt-2 text-[12px] font-black text-[#111b3f]">{ar ? issue.title.ar : issue.title.en}</h3>
                          <p className="mt-1 text-[10px] font-semibold leading-5 text-[#6f7b94]">{ar ? issue.reason.ar : issue.reason.en}</p>
                        </div>
                        <Link href={issue.href} aria-label={copy('فتح التنبيه', 'Open alert')} className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] border border-[#dbe2f0] text-[#5366f6]"><ArrowUpRight className="h-4 w-4" /></Link>
                      </div>
                    </article>
                  )) : (
                    <div className="lg:col-span-2 rounded-[18px] border border-emerald-100 bg-emerald-50/70 p-5 text-[11px] font-bold text-emerald-800">
                      {copy('لا توجد تنبيهات مثبتة في اللقطة الحالية.', 'No verified alert exists in the current snapshot.')}
                    </div>
                  )}
                </div>
              </section>

              <section className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[#dfe6f1] bg-white px-5 py-4 text-[10px] font-semibold text-[#7b87a3]">
                <span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-[#5366f6]" />{copy('المركز يقرأ البيانات المحفوظة؛ لا يختلق نجاحًا من عدم وجود أخطاء.', 'The center reads persisted evidence; absence of errors is not invented success.')}</span>
                <span>{overview ? copy(`وقت اللقطة ${formatDate(overview.generatedAt, true)}`, `Snapshot time ${formatDate(overview.generatedAt, false)}`) : '—'}</span>
              </section>
            </>
          )}
        </div>
      </main>
    </AppShell>
  )
}
