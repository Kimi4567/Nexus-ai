'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Activity,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Coins,
  LockKeyhole,
  Workflow,
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import type { WorkspaceExecutionTruth } from '@/lib/executionTruth'
import type { OperationsOverview } from '@/lib/operationsOverview'
import { capabilitiesByStatus, type MarketingCapabilityStatus } from '@/lib/marketingCapabilityRegistry'

type ConnectionState = 'loading' | 'ready' | 'error'

const PRIORITY_LABELS = {
  critical: { ar: 'حرجة', en: 'Critical' },
  high: { ar: 'عالية', en: 'High' },
  medium: { ar: 'متوسطة', en: 'Medium' },
  low: { ar: 'منخفضة', en: 'Low' },
} as const

const STAGE_LABELS = {
  ARCHIVED: { ar: 'مؤرشفة', en: 'Archived' },
  PAUSED: { ar: 'متوقفة', en: 'Paused' },
  STRATEGY_REQUIRED: { ar: 'استراتيجية مطلوبة', en: 'Strategy required' },
  STRATEGY_REVIEW: { ar: 'مراجعة الاستراتيجية', en: 'Strategy review' },
  CONTENT_PLANNING: { ar: 'تخطيط المحتوى', en: 'Content planning' },
  CONTENT_REVIEW: { ar: 'مراجعة المحتوى', en: 'Content review' },
  MEDIA_REVIEW: { ar: 'مراجعة الوسائط', en: 'Media review' },
  SCHEDULING: { ar: 'الجدولة', en: 'Scheduling' },
  IN_FLIGHT: { ar: 'قيد التنفيذ', en: 'In flight' },
  LEARNING: { ar: 'جمع الأدلة', en: 'Learning' },
  OPTIMIZING: { ar: 'التحسين', en: 'Optimizing' },
  NEEDS_ATTENTION: { ar: 'يحتاج انتباهًا', en: 'Needs attention' },
} as const

const ISSUE_SOURCE_LABELS = {
  monitor: { ar: 'المراقب', en: 'Monitor' },
  execution: { ar: 'التنفيذ', en: 'Execution' },
  connection: { ar: 'الربط', en: 'Connection' },
  paid: { ar: 'المدفوع', en: 'Paid' },
  analytics: { ar: 'التحليلات', en: 'Analytics' },
  credits: { ar: 'الكريديت', en: 'Credits' },
} as const

interface SocialAccount {
  id: string
  platform: string
  isActive?: boolean
}

interface AdAccount {
  id: string
  platform: string
  status?: string
}

function ReadinessCard({
  title,
  value,
  helper,
  tone = 'neutral',
  icon,
}: {
  title: string
  value: string
  helper: string
  tone?: 'neutral' | 'ready' | 'warning'
  icon: ReactNode
}) {
  const toneClass = {
    neutral: 'bg-[#f8faff] text-[#5366f6]',
    ready: 'bg-emerald-50 text-emerald-600',
    warning: 'bg-amber-50 text-amber-600',
  }[tone]

  return (
    <div className="nx-os-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-bold text-[#64708f]">{title}</p>
          <p className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#071236]">{value}</p>
          <p className="mt-2 text-[12px] font-semibold leading-5 text-[#7b87a3]">{helper}</p>
        </div>
        <span className={`grid h-11 w-11 place-items-center rounded-[16px] ${toneClass}`}>{icon}</span>
      </div>
    </div>
  )
}

