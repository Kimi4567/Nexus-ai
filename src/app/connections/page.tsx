'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
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
  status: string
  accountName: string
  pages: Array<{ id: string; name: string; igAccountId: string | null }>
  organizations?: Array<{ id: string; name: string }>
  selectedOrganizationId?: string | null
  scopes?: string[]
  expiresAt?: string | null
  refreshExpiresAt?: string | null
  lastSyncedAt?: string | null
  channelUrl?: string | null
  profileUrl?: string | null
  capabilities?: {
    facebookPublishing?: boolean
    instagramPublishing?: boolean
    linkedInMemberPublishing?: boolean
    linkedInOrganizationPublishing?: boolean
    tikTokDirectPosting?: boolean
    tikTokCreatorInfoVerified?: boolean
    youtubeVideoPublishing?: boolean
    youtubeReadback?: boolean
    xPublishing?: boolean
    xMediaPublishing?: boolean
    xReadback?: boolean
    tokenRefresh?: boolean
  }
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
      en: 'Facebook and Instagram readiness are checked separately against the selected Page and professional Instagram identity.',
    },
    scope: { ar: 'نشر Facebook وInstagram', en: 'Facebook & Instagram publishing' },
    available: true,
    accent: '#2563eb',
    icon: '∞',
  },
  {
    id: 'LINKEDIN',
    name: { ar: 'LinkedIn', en: 'LinkedIn' },
    helper: {
      ar: 'يفحص NEXUS النشر باسم العضو وصفحات الشركات كلٌ على حدة، ولا يعتبر صفحة شركة متاحة دون صلاحية إدارة مثبتة.',
      en: 'NEXUS checks member and Company Page publishing separately and never treats an organization as available without proven admin access.',
    },
    scope: { ar: 'عضو وصفحات شركات', en: 'Member & Company Pages' },
    available: true,
    accent: '#0a66c2',
    icon: 'in',
  },
  {
    id: 'TIKTOK',
    name: { ar: 'TikTok', en: 'TikTok' },
    helper: {
      ar: 'النشر المباشر يظل مقفلاً حتى نجاح فحص creator-info واختيار الخصوصية والإفصاحات وموافقة المستخدم الصريحة.',
      en: 'Direct posting stays locked until creator-info, privacy, disclosures, and explicit user consent are verified.',
    },
    scope: { ar: 'فيديو Direct Post', en: 'Video Direct Post' },
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
      ar: 'يرفع الفيديوهات والشورتس المعتمدة، ثم يراقب المعالجة. قد تفرض Google الخصوصية على Private حتى اعتماد مشروع API.',
      en: 'Uploads approved videos and Shorts, then monitors processing. Google may force Private visibility until the API project passes audit.',
    },
    scope: { ar: 'رفع فيديو ومراقبة المعالجة', en: 'Video upload & processing status' },
    available: true,
    accent: '#ef4444',
    icon: '▶',
  },
  {
    id: 'X',
    name: { ar: 'X', en: 'X' },
    helper: {
      ar: 'ينشر النص والصورة المعتمدة فقط بعد موافقة صريحة، ثم يجلب مقاييس المنشور المتاحة من X بدون اختلاق وصول أو تحويلات.',
      en: 'Publishes approved text and image only after explicit consent, then reads available X post metrics without inventing reach or conversions.',
    },
    scope: { ar: 'نص وصورة معتمدة', en: 'Approved text & image' },
    available: true,
    accent: '#111827',
    icon: 'X',
  },
  {
    id: 'PINTEREST',
    name: { ar: 'Pinterest', en: 'Pinterest' },
    helper: { ar: 'مخطط لنشر Pins بعد اعتماد تطبيق Pinterest وصلاحيات المحتوى.', en: 'Planned for Pin publishing after Pinterest app review and content permissions.' },
    scope: { ar: 'مخطط', en: 'Planned' },
    available: false,
    accent: '#e11d48',
    icon: 'P',
  },
  {
    id: 'WHATSAPP',
    name: { ar: 'WhatsApp Business', en: 'WhatsApp Business' },
    helper: { ar: 'مخطط لتسليم العملاء والرسائل المعتمدة؛ ليس قناة نشر اجتماعي عادية.', en: 'Planned for lead handoff and approved templates; it is not a standard social publishing channel.' },
    scope: { ar: 'مخطط', en: 'Planned' },
    available: false,
    accent: '#16a34a',
    icon: 'W',
  },
]

