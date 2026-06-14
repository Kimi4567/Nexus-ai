'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import AppShell from '@/components/AppShell'
import Link from 'next/link'
import {
  CheckCircle2, AlertCircle, Loader2, Unplug, Plug, Sparkles,
  ExternalLink, ChevronRight, Shield, Zap, Globe, RefreshCw
} from 'lucide-react'

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

interface PlatformDef {
  id: string
  nameKey: string    // t() key for platform name
  descKey: string    // t() key for description
  icon: React.ReactNode
  color: string
  gradient: string
  available: boolean
  eta?: string            // e.g. "Q3 2026" — shown instead of generic "Coming Soon"
  featuresAr: string[]
  featuresEn: string[]
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
    gradient: 'from-blue-600/20 to-indigo-600/10',
    available: true,
    featuresAr: ['النشر والجدولة', 'جدولة المنشورات', 'إنستجرام + فيسبوك', 'إدارة الصفحات'],
    featuresEn: ['Publish & schedule', 'Post scheduling', 'Instagram + Facebook', 'Page management'],
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
    gradient: 'from-blue-700/20 to-blue-500/10',
    available: true,
    featuresAr: ['نشر على LinkedIn', 'مشاركات نصية وصور', 'بناء الحضور المهني', 'LinkedIn Personal'],
    featuresEn: ['LinkedIn publishing', 'Text & image posts', 'Professional presence', 'Personal profile'],
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
    gradient: 'from-rose-600/20 to-pink-600/10',
    available: true,
    featuresAr: ['نشر الفيديوهات', 'TikTok Ads', 'تحليل المشاهدات', 'ترندات الهاشتاق'],
    featuresEn: ['Video publishing', 'TikTok Ads', 'View analytics', 'Hashtag trends'],
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
    gradient: 'from-yellow-500/20 to-amber-500/10',
    available: false,
    featuresAr: ['Snapchat Ads', 'Story النشر', 'استهداف السعودية', 'Lens / Filter'],
    featuresEn: ['Snapchat Ads', 'Story publishing', 'Saudi targeting', 'Lens / Filter'],
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
    gradient: 'from-blue-500/20 to-green-500/10',
    available: false,
    eta: 'Q3 2026',
    featuresAr: ['Search Ads', 'YouTube Ads', 'تقارير الأداء', 'ربط Google Analytics'],
    featuresEn: ['Search Ads', 'YouTube Ads', 'Performance reports', 'Google Analytics link'],
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
    gradient: 'from-slate-600/20 to-slate-800/10',
    available: false,
    featuresAr: ['جدولة التغريدات', 'Twitter Ads', 'تحليل التفاعل', 'Threads'],
    featuresEn: ['Tweet scheduling', 'Twitter Ads', 'Engagement analytics', 'Threads'],
  },
]

