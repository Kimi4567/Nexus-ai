'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import StrategySpineCard from '@/components/StrategySpineCard'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { supabase } from '@/lib/supabaseClient'
import { formatCreditDisplay, getPlanDisplayName } from '@/lib/creditDisplay'
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  CreditCard,
  Database,
  Eye,
  EyeOff,
  Globe2,
  KeyRound,
  Link2,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Moon,
  Palette,
  Save,
  Settings,
  Shield,
  Sun,
  Trash2,
  User,
  Users,
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

function ToggleRow({
  title,
  helper,
  enabled = true,
}: {
  title: string
  helper: string
  enabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#eef2f8] py-3 last:border-b-0">
      <div>
        <p className="text-[13px] font-black text-[#111b3f]">{title}</p>
        <p className="mt-1 text-[11px] leading-5 text-[#7b87a3]">{helper}</p>
      </div>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${enabled ? 'bg-[#5366f6]' : 'bg-[#d8e0ee]'}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${enabled ? 'left-6' : 'left-1'}`} />
      </span>
    </div>
  )
}

function SelectShell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-[15px] border border-[#e8edf7] bg-[#fbfcff] px-4 py-3">
      <span>
        <span className="block text-[11px] font-bold text-[#7b87a3]">{label}</span>
        <span className="mt-1 block text-[13px] font-black text-[#111b3f]">{value}</span>
      </span>
      <ChevronDown className="h-4 w-4 text-[#8a96ad]" />
    </div>
  )
}

function RoleRow({
  name,
  email,
  role,
}: {
  name: string
  email: string
  role: string
}) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[#eef2f8] py-3 last:border-b-0">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f1f0ff] text-sm font-black text-[#4f46e5]">
          {name.charAt(0)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-black text-[#111b3f]">{name}</span>
          <span className="block truncate text-[11px] text-[#7b87a3]">{email}</span>
        </span>
      </div>
      <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-black text-violet-700">{role}</span>
    </div>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const { user, isAuthenticated, loading, authHeader } = useAuth()
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
  const [socialLoading, setSocialLoading] = useState(false)
  const [socialConnecting, setSocialConnecting] = useState(false)
  const [socialMessage, setSocialMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [disconnectConfirmId, setDisconnectConfirmId] = useState<string | null>(null)

  const [billingStatus, setBillingStatus] = useState<{
    plan: string
    hasActiveSubscription: boolean
    credits: { remaining: number; used: number; max: number }
  } | null>(null)

  const [signingOut, setSigningOut] = useState(false)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [resetConfirmInput, setResetConfirmInput] = useState('')
  const [resetting, setResetting] = useState(false)
  const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchSocialAccounts = useCallback(async () => {
    const token = authHeader()
    if (!token) return
    setSocialLoading(true)
    try {
      const res = await fetch('/api/social/accounts', { headers: { Authorization: token } })
      const data = await res.json()
      setSocialAccounts(data.accounts || [])
    } catch {
      setSocialAccounts([])
    } finally {
      setSocialLoading(false)
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
      setSocialMessage({
        type: 'error',
        text: msg
          ? copyText(`تعذر الربط: ${decodeURIComponent(msg)}`, `Connection failed: ${decodeURIComponent(msg)}`)
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
    } catch (error: any) {
      setNameMessage({ type: 'error', text: error.message || copyText('تعذر تحديث الاسم.', 'Could not update name.') })
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
    } catch (error: any) {
      setPasswordMessage({ type: 'error', text: error.message || copyText('تعذر تحديث كلمة المرور.', 'Could not update password.') })
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
      setResetMessage({ type: 'success', text: copyText('تمت إعادة ضبط مساحة العمل.', 'Workspace reset completed.') })
      setResetConfirmOpen(false)
      setResetConfirmInput('')
      setTimeout(() => router.push('/dashboard'), 1500)
    } catch {
      setResetMessage({ type: 'error', text: copyText('تعذر تنفيذ إعادة الضبط.', 'Could not reset workspace.') })
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

  const roleRows = useMemo(() => [
    {
      name: displayName || copyText('أحمد محمد', 'Ahmed Mohamed'),
      email: email || 'owner@nexus-grow.com',
      role: copyText('مالك', 'Owner'),
    },
  ], [copyText, displayName, email])

  const roleTemplates = useMemo(() => [
    [copyText('مالك', 'Owner'), copyText('الوصول الكامل لجميع الإعدادات.', 'Full access to all settings.'), 'bg-violet-50 text-violet-700'],
    [copyText('مدير', 'Manager'), copyText('إدارة الحملات والفريق والمحتوى.', 'Manage campaigns, team, and content.'), 'bg-blue-50 text-blue-700'],
    [copyText('محرر', 'Editor'), copyText('إنشاء وتحرير المحتوى والحملات بدون صلاحيات حساسة.', 'Create and edit content and campaigns without sensitive permissions.'), 'bg-amber-50 text-amber-700'],
    [copyText('مشاهد', 'Viewer'), copyText('عرض التقارير والمحتوى فقط.', 'Reports and content view only.'), 'bg-slate-50 text-slate-600'],
  ], [copyText])

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
            pageSubtitle={copyText('إدارة حسابك، فريقك، صلاحياتك، وتفضيلات النظام من مكان واحد.', 'Manage account, team, permissions, and system preferences from one place.')}
            primaryHref="/connections"
            primaryLabel={copyText('راجع التكاملات', 'Review integrations')}
            secondaryHref="/billing"
            secondaryLabel={copyText('الفوترة والخطة', 'Billing and plan')}
          />

          <StrategySpineCard
            nextHref="/strategy"
            nextLabel={copyText('راجع مسار الاستراتيجية', 'Review strategy path')}
            title={copyText('الإعدادات تضبط نظام التشغيل ولا تغيّر وعد الحملة', 'Settings configure the operating system without changing campaign promises')}
            body={copyText(
              'الحساب، الفريق، اللغة، الصلاحيات، والتكاملات تؤثر على جاهزية التنفيذ. لكنها لا تولّد استراتيجية أو محتوى ولا تنشر أو تصرف ميزانية بدون مسار واضح وتأكيد لاحق.',
              'Account, team, language, permissions, and integrations affect execution readiness. They do not generate strategy or content, publish, or spend budget without a clear later flow and confirmation.',
            )}
            className="mb-6"
          />

          <section className="mb-6 grid min-w-0 items-start gap-4 xl:grid-cols-12">
            <SettingsCard title={copyText('الحساب', 'Account')} icon={<User size={18} />} className="xl:col-span-3">
              <div className="flex items-center gap-5">
                <div className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#eff2ff] to-white p-2">
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-[#071236] text-4xl font-black text-white">
                    {(displayName || email || 'N').charAt(0).toUpperCase()}
                  </div>
                  <button
                    type="button"
                    disabled
                    title={copyText('تغيير الصورة الشخصية غير متاح في هذه المرحلة.', 'Profile photo editing is not available in this phase.')}
                    className="absolute bottom-2 right-2 flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-full border border-[#e3e8f3] bg-white text-[#8b96ad] opacity-80 shadow-sm"
                  >
                    <Palette className="h-4 w-4" />
                  </button>
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

            <SettingsCard
              title={copyText('الأدوار والصلاحيات', 'Roles and permissions')}
              icon={<Users size={18} />}
              className="xl:col-span-6"
            >
              <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <div className="rounded-[18px] border border-[#e8edf7] bg-[#fbfcff] px-4">
                  <p className="border-b border-[#eef2f8] py-3 text-[12px] font-bold text-[#64708f]">
                    {copyText('الفريق الحالي الفعلي في مساحة العمل.', 'Actual current workspace team.')}
                  </p>
                  {roleRows.map((row) => (
                    <RoleRow key={row.email} {...row} />
                  ))}
                </div>
                <div className="grid content-start gap-3 sm:grid-cols-2">
                  <p className="text-[12px] font-bold text-[#64708f]">
                    {copyText('مرجع واضح لنطاق كل دور. دعوات الفريق غير متاحة في هذه الخطة حالياً.', 'A clear reference for each role. Team invitations are not currently available on this plan.')}
                  </p>
                  <span className="hidden sm:block" />
                  {roleTemplates.map(([role, helper, tone]) => (
                    <div key={role} className="rounded-[15px] border border-[#e8edf7] bg-white p-3">
                      <p className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${tone}`}>{role}</p>
                      <p className="mt-2 text-[11px] leading-5 text-[#64708f]">{helper}</p>
                    </div>
                  ))}
                </div>
              </div>
            </SettingsCard>

            <SettingsCard title={copyText('الفوترة والخطة', 'Billing and plan')} icon={<CreditCard size={18} />} className="xl:col-span-3">
              <div className="rounded-[18px] border border-[#e8edf7] bg-[#fbfcff] p-4 text-center">
                <p className="inline-flex rounded-full bg-[#fff7db] px-3 py-1 text-[11px] font-black text-[#a66b00]">NEXUS PRO</p>
                <h3 className="mt-3 text-lg font-black text-[#071236]">{planLabel}</h3>
                <p className="mt-1 text-[12px] text-[#64708f]">
                  {billingStatus?.hasActiveSubscription
                    ? copyText('اشتراك نشط', 'Active subscription')
                    : copyText('أرصدة وتجربة محدودة', 'Credits and limited trial')}
                </p>
                <div className="mt-5 space-y-4 text-start">
                  {[
                    [copyText('الأرصدة', 'Credits'), billingStatus ? creditDisplay.primary : '…', creditDisplay.percent],
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

          <section className="grid min-w-0 gap-6 xl:grid-cols-3">
            <SettingsCard title={copyText('الإشعارات', 'Notifications')} icon={<Bell size={18} />}>
              <p className="mb-2 rounded-[14px] bg-[#fbfcff] px-3 py-2 text-[11px] font-bold leading-5 text-[#64708f]">
                {copyText('عرض لسياسة الإشعارات الحالية. تعديل التفضيلات التفصيلية سيضاف لاحقاً.', 'Read-only view of the current notification policy. Detailed preference editing is coming later.')}
              </p>
              <ToggleRow title={copyText('إشعارات النظام', 'System alerts')} helper={copyText('تحديثات النظام والتنبيهات العامة.', 'System updates and general alerts.')} />
              <ToggleRow title={copyText('أداء الحملات والتقارير', 'Campaign performance')} helper={copyText('تقارير الأداء اليومية والأسبوعية.', 'Daily and weekly performance reports.')} />
              <ToggleRow title={copyText('موافقات المحتوى', 'Content approvals')} helper={copyText('طلبات الموافقة والتنبيهات.', 'Approval requests and alerts.')} />
              <ToggleRow title={copyText('التنبيهات الذكية', 'Smart alerts')} helper={copyText('تنبيهات مقدمة بالذكاء الاصطناعي.', 'AI-assisted alerts.')} enabled={false} />
            </SettingsCard>

            <SettingsCard title={copyText('اللغة والمنطقة', 'Language and region')} icon={<Globe2 size={18} />}>
              <div className="space-y-3">
                <SelectShell label={copyText('اللغة', 'Language')} value={ar ? 'العربية (Arabic)' : 'English'} />
                <SelectShell label={copyText('المنطقة الزمنية', 'Time zone')} value={copyText('الرياض (GMT +3)', 'Riyadh (GMT +3)')} />
                <SelectShell label={copyText('تنسيق التاريخ', 'Date format')} value="YYYY / MM / DD" />
                <SelectShell label={copyText('تنسيق الأرقام', 'Number format')} value="01,234.56" />
              </div>
              <p className="mt-4 flex items-center gap-2 text-[12px] font-bold text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                {copyText('هذه القيم تعرض حالة الواجهة الحالية ولا تغيّر إعدادات الحساب بعد.', 'These values show the current interface state and do not change account settings yet.')}
              </p>
            </SettingsCard>

            <SettingsCard title={copyText('تفضيلات النظام', 'System preferences')} icon={<Settings size={18} />}>
              <p className="mb-2 rounded-[14px] bg-[#fbfcff] px-3 py-2 text-[11px] font-bold leading-5 text-[#64708f]">
                {copyText('تفضيلات عرض فقط حالياً؛ لا يتم حفظ تغيير جديد من هذه البطاقة.', 'Display-only preferences for now; this card does not save new changes.')}
              </p>
              <ToggleRow title={copyText('الوضع الداكن', 'Dark mode')} helper={copyText('تخصيص مظهر النظام.', 'Customize system appearance.')} enabled={false} />
              <ToggleRow title={copyText('عرض الكثافة', 'Compact density')} helper={copyText('تحكم في كثافة البطاقات.', 'Control card density.')} />
              <ToggleRow title={copyText('الرسوم المتحركة', 'Motion')} helper={copyText('تأثيرات واجهة المستخدم.', 'Interface motion effects.')} />
              <ToggleRow title={copyText('نصائح داخل التطبيق', 'In-app tips')} helper={copyText('عرض الإرشادات والنصائح.', 'Show guidance and tips.')} />
              <div className="mt-3 flex gap-2 text-[#5366f6]">
                <Sun className="h-4 w-4" />
                <Moon className="h-4 w-4" />
              </div>
            </SettingsCard>

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

            <SettingsCard title={copyText('التكاملات وواجهات برمجة التطبيقات', 'Integrations and API')} icon={<Link2 size={18} />}>
              {socialMessage ? (
                <p className={`mb-3 rounded-[13px] px-3 py-2 text-[12px] font-bold ${socialMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
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

                <div className="rounded-[16px] border border-[#e8edf7] bg-white p-4">
                  <p className="mb-2 text-[13px] font-black text-[#111b3f]">API Keys</p>
                  <div className="flex min-w-0 items-center gap-2 rounded-[13px] border border-[#e8edf7] bg-[#fbfcff] px-3 py-2 text-[12px] text-[#64708f]">
                    <span className="min-w-0 flex-1">
                      {copyText('لم يتم إصدار مفتاح مطوّر لمساحة العمل هذه.', 'No developer key has been issued for this workspace.')}
                    </span>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">
                      {copyText('غير متاح بعد', 'Not available yet')}
                    </span>
                    <button
                      type="button"
                      disabled
                      title={copyText('نسخ مفاتيح API يتطلب عرض مفتاح حقيقي من إعدادات المطورين.', 'Copying API keys requires a real developer key view.')}
                      className="ms-auto cursor-not-allowed text-[#8b96ad]"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
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
                  {copyText('إجراء حساس يمس بيانات التجربة. يحتاج كتابة RESET قبل التنفيذ.', 'Sensitive action that affects trial data. Requires typing RESET before execution.')}
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
