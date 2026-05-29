'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
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
  { id: 'profile',   label: 'الملف الشخصي',    icon: User,    color: '#06b6d4' },
  { id: 'security',  label: 'الأمان',          icon: Shield,  color: '#f59e0b' },
  { id: 'accounts',  label: 'الحسابات المرتبطة', icon: Globe,   color: '#10b981' },
  { id: 'billing',   label: 'الاشتراك',          icon: CreditCard, color: '#8b5cf6' },
  { id: 'danger',    label: 'منطقة الخطر',       icon: AlertTriangle, color: '#ef4444' },
]

export default function SettingsPage() {
  const router = useRouter()
  const { user, isAuthenticated, loading, authHeader } = useAuth()

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
      setSocialMessage(`✓ تم ربط ${platform === 'meta' ? 'Meta (Facebook/Instagram)' : platform} بنجاح!`)
      fetchSocialAccounts()
      setTimeout(() => setSocialMessage(''), 5000)
    } else if (social === 'denied') {
      setSocialMessage('تم إلغاء الربط.')
      setTimeout(() => setSocialMessage(''), 3000)
    } else if (social === 'error') {
      const msg = params.get('msg') || 'خطأ غير معروف'
      setSocialMessage(`فشل الربط: ${msg}`)
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
      else setSocialMessage(data.error || 'فشل بدء الربط')
    } catch {
      setSocialMessage('فشل الاتصال. تحقق من إعدادات Meta App.')
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
      setSocialMessage('فشل قطع الاتصال.')
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
      setNameSuccess('تم تحديث الاسم بنجاح')
      setTimeout(() => setNameSuccess(''), 3000)
    } catch (err: any) {
      setNameError(err.message || 'فشل تحديث الاسم')
    } finally {
      setSavingName(false)
    }
  }

  const handleChangePassword = async () => {
    setPasswordError('')
    setPasswordSuccess('')
    if (newPassword.length < 8)      { setPasswordError('يجب أن تكون كلمة المرور ٨ أحرف على الأقل'); return }
    if (newPassword !== confirmPassword) { setPasswordError('كلمتا المرور غير متطابقتين'); return }
    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setPasswordSuccess('تم تغيير كلمة المرور بنجاح')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordSuccess(''), 3000)
    } catch (err: any) {
      setPasswordError(err.message || 'فشل تغيير كلمة المرور')
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
    ? new Date(user.created_at).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—'

  const metaAccount = socialAccounts.find(a => a.platform === 'META')

  // ── Floating nebula orbs (same as dashboard) ─────────────────
  function NebulaOrbs() {
    return (
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div
          className="absolute w-[500px] h-[500px] rounded-full opacity-10 blur-[100px]"
          style={{
            background: 'radial-gradient(circle, rgba(245,158,11,0.12), transparent 70%)',
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
          background: accent ? 'rgba(245,158,11,0.03)' : 'rgba(255,255,255,0.02)',
          border: accent ? '1px solid rgba(245,158,11,0.12)' : '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px',
          boxShadow: accent
            ? '0 8px 32px rgba(245,158,11,0.04), inset 0 1px 0 rgba(255,255,255,0.04)'
            : '0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.04)',
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
      <div className="min-h-screen relative" style={{ background: '#020204' }} dir="rtl">
        {/* Background atmosphere */}
        <NebulaOrbs />
        <div
          className="fixed w-[800px] h-[800px] rounded-full pointer-events-none opacity-6 blur-[150px]"
          style={{
            background: 'radial-gradient(circle, rgba(245,158,11,0.10), transparent 70%)',
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
            <h1 className="text-display mb-2">الإعدادات</h1>
            <p className="text-text-secondary text-sm">إدارة ملفك الشخصي، الأمان، والحسابات المرتبطة</p>
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
                      background: isActive ? 'rgba(255,255,255,0.04)' : 'transparent',
                      border: isActive ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
                    }}
                  >
                    <Icon className="w-4 h-4" style={{ color: isActive ? section.color : undefined }} />
                    <span className="flex-1 text-right">{section.label}</span>
                    {isActive && <ChevronLeft className="w-4 h-4 text-amber" />}
                  </button>
                )
              })}

              <div className="pt-4 mt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <Link
                  href="/dashboard"
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-text-muted hover:text-white hover:bg-white/3 transition-all"
                >
                  <Monitor className="w-4 h-4" />
                  <span className="flex-1 text-right">العودة للوحة التحكم</span>
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
                          background: 'rgba(245,158,11,0.08)',
                          border: '1px solid rgba(245,158,11,0.15)',
                        }}
                      >
                        {(displayName || email).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <h2 className="text-headline mb-1">{displayName || 'مستخدم'}</h2>
                        <p className="text-text-muted text-sm">{email}</p>
                        <div className="flex gap-2 mt-3">
                          <span
                            className="text-[11px] px-3 py-1 rounded-full font-semibold"
                            style={{
                              background: 'rgba(245,158,11,0.08)',
                              color: '#f59e0b',
                              border: '1px solid rgba(245,158,11,0.15)',
                            }}
                          >
                            {provider === 'google' ? '🔵 Google' : '📧 بريد إلكتروني'}
                          </span>
                          <span
                            className="text-[11px] px-3 py-1 rounded-full font-semibold"
                            style={{
                              background: 'rgba(16,185,129,0.08)',
                              color: '#10b981',
                              border: '1px solid rgba(16,185,129,0.15)',
                            }}
                          >
                            الخطة المجانية
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-6 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      <div>
                        <p className="text-xs text-text-muted mb-1">عضو منذ</p>
                        <p className="text-sm font-semibold text-text-primary">{createdAt}</p>
                      </div>
                      <div>
                        <p className="text-xs text-text-muted mb-1">معرّف المستخدم</p>
                        <p className="text-xs font-mono text-text-muted truncate">{user?.id}</p>
                      </div>
                    </div>
                  </GlassCard>

                  {/* Edit Name */}
                  <GlassCard className="p-6">
                    <SectionBadge color="#06b6d4" label="الملف الشخصي" />
                    <h3 className="text-lg font-bold mb-1">الاسم المعروض</h3>
                    <p className="text-text-muted text-sm mb-6">هذا الاسم سيظهر في لوحة التحكم والتقارير.</p>

                    <div className="space-y-4 max-w-md">
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">الاسم</label>
                        <input
                          type="text"
                          value={displayName}
                          onChange={e => setDisplayName(e.target.value)}
                          className="input-nexus"
                          placeholder="اسمك الكامل"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">البريد الإلكتروني</label>
                        <input
                          type="email"
                          value={email}
                          disabled
                          className="input-nexus opacity-50 cursor-not-allowed"
                        />
                        <p className="text-xs text-text-muted mt-1">لا يمكن تغيير البريد الإلكتروني من هنا.</p>
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
                            جاري الحفظ...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" /> حفظ الاسم
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
                  <SectionBadge color="#f59e0b" label="الأمان" />
                  <h3 className="text-lg font-bold mb-1">تغيير كلمة المرور</h3>
                  <p className="text-text-muted text-sm mb-6">اختر كلمة مرور قوية من ٨ أحرف على الأقل.</p>

                  <div className="space-y-4 max-w-md">
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">كلمة المرور الجديدة</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          className="input-nexus pr-10"
                          placeholder="٨ أحرف على الأقل"
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
                      <label className="block text-sm font-medium text-text-secondary mb-2">تأكيد كلمة المرور</label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className="input-nexus"
                        placeholder="أعد إدخال كلمة المرور"
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
                          جاري التحديث...
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-4 h-4" /> تحديث كلمة المرور
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
                        <SectionBadge color="#10b981" label="الحسابات المرتبطة" />
                        <h3 className="text-lg font-bold">المنصات الاجتماعية</h3>
                      </div>
                      <span
                        className="text-[10px] px-2 py-1 rounded-full font-semibold uppercase tracking-wider"
                        style={{
                          background: 'rgba(245,158,11,0.08)',
                          color: '#f59e0b',
                          border: '1px solid rgba(245,158,11,0.15)',
                        }}
                      >
                        بيتا
                      </span>
                    </div>
                    <p className="text-text-muted text-sm mb-6">اربط حساباتك الاجتماعية لنشر الحملات مباشرة من NEXUS.</p>

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
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.06)',
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
                              متصل كـ <span className="text-text-secondary font-medium">{metaAccount.accountName}</span>
                              {' · '}{metaAccount.pages.length} صفحة
                            </div>
                          ) : (
                            <div className="text-xs text-text-muted mt-0.5">غير متصل</div>
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
                          ) : 'قطع الاتصال'}
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
                              <ExternalLink className="w-3.5 h-3.5" /> ربط
                            </span>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Pages list */}
                    {metaAccount?.pages.length ? (
                      <div className="mb-4">
                        <div className="text-[11px] text-text-muted mb-2 px-1 font-semibold uppercase tracking-wider">الصفحات المرتبطة</div>
                        <div className="space-y-2">
                          {metaAccount.pages.map(page => (
                            <div
                              key={page.id}
                              className="flex items-center gap-2 px-4 py-3 rounded-xl"
                              style={{
                                background: 'rgba(255,255,255,0.01)',
                                border: '1px solid rgba(255,255,255,0.04)',
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
                                  IG مرتبط
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
                        background: 'rgba(255,255,255,0.01)',
                        border: '1px solid rgba(255,255,255,0.04)',
                        borderRadius: '12px',
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                        >
                          🎵
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-text-primary">TikTok for Business</div>
                          <div className="text-xs text-text-muted mt-0.5">قريباً</div>
                        </div>
                      </div>
                      <span className="text-xs text-text-muted border border-white/5 px-3 py-1.5 rounded-lg">قريباً</span>
                    </div>
                  </GlassCard>
                </>
              )}

              {/* ═══ BILLING ═══════════════════════════════════ */}
              {activeSection === 'billing' && (
                <GlassCard className="p-6">
                  <SectionBadge color="#8b5cf6" label="الاشتراك" />
                  <h3 className="text-lg font-bold mb-1">خطتك الحالية</h3>
                  <p className="text-text-muted text-sm mb-6">أنت حالياً على الخطة المجانية. اترقَ لفتح الميزات الكاملة.</p>

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
                        <div className="text-sm text-text-muted">مجاني · ٥ فيديوهات/شهر</div>
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
                      نشط
                    </span>
                  </div>

                  <div className="space-y-3 mb-6">
                    {[
                      { label: 'فيديوهات/شهر', value: '٥ من ٥', pct: 100 },
                      { label: 'حملات إعلانية', value: '٣ من ٣', pct: 100 },
                      { label: 'منصات مرتبطة', value: '١ من ١', pct: 100 },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-sm text-text-muted w-28 text-right">{item.label}</span>
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
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
                    <Sparkles className="w-4 h-4" /> ترقية الخطة
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
                      <h3 className="text-lg font-bold text-red-400">منطقة الخطر</h3>
                      <p className="text-text-muted text-sm">الإجراءات هنا دائمة ولا يمكن التراجع عنها.</p>
                    </div>
                  </div>

                  <div className="mt-6 space-y-4">
                    <div
                      className="flex items-center justify-between p-4"
                      style={{
                        background: 'rgba(255,255,255,0.01)',
                        border: '1px solid rgba(255,255,255,0.04)',
                        borderRadius: '12px',
                      }}
                    >
                      <div>
                        <div className="font-semibold text-sm text-text-primary">تسجيل الخروج من جميع الأجهزة</div>
                        <div className="text-xs text-text-muted mt-1">الخروج من حساب NEXUS في كل مكان.</div>
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
                        تسجيل الخروج
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
