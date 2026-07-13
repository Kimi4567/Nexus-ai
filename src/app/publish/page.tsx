'use client'

import AppShell from '@/components/AppShell'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import StrategySpineCard from '@/components/StrategySpineCard'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Link2,
  Loader2,
  LockKeyhole,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

interface SocialAccount {
  id: string
  platform: string
  accountName?: string | null
  pageName?: string | null
  isActive?: boolean
}

const platformNames = ['Instagram', 'TikTok', 'Facebook', 'X', 'LinkedIn', 'Snapchat']

function Panel({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`nx-os-card p-5 ${className}`}>
      {children}
    </section>
  )
}

function StatusCard({
  title,
  value,
  helper,
  icon,
  tone = 'violet',
}: {
  title: string
  value: string
  helper: string
  icon: React.ReactNode
  tone?: 'violet' | 'green' | 'amber' | 'blue'
}) {
  const toneClass = {
    violet: 'bg-[#f1f0ff] text-[#5366f6]',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    blue: 'bg-sky-50 text-sky-600',
  }[tone]

  return (
    <Panel>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-bold text-[#64708f]">{title}</p>
          <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#071236]">{value}</p>
          <p className="mt-2 text-[12px] font-semibold leading-5 text-[#7b87a3]">{helper}</p>
        </div>
        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-[18px] ${toneClass}`}>{icon}</span>
      </div>
    </Panel>
  )
}

export default function PublishPage() {
  const { isAuthenticated, loading, authHeader } = useAuth()
  const { locale, dir } = useI18n()
  const router = useRouter()
  const ar = locale === 'ar'
  const copy = (arabic: string, english: string) => (ar ? arabic : english)
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [accountsLoading, setAccountsLoading] = useState(true)

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/auth/login')
  }, [isAuthenticated, loading, router])

  useEffect(() => {
    if (!isAuthenticated) return
    const token = authHeader()
    if (!token) return
    let cancelled = false

    async function loadAccounts() {
      setAccountsLoading(true)
      try {
        const res = await fetch('/api/social/accounts', { headers: { Authorization: token } })
        if (!res.ok) return
        const data = await res.json().catch(() => ({}))
        if (!cancelled) setAccounts(Array.isArray(data.accounts) ? data.accounts : [])
      } finally {
        if (!cancelled) setAccountsLoading(false)
      }
    }

    loadAccounts()
    return () => { cancelled = true }
  }, [authHeader, isAuthenticated])

  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.isActive !== false),
    [accounts],
  )
  const hasVerifiedAccount = activeAccounts.length > 0

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
      <main dir={dir} className="nx-os-page">
        <div className="nx-os-container nx-os-stack">
          <LuxuryWorkspaceHeader
            pageTitle={copy('النشر', 'Publishing')}
            pageSubtitle={copy('جاهزية الحسابات والجدولة والتأكيد قبل أي نشر فعلي.', 'Account readiness, scheduling, and confirmation before real publishing.')}
            primaryHref="/connections"
            primaryLabel={copy('راجع الحسابات', 'Review accounts')}
            secondaryHref="/content-hub"
            secondaryLabel={copy('مركز المحتوى', 'Content Hub')}
          />

          <StrategySpineCard
            current="publish"
            nextHref="/connections"
            nextLabel={copy('ربط الحسابات', 'Connect accounts')}
            title={copy('الخطوة ٥: تحقق ثم انشر', 'Step 5: Verify, then publish')}
            body={copy(
              'لن يتم نشر أي محتوى قبل اكتمال الحسابات والوسائط والموافقة النهائية. ستشاهد سبب المنع بوضوح إذا كان شيء ناقصًا.',
              'Nothing is published until accounts, media, and final approval are ready. If something is missing, the blocker is shown clearly.',
            )}
          />

          <header className="hidden">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-1.5 text-[12px] font-black text-violet-700">
                <Send size={14} />
                {copy('جاهزية نشر فقط', 'Publishing readiness only')}
              </div>
              <h1 className="flex items-center gap-3 text-[22px] font-black text-[#071236]">
                {copy('مركز النشر', 'Publishing Center')}
                <Sparkles className="text-[#5366f6]" size={24} />
              </h1>
              <p className="mt-1 max-w-3xl text-[12px] font-semibold leading-6 text-[#64708f]">
                {copy(
                  'تحكم مركزي في جاهزية الحسابات، الموافقات، الجدولة، وحدود النشر. لا يبدأ NEXUS أي نشر تلقائي أو API publish بدون حساب متصل وتأكيد صريح.',
                  'A central readiness desk for accounts, approvals, scheduling, and publishing limits. NEXUS does not publish automatically or via API without connected accounts and explicit confirmation.',
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/connections"
                className="inline-flex h-11 items-center gap-2 rounded-[14px] border border-[#d7def0] bg-white px-4 text-sm font-black text-[#111b3f]"
              >
                <Link2 size={17} />
                {copy('إدارة الحسابات والمنصات', 'Manage accounts')}
              </Link>
              <Link
                href="/content-hub"
                className="inline-flex h-11 items-center gap-2 rounded-[14px] bg-[#071236] px-5 text-sm font-black text-white shadow-[0_16px_34px_rgba(31,41,130,0.22)]"
              >
                {copy('راجع المحتوى أولاً', 'Review content first')}
                <ArrowUpRight size={17} />
              </Link>
            </div>
          </header>

          <section className="grid gap-4 lg:grid-cols-2">
            <StatusCard
              title={copy('جاهزية النشر', 'Publishing readiness')}
              value={accountsLoading ? '...' : hasVerifiedAccount ? copy('تحتاج مراجعة', 'Review required') : copy('مقفلة', 'Blocked')}
              helper={copy('لا تُعلن الجاهزية إلا بعد توثيق الحساب والمحتوى والوسائط والموافقة.', 'Ready is shown only after account, content, media, and approval are verified.')}
              icon={<ShieldCheck size={22} />}
              tone={hasVerifiedAccount ? 'amber' : 'violet'}
            />
            <StatusCard
              title={copy('الحسابات المتصلة', 'Connected accounts')}
              value={accountsLoading ? '...' : String(activeAccounts.length)}
              helper={copy('لا يتم اعتبار أي منصة جاهزة إلا بعد توثيق الحساب والصلاحيات.', 'A platform is ready only after account and permission checks pass.')}
              icon={<Link2 size={22} />}
              tone="blue"
            />
          </section>

          <section className="grid gap-5">
            <Panel className="hidden">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black tracking-[-0.03em] text-[#071236]">{copy('مسار جاهزية النشر', 'Publishing readiness path')}</h2>
                  <p className="mt-1 text-[12px] font-semibold text-[#7b87a3]">
                    {copy('هذه مراحل تحقق توضيحية وليست صفوف نشر منفذة. يبدأ التنفيذ فقط بعد مراجعة Content Hub والوسائط والحسابات والتأكيد الصريح.', 'These are explanatory verification stages, not executed publishing rows. Execution begins only after Content Hub, media, account review, and explicit confirmation.')}
                  </p>
                </div>
                <span className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-[12px] font-black text-amber-700">
                  {copy('قيد الجاهزية', 'Readiness gated')}
                </span>
              </div>

              <div className="overflow-hidden rounded-[18px] border border-[#e7ecf6]">
                {[
                  [copy('محتوى جاهز للمراجعة', 'Content ready for review'), copy('يتطلب موافقة نهائية قبل النشر', 'Requires final approval before publishing'), copy('قيد المراجعة', 'In review')],
                  [copy('التحقق من الجدولة داخل NEXUS', 'Check NEXUS scheduling'), copy('هذه خطوة تحقق عامة؛ حالة المنشورات الفعلية تظهر داخل Content Hub', 'This is a general verification step; actual post state appears in Content Hub'), copy('غير مقيّم هنا', 'Not evaluated here')],
                  [copy('نشر عبر API', 'API publish'), copy('مغلق حتى اكتمال الربط والصلاحيات والتأكيد', 'Locked until connection, permissions, and confirmation are complete'), copy('مغلق', 'Locked')],
                ].map((row, index) => (
                  <div key={row[0]} className="grid gap-3 border-b border-[#eef2f8] px-4 py-4 last:border-b-0 md:grid-cols-[1fr_1fr_auto] md:items-center">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#f1f0ff] text-[#5366f6]">{index + 1}</span>
                      <p className="text-[14px] font-black text-[#111b3f]">{row[0]}</p>
                    </div>
                    <p className="text-[12px] font-semibold leading-5 text-[#7b87a3]">{row[1]}</p>
                    <span className="w-fit rounded-full border border-[#e2e8f0] bg-[#fbfcff] px-3 py-1 text-[11px] font-black text-[#64708f]">{row[2]}</span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel>
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black tracking-[-0.03em] text-[#071236]">{copy('حالة الحسابات', 'Account state')}</h2>
                  <p className="mt-1 text-[12px] font-semibold text-[#7b87a3]">
                    {copy('مصدر الحقيقة هو صفحة الربط والصلاحيات.', 'Connections and permissions are the source of truth.')}
                  </p>
                </div>
                <div className={`flex min-w-[150px] items-center gap-3 rounded-[14px] border px-4 py-3 ${hasVerifiedAccount ? 'border-amber-100 bg-amber-50' : 'border-rose-100 bg-rose-50'}`}>
                  <ShieldCheck className={`h-6 w-6 ${hasVerifiedAccount ? 'text-amber-600' : 'text-rose-600'}`} />
                  <div>
                    <p className={`text-lg font-black ${hasVerifiedAccount ? 'text-amber-700' : 'text-rose-700'}`}>
                      {accountsLoading ? '...' : String(activeAccounts.length)}
                    </p>
                    <p className="text-[10px] font-black text-[#64708f]">{copy('حساب موثق', 'verified accounts')}</p>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {platformNames.map((platform) => {
                  const account = activeAccounts.find((item) => item.platform?.toLowerCase().includes(platform.toLowerCase()))
                  return (
                    <div key={platform} className="rounded-[16px] border border-[#e7ecf6] bg-[#fbfcff] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[13px] font-black text-[#111b3f]">{platform}</p>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-black ${account ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {account ? copy('متصل', 'Connected') : copy('غير متصل', 'Not connected')}
                        </span>
                      </div>
                      <p className="mt-2 truncate text-[11px] font-semibold text-[#7b87a3]">
                        {account?.pageName || account?.accountName || copy('اربط الحساب قبل أي نشر منصة.', 'Connect before platform publishing.')}
                      </p>
                    </div>
                  )
                })}
              </div>
            </Panel>
          </section>

          <section className="grid gap-5">
            <Panel className="hidden">
              <h2 className="mb-4 text-lg font-black text-[#071236]">{copy('قائمة التحقق قبل النشر', 'Pre-publish checklist')}</h2>
              {[
                { label: copy('مراجعة النصوص والمطالبات', 'Review copy and claims'), status: copy('غير موثق', 'Not verified'), ready: false },
                { label: copy('مراجعة الوسائط والمقاسات', 'Review media and dimensions'), status: copy('غير موثق', 'Not verified'), ready: false },
                {
                  label: copy('تأكيد الحساب والصلاحيات', 'Confirm account and permissions'),
                  status: hasVerifiedAccount ? copy('يوجد حساب', 'Account found') : copy('مفقود', 'Missing'),
                  ready: hasVerifiedAccount,
                },
                { label: copy('تأكيد يدوي قبل التنفيذ', 'Manual confirmation before execution'), status: copy('مطلوب لاحقًا', 'Required later'), ready: false },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3 border-b border-[#eef2f8] py-3 last:border-b-0">
                  {item.ready ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <Clock3 className="h-4 w-4 shrink-0 text-amber-500" />}
                  <span className="min-w-0 flex-1 text-[13px] font-bold text-[#53617f]">{item.label}</span>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${item.ready ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </Panel>
            <Panel className="hidden">
              <h2 className="mb-4 text-lg font-black text-[#071236]">{copy('خيارات التنفيذ', 'Execution options')}</h2>
              <div className="space-y-3">
                {[copy('حفظ كمسودة', 'Save as draft'), copy('جدولة داخل NEXUS', 'Schedule inside NEXUS'), copy('نشر عبر API بعد الربط', 'API publish after connection')].map((item, index) => (
                  <div key={item} className="flex items-center justify-between rounded-[14px] border border-[#e7ecf6] bg-[#fbfcff] p-3">
                    <span className="text-[13px] font-black text-[#111b3f]">{item}</span>
                    <span className="rounded-full bg-[#f1f0ff] px-2 py-1 text-[10px] font-black text-[#5366f6]">{index === 2 ? copy('مغلق', 'Locked') : copy('مراجعة', 'Review')}</span>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel>
              <h2 className="mb-4 text-lg font-black text-[#071236]">{copy('سجل النشر', 'Publishing log')}</h2>
              <div className="rounded-[16px] border border-dashed border-[#d7def0] bg-[#fbfcff] p-5 text-center">
                <Clock3 className="mx-auto mb-3 h-7 w-7 text-[#8a96ad]" />
                <p className="text-[13px] font-black text-[#111b3f]">{copy('لا توجد أحداث نشر API مؤكدة هنا', 'No confirmed API publish events here')}</p>
                <p className="mt-2 text-[12px] font-semibold leading-5 text-[#7b87a3]">
                  {copy('الأحداث ستظهر فقط بعد تنفيذ نشر حقيقي بتأكيد واضح.', 'Events appear only after real publishing with explicit confirmation.')}
                </p>
              </div>
            </Panel>
          </section>

          <div className="hidden">
            <p className="text-[12px] font-bold text-[#64708f]">
              {copy('النشر الحقيقي يبقى مقفلاً حتى الربط والموافقة والتأكيد الصريح.', 'Real publishing remains locked until connection, approval, and explicit confirmation.')}
            </p>
            <Link href="/connections" className="inline-flex h-11 items-center gap-2 rounded-[14px] bg-[#5366f6] px-5 text-sm font-black text-white">
              {copy('ابدأ من الربط', 'Start with connections')}
              <ArrowUpRight size={17} />
            </Link>
          </div>
        </div>
      </main>
    </AppShell>
  )
}
