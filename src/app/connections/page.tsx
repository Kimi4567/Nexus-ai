'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import AppShell from '@/components/AppShell'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import StrategySpineCard from '@/components/StrategySpineCard'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { derivePlatformReadiness } from '@/lib/platformReadiness'
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  Database,
  KeyRound,
  Link2,
  Loader2,
  MoreVertical,
  Plug,
  RefreshCw,
  Shield,
  Sparkles,
  Unplug,
  Zap,
} from 'lucide-react'

interface ConnectedAccount {
  id: string
  platform: string
  accountName: string
  pages: Array<{ id: string; name: string; igAccountId: string | null }>
  connectedAt: string
}

interface ConnectedAdAccount {
  id: string
  platform: string
  status: string
  platformAccountId: string
  platformAccountName: string | null
  businessName: string | null
  hasApiAccess: boolean
  pageId: string | null
  pageName: string | null
}

interface PlatformDef {
  id: string
  name: { ar: string; en: string }
  helper: { ar: string; en: string }
  scope: { ar: string; en: string }
  available: boolean
  accent: string
  icon: string
}

const PLATFORMS: PlatformDef[] = [
  {
    id: 'META',
    name: { ar: 'Meta Ads', en: 'Meta Ads' },
    helper: {
      ar: 'فيسبوك وإنستغرام للنشر العضوي وتجهيز الإعلانات بعد التصاريح.',
      en: 'Facebook and Instagram for organic publishing and ads after permissions.',
    },
    scope: { ar: 'نشر عضوي + إعلانات بعد الموافقة', en: 'Organic + ads after approval' },
    available: true,
    accent: '#2563eb',
    icon: '∞',
  },
  {
    id: 'LINKEDIN',
    name: { ar: 'LinkedIn', en: 'LinkedIn' },
    helper: {
      ar: 'منشورات مهنية وصفحات شركات، مع مراجعة الصلاحيات قبل أي نشر.',
      en: 'Professional posts and company pages with permission checks before publishing.',
    },
    scope: { ar: 'نشر عضوي مهني', en: 'Professional organic publishing' },
    available: true,
    accent: '#0a66c2',
    icon: 'in',
  },
  {
    id: 'TIKTOK',
    name: { ar: 'TikTok', en: 'TikTok' },
    helper: {
      ar: 'فيديوهات قصيرة ومحتوى اجتماعي، لا يتم النشر إلا بعد موافقة صريحة.',
      en: 'Short-form social content, published only after explicit approval.',
    },
    scope: { ar: 'محتوى قصير', en: 'Short-form content' },
    available: true,
    accent: '#111827',
    icon: '♪',
  },
  {
    id: 'SNAPCHAT',
    name: { ar: 'Snapchat Ads', en: 'Snapchat Ads' },
    helper: {
      ar: 'مخطط ضمن خريطة التنفيذ. لن يظهر كجاهز قبل تكامل رسمي.',
      en: 'Planned in the execution map. It will not appear ready before official integration.',
    },
    scope: { ar: 'مخطط', en: 'Planned' },
    available: false,
    accent: '#facc15',
    icon: 'S',
  },
  {
    id: 'GOOGLE',
    name: { ar: 'Google Ads', en: 'Google Ads' },
    helper: {
      ar: 'مخطط للإعلانات والقياس. يحتاج إعدادات وتصاريح منفصلة.',
      en: 'Planned for ads and measurement. Requires separate setup and permissions.',
    },
    scope: { ar: 'مخطط', en: 'Planned' },
    available: false,
    accent: '#4285f4',
    icon: 'G',
  },
  {
    id: 'YOUTUBE',
    name: { ar: 'YouTube', en: 'YouTube' },
    helper: {
      ar: 'مخطط للفيديو والشورتس. التنفيذ الحقيقي سيأتي بعد الربط الرسمي.',
      en: 'Planned for video and Shorts. Real execution comes after official connection.',
    },
    scope: { ar: 'مخطط', en: 'Planned' },
    available: false,
    accent: '#ef4444',
    icon: '▶',
  },
]

