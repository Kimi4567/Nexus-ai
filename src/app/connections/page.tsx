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

interface Platform {
  id: string
  name: string
  nameAr: string
  nameEn: string
  descAr: string
  descEn: string
  icon: React.ReactNode
  color: string
  gradient: string
  available: boolean
  featuresAr: string[]
  featuresEn: string[]
}

const PLATFORMS: Platform[] = [
  {
    id: 'META',
    name: 'Meta',
    nameAr: 'Meta (فيسبوك + إنستجرام)',
    nameEn: 'Meta (Facebook + Instagram)',
    descAr: 'انشر وجدوِل على فيسبوك وإنستجرام مباشرةً. حلّل الأداء وأدِر الإعلانات.',
    descEn: 'Publish and schedule on Facebook and Instagram directly. Analyze performance and manage ads.',
    icon: (
      <svg viewBox="0 0 36 36" fill="none" className="w-7 h-7">
        <path d="M18 3C9.716 3 3 9.716 3 18s6.716 15 15 15 15-6.716 15-15S26.284 3 18 3z" fill="#1877F2" />
        <path d="M22.5 18h-2.25v7.5h-3V18H15v-2.625h2.25v-1.688c0-2.25 1.313-3.562 3.375-3.562.9 0 1.875.112 2.813.225v2.813h-1.688c-.787 0-.937.337-.937.9v1.312H22.5L22.5 18z" fill="white" />
      </svg>
    ),
    color: '#1877F2',
    gradient: 'from-blue-600/20 to-indigo-600/10',
    available: true,
    featuresAr: ['نشر تلقائي', 'جدولة المنشورات', 'إنستجرام + فيسبوك', 'إدارة الصفحات'],
    featuresEn: ['Auto publish', 'Post scheduling', 'Instagram + Facebook', 'Page management'],
  },
  {
    id: 'TIKTOK',
    name: 'TikTok',
    nameAr: 'TikTok',
    nameEn: 'TikTok',
    descAr: 'انشر فيديوهاتك القصيرة واستهدف الجمهور الشاب في السعودية والخليج.',
    descEn: 'Publish your short videos and target young audiences in Saudi Arabia and the Gulf.',
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
    available: false,
    featuresAr: ['نشر الفيديوهات', 'TikTok Ads', 'تحليل المشاهدات', 'ترندات الهاشتاق'],
    featuresEn: ['Video publishing', 'TikTok Ads', 'View analytics', 'Hashtag trends'],
  },
  {
    id: 'SNAPCHAT',
    name: 'Snapchat',
    nameAr: 'Snapchat',
    nameEn: 'Snapchat',
    descAr: 'أوسع جمهور شبابي في المملكة. ربط إعلانات سناب وإدارة المحتوى.',
    descEn: 'Largest youth audience in Saudi Arabia. Connect Snapchat Ads and manage content.',
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
    name: 'Google Ads',
    nameAr: 'Google Ads',
    nameEn: 'Google Ads',
    descAr: 'إعلانات البحث ويوتيوب. ادمج بيانات Google Ads مع تقاريرك في Nexus.',
    descEn: 'Search and YouTube ads. Integrate Google Ads data with your Nexus reports.',
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
    featuresAr: ['Search Ads', 'YouTube Ads', 'تقارير الأداء', 'ربط Google Analytics'],
    featuresEn: ['Search Ads', 'YouTube Ads', 'Performance reports', 'Google Analytics link'],
  },
  {
    id: 'TWITTER',
    name: 'X (Twitter)',
    nameAr: 'X (تويتر)',
    nameEn: 'X (Twitter)',
    descAr: 'جدوِل تغريداتك واستهدف جمهور الأعمال العربي على منصة X.',
    descEn: 'Schedule your tweets and target Arabic business audiences on X.',
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
  const { isAuthenticated, loading, authHeader } = useAuth()
  const { locale, dir } = useI18n()
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchAccounts = useCallback(async () => {
    setLoadingAccounts(true)
    try {
      const res = await fetch('/api/social/accounts', {
        headers: { Authorization: authHeader() },
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
      setMessage({ type: 'success', text: `✓ تم ربط ${platform === 'meta' ? 'Meta (Facebook/Instagram)' : platform} بنجاح!` })
      window.history.replaceState({}, '', '/connections')
      setTimeout(() => setMessage(null), 5000)
    } else if (social === 'error') {
      const msg = params.get('msg') || 'خطأ غير معروف'
      setMessage({ type: 'error', text: `فشل الربط: ${msg}` })
      window.history.replaceState({}, '', '/connections')
      setTimeout(() => setMessage(null), 8000)
    } else if (social === 'denied') {
      setMessage({ type: 'error', text: 'تم إلغاء الربط من قِبَلك.' })
      window.history.replaceState({}, '', '/connections')
      setTimeout(() => setMessage(null), 4000)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) fetchAccounts()
  }, [isAuthenticated, fetchAccounts])

  const handleConnect = async (platformId: string) => {
    if (platformId !== 'META') return // Only Meta is live
    setConnecting(platformId)
    try {
      const res = await fetch('/api/social/connect/meta', {
        headers: { Authorization: authHeader() },
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setMessage({ type: 'error', text: data.error || 'فشل بدء الربط' })
        setConnecting(null)
      }
    } catch {
      setMessage({ type: 'error', text: 'فشل الاتصال. تحقق من الإعدادات.' })
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
      setMessage({ type: 'success', text: 'تم قطع الاتصال بنجاح.' })
      setTimeout(() => setMessage(null), 3000)
    } catch {
      setMessage({ type: 'error', text: 'فشل قطع الاتصال.' })
    } finally {
      setDisconnecting(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020204] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const connectedCount = accounts.length
  const totalPlatforms = PLATFORMS.length

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-10 page-enter" dir={dir}>

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-2">
            <Plug className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-emerald-400/70 font-mono tracking-wider">NEXUS CONNECTIONS</span>
          </div>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">{locale === 'ar' ? 'ربط المنصات' : 'Connect Platforms'}</h1>
              <p className="text-gray-400 text-sm max-w-lg">
                {locale === 'ar'
                  ? 'اربط حساباتك على وسائل التواصل الاجتماعي لكي يتمكن Nexus من النشر والجدولة وتحليل الأداء تلقائياً.'
                  : 'Connect your social media accounts so Nexus can publish, schedule and analyze performance automatically.'}
              </p>
            </div>
            <button
              onClick={fetchAccounts}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
            >
              <RefreshCw className={`w-4 h-4 text-gray-400 ${loadingAccounts ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* ── Status Banner ──────────────────────────────────── */}
        {message && (
          <div
            className={`flex items-center gap-3 px-5 py-3 mb-6 rounded-xl text-sm ${
              message.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                : 'bg-red-500/10 border border-red-500/20 text-red-300'
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
            background: connectedCount > 0
              ? 'rgba(16,185,129,0.04)'
              : 'rgba(245,158,11,0.04)',
            border: connectedCount > 0
              ? '1px solid rgba(16,185,129,0.15)'
              : '1px solid rgba(245,158,11,0.15)',
          }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-2xl font-black"
            style={{
              background: connectedCount > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
              color: connectedCount > 0 ? '#10b981' : '#f59e0b',
            }}
          >
            {connectedCount}/{totalPlatforms}
          </div>
          <div className="flex-1">
            {connectedCount === 0 ? (
              <>
                <p className="font-bold text-amber-400 mb-0.5">{locale === 'ar' ? 'لم تربط أي منصة حتى الآن' : 'No platforms connected yet'}</p>
                <p className="text-sm text-gray-400">{locale === 'ar' ? 'ابدأ بربط Meta لتفعيل النشر التلقائي على فيسبوك وإنستجرام.' : 'Start with Meta to enable auto-publishing on Facebook and Instagram.'}</p>
              </>
            ) : (
              <>
                <p className="font-bold text-emerald-400 mb-0.5">
                  {locale === 'ar'
                    ? (connectedCount === 1 ? 'منصة واحدة مربوطة' : `${connectedCount} منصات مربوطة`) + ' ✓'
                    : `${connectedCount} platform${connectedCount > 1 ? 's' : ''} connected ✓`}
                </p>
                <p className="text-sm text-gray-400">{locale === 'ar' ? 'يمكنك ربط المزيد من المنصات لتوسيع نطاق حملاتك.' : 'You can connect more platforms to expand your campaign reach.'}</p>
              </>
            )}
          </div>
          {connectedCount === 0 && (
            <button
              onClick={() => handleConnect('META')}
              disabled={connecting === 'META'}
              className="shrink-0 px-5 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #1877F2, #4c9fff)', color: '#fff' }}
            >
              {connecting === 'META'
                ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{locale === 'ar' ? 'جارٍ الربط...' : 'Connecting...'}</span>
                : (locale === 'ar' ? 'ابدأ بـ Meta' : 'Start with Meta')}
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
                  background: isConnected
                    ? 'rgba(16,185,129,0.03)'
                    : 'rgba(255,255,255,0.02)',
                  border: isConnected
                    ? '1px solid rgba(16,185,129,0.15)'
                    : '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div className="p-6 flex items-start gap-5">
                  {/* Platform Logo */}
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${platform.color}18, ${platform.color}08)`,
                      border: `1px solid ${platform.color}20`,
                    }}
                  >
                    {platform.icon}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap mb-2">
                      <h3 className="text-lg font-bold">{locale === 'ar' ? platform.nameAr : platform.nameEn}</h3>
                      {isConnected ? (
                        <span className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {locale === 'ar' ? 'متصل' : 'Connected'}
                        </span>
                      ) : !platform.available ? (
                        <span className="text-xs px-3 py-1 rounded-full font-semibold bg-white/5 text-gray-500 border border-white/8">
                          {locale === 'ar' ? 'قريباً' : 'Coming soon'}
                        </span>
                      ) : null}
                    </div>

                    <p className="text-sm text-gray-400 mb-3">{locale === 'ar' ? platform.descAr : platform.descEn}</p>

                    {/* Features */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {(locale === 'ar' ? platform.featuresAr : platform.featuresEn).map(f => (
                        <span
                          key={f}
                          className="text-xs px-2.5 py-1 rounded-lg"
                          style={{
                            background: `${platform.color}10`,
                            color: isConnected ? platform.color : '#64748b',
                            border: `1px solid ${platform.color}15`,
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
                        style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.1)' }}
                      >
                        <p className="text-xs text-gray-400 mb-1">{locale === 'ar' ? 'الحساب المربوط' : 'Connected account'}</p>
                        <p className="font-semibold text-sm text-emerald-300">{connectedAccount.accountName}</p>
                        {connectedAccount.pages?.length > 0 && (
                          <div className="mt-2 space-y-1">
                            <p className="text-xs text-gray-500">{locale === 'ar' ? 'الصفحات والحسابات:' : 'Pages & accounts:'}</p>
                            {connectedAccount.pages.map(page => (
                              <div key={page.id} className="flex items-center gap-2 text-xs text-gray-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span>{page.name}</span>
                                {page.igAccountId && (
                                  <span className="text-pink-400 text-[10px]">+ إنستجرام</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        <p className="text-[10px] text-gray-600 mt-2">
                          {locale === 'ar' ? 'تاريخ الربط:' : 'Connected:'} {new Date(connectedAccount.connectedAt).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US')}
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
                              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{locale === 'ar' ? 'جارٍ التحديث...' : 'Refreshing...'}</>
                              : <><RefreshCw className="w-3.5 h-3.5" />{locale === 'ar' ? 'تجديد الربط' : 'Refresh'}</>}
                          </button>
                          <button
                            onClick={() => handleDisconnect(connectedAccount!.id)}
                            disabled={isDisconnecting}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-red-400 hover:text-red-300 transition-all disabled:opacity-60"
                            style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}
                          >
                            {isDisconnecting
                              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{locale === 'ar' ? 'جارٍ الفصل...' : 'Disconnecting...'}</>
                              : <><Unplug className="w-3.5 h-3.5" />{locale === 'ar' ? 'فصل الحساب' : 'Disconnect'}</>}
                          </button>
                        </>
                      ) : platform.available ? (
                        <button
                          onClick={() => handleConnect(platform.id)}
                          disabled={isConnecting}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-60 text-white"
                          style={{ background: `linear-gradient(135deg, ${platform.color}, ${platform.color}aa)` }}
                        >
                          {isConnecting
                            ? <><Loader2 className="w-4 h-4 animate-spin" />{locale === 'ar' ? 'جارٍ الربط...' : 'Connecting...'}</>
                            : <><Plug className="w-4 h-4" />{locale === 'ar' ? 'ربط الحساب' : 'Connect account'}</>}
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Zap className="w-4 h-4" />
                          <span>{locale === 'ar' ? 'سيكون متاحاً قريباً — نعمل عليه' : 'Coming soon — we\'re working on it'}</span>
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
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <Shield className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold mb-1">{locale === 'ar' ? 'أمان بياناتك أولويتنا' : 'Your data security is our priority'}</p>
            <p className="text-xs text-gray-500 leading-relaxed">
              {locale === 'ar'
                ? 'Nexus لا يحتفظ بكلمات المرور. نستخدم OAuth 2.0 الرسمي لكل منصة — وهو نفس الأسلوب الذي تستخدمه كبرى التطبيقات. يمكنك فصل أي حساب في أي وقت وسيتم حذف رمز الوصول فوراً.'
                : 'Nexus never stores passwords. We use official OAuth 2.0 for each platform — the same method used by leading apps. You can disconnect any account at any time and the access token will be deleted immediately.'}
            </p>
          </div>
        </div>

        {/* ── Help CTA ───────────────────────────────────────── */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-600">
            {locale === 'ar' ? 'تواجه مشكلة في الربط؟' : 'Having trouble connecting?'}{' '}
            <a href="mailto:support@nexus-grow.com" className="text-amber-500 hover:text-amber-400 transition">
              {locale === 'ar' ? 'تواصل معنا' : 'Contact us'}
            </a>
          </p>
        </div>

      </div>
    </AppShell>
  )
}
