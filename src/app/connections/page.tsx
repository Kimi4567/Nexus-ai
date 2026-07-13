'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import AppShell from '@/components/AppShell'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  KeyRound,
  Link2,
  Loader2,
  Plug,
  RefreshCw,
  Unplug,
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
    name: { ar: 'Meta — Facebook وInstagram', en: 'Meta — Facebook & Instagram' },
    helper: {
      ar: 'ينشر Facebook بعد تحقق الصفحة والصلاحيات. يظهر حساب Instagram للربط والمراجعة، ولا يُعتمد نشره حتى نجاح فحص الصلاحيات.',
      en: 'Facebook can publish after Page and permission checks. Instagram is connected for review and is not treated as publish-ready until permission verification passes.',
    },
    scope: { ar: 'Facebook جاهز بشروط · Instagram قيد التحقق', en: 'Facebook conditional · Instagram verification pending' },
    available: true,
    accent: '#2563eb',
    icon: '∞',
  },
  {
    id: 'LINKEDIN',
    name: { ar: 'LinkedIn', en: 'LinkedIn' },
    helper: {
      ar: 'مسار النشر المهني مبني، لكن هذا الاتصال يظل قيد التحقق حتى اعتماد الصلاحيات فعلياً للحساب.',
      en: 'The professional publishing path is implemented, but the connection remains unverified until the account permissions are proven.',
    },
    scope: { ar: 'اتصال للمراجعة · الإذن غير مثبت', en: 'Review connection · permission unverified' },
    available: true,
    accent: '#0a66c2',
    icon: 'in',
  },
  {
    id: 'TIKTOK',
    name: { ar: 'TikTok', en: 'TikTok' },
    helper: {
      ar: 'يمكن ربط الحساب لمراجعة التطبيق. النشر المباشر متوقف حتى اكتمال creator-info والتحقق من الخصوصية.',
      en: 'Connect the account for app review. Direct posting is paused until creator-info and privacy validation are complete.',
    },
    scope: { ar: 'ربط تجريبي · النشر متوقف', en: 'Review connection · publishing paused' },
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
    <section className={`nx-os-card p-5 ${className}`}>
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
  const copy = useCallback((arabic: string, english: string) => (ar ? arabic : english), [ar])

  const [accounts, setAccounts] = useState<ConnectedAccount[]>([])
  const [adAccounts, setAdAccounts] = useState<ConnectedAdAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [disconnectConfirmId, setDisconnectConfirmId] = useState<string | null>(null)
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
      const response = await fetch('/api/social/accounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
        body: JSON.stringify({ integrationId }),
      })
      if (!response.ok) throw new Error('Disconnect failed')
      setAccounts((prev) => prev.filter((account) => account.id !== integrationId))
      setDisconnectConfirmId(null)
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

  const connectedCount = accounts.length + metaAdAccounts.length

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
      <main dir={dir} className="nx-os-page">
        <div className="nx-os-container">
          <LuxuryWorkspaceHeader
            pageTitle={copy('الربط', 'Connections')}
            pageSubtitle={copy('اربط الحسابات ثم راجع القدرة المثبتة لكل منصة قبل النشر أو القياس.', 'Connect accounts, then review the proven capability for each platform before publishing or measurement.')}
            primaryHref="/publish"
            primaryLabel={copy('فحص جاهزية النشر', 'Check publishing readiness')}
            secondaryHref="/settings"
            secondaryLabel={copy('الإعدادات', 'Settings')}
          />

          <section className="nx-os-action-strip mb-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="nx-os-icon-box"><Link2 size={17} /></span>
              <div className="min-w-0">
                <p className="text-[13px] font-black text-[#111b3f]">
                  {loadingAccounts
                    ? copy('جار فحص الحسابات', 'Checking accounts')
                    : copy(`${connectedCount} اتصال محفوظ`, `${connectedCount} saved connections`)}
                </p>
                <p className="text-[11px] font-semibold text-[#7b87a3]">{copy('الربط وحده لا ينشر أو يصرف ميزانية.', 'A connection never publishes or spends by itself.')}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <ShellButton onClick={fetchAccounts} loading={loadingAccounts}>
                <RefreshCw className="h-4 w-4" />
                {copy('تحديث الحالة', 'Refresh status')}
              </ShellButton>
              <ShellButton tone="primary" onClick={() => handleConnect('META')} loading={connecting === 'META'}>
                <Plug className="h-4 w-4" />
                {copy('ربط Meta', 'Connect Meta')}
              </ShellButton>
              <ShellButton onClick={() => handleConnect('META_ADS')} loading={connecting === 'META_ADS'}>
                <KeyRound className="h-4 w-4" />
                {copy('ربط حساب إعلانات', 'Connect ad account')}
              </ShellButton>
            </div>
          </section>

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

          <div>
              <Panel
                title={copy('حسابات المنصات', 'Platform accounts')}
                icon={<Plug size={18} />}
                action={<span className="text-[12px] font-bold text-[#64708f]">{copy('النشر يحتاج موافقة', 'Publishing requires approval')}</span>}
              >
                <span id="available-integrations" className="sr-only" aria-hidden="true" />
                <div className="grid gap-4 lg:grid-cols-3">
                  {PLATFORMS.filter(platform => platform.available).map((platform) => {
                    const connectedAccount = accounts.find((account) => account.platform === platform.id)
                    const isConnected = Boolean(connectedAccount)
                    const isConnecting = connecting === platform.id
                    const isDisconnecting = disconnecting === connectedAccount?.id

                    return (
                      <article key={platform.id} className="nx-os-card bg-[#fbfcff] p-4">
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
                            <StatusPill tone="needs">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {copy('اتصال محفوظ', 'Connection saved')}
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
                              <ShellButton tone="danger" onClick={() => setDisconnectConfirmId(connectedAccount.id)} loading={isDisconnecting}>
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
                        {connectedAccount && disconnectConfirmId === connectedAccount.id ? (
                          <div className="mt-3 rounded-[14px] border border-rose-100 bg-rose-50/70 p-3">
                            <p className="text-[12px] font-bold leading-5 text-rose-700">
                              {copy(
                                'سيوقف الفصل استخدام هذا الحساب في النشر عبر NEXUS. لن يحذف الحساب أو محتواه من المنصة.',
                                'Disconnecting stops NEXUS from publishing through this account. It does not delete the platform account or its content.',
                              )}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <ShellButton onClick={() => setDisconnectConfirmId(null)}>
                                {copy('إلغاء', 'Cancel')}
                              </ShellButton>
                              <ShellButton tone="danger" onClick={() => handleDisconnect(connectedAccount.id)} loading={isDisconnecting}>
                                {copy('تأكيد الفصل', 'Confirm disconnect')}
                              </ShellButton>
                            </div>
                          </div>
                        ) : null}
                      </article>
                    )
                  })}
                </div>
              </Panel>

              <Panel
                title={copy('جاهزية حسابات الإعلانات', 'Ad account readiness')}
                icon={<KeyRound size={18} />}
                className="mt-5"
                action={<span className="text-[12px] font-bold text-[#64708f]">{copy('لا إنفاق بدون اعتماد', 'No spend without approval')}</span>}
              >
                {metaAdAccounts.length === 0 ? (
                  <div className="rounded-[18px] border border-dashed border-[#d7def0] p-6 text-center">
                    <p className="text-[13px] font-black text-[#111b3f]">{copy('لا يوجد حساب إعلانات محفوظ', 'No saved ad account')}</p>
                    <p className="mt-1 text-[11px] font-semibold text-[#7b87a3]">
                      {copy('يمكنك إعداد مسودات التخطيط بدون حساب؛ الإطلاق والقياس من Meta يتطلبان API access مثبتاً.', 'Planning drafts can be prepared without an account; Meta launch and measurement require proven API access.')}
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {metaAdAccounts.map((account) => (
                      <article key={account.id} className="rounded-[18px] border border-[#e7ecf6] bg-[#fbfcff] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-[13px] font-black text-[#111b3f]">{account.platformAccountName || account.platformAccountId}</p>
                            {account.businessName ? <p className="mt-1 text-[11px] font-semibold text-[#7b87a3]">{account.businessName}</p> : null}
                          </div>
                          <StatusPill tone={account.hasApiAccess ? 'ready' : 'needs'}>
                            {account.hasApiAccess ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                            {account.hasApiAccess ? copy('API مثبت', 'API verified') : copy('مراجعة فقط', 'Review only')}
                          </StatusPill>
                        </div>
                        <p className="mt-3 text-[11px] font-semibold leading-5 text-[#64708f]">
                          {account.hasApiAccess
                            ? copy('الحساب مؤهل لخطوات التنفيذ التي يراجعها المستخدم؛ تظل حالة كل حملة والصلاحيات مطلوبة.', 'The account is eligible for user-reviewed execution steps; campaign state and permissions are still required.')
                            : copy('يظل التخطيط متاحاً، لكن NEXUS لن يدّعي إطلاق إعلان أو مزامنة نتائج من هذا الحساب.', 'Planning remains available, but NEXUS will not claim to launch ads or sync results from this account.')}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </Panel>

              <Panel
                title={copy('تكاملات ضمن خريطة الطريق', 'Roadmap integrations')}
                icon={<Clock3 size={18} />}
                className="mt-5"
                action={<StatusPill tone="planned">{copy('غير تشغيلية', 'Not operational')}</StatusPill>}
              >
                <div className="grid gap-3 md:grid-cols-3">
                  {PLATFORMS.filter((platform) => !platform.available).map((platform) => (
                    <article key={platform.id} className="rounded-[18px] border border-[#e7ecf6] bg-[#fbfcff] p-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-white text-sm font-black" style={{ color: platform.accent }}>
                          {platform.icon}
                        </span>
                        <p className="text-[13px] font-black text-[#111b3f]">{copy(platform.name.ar, platform.name.en)}</p>
                      </div>
                      <p className="mt-3 text-[11px] font-semibold leading-5 text-[#7b87a3]">{copy(platform.helper.ar, platform.helper.en)}</p>
                    </article>
                  ))}
                </div>
              </Panel>
          </div>
        </div>
      </main>
    </AppShell>
  )
}
