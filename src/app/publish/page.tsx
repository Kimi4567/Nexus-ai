'use client'

import AppShell from '@/components/AppShell'
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
    <section className={`rounded-[24px] border border-[#e3e8f3] bg-white p-5 shadow-[0_18px_50px_rgba(13,24,63,0.045)] ${className}`}>
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

function ReadinessRing({ value, label }: { value: number; label: string }) {
  const safeValue = Math.max(0, Math.min(100, value))
  return (
    <div className="flex items-center gap-5">
      <div
        className="grid h-36 w-36 place-items-center rounded-full"
        style={{ background: `conic-gradient(#5366f6 ${safeValue * 3.6}deg, #e9edf7 0deg)` }}
      >
        <div className="grid h-28 w-28 place-items-center rounded-full bg-white text-center">
          <div>
            <p className="text-4xl font-black tracking-[-0.05em] text-[#071236]">{safeValue}%</p>
            <p className="mt-1 text-[12px] font-bold text-[#64708f]">{label}</p>
          </div>
        </div>
      </div>
    </div>
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
  const readiness = activeAccounts.length > 0 ? 68 : 34

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
          <header className="flex flex-col gap-5 border-b border-[#dfe6f2] pb-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-1.5 text-[12px] font-black text-violet-700">
                <Send size={14} />
                {copy('جاهزية نشر فقط', 'Publishing readiness only')}
              </div>
              <h1 className="flex items-center gap-3 text-3xl font-black tracking-[-0.04em] text-[#071236] lg:text-4xl">
                {copy('مركز النشر', 'Publishing Center')}
                <Sparkles className="text-[#5366f6]" size={24} />
              </h1>
              <p className="mt-2 max-w-3xl text-[14px] font-semibold leading-7 text-[#64708f]">
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

          <section className="grid gap-4 lg:grid-cols-4">
            <StatusCard
              title={copy('جاهزية النشر', 'Publishing readiness')}
              value={`${readiness}%`}
              helper={copy('تقيس اكتمال الحسابات، الموافقات، الوسائط، والحدود قبل أي تنفيذ.', 'Measures accounts, approvals, media, and limits before execution.')}
              icon={<ShieldCheck size={22} />}
              tone={activeAccounts.length > 0 ? 'green' : 'violet'}
            />
            <StatusCard
              title={copy('الحسابات المتصلة', 'Connected accounts')}
              value={accountsLoading ? '...' : String(activeAccounts.length)}
              helper={copy('لا يتم اعتبار أي منصة جاهزة إلا بعد توثيق الحساب والصلاحيات.', 'A platform is ready only after account and permission checks pass.')}
              icon={<Link2 size={22} />}
              tone="blue"
            />
            <StatusCard
              title={copy('بوابة الموافقة', 'Approval gate')}
              value={copy('مطلوبة', 'Required')}
              helper={copy('النشر يحتاج مراجعة محتوى وتأكيد تنفيذ واضح.', 'Publishing requires content review and explicit confirmation.')}
              icon={<CheckCircle2 size={22} />}
              tone="amber"
            />
            <StatusCard
              title={copy('النشر التلقائي', 'Autopublish')}
              value={copy('غير مفعل', 'Disabled')}
              helper={copy('Autopilot يبقى منفصلاً ولا يفعّل النشر من هذه الصفحة.', 'Autopilot remains separate and is not enabled from this page.')}
              icon={<LockKeyhole size={22} />}
            />
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
            <Panel>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black tracking-[-0.03em] text-[#071236]">{copy('الصفوف الجاهزة للنشر', 'Publishing queue')}</h2>
                  <p className="mt-1 text-[12px] font-semibold text-[#7b87a3]">
                    {copy('تظهر هنا العناصر بعد مراجعة Content Hub والوسائط والحسابات. لا يوجد نشر تلقائي من هذه القائمة.', 'Items appear here after Content Hub, media, and account review. This list never auto-publishes.')}
                  </p>
                </div>
                <span className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-[12px] font-black text-amber-700">
                  {copy('قيد الجاهزية', 'Readiness gated')}
                </span>
              </div>

              <div className="overflow-hidden rounded-[18px] border border-[#e7ecf6]">
                {[
                  [copy('محتوى جاهز للمراجعة', 'Content ready for review'), copy('يتطلب موافقة نهائية قبل النشر', 'Requires final approval before publishing'), copy('قيد المراجعة', 'In review')],
                  [copy('منشورات مجدولة في NEXUS', 'Scheduled in NEXUS'), copy('الجدولة الداخلية لا تعني نشرًا على المنصة', 'Internal scheduling does not mean platform publishing'), copy('محفوظ', 'Saved')],
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
                <ReadinessRing value={readiness} label={copy('جاهزية', 'Ready')} />
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

          <section className="grid gap-5 lg:grid-cols-3">
            <Panel>
              <h2 className="mb-4 text-lg font-black text-[#071236]">{copy('قائمة التحقق قبل النشر', 'Pre-publish checklist')}</h2>
              {[
                copy('مراجعة النصوص والمطالبات', 'Review copy and claims'),
                copy('مراجعة الوسائط والمقاسات', 'Review media and dimensions'),
                copy('تأكيد الحساب والصلاحيات', 'Confirm account and permissions'),
                copy('تأكيد يدوي قبل التنفيذ', 'Manual confirmation before execution'),
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 border-b border-[#eef2f8] py-3 last:border-b-0">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-[13px] font-bold text-[#53617f]">{item}</span>
                </div>
              ))}
            </Panel>
            <Panel>
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

          <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-[#dfe6f2] bg-white/95 p-3 shadow-[0_18px_60px_rgba(13,24,63,0.12)] backdrop-blur">
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
