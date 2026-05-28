'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabaseClient'
import AppShell from '@/components/AppShell'

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

export default function SettingsPage() {
  const router = useRouter()
  const { user, isAuthenticated, loading, authHeader } = useAuth()

  const [displayName,   setDisplayName]   = useState('')
  const [savingName,    setSavingName]     = useState(false)
  const [nameSuccess,   setNameSuccess]    = useState('')
  const [nameError,     setNameError]      = useState('')

  const [newPassword,     setNewPassword]     = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword,  setSavingPassword]  = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordError,   setPasswordError]   = useState('')

  // Social accounts
  const [socialAccounts,  setSocialAccounts]  = useState<SocialAccount[]>([])
  const [socialLoading,   setSocialLoading]   = useState(false)
  const [socialConnecting,setSocialConnecting]= useState(false)
  const [socialMessage,   setSocialMessage]   = useState('')
  const [disconnecting,   setDisconnecting]   = useState<string | null>(null)

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
      setNameSuccess('تم تحديث الاسم!')
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
    if (newPassword.length < 8)      { setPasswordError('كلمة المرور يجب أن تكون 8 أحرف على الأقل'); return }
    if (newPassword !== confirmPassword) { setPasswordError('كلمتا المرور غير متطابقتين'); return }
    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setPasswordSuccess('تم تغيير كلمة المرور!')
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
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!isAuthenticated) return null

  const email    = user?.email || ''
  const provider = user?.app_metadata?.provider || 'email'
  const createdAt = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—'

  const metaAccount = socialAccounts.find(a => a.platform === 'META')

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-6 py-12 page-enter" dir="rtl">

        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-1">إعدادات الحساب</h1>
          <p className="text-t2">إدارة ملفك الشخصي وتفضيلات حسابك.</p>
        </div>

        {/* ── Account Overview ─────────────────────────────────────── */}
        <div className="surface-card rounded-card p-6 mb-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center text-2xl font-bold text-accent">
              {(displayName || email).charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-xl font-bold">{displayName || 'مستخدم'}</div>
              <div className="text-t2 text-sm">{email}</div>
              <div className="flex gap-3 mt-2">
                <span className="text-xs bg-s3 px-3 py-1 rounded-full text-t3">
                  {provider === 'google' ? '🔵 Google' : '📧 بريد إلكتروني'}
                </span>
                <span className="text-xs bg-accent/10 border border-accent/30 text-accent px-3 py-1 rounded-full">
                  الخطة المجانية
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <div>
              <div className="text-xs text-t3 mb-1">عضو منذ</div>
              <div className="text-sm font-semibold">{createdAt}</div>
            </div>
            <div>
              <div className="text-xs text-t3 mb-1">معرّف المستخدم</div>
              <div className="text-xs font-mono text-t2 truncate">{user?.id}</div>
            </div>
          </div>
        </div>

        {/* ── Profile / Display Name ────────────────────────────────── */}
        <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-bold mb-1">الملف الشخصي</h2>
          <p className="text-t2 text-sm mb-6">تحديث اسمك المعروض.</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2">الاسم المعروض</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="اسمك"
                className="w-full px-4 py-3 bg-s0 border border-s4 rounded-xl text-t1 placeholder-t4 focus:outline-none focus:border-accent/60 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">البريد الإلكتروني</label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full px-4 py-3 bg-s0/50 border border-s4 rounded-xl text-t3 cursor-not-allowed"
              />
              <p className="text-xs text-t3 mt-1">لا يمكن تغيير البريد الإلكتروني من هنا.</p>
            </div>

            {nameSuccess && (
              <div className="bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg p-3 text-sm">
                ✓ {nameSuccess}
              </div>
            )}
            {nameError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3 text-sm">
                {nameError}
              </div>
            )}

            <button
              onClick={handleSaveName}
              disabled={savingName || !displayName.trim()}
              className="px-6 py-3 bg-accent text-dark font-bold rounded-xl hover:bg-accent-light transition disabled:opacity-50 text-sm"
            >
              {savingName ? 'جاري الحفظ...' : 'حفظ الاسم'}
            </button>
          </div>
        </div>

        {/* ── Change Password ───────────────────────────────────────── */}
        {provider !== 'google' && (
          <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-bold mb-1">تغيير كلمة المرور</h2>
            <p className="text-t2 text-sm mb-6">اختر كلمة مرور قوية من 8 أحرف على الأقل.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">كلمة المرور الجديدة</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="كلمة مرور جديدة (8 أحرف على الأقل)"
                  className="w-full px-4 py-3 bg-s0 border border-s4 rounded-xl text-t1 placeholder-t4 focus:outline-none focus:border-accent/60 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">تأكيد كلمة المرور</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="أعد إدخال كلمة المرور"
                  className="w-full px-4 py-3 bg-s0 border border-s4 rounded-xl text-t1 placeholder-t4 focus:outline-none focus:border-accent/60 transition"
                />
              </div>

              {passwordSuccess && (
                <div className="bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg p-3 text-sm">
                  ✓ {passwordSuccess}
                </div>
              )}
              {passwordError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3 text-sm">
                  {passwordError}
                </div>
              )}

              <button
                onClick={handleChangePassword}
                disabled={savingPassword || !newPassword || !confirmPassword}
                className="px-6 py-3 bg-s3 hover:bg-s4 font-bold rounded-xl transition disabled:opacity-50 text-sm text-t1"
              >
                {savingPassword ? 'جاري التحديث...' : 'تحديث كلمة المرور'}
              </button>
            </div>
          </div>
        )}

        {/* ── Subscription ─────────────────────────────────────────── */}
        <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold mb-1">الاشتراك</h2>
              <p className="text-t2 text-sm">
                أنت حالياً على <span className="text-accent font-semibold">الخطة المجانية</span>.
              </p>
            </div>
            <Link
              href="/billing"
              className="px-5 py-2 bg-accent text-dark font-bold rounded-lg hover:bg-accent-light transition text-sm"
            >
              ترقية الخطة
            </Link>
          </div>
        </div>

        {/* ── Connected Accounts ────────────────────────────────────── */}
        <div className="surface-card rounded-card p-6 mb-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-bold">الحسابات المرتبطة</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 font-semibold uppercase tracking-wider">
              بيتا
            </span>
          </div>
          <p className="text-t2 text-sm mb-6">اربط حساباتك الاجتماعية لنشر الحملات مباشرة من Nexus.</p>

          {socialMessage && (
            <div className={`rounded-lg p-3 text-sm mb-4 ${
              socialMessage.startsWith('✓')
                ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}>
              {socialMessage}
            </div>
          )}

          {/* Meta */}
          <div className="flex items-center justify-between p-4 bg-s0 border border-s4 rounded-xl mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ background: 'rgba(24,119,242,0.12)', border: '1px solid rgba(24,119,242,0.2)' }}>
                📘
              </div>
              <div>
                <div className="font-semibold text-sm">Meta (Facebook + Instagram)</div>
                {metaAccount ? (
                  <div className="text-xs text-t3 mt-0.5">
                    متصل كـ <span className="text-t2 font-medium">{metaAccount.accountName}</span>
                    {' · '}{metaAccount.pages.length} صفحة
                  </div>
                ) : (
                  <div className="text-xs text-t3 mt-0.5">غير متصل</div>
                )}
              </div>
            </div>
            {metaAccount ? (
              <button
                onClick={() => handleDisconnect(metaAccount.id)}
                disabled={disconnecting === metaAccount.id}
                className="px-4 py-2 text-sm font-semibold rounded-lg transition text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30"
              >
                {disconnecting === metaAccount.id ? 'جاري القطع...' : 'قطع الاتصال'}
              </button>
            ) : (
              <button
                onClick={handleConnectMeta}
                disabled={socialConnecting || !process.env.NEXT_PUBLIC_META_APP_ID}
                className="px-4 py-2 text-sm font-bold rounded-lg bg-accent text-dark hover:bg-accent-light transition disabled:opacity-50"
              >
                {socialConnecting ? 'جاري الربط...' : 'ربط'}
              </button>
            )}
          </div>

          {/* Pages list */}
          {metaAccount?.pages.length ? (
            <div className="mt-2 px-1">
              <div className="text-[11px] text-t3 mb-2 px-1 font-semibold uppercase tracking-wider">الصفحات المرتبطة</div>
              <div className="space-y-1">
                {metaAccount.pages.map(page => (
                  <div key={page.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-s1 border border-s3">
                    <span className="text-sm">📄</span>
                    <span className="text-sm text-t2">{page.name}</span>
                    {page.igAccountId && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-pink-500/10 text-pink-400 border border-pink-500/20 rounded-md mr-auto">
                        IG مرتبط
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* TikTok — Coming Soon */}
          <div className="flex items-center justify-between p-4 bg-s0 border border-s4 rounded-xl opacity-50 mt-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                🎵
              </div>
              <div>
                <div className="font-semibold text-sm">TikTok for Business</div>
                <div className="text-xs text-t3 mt-0.5">قريباً</div>
              </div>
            </div>
            <span className="text-xs text-t3 border border-s4 px-3 py-1.5 rounded-lg">قريباً</span>
          </div>
        </div>

        {/* ── Danger Zone ──────────────────────────────────────────── */}
        <div className="surface-card rounded-card p-6" style={{ borderColor: 'rgba(239,68,68,0.18)' }}>
          <h2 className="text-lg font-bold mb-1 text-red-400">منطقة الخطر</h2>
          <p className="text-t2 text-sm mb-6">الإجراءات هنا دائمة ولا يمكن التراجع عنها.</p>

          <div className="flex items-center justify-between p-4 bg-s0 border border-s4 rounded-xl">
            <div>
              <div className="font-semibold text-sm">تسجيل الخروج من جميع الأجهزة</div>
              <div className="text-xs text-t3 mt-1">الخروج من حساب Nexus في كل مكان.</div>
            </div>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 bg-s3 hover:bg-red-500/15 border border-s4 hover:border-red-500/40 text-sm font-semibold rounded-lg transition text-t1"
            >
              تسجيل الخروج
            </button>
          </div>
        </div>

      </div>
    </AppShell>
  )
}