function connectionTruth(account: ConnectedAccount, ar: boolean): {
  tone: 'ready' | 'needs'
  label: string
  checks: Array<{ ok: boolean; text: string }>
} {
  const capability = account.capabilities || {}
  if (account.status !== 'CONNECTED') {
    return {
      tone: 'needs',
      label: account.status === 'EXPIRED'
        ? (ar ? 'انتهت الصلاحية · أعد الربط' : 'Expired · reconnect')
        : (ar ? 'خطأ في الاتصال · أعد الربط' : 'Connection error · reconnect'),
      checks: [{ ok: false, text: ar ? 'رمز وصول صالح مطلوب قبل أي نشر' : 'A valid access token is required before publishing' }],
    }
  }
  if (account.platform === 'META') {
    const facebook = capability.facebookPublishing === true
    const instagram = capability.instagramPublishing === true
    return {
      tone: facebook && instagram ? 'ready' : 'needs',
      label: facebook && instagram
        ? (ar ? 'النشر جاهز للوجهتين' : 'Both destinations ready')
        : facebook
          ? (ar ? 'Facebook جاهز · Instagram ناقص' : 'Facebook ready · Instagram missing')
          : (ar ? 'إعداد الوجهة مطلوب' : 'Destination setup required'),
      checks: [
        { ok: facebook, text: ar ? 'صفحة Facebook مخولة للنشر' : 'Facebook Page authorized for publishing' },
        { ok: instagram, text: ar ? 'حساب Instagram احترافي مربوط بالصفحة' : 'Professional Instagram account linked to the Page' },
      ],
    }
  }
  if (account.platform === 'LINKEDIN') {
    const member = capability.linkedInMemberPublishing === true
    const organization = capability.linkedInOrganizationPublishing === true
    return {
      tone: member || organization ? 'ready' : 'needs',
      label: organization
        ? (ar ? 'نشر العضو وصفحة الشركة متاح' : 'Member and Company Page ready')
        : member
          ? (ar ? 'نشر العضو جاهز · لا صفحة شركة' : 'Member ready · no Company Page')
          : (ar ? 'صلاحية النشر غير مثبتة' : 'Publishing permission unverified'),
      checks: [
        { ok: member, text: ar ? 'هوية العضو متاحة للنشر' : 'Member publishing identity available' },
        { ok: organization, text: ar ? 'صفحة شركة بإدارة مثبتة' : 'Admin-authorized Company Page available' },
      ],
    }
  }
  if (account.platform === 'YOUTUBE') {
    const upload = capability.youtubeVideoPublishing === true
    const readback = capability.youtubeReadback === true
    const refresh = capability.tokenRefresh === true
    return {
      tone: upload && readback && refresh ? 'ready' : 'needs',
      label: upload && readback && refresh
        ? (ar ? 'رفع الفيديو والمراقبة جاهزان' : 'Upload and monitoring ready')
        : (ar ? 'صلاحيات YouTube غير مكتملة' : 'YouTube permissions incomplete'),
      checks: [
        { ok: upload, text: ar ? 'صلاحية رفع الفيديو مثبتة' : 'Video upload permission verified' },
        { ok: readback, text: ar ? 'قراءة حالة المعالجة مثبتة' : 'Processing status readback verified' },
        { ok: refresh, text: ar ? 'رمز تحديث محفوظ للجدولة' : 'Refresh token stored for scheduling' },
      ],
    }
  }
  if (account.platform === 'X') {
    const publishing = capability.xPublishing === true
    const media = capability.xMediaPublishing === true
    const readback = capability.xReadback === true
    const refresh = capability.tokenRefresh === true
    return {
      tone: publishing && media && readback && refresh ? 'ready' : 'needs',
      label: publishing && media && readback && refresh
        ? (ar ? 'النشر والقياس جاهزان للمراجعة' : 'Publishing and measurement review-ready')
        : (ar ? 'صلاحيات X غير مكتملة' : 'X permissions incomplete'),
      checks: [
        { ok: publishing, text: ar ? 'صلاحية إنشاء المنشورات مثبتة' : 'Post creation permission verified' },
        { ok: media, text: ar ? 'صلاحية رفع الصور مثبتة' : 'Image upload permission verified' },
        { ok: readback, text: ar ? 'قراءة المنشور والمقاييس مثبتة' : 'Post and metrics readback verified' },
        { ok: refresh, text: ar ? 'رمز تحديث محفوظ للجدولة' : 'Refresh token stored for scheduling' },
      ],
    }
  }
  const directPost = capability.tikTokDirectPosting === true
  const creator = capability.tikTokCreatorInfoVerified === true
  return {
    tone: directPost && creator ? 'ready' : 'needs',
    label: directPost && creator
      ? (ar ? 'Direct Post جاهز للمراجعة' : 'Direct Post review-ready')
      : (ar ? 'إعادة الربط أو التحقق مطلوبة' : 'Reconnect or verification required'),
    checks: [
      { ok: directPost, text: ar ? 'صلاحية video.publish موجودة' : 'video.publish scope granted' },
      { ok: creator, text: ar ? 'creator-info والخصوصية تم التحقق منهما' : 'Creator info and privacy options verified' },
      { ok: capability.tokenRefresh === true, text: ar ? 'رمز تحديث محفوظ للتجديد' : 'Refresh token stored for renewal' },
    ],
  }
}

