'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { supabase } from '@/lib/supabaseClient'
import AppShell from '@/components/AppShell'
import {
  Settings, Shield, Bell, Globe, Palette, KeyRound,
  LogOut, ChevronLeft, Check, AlertTriangle, User,
  CreditCard, Lock, ExternalLink, Eye, EyeOff, Save,
  Sparkles, Monitor, Moon, Sun, Trash2, ChevronRight
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

const SECTIONS = [
  { id: 'profile',   label: 'الملف الشخصي',     labelEn: 'Profile',            icon: User,          color: '#06b6d4' },
  { id: 'security',  label: 'الأمان',            labelEn: 'Security',           icon: Shield,        color: '#f59e0b' },
  { id: 'accounts',  label: 'الحسابات المرتبطة', labelEn: 'Connected Accounts', icon: Globe,         color: '#10b981' },
  { id: 'billing',   label: 'الاشتراك',           labelEn: 'Billing',            icon: CreditCard,    color: '#8b5cf6' },
  { id: 'danger',    label: 'منطقة الخطر',        labelEn: 'Danger Zone',        icon: AlertTriangle, color: '#ef4444' },
]

export default function SettingsPage() {
  const router = useRouter()
  const { user, isAuthenticated, loading, authHeader } = useAuth()
  const { locale, dir } = useI18n()

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
      setSocialMessage(locale === 'ar'
        ? `✓ تم ربط ${platform === 'meta' ? 'Meta (Facebook/Instagram)' : platform} بنجاح!`
        : `✓ Successfully connected ${platform === 'meta' ? 'Meta (Facebook/Instagram)' : platform}!`)
      fetchSocialAccounts()
      setTimeout(() => setSocialMessage(''), 5000)
    } else if (social === 'denied') {
      setSocialMessage(locale === 'ar' ? 'تم إلغاء الربط.' : 'Connection cancelled.')
      setTimeout(() => setSocialMessage(''), 3000)
    } else if (social === 'error') {
      const msg = params.get('msg') || (locale === 'ar' ? 'خطأ غير معروف' : 'Unknown error')
      setSocialMessage(locale === 'ar' ? `فشل الربط: ${msg}` : `Connection failed: ${msg}`)
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

  const handleConnectMeta = async () => {
    const token = authHeader()
    if (!token) return
    setSocialConnecting(true)
    try {
      const res  = await fetch('/api/social/connect/meta', { headers: { Authorization: token } })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else setSocialMessage(data.error || (locale === 'ar' ? 'فشل بدء الربط' : 'Failed to start connection'))
    } catch {
      setSocialMessage(locale === 'ar' ? 'فشل الاتصال. تحقق من إعدادات Meta App.' : 'Connection failed. Check your Meta App settings.')
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
      setSocialMessage(locale === 'ar' ? 'فشل قطع الاتصال.' : 'Failed to disconnect.')
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
      setNameSuccess(locale === 'ar' ? 'تم تحديث الاسم بنجاح' : 'Name updated successfully')
      setTimeout(() => setNameSuccess(''), 3000)
    } catch (err: any) {
      setNameError(err.message || (locale === 'ar' ? 'فشل تحديث الاسم' : 'Failed to update name'))
    } finally {
      setSavingName(false)
    }
  }

  const handleChangePassword = async () => {
    setPasswordError('')
    setPasswordSuccess('')
    if (newPassword.length < 8)      { setPasswordError(locale === 'ar' ? 'يجب أن تكون كلمة المرور ٨ أحرف على الأقل' : 'Password must be at least 8 characters'); return }
    if (newPassword !== confirmPassword) { setPasswordError(locale === 'ar' ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match'); return }
    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setPasswordSuccess(locale === 'ar' ? 'تم تغيير كلمة المرور بنجاح' : 'Password changed successfully')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordSuccess(''), 3000)
    } catch (err: any) {
      setPasswordError(err.message || (locale === 'ar' ? 'فشل تغيير كلمة المرور' : 'Failed to change password'))
    } finally {
      setSavingPassword(false)
    }
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020204] flex items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-2 border-amber/20 border-t-amber animate-spin" />
          <Sparkles className="w-6 h-6 text-amber absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
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

  // ── Floating nebula orbs (same as dashboard) ─────────────────
  function NebulaOrbs() {
    return (
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div
          className="absolute w-[500px] h-[500px] rounded-full opacity-10 blur-[100px]"
          style={{
            background: 'radial-gradient(circle, rgba(108,99,255,0.12), transparent 70%)',
            top: '5%',
            right: '10%',
            animation: 'float 10s ease-in-out infinite',
          }}
        />
        <div
          className="absolute w-[350px] h-[350px] rounded-full opacity-8 blur-[80px]"
          style={{
            background: 'radial-gradient(circle, rgba(6,182,212,0.10), transparent 70%)',
            bottom: '15%',
            left: '5%',
            animation: 'float 12s ease-in-out infinite reverse',
          }}
        />
      </div>
    )
  }

  // ── Glass Card Component ─────────────────────────────────────
  function GlassCard({ children, className = '', accent = false, style = {} }: { children: React.ReactNode; className?: string; accent?: boolean; style?: React.CSSProperties }) {
    return (
      <div
        className={`page-enter ${className}`}
        style={{
          background: accent ? 'rgba(108,99,255,0.05)' : 'rgba(17,21,54,0.5)',
          border: accent ? '1px solid rgba(108,99,255,0.2)' : '1px solid rgba(108,99,255,0.1)',
          borderRadius: '16px',
          boxShadow: accent
            ? '0 8px 32px rgba(108,99,255,0.08), inset 0 1px 0 rgba(108,99,255,0.08)'
            : '0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(108,99,255,0.04)',
          ...style,
        }}
      >
        {children}
      </div>
    )
  }

  // ── Section Badge ────────────────────────────────────────────
  function SectionBadge({ color, label }: { color: string; label: string }) {
    return (
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
        <span className="text-label" style={{ color, letterSpacing: '0.08em' }}>{label}</span>
      </div>
    )
  }

  return (
    <AppShell>
      <div className="min-h-screen relative" style={{ background: '#0A0E27' }} dir={dir}>
        {/* Background atmosphere */}
        <NebulaOrbs />
        <div
          className="fixed w-[800px] h-[800px] rounded-full pointer-events-none opacity-6 blur-[150px]"
          style={{
            background: 'radial-gradient(circle, rgba(108,99,255,0.10), transparent 70%)',
            top: '30%',
            left: '-10%',
            animation: 'float 14s ease-in-out infinite',
          }}
        />

        <div className="relative z-10 max-w-5xl mx-auto px-6 py-10 page-enter">
          {/* ── Header ───────────────────────────────────────── */}
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-2">
              <Settings className="w-4 h-4 text-amber" />
              <span className="text-xs text-amber/70 font-mono tracking-wider">NEXUS COMMAND CENTER</span>
            </div>
            <h1 className="text-display mb-2">{locale === 'ar' ? 'الإعدادات' : 'Settings'}</h1>
            <p className="text-text-secondary text-sm">{locale === 'ar' ? 'إدارة ملفك الشخصي، الأمان، والحسابات المرتبطة' : 'Manage your profile, security, and connected accounts'}</p>
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
                        ? 'text-white'
                        : 'text-text-muted hover:text-white hover:bg-white/3'
                    }`}
                    style={{
                      background: isActive ? 'rgba(108,99,255,0.12)' : 'transparent',
                      border: isActive ? '1px solid rgba(108,99,255,0.2)' : '1px solid transparent',
                    }}
                  >
                    <Icon className="w-4 h-4" style={{ color: isActive ? section.color : undefined }} />
                    <span className={`flex-1 ${locale === 'ar' ? 'text-right' : 'text-left'}`}>{locale === 'ar' ? section.label : section.labelEn}</span>
                    {isActive && <ChevronLeft className="w-4 h-4 text-amber" />}
                  </button>
                )
              })}

              <div className="pt-4 mt-4" style={{ borderTop: '1px solid rgba(108,99,255,0.1)' }}>
                <Link
                  href="/dashboard"
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-text-muted hover:text-white hover:bg-white/3 transition-all"
                >
                  <Monitor className="w-4 h-4" />
                  <span className={`flex-1 ${locale === 'ar' ? 'text-right' : 'text-left'}`}>{locale === 'ar' ? 'العودة للوحة التحكم' : 'Back to Dashboard'}</span>
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
                        className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold text-amber"
                        style={{
                          background: 'rgba(108,99,255,0.08)',
                          border: '1px solid rgba(245,158,11,0.15)',
                        }}
                      >
                        {(displayName || email).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <h2 className="text-headline mb-1">{displayName || (locale === 'ar' ? 'مستخدم' : 'User')}</h2>
                        <p className="text-text-muted text-sm">{email}</p>
                        <div className="flex gap-2 mt-3">
                          <span
                            className="text-[11px] px-3 py-1 rounded-full font-semibold"
                            style={{
                              background: 'rgba(108,99,255,0.08)',
                              color: '#f59e0b',
                              border: '1px solid rgba(245,158,11,0.15)',
                            }}
                          >
                            {provider === 'google' ? '🔵 Google' : (locale === 'ar' ? '📧 بريد إلكتروني' : '📧 Email')}
                          </span>
                          <span
                            className="text-[11px] px-3 py-1 rounded-full font-semibold"
                            style={{
                              background: 'rgba(16,185,129,0.08)',
                              color: '#10b981',
                              border: '1px solid rgba(16,185,129,0.15)',
                            }}
                          >
                            {locale === 'ar' ? 'الخطة المجانية' : 'Free Plan'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-6 pt-6" style={{ borderTop: '1px solid rgba(108,99,255,0.08)' }}>
                      <div>
                        <p className="text-xs text-text-muted mb-1">{locale === 'ar' ? 'عضو منذ' : 'Member since'}</p>
                        <p className="text-sm font-semibold text-text-primary">{createdAt}</p>
                      </div>
                      <div>
                        <p className="text-xs text-text-muted mb-1">{locale === 'ar' ? 'معرّف المستخدم' : 'User ID'}</p>
                        <p className="text-xs font-mono text-text-muted truncate">{user?.id}</p>
                      </div>
                    </div>
                  </GlassCard>

                  {/* Edit Name */}
                  <GlassCard className="p-6">
                    <SectionBadge color="#06b6d4" label={locale === 'ar' ? 'الملف الشخصي' : 'Profile'} />
                    <h3 className="text-lg font-bold mb-1">{locale === 'ar' ? 'الاسم المعروض' : 'Display Name'}</h3>
                    <p className="text-text-muted text-sm mb-6">{locale === 'ar' ? 'هذا الاسم سيظهر في لوحة التحكم والتقارير.' : 'This name will appear in your dashboard and reports.'}</p>

                    <div className="space-y-4 max-w-md">
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">{locale === 'ar' ? 'الاسم' : 'Name'}</label>
                        <input
                          type="text"
                          value={displayName}
                          onChange={e => setDisplayName(e.target.value)}
                          className="input-nexus"
                          placeholder={locale === 'ar' ? 'اسمك الكامل' : 'Your full name'}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">{locale === 'ar' ? 'البريد الإلكتروني' : 'Email'}</label>
                        <input
                          type="email"
                          value={email}
                          disabled
                          className="input-nexus opacity-50 cursor-not-allowed"
                        />
                        <p className="text-xs text-text-muted mt-1">{locale === 'ar' ? 'لا يمكن تغيير البريد الإلكتروني من هنا.' : 'Email cannot be changed here.'}</p>
                      </div>

                      {nameSuccess && (
                        <div className="flex items-center gap-2 p-3 rounded-xl text-sm"
                          style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)', color: '#10b981' }}>
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
                            {locale === 'ar' ? 'جاري الحفظ...' : 'Saving...'}
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" /> {locale === 'ar' ? 'حفظ الاسم' : 'Save Name'}
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
                  <SectionBadge color="#f59e0b" label={locale === 'ar' ? 'الأمان' : 'Security'} />
                  <h3 className="text-lg font-bold mb-1">{locale === 'ar' ? 'تغيير كلمة المرور' : 'Change Password'}</h3>
                  <p className="text-text-muted text-sm mb-6">{locale === 'ar' ? 'اختر كلمة مرور قوية من ٨ أحرف على الأقل.' : 'Choose a strong password with at least 8 characters.'}</p>

                  <div className="space-y-4 max-w-md">
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">{locale === 'ar' ? 'كلمة المرور الجديدة' : 'New Password'}</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          className="input-nexus pr-10"
                          placeholder={locale === 'ar' ? '٨ أحرف على الأقل' : 'At least 8 characters'}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white transition"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">{locale === 'ar' ? 'تأكيد كلمة المرور' : 'Confirm Password'}</label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className="input-nexus"
                        placeholder={locale === 'ar' ? 'أعد إدخال كلمة المرور' : 'Re-enter your password'}
                      />
                    </div>

                    {passwordSuccess && (
                      <div className="flex items-center gap-2 p-3 rounded-xl text-sm"
                        style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)', color: '#10b981' }}>
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
                          {locale === 'ar' ? 'جاري التحديث...' : 'Updating...'}
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-4 h-4" /> {locale === 'ar' ? 'تحديث كلمة المرور' : 'Update Password'}
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
                        <SectionBadge color="#10b981" label={locale === 'ar' ? 'الحسابات المرتبطة' : 'Connected Accounts'} />
                        <h3 className="text-lg font-bold">{locale === 'ar' ? 'المنصات الاجتماعية' : 'Social Platforms'}</h3>
                      </div>
                      <span
                        className="text-[10px] px-2 py-1 rounded-full font-semibold uppercase tracking-wider"
                        style={{
                          background: 'rgba(108,99,255,0.08)',
                          color: '#f59e0b',
                          border: '1px solid rgba(245,158,11,0.15)',
                        }}
                      >
                        {locale === 'ar' ? 'بيتا' : 'Beta'}
                      </span>
                    </div>
                    <p className="text-text-muted text-sm mb-6">{locale === 'ar' ? 'اربط حساباتك الاجتماعية لنشر الحملات مباشرة من NEXUS.' : 'Connect your social accounts to publish campaigns directly from NEXUS.'}</p>

                    {socialMessage && (
                      <div className={`rounded-xl p-3 text-sm mb-4 ${
                        socialMessage.startsWith('✓')
                          ? 'bg-emerald-500/8 border border-emerald-500/15 text-emerald-400'
                          : 'bg-red-500/8 border border-red-500/15 text-red-400'
                      }`}>
                        {socialMessage}
                      </div>
                    )}

                    {/* Meta */}
                    <div
                      className="flex items-center justify-between p-4 mb-3"
                      style={{
                        background: 'rgba(17,21,54,0.5)',
                        border: '1px solid rgba(108,99,255,0.1)',
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
                          <div className="font-semibold text-sm text-text-primary">Meta (Facebook + Instagram)</div>
                          {metaAccount ? (
                            <div className="text-xs text-text-muted mt-0.5">
                              {locale === 'ar' ? 'متصل كـ' : 'Connected as'} <span className="text-text-secondary font-medium">{metaAccount.accountName}</span>
                              {' · '}{metaAccount.pages.length} {locale === 'ar' ? 'صفحة' : 'page(s)'}
                            </div>
                          ) : (
                            <div className="text-xs text-text-muted mt-0.5">{locale === 'ar' ? 'غير متصل' : 'Not connected'}</div>
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
                          ) : (locale === 'ar' ? 'قطع الاتصال' : 'Disconnect')}
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
                              <ExternalLink className="w-3.5 h-3.5" /> {locale === 'ar' ? 'ربط' : 'Connect'}
                            </span>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Pages list */}
                    {metaAccount?.pages.length ? (
                      <div className="mb-4">
                        <div className="text-[11px] text-text-muted mb-2 px-1 font-semibold uppercase tracking-wider">{locale === 'ar' ? 'الصفحات المرتبطة' : 'Connected Pages'}</div>
                        <div className="space-y-2">
                          {metaAccount.pages.map(page => (
                            <div
                              key={page.id}
                              className="flex items-center gap-2 px-4 py-3 rounded-xl"
                              style={{
                                background: 'rgba(17,21,54,0.4)',
                                border: '1px solid rgba(108,99,255,0.08)',
                              }}
                            >
                              <span className="text-sm">📄</span>
                              <span className="text-sm text-text-secondary">{page.name}</span>
                              {page.igAccountId && (
                                <span
                                  className="text-[10px] px-2 py-0.5 rounded-md mr-auto"
                                  style={{
                                    background: 'rgba(236,72,153,0.08)',
                                    color: '#ec4899',
                                    border: '1px solid rgba(236,72,153,0.15)',
                                  }}
                                >
                                  {locale === 'ar' ? 'IG مرتبط' : 'IG linked'}
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
                        background: 'rgba(17,21,54,0.4)',
                        border: '1px solid rgba(108,99,255,0.08)',
                        borderRadius: '12px',
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                          style={{ background: 'rgba(17,21,54,0.5)', border: '1px solid rgba(108,99,255,0.1)' }}
                        >
                          🎵
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-text-primary">TikTok for Business</div>
                          <div className="text-xs text-text-muted mt-0.5">{locale === 'ar' ? 'قريباً' : 'Coming soon'}</div>
                        </div>
                      </div>
                      <span className="text-xs text-text-muted border border-white/5 px-3 py-1.5 rounded-lg">{locale === 'ar' ? 'قريباً' : 'Coming soon'}</span>
                    </div>
                  </GlassCard>
                </>
              )}

              {/* ═══ BILLING ═══════════════════════════════════ */}
              {activeSection === 'billing' && (
                <GlassCard className="p-6">
                  <SectionBadge color="#8b5cf6" label={locale === 'ar' ? 'الاشتراك' : 'Billing'} />
                  <h3 className="text-lg font-bold mb-1">{locale === 'ar' ? 'خطتك الحالية' : 'Your Current Plan'}</h3>
                  <p className="text-text-muted text-sm mb-6">{locale === 'ar' ? 'أنت حالياً على الخطة المجانية. اترقَ لفتح الميزات الكاملة.' : "You're currently on the Free plan. Upgrade to unlock all features."}</p>

                  <div
                    className="flex items-center justify-between p-5 mb-4"
                    style={{
                      background: 'rgba(139,92,246,0.04)',
                      border: '1px solid rgba(139,92,246,0.12)',
                      borderRadius: '16px',
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.2)' }}
                      >
                        <Sparkles className="w-5 h-5 text-violet-400" />
                      </div>
                      <div>
                        <div className="font-bold text-text-primary">Starter</div>
                        <div className="text-sm text-text-muted">{locale === 'ar' ? 'مجاني · ٥ فيديوهات/شهر' : 'Free · 5 videos/month'}</div>
                      </div>
                    </div>
                    <span
                      className="text-xs px-3 py-1 rounded-full font-semibold"
                      style={{
                        background: 'rgba(16,185,129,0.08)',
                        color: '#10b981',
                        border: '1px solid rgba(16,185,129,0.15)',
                      }}
                    >
                      {locale === 'ar' ? 'نشط' : 'Active'}
                    </span>
                  </div>

                  <div className="space-y-3 mb-6">
                    {(locale === 'ar' ? [
                      { label: 'فيديوهات/شهر', value: '٥ من ٥', pct: 100 },
                      { label: 'حملات إعلانية', value: '٣ من ٣', pct: 100 },
                      { label: 'منصات مرتبطة', value: '١ من ١', pct: 100 },
                    ] : [
                      { label: 'Videos/month', value: '5 of 5', pct: 100 },
                      { label: 'Ad campaigns', value: '3 of 3', pct: 100 },
                      { label: 'Connected platforms', value: '1 of 1', pct: 100 },
                    ]).map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-sm text-text-muted w-28 text-right">{item.label}</span>
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(17,21,54,0.5)' }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${item.pct}%`,
                              background: item.pct >= 80
                                ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                                : 'linear-gradient(90deg, #06b6d4, #0891b2)',
                            }}
                          />
                        </div>
                        <span className="text-xs text-text-secondary w-16 text-left">{item.value}</span>
                      </div>
                    ))}
                  </div>

                  <Link
                    href="/billing"
                    className="btn-primary text-sm py-2.5 px-6 inline-flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" /> {locale === 'ar' ? 'ترقية الخطة' : 'Upgrade Plan'}
                  </Link>
                </GlassCard>
              )}

              {/* ═══ DANGER ZONE ═══════════════════════════════ */}
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
                      <h3 className="text-lg font-bold text-red-400">{locale === 'ar' ? 'منطقة الخطر' : 'Danger Zone'}</h3>
                      <p className="text-text-muted text-sm">{locale === 'ar' ? 'الإجراءات هنا دائمة ولا يمكن التراجع عنها.' : 'Actions here are permanent and cannot be undone.'}</p>
                    </div>
                  </div>

                  <div className="mt-6 space-y-4">
                    <div
                      className="flex items-center justify-between p-4"
                      style={{
                        background: 'rgba(17,21,54,0.4)',
                        border: '1px solid rgba(108,99,255,0.08)',
                        borderRadius: '12px',
                      }}
                    >
                      <div>
                        <div className="font-semibold text-sm text-text-primary">{locale === 'ar' ? 'تسجيل الخروج من جميع الأجهزة' : 'Sign out of all devices'}</div>
                        <div className="text-xs text-text-muted mt-1">{locale === 'ar' ? 'الخروج من حساب NEXUS في كل مكان.' : 'Sign out of your NEXUS account everywhere.'}</div>
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
                        {locale === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}
                      </button>
                    </div>
                  </div>
                </GlassCard>
              )}

            </div>
          </div>
        </div>

        <style jsx>{`
          @keyframes float {
            0%, 100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-20px) scale(1.02); }
          }
        `}</style>
      </div>
    </AppShell>
  )
}
