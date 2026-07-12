'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  GitBranch,
  LockKeyhole,
  Sparkles,
  Workflow,
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import StrategySpineCard from '@/components/StrategySpineCard'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import type { WorkspaceExecutionTruth } from '@/lib/executionTruth'

type ConnectionState = 'loading' | 'ready' | 'error'

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
        const [socialRes, adRes, executionRes] = await Promise.allSettled([
          fetch('/api/social/accounts', { headers: { Authorization: token } }),
          fetch('/api/ad-accounts', { headers: { Authorization: token } }),
          fetch('/api/execution/queue', { headers: { Authorization: token } }),
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

  return (
    <AppShell>
      <main dir={dir} className="nx-os-page">
        <div className="nx-os-container nx-os-stack">
          <LuxuryWorkspaceHeader
            pageTitle={copy('غرفة التشغيل', 'Operations Room')}
            pageSubtitle={copy('مراقبة حالة الحملات وتوجيه القرار التالي من بيانات التشغيل الفعلية.', 'Monitor campaign state and route the next decision from verified execution data.')}
            primaryHref="/approvals"
            primaryLabel={copy('افتح القرارات', 'Open decisions')}
            secondaryHref="/connections"
            secondaryLabel={copy('التكاملات', 'Integrations')}
          />

          <StrategySpineCard
            nextHref="/publish"
            nextLabel={copy('راجع جاهزية النشر', 'Review publishing readiness')}
            title={copy('الأتمتة تأتي بعد الاستراتيجية والجاهزية، وليست اختصاراً للتنفيذ', 'Automation comes after strategy and readiness, not as an execution shortcut')}
            body={copy(
              'Autopilot يستخدم الاستراتيجية والمحتوى والربط كمدخلات، لكنه لا يفعّل نشرًا أو صرفًا أو تعلم أداء بدون موافقة وحدود واضحة وبيانات حقيقية.',
              'Autopilot uses strategy, content, and connections as inputs, but it does not enable publishing, spend, or performance learning without approval, clear limits, and real data.',
            )}
          />

          <section className="nx-os-panel relative overflow-hidden p-6 lg:p-8">
            <div
              className="absolute inset-y-0 start-0 w-1/2 opacity-70"
              style={{
                background:
                  'radial-gradient(circle at 20% 30%, rgba(83,102,246,0.16), transparent 34%), radial-gradient(circle at 62% 72%, rgba(16,185,129,0.12), transparent 30%)',
              }}
            />
            <div className="relative z-10 grid gap-6 lg:grid-cols-[1fr_0.82fr] lg:items-center">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-1.5 text-[12px] font-black text-violet-700">
                  <Sparkles size={14} />
                  {copy('مراقب التنفيذ يعمل', 'Execution monitor active')}
                </div>
                <h1 className="text-3xl font-black tracking-[-0.03em] text-[#071236] lg:text-4xl">
                  {copy('Nexus Autopilot™ غرفة التشغيل', 'Nexus Autopilot™ Operations Room')}
                </h1>
                <p className="mt-3 max-w-3xl text-[14px] font-semibold leading-7 text-[#64708f]">
                  {copy(
                    'يراقب NEXUS مراحل الحملات ويحوّل الفجوات المثبتة إلى خطوات وقرارات. لا نشر، لا إنفاق، ولا تعلم أداء بدون بيانات وموافقة وحدود واضحة.',
                    'NEXUS monitors campaign stages and turns verified workflow gaps into actions and decisions. No publishing, spend, or performance learning happens without data, approval, and clear boundaries.'
                  )}
                </p>
              </div>
              <div className="nx-os-card bg-[#fbfcff] p-5">
                <div className="mb-4 flex items-center gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-[18px] bg-[#071236] text-white">
                    <Workflow size={20} />
                  </span>
                  <div>
                    <p className="text-[13px] font-black text-[#111b3f]">{copy('حالة التشغيل الآن', 'Current execution state')}</p>
                    <p className="text-[12px] font-semibold text-[#7b87a3]">
                      {executionTruth
                        ? copy(`${executionTruth.summary.campaigns} حملة تحت المراقبة`, `${executionTruth.summary.campaigns} campaigns monitored`)
                        : copy('جار تحميل سجل التشغيل', 'Loading execution state')}
                    </p>
                  </div>
                </div>
                <div className="grid gap-2 text-[12px] font-bold text-[#53617f]">
                  <div className="flex items-center justify-between rounded-2xl bg-white px-3 py-2">
                    <span>{copy('حسابات نشر عضوي متصلة', 'Organic publishing accounts')}</span>
                    <span>{connectionState === 'loading' ? '...' : activeSocialCount}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-white px-3 py-2">
                    <span>{copy('حسابات إعلانات متصلة', 'Paid ad accounts')}</span>
                    <span>{connectionState === 'loading' ? '...' : activeAdCount}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ReadinessCard
              title={copy('تحتاج انتباه', 'Needs attention')}
              value={executionTruth ? String(executionTruth.summary.needsAttention) : '...'}
              helper={copy('تعثرات مؤكدة تظهر أولاً في قائمة التشغيل.', 'Verified failures rise to the top of the execution queue.')}
              tone={executionTruth?.summary.needsAttention ? 'warning' : 'ready'}
              icon={<AlertTriangle size={20} />}
            />
            <ReadinessCard
              title={copy('بانتظار موافقة', 'Awaiting approval')}
              value={executionTruth ? String(executionTruth.summary.awaitingApproval) : '...'}
              helper={copy('تظهر في مركز القرارات قبل أي تنفيذ.', 'Routed to the Decision Center before execution.')}
              tone={executionTruth?.summary.awaitingApproval ? 'warning' : 'ready'}
              icon={<LockKeyhole size={20} />}
            />
            <ReadinessCard
              title={copy('منشورات مجدولة', 'Scheduled posts')}
              value={executionTruth ? String(executionTruth.summary.scheduledPosts) : '...'}
              helper={copy('الجدولة داخل NEXUS لا تعني النشر قبل التنفيذ المؤكد.', 'Scheduling in NEXUS is not publishing until confirmed execution.')}
              icon={<Clock3 size={20} />}
            />
            <ReadinessCard
              title={copy('منشورات منفذة', 'Published posts')}
              value={executionTruth ? String(executionTruth.summary.publishedPosts) : '...'}
              helper={copy('لا تدخل التعلّم إلا بعد وصول بيانات أداء موثقة.', 'They enter learning only after verified performance data arrives.')}
              tone="ready"
              icon={<Database size={20} />}
            />
          </section>

          <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
            <div className="nx-os-card p-5">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-[18px] font-black text-[#071236]">{copy('قائمة التشغيل الحية', 'Live execution queue')}</h2>
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
                          <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${action.priority === 'critical' ? 'bg-rose-50 text-rose-700' : action.priority === 'high' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{action.priority}</span>
                          <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8a96ad]">{action.stage}</span>
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

            <aside className="space-y-5">
              <div className="nx-os-card p-5">
                <h2 className="text-[16px] font-black text-[#071236]">{copy('قواعد الأمان', 'Safety rules')}</h2>
                <div className="mt-4 space-y-3">
                  {[
                    copy('لا نشر بدون زر تأكيد صريح.', 'No publishing without explicit confirmation.'),
                    copy('لا إنفاق إعلاني بدون ميزانية وموافقة.', 'No ad spend without budget and approval.'),
                    copy('لا تعلم أداء بدون analyticsData.', 'No performance learning without analyticsData.'),
                    copy('لا تشغيل Autopilot لحملة ناقصة الوسائط أو الموافقات.', 'No Autopilot for campaigns missing media or approvals.'),
                  ].map(item => (
                    <div key={item} className="flex items-start gap-2 rounded-2xl bg-[#f8faff] px-3 py-2 text-[12px] font-bold leading-5 text-[#53617f]">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="nx-os-card border-violet-100 bg-violet-50/70 p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-violet-600">
                    <GitBranch size={19} />
                  </span>
                  <div>
                    <h2 className="text-[15px] font-black text-[#071236]">{copy('الخطوة الصحيحة التالية', 'Correct next step')}</h2>
                    <p className="mt-1 text-[12px] font-semibold leading-5 text-[#64708f]">
                      {copy('ابدأ من حملة محددة، ثم فعّل Autopilot داخلها بعد اكتمال المحتوى والنشر.', 'Start from a specific campaign, then enable Autopilot inside it after content and publishing readiness.')}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-2">
                  <Link href="/campaigns" className="inline-flex h-11 items-center justify-center gap-2 rounded-[15px] bg-[#071236] px-4 text-[13px] font-black text-white">
                    {copy('افتح الحملات', 'Open campaigns')} <ArrowUpRight size={15} />
                  </Link>
                  <Link href="/connections" className="inline-flex h-11 items-center justify-center gap-2 rounded-[15px] border border-[#d9e1f2] bg-white px-4 text-[13px] font-black text-[#5366f6]">
                    {copy('راجع الربط والصلاحيات', 'Review connections and permissions')}
                  </Link>
                </div>
              </div>

              <div className="nx-os-card p-4 text-[12px] font-semibold leading-6 text-[#7b87a3]">
                <Clock3 className="mb-2 h-4 w-4 text-[#5366f6]" />
                {copy(
                  'هذه الصفحة لا تعرض أرقام أداء وهمية. أي حالة أداء أو تعلم تظهر فقط بعد بيانات منصة حقيقية.',
                  'This page does not show fake performance numbers. Any performance or learning state appears only after real platform data exists.'
                )}
              </div>
            </aside>
          </section>
        </div>
      </main>
    </AppShell>
  )
}
