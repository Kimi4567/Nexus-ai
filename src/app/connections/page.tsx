'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import AppShell from '@/components/AppShell'
import {
  CheckCircle2, AlertCircle, Unplug, Plug,
  Shield, RefreshCw, Info, CheckCircle
} from 'lucide-react'
import PlatformReadinessPanel from '@/components/PlatformReadinessPanel'
import {
  derivePlatformReadiness,
  type ReadinessAction,
  type ReadinessStatus,
} from '@/lib/platformReadiness'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionCard } from '@/components/ui/SectionCard'
import { ActionButton } from '@/components/ui/ActionButton'
import { ReadinessBadge, type ReadinessBadgeStatus } from '@/components/ui/ReadinessBadge'
import { LoadingState } from '@/components/ui/LoadingState'

/* ═══════════════════════════════════════════════════════════════
   CONNECTIONS HUB — ربط منصات التسويق
   المستخدم يربط حساباته هنا قبل أي شيء.
   ═══════════════════════════════════════════════════════════════ */

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
  hasApiAccess: boolean
  pageId: string | null
}

interface PlatformDef {
  id: string
  nameKey: string    // t() key for platform name
  descKey: string    // t() key for description
  icon: React.ReactNode
  color: string
  available: boolean
  eta?: string            // Use only for externally committed launch windows; otherwise show generic planned copy.
}

