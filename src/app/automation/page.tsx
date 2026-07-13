'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowUpRight,
  AlertTriangle,
  LockKeyhole,
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
            pageTitle={copy('الأتمتة', 'Automation')}
            pageSubtitle={copy('يراقب NEXUS عوائق العمل المثبتة ويوجّه القرار التالي.', 'NEXUS monitors verified workflow blockers and routes the next decision.')}
            primaryHref="/approvals"
            primaryLabel={copy('مراجعة الموافقات', 'Review approvals')}
            secondaryHref="/connections"
            secondaryLabel={copy('الربط', 'Connections')}
          />

          <StrategySpineCard
            nextHref="/approvals"
            nextLabel={copy('راجع القرارات', 'Review decisions')}
            title={copy('NEXUS يراقب، وأنت توافق', 'NEXUS monitors; you approve')}
            body={copy(
              'يحوّل النظام العوائق الفعلية إلى قرارات واضحة. النشر والإنفاق يظلان بحاجة إلى تأكيد صريح.',
              'The system turns real blockers into clear decisions. Publishing and spend still require explicit confirmation.',
            )}
          />

          <section className="nx-os-action-strip">
            <div className="flex min-w-0 items-center gap-3">
              <span className="nx-os-icon-box"><Workflow size={17} /></span>
              <div className="min-w-0">
                <p className="text-[13px] font-black text-[#111b3f]">{copy('مراقب التنفيذ يعمل', 'Execution monitor active')}</p>
                <p className="text-[11px] font-semibold text-[#7b87a3]">
                  {executionTruth
                    ? copy(`${executionTruth.summary.campaigns} حملة تحت المراقبة`, `${executionTruth.summary.campaigns} campaigns monitored`)
                    : copy('جار تحميل حالة التشغيل', 'Loading execution state')}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] font-bold text-[#53617f]">
              <span className="rounded-full bg-[#f3f5fb] px-3 py-1.5">{copy('حسابات النشر', 'Publishing accounts')}: {connectionState === 'loading' ? '...' : activeSocialCount}</span>
              <span className="rounded-full bg-[#f3f5fb] px-3 py-1.5">{copy('حسابات الإعلانات', 'Ad accounts')}: {connectionState === 'loading' ? '...' : activeAdCount}</span>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
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
          </section>

          <section>
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

          </section>
        </div>
      </main>
    </AppShell>
  )
}
