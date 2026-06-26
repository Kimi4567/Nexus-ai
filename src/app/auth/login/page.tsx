'use client'

import { useState, Suspense } from 'react'
import { useI18n } from '@/lib/i18n-context'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
import { supabase } from '@/lib/supabaseClient'
import { getBrandBrainReadiness } from '@/lib/brandReadiness'
import { getFirstRunJourney, type StrategyState } from '@/lib/firstUserJourney'

function safeInternalRedirect(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  if (value.includes('://')) return null
  return value
}

function LoginForm() {
  const { t, isRTL } = useI18n()
  const router = useRouter()
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

  const loginT = t('auth.login')
  const redirectTo = safeInternalRedirect(searchParams.get('redirect'))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError(loginT?.errors?.allFields || ''); return }
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
          setError(msg || loginT?.errors?.loginFailed || '')
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
        const publishedPostsTotal = statsData?.stats?.publishedPosts?.total ?? 0
        const strategyState: StrategyState = campaignCount === 0 ? 'none' : (contentPostsTotal > 0 ? 'approved' : 'draft')
        const journey = getFirstRunJourney({
          hasWorkspace: true,
          hasBrandProfile: Boolean(brandProfile?.brandName || brandProfile?.industry || brandProfile?.description),
          brandBrainReady: brandReadiness.ready,
          strategyState,
          hasCampaignOrContent: campaignCount > 0 || contentPostsTotal > 0,
          hasContent: contentPostsTotal > 0,
          contentApproved: publishedPostsTotal > 0,
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

  const inputClass = "w-full px-4 py-3 rounded-xl text-slate-950 placeholder-slate-400 focus:outline-none transition text-right"
  const inputStyle = { background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.12)' }

  return (
    <div className="min-h-screen bg-bg-base text-slate-950 flex items-center justify-center px-4 py-12"
      style={{ backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(94,92,230,0.08), transparent)' }}>
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-4">
          <LanguageSwitcher />
        </div>
        <div className="glass-panel p-8 rounded-2xl shadow-2xl">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-lg grid place-items-center font-black text-lg"
              style={{ background: 'linear-gradient(135deg,#8B5CF6,#10B981)', color: 'white' }}>N</div>
            <span className="text-2xl font-extrabold tracking-wider font-heading text-gradient">NEXUS AI</span>
          </Link>

          <h2 className="text-2xl font-bold font-heading mb-1 text-slate-950">{loginT?.title}</h2>
          <p className="text-text-secondary text-sm mb-8">{loginT?.subtitle}</p>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/40 rounded-xl px-4 py-3 mb-6 text-sm text-rose-300">
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
                  autoComplete="current-password" className={`${inputClass} pr-11`}
                  style={inputStyle}
                  onFocus={e => (e.currentTarget.style.border = '1px solid rgba(94,92,230,0.5)')}
                  onBlur={e => (e.currentTarget.style.border = '1px solid rgba(15,23,42,0.12)')} />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-950 transition" tabIndex={-1}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 accent-violet-500" />
                {loginT?.rememberMe}
              </label>
              <Link href="/auth/forgot-password" className="text-sm text-accent-purple hover:text-accent-purple/80 transition">
                {loginT?.forgotPassword}
              </Link>
            </div>
            <button type="submit" disabled={loading}
              className="btn-gradient w-full py-3 text-white font-bold rounded-xl hover:-translate-y-0.5 transition disabled:opacity-50">
              {loading ? (loginT?.loading || 'Signing in...') : loginT?.submit}
            </button>
          </form>

          <p className="text-center text-sm text-text-secondary mt-4">
            {loginT?.noAccount}{' '}
            <Link href="/auth/register" className="text-accent-purple hover:text-accent-purple/80 transition font-semibold">
              {loginT?.registerLink}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-base" />}>
      <LoginForm />
    </Suspense>
  )
}