const PLATFORMS: PlatformDef[] = [
  {
    id: 'META',
    nameKey: 'connections.platformMetaName',
    descKey: 'connections.platformMetaDesc',
    icon: (
      <svg viewBox="0 0 36 36" fill="none" className="w-7 h-7">
        <path d="M18 3C9.716 3 3 9.716 3 18s6.716 15 15 15 15-6.716 15-15S26.284 3 18 3z" fill="#1877F2" />
        <path d="M22.5 18h-2.25v7.5h-3V18H15v-2.625h2.25v-1.688c0-2.25 1.313-3.562 3.375-3.562.9 0 1.875.112 2.813.225v2.813h-1.688c-.787 0-.937.337-.937.9v1.312H22.5L22.5 18z" fill="white" />
      </svg>
    ),
    color: '#1877F2',
    available: true,
  },
  {
    id: 'LINKEDIN',
    nameKey: 'connections.platformLinkedInName',
    descKey: 'connections.platformLinkedInDesc',
    icon: (
      <svg viewBox="0 0 36 36" fill="none" className="w-7 h-7">
        <rect width="36" height="36" rx="8" fill="#0A66C2" />
        <path d="M10 14h3.5v12H10V14zm1.75-5.5a2 2 0 110 4 2 2 0 010-4zM16 14h3.35v1.65h.05c.47-.88 1.6-1.8 3.3-1.8 3.53 0 4.18 2.32 4.18 5.34V26H23.4v-5.96c0-1.42-.03-3.25-1.98-3.25-1.98 0-2.28 1.55-2.28 3.15V26H16V14z" fill="white" />
      </svg>
    ),
    color: '#0A66C2',
    available: true,
  },
  {
    id: 'TIKTOK',
    nameKey: 'connections.platformTikTokName',
    descKey: 'connections.platformTikTokDesc',
    icon: (
      <svg viewBox="0 0 36 36" fill="none" className="w-7 h-7">
        <rect width="36" height="36" rx="10" fill="#000" />
        <path d="M22.5 9h-2.7c.3 2.4 2.1 4.2 4.2 4.5v2.7c-1.5 0-2.7-.45-3.75-1.2v5.55c0 2.85-2.25 5.1-5.1 5.1s-5.1-2.25-5.1-5.1 2.25-5.1 5.1-5.1c.15 0 .3 0 .45.015v2.73c-.15-.015-.3-.03-.45-.03-1.35 0-2.4 1.05-2.4 2.4s1.05 2.4 2.4 2.4 2.4-1.05 2.4-2.4V9h2.85C20.55 9 22.35 10.8 22.5 9z" fill="#FE2C55" />
        <path d="M22.5 9h-2.7c.15 1.2.75 2.25 1.65 3h1.05V9z" fill="white" />
        <path d="M24 14.25c-1.5 0-2.7-.45-3.75-1.2v5.55c0 2.85-2.25 5.1-5.1 5.1s-5.1-2.25-5.1-5.1 2.25-5.1 5.1-5.1c.15 0 .3 0 .45.015v2.73c-.15-.015-.3-.03-.45-.03-1.35 0-2.4 1.05-2.4 2.4s1.05 2.4 2.4 2.4 2.4-1.05 2.4-2.4V9h2.85c.15 1.8 1.95 3.6 4.05 3.9v1.35z" fill="white" />
      </svg>
    ),
    color: '#FE2C55',
    available: true,
  },
  {
    id: 'YOUTUBE',
    nameKey: 'connections.platformYouTubeName',
    descKey: 'connections.platformYouTubeDesc',
    icon: (
      <svg viewBox="0 0 36 36" fill="none" className="w-7 h-7">
        <rect width="36" height="36" rx="10" fill="#FF0000" />
        <path d="M14 11.5l10 6.5-10 6.5v-13z" fill="white" />
      </svg>
    ),
    color: '#FF0000',
    available: false,
  },
  {
    id: 'SNAPCHAT',
    nameKey: 'connections.platformSnapchatName',
    descKey: 'connections.platformSnapchatDesc',
    icon: (
      <svg viewBox="0 0 36 36" fill="none" className="w-7 h-7">
        <rect width="36" height="36" rx="10" fill="#FFFC00" />
        <path d="M18 7c-2.88 0-5.2 2.13-5.2 4.76 0 .27.02.53.06.79l-.06.01c-.4 0-1.1-.19-1.5-.19-.35 0-.66.2-.66.5 0 .44.5.73 1.3.87.1.02.2.05.3.09-.04.2-.07.4-.07.6 0 .27.07.5.18.7-.08.04-.17.06-.27.06-.25 0-.57-.07-.94-.07-.54 0-1.1.31-1.1.82 0 .85 1.44 1.23 2.7 1.7.44.17.6.46.6.77 0 .15-.04.3-.11.44-.46.03-.87.16-1.16.39-.22.18-.33.4-.33.63 0 .46.38.8.87.8.18 0 .38-.05.59-.14a3.4 3.4 0 001.04-.68c.65.93 1.77 1.54 3.06 1.54s2.41-.6 3.06-1.54c.3.26.63.5.98.65.22.1.43.16.63.16.5 0 .87-.34.87-.8 0-.23-.11-.45-.33-.63a2.3 2.3 0 00-1.18-.4c-.07-.14-.11-.29-.11-.44 0-.31.16-.6.6-.77 1.27-.47 2.7-.85 2.7-1.7 0-.51-.56-.82-1.1-.82-.36 0-.68.07-.93.07-.1 0-.2-.02-.29-.07.11-.2.18-.43.18-.7 0-.2-.03-.4-.07-.6.1-.04.2-.07.3-.09.8-.14 1.3-.43 1.3-.87 0-.3-.31-.5-.66-.5-.4 0-1.1.19-1.5.19l-.06-.01c.04-.26.06-.52.06-.79C23.2 9.13 20.88 7 18 7z" fill="#333" />
      </svg>
    ),
    color: '#FFFC00',
    available: false,
  },
  {
    id: 'GOOGLE',
    nameKey: 'connections.platformGoogleName',
    descKey: 'connections.platformGoogleDesc',
    icon: (
      <svg viewBox="0 0 36 36" fill="none" className="w-7 h-7">
        <rect width="36" height="36" rx="10" fill="#fff" />
        <path d="M18 8a10 10 0 100 20A10 10 0 0018 8z" fill="#4285F4" />
        <path d="M18 8c-1.86 0-3.6.5-5.1 1.38l9.25 15.97A10 10 0 0018 8z" fill="#FBBC04" />
        <path d="M12.9 9.38A10 10 0 008 18c0 4.14 2.52 7.7 6.15 9.2L23.4 11.25A10.04 10.04 0 0012.9 9.38z" fill="#EA4335" />
        <path d="M14.15 27.2A10 10 0 0028 18h-9.5l-4.35 9.2z" fill="#34A853" />
      </svg>
    ),
    color: '#4285F4',
    available: false,
  },
  {
    id: 'TWITTER',
    nameKey: 'connections.platformTwitterName',
    descKey: 'connections.platformTwitterDesc',
    icon: (
      <svg viewBox="0 0 36 36" fill="none" className="w-7 h-7">
        <rect width="36" height="36" rx="10" fill="#000" />
        <path d="M19.8 16.6L26.2 9h-1.5L19.1 15.7 14.4 9H9.3l6.7 9.7-6.7 7.6H10.8L16.3 20l5 6.3H26.4L19.8 16.6zm-2 2.3l-.7-.9-5.2-7.5h2.2l4.2 6 .7.9 5.4 7.8H22.3l-4.5-6.3z" fill="white" />
      </svg>
    ),
    color: '#000',
    available: false,
  },
]

