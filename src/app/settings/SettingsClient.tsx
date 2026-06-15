'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { supabase } from '@/lib/supabaseClient'
import AppShell from '@/components/AppShell'
import ReferralWidget from '@/components/ReferralWidget'
import {
  Settings, Shield, Bell, Globe, Palette, KeyRound,
  LogOut, ChevronLeft, Check, AlertTriangle, User,
  CreditCard, Lock, ExternalLink, Eye, EyeOff, Save,
  Sparkles, Monitor, Moon, Sun, Trash2, ChevronRight, Gift
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   SETTINGS — Command Center Configuration
   Redesigned to match the cosmic space theme
   ═══════════════════════════════════════════════════════════════ */

interface SocialAccount {
  id: string
  platform: string
  status: string
  accountId: string
  accountName: string
  pages: Array<{ id: string; name: string; igAccountId: string | null }>
  pictureUrl: string | null
  connectedAt: string
}

// ── Stable sub-components (must live at MODULE level, not inside SettingsPage)  ──
// If defined inside SettingsPage, React treats them as new component types on
// every render and unmounts/remounts the DOM — causing inputs to lose focus
// after every keystroke.

function GlassCard({
  children,
  className = '',
  accent = false,
  style = {},
}: {
  children: React.ReactNode
  className?: string
  accent?: boolean
  style?: React.CSSProperties
}) {
  return (
    <div
      className={`page-enter ${className}`}
      style={{
        background: accent ? 'rgba(239,68,68,0.03)' : '#fff',
        border: accent ? '1px solid rgba(239,68,68,0.12)' : '1px solid rgba(15,23,42,0.08)',
        borderRadius: '16px',
        boxShadow: '0 1px 4px rgba(15,23,42,0.04)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function SectionBadge({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>{label}</span>
    </div>
  )
}

// Static section config — uses translation keys
const SECTION_DEFS: { id: string; labelKey: string; icon: React.ElementType; color: string }[] = [
  { id: 'profile',   labelKey: 'settings.profile',          icon: User,          color: '#06b6d4' },
  { id: 'security',  labelKey: 'settings.security',         icon: Shield,        color: '#f59e0b' },
  { id: 'accounts',  labelKey: 'settings.sectionAccounts',  icon: Globe,         color: '#10b981' },
  { id: 'billing',   labelKey: 'settings.sectionBillingNav',icon: CreditCard,    color: '#8b5cf6' },
  // BETA: 'referral' section hidden from nav (referrals are a post-PMF growth feature).
  // The render block + ReferralWidget remain in code; re-add this entry to re-enable.
  { id: 'danger',    labelKey: 'settings.sectionDanger',    icon: AlertTriangle, color: '#ef4444' },
]

export default function SettingsPage() {
  const router = useRouter()
  const { user, isAuthenticated, loading, authHeader } = useAuth()
  const { locale, dir, t } = useI18n()

  const [activeSection, setActiveSection] = useState('profile')

  const [displayName,   setDisplayName]   = useState('')
  const [savingName,    setSavingName]     = useState(false)
  const [nameSuccess,   setNameSuccess]    = useState('')
  const [nameError,     setNameError]      = useState('')

  const [newPassword,     setNewPassword]     = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword,    setShowPassword]    = useState(false)
  const [savingPassword,  setSavingPassword]  = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordError,   setPasswordError]   = useState('')

  const [socialAccounts,  setSocialAccounts]  = useState<SocialAccount[]>([])
  const [socialLoading,   setSocialLoading]   = useState(false)
  const [socialConnecting,setSocialConnecting]= useState(false)
  const [socialMessage,   setSocialMessage]   = useState('')
  const [disconnecting,   setDisconnecting]   = useState<string | null>(null)

  const [signingOut, setSigningOut] = useState(false)

  // Reset workspace
  const [resetConfirmOpen,  setResetConfirmOpen]  = useState(false)
  const [resetConfirmInput, setResetConfirmInput] = useState('')
  const [resetting,         setResetting]         = useState(false)
  const [resetMessage,      setResetMessage]      = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [billingStatus, setBillingStatus] = useState<{
    plan: string
    hasActiveSubscription: boolean
    credits: { remaining: number; used: number; max: number }
  } | null>(null)

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/auth/login')
  }, [loading, isAuthenticated, router])

  // Handle OAuth callback messages
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const social   = params.get('social')
    const platform = params.get('platform')
    if (social === 'connected') {
      const platformName = platform === 'meta' ? 'Meta (Facebook/Instagram)' : (platform || '')
      setSocialMessage(
        (t('settings.connectionSuccess') as string).replace('{platform}', platformName)
      )
      fetchSocialAccounts()
      setTimeout(() => setSocialMessage(''), 5000)
    } else if (social === 'denied') {
      setSocialMessage(t('settings.connectionCancelled') as string)
      setTimeout(() => setSocialMessage(''), 3000)
    } else if (social === 'error') {
      const msg = params.get('msg') || ''
      setSocialMessage(
        (t('settings.connectionFailed') as string).replace('{msg}', msg)
      )
      setTimeout(() => setSocialMessage(''), 10000)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchSocialAccounts = useCallback(async () => {
    const token = authHeader()
    if (!token) return
    setSocialLoading(true)
    try {
      const res  = await fetch('/api/social/accounts', { headers: { Authorization: token } })
      const data = await res.json()
      setSocialAccounts(data.accounts || [])
    } catch {
      setSocialAccounts([])
    } finally {
      setSocialLoading(false)
    }
  }, [authHeader])

  useEffect(() => {
    if (isAuthenticated) fetchSocialAccounts()
  }, [isAuthenticated, fetchSocialAccounts])

  useEffect(() => {
    if (user) setDisplayName(user?.user_metadata?.name || user?.email?.split('@')[0] || '')
  }, [user])

  // Fetch real billing status when billing section is opened
  useEffect(() => {
    if (activeSection !== 'billing') return
    const token = authHeader()
    if (!token) return
    fetch('/api/billing/status', { headers: { Authorization: token } })
      .then(r => r.json())
      .then(d => { if (d.plan) setBillingStatus(d) })
      .catch(() => {})
  }, [activeSection, authHeader])

  const handleConnectMeta = async () => {
    const token = authHeader()
    if (!token) return
    setSocialConnecting(true)
    try {
      const res  = await fetch('/api/social/connect/meta', { headers: { Authorization: token } })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else setSocialMessage(data.error || t('settings.connectFailed') as string)
    } catch {
      setSocialMessage(t('settings.connectError') as string)
    } finally {
      setSocialConnecting(false)
    }
  }

  const handleDisconnect = async (integrationId: string) => {
    const token = authHeader()
    if (!token) return
    setDisconnecting(integrationId)
    try {
      await fetch('/api/social/accounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({ integrationId }),
      })
      setSocialAccounts(prev => prev.filter(a => a.id !== integrationId))
    } catch {
      setSocialMessage(t('settings.disconnectFailed') as string)
    } finally {
      setDisconnecting(null)
    }
  }

  const handleSaveName = async () => {
    if (!displayName.trim()) return
    setSavingName(true)
    setNameError('')
    setNameSuccess('')
    try {
      const { error } = await supabase.auth.updateUser({ data: { name: displayName } })
      if (error) throw error
      setNameSuccess(t('settings.nameUpdated') as string)
      setTimeout(() => setNameSuccess(''), 3000)
    } catch (err: any) {
      setNameError(err.message || t('settings.nameUpdateFailed') as string)
    } finally {
      setSavingName(false)
    }
  }

  const handleChangePassword = async () => {
    setPasswordError('')
    setPasswordSuccess('')
    if (newPassword.length < 8) {
      setPasswordError(t('settings.passwordTooShort') as string)
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('settings.passwordMismatch') as string)
      return
    }
    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setPasswordSuccess(t('settings.passwordUpdated') as string)
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordSuccess(''), 3000)
    } catch (err: any) {
      setPasswordError(err.message || t('settings.passwordUpdateFailed') as string)
    } finally {
      setSavingPassword(false)
    }
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleResetWorkspace = async () => {
    if (resetConfirmInput.trim() !== 'RESET') return
    setResetting(true)
    setResetMessage(null)
    try {
      const res = await fetch('/api/workspace/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
        body: JSON.stringify({ confirm: 'RESET' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Reset failed')
      setResetMessage({ type: 'success', text: t('settings.resetWorkspaceSuccess') as string })
      setResetConfirmOpen(false)
      setResetConfirmInput('')
      // Give user a moment to see the success toast, then redirect
      setTimeout(() => router.push('/dashboard'), 1500)
    } catch (err: any) {
      setResetMessage({ type: 'error', text: t('settings.resetWorkspaceError') as string })
    } finally {
      setResetting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-2 border-slate-200 border-t-slate-500 animate-spin" />
          <Sparkles className="w-6 h-6 text-slate-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
      </div>
    )
  }
  if (!isAuthenticated) return null

  const email    = user?.email || ''
  const provider = user?.app_metadata?.provider || 'email'
  const createdAt = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—'

  const metaAccount = socialAccounts.find(a => a.platform === 'META')

  // Resolve section labels
  const SECTIONS = SECTION_DEFS.map(s => ({ ...s, label: t(s.labelKey) as string }))

  return (
    <AppShell>
      <div className="min-h-screen bg-[#f5f5f7]" dir={dir}>

        <div className="max-w-5xl mx-auto px-6 py-10 page-enter">
          {/* ── Header ───────────────────────────────────────── */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(15,23,42,0.05)', border: '1px solid rgba(15,23,42,0.08)' }}>
                <Settings className="w-4 h-4 text-slate-500" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t('sidebar.settings')}</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-950 mb-1">{t('settings.pageTitle')}</h1>
            <p className="text-[13px] text-slate-500">{t('settings.subheading')}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* ── Sidebar Navigation ─────────────────────────── */}
            <div className="lg:col-span-3 space-y-2">
              {SECTIONS.map((section) => {
                const Icon = section.icon
                const isActive = activeSection === section.id
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'text-slate-950'
                        : 'text-slate-500 hover:text-slate-950 hover:bg-slate-50'
                    }`}
                    style={{
                      background: isActive ? '#f1f5f9' : 'transparent',
                      border: isActive ? '1px solid rgba(15,23,42,0.12)' : '1px solid transparent',
                    }}
                  >
                    <Icon className="w-4 h-4" style={{ color: isActive ? section.color : undefined }} />
                    <span className={`flex-1 ${locale === 'ar' ? 'text-right' : 'text-left'}`}>{section.label}</span>
                    {isActive && <ChevronLeft className="w-4 h-4 text-slate-400" />}
                  </button>
                )
              })}

              <div className="pt-4 mt-4" style={{ borderTop: '1px solid rgba(15,23,42,0.08)' }}>
                <Link
                  href="/dashboard"
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-slate-500 hover:text-slate-950 hover:bg-slate-50 transition-all"
                >
                  <Monitor className="w-4 h-4" />
                  <span className={`flex-1 ${locale === 'ar' ? 'text-right' : 'text-left'}`}>{t('settings.backToDashboard')}</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* ── Main Content ───────────────────────────────── */}
            <div className="lg:col-span-9 space-y-6">

              {/* ═══ PROFILE ═══════════════════════════════════ */}
              {activeSection === 'profile' && (
                <>
                  {/* Overview Card */}
                  <GlassCard className="p-6">
                    <div className="flex items-center gap-5">
                      <div
                        className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold text-slate-700"
                        style={{
                          background: '#f1f5f9',
                          border: '1px solid rgba(15,23,42,0.08)',
                        }}
                      >
                        {(displayName || email).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <h2 className="text-xl font-bold text-slate-950 mb-1">{displayName || t('settings.user')}</h2>
                        <p className="text-slate-500 text-sm">{email}</p>
                        <div className="flex gap-2 mt-3">
                          <span
                            className="text-[11px] px-3 py-1 rounded-full font-semibold"
                            style={{
                              background: '#fff7ed',
                              color: '#c2410c',
                              border: '1px solid rgba(194,65,12,0.15)',
                            }}
                          >
                            {provider === 'google' ? '🔵 Google' : t('settings.emailProvider')}
                          </span>
                          {/* PR-1D: plan badge reads the same source as Billing
                              (/api/billing/status). Hidden until loaded — never a
                              hardcoded "Free Plan" that contradicts Billing. */}
                          {billingStatus && (
                            <span
                              className="text-[11px] px-3 py-1 rounded-full font-semibold"
                              style={{
                                background: 'rgba(5,150,105,0.08)',
                                color: '#059669',
                                border: '1px solid rgba(5,150,105,0.15)',
                              }}
                            >
                              {billingStatus.hasActiveSubscription
                                ? (billingStatus.plan
                                    ? billingStatus.plan.charAt(0).toUpperCase() + billingStatus.plan.slice(1)
                                    : (locale === 'ar' ? 'مشترك' : 'Subscribed'))
                                : (locale === 'ar' ? 'مجاني' : 'Free')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-6 pt-6" style={{ borderTop: '1px solid rgba(15,23,42,0.08)' }}>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">{t('settings.memberSince')}</p>
                        <p className="text-sm font-semibold text-slate-950">{createdAt}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">{t('settings.userId')}</p>
                        <p className="text-xs font-mono text-slate-400 truncate">{user?.id}</p>
                      </div>
                    </div>
                  </GlassCard>

                  {/* Edit Name */}
                  <GlassCard className="p-6">
                    <SectionBadge color="#06b6d4" label={t('settings.profile') as string} />
                    <h3 className="text-lg font-bold mb-1">{t('settings.displayNameTitle')}</h3>
                    <p className="text-slate-500 text-sm mb-6">{t('settings.displayNameDesc')}</p>

                    <div className="space-y-4 max-w-md">
                      <div>
                        <label className="block text-sm font-medium text-slate-600 mb-2">{t('settings.name')}</label>
                        <input
                          type="text"
                          value={displayName}
                          onChange={e => setDisplayName(e.target.value)}
                          className="input-nexus"
                          placeholder={t('settings.namePlaceholder') as string}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-600 mb-2">{t('settings.email')}</label>
                        <input
                          type="email"
                          value={email}
                          disabled
                          className="input-nexus opacity-50 cursor-not-allowed"
                        />
                        <p className="text-xs text-slate-400 mt-1">{t('settings.emailCannotChange')}</p>
                      </div>

                      {nameSuccess && (
                        <div className="flex items-center gap-2 p-3 rounded-xl text-sm"
                          style={{ background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.15)', color: '#059669' }}>
                          <Check className="w-4 h-4" /> {nameSuccess}
                        </div>
                      )}
                      {nameError && (
                        <div className="flex items-center gap-2 p-3 rounded-xl text-sm"
                          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444' }}>
                          <AlertTriangle className="w-4 h-4" /> {nameError}
                        </div>
                      )}

                      <button
                        onClick={handleSaveName}
                        disabled={savingName || !displayName.trim()}
                        className="btn-primary text-sm py-2.5 px-6 flex items-center gap-2 disabled:opacity-50"
                      >
                        {savingName ? (
                          <>
                            <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                            {t('settings.savingVerb')}
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" /> {t('settings.saveName')}
                          </>
                        )}
                      </button>
                    </div>
                  </GlassCard>
                </>
              )}

              {/* ═══ SECURITY ══════════════════════════════════ */}
              {activeSection === 'security' && provider !== 'google' && (
                <GlassCard className="p-6">
                  <SectionBadge color="#f59e0b" label={t('settings.security') as string} />
                  <h3 className="text-lg font-bold mb-1">{t('settings.passwordTitle')}</h3>
                  <p className="text-slate-500 text-sm mb-6">{t('settings.passwordDesc')}</p>

                  <div className="space-y-4 max-w-md">
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-2">{t('settings.newPassword')}</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          className="input-nexus pr-10"
                          placeholder={t('settings.passwordNewPlaceholder') as string}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-950 transition"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-2">{t('settings.confirmPassword')}</label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className="input-nexus"
                        placeholder={t('settings.passwordConfirmPlaceholder') as string}
                      />
                    </div>

                    {passwordSuccess && (
                      <div className="flex items-center gap-2 p-3 rounded-xl text-sm"
                        style={{ background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.15)', color: '#059669' }}>
                        <Check className="w-4 h-4" /> {passwordSuccess}
                      </div>
                    )}
                    {passwordError && (
                      <div className="flex items-center gap-2 p-3 rounded-xl text-sm"
                        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444' }}>
                        <AlertTriangle className="w-4 h-4" /> {passwordError}
                      </div>
                    )}

                    <button
                      onClick={handleChangePassword}
                      disabled={savingPassword || !newPassword || !confirmPassword}
                      className="btn-primary text-sm py-2.5 px-6 flex items-center gap-2 disabled:opacity-50"
                    >
                      {savingPassword ? (
                        <>
                          <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                          {t('settings.updatingVerb')}
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-4 h-4" /> {t('settings.updatePassword')}
                        </>
                      )}
                    </button>
                  </div>
                </GlassCard>
              )}

              {/* ═══ ACCOUNTS ══════════════════════════════════ */}
              {activeSection === 'accounts' && (
                <>
                  <GlassCard className="p-6">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <SectionBadge color="#10b981" label={t('settings.sectionAccounts') as string} />
                        <h3 className="text-lg font-bold">{t('settings.socialPlatformsTitle')}</h3>
                      </div>
                      <span
                        className="text-[10px] px-2 py-1 rounded-full font-semibold uppercase tracking-wider"
                        style={{
                          background: '#fef3c7',
                          color: '#d97706',
                          border: '1px solid rgba(217,119,6,0.15)',
                        }}
                      >
                        {t('common.beta')}
                      </span>
                    </div>
                    <p className="text-slate-500 text-sm mb-6">{t('settings.socialPlatformsDesc')}</p>

                    {socialMessage && (
                      <div className={`rounded-xl p-3 text-sm mb-4 ${
                        socialMessage.startsWith('✓')
                          ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                          : 'bg-red-50 border border-red-200 text-red-700'
                      }`}>
                        {socialMessage}
                      </div>
                    )}

                    {/* Meta */}
                    <div
                      className="flex items-center justify-between p-4 mb-3"
                      style={{
                        background: '#fff',
                        border: '1px solid rgba(15,23,42,0.08)',
                        borderRadius: '12px',
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                          style={{ background: 'rgba(24,119,242,0.12)', border: '1px solid rgba(24,119,242,0.2)' }}
                        >
                          📘
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-slate-950">Meta (Facebook + Instagram)</div>
                          {metaAccount ? (
                            <div className="text-xs text-slate-500 mt-0.5">
                              {t('settings.connectedAs')} <span className="text-slate-700 font-medium">{metaAccount.accountName}</span>
                              {' · '}{metaAccount.pages.length} {t('settings.pagesLabel')}
                            </div>
                          ) : (
                            <div className="text-xs text-slate-500 mt-0.5">{t('settings.notConnected')}</div>
                          )}
                        </div>
                      </div>
                      {metaAccount ? (
                        <button
                          onClick={() => handleDisconnect(metaAccount.id)}
                          disabled={disconnecting === metaAccount.id}
                          className="px-4 py-2 text-sm font-semibold rounded-xl transition text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20"
                        >
                          {disconnecting === metaAccount.id ? (
                            <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                          ) : t('settings.disconnect')}
                        </button>
                      ) : (
                        <button
                          onClick={handleConnectMeta}
                          disabled={socialConnecting || !process.env.NEXT_PUBLIC_META_APP_ID}
                          className="px-4 py-2 text-sm font-bold rounded-xl btn-primary disabled:opacity-50"
                        >
                          {socialConnecting ? (
                            <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                          ) : (
                            <span className="flex items-center gap-1">
                              <ExternalLink className="w-3.5 h-3.5" /> {t('settings.connect')}
                            </span>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Pages list */}
                    {metaAccount?.pages.length ? (
                      <div className="mb-4">
                        <div className="text-[11px] text-slate-400 mb-2 px-1 font-semibold uppercase tracking-wider">{t('settings.connectedPages')}</div>
                        <div className="space-y-2">
                          {metaAccount.pages.map(page => (
                            <div
                              key={page.id}
                              className="flex items-center gap-2 px-4 py-3 rounded-xl"
                              style={{
                                background: '#f8fafc',
                                border: '1px solid rgba(15,23,42,0.06)',
                              }}
                            >
                              <span className="text-sm">📄</span>
                              <span className="text-sm text-slate-700">{page.name}</span>
                              {page.igAccountId && (
                                <span
                                  className="text-[10px] px-2 py-0.5 rounded-md mr-auto"
                                  style={{
                                    background: 'rgba(236,72,153,0.08)',
                                    color: '#ec4899',
                                    border: '1px solid rgba(236,72,153,0.15)',
                                  }}
                                >
                                  {t('settings.igLinked')}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/* TikTok — Coming Soon */}
                    <div
                      className="flex items-center justify-between p-4 opacity-40"
                      style={{
                        background: '#f8fafc',
                        border: '1px solid rgba(15,23,42,0.06)',
                        borderRadius: '12px',
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                          style={{ background: '#f1f5f9', border: '1px solid rgba(15,23,42,0.08)' }}
                        >
                          🎵
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-slate-950">TikTok for Business</div>
                          <div className="text-xs text-slate-400 mt-0.5">{t('common.comingSoon')}</div>
                        </div>
                      </div>
                      <span className="text-xs text-slate-400 border border-slate-200 px-3 py-1.5 rounded-lg">{t('common.comingSoon')}</span>
                    </div>
                  </GlassCard>
                </>
              )}

              {/* ═══ BILLING ═══════════════════════════════════ */}
              {activeSection === 'billing' && (
                <GlassCard className="p-6">
                  <SectionBadge color="#6d28d9" label={t('settings.sectionBillingNav') as string} />
                  <h3 className="text-lg font-bold text-slate-950 mb-1">{t('settings.billingCurrentPlan')}</h3>
                  <p className="text-slate-500 text-sm mb-6">{t('settings.billingCurrentPlanDesc')}</p>

                  {/* Plan badge */}
                  <div
                    className="flex items-center justify-between p-5 mb-4"
                    style={{
                      background: '#faf5ff',
                      border: '1px solid rgba(109,40,217,0.15)',
                      borderRadius: '16px',
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ background: '#ede9fe', border: '1px solid rgba(109,40,217,0.2)' }}
                      >
                        <Sparkles className="w-5 h-5 text-violet-700" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-950 capitalize">
                          {billingStatus
                            ? (billingStatus.hasActiveSubscription
                                ? (billingStatus.plan === 'pro' ? (locale === 'ar' ? 'برو' : 'Pro') : locale === 'ar' ? 'بيزنس' : 'Business')
                                : (locale === 'ar' ? 'مجاني' : 'Free'))
                            : (locale === 'ar' ? 'مجاني' : 'Free')}
                        </div>
                        <div className="text-sm text-slate-500">
                          {billingStatus?.hasActiveSubscription
                            ? (locale === 'ar' ? 'اشتراك نشط — أرصدة تتجدد شهرياً' : 'Active subscription — credits renew monthly')
                            : (locale === 'ar' ? 'مجاني — 20 رصيد مرة واحدة' : 'Free — 20 one-time credits')}
                        </div>
                      </div>
                    </div>
                    <span
                      className="text-xs px-3 py-1 rounded-full font-semibold"
                      style={{
                        background: billingStatus?.hasActiveSubscription ? 'rgba(5,150,105,0.08)' : '#ede9fe',
                        color: billingStatus?.hasActiveSubscription ? '#059669' : '#6d28d9',
                        border: billingStatus?.hasActiveSubscription ? '1px solid rgba(5,150,105,0.15)' : '1px solid rgba(109,40,217,0.15)',
                      }}
                    >
                      {billingStatus?.hasActiveSubscription ? t('settings.activeStatus') : (locale === 'ar' ? 'مجاني' : 'Free')}
                    </span>
                  </div>

                  {/* Credits bar */}
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-500 w-28 text-right">
                        {locale === 'ar' ? 'الأرصدة المتبقية' : 'Credits left'}
                      </span>
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: '#e2e8f0' }}>
                        {(() => {
                          const rem = billingStatus?.credits?.remaining ?? 0
                          const max = billingStatus?.credits?.max ?? 20
                          const pct = max > 0 ? Math.min(100, Math.round((rem / max) * 100)) : 0
                          return (
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${pct}%`,
                                background: pct <= 20 ? '#ef4444' : '#5E5CE6',
                              }}
                            />
                          )
                        })()}
                      </div>
                      <span className="text-xs text-slate-600 w-16 text-left">
                        {billingStatus
                          ? `${billingStatus.credits.remaining} / ${billingStatus.credits.max === -1 ? '∞' : billingStatus.credits.max}`
                          : '— / 20'}
                      </span>
                    </div>
                  </div>

                  <Link
                    href="/billing"
                    className="btn-primary text-sm py-2.5 px-6 inline-flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" /> {t('settings.upgradePlan')}
                  </Link>
                </GlassCard>
              )}

              {/* ═══ DANGER ZONE ═══════════════════════════════ */}
              {activeSection === 'referral' && (
                <GlassCard className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#ede9fe', border: '1px solid rgba(109,40,217,0.15)' }}>
                      <Gift className="w-5 h-5 text-violet-700" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-950">Refer & Earn</h3>
                      <p className="text-slate-500 text-sm">Invite friends — you both get 20 free credits</p>
                    </div>
                  </div>
                  <ReferralWidget />
                </GlassCard>
              )}

              {activeSection === 'danger' && (
                <GlassCard className="p-6" accent>
                  <div className="flex items-center gap-3 mb-1">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}
                    >
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-red-600">{t('settings.dangerTitle')}</h3>
                      <p className="text-slate-500 text-sm">{t('settings.dangerDesc')}</p>
                    </div>
                  </div>

                  {/* Reset success/error toast */}
                  {resetMessage && (
                    <div
                      className={`mt-4 p-3 rounded-xl text-sm font-medium flex items-center gap-2 ${
                        resetMessage.type === 'success'
                          ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                          : 'text-red-400 bg-red-500/10 border border-red-500/20'
                      }`}
                    >
                      {resetMessage.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                      {resetMessage.text}
                    </div>
                  )}

                  <div className="mt-6 space-y-4">
                    {/* Sign out all devices */}
                    <div
                      className="flex items-center justify-between p-4"
                      style={{
                        background: '#fff',
                        border: '1px solid rgba(15,23,42,0.08)',
                        borderRadius: '12px',
                      }}
                    >
                      <div>
                        <div className="font-semibold text-sm text-slate-950">{t('settings.signOutAll')}</div>
                        <div className="text-xs text-slate-500 mt-1">{t('settings.signOutAllDesc')}</div>
                      </div>
                      <button
                        onClick={handleSignOut}
                        disabled={signingOut}
                        className="px-4 py-2 text-sm font-semibold rounded-xl transition text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 flex items-center gap-2"
                      >
                        {signingOut ? (
                          <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                        ) : (
                          <LogOut className="w-4 h-4" />
                        )}
                        {signingOut ? t('settings.signingOutVerb') : t('settings.signOut')}
                      </button>
                    </div>

                    {/* Reset workspace */}
                    <div
                      className="p-4"
                      style={{
                        background: '#fff',
                        border: '1px solid rgba(239,68,68,0.15)',
                        borderRadius: '12px',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-sm text-red-600">{t('settings.resetWorkspace')}</div>
                          <div className="text-xs text-slate-500 mt-1 max-w-xs">{t('settings.resetWorkspaceDesc')}</div>
                        </div>
                        <button
                          onClick={() => { setResetConfirmOpen(true); setResetMessage(null) }}
                          className="shrink-0 px-4 py-2 text-sm font-semibold rounded-xl transition text-red-400 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 flex items-center gap-2 ms-4"
                        >
                          <Trash2 className="w-4 h-4" />
                          {t('settings.resetWorkspaceBtn')}
                        </button>
                      </div>

                      {/* Inline confirmation form */}
                      {resetConfirmOpen && (
                        <div
                          className="mt-4 p-4 rounded-xl space-y-3"
                          style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}
                        >
                          <p className="text-sm text-red-600 font-medium">{t('settings.resetWorkspaceConfirmMsg')}</p>
                          <p className="text-xs text-slate-500">{t('settings.resetWorkspaceTypeHint')}</p>
                          <input
                            type="text"
                            value={resetConfirmInput}
                            onChange={e => setResetConfirmInput(e.target.value)}
                            placeholder={t('settings.resetWorkspacePlaceholder') as string}
                            className="w-full px-3 py-2 text-sm rounded-lg bg-transparent text-red-600 placeholder-red-400/40 outline-none"
                            style={{ border: '1px solid rgba(239,68,68,0.3)' }}
                            disabled={resetting}
                          />
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => { setResetConfirmOpen(false); setResetConfirmInput('') }}
                              disabled={resetting}
                              className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-400 hover:text-slate-950 transition"
                            >
                              {t('common.cancel')}
                            </button>
                            <button
                              onClick={handleResetWorkspace}
                              disabled={resetting || resetConfirmInput.trim() !== 'RESET'}
                              className="px-4 py-2 text-xs font-semibold rounded-lg transition flex items-center gap-2 text-white"
                              style={{
                                background: resetConfirmInput.trim() === 'RESET'
                                  ? 'rgba(239,68,68,0.8)'
                                  : 'rgba(239,68,68,0.2)',
                                cursor: resetConfirmInput.trim() === 'RESET' ? 'pointer' : 'not-allowed',
                              }}
                            >
                              {resetting && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                              {resetting ? t('settings.resetWorkspaceResetting') : t('settings.resetWorkspaceConfirmBtn')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </GlassCard>
              )}

            </div>
          </div>
        </div>

      </div>
    </AppShell>
  )
}
