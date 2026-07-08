'use client'

import AppShell from '@/components/AppShell'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Eye,
  Loader2,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Timer,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

interface BrainProposal {
  id: string
  type?: string | null
  title?: string | null
  summary?: string | null
  status?: string | null
  createdAt?: string | null
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-[24px] border border-[#e3e8f3] bg-white p-5 shadow-[0_18px_50px_rgba(13,24,63,0.045)] ${className}`}>
      {children}
    </section>
  )
}

function Metric({
  label,
  value,
  helper,
  icon,
  tone = 'violet',
}: {
  label: string
  value: string
  helper: string
  icon: React.ReactNode
  tone?: 'violet' | 'green' | 'amber' | 'rose'
}) {
  const toneClass = {
    violet: 'bg-[#f1f0ff] text-[#5366f6]',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
  }[tone]

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-bold text-[#64708f]">{label}</p>
          <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#071236]">{value}</p>
          <p className="mt-2 text-[12px] font-semibold leading-5 text-[#7b87a3]">{helper}</p>
        </div>
        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-[18px] ${toneClass}`}>{icon}</span>
      </div>
    </Card>
  )
}

export default function ApprovalsPage() {
  const { isAuthenticated, loading, authHeader } = useAuth()
  const { locale, dir } = useI18n()
  const router = useRouter()
  const ar = locale === 'ar'
  const copy = (arabic: string, english: string) => (ar ? arabic : english)
  const [proposals, setProposals] = useState<BrainProposal[]>([])
  const [proposalsLoading, setProposalsLoading] = useState(true)

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/auth/login')
  }, [isAuthenticated, loading, router])

  useEffect(() => {
    if (!isAuthenticated) return
    const token = authHeader()
    if (!token) return
    let cancelled = false

    async function loadProposals() {
      setProposalsLoading(true)
      try {
        const res = await fetch('/api/brain/proposals?status=pending', { headers: { Authorization: token } })
        if (!res.ok) return
        const data = await res.json().catch(() => ({}))
        if (!cancelled) setProposals(Array.isArray(data.proposals) ? data.proposals : [])
      } finally {
        if (!cancelled) setProposalsLoading(false)
      }
    }

    loadProposals()
    return () => { cancelled = true }
  }, [authHeader, isAuthenticated])

  const rows = useMemo(() => proposals.slice(0, 6), [proposals])

  if (loading || !isAuthenticated) {
    return (
      <AppShell>
        <div className="min-h-screen bg-[#f6f8fc] p-8">
          <div className="mx-auto grid min-h-[50vh] max-w-[1540px] place-items-center rounded-[28px] border border-[#e3e8f3] bg-white">
            <Loader2 className="h-8 w-8 animate-spin text-[#5366f6]" />
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <main dir={dir} className="min-h-screen bg-[#f6f8fc] px-4 py-6 text-[#071236] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1540px] space-y-6">
          <LuxuryWorkspaceHeader
            pageTitle={copy('مركز الموافقات', 'Approvals Center')}
            pageSubtitle={copy('مراجعة المحتوى والإشارات قبل أي تنفيذ.', 'Review content and signals before execution.')}
            primaryHref="/content-hub"
            primaryLabel={copy('افتح مركز المحتوى', 'Open Content Hub')}
            secondaryHref="/brand"
            secondaryLabel="Brand Brain"
          />

          <header className="flex flex-col gap-5 rounded-[26px] border border-[#e3e8f3] bg-white p-5 shadow-[0_18px_55px_rgba(13,24,63,0.045)] lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-1.5 text-[12px] font-black text-violet-700">
                <ShieldCheck size={14} />
                {copy('مراجعة قبل التنفيذ', 'Review before execution')}
              </div>
              <h1 className="flex items-center gap-3 text-3xl font-black tracking-[-0.04em] text-[#071236] lg:text-4xl">
                {copy('مركز الموافقات', 'Approvals Center')}
                <Sparkles className="text-[#5366f6]" size={24} />
              </h1>
              <p className="mt-2 max-w-3xl text-[14px] font-semibold leading-7 text-[#64708f]">
                {copy(
                  'مساحة واحدة لمراجعة إشارات Brand Brain ومهام الموافقة قبل أي نشر أو جدولة. الموافقة هنا لا تعني نشرًا ولا تعلم أداء تلقائي.',
                  'One place to review Brand Brain signals and approval work before publishing or scheduling. Approval here does not publish or create automatic performance learning.',
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/brand" className="inline-flex h-11 items-center gap-2 rounded-[14px] border border-[#d7def0] bg-white px-4 text-sm font-black text-[#111b3f]">
                <Eye size={17} />
                {copy('راجع Brand Brain', 'Review Brand Brain')}
              </Link>
              <Link href="/content-hub" className="inline-flex h-11 items-center gap-2 rounded-[14px] bg-[#071236] px-5 text-sm font-black text-white shadow-[0_16px_34px_rgba(31,41,130,0.22)]">
                {copy('افتح مركز المحتوى', 'Open Content Hub')}
                <ArrowUpRight size={17} />
              </Link>
            </div>
          </header>

          <section className="grid gap-4 lg:grid-cols-5">
            <Metric
              label={copy('إجمالي الطلبات', 'Total requests')}
              value={proposalsLoading ? '...' : String(rows.length)}
              helper={copy('طلبات مراجعة إشارات فقط من المصادر المتاحة.', 'Review requests from available signal sources only.')}
              icon={<MessageSquare size={22} />}
            />
            <Metric
              label={copy('قيد المراجعة', 'In review')}
              value={proposalsLoading ? '...' : String(rows.length)}
              helper={copy('لا يوجد إجراء تلقائي قبل قرار المستخدم.', 'No automatic action before user decision.')}
              icon={<Clock3 size={22} />}
              tone="amber"
            />
            <Metric
              label={copy('بانتظار إجراء', 'Awaiting action')}
              value={copy('يدوي', 'Manual')}
              helper={copy('أي تطبيق لاحق يجب أن يكون واضحًا ومؤكدًا.', 'Any later apply action must be clear and explicit.')}
              icon={<Timer size={22} />}
            />
            <Metric
              label={copy('تمت الموافقة', 'Approved')}
              value="0"
              helper={copy('لا نعرض موافقات وهمية بدون سجل حقيقي.', 'No fake approvals are shown without a real record.')}
              icon={<CheckCircle2 size={22} />}
              tone="green"
            />
            <Metric
              label={copy('تم الرفض', 'Rejected')}
              value="0"
              helper={copy('يظهر فقط عند وجود قرارات فعلية محفوظة.', 'Shown only when real saved decisions exist.')}
              icon={<XCircle size={22} />}
              tone="rose"
            />
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.25fr)_minmax(320px,0.75fr)]">
            <Card>
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black tracking-[-0.03em] text-[#071236]">{copy('المحتوى قيد المراجعة', 'Content in review')}</h2>
                  <p className="mt-1 text-[12px] font-semibold text-[#7b87a3]">
                    {copy('مصدرها الحالي إشارات Brand Brain القابلة للمراجعة.', 'Currently sourced from reviewable Brand Brain signals.')}
                  </p>
                </div>
                <span className="rounded-full bg-[#f1f0ff] px-2.5 py-1 text-[11px] font-black text-[#5366f6]">
                  {rows.length}
                </span>
              </div>

              <div className="space-y-3">
                {proposalsLoading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="h-20 animate-pulse rounded-[18px] bg-[#edf1f8]" />
                  ))
                ) : rows.length > 0 ? (
                  rows.map((proposal) => (
                    <div key={proposal.id} className="rounded-[18px] border border-[#e7ecf6] bg-[#fbfcff] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-[14px] font-black text-[#111b3f]">
                          {proposal.title || proposal.type || copy('إشارة Brand Brain', 'Brand Brain signal')}
                        </p>
                        <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700">
                          {copy('قيد المراجعة', 'In review')}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-[12px] font-semibold leading-5 text-[#7b87a3]">
                        {proposal.summary || copy('إشارة محفوظة للمراجعة، وليست تعلمًا أدائيًا حتى توجد تحليلات حقيقية.', 'Saved for review, not performance learning until real analytics exist.')}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[18px] border border-dashed border-[#d7def0] bg-[#fbfcff] p-6 text-center">
                    <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-[#8a96ad]" />
                    <p className="text-[14px] font-black text-[#111b3f]">{copy('لا توجد طلبات موافقة مركزية الآن', 'No central approval requests right now')}</p>
                    <p className="mt-2 text-[12px] font-semibold leading-5 text-[#7b87a3]">
                      {copy('عند ظهور إشارات قابلة للمراجعة أو مهام محتوى، ستظهر هنا بدون أي تنفيذ تلقائي.', 'Reviewable signals or content tasks will appear here without automatic execution.')}
                    </p>
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black tracking-[-0.03em] text-[#071236]">{copy('تفاصيل الطلب', 'Request details')}</h2>
                  <p className="mt-1 text-[12px] font-semibold text-[#7b87a3]">
                    {copy('هذا العرض يشرح الحدود قبل أي قرار.', 'This view explains boundaries before any decision.')}
                  </p>
                </div>
                <span className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-[11px] font-black text-amber-700">
                  {copy('لا يوجد تنفيذ مباشر', 'No direct execution')}
                </span>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)]">
                <div className="overflow-hidden rounded-[22px] border border-[#e7ecf6] bg-[radial-gradient(circle_at_35%_20%,rgba(83,102,246,0.22),transparent_34%),linear-gradient(135deg,#f8faff,#eef2ff)] p-6">
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-[20px] bg-white text-[#5366f6] shadow-sm">
                    <Sparkles size={24} />
                  </div>
                  <h3 className="text-2xl font-black tracking-[-0.04em] text-[#071236]">{copy('مراجعة إشارات لا أوامر', 'Signals, not commands')}</h3>
                  <p className="mt-3 text-[13px] font-semibold leading-6 text-[#64708f]">
                    {copy(
                      'NEXUS يجمع الإشارات ويعرضها للمراجعة. التطبيق أو النشر أو تحديث Brand Brain يحتاج مسارًا واضحًا ومصدر بيانات مناسب.',
                      'NEXUS gathers signals for review. Applying, publishing, or updating Brand Brain needs a clear path and a valid data source.',
                    )}
                  </p>
                </div>
                <div className="space-y-3">
                  {[
                    [copy('قناة القرار', 'Decision channel'), copy('مراجعة بشرية داخل المنتج', 'Human review inside the product')],
                    [copy('حد التعلم', 'Learning boundary'), copy('التعلم الأدائي يتطلب analyticsData حقيقية', 'Performance learning requires real analyticsData')],
                    [copy('حد النشر', 'Publishing boundary'), copy('لا نشر ولا جدولة من مركز الموافقات', 'No publishing or scheduling from approvals')],
                    [copy('حالة التنفيذ', 'Execution state'), copy('محفوظ للمراجعة فقط', 'Saved for review only')],
                  ].map(([label, value]) => (
                    <div key={label} className="grid grid-cols-[0.85fr_1.15fr] gap-3 rounded-[16px] border border-[#e7ecf6] bg-[#fbfcff] p-3 text-[12px]">
                      <span className="font-black text-[#111b3f]">{label}</span>
                      <span className="font-semibold leading-5 text-[#64708f]">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <div className="space-y-5">
              <Card>
                <h2 className="mb-4 text-lg font-black text-[#071236]">{copy('المراجعون', 'Reviewers')}</h2>
                {['Nexus Team', 'Brand Owner', 'Campaign Lead'].map((name, index) => (
                  <div key={name} className="flex items-center justify-between border-b border-[#eef2f8] py-3 last:border-b-0">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-[#f1f0ff] text-[12px] font-black text-[#5366f6]">{name.charAt(0)}</span>
                      <div>
                        <p className="text-[13px] font-black text-[#111b3f]">{name}</p>
                        <p className="text-[11px] font-semibold text-[#8a96ad]">{index === 0 ? copy('مالك القرار', 'Decision owner') : copy('مراجع', 'Reviewer')}</p>
                      </div>
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  </div>
                ))}
              </Card>

              <Card>
                <h2 className="mb-4 text-lg font-black text-[#071236]">{copy('الإجراء السريع', 'Quick action')}</h2>
                <div className="grid gap-3">
                  <Link href="/brand" className="inline-flex h-12 items-center justify-center gap-2 rounded-[15px] bg-[#071236] text-sm font-black text-white">
                    {copy('راجع إشارات Brand Brain', 'Review Brand Brain signals')}
                    <ArrowUpRight size={16} />
                  </Link>
                  <Link href="/content-hub" className="inline-flex h-12 items-center justify-center gap-2 rounded-[15px] border border-[#d7def0] bg-white text-sm font-black text-[#111b3f]">
                    {copy('راجع المحتوى', 'Review content')}
                    <Eye size={16} />
                  </Link>
                </div>
                <p className="mt-3 text-center text-[11px] font-bold leading-5 text-[#8a96ad]">
                  {copy('لا توجد أزرار قبول/رفض مفعّلة هنا حتى يتم ربط سجل قرارات واضح.', 'Approve/reject actions are not enabled here until a clear decision ledger is wired.')}
                </p>
              </Card>
            </div>
          </section>
        </div>
      </main>
    </AppShell>
  )
}
