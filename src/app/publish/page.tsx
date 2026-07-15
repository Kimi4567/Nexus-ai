'use client'

import AppShell from '@/components/AppShell'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import { useAuth } from '@/lib/auth-context'
import { isContentPostMediaReadyForScheduling } from '@/lib/contentHubMediaState'
import { useI18n } from '@/lib/i18n-context'
import { derivePlatformReadiness, type PlatformKey } from '@/lib/platformReadiness'
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Link2,
  Loader2,
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
  status?: string | null
  pages?: Array<{ id?: string | null; name?: string | null; igAccountId?: string | null }> | null
}

interface CampaignRecord {
  id: string
  name: string
}

interface PublishingPost {
  id: string
  campaignId: string
  campaignName: string
  platform: string
  status?: string | null
  publishMode?: string | null
  scheduledAt?: string | null
  publishedAt?: string | null
  manuallyPublishedAt?: string | null
  platformUrl?: string | null
  imageUrl?: string | null
  uploadedMediaId?: string | null
  mediaSource?: string | null
  generationStatus?: string | null
}

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
  const { locale, dir, t } = useI18n()
  const router = useRouter()
  const ar = locale === 'ar'
  const copy = (arabic: string, english: string) => (ar ? arabic : english)
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [posts, setPosts] = useState<PublishingPost[]>([])
  const [accountsLoading, setAccountsLoading] = useState(true)

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/auth/login')
  }, [isAuthenticated, loading, router])

  useEffect(() => {
    if (!isAuthenticated) return
    const token = authHeader()
    if (!token) return
    let cancelled = false

    async function loadPublishingState() {
      setAccountsLoading(true)
      try {
        const [accountRes, campaignRes] = await Promise.all([
          fetch('/api/social/accounts', { headers: { Authorization: token } }),
          fetch('/api/campaigns?limit=20&sort=updatedAt', { headers: { Authorization: token } }),
        ])
        const [accountData, campaignData] = await Promise.all([
          accountRes.json().catch(() => ({})),
          campaignRes.json().catch(() => ({})),
        ])
        if (cancelled) return
        setAccounts(accountRes.ok && Array.isArray(accountData.accounts) ? accountData.accounts : [])

        const campaigns: CampaignRecord[] = campaignRes.ok && Array.isArray(campaignData.campaigns)
          ? campaignData.campaigns
          : []
        const planResults = await Promise.allSettled(campaigns.slice(0, 12).map(async campaign => {
          const response = await fetch(`/api/campaigns/${campaign.id}/content-plan`, {
            headers: { Authorization: token },
          })
          if (!response.ok) return []
          const data = await response.json().catch(() => ({}))
          return (Array.isArray(data.posts) ? data.posts : []).map((post: Omit<PublishingPost, 'campaignId' | 'campaignName'>) => ({
            ...post,
            campaignId: campaign.id,
            campaignName: campaign.name,
          }))
        }))
        if (!cancelled) {
          setPosts(planResults.flatMap(result => result.status === 'fulfilled' ? result.value : []))
        }
      } finally {
        if (!cancelled) setAccountsLoading(false)
      }
    }

    loadPublishingState()
    return () => { cancelled = true }
  }, [authHeader, isAuthenticated])

  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.isActive !== false),
    [accounts],
  )
  const platformStates = useMemo(() => derivePlatformReadiness(activeAccounts), [activeAccounts])
  const publishingPlatforms = useMemo(() => {
    const order: PlatformKey[] = [
      'facebook',
      'instagram',
      'tiktok',
      'linkedin',
      'x',
      'threads',
      'youtube',
      'pinterest',
    ]
    return order.map(key => platformStates.find(state => state.key === key)).filter(Boolean)
  }, [platformStates])
  const hasConnectedAccount = activeAccounts.length > 0
  const hasVerifiedPublisher = platformStates.some(state => state.status === 'ready' && state.key !== 'paid')
  const publishingState = useMemo(() => {
    const normalizeStatus = (post: PublishingPost) => String(post.status || 'DRAFT').toUpperCase()
    const drafts = posts.filter(post => normalizeStatus(post) === 'DRAFT').length
    const approved = posts.filter(post => normalizeStatus(post) === 'APPROVED').length
    const mediaConfirmed = posts.filter(isContentPostMediaReadyForScheduling).length
    const approvedMissingMedia = posts.filter(post => (
      normalizeStatus(post) === 'APPROVED' && !isContentPostMediaReadyForScheduling(post)
    )).length
    const readyToSchedule = posts.filter(post => (
      normalizeStatus(post) === 'APPROVED' && isContentPostMediaReadyForScheduling(post)
    )).length
    const scheduled = posts.filter(post => (
      normalizeStatus(post) === 'SCHEDULED'
      && Boolean(post.scheduledAt && !Number.isNaN(new Date(post.scheduledAt).getTime()))
    )).length
    const publishedPosts = posts
      .filter(post => normalizeStatus(post) === 'PUBLISHED')
      .sort((a, b) => String(b.publishedAt || b.manuallyPublishedAt || '').localeCompare(String(a.publishedAt || a.manuallyPublishedAt || '')))

    return {
      total: posts.length,
      drafts,
      approved,
      mediaConfirmed,
      approvedMissingMedia,
      readyToSchedule,
      scheduled,
      publishedPosts,
    }
  }, [posts])

  const readinessLabel = accountsLoading
    ? '...'
    : !hasVerifiedPublisher
      ? copy('مقفلة', 'Blocked')
      : publishingState.total === 0
        ? copy('بانتظار المحتوى', 'Waiting for content')
        : publishingState.approvedMissingMedia > 0
          ? copy('أكمل الوسائط', 'Complete media')
          : publishingState.readyToSchedule > 0
            ? copy('قرار جدولة', 'Scheduling decision')
            : publishingState.drafts > 0
              ? copy('موافقة مطلوبة', 'Approval required')
              : publishingState.scheduled > 0
                ? copy('مجدول', 'Scheduled')
                : copy('تحتاج مراجعة', 'Review required')

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
            journeyStage="execution"
            pageTitle={copy('جاهزية النشر', 'Publishing readiness')}
            pageSubtitle={copy('أداة تحقق داخل التنفيذ لحالة المحتوى والوسائط والجدولة والحسابات قبل أي نشر.', 'An Execution verification tool for content, media, scheduling, and account state before publishing.')}
            primaryHref="/connections"
            primaryLabel={copy('راجع الحسابات', 'Review accounts')}
            secondaryHref="/content-hub"
            secondaryLabel={copy('مركز المحتوى', 'Content Hub')}
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

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatusCard
              title={copy('جاهزية النشر', 'Publishing readiness')}
              value={readinessLabel}
              helper={copy('الحالة محسوبة من المنشورات الحالية والحسابات المتصلة؛ ولا تعني أن نشرًا حدث.', 'Calculated from current posts and connected accounts; it never implies publishing occurred.')}
              icon={<ShieldCheck size={22} />}
              tone={hasVerifiedPublisher ? 'amber' : 'violet'}
            />
            <StatusCard
              title={copy('الحسابات المتصلة', 'Connected accounts')}
              value={accountsLoading ? '...' : String(activeAccounts.length)}
              helper={copy('الاتصال المسجل لا يثبت وحده صلاحية نشر كل منشور.', 'A saved connection alone does not prove each post can publish.')}
              icon={<Link2 size={22} />}
              tone="blue"
            />
            <StatusCard
              title={copy('وسائط مؤكدة', 'Confirmed media')}
              value={accountsLoading ? '...' : `${publishingState.mediaConfirmed}/${publishingState.total}`}
              helper={copy(`${publishingState.approvedMissingMedia} نص معتمد ما زال يحتاج وسائط.`, `${publishingState.approvedMissingMedia} approved copy items still need media.`)}
              icon={<Sparkles size={22} />}
              tone={publishingState.approvedMissingMedia > 0 ? 'amber' : 'green'}
            />
            <StatusCard
              title={copy('خطة NEXUS الزمنية', 'NEXUS schedule records')}
              value={accountsLoading ? '...' : String(publishingState.scheduled)}
              helper={copy(
                `${publishingState.scheduled} سجل محفوظ في تقويم NEXUS ولم يُنشر عبر منصة؛ ${publishingState.readyToSchedule} ينتظر قرار الجدولة.`,
                `${publishingState.scheduled} saved in the NEXUS calendar and not published to a platform; ${publishingState.readyToSchedule} await a scheduling decision.`,
              )}
              icon={<Clock3 size={22} />}
              tone={publishingState.scheduled > 0 ? 'green' : 'violet'}
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
                <div className={`flex min-w-[150px] items-center gap-3 rounded-[14px] border px-4 py-3 ${hasConnectedAccount ? 'border-amber-100 bg-amber-50' : 'border-rose-100 bg-rose-50'}`}>
                  <ShieldCheck className={`h-6 w-6 ${hasConnectedAccount ? 'text-amber-600' : 'text-rose-600'}`} />
                  <div>
                    <p className={`text-lg font-black ${hasConnectedAccount ? 'text-amber-700' : 'text-rose-700'}`}>
                      {accountsLoading ? '...' : String(activeAccounts.length)}
                    </p>
                    <p className="text-[10px] font-black text-[#64708f]">{copy('حساب متصل', 'connected accounts')}</p>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {publishingPlatforms.map((state) => {
                  if (!state) return null
                  const ready = state.status === 'ready'
                  const blocked = state.status === 'not_available'
                  return (
                    <div key={state.key} className="rounded-[16px] border border-[#e7ecf6] bg-[#fbfcff] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[13px] font-black text-[#111b3f]">{String(t(state.nameKey))}</p>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-black ${ready ? 'bg-emerald-50 text-emerald-700' : blocked ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700'}`}>
                          {String(t(state.chipKey))}
                        </span>
                      </div>
                      <p className="mt-2 text-[11px] font-semibold leading-5 text-[#7b87a3]">
                        {String(t(state.lineKey))}
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
                  status: hasConnectedAccount ? copy('يوجد حساب', 'Account found') : copy('مفقود', 'Missing'),
                  ready: hasConnectedAccount,
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
              {publishingState.publishedPosts.length === 0 ? (
                <div className="rounded-[16px] border border-dashed border-[#d7def0] bg-[#fbfcff] p-5 text-center">
                  <Clock3 className="mx-auto mb-3 h-7 w-7 text-[#8a96ad]" />
                  <p className="text-[13px] font-black text-[#111b3f]">{copy('لا توجد أحداث نشر مؤكدة', 'No confirmed publishing events')}</p>
                  <p className="mt-2 text-[12px] font-semibold leading-5 text-[#7b87a3]">
                    {copy('لن يظهر سجل إلا بعد تأكيد نشر حقيقي عبر API أو بواسطة المستخدم.', 'A log appears only after real API publishing or user-confirmed manual publishing.')}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {publishingState.publishedPosts.slice(0, 6).map(post => (
                    <div key={post.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-[#e7ecf6] bg-[#fbfcff] p-4">
                      <div>
                        <p className="text-[13px] font-black text-[#111b3f]">{post.campaignName}</p>
                        <p className="mt-1 text-[11px] font-semibold text-[#7b87a3]">
                          {post.platform} · {post.manuallyPublishedAt ? copy('أكده المستخدم يدويًا', 'User-confirmed manual publish') : copy('أكدته المنصة عبر API', 'Platform-confirmed API publish')}
                        </p>
                      </div>
                      {post.platformUrl ? (
                        <a href={post.platformUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-[12px] border border-[#d7def0] bg-white px-3 text-[11px] font-black text-[#5366f6]">
                          {copy('فتح المنشور', 'Open post')}<ArrowUpRight size={13} />
                        </a>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-700">{copy('مؤكد بلا رابط', 'Confirmed without URL')}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
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