const CONNECT_ROUTES: Record<string, string> = {
  META: '/api/social/connect/meta',
  META_ADS: '/api/social/connect/meta-ads',
  LINKEDIN: '/api/social/connect/linkedin',
  TIKTOK: '/api/social/connect/tiktok',
  YOUTUBE: '/api/social/connect/youtube',
  X: '/api/social/connect/x',
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
  const router = useRouter()
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
    if (!token) {
      setLoadingAccounts(false)
      return
    }
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
    let messageTimeout: ReturnType<typeof setTimeout> | undefined
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
      messageTimeout = setTimeout(() => setMessage(null), 5000)
    } else if (social === 'error' || social === 'denied') {
      const rawMsg = params.get('msg')
      setMessage({
        type: 'error',
        text: rawMsg
          ? copy(`تعذر إكمال الربط: ${decodeURIComponent(rawMsg)}`, `Connection failed: ${decodeURIComponent(rawMsg)}`)
          : copy('تعذر إكمال الربط. حاول مرة أخرى بعد مراجعة إعدادات المنصة.', 'Connection failed. Review platform settings and try again.'),
      })
      window.history.replaceState({}, '', '/connections')
      messageTimeout = setTimeout(() => setMessage(null), 9000)
    }
    return () => { if (messageTimeout) clearTimeout(messageTimeout) }
  }, [copy])

  useEffect(() => {
    if (!loading && isAuthenticated && session?.access_token) fetchAccounts()
  }, [fetchAccounts, isAuthenticated, loading, session])

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      setLoadingAccounts(false)
      router.push('/auth/login')
    }
  }, [isAuthenticated, loading, router])

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
          text: data.code === 'X_OAUTH_NOT_CONFIGURED'
            ? copy(
                'ربط X غير متاح الآن لأن إعداد المنصة لم يكتمل. لم يتم تغيير أي بيانات.',
                'X connection is not available because platform setup is incomplete. No data was changed.',
              )
            : data.error || copy('تعذر بدء الربط من NEXUS.', 'NEXUS could not start the connection.'),
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

  if (loading || !isAuthenticated) {
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
            primaryHref={null}
            secondaryHref={null}
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
                    const isConnected = connectedAccount?.status === 'CONNECTED'
                    const truth = connectedAccount ? connectionTruth(connectedAccount, ar) : null
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
                            <StatusPill tone={truth?.tone || 'needs'}>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {truth?.label || copy('اتصال محفوظ', 'Connection saved')}
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
                          <div className="mt-4 rounded-[16px] border border-slate-200 bg-white p-3">
                            <p className="text-[11px] font-bold text-slate-500">{copy('الحساب المتصل', 'Connected account')}</p>
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
                            {connectedAccount.organizations?.length ? (
                              <div className="mt-2 space-y-1">
                                {connectedAccount.organizations.slice(0, 3).map((organization) => (
                                  <p key={organization.id} className="flex items-center gap-2 text-[11px] text-[#586684]">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                    {organization.name}
                                  </p>
                                ))}
                              </div>
                            ) : null}
                            {truth ? (
                              <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                                {truth.checks.map((check) => (
                                  <p key={check.text} className={`flex items-start gap-2 text-[11px] font-semibold ${check.ok ? 'text-emerald-700' : 'text-amber-700'}`}>
                                    {check.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                                    {check.text}
                                  </p>
                                ))}
                              </div>
                            ) : null}
                            {connectedAccount.expiresAt ? (
                              <p className="mt-3 text-[10px] font-semibold text-slate-400">
                                {copy('انتهاء رمز الوصول:', 'Access token expiry:')} {' '}
                                <span dir="ltr">{new Date(connectedAccount.expiresAt).toLocaleString(ar ? 'ar-EG' : 'en-US')}</span>
                              </p>
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
                    <ShellButton className="mt-4" tone="primary" onClick={() => handleConnect('META_ADS')} loading={connecting === 'META_ADS'}>
                      <KeyRound className="h-4 w-4" />
                      {copy('ربط حساب إعلانات Meta', 'Connect Meta ad account')}
                    </ShellButton>
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
