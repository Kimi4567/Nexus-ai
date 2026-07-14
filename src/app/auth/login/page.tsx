'use client'

import { useEffect, useState, Suspense } from 'react'
import { useI18n } from '@/lib/i18n-context'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient'
import { getBrandBrainReadiness } from '@/lib/brandReadiness'
import { getFirstRunJourney, type StrategyState } from '@/lib/firstUserJourney'
import LuxuryAuthShell from '@/components/auth/LuxuryAuthShell'

function safeInternalRedirect(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  if (value.includes('://')) return null
  return value
}

function LoginForm() {
  const { t, isRTL, dir } = useI18n()
  const searchParams = useSearchParams()

  // Restore saved email if user previously checked "Remember Me"
  const savedEmail = typeof window !== 'undefined'
    ? (localStorage.getItem('nexus-remember-email') ?? '')
    : ''
  const [email, setEmail] = useState(savedEmail)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(savedEmail !== '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => setError(''), [isRTL])

  const loginT = t('auth.login')
  const redirectTo = safeInternalRedirect(
    searchParams.get('redirect') || searchParams.get('redirectTo'),
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError(loginT?.errors?.allFields || ''); return }
    if (!isSupabaseConfigured) {
      setError(isRTL
        ? 'خدمة تسجيل الدخول غير متاحة حاليًا. يرجى المحاولة لاحقًا.'
        : 'Sign-in is temporarily unavailable. Please try again later.')
      return
    }
    setLoading(true)
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) {
        const msg = authError.message || ''
        if (msg.includes('Email not confirmed')) {
          setError(loginT?.errors?.emailNotConfirmed || '')
        } else if (msg.includes('Invalid login credentials')) {
          setError(loginT?.errors?.invalidCredentials || '')
        } else {
          // Do not leak provider-language or implementation details into the
          // customer UI. The localized fallback remains truthful and useful.
          setError(loginT?.errors?.loginFailed || '')
        }
        setLoading(false)
        return
      }
      // Persist email for next visit if "Remember Me" is checked
      if (rememberMe) {
        localStorage.setItem('nexus-remember-email', email)
      } else {
        localStorage.removeItem('nexus-remember-email')
      }
      if (redirectTo) {
        window.location.href = redirectTo
        return
      }

      const token = data.session?.access_token
      if (!token) {
        window.location.href = '/dashboard'
        return
      }

      try {
        const meRes = await fetch('/api/user/me', { headers: { Authorization: `Bearer ${token}` } })
        const me = meRes.ok ? await meRes.json() : null
        if (!me?.workspaceId) {
          window.location.href = '/onboarding'
          return
        }

        const [brandRes, statsRes] = await Promise.allSettled([
          fetch('/api/brand', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/dashboard/stats', { headers: { Authorization: `Bearer ${token}` } }),
        ])
        const brandData = brandRes.status === 'fulfilled' && brandRes.value.ok ? await brandRes.value.json() : null
        const statsData = statsRes.status === 'fulfilled' && statsRes.value.ok ? await statsRes.value.json() : null
        const brandProfile = brandData?.brandProfile ?? null
        const brandReadiness = getBrandBrainReadiness(brandProfile)
        const campaignCount = statsData?.stats?.campaigns?.total ?? 0
        const contentPostsTotal = statsData?.stats?.contentPosts?.total ?? 0
        const approvedOrLaterPosts = statsData?.stats?.contentPosts?.approvedOrLater ?? 0
        const strategyState: StrategyState = campaignCount === 0 ? 'none' : (contentPostsTotal > 0 ? 'approved' : 'draft')
        const journey = getFirstRunJourney({
          hasWorkspace: true,
          hasBrandProfile: Boolean(brandProfile?.brandName || brandProfile?.industry || brandProfile?.description),
          brandBrainReady: brandReadiness.ready,
          strategyState,
          hasCampaignOrContent: campaignCount > 0 || contentPostsTotal > 0,
          hasContent: contentPostsTotal > 0,
          contentApproved: approvedOrLaterPosts > 0,
        })

        window.location.href = journey.state === 'execution_ready_later' ? '/dashboard' : journey.href
      } catch {
        window.location.href = '/dashboard'
      }
    } catch {
      setError(loginT?.errors?.unexpected || '')
      setLoading(false)
    }
  }

  const inputClass = `w-full rounded-2xl px-4 py-3 text-slate-950 placeholder-slate-400 outline-none transition ${isRTL ? 'text-right' : 'text-left'}`
  const inputStyle = { background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.12)' }

  return (
    <LuxuryAuthShell
      dir={dir}
      title={loginT?.title}
      subtitle={loginT?.subtitle}
      eyebrow={isRTL ? 'دخول إلى نظام التسويق الذكي' : 'Sign in to the AI marketing OS'}
      footer={
        <p className="text-center text-sm text-slate-600">
          {loginT?.noAccount}{' '}
          <Link href="/auth/register" className="font-semibold text-indigo-600 transition hover:text-indigo-500">
            {loginT?.registerLink}
          </Link>
        </p>
      }
    >
          {error && (
            <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
            <div>
              <label className="block text-sm font-semibold mb-2 text-text-secondary">{loginT?.emailLabel}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
                autoComplete="email" className={inputClass}
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.border = '1px solid rgba(94,92,230,0.5)')}
                onBlur={e => (e.currentTarget.style.border = '1px solid rgba(15,23,42,0.12)')} />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-text-secondary">{loginT?.passwordLabel}</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                  autoComplete="current-password" className={`${inputClass} ${isRTL ? 'pl-11' : 'pr-11'}`}
                  style={inputStyle}
                  onFocus={e => (e.currentTarget.style.border = '1px solid rgba(94,92,230,0.5)')}
                  onBlur={e => (e.currentTarget.style.border = '1px solid rgba(15,23,42,0.12)')} />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword
                    ? (isRTL ? 'إخفاء كلمة المرور' : 'Hide password')
                    : (isRTL ? 'إظهار كلمة المرور' : 'Show password')}
                  className={`absolute inset-y-0 ${isRTL ? 'left-3' : 'right-3'} flex items-center text-slate-400 transition hover:text-slate-950`} tabIndex={-1}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 bg-white accent-indigo-600" />
                {loginT?.rememberMe}
              </label>
              <Link href="/auth/forgot-password" className="text-sm font-semibold text-indigo-600 transition hover:text-indigo-500">
                {loginT?.forgotPassword}
              </Link>
            </div>
            <button type="submit" disabled={loading}
              className="w-full rounded-2xl bg-[#071332] py-3 font-bold text-white shadow-[0_16px_32px_rgba(7,19,50,0.20)] transition hover:-translate-y-0.5 disabled:opacity-50">
              {loading ? (loginT?.loading || 'Signing in...') : loginT?.submit}
            </button>
          </form>
    </LuxuryAuthShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-base" />}>
      <LoginForm />
    </Suspense>
  )
}