const badgeStatusFor: Record<ReadinessStatus, ReadinessBadgeStatus> = {
  ready: 'ready',
  needs_setup: 'needsSetup',
  not_connected: 'needsSetup',
  permission_unverified: 'permissionNeeded',
  planning_only: 'planningOnly',
  not_available: 'notAvailable',
}

const connectCtaKeyFor = (platformId: string) => {
  if (platformId === 'META') return 'connections.connectMetaAccount'
  if (platformId === 'LINKEDIN') return 'connections.connectLinkedInAccount'
  if (platformId === 'TIKTOK') return 'connections.connectTikTokAccount'
  return 'connections.connectAccount'
}

export default function ConnectionsPage() {
  const { isAuthenticated, loading, authHeader, session } = useAuth()
  const { locale, dir, t } = useI18n()
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

  // Handle OAuth callback params
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const social = params.get('social')
    const platform = params.get('platform')
    if (social === 'connected') {
      const PLATFORM_NAMES: Record<string, string> = {
        meta:     'Meta (Facebook/Instagram)',
        linkedin: 'LinkedIn',
        tiktok:   'TikTok',
      }
      const platformName = PLATFORM_NAMES[platform || ''] || (platform || '')
      setMessage({
        type: 'success',
        text: (t('connections.successConnect') as string).replace('{platform}', platformName),
      })
      window.history.replaceState({}, '', '/connections')
      setTimeout(() => setMessage(null), 5000)
    } else if (social === 'error') {
      const rawMsg = params.get('msg') || ''
      // Translate known OAuth error codes into human-readable messages
      const ERROR_MAP_AR: Record<string, string> = {
        'token_exchange':     'فشل في الحصول على رمز الوصول. تأكد من إعدادات التطبيق في Meta Developer.',
        'profile_fetch':      'فشل جلب بيانات الملف الشخصي. حاول مرة أخرى.',
        'profile_fetch_failed':'فشل جلب بيانات الملف الشخصي. حاول مرة أخرى.',
        'network_error':      'خطأ في الشبكة. تحقق من الاتصال وحاول مجدداً.',
        'invalid_state':      'انتهت صلاحية الطلب. حاول الربط من جديد.',
        'missing_params':     'معلمات OAuth ناقصة. حاول الربط من جديد.',
        'db_error':           'خطأ في حفظ بيانات الربط. حاول مرة أخرى.',
        'stale':              'انتهت صلاحية الجلسة. حاول الربط من جديد.',
      }
      const ERROR_MAP_EN: Record<string, string> = {
        'token_exchange':     'Failed to get access token. Check your Meta App configuration.',
        'profile_fetch':      'Failed to fetch profile data. Please try again.',
        'profile_fetch_failed':'Failed to fetch profile data. Please try again.',
        'network_error':      'Network error. Check your connection and try again.',
        'invalid_state':      'Request expired. Please try connecting again.',
        'missing_params':     'Missing OAuth parameters. Please try connecting again.',
        'db_error':           'Error saving connection data. Please try again.',
        'stale':              'Session expired. Please try connecting again.',
      }
      const errorMap = locale === 'ar' ? ERROR_MAP_AR : ERROR_MAP_EN
      const msg = errorMap[rawMsg] || (rawMsg ? decodeURIComponent(rawMsg) : t('connections.errorUnknown') as string)
      setMessage({
        type: 'error',
        text: msg,
      })
      window.history.replaceState({}, '', '/connections')
      setTimeout(() => setMessage(null), 10000)
    } else if (social === 'denied') {
      setMessage({ type: 'error', text: t('connections.errorDenied') as string })
      window.history.replaceState({}, '', '/connections')
      setTimeout(() => setMessage(null), 4000)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Wait for both auth check to complete AND session to be available
    if (!loading && isAuthenticated && session?.access_token) fetchAccounts()
  }, [loading, isAuthenticated, session, fetchAccounts])

  const CONNECT_ROUTES: Record<string, string> = {
    META:     '/api/social/connect/meta',
    META_ADS: '/api/social/connect/meta-ads',
    LINKEDIN: '/api/social/connect/linkedin',
    TIKTOK:   '/api/social/connect/tiktok',
  }

  const handleConnect = async (platformId: string) => {
    const route = CONNECT_ROUTES[platformId]
    if (!route) return // platform not yet supported

    // Guard: session must be present before calling OAuth routes
    const token = authHeader()
    if (!token) {
      setMessage({
        type: 'error',
        text: locale === 'ar'
          ? 'انتهت صلاحية الجلسة. يرجى تسجيل الخروج وإعادة الدخول ثم المحاولة مجدداً.'
          : 'Session expired. Please sign out and sign in again, then try connecting.',
      })
      return
    }

    setConnecting(platformId)
    try {
      const res = await fetch(route, {
        headers: { Authorization: token },
      })

      // 401 means token is invalid on the server side
      if (res.status === 401) {
        setMessage({
          type: 'error',
          text: locale === 'ar'
            ? 'انتهت صلاحية الجلسة. يرجى تسجيل الخروج وإعادة الدخول ثم المحاولة مجدداً.'
            : 'Session expired. Please sign out and sign in again, then try connecting.',
        })
        setConnecting(null)
        return
      }

      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setMessage({ type: 'error', text: data.error || t('connections.errorStart') as string })
        setConnecting(null)
      }
    } catch {
      setMessage({ type: 'error', text: t('connections.errorConnection') as string })
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
      setAccounts(prev => prev.filter(a => a.id !== integrationId))
      setMessage({ type: 'success', text: t('connections.successDisconnect') as string })
      setTimeout(() => setMessage(null), 3000)
    } catch {
      setMessage({ type: 'error', text: t('connections.errorDisconnect') as string })
    } finally {
      setDisconnecting(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center p-6">
        <LoadingState label={t('common.loading') as string} />
      </div>
    )
  }

  const connectablePlatforms = PLATFORMS.filter((platform) => platform.available)
  const futurePlatforms = PLATFORMS.filter((platform) => !platform.available)
  const connectedConnectableCount = accounts.filter((account) =>
    connectablePlatforms.some((platform) => platform.id === account.platform),
  ).length
  const totalPlatforms = connectablePlatforms.length
  const readinessStates = derivePlatformReadiness(accounts as any, adAccounts)

  return (
    <AppShell>
      <div className="min-h-screen bg-bg-base">
        <div className="mx-auto max-w-6xl px-4 py-8 page-enter sm:px-6 sm:py-10" dir={dir}>
          <PageHeader
            eyebrow={t('connections.eyebrow')}
            title={t('connections.title') as string}
            description={t('connections.subtitle')}
            primaryAction={
              <ActionButton
                variant="ghost"
                size="sm"
                onClick={fetchAccounts}
                loading={loadingAccounts}
                icon={<RefreshCw className="h-3.5 w-3.5" />}
              >
                {t('connections.refreshConnections')}
              </ActionButton>
            }
            className="mb-8"
          />

        {/* ── Status Banner ──────────────────────────────────── */}
        {message && (
          <div
            className={`mb-6 flex items-center gap-3 rounded-[12px] px-5 py-3 text-sm ${
              message.type === 'success'
                ? 'border border-[var(--nx-success-border)] bg-[var(--nx-success-bg)] text-[var(--nx-success)]'
                : 'border border-[var(--nx-danger-border)] bg-[var(--nx-danger-bg)] text-[var(--nx-danger)]'
            }`}
          >
            {message.type === 'success'
              ? <CheckCircle2 className="w-4 h-4 shrink-0" />
              : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{message.text}</span>
            <button type="button" onClick={() => setMessage(null)} className="ms-auto text-lg leading-none opacity-60 hover:opacity-100">×</button>
          </div>
        )}

          <div className="grid gap-6 lg:grid-cols-[1.35fr_0.9fr]">
            <div>
              <PlatformReadinessPanel
                states={readinessStates}
                t={t as (k: string) => string}
                onAction={(action: ReadinessAction) => {
                  if (action === 'connect-meta') return handleConnect('META')
                  if (action === 'connect-meta-ads') return handleConnect('META_ADS')
                  if (action === 'connect-tiktok') return handleConnect('TIKTOK')
                  if (action === 'connect-linkedin') return handleConnect('LINKEDIN')
                  if (action === 'open-paid-ads') {
                    window.location.href = '/paid-campaigns'
                    return
                  }
                  // select-page / link-instagram / review-setup / open-connections:
                  // controls live in the platform cards below — scroll the user to them.
                  document.getElementById('platform-cards')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
              />
            </div>

            <SectionCard
              title={t('connections.connectionMeaningTitle')}
              description={t('connections.connectionMeaningDesc')}
              variant="subtle"
            >
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] border border-[var(--nx-border)] bg-white text-xl font-black text-[var(--nx-text-1)]">
                    {loadingAccounts ? '…' : `${connectedConnectableCount}/${totalPlatforms}`}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[var(--nx-text-1)]">
                      {loadingAccounts
                        ? t('connections.loadingPlatforms')
                        : connectedConnectableCount === 0
                        ? t('connections.noneConnected')
                        : connectedConnectableCount === 1
                        ? t('connections.platform1Connected')
                        : `${connectedConnectableCount} ${t('connections.platformNConnected')}`}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--nx-text-3)]">
                      {connectedConnectableCount === 0 ? t('connections.noneConnectedDesc') : t('connections.expandDesc')}
                    </p>
                  </div>
                </div>

                {!loadingAccounts && connectedConnectableCount === 0 && (
                  <ActionButton
                    onClick={() => handleConnect('META')}
                    disabled={connecting === 'META'}
                    loading={connecting === 'META'}
                    icon={<Plug className="h-4 w-4" />}
                  >
                    {t('connections.startWithMeta')}
                  </ActionButton>
                )}

                <div className="rounded-[12px] border border-[var(--nx-info-border)] bg-[var(--nx-info-bg)] p-3">
                  <div className="flex gap-2 text-xs leading-relaxed text-[var(--nx-text-2)]">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--nx-info)]" />
                    <span>{t('connections.approvalNote')}</span>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>

        <div id="platform-cards" className="mt-6 scroll-mt-6">
          <SectionCard
            title={t('connections.platformCardsTitle')}
            description={t('connections.platformCardsDesc')}
            contentClassName="space-y-4"
          >
          <div className="rounded-[14px] border border-[var(--nx-border)] bg-[var(--nx-surface-2)] p-4">
            <p className="text-sm font-bold text-[var(--nx-text-1)]">{t('connections.connectNowTitle')}</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--nx-text-3)]">{t('connections.connectNowDesc')}</p>
          </div>

          {connectablePlatforms.map((platform) => {
            const connectedAccount = accounts.find(a => a.platform === platform.id)
            const isConnected = !!connectedAccount
            const isConnecting = connecting === platform.id
            const isDisconnecting = disconnecting === connectedAccount?.id
            const platformStates = platform.id === 'META'
              ? readinessStates.filter((s) => s.key === 'facebook' || s.key === 'instagram')
              : platform.id === 'LINKEDIN'
              ? readinessStates.filter((s) => s.key === 'linkedin')
              : platform.id === 'TIKTOK'
              ? readinessStates.filter((s) => s.key === 'tiktok')
              : platform.id === 'YOUTUBE'
              ? readinessStates.filter((s) => s.key === 'youtube')
              : platform.id === 'GOOGLE'
              ? readinessStates.filter((s) => s.key === 'google')
              : platform.id === 'SNAPCHAT'
              ? readinessStates.filter((s) => s.key === 'snapchat')
              : []

            return (
              <div
                key={platform.id}
                className="overflow-hidden rounded-[14px] border bg-white transition-all"
                style={{
                  borderColor: isConnected ? 'var(--nx-success-border)' : 'var(--nx-border)',
                }}
              >
                <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start">
                  {/* Platform Logo */}
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px]"
                    style={{
                      background: `${platform.color}0F`,
                      border: `1px solid ${platform.color}18`,
                    }}
                  >
                    {platform.icon}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-[var(--nx-text-1)]">{t(platform.nameKey)}</h3>
                      {isConnected ? (
                        <ReadinessBadge status="ready">
                          {t('connections.connected')}
                        </ReadinessBadge>
                      ) : !platform.available ? (
                        <ReadinessBadge status="notAvailable">
                          {platform.eta ? `Coming ${platform.eta}` : t('connections.comingSoon')}
                        </ReadinessBadge>
                      ) : null}
                    </div>

                    <p className="mb-4 text-sm leading-6 text-[var(--nx-text-3)]">{t(platform.descKey)}</p>

                    <div className="mb-4 grid gap-2 sm:grid-cols-2">
                      {platformStates.length > 0 ? platformStates.map((state) => (
                        <div key={state.key} className="rounded-[10px] border border-[var(--nx-border)] bg-[var(--nx-surface-2)] p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-[var(--nx-text-1)]">{t(state.nameKey)}</p>
                            <ReadinessBadge status={badgeStatusFor[state.status]}>{t(state.chipKey)}</ReadinessBadge>
                          </div>
                          <p className="text-xs leading-relaxed text-[var(--nx-text-3)]">{t(state.lineKey)}</p>
                        </div>
                      )) : (
                        <div className="rounded-[10px] border border-[var(--nx-border)] bg-[var(--nx-surface-2)] p-3 sm:col-span-2">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-[var(--nx-text-1)]">{t('connections.capabilityStatus')}</p>
                            <ReadinessBadge status="notAvailable">{t('connections.readiness.chip.notAvailable')}</ReadinessBadge>
                          </div>
                          <p className="text-xs leading-relaxed text-[var(--nx-text-3)]">{t('connections.notAvailableDesc')}</p>
                        </div>
                      )}
                    </div>

                    {/* Connected Account Details */}
                    {isConnected && connectedAccount && (
                      <div
                        className="mb-4 rounded-[12px] border border-[var(--nx-success-border)] bg-[var(--nx-success-bg)] p-3"
                      >
                        <p className="mb-1 text-xs text-[var(--nx-text-3)]">{t('connections.connectedAccount')}</p>
                        <p className="text-sm font-semibold text-[var(--nx-success)]">{connectedAccount.accountName}</p>
                        {connectedAccount.pages?.length > 0 && (
                          <div className="mt-2 space-y-1">
                            <p className="text-xs text-[var(--nx-text-3)]">{t('connections.pagesAndAccounts')}</p>
                            {connectedAccount.pages.map(page => (
                              <div key={page.id} className="flex items-center gap-2 text-xs text-[var(--nx-text-3)]">
                                <CheckCircle className="h-3 w-3 text-[var(--nx-success)]" />
                                <span>{page.name}</span>
                                {page.igAccountId && (
                                  <span className="text-[10px] text-pink-600">{t('connections.instagram')}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        <p className="mt-2 text-[10px] text-[var(--nx-text-4)]">
                          {t('connections.connectedDate')} {new Date(connectedAccount.connectedAt).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US')}
                        </p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-3">
                      {isConnected ? (
                        <>
                          <ActionButton
                            variant="secondary"
                            size="sm"
                            onClick={() => handleConnect(platform.id)}
                            disabled={isConnecting}
                            loading={isConnecting}
                            icon={<RefreshCw className="h-3.5 w-3.5" />}
                          >
                            {t('connections.refreshConnection')}
                          </ActionButton>
                          <ActionButton
                            variant="danger"
                            size="sm"
                            onClick={() => handleDisconnect(connectedAccount!.id)}
                            disabled={isDisconnecting}
                            loading={isDisconnecting}
                            icon={<Unplug className="h-3.5 w-3.5" />}
                          >
                            {t('connections.disconnectAccount')}
                          </ActionButton>
                        </>
                      ) : platform.available ? (
                        <ActionButton
                          size="sm"
                          onClick={() => handleConnect(platform.id)}
                          disabled={isConnecting}
                          loading={isConnecting}
                          icon={<Plug className="h-4 w-4" />}
                        >
                          {t(connectCtaKeyFor(platform.id))}
                        </ActionButton>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-[var(--nx-text-3)]">
                          <Info className="h-4 w-4" />
                          <span>{t('connections.comingSoonLong')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          <div className="rounded-[14px] border border-[var(--nx-warning-border)] bg-[var(--nx-warning-bg)] p-4">
            <p className="text-sm font-bold text-[var(--nx-text-1)]">{t('connections.paidBoundaryTitle')}</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--nx-text-2)]">{t('connections.paidBoundaryDesc')}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {[
                t('connections.paidBoundaryAccount'),
                t('connections.paidBoundaryPermissions'),
                t('connections.paidBoundaryBudget'),
                t('connections.paidBoundaryLaunch'),
              ].map((item, index) => (
                <div key={index} className="flex gap-2 rounded-[10px] border border-[var(--nx-warning-border)] bg-white/70 p-2 text-xs leading-relaxed text-[var(--nx-text-2)]">
                  <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--nx-warning)]" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[14px] border border-[var(--nx-border)] bg-[var(--nx-surface-2)] p-4">
            <p className="text-sm font-bold text-[var(--nx-text-1)]">{t('connections.futureChannelsTitle')}</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--nx-text-3)]">{t('connections.futureChannelsDesc')}</p>
          </div>

          {futurePlatforms.map((platform) => {
            const connectedAccount = accounts.find(a => a.platform === platform.id)
            const isConnected = !!connectedAccount
            const isConnecting = connecting === platform.id
            const isDisconnecting = disconnecting === connectedAccount?.id
            const platformStates = platform.id === 'META'
              ? readinessStates.filter((s) => s.key === 'facebook' || s.key === 'instagram')
              : platform.id === 'LINKEDIN'
              ? readinessStates.filter((s) => s.key === 'linkedin')
              : platform.id === 'TIKTOK'
              ? readinessStates.filter((s) => s.key === 'tiktok')
              : platform.id === 'YOUTUBE'
              ? readinessStates.filter((s) => s.key === 'youtube')
              : platform.id === 'GOOGLE'
              ? readinessStates.filter((s) => s.key === 'google')
              : platform.id === 'SNAPCHAT'
              ? readinessStates.filter((s) => s.key === 'snapchat')
              : []

            return (
              <div
                key={platform.id}
                className="overflow-hidden rounded-[14px] border bg-white transition-all"
                style={{
                  borderColor: isConnected ? 'var(--nx-success-border)' : 'var(--nx-border)',
                }}
              >
                <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start">
                  {/* Platform Logo */}
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px]"
                    style={{
                      background: `${platform.color}0F`,
                      border: `1px solid ${platform.color}18`,
                    }}
                  >
                    {platform.icon}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-[var(--nx-text-1)]">{t(platform.nameKey)}</h3>
                      {isConnected ? (
                        <ReadinessBadge status="ready">
                          {t('connections.connected')}
                        </ReadinessBadge>
                      ) : !platform.available ? (
                        <ReadinessBadge status="notAvailable">
                          {platform.eta ? `Coming ${platform.eta}` : t('connections.comingSoon')}
                        </ReadinessBadge>
                      ) : null}
                    </div>

                    <p className="mb-4 text-sm leading-6 text-[var(--nx-text-3)]">{t(platform.descKey)}</p>

                    <div className="mb-4 grid gap-2 sm:grid-cols-2">
                      {platformStates.length > 0 ? platformStates.map((state) => (
                        <div key={state.key} className="rounded-[10px] border border-[var(--nx-border)] bg-[var(--nx-surface-2)] p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-[var(--nx-text-1)]">{t(state.nameKey)}</p>
                            <ReadinessBadge status={badgeStatusFor[state.status]}>{t(state.chipKey)}</ReadinessBadge>
                          </div>
                          <p className="text-xs leading-relaxed text-[var(--nx-text-3)]">{t(state.lineKey)}</p>
                        </div>
                      )) : (
                        <div className="rounded-[10px] border border-[var(--nx-border)] bg-[var(--nx-surface-2)] p-3 sm:col-span-2">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-[var(--nx-text-1)]">{t('connections.capabilityStatus')}</p>
                            <ReadinessBadge status="notAvailable">{t('connections.readiness.chip.notAvailable')}</ReadinessBadge>
                          </div>
                          <p className="text-xs leading-relaxed text-[var(--nx-text-3)]">{t('connections.notAvailableDesc')}</p>
                        </div>
                      )}
                    </div>

                    {/* Connected Account Details */}
                    {isConnected && connectedAccount && (
                      <div
                        className="mb-4 rounded-[12px] border border-[var(--nx-success-border)] bg-[var(--nx-success-bg)] p-3"
                      >
                        <p className="mb-1 text-xs text-[var(--nx-text-3)]">{t('connections.connectedAccount')}</p>
                        <p className="text-sm font-semibold text-[var(--nx-success)]">{connectedAccount.accountName}</p>
                        {connectedAccount.pages?.length > 0 && (
                          <div className="mt-2 space-y-1">
                            <p className="text-xs text-[var(--nx-text-3)]">{t('connections.pagesAndAccounts')}</p>
                            {connectedAccount.pages.map(page => (
                              <div key={page.id} className="flex items-center gap-2 text-xs text-[var(--nx-text-3)]">
                                <CheckCircle className="h-3 w-3 text-[var(--nx-success)]" />
                                <span>{page.name}</span>
                                {page.igAccountId && (
                                  <span className="text-[10px] text-pink-600">{t('connections.instagram')}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        <p className="mt-2 text-[10px] text-[var(--nx-text-4)]">
                          {t('connections.connectedDate')} {new Date(connectedAccount.connectedAt).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US')}
                        </p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-3">
                      {isConnected ? (
                        <>
                          <ActionButton
                            variant="secondary"
                            size="sm"
                            onClick={() => handleConnect(platform.id)}
                            disabled={isConnecting}
                            loading={isConnecting}
                            icon={<RefreshCw className="h-3.5 w-3.5" />}
                          >
                            {t('connections.refreshConnection')}
                          </ActionButton>
                          <ActionButton
                            variant="danger"
                            size="sm"
                            onClick={() => handleDisconnect(connectedAccount!.id)}
                            disabled={isDisconnecting}
                            loading={isDisconnecting}
                            icon={<Unplug className="h-3.5 w-3.5" />}
                          >
                            {t('connections.disconnectAccount')}
                          </ActionButton>
                        </>
                      ) : platform.available ? (
                        <ActionButton
                          size="sm"
                          onClick={() => handleConnect(platform.id)}
                          disabled={isConnecting}
                          loading={isConnecting}
                          icon={<Plug className="h-4 w-4" />}
                        >
                          {t(connectCtaKeyFor(platform.id))}
                        </ActionButton>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-[var(--nx-text-3)]">
                          <Info className="h-4 w-4" />
                          <span>{t('connections.comingSoonLong')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          </SectionCard>
        </div>

        {/* ── Security Note ──────────────────────────────────── */}
        <div className="mt-6 flex items-start gap-3 rounded-[14px] border border-[var(--nx-border)] bg-white p-5">
          <Shield className="mt-0.5 h-5 w-5 shrink-0 text-[var(--nx-info)]" />
          <div>
            <p className="mb-1 text-sm font-semibold text-[var(--nx-text-1)]">{t('connections.securityTitle')}</p>
            <p className="text-xs leading-relaxed text-[var(--nx-text-3)]">{t('connections.securityDesc')}</p>
          </div>
        </div>

        {/* ── Help CTA ───────────────────────────────────────── */}
        <div className="mt-6 text-center">
          <p className="text-xs text-[var(--nx-text-3)]">
            {t('connections.helpText')}{' '}
            <a href="mailto:support@nexus-grow.com" className="text-[var(--nx-info)] transition hover:opacity-80">
              {t('connections.contactUs')}
            </a>
          </p>
        </div>

        </div>
      </div>
    </AppShell>
  )
}
