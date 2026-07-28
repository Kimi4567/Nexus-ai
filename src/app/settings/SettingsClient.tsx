'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import ReferralWidget from '@/components/ReferralWidget'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { supabase } from '@/lib/supabaseClient'
import { formatCreditDisplay, getPlanDisplayName } from '@/lib/creditDisplay'
import {
  AlertTriangle,
  CreditCard,
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  Loader2,
  Lock,
  LogOut,
  Save,
  Shield,
  Trash2,
  User,
  Zap,
} from 'lucide-react'

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

function SettingsCard({
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
    <section className={`nx-os-card min-w-0 overflow-hidden p-5 ${className}`}>
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

function SettingsButton({
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
      className={`inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-[13px] px-4 text-[13px] font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${toneClass} ${className}`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const { user, isAuthenticated, loading, authHeader, logout } = useAuth()
  const { locale, dir } = useI18n()
  const ar = locale === 'ar'
  const copyText = useCallback((arabic: string, english: string) => (ar ? arabic : english), [ar])

  const [displayName, setDisplayName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameMessage, setNameMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([])
  const [socialConnecting, setSocialConnecting] = useState(false)
  const [socialMessage, setSocialMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [disconnectConfirmId, setDisconnectConfirmId] = useState<string | null>(null)

  const [billingStatus, setBillingStatus] = useState<{
    plan: string
    hasActiveSubscription: boolean
    credits: { remaining: number; used: number; max: number }
    creditBreakdown?: {
      monthly: number
      purchased: number
      trial: number
      migrated: number
      referral: number
      refund: number
      manual: number
      other: number
    }
  } | null>(null)

  const [signingOut, setSigningOut] = useState(false)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [resetConfirmInput, setResetConfirmInput] = useState('')
  const [resetting, setResetting] = useState(false)
  const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchSocialAccounts = useCallback(async () => {
    const token = authHeader()
    if (!token) return
    try {
      const res = await fetch('/api/social/accounts', { headers: { Authorization: token } })
      const data = await res.json()
      setSocialAccounts(data.accounts || [])
    } catch {
      setSocialAccounts([])
    }
  }, [authHeader])

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/auth/login')
  }, [isAuthenticated, loading, router])

  useEffect(() => {
    if (user) setDisplayName(user?.user_metadata?.name || user?.email?.split('@')[0] || '')
  }, [user])

  useEffect(() => {
    if (isAuthenticated) fetchSocialAccounts()
  }, [fetchSocialAccounts, isAuthenticated])

  useEffect(() => {
    const token = authHeader()
    if (!token) return
    fetch('/api/billing/status', { headers: { Authorization: token } })
      .then((response) => response.json())
      .then((data) => {
        if (data.plan) setBillingStatus(data)
      })
      .catch(() => {})
  }, [authHeader])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const social = params.get('social')
    const platform = params.get('platform')
    if (social === 'connected') {
      setSocialMessage({
        type: 'success',
        text: copyText(`${platform || 'Meta'} متصل. راجع الصلاحيات قبل التشغيل.`, `${platform || 'Meta'} connected. Review permissions before execution.`),
      })
      fetchSocialAccounts()
      window.history.replaceState({}, '', '/settings')
      setTimeout(() => setSocialMessage(null), 5000)
    } else if (social === 'denied' || social === 'error') {
      const msg = params.get('msg')
      const decodedMsg = msg ? decodeURIComponent(msg) : ''
      const wasCancelled = social === 'denied' || decodedMsg === 'authorization_not_granted'
      setSocialMessage({
        type: wasCancelled ? 'info' : 'error',
        text: wasCancelled
          ? copyText(
              'تم إلغاء الربط. لم يتم ربط أي حساب أو منح أي صلاحية.',
              'Connection cancelled. No account was connected and no permission was granted.',
            )
          : msg
            ? copyText(`تعذر الربط: ${decodedMsg}`, `Connection failed: ${decodedMsg}`)
          : copyText('تم إلغاء الربط أو تعذر إكماله.', 'Connection was cancelled or could not be completed.'),
      })
      window.history.replaceState({}, '', '/settings')
      setTimeout(() => setSocialMessage(null), 9000)
    }
  }, [copyText, fetchSocialAccounts])

  const handleSaveName = async () => {
    if (!displayName.trim()) return
    setSavingName(true)
    setNameMessage(null)
    try {
      const { error } = await supabase.auth.updateUser({ data: { name: displayName } })
      if (error) throw error
      setNameMessage({ type: 'success', text: copyText('تم تحديث الاسم.', 'Name updated.') })
      setTimeout(() => setNameMessage(null), 3000)
    } catch (error: unknown) {
      setNameMessage({ type: 'error', text: error instanceof Error ? error.message : copyText('تعذر تحديث الاسم.', 'Could not update name.') })
    } finally {
      setSavingName(false)
    }
  }

  const handleChangePassword = async () => {
    setPasswordMessage(null)
    if (newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: copyText('كلمة المرور يجب أن تكون 8 أحرف على الأقل.', 'Password must be at least 8 characters.') })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: copyText('كلمتا المرور غير متطابقتين.', 'Passwords do not match.') })
      return
    }
    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setPasswordMessage({ type: 'success', text: copyText('تم تحديث كلمة المرور.', 'Password updated.') })
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordMessage(null), 3000)
    } catch (error: unknown) {
      setPasswordMessage({ type: 'error', text: error instanceof Error ? error.message : copyText('تعذر تحديث كلمة المرور.', 'Could not update password.') })
    } finally {
      setSavingPassword(false)
    }
  }

  const handleConnectMeta = async () => {
    const token = authHeader()
    if (!token) return
    setSocialConnecting(true)
    try {
      const res = await fetch('/api/social/connect/meta', { headers: { Authorization: token } })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else setSocialMessage({ type: 'error', text: data.error || copyText('تعذر بدء ربط Meta.', 'Could not start Meta connection.') })
    } catch {
      setSocialMessage({ type: 'error', text: copyText('حدث خطأ أثناء الربط.', 'Connection error.') })
    } finally {
      setSocialConnecting(false)
    }
  }

  const handleDisconnect = async (integrationId: string) => {
    const token = authHeader()
    if (!token) return
    setDisconnecting(integrationId)
    try {
      const response = await fetch('/api/social/accounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({ integrationId }),
      })
      if (!response.ok) throw new Error('Disconnect failed')
      setSocialAccounts((prev) => prev.filter((account) => account.id !== integrationId))
      setDisconnectConfirmId(null)
      setSocialMessage({
        type: 'success',
        text: copyText('تم فصل الحساب. لن يستخدمه NEXUS في النشر العضوي.', 'Account disconnected. NEXUS will not use it for organic publishing.'),
      })
    } catch {
      setSocialMessage({ type: 'error', text: copyText('تعذر فصل الحساب.', 'Could not disconnect account.') })
    } finally {
      setDisconnecting(null)
    }
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    await logout()
  }

  const handleResetWorkspace = async () => {
    if (resetConfirmInput.trim() !== 'RESET') return
    setResetting(true)
    setResetMessage(null)
    try {
      const res = await fetch('/api/workspace/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
        body: JSON.stringify({ confirmText: 'RESET MY NEXUS WORKSPACE' }),
      })
      const data = await res.json()
      if (!res.ok) {
        const reference = typeof data.reference === 'string' ? ` (${data.reference})` : ''
        const verificationFailed = data.code === 'WORKSPACE_RESET_VERIFICATION_FAILED'
        throw new Error(`${verificationFailed
          ? copyText(
              'تم تنفيذ معاملة إعادة الضبط، لكن فشل التحقق النهائي من البداية الجديدة. أعد المحاولة أو استخدم رقم المرجع للدعم.',
              'The reset transaction ran, but final fresh-start verification failed. Retry or use the reference for support.',
            )
          : copyText(
              'تعذر إكمال إعادة الضبط. تم التراجع عن المعاملة ولم تتغير بيانات مساحة العمل.',
              'Reset could not complete. The transaction was rolled back and workspace data was not changed.',
            )}${reference}`)
      }
      if (data.resetVerified !== true || data.next !== '/onboarding') {
        throw new Error(copyText(
          'اكتملت العملية دون إثبات بداية جديدة. لم يتم تحويلك حتى تتم مراجعة الحالة.',
          'The reset returned without fresh-start verification. You were not redirected.',
        ))
      }
      setResetMessage({ type: 'success', text: copyText('تمت إعادة ضبط مساحة العمل.', 'Workspace reset completed.') })
      Object.keys(localStorage)
        .filter((key) => key === 'nexus_chat_v2' || key.startsWith('nexus_chat_v3:'))
        .forEach((key) => localStorage.removeItem(key))
      window.dispatchEvent(new Event('nexus:workspace-reset'))
      setResetConfirmOpen(false)
      setResetConfirmInput('')
      router.replace('/onboarding')
    } catch (error) {
      setResetMessage({
        type: 'error',
        text: error instanceof Error
          ? error.message
          : copyText('تعذر تنفيذ إعادة الضبط. لم يتم حذف أي بيانات.', 'Could not reset workspace. No data was changed.'),
      })
    } finally {
      setResetting(false)
    }
  }

  const metaAccount = socialAccounts.find((account) => account.platform === 'META')
  const email = user?.email || ''
  const provider = user?.app_metadata?.provider || 'email'
  const planLabel = billingStatus
    ? getPlanDisplayName(billingStatus.hasActiveSubscription ? billingStatus.plan : 'free', locale)
    : copyText('جار التحميل', 'Loading')
  const creditDisplay = formatCreditDisplay({
    availableCredits: billingStatus?.credits?.remaining ?? 0,
    monthlyCredits: billingStatus?.hasActiveSubscription ? billingStatus?.credits?.max ?? 0 : 0,
    locale,
  })
  const nonMonthlyCredits = billingStatus?.creditBreakdown
    ? billingStatus.creditBreakdown.purchased
      + billingStatus.creditBreakdown.trial
      + billingStatus.creditBreakdown.migrated
      + billingStatus.creditBreakdown.referral
      + billingStatus.creditBreakdown.refund
      + billingStatus.creditBreakdown.manual
      + billingStatus.creditBreakdown.other
    : 0
  const settingsCreditLabel = nonMonthlyCredits > 0
    ? copyText(
        `${billingStatus?.credits.remaining ?? 0} كريديت إجمالي متاح`,
        `${billingStatus?.credits.remaining ?? 0} total credits available`,
      )
    : creditDisplay.primary

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-screen items-center justify-center bg-[#f6f8fc]">
          <Loader2 className="h-9 w-9 animate-spin text-[#4f46e5]" />
        </div>
      </AppShell>
    )
  }

  if (!isAuthenticated) return null

  return (
    <AppShell>
      <main dir={dir} className="nx-os-page overflow-x-hidden">
        <div className="nx-os-container">
          <LuxuryWorkspaceHeader
            pageTitle={copyText('الإعدادات', 'Settings')}
            pageSubtitle={copyText('إدارة الحساب والأمان والربط وخطة العمل.', 'Manage your account, security, connections, and plan.')}
            primaryHref="/connections"
            primaryLabel={copyText('إدارة الربط', 'Manage connections')}
            secondaryHref="/billing"
            secondaryLabel={copyText('الفوترة والخطة', 'Billing and plan')}
          />

          <section className="mb-6 grid min-w-0 items-start gap-4 xl:grid-cols-12">
            <SettingsCard title={copyText('الحساب', 'Account')} icon={<User size={18} />} className="xl:col-span-7">
              <div className="flex items-center gap-5">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#eff2ff] to-white p-2">
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-[#071236] text-4xl font-black text-white">
                    {(displayName || email || 'N').charAt(0).toUpperCase()}
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-xl font-black text-[#071236]">{displayName || copyText('مستخدم NEXUS', 'NEXUS user')}</p>
                  <p className="mt-1 truncate text-[13px] text-[#64708f]">{email}</p>
                  <p className="mt-3 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-700">
                    {billingStatus?.hasActiveSubscription ? copyText('نشط', 'Active') : copyText('حساب تجربة', 'Trial account')}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  aria-label={copyText('اسم العرض', 'Display name')}
                  className="h-11 w-full rounded-[14px] border border-[#e3e8f3] bg-[#fbfcff] px-4 text-sm font-semibold outline-none transition focus:border-[#5366f6]"
                  placeholder={copyText('اسم العرض', 'Display name')}
                />
                {nameMessage ? (
                  <p className={`text-[12px] font-bold ${nameMessage.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {nameMessage.text}
                  </p>
                ) : null}
                <SettingsButton onClick={handleSaveName} loading={savingName} disabled={!displayName.trim()} className="w-full">
                  <Save className="h-4 w-4" />
                  {copyText('تعديل الملف الشخصي', 'Update profile')}
                </SettingsButton>
              </div>
            </SettingsCard>

            <SettingsCard title={copyText('الفوترة والخطة', 'Billing and plan')} icon={<CreditCard size={18} />} className="xl:col-span-5">
              <div className="rounded-[18px] border border-[#e8edf7] bg-[#fbfcff] p-4 text-center">
                <p className="inline-flex rounded-full bg-[#fff7db] px-3 py-1 text-[11px] font-black text-[#a66b00]">{copyText('خطة الحساب', 'Account plan')}</p>
                <h3 className="mt-3 text-lg font-black text-[#071236]">{planLabel}</h3>
                <p className="mt-1 text-[12px] text-[#64708f]">
                  {billingStatus?.hasActiveSubscription
                    ? copyText('اشتراك نشط', 'Active subscription')
                    : copyText('أرصدة وتجربة محدودة', 'Credits and limited trial')}
                </p>
                <div className="mt-5 space-y-4 text-start">
                  {[
                    [copyText('الأرصدة', 'Credits'), billingStatus ? settingsCreditLabel : '…', creditDisplay.percent],
                    [copyText('المستخدمون', 'Users'), copyText('1 مستخدم فعلي', '1 actual user'), 100],
                    [copyText('التخزين', 'Storage'), copyText('حسب مكتبة الوسائط', 'Tracked in Media Library'), 0],
                  ].map(([label, value, percent]) => (
                    <div key={label as string}>
                      <div className="mb-1 flex items-center justify-between text-[11px] font-bold text-[#64708f]">
                        <span>{label}</span>
                        <span>{value}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#e8edf7]">
                        <div className="h-full rounded-full bg-[#5366f6]" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <Link href="/billing" className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-[13px] border border-[#d7def0] bg-white text-[13px] font-black text-[#4f46e5]">
                  {copyText('إدارة الخطة', 'Manage plan')}
                </Link>
              </div>
            </SettingsCard>
          </section>

          <ReferralWidget />

          <section className="grid min-w-0 gap-6 xl:grid-cols-3">
            <SettingsCard title={copyText('الأمان', 'Security')} icon={<Shield size={18} />}>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[15px] border border-[#e8edf7] bg-[#fbfcff] px-4 py-3">
                  <span className="min-w-0">
                    <span className="block text-[13px] font-black text-[#111b3f]">{copyText('المصادقة الثنائية (2FA)', 'Two-factor authentication')}</span>
                    <span className="mt-1 block text-[11px] text-[#7b87a3]">{copyText('أضف طبقة أمان إضافية.', 'Add another security layer.')}</span>
                  </span>
                  <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-black text-slate-600">{copyText('يدار عبر مزود الدخول', 'Managed by auth provider')}</span>
                </div>

                {provider !== 'google' ? (
                  <div className="rounded-[15px] border border-[#e8edf7] bg-white p-4">
                    <p className="mb-3 text-[13px] font-black text-[#111b3f]">{copyText('تغيير كلمة المرور', 'Change password')}</p>
                    <div className="space-y-3">
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(event) => setNewPassword(event.target.value)}
                          aria-label={copyText('كلمة مرور جديدة', 'New password')}
                          className="h-10 w-full rounded-[13px] border border-[#e3e8f3] bg-[#fbfcff] px-3 text-sm outline-none focus:border-[#5366f6]"
                          placeholder={copyText('كلمة مرور جديدة', 'New password')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((value) => !value)}
                          aria-label={showPassword ? copyText('إخفاء كلمة المرور', 'Hide password') : copyText('إظهار كلمة المرور', 'Show password')}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a96ad]"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        aria-label={copyText('تأكيد كلمة المرور', 'Confirm password')}
                        className="h-10 w-full rounded-[13px] border border-[#e3e8f3] bg-[#fbfcff] px-3 text-sm outline-none focus:border-[#5366f6]"
                        placeholder={copyText('تأكيد كلمة المرور', 'Confirm password')}
                      />
                      {passwordMessage ? (
                        <p className={`text-[12px] font-bold ${passwordMessage.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {passwordMessage.text}
                        </p>
                      ) : null}
                      <SettingsButton onClick={handleChangePassword} loading={savingPassword} disabled={!newPassword || !confirmPassword}>
                        <KeyRound className="h-4 w-4" />
                        {copyText('تحديث', 'Update')}
                      </SettingsButton>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[15px] border border-[#e8edf7] bg-[#fbfcff] p-4 text-[12px] leading-6 text-[#64708f]">
                    {copyText('كلمة المرور تدار من مزود تسجيل الدخول.', 'Password is managed by your sign-in provider.')}
                  </div>
                )}

                <SettingsButton tone="danger" onClick={handleSignOut} loading={signingOut} className="w-full">
                  <LogOut className="h-4 w-4" />
                  {copyText('تسجيل الخروج', 'Sign out')}
                </SettingsButton>
              </div>
            </SettingsCard>

            <SettingsCard title={copyText('الربط', 'Connections')} icon={<Link2 size={18} />}>
              {socialMessage ? (
                <p className={`mb-3 rounded-[13px] px-3 py-2 text-[12px] font-bold ${
                  socialMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700'
                    : socialMessage.type === 'info'
                      ? 'bg-sky-50 text-sky-700'
                      : 'bg-rose-50 text-rose-700'
                }`}>
                  {socialMessage.text}
                </p>
              ) : null}
              <div className="space-y-3">
                <div className="rounded-[16px] border border-[#e8edf7] bg-[#fbfcff] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-black text-[#111b3f]">{copyText('Meta — النشر العضوي', 'Meta — organic publishing')}</p>
                      <p className="mt-1 text-[11px] text-[#7b87a3]">
                        {metaAccount
                          ? copyText(`متصل كـ ${metaAccount.accountName}`, `Connected as ${metaAccount.accountName}`)
                          : copyText('غير متصل', 'Not connected')}
                      </p>
                    </div>
                    {metaAccount ? (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700">{copyText('متصل', 'Connected')}</span>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-black text-amber-700">{copyText('يحتاج ربط', 'Needs setup')}</span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {metaAccount ? (
                      <SettingsButton tone="danger" onClick={() => setDisconnectConfirmId(metaAccount.id)} loading={disconnecting === metaAccount.id}>
                        <Lock className="h-4 w-4" />
                        {copyText('فصل الحساب', 'Disconnect')}
                      </SettingsButton>
                    ) : (
                      <SettingsButton onClick={handleConnectMeta} loading={socialConnecting} disabled={!process.env.NEXT_PUBLIC_META_APP_ID}>
                        <Zap className="h-4 w-4" />
                        {copyText('توصيل الآن', 'Connect now')}
                      </SettingsButton>
                    )}
                    <Link href="/connections" className="inline-flex h-10 items-center justify-center rounded-[13px] border border-[#e3e8f3] bg-white px-4 text-[13px] font-bold text-[#111b3f]">
                      {copyText('إدارة كل التكاملات', 'Manage all')}
                    </Link>
                  </div>
                  {metaAccount && disconnectConfirmId === metaAccount.id ? (
                    <div className="mt-3 rounded-[14px] border border-rose-100 bg-rose-50/70 p-3">
                      <p className="text-[12px] font-bold leading-5 text-rose-700">
                        {copyText(
                          'سيوقف الفصل استخدام هذا الحساب في النشر العضوي داخل NEXUS. لن يحذف الحساب أو محتواه من Meta.',
                          'Disconnecting stops NEXUS from using this account for organic publishing. It does not delete the account or its Meta content.',
                        )}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <SettingsButton onClick={() => setDisconnectConfirmId(null)}>
                          {copyText('إلغاء', 'Cancel')}
                        </SettingsButton>
                        <SettingsButton tone="danger" onClick={() => handleDisconnect(metaAccount.id)} loading={disconnecting === metaAccount.id}>
                          {copyText('تأكيد الفصل', 'Confirm disconnect')}
                        </SettingsButton>
                      </div>
                    </div>
                  ) : null}
                </div>

              </div>
            </SettingsCard>

            <SettingsCard title={copyText('منطقة الحذر', 'Danger zone')} icon={<AlertTriangle size={18} />} className="border-rose-100">
              {resetMessage ? (
                <p className={`mb-3 rounded-[13px] px-3 py-2 text-[12px] font-bold ${resetMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {resetMessage.text}
                </p>
              ) : null}
              <div className="rounded-[16px] border border-rose-100 bg-rose-50/60 p-4">
                <p className="text-[13px] font-black text-rose-700">{copyText('إعادة ضبط مساحة العمل', 'Reset workspace')}</p>
                <p className="mt-1 text-[12px] leading-6 text-rose-600">
                  {copyText(
                    'يحذف Brand Brain والحملات والمحتوى والوسائط والتعلّم، لكنه يحافظ على الحساب والاشتراك وسجل الكريدت وعمليات الشراء والاتصالات. يحتاج كتابة RESET.',
                    'Deletes Brand Brain, campaigns, content, media, and learning. Account, subscription, credit/purchase ledger, and connections are preserved. Type RESET to continue.',
                  )}
                </p>
                {!resetConfirmOpen ? (
                  <SettingsButton tone="danger" onClick={() => setResetConfirmOpen(true)} className="mt-4">
                    <Trash2 className="h-4 w-4" />
                    {copyText('بدء التأكيد', 'Start confirmation')}
                  </SettingsButton>
                ) : (
                  <div className="mt-4 space-y-3">
                    <input
                      value={resetConfirmInput}
                      onChange={(event) => setResetConfirmInput(event.target.value)}
                      className="h-10 w-full rounded-[13px] border border-rose-200 bg-white px-3 text-sm outline-none focus:border-rose-400"
                      placeholder="RESET"
                      disabled={resetting}
                    />
                    <div className="flex flex-wrap gap-2">
                      <SettingsButton onClick={() => { setResetConfirmOpen(false); setResetConfirmInput('') }}>
                        {copyText('إلغاء', 'Cancel')}
                      </SettingsButton>
                      <SettingsButton tone="danger" onClick={handleResetWorkspace} loading={resetting} disabled={resetConfirmInput.trim() !== 'RESET'}>
                        {copyText('تأكيد إعادة الضبط', 'Confirm reset')}
                      </SettingsButton>
                    </div>
                    {resetting && (
                      <div className="flex items-start gap-3 rounded-[13px] border border-rose-200 bg-white px-3 py-3 text-[12px] font-semibold leading-5 text-rose-800" role="status" aria-live="polite">
                        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                        <span>{copyText(
                          'جارٍ حذف بيانات رحلة العلامة داخل معاملة واحدة ثم التحقق من البداية الجديدة. ابقَ في الصفحة حتى يتم التحويل إلى الإعداد.',
                          'Reset is deleting brand-journey data in one transaction, then verifying a clean start. Stay on this page until onboarding opens.',
                        )}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </SettingsCard>
          </section>
        </div>
      </main>
    </AppShell>
  )
}
