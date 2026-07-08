'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowUpRight,
  Bell,
  CheckCircle2,
  Clock3,
  Database,
  GitBranch,
  LockKeyhole,
  PlugZap,
  ShieldCheck,
  Sparkles,
  Workflow,
  Zap,
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'

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
    <div className="rounded-[22px] border border-[#e3e8f3] bg-white p-5 shadow-[0_18px_50px_rgba(13,24,63,0.045)]">
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

function FlowStep({
  icon,
  title,
  helper,
  status,
}: {
  icon: ReactNode
  title: string
  helper: string
  status: string
}) {
  return (
    <div className="rounded-[20px] border border-[#e6ebf6] bg-[#fbfcff] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-[15px] bg-white text-[#5366f6] shadow-sm">{icon}</span>
        <span className="rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-[11px] font-black text-amber-700">{status}</span>
      </div>
      <h3 className="text-[14px] font-black text-[#111b3f]">{title}</h3>
      <p className="mt-2 text-[12px] font-semibold leading-5 text-[#7b87a3]">{helper}</p>
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
        const [socialRes, adRes] = await Promise.allSettled([
          fetch('/api/social/accounts', { headers: { Authorization: token } }),
          fetch('/api/ad-accounts', { headers: { Authorization: token } }),
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

        setConnectionState('ready')
      } catch {
        if (!cancelled) setConnectionState('error')
      }
    }

    loadConnections()
    return () => { cancelled = true }
  }, [authHeader, isAuthenticated])

  const copy = (arabic: string, english: string) => (ar ? arabic : english)

  const automationRows = useMemo(() => [
    {
      icon: <ShieldCheck size={18} />,
      title: copy('مراجعة المحتوى قبل النشر', 'Content review before publishing'),
      helper: copy('يتطلب عناصر محتوى جاهزة ومراجعة صريحة قبل أي نشر أو جدولة.', 'Requires ready content and explicit review before publishing or scheduling.'),
    },
    {
      icon: <PlugZap size={18} />,
      title: copy('نشر عبر API بعد الموافقة', 'API publishing after approval'),
      helper: copy('يتطلب حسابات متصلة وصلاحيات صفحة/منصة وتأكيد نشر واضح.', 'Requires connected accounts, page/platform permissions, and an explicit publish confirmation.'),
    },
    {
      icon: <Database size={18} />,
      title: copy('تعلم من الأداء الحقيقي', 'Learning from real performance'),
      helper: copy('لا يتم تعلم أنماط الأداء إلا بعد وصول analyticsData أو مقاييس منصة موثوقة.', 'Performance learning only starts after analyticsData or trusted platform metrics exist.'),
    },
    {
      icon: <Bell size={18} />,
      title: copy('تنبيهات تشغيلية', 'Operational alerts'),
      helper: copy('تنبهك عند وجود نقص في الوسائط أو الموافقات أو الحسابات قبل التنفيذ.', 'Flags missing media, approvals, or accounts before execution.'),
    },
  ], [ar])

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
      <main dir={dir} className="min-h-screen bg-[#f6f8fc] px-4 py-6 text-[#071236] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1540px] space-y-6">
          <section className="relative overflow-hidden rounded-[30px] border border-[#e3e8f3] bg-white p-6 shadow-[0_24px_70px_rgba(13,24,63,0.07)] lg:p-8">
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
                  {copy('جاهزية الأتمتة فقط', 'Automation readiness only')}
                </div>
                <h1 className="text-3xl font-black tracking-[-0.03em] text-[#071236] lg:text-4xl">
                  {copy('مركز الأتمتة الآمنة', 'Safe Automation Center')}
                </h1>
                <p className="mt-3 max-w-3xl text-[14px] font-semibold leading-7 text-[#64708f]">
                  {copy(
                    'هذه الصفحة تنظم مسارات Autopilot والتشغيل الآلي بدون تفعيل تلقائي. لا نشر، لا إنفاق، ولا تعلم أداء بدون بيانات وموافقة وحدود واضحة.',
                    'This page organizes Autopilot and automation paths without activating them automatically. No publishing, spend, or performance learning happens without data, approval, and clear boundaries.'
                  )}
                </p>
              </div>
              <div className="rounded-[24px] border border-[#e6ebf6] bg-[#fbfcff] p-5">
                <div className="mb-4 flex items-center gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-[18px] bg-[#071236] text-white">
                    <Workflow size={20} />
                  </span>
                  <div>
                    <p className="text-[13px] font-black text-[#111b3f]">{copy('حالة التشغيل الآن', 'Current execution state')}</p>
                    <p className="text-[12px] font-semibold text-[#7b87a3]">
                      {copy('غير مفعّل افتراضيًا لكل حملة', 'Not enabled by default for any campaign')}
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
              title={copy('حالة Autopilot', 'Autopilot state')}
              value={copy('غير مفعّل', 'Not enabled')}
              helper={copy('يُفعّل لاحقًا لكل حملة بعد جاهزية المحتوى والحسابات والموافقات.', 'Enabled later per campaign after content, accounts, and approvals are ready.')}
              tone="warning"
              icon={<LockKeyhole size={20} />}
            />
            <ReadinessCard
              title={copy('حسابات النشر', 'Publishing accounts')}
              value={connectionState === 'loading' ? '...' : String(activeSocialCount)}
              helper={copy('الربط وحده لا يعني نشرًا تلقائيًا.', 'Connection alone does not mean automatic publishing.')}
              icon={<PlugZap size={20} />}
            />
            <ReadinessCard
              title={copy('حسابات الإعلانات', 'Ad accounts')}
              value={connectionState === 'loading' ? '...' : String(activeAdCount)}
              helper={copy('الإنفاق يحتاج ميزانية وموافقة وتشغيل صريح.', 'Spend requires budget, approval, and explicit activation.')}
              icon={<Zap size={20} />}
            />
            <ReadinessCard
              title={copy('تعلم الأداء', 'Performance learning')}
              value={copy('مشروط', 'Gated')}
              helper={copy('يتطلب تحليلات حقيقية، وليس موافقة أو نشرًا يدويًا فقط.', 'Requires real analytics, not approval or manual publishing alone.')}
              tone="ready"
              icon={<Database size={20} />}
            />
          </section>

          <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
            <div className="rounded-[26px] border border-[#e3e8f3] bg-white p-5 shadow-[0_18px_50px_rgba(13,24,63,0.045)]">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-[18px] font-black text-[#071236]">{copy('مسارات الأتمتة المقترحة', 'Suggested automation paths')}</h2>
                  <p className="mt-1 text-[13px] font-semibold text-[#7b87a3]">
                    {copy('كل مسار يبدأ كمراجعة أو تنبيه. لا يوجد تنفيذ نهائي من هذه الصفحة.', 'Each path starts as review or alerting. No final execution happens from this page.')}
                  </p>
                </div>
                <Link href="/connections" className="inline-flex h-10 items-center gap-2 rounded-[14px] border border-[#d9e1f2] bg-white px-4 text-[12px] font-black text-[#5366f6]">
                  {copy('راجع التكاملات', 'Review integrations')} <ArrowUpRight size={14} />
                </Link>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {automationRows.map(row => (
                  <FlowStep
                    key={row.title}
                    icon={row.icon}
                    title={row.title}
                    helper={row.helper}
                    status={copy('يتطلب إعداد', 'Needs setup')}
                  />
                ))}
              </div>
            </div>

            <aside className="space-y-5">
              <div className="rounded-[26px] border border-[#e3e8f3] bg-white p-5 shadow-[0_18px_50px_rgba(13,24,63,0.045)]">
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

              <div className="rounded-[26px] border border-violet-100 bg-violet-50/70 p-5">
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

              <div className="rounded-[22px] border border-[#e3e8f3] bg-white p-4 text-[12px] font-semibold leading-6 text-[#7b87a3]">
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