const CONNECT_ROUTES: Record<string, string> = {
  META: '/api/social/connect/meta',
  META_ADS: '/api/social/connect/meta-ads',
  LINKEDIN: '/api/social/connect/linkedin',
  TIKTOK: '/api/social/connect/tiktok',
}

function ShellButton({
  children,
  onClick,
  disabled,
  loading,
  tone = 'secondary',
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  tone?: 'primary' | 'secondary' | 'danger' | 'ghost'
  className?: string
}) {
  const toneClass = {
    primary: 'bg-[#071236] text-white shadow-[0_18px_38px_rgba(18,26,66,0.24)] hover:bg-[#111d4d]',
    secondary: 'border border-[#e3e8f3] bg-white text-[#111b3f] hover:border-[#c9d4ea] hover:bg-[#f8faff]',
    danger: 'border border-rose-100 bg-rose-50 text-rose-700 hover:bg-rose-100',
    ghost: 'border border-transparent bg-transparent text-[#53617f] hover:bg-white',
  }[tone]

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-[13px] px-4 text-[13px] font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${toneClass} ${className}`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  )
}

function Panel({
  title,
  icon,
  children,
  className = '',
  action,
}: {
  title: string
  icon?: ReactNode
  children: ReactNode
  className?: string
  action?: ReactNode
}) {
  return (
    <section className={`rounded-[22px] border border-[#e5eaf5] bg-white p-5 shadow-[0_18px_50px_rgba(13,24,63,0.045)] ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-black text-[#111b3f]">
          {icon ? <span className="text-[#4f46e5]">{icon}</span> : null}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function StatCard({
  label,
  value,
  helper,
  icon,
  tone = 'indigo',
}: {
  label: string
  value: string
  helper: string
  icon: ReactNode
  tone?: 'indigo' | 'emerald' | 'amber' | 'blue'
}) {
  const toneClass = {
    indigo: 'bg-[#f0efff] text-[#4f46e5]',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    blue: 'bg-blue-50 text-blue-600',
  }[tone]

  return (
    <div className="rounded-[20px] border border-[#e6ebf5] bg-white p-4 shadow-[0_16px_42px_rgba(13,24,63,0.035)]">
      <div className="mb-4 flex items-center justify-between">
        <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${toneClass}`}>{icon}</span>
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
      </div>
      <p className="text-[12px] font-bold text-[#65718e]">{label}</p>
      <p className="mt-1 text-[28px] font-black tracking-[-0.03em] text-[#071236]">{value}</p>
      <p className="mt-1 text-[11px] leading-5 text-[#7d89a3]">{helper}</p>
    </div>
  )
}

function StatusPill({ children, tone }: { children: ReactNode; tone: 'ready' | 'needs' | 'planned' }) {
  const toneClass = {
    ready: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    needs: 'bg-amber-50 text-amber-700 border-amber-100',
    planned: 'bg-slate-50 text-slate-600 border-slate-200',
  }[tone]

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-black ${toneClass}`}>
      {children}
    </span>
  )
}

export default function ConnectionsPage() {
  const { isAuthenticated, loading, authHeader, session } = useAuth()
  const { locale, dir } = useI18n()
  const ar = locale === 'ar'
  const copy = (arabic: string, english: string) => (ar ? arabic : english)

  const [accounts, setAccounts] = useState<ConnectedAccount[]>([])
  const [adAccounts, setAdAccounts] = useState<ConnectedAdAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchAccounts = useCallback(async () => {
    const token = authHeader()
    if (!token) return
    setLoadingAccounts(true)
    try {
      const [socialRes, adRes] = await Promise.all([
        fetch('/api/social/accounts', { headers: { Authorization: token } }),
        fetch('/api/ad-accounts', { headers: { Authorization: token } }),
      ])
      const socialData = await socialRes.json()
      const adData = await adRes.json()
      setAccounts(socialData.accounts || [])
      setAdAccounts(adData.accounts || [])
    } catch {
      setAccounts([])
      setAdAccounts([])
    } finally {
      setLoadingAccounts(false)
    }
  }, [authHeader])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const social = params.get('social')
    const platform = params.get('platform')

    if (social === 'connected') {
      const platformName = platform ? platform.toUpperCase() : copy('المنصة', 'platform')
      setMessage({
        type: 'success',
        text: copy(`تم ربط ${platformName}. راجع الصلاحيات قبل أي تشغيل.`, `${platformName} connected. Review permissions before execution.`),
      })
      window.history.replaceState({}, '', '/connections')
      setTimeout(() => setMessage(null), 5000)
    } else if (social === 'error' || social === 'denied') {
      const rawMsg = params.get('msg')
      setMessage({
        type: 'error',
        text: rawMsg
          ? copy(`تعذر إكمال الربط: ${decodeURIComponent(rawMsg)}`, `Connection failed: ${decodeURIComponent(rawMsg)}`)
          : copy('تعذر إكمال الربط. حاول مرة أخرى بعد مراجعة إعدادات المنصة.', 'Connection failed. Review platform settings and try again.'),
      })
      window.history.replaceState({}, '', '/connections')
      setTimeout(() => setMessage(null), 9000)
    }
  }, [copy])

  useEffect(() => {
    if (!loading && isAuthenticated && session?.access_token) fetchAccounts()
  }, [fetchAccounts, isAuthenticated, loading, session])

  const handleConnect = async (platformId: string) => {
    const route = CONNECT_ROUTES[platformId]
    if (!route) return

    const token = authHeader()
    if (!token) {
      setMessage({
        type: 'error',
        text: copy('انتهت صلاحية الجلسة. سجل الدخول مرة أخرى ثم حاول الربط.', 'Session expired. Sign in again, then try connecting.'),
      })
      return
    }

    setConnecting(platformId)
    try {
      const res = await fetch(route, { headers: { Authorization: token } })
      if (res.status === 401) {
        setMessage({
          type: 'error',
          text: copy('انتهت صلاحية الجلسة. سجل الدخول مرة أخرى ثم حاول الربط.', 'Session expired. Sign in again, then try connecting.'),
        })
        setConnecting(null)
        return
      }

      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setMessage({
          type: 'error',
          text: data.error || copy('تعذر بدء الربط من NEXUS.', 'NEXUS could not start the connection.'),
        })
        setConnecting(null)
      }
    } catch {
      setMessage({
        type: 'error',
        text: copy('حدث خطأ في الاتصال. لم يتم تغيير أي بيانات.', 'Connection error. No data was changed.'),
      })
      setConnecting(null)
    }
  }

  const handleDisconnect = async (integrationId: string) => {
    setDisconnecting(integrationId)
    try {
      await fetch('/api/social/accounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
        body: JSON.stringify({ integrationId }),
      })
      setAccounts((prev) => prev.filter((account) => account.id !== integrationId))
      setMessage({
        type: 'success',
        text: copy('تم فصل الحساب. لن يستخدمه NEXUS في النشر أو التنفيذ.', 'Account disconnected. NEXUS will not use it for publishing or execution.'),
      })
      setTimeout(() => setMessage(null), 3000)
    } catch {
      setMessage({
        type: 'error',
        text: copy('تعذر فصل الحساب. لم يتم تغيير حالة الربط محلياً.', 'Could not disconnect the account. Local connection state was not changed.'),
      })
    } finally {
      setDisconnecting(null)
    }
  }

  const metaAdAccounts = adAccounts.filter((account) =>
    account.platform?.toUpperCase() === 'META' && account.status?.toUpperCase() !== 'DISCONNECTED',
  )

  const readinessStates = useMemo(() => derivePlatformReadiness(accounts as any, adAccounts), [accounts, adAccounts])
  const connectedCount = accounts.length + metaAdAccounts.length
  const connectedOrganicCount = accounts.length
  const apiReadyCount = [
    accounts.some((account) => account.platform === 'META'),
    accounts.some((account) => account.platform === 'LINKEDIN'),
    accounts.some((account) => account.platform === 'TIKTOK'),
    metaAdAccounts.some((account) => account.hasApiAccess),
  ].filter(Boolean).length
  const needsActionCount = readinessStates.filter((state) =>
    state.status === 'needs_setup' || state.status === 'not_connected' || state.status === 'permission_unverified',
  ).length

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-screen items-center justify-center bg-[#f6f8fc]">
          <Loader2 className="h-9 w-9 animate-spin text-[#4f46e5]" />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <main dir={dir} className="min-h-screen bg-[#f6f8fc] text-[#111b3f]">
        <div className="mx-auto max-w-[1540px] px-6 py-7 lg:px-8">
          <LuxuryWorkspaceHeader
            pageTitle={copy('التكاملات', 'Integrations')}
            pageSubtitle={copy('حسابات المنصات والصلاحيات قبل أي نشر أو إنفاق.', 'Platform accounts and permissions before publishing or spend.')}
            primaryHref="/connections"
            primaryLabel={copy('استكشف مجلد التكاملات', 'Explore integrations')}
            secondaryHref="/settings"
            secondaryLabel={copy('الإعدادات', 'Settings')}
          />

          <StrategySpineCard
            current="publish"
            nextHref="/publish"
            nextLabel={copy('افتح جاهزية النشر', 'Open publish readiness')}
            title={copy('الربط يفتح القدرة التنفيذية، لكنه لا ينفّذ الاستراتيجية وحده', 'Connections unlock execution capability, but do not execute strategy alone')}
            body={copy(
              'كل منصة متصلة تصبح مدخلًا للنشر أو القياس أو الإعلانات بعد الاستراتيجية والمحتوى والموافقة. الربط لا يعني نشرًا تلقائيًا ولا صرف ميزانية.',
              'Each connected platform becomes an input for publishing, measurement, or ads after strategy, content, and approval. Connection does not mean automatic publishing or budget spend.',
            )}
            className="mb-5"
          />

          <header className="mb-7 flex flex-col gap-5 rounded-[26px] border border-[#e3e8f3] bg-white p-5 shadow-[0_18px_55px_rgba(13,24,63,0.045)] xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#071236] text-white shadow-[0_18px_40px_rgba(13,24,63,0.22)]">
                <Link2 size={27} />
              </div>
              <div>
                <p className="text-[12px] font-bold text-[#64708f]">{copy('نظام التشغيل التسويقي', 'Marketing operating system')}</p>
                <h1 className="mt-1 flex items-center gap-2 text-[30px] font-black tracking-[-0.02em] text-[#071236]">
                  {copy('التكاملات', 'Integrations')}
                  <Sparkles className="text-[#4f46e5]" size={24} />
                </h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-[#60708f]">
                  {copy(
                    'اربط المنصات التي ستستخدمها NEXUS لاحقاً في النشر، القياس، والإعلانات. الربط لا يعني نشر أو إنفاق تلقائي.',
                    'Connect the platforms NEXUS can later use for publishing, measurement, and ads. Connecting never means automatic publishing or spend.',
                  )}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <ShellButton onClick={fetchAccounts} loading={loadingAccounts}>
                <RefreshCw className="h-4 w-4" />
                {copy('تحديث الحالة', 'Refresh status')}
              </ShellButton>
              <ShellButton tone="primary" onClick={() => handleConnect('META')} loading={connecting === 'META'}>
                <Plug className="h-4 w-4" />
                {copy('ابدأ بربط Meta', 'Start with Meta')}
              </ShellButton>
            </div>
          </header>

          {message ? (
            <div
              className={`mb-6 flex items-center gap-3 rounded-[18px] border px-5 py-4 text-sm font-semibold ${
                message.type === 'success'
                  ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                  : 'border-rose-100 bg-rose-50 text-rose-700'
              }`}
            >
              {message.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
              <span>{message.text}</span>
              <button type="button" onClick={() => setMessage(null)} className="ms-auto text-lg opacity-70 hover:opacity-100">
                ×
              </button>
            </div>
          ) : null}

          <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label={copy('التكاملات المتصلة', 'Connected integrations')}
              value={loadingAccounts ? '…' : String(connectedCount)}
              helper={copy('حسابات عضوية ومدفوعة محفوظة.', 'Saved organic and paid connections.')}
              icon={<BadgeCheck size={21} />}
              tone="emerald"
            />
            <StatCard
              label={copy('جاهزية الصلاحيات', 'Permission readiness')}
              value={loadingAccounts ? '…' : `${apiReadyCount}/4`}
              helper={copy('صلاحيات يمكن استخدامها بعد المراجعة.', 'Permissions available after review.')}
              icon={<KeyRound size={21} />}
            />
            <StatCard
              label={copy('تحتاج إجراء', 'Needs action')}
              value={loadingAccounts ? '…' : String(needsActionCount)}
              helper={copy('حالات غير جاهزة أو قيد التصاريح.', 'Not-ready or permission-pending states.')}
              icon={<AlertCircle size={21} />}
              tone="amber"
            />
            <StatCard
              label={copy('مصادر البيانات', 'Data sources')}
              value={loadingAccounts ? '…' : `${connectedOrganicCount}`}
              helper={copy('مداخل يمكن أن تدعم النشر والتحليل لاحقاً.', 'Inputs that can later support publishing and analytics.')}
              icon={<Database size={21} />}
              tone="blue"
            />
          </section>

          <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
            <div className="space-y-6">
              <Panel
                title={copy('التكاملات المتصلة والقابلة للربط', 'Connected and available integrations')}
                icon={<Plug size={18} />}
                action={<span className="text-[12px] font-bold text-[#64708f]">{copy('كل إجراء يحتاج موافقة منفصلة', 'Every execution still needs approval')}</span>}
              >
                <div className="grid gap-4 lg:grid-cols-2">
                  {PLATFORMS.map((platform) => {
                    const connectedAccount = accounts.find((account) => account.platform === platform.id)
                    const isConnected = Boolean(connectedAccount)
                    const isConnecting = connecting === platform.id
                    const isDisconnecting = disconnecting === connectedAccount?.id

                    return (
                      <article key={platform.id} className="rounded-[20px] border border-[#e8edf7] bg-[#fbfcff] p-4">
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span
                              className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-white text-lg font-black shadow-sm"
                              style={{ color: platform.accent }}
                            >
                              {platform.icon}
                            </span>
                            <div>
                              <h3 className="text-[15px] font-black text-[#111b3f]">{copy(platform.name.ar, platform.name.en)}</h3>
                              <p className="mt-1 text-[11px] font-bold text-[#7b87a3]">{copy(platform.scope.ar, platform.scope.en)}</p>
                            </div>
                          </div>
                          {isConnected ? (
                            <StatusPill tone="ready">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {copy('متصل', 'Connected')}
                            </StatusPill>
                          ) : platform.available ? (
                            <StatusPill tone="needs">
                              <Clock3 className="h-3.5 w-3.5" />
                              {copy('غير متصل', 'Not connected')}
                            </StatusPill>
                          ) : (
                            <StatusPill tone="planned">
                              {copy('مخطط', 'Planned')}
                            </StatusPill>
                          )}
                        </div>

                        <p className="min-h-[48px] text-[13px] leading-6 text-[#64708f]">{copy(platform.helper.ar, platform.helper.en)}</p>

                        {connectedAccount ? (
                          <div className="mt-4 rounded-[16px] border border-emerald-100 bg-emerald-50/70 p-3">
                            <p className="text-[11px] font-bold text-emerald-700">{copy('الحساب المتصل', 'Connected account')}</p>
                            <p className="mt-1 text-sm font-black text-[#10203f]">{connectedAccount.accountName}</p>
                            {connectedAccount.pages?.length ? (
                              <div className="mt-2 space-y-1">
                                {connectedAccount.pages.slice(0, 3).map((page) => (
                                  <p key={page.id} className="flex items-center gap-2 text-[11px] text-[#586684]">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                    {page.name}
                                    {page.igAccountId ? <span className="rounded-full bg-pink-50 px-1.5 py-0.5 text-[10px] text-pink-600">IG</span> : null}
                                  </p>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        <div className="mt-4 flex flex-wrap gap-2">
                          {isConnected && connectedAccount ? (
                            <>
                              <ShellButton onClick={() => handleConnect(platform.id)} loading={isConnecting}>
                                <RefreshCw className="h-4 w-4" />
                                {copy('تحديث الربط', 'Refresh')}
                              </ShellButton>
                              <ShellButton tone="danger" onClick={() => handleDisconnect(connectedAccount.id)} loading={isDisconnecting}>
                                <Unplug className="h-4 w-4" />
                                {copy('فصل', 'Disconnect')}
                              </ShellButton>
                            </>
                          ) : platform.available ? (
                            <ShellButton onClick={() => handleConnect(platform.id)} loading={isConnecting} tone="primary">
                              <Plug className="h-4 w-4" />
                              {copy('ربط الآن', 'Connect now')}
                            </ShellButton>
                          ) : (
                            <span className="inline-flex h-10 items-center gap-2 rounded-[13px] border border-[#e3e8f3] bg-[#f8faff] px-4 text-[12px] font-bold text-[#7b87a3]">
                              <Clock3 className="h-4 w-4" />
                              {copy('ليس جاهزاً بعد', 'Not ready yet')}
                            </span>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </div>
              </Panel>

              <Panel title={copy('اتصالات موصى بها', 'Recommended connections')} icon={<Sparkles size={18} />}>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  {[
                    ['WhatsApp Business', copy('رسائل العملاء', 'Customer messaging'), 'W'],
                    ['Email Marketing', copy('نشرات وتسلسلات', 'Newsletters and flows'), '✉'],
                    ['Klaviyo', copy('تجارة إلكترونية', 'Commerce CRM'), 'K'],
                    ['CRM Integration', copy('إدارة العملاء', 'Customer records'), 'CRM'],
                    ['HubSpot', copy('مبيعات وتسويق', 'Sales and marketing'), 'H'],
                  ].map(([name, helper, icon]) => (
                    <div key={name} className="rounded-[18px] border border-[#e8edf7] bg-white p-4">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f1f0ff] text-sm font-black text-[#4f46e5]">{icon}</div>
                      <p className="text-[13px] font-black text-[#111b3f]">{name}</p>
                      <p className="mt-1 min-h-[34px] text-[11px] leading-5 text-[#7b87a3]">{helper}</p>
                      <p className="mt-3 rounded-[12px] bg-[#f8faff] px-3 py-2 text-center text-[11px] font-bold text-[#7b87a3]">
                        {copy('غير متاح للربط حالياً', 'Not currently available to connect')}
                      </p>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>

            <aside className="space-y-6">
              <Panel title={copy('الأذونات والصلاحيات', 'Access and permissions')} icon={<Shield size={18} />}>
                <div className="mb-5 flex items-center gap-4">
                  <div
                    className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full"
                    style={{ background: `conic-gradient(#4f46e5 ${Math.min(100, apiReadyCount * 25) * 3.6}deg, #e8edf7 0deg)` }}
                  >
                    <div className="flex h-22 w-22 flex-col items-center justify-center rounded-full bg-white text-center">
                      <span className="text-[25px] font-black text-[#071236]">{apiReadyCount * 25}%</span>
                      <span className="text-[10px] font-bold text-[#64708f]">{copy('جاهزية', 'Ready')}</span>
                    </div>
                  </div>
                  <div className="space-y-3 text-[12px] text-[#64708f]">
                    <p>{copy('صلاحيات كاملة', 'Full permissions')} <strong className="text-[#071236]">{apiReadyCount}</strong></p>
                    <p>{copy('تحتاج مراجعة', 'Needs review')} <strong className="text-[#071236]">{Math.max(0, 4 - apiReadyCount)}</strong></p>
                    <p>{copy('حاجة لتحديث', 'Needs update')} <strong className="text-[#071236]">0</strong></p>
                  </div>
                </div>
                <ShellButton className="w-full" onClick={() => handleConnect('META_ADS')} loading={connecting === 'META_ADS'}>
                  <KeyRound className="h-4 w-4" />
                  {copy('مراجعة Meta Ads', 'Review Meta Ads')}
                </ShellButton>
              </Panel>

              <Panel title={copy('نظرة عامة على مزامنة البيانات', 'Data sync overview')} icon={<RefreshCw size={18} />}>
                <div className="space-y-3">
                  {[
                    [copy('آخر مزامنة ناجحة', 'Last successful sync'), loadingAccounts ? '…' : copy('بعد التحديث', 'After refresh')],
                    [copy('حالة البيانات', 'Data state'), copy('قراءة فقط حتى التنفيذ', 'Read-only until execution')],
                    [copy('سجلات اليوم', 'Records today'), copy('لا تغيير تلقائي', 'No automatic change')],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between rounded-[14px] border border-[#e8edf7] bg-[#fbfcff] px-3 py-3">
                      <span className="text-[12px] font-bold text-[#64708f]">{label}</span>
                      <span className="text-[12px] font-black text-[#111b3f]">{value}</span>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title={copy('حدود التنفيذ', 'Execution boundary')} icon={<Zap size={18} />}>
                <div className="space-y-3">
                  {[
                    copy('الربط لا ينشر أي منشور تلقائياً.', 'Connecting does not publish anything automatically.'),
                    copy('الإعلانات المدفوعة تحتاج تصريح منصة، ميزانية معتمدة، وموافقة إطلاق صريحة.', 'Paid ads require platform permission, approved budget, and explicit launch approval.'),
                    copy('التحليلات تصبح مصدر تعلم فقط بعد وصول بيانات أداء حقيقية.', 'Analytics become learning input only after real performance data arrives.'),
                  ].map((item) => (
                    <div key={item} className="flex gap-3 rounded-[14px] border border-[#eef2f8] bg-white px-3 py-3 text-[12px] leading-6 text-[#64708f]">
                      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </aside>
          </div>

          <footer className="mt-6 flex flex-col gap-3 rounded-[22px] border border-[#e5eaf5] bg-white p-4 text-[12px] text-[#65718e] shadow-[0_18px_50px_rgba(13,24,63,0.035)] sm:flex-row sm:items-center sm:justify-between">
            <span>
              {copy(
                'تحتاج تكاملاً مخصصاً؟ جهزه كطلب تقني منفصل قبل أن يظهر كجاهز في NEXUS.',
                'Need a custom integration? Treat it as a separate technical request before NEXUS shows it as ready.',
              )}
            </span>
            <a href="mailto:support@nexus-grow.com" className="inline-flex items-center gap-2 font-black text-[#4f46e5]">
              {copy('تواصل مع الدعم', 'Contact support')}
              <ArrowRight className="h-4 w-4" />
            </a>
          </footer>
        </div>
      </main>
    </AppShell>
  )
}