export default function AutomationPage() {
  const { isAuthenticated, loading, authHeader } = useAuth()
  const { locale, dir } = useI18n()
  const router = useRouter()
  const ar = locale === 'ar'
  const [connectionState, setConnectionState] = useState<ConnectionState>('loading')
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([])
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([])
  const [executionTruth, setExecutionTruth] = useState<WorkspaceExecutionTruth | null>(null)
  const [operations, setOperations] = useState<OperationsOverview | null>(null)

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/auth/login')
  }, [loading, isAuthenticated, router])

  useEffect(() => {
    if (!isAuthenticated) return
    const token = authHeader()
    if (!token) return

    let cancelled = false
    async function loadConnections() {
      setConnectionState('loading')
      try {
        const [socialRes, adRes, executionRes, operationsRes] = await Promise.allSettled([
          fetch('/api/social/accounts', { headers: { Authorization: token } }),
          fetch('/api/ad-accounts', { headers: { Authorization: token } }),
          fetch('/api/execution/queue', { headers: { Authorization: token } }),
          fetch('/api/operations/overview', { headers: { Authorization: token } }),
        ])

        if (cancelled) return

        if (socialRes.status === 'fulfilled' && socialRes.value.ok) {
          const data = await socialRes.value.json().catch(() => ({}))
          setSocialAccounts(Array.isArray(data.accounts) ? data.accounts : [])
        }

        if (adRes.status === 'fulfilled' && adRes.value.ok) {
          const data = await adRes.value.json().catch(() => ({}))
          setAdAccounts(Array.isArray(data.accounts) ? data.accounts : [])
        }

        if (executionRes.status === 'fulfilled' && executionRes.value.ok) {
          const data = await executionRes.value.json().catch(() => ({}))
          setExecutionTruth(data.truth && typeof data.truth === 'object' ? data.truth : null)
        }

        if (operationsRes.status === 'fulfilled' && operationsRes.value.ok) {
          const data = await operationsRes.value.json().catch(() => ({}))
          setOperations(data.overview && typeof data.overview === 'object' ? data.overview : null)
        }

        setConnectionState('ready')
      } catch {
        if (!cancelled) setConnectionState('error')
      }
    }

    loadConnections()
    return () => { cancelled = true }
  }, [authHeader, isAuthenticated])

  const copy = (arabic: string, english: string) => (ar ? arabic : english)

  if (loading || !isAuthenticated) {
    return (
      <AppShell>
        <div className="min-h-[60vh] rounded-[28px] border border-[#e3e8f3] bg-white p-8" />
      </AppShell>
    )
  }

  const activeSocialCount = socialAccounts.filter(account => account.isActive !== false).length
  const activeAdCount = adAccounts.filter(account => account.status !== 'revoked').length
  const capabilityGroups: Array<{
    status: MarketingCapabilityStatus
    title: string
    helper: string
    className: string
  }> = [
    {
      status: 'operational',
      title: copy('يعمل الآن', 'Operational now'),
      helper: copy('داخل NEXUS وتحت مراجعة المستخدم', 'Inside NEXUS with user review'),
      className: 'border-emerald-100 bg-emerald-50/50 text-emerald-700',
    },
    {
      status: 'conditional',
      title: copy('يعمل بشروط', 'Conditional'),
      helper: copy('يتطلب بيانات أو صلاحية موفر مثبتة', 'Requires evidence or verified provider access'),
      className: 'border-amber-100 bg-amber-50/50 text-amber-700',
    },
    {
      status: 'planned',
      title: copy('غير متاح بعد', 'Not available yet'),
      helper: copy('معلن بوضوح ولا يُعرض كمنفذ', 'Disclosed clearly and never presented as executed'),
      className: 'border-slate-200 bg-slate-50 text-slate-600',
    },
  ]
  const operationalIssues = operations?.issues.filter(issue => issue.source !== 'execution') ?? []

  return (
    <AppShell>
      <main dir={dir} className="nx-os-page">
        <div className="nx-os-container nx-os-stack">
          <LuxuryWorkspaceHeader
            journeyStage="execution"
            pageTitle={copy('مركز العمليات', 'Operations center')}
            pageSubtitle={copy('نبض التشغيل، الأعطال، الموافقات، الاتصالات، التحليلات والتكلفة من بيانات محفوظة فقط.', 'Hourly execution heartbeat, incidents, approvals, connections, analytics, and cost from persisted evidence only.')}
            primaryHref="/approvals"
            primaryLabel={copy('مراجعة الموافقات', 'Review approvals')}
            secondaryHref={null}
          />

          <section className="nx-os-action-strip">
            <div className="flex min-w-0 items-center gap-3">
              <span className="nx-os-icon-box"><Workflow size={17} /></span>
              <div className="min-w-0">
                <p className="text-[13px] font-black text-[#111b3f]">{copy('لقطة التنفيذ الحالية', 'Current execution snapshot')}</p>
                <p className="text-[11px] font-semibold text-[#7b87a3]">
                  {operations
                    ? operations.monitor.lastRunAt
                      ? copy(`آخر نبض محفوظ ${new Date(operations.monitor.lastRunAt).toLocaleString('ar-AE')}`, `Last persisted heartbeat ${new Date(operations.monitor.lastRunAt).toLocaleString('en-US')}`)
                      : copy('لم يُحفظ تشغيل للمراقب بعد', 'No monitor run has been persisted yet')
                    : executionTruth
                      ? copy(`تم تحليل حالة ${executionTruth.summary.campaigns} حملة من البيانات الحالية`, `Current data analyzed for ${executionTruth.summary.campaigns} campaigns`)
                    : copy('جار تحميل حالة التشغيل', 'Loading execution state')}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] font-bold text-[#53617f]">
              <span className="rounded-full bg-[#f3f5fb] px-3 py-1.5">{copy('حسابات النشر', 'Publishing accounts')}: {connectionState === 'loading' ? '...' : activeSocialCount}</span>
              <span className="rounded-full bg-[#f3f5fb] px-3 py-1.5">{copy('حسابات الإعلانات', 'Ad accounts')}: {connectionState === 'loading' ? '...' : activeAdCount}</span>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label={copy('صحة التشغيل', 'Operations health')}>
            <ReadinessCard
              title={copy('نبض المراقب', 'Monitor heartbeat')}
              value={operations
                ? operations.monitor.health === 'healthy'
                  ? copy('يعمل', 'Healthy')
                  : operations.monitor.health === 'not_started'
                    ? copy('لم يبدأ', 'Not started')
                    : copy('يحتاج انتباه', 'Needs attention')
                : '...'}
              helper={operations
                ? copy(
                    `التشغيل القادم ${new Date(operations.monitor.nextRunAt).toLocaleString('ar-AE')}`,
                    `Next run ${new Date(operations.monitor.nextRunAt).toLocaleString('en-US')}`,
                  )
                : copy('جار تحميل نبض التشغيل', 'Loading persisted heartbeat')}
              tone={operations?.monitor.health === 'healthy' ? 'ready' : operations ? 'warning' : 'neutral'}
              icon={<Activity size={20} />}
            />
            <ReadinessCard
              title={copy('حوادث تشغيلية', 'Operational incidents')}
              value={operations ? String(operations.summary.incidents) : '...'}
              helper={operations
                ? copy(`${operations.summary.critical} حرجة`, `${operations.summary.critical} critical`)
                : copy('أعطال مؤكدة فقط', 'Verified incidents only')}
              tone={operations?.summary.incidents ? 'warning' : operations ? 'ready' : 'neutral'}
              icon={<AlertTriangle size={20} />}
            />
            <ReadinessCard
              title={copy('موافقات معلقة', 'Pending approvals')}
              value={operations ? String(operations.summary.pendingApprovals) : '...'}
              helper={operations
                ? copy(`${operations.summary.overdueApprovals} تجاوزت 24 ساعة`, `${operations.summary.overdueApprovals} older than 24 hours`)
                : copy('من سجل القرارات', 'From the decision ledger')}
              tone={operations?.summary.overdueApprovals ? 'warning' : operations ? 'ready' : 'neutral'}
              icon={<LockKeyhole size={20} />}
            />
            <ReadinessCard
              title={copy('استهلاك 30 يومًا', '30-day credit spend')}
              value={operations ? String(operations.credits.spent30d) : '...'}
              helper={operations
                ? copy(`${operations.credits.refunded30d} كريديت مسترد`, `${operations.credits.refunded30d} credits refunded`)
                : copy('من سجل الكريديت المحفوظ', 'From the persisted credit ledger')}
              tone={operations && (operations.credits.unversionedCharges30d > 0 || operations.credits.chargesWithoutArtifact30d > 0) ? 'warning' : operations ? 'ready' : 'neutral'}
              icon={<Coins size={20} />}
            />
          </section>

          <section className="nx-os-card p-5" aria-labelledby="operations-attention-title">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 id="operations-attention-title" className="text-[18px] font-black text-[#071236]">
                  {copy('الانتباه التشغيلي', 'Operational attention')}
                </h2>
                <p className="mt-1 text-[12px] font-semibold leading-5 text-[#7b87a3]">
                  {copy('أعطال الاتصالات والقياس والإنفاق والتتبع؛ أما خطوات الحملات العادية فتظهر في قائمة التنفيذ أدناه.', 'Connection, measurement, spend, and traceability issues. Normal campaign work stays in the execution queue below.')}
                </p>
              </div>
              {operations && (
                <div className="flex flex-wrap gap-2 text-[10px] font-black text-[#53617f]">
                  <span className="rounded-full bg-[#f3f5fb] px-3 py-1.5">{copy('اتصالات سليمة', 'Healthy connections')}: {operations.connections.connected}/{operations.connections.total}</span>
                  <span className="rounded-full bg-[#f3f5fb] px-3 py-1.5">{copy('تحليلات ناقصة', 'Missing analytics')}: {operations.analytics.publishedAwaitingEvidence}</span>
                  <span className="rounded-full bg-[#f3f5fb] px-3 py-1.5">{copy('إعادات محاولة 24س', 'Retries 24h')}: {operations.retries.last24h}</span>
                  <span className="rounded-full bg-[#f3f5fb] px-3 py-1.5">{copy('إنفاق معلن', 'Reported spend')}: {operations.paid.reportedSpend.toFixed(2)}</span>
                </div>
              )}
            </div>
            <div className="mt-5 space-y-3">
              {!operations ? (
                <div className="h-28 animate-pulse rounded-[18px] bg-[#edf1f8]" />
              ) : operationalIssues.length === 0 ? (
                <div className="rounded-[18px] border border-emerald-100 bg-emerald-50/60 p-5 text-[12px] font-bold text-emerald-800">
                  {copy('لا توجد أعطال تشغيلية مثبتة في اللقطة الحالية.', 'No verified operational incident exists in the current snapshot.')}
                </div>
              ) : operationalIssues.slice(0, 8).map(issue => (
                <div key={issue.id} className="flex flex-wrap items-start justify-between gap-3 rounded-[18px] border border-[#e7ecf6] bg-[#fbfcff] p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${issue.priority === 'critical' ? 'bg-rose-50 text-rose-700' : issue.priority === 'high' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{ar ? PRIORITY_LABELS[issue.priority].ar : PRIORITY_LABELS[issue.priority].en}</span>
                      <span className="text-[9px] font-black uppercase tracking-[0.12em] text-[#8a96ad]">{ar ? ISSUE_SOURCE_LABELS[issue.source].ar : ISSUE_SOURCE_LABELS[issue.source].en}</span>
                    </div>
                    <h3 className="mt-2 text-[13px] font-black text-[#111b3f]">{ar ? issue.title.ar : issue.title.en}</h3>
                    <p className="mt-1 text-[11px] font-semibold leading-5 text-[#64708f]">{ar ? issue.reason.ar : issue.reason.en}</p>
                  </div>
                  <Link href={issue.href} className="inline-flex h-9 items-center gap-2 rounded-[12px] bg-[#071236] px-3 text-[10px] font-black text-white">
                    {copy('فتح', 'Open')} <ArrowUpRight size={12} />
                  </Link>
                </div>
              ))}
            </div>
          </section>

          <section className="nx-os-card p-5" aria-labelledby="capability-map-title">
            <div className="mb-5">
              <h2 id="capability-map-title" className="text-[18px] font-black text-[#071236]">
                {copy('خريطة قدرات التشغيل', 'Operational capability map')}
              </h2>
              <p className="mt-1 text-[12px] font-semibold leading-5 text-[#7b87a3]">
                {copy('مرجع واحد يوضح ما ينفذه النظام فعلاً وما يحتاج دليلاً أو تكاملاً خارجياً.', 'One source of truth for what the system executes and what still needs evidence or an external integration.')}
              </p>
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              {capabilityGroups.map((group) => (
                <div key={group.status} className={`rounded-[20px] border p-4 ${group.className}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-[13px] font-black">{group.title}</h3>
                      <p className="mt-1 text-[10px] font-bold opacity-75">{group.helper}</p>
                    </div>
                    {group.status === 'operational' ? <CheckCircle2 size={18} /> : <Clock3 size={18} />}
                  </div>
                  <ul className="mt-4 space-y-3">
                    {capabilitiesByStatus(group.status).map((capability) => (
                      <li key={capability.id} className="rounded-[14px] border border-white/80 bg-white/80 p-3 text-[#111b3f]">
                        <p className="text-[12px] font-black">{ar ? capability.title.ar : capability.title.en}</p>
                        <p className="mt-1 text-[10px] font-semibold leading-5 text-[#64708f]">{ar ? capability.detail.ar : capability.detail.en}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="nx-os-card p-5">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-[18px] font-black text-[#071236]">{copy('قائمة قرارات التنفيذ', 'Execution decision queue')}</h2>
                  <p className="mt-1 text-[13px] font-semibold text-[#7b87a3]">
                    {copy('مرتبة حسب الخطورة وحالة العمل الفعلية، بدون افتراض نتائج أداء.', 'Ordered by severity and verified workflow state without inferred performance outcomes.')}
                  </p>
                </div>
                <Link href="/connections" className="inline-flex h-10 items-center gap-2 rounded-[14px] border border-[#d9e1f2] bg-white px-4 text-[12px] font-black text-[#5366f6]">
                  {copy('راجع التكاملات', 'Review integrations')} <ArrowUpRight size={14} />
                </Link>
              </div>
              <div className="space-y-3">
                {!executionTruth ? (
                  <div className="h-32 animate-pulse rounded-[20px] bg-[#edf1f8]" />
                ) : executionTruth.queue.length === 0 ? (
                  <div className="rounded-[20px] border border-dashed border-[#d7def0] p-8 text-center text-[13px] font-semibold text-[#7b87a3]">
                    {copy('لا توجد خطوات تشغيل معلقة الآن.', 'No execution actions are pending right now.')}
                  </div>
                ) : executionTruth.queue.slice(0, 10).map(action => (
                  <div key={action.id} className="rounded-[18px] border border-[#e7ecf6] bg-[#fbfcff] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${action.priority === 'critical' ? 'bg-rose-50 text-rose-700' : action.priority === 'high' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{ar ? PRIORITY_LABELS[action.priority].ar : PRIORITY_LABELS[action.priority].en}</span>
                          <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8a96ad]">{ar ? STAGE_LABELS[action.stage].ar : STAGE_LABELS[action.stage].en}</span>
                        </div>
                        <h3 className="mt-2 text-[14px] font-black text-[#111b3f]">{ar ? action.title.ar : action.title.en}</h3>
                        <p className="mt-1 text-[12px] font-semibold leading-5 text-[#64708f]">{ar ? action.reason.ar : action.reason.en}</p>
                        <p className="mt-2 text-[10px] font-bold text-[#8a96ad]">{action.campaignName}</p>
                      </div>
                      <Link href={action.requiresApproval ? '/approvals' : action.href} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-[13px] bg-[#071236] px-4 text-[11px] font-black text-white">
                        {action.requiresApproval ? copy('راجع القرار', 'Review decision') : copy('افتح الخطوة', 'Open step')}
                        <ArrowUpRight size={13} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </section>
        </div>
      </main>
    </AppShell>
  )
}