export default function ConnectionsPage() {
  const { isAuthenticated, loading, authHeader, session } = useAuth()
  const { locale, dir, t } = useI18n()
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchAccounts = useCallback(async () => {
    const token = authHeader()
    if (!token) return
    setLoadingAccounts(true)
    try {
      const res = await fetch('/api/social/accounts', {
        headers: { Authorization: token },
      })
      const data = await res.json()
      setAccounts(data.accounts || [])
    } catch {
      setAccounts([])
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
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const connectedCount = accounts.length
  const totalPlatforms = PLATFORMS.length

  return (
    <AppShell>
      <div className="min-h-screen bg-[#f5f5f7]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 page-enter" dir={dir}>

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-2">
            <Plug className="w-4 h-4 text-blue-600" />
            <span className="text-xs text-slate-500 font-semibold tracking-[0.18em] uppercase">NEXUS CONNECTIONS</span>
          </div>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-semibold text-slate-950 mb-2">{t('connections.title')}</h1>
              <p className="text-slate-500 text-sm max-w-lg leading-6">{t('connections.subtitle')}</p>
            </div>
            <button
              onClick={fetchAccounts}
              className="p-2.5 rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:border-slate-300 hover:text-slate-900"
            >
              <RefreshCw className={`w-4 h-4 ${loadingAccounts ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* ── Status Banner ──────────────────────────────────── */}
        {message && (
          <div
            className={`flex items-center gap-3 px-5 py-3 mb-6 rounded-xl text-sm ${
              message.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}
          >
            {message.type === 'success'
              ? <CheckCircle2 className="w-4 h-4 shrink-0" />
              : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="mr-auto opacity-60 hover:opacity-100 text-lg leading-none">×</button>
          </div>
        )}

        {/* ── Progress Summary ───────────────────────────────── */}
        <div
          className="flex items-center gap-5 p-5 mb-8 rounded-2xl"
          style={{
            background: '#FFFFFF',
            border: loadingAccounts ? '1px solid rgba(59,130,246,0.14)' : connectedCount > 0 ? '1px solid rgba(16,185,129,0.16)' : '1px solid rgba(245,158,11,0.18)',
            boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
          }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-2xl font-black"
            style={{
              background: loadingAccounts ? '#EFF6FF' : connectedCount > 0 ? '#ECFDF5' : '#FFFBEB',
              color: loadingAccounts ? '#2563EB' : connectedCount > 0 ? '#059669' : '#D97706',
            }}
          >
            {loadingAccounts ? '…' : `${connectedCount}/${totalPlatforms}`}
          </div>
          <div className="flex-1">
            {loadingAccounts ? (
              <div className="space-y-1.5">
                <div className="h-3 w-36 rounded animate-pulse bg-slate-200" />
                <div className="h-2.5 w-52 rounded animate-pulse bg-slate-100" />
              </div>
            ) : connectedCount === 0 ? (
              <>
                <p className="font-semibold text-amber-700 mb-0.5">{t('connections.noneConnected')}</p>
                <p className="text-sm text-slate-500">{t('connections.noneConnectedDesc')}</p>
              </>
            ) : (
              <>
                <p className="font-semibold text-emerald-700 mb-0.5">
                  {connectedCount === 1
                    ? t('connections.platform1Connected')
                    : `${connectedCount} ${t('connections.platformNConnected')}`}
                </p>
                <p className="text-sm text-slate-500">{t('connections.expandDesc')}</p>
              </>
            )}
          </div>
          {!loadingAccounts && connectedCount === 0 && (
            <button
              onClick={() => handleConnect('META')}
              disabled={connecting === 'META'}
              className="shrink-0 px-5 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-60"
              style={{ background: '#1877F2', color: '#fff', boxShadow: '0 8px 20px rgba(24,119,242,0.18)' }}
            >
              {connecting === 'META'
                ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{t('connections.connecting')}</span>
                : t('connections.startWithMeta')}
            </button>
          )}
        </div>

        {/* ── Platform Cards ─────────────────────────────────── */}
        <div className="space-y-4">
          {PLATFORMS.map((platform) => {
            const connectedAccount = accounts.find(a => a.platform === platform.id)
            const isConnected = !!connectedAccount
            const isConnecting = connecting === platform.id
            const isDisconnecting = disconnecting === connectedAccount?.id

            return (
              <div
                key={platform.id}
                className="rounded-2xl overflow-hidden transition-all"
                style={{
                  background: isConnected ? '#F7FEFB' : '#FFFFFF',
                  border: isConnected ? '1px solid rgba(16,185,129,0.22)' : '1px solid rgba(15,23,42,0.08)',
                  boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
                }}
              >
                <div className="p-6 flex items-start gap-5">
                  {/* Platform Logo */}
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                    style={{
                      background: `${platform.color}0F`,
                      border: `1px solid ${platform.color}18`,
                    }}
                  >
                    {platform.icon}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap mb-2">
                      <h3 className="text-lg font-semibold text-slate-950">{t(platform.nameKey)}</h3>
                      {isConnected ? (
                        <span className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {t('connections.connected')}
                        </span>
                      ) : !platform.available ? (
                        <span className="text-xs px-3 py-1 rounded-full font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                          {platform.eta ? `Coming ${platform.eta}` : t('connections.comingSoon')}
                        </span>
                      ) : null}
                    </div>

                    <p className="text-sm text-slate-500 mb-3 leading-6">{t(platform.descKey)}</p>

                    {/* Features — content data, locale ternary is acceptable */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {(locale === 'ar' ? platform.featuresAr : platform.featuresEn).map(f => (
                        <span
                          key={f}
                          className="text-xs px-2.5 py-1 rounded-lg"
                          style={{
                            background: `${platform.color}10`,
                            color: isConnected ? platform.color : '#475569',
                            border: `1px solid ${platform.color}14`,
                          }}
                        >
                          {f}
                        </span>
                      ))}
                    </div>

                    {/* Connected Account Details */}
                    {isConnected && connectedAccount && (
                      <div
                        className="p-3 rounded-xl mb-4"
                        style={{ background: '#FFFFFF', border: '1px solid rgba(16,185,129,0.16)' }}
                      >
                        <p className="text-xs text-slate-500 mb-1">{t('connections.connectedAccount')}</p>
                        <p className="font-semibold text-sm text-emerald-700">{connectedAccount.accountName}</p>
                        {connectedAccount.pages?.length > 0 && (
                          <div className="mt-2 space-y-1">
                            <p className="text-xs text-slate-500">{t('connections.pagesAndAccounts')}</p>
                            {connectedAccount.pages.map(page => (
                              <div key={page.id} className="flex items-center gap-2 text-xs text-slate-500">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span>{page.name}</span>
                                {page.igAccountId && (
                                  <span className="text-pink-600 text-[10px]">{t('connections.instagram')}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        <p className="text-[10px] text-slate-400 mt-2">
                          {t('connections.connectedDate')} {new Date(connectedAccount.connectedAt).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US')}
                        </p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3">
                      {isConnected ? (
                        <>
                          <button
                            onClick={() => handleConnect(platform.id)}
                            disabled={isConnecting}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-60"
                            style={{
                              background: `${platform.color}15`,
                              color: platform.color,
                              border: `1px solid ${platform.color}25`,
                            }}
                          >
                            {isConnecting
                              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{t('connections.refreshing')}</>
                              : <><RefreshCw className="w-3.5 h-3.5" />{t('connections.refreshConnection')}</>}
                          </button>
                          <button
                            onClick={() => handleDisconnect(connectedAccount!.id)}
                            disabled={isDisconnecting}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-red-700 hover:text-red-800 transition-all disabled:opacity-60"
                            style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}
                          >
                            {isDisconnecting
                              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{t('connections.disconnecting')}</>
                              : <><Unplug className="w-3.5 h-3.5" />{t('connections.disconnectAccount')}</>}
                          </button>
                        </>
                      ) : platform.available ? (
                        <button
                          onClick={() => handleConnect(platform.id)}
                          disabled={isConnecting}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-60 text-white"
                          style={{ background: platform.color, boxShadow: `0 8px 20px ${platform.color}1F` }}
                        >
                          {isConnecting
                            ? <><Loader2 className="w-4 h-4 animate-spin" />{t('connections.connecting')}</>
                            : <><Plug className="w-4 h-4" />{t('connections.connectAccount')}</>}
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <Zap className="w-4 h-4" />
                          <span>{t('connections.comingSoonLong')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Security Note ──────────────────────────────────── */}
        <div
          className="flex items-start gap-3 mt-8 p-5 rounded-2xl"
          style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}
        >
          <Shield className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-slate-950 mb-1">{t('connections.securityTitle')}</p>
            <p className="text-xs text-slate-500 leading-relaxed">{t('connections.securityDesc')}</p>
          </div>
        </div>

        {/* ── Help CTA ───────────────────────────────────────── */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            {t('connections.helpText')}{' '}
            <a href="mailto:support@nexus-grow.com" className="text-blue-600 hover:text-blue-700 transition">
              {t('connections.contactUs')}
            </a>
          </p>
        </div>

        </div>
      </div>
    </AppShell>
  )
}
