'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import Link from 'next/link'
import { Shield, Cookie, Eye, EyeOff } from 'lucide-react'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'

export default function RegisterPage() {
  const { signup } = useAuth()
  const { t, isRTL } = useI18n()
  const [name, setName] = useState('')

  // Capture referral code from ?ref= query param and persist it for post-signup claim
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref')
    if (ref) localStorage.setItem('pendingReferralCode', ref)
  }, [])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreeCookies, setAgreeCookies] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<'idle' | 'verify' | 'active'>('idle')

  const authT = t('auth.register')
  const errorsT = authT?.errors || {}

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    if (supabaseUrl.includes('placeholder') || !supabaseUrl) {
      setError(errorsT?.serviceUnavailable || '')
      return
    }
    if (!name.trim() || !email || !password) { setError(errorsT?.allFields || ''); return }
    if (password.length < 8) { setError(errorsT?.passwordLength || ''); return }
    if (password !== confirmPassword) { setError(errorsT?.passwordMatch || ''); return }
    if (!agreeTerms) { setError(errorsT?.termsRequired || ''); return }
    if (!agreeCookies) { setError(errorsT?.cookiesRequired || ''); return }
    setLoading(true)
    try {
      const result = await signup(email, password, { name })
      localStorage.setItem('nexus_consent', JSON.stringify({ terms: true, privacy: true, cookies: true, timestamp: new Date().toISOString(), email }))
      // Fire welcome email — non-blocking, never fails registration
      fetch('/api/auth/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      }).catch(() => {})
      setDone(result.needsEmailConfirmation ? 'verify' : 'active')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      const lowerMsg = msg.toLowerCase()
      if (lowerMsg.includes('already registered') || lowerMsg.includes('already exists') || lowerMsg.includes('user exists')) {
        setError(errorsT?.emailUsed || '')
      } else if (lowerMsg.includes('signup') && lowerMsg.includes('disabled')) {
        setError(errorsT?.signupDisabled || errorsT?.serviceUnavailable || '')
      } else if (lowerMsg.includes('invalid email')) {
        setError(errorsT?.invalidEmail || errorsT?.generic || '')
      } else if (lowerMsg.includes('rate limit') || lowerMsg.includes('too many')) {
        setError(errorsT?.rateLimit || errorsT?.generic || '')
      } else if (lowerMsg.includes('email') && (lowerMsg.includes('send') || lowerMsg.includes('smtp') || lowerMsg.includes('provider'))) {
        setError(errorsT?.emailDelivery || errorsT?.generic || '')
      } else {
        setError(errorsT?.generic || '')
      }
      setLoading(false)
    }
  }

  // D0.2 — light operator inputs, mirroring /auth/login (white bg, dark readable
  // text, soft border, violet focus). Replaces the dark-on-light broken styling.
  const inputStyle = { background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.12)' }
  const inputClass = "w-full px-4 py-3 rounded-xl text-slate-950 placeholder-slate-400 focus:outline-none transition text-right"

  const pageWrap = (
    <div className="min-h-screen bg-bg-base text-slate-950 flex items-center justify-center px-4 py-12"
      style={{ backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(94,92,230,0.08), transparent)' }}>
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-4"><LanguageSwitcher /></div>
        <div className="glass-panel p-8 rounded-2xl shadow-2xl">
          <Link href="/" className="flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-lg grid place-items-center font-black text-lg text-white"
              style={{ background: 'linear-gradient(135deg,#8B5CF6,#10B981)' }}>N</div>
            <span className="text-2xl font-extrabold tracking-wider font-heading text-gradient">NEXUS AI</span>
          </Link>
          {done !== 'idle' ? (
            <div className="text-center">
              <h2 className="text-2xl font-bold font-heading mb-3 text-slate-950">
                {done === 'verify'
                  ? authT?.verifyTitle
                  : (isRTL ? 'تم إنشاء الحساب' : 'Account created')}
              </h2>
              <p className="text-text-secondary text-sm mb-2">
                {done === 'verify'
                  ? authT?.verifySent
                  : (isRTL ? 'تم تفعيل حسابك ويمكنك المتابعة الآن.' : 'Your account is active. You can continue now.')}
              </p>
              <p className="text-accent-purple font-semibold mb-6">{email}</p>
              <p className="text-text-muted text-sm mb-6">
                {done === 'verify'
                  ? authT?.verifyCheck
                  : (isRTL ? 'إذا لم تنتقل تلقائيًا، استخدم الزر بالأسفل لبدء إعداد Brand Brain.' : 'If you are not redirected automatically, use the button below to start Brand Brain setup.')}
              </p>
              {/* Next steps hint */}
              <div className="rounded-xl px-4 py-3 mb-6 text-left"
                style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
                <p className="text-xs font-bold text-accent-purple mb-2">
                  {done === 'verify'
                    ? (isRTL ? 'بعد التحقق من البريد ستتمكن من:' : 'After verifying your email you\'ll:')
                    : (isRTL ? 'الخطوة التالية:' : 'Next step:')}
                </p>
                <div className="space-y-1">
	                  {(isRTL ? [
	                    'إعداد Brand Brain لعلامتك',
	                    'تحضير أول موجز استراتيجية',
	                    'مراجعة خطة المحتوى عندما تكون جاهزة',
	                  ] : [
	                    'Set up your Brand Brain',
	                    'Prepare your first strategy brief',
	                    'Review your first content plan when ready',
	                  ]).map(item => (
                    <p key={item} className="text-xs text-text-muted">{item}</p>
                  ))}
                </div>
              </div>
              <Link href={done === 'verify' ? '/auth/login' : '/onboarding'} className="btn-gradient block w-full py-3 text-white font-bold rounded-xl text-center hover:-translate-y-0.5 transition">
                {done === 'verify'
                  ? authT?.verifyCta
                  : (isRTL ? 'ابدأ إعداد Brand Brain' : 'Start Brand Brain setup')} →
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold font-heading mb-1 text-slate-950">{authT?.title}</h2>
              <p className="text-text-secondary text-sm mb-8">{authT?.subtitle}</p>
              {error && <div className="bg-rose-500/10 border border-rose-500/40 rounded-xl px-4 py-3 mb-6 text-sm text-rose-300">{error}</div>}
              <form onSubmit={handleSubmit} className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
                {/* Name */}
                <div>
                  <label className="block text-sm font-semibold mb-2 text-text-secondary">{authT?.nameLabel}</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder={authT?.namePlaceholder}
                    autoComplete="name" className={inputClass} style={inputStyle}
                    onFocus={e => (e.currentTarget.style.border = '1px solid rgba(94,92,230,0.5)')}
                    onBlur={e => (e.currentTarget.style.border = '1px solid rgba(15,23,42,0.12)')} />
                </div>
                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold mb-2 text-text-secondary">{authT?.emailLabel}</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
                    autoComplete="email" className={inputClass} style={inputStyle}
                    onFocus={e => (e.currentTarget.style.border = '1px solid rgba(94,92,230,0.5)')}
                    onBlur={e => (e.currentTarget.style.border = '1px solid rgba(15,23,42,0.12)')} />
                </div>
                {/* Password */}
                <div>
                  <label className="block text-sm font-semibold mb-2 text-text-secondary">{authT?.passwordLabel}</label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                      placeholder={authT?.passwordPlaceholder} autoComplete="new-password"
                      className={`${inputClass} pr-11`} style={inputStyle}
                      onFocus={e => (e.currentTarget.style.border = '1px solid rgba(94,92,230,0.5)')}
                      onBlur={e => (e.currentTarget.style.border = '1px solid rgba(15,23,42,0.12)')} />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-950 transition" tabIndex={-1}>
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-semibold mb-2 text-text-secondary">{authT?.confirmLabel}</label>
                  <div className="relative">
                    <input type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                      placeholder={authT?.confirmPlaceholder} autoComplete="new-password"
                      className={`${inputClass} pr-11`} style={inputStyle}
                      onFocus={e => (e.currentTarget.style.border = '1px solid rgba(94,92,230,0.5)')}
                      onBlur={e => (e.currentTarget.style.border = '1px solid rgba(15,23,42,0.12)')} />
                    <button type="button" onClick={() => setShowConfirm(v => !v)}
                      className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-950 transition" tabIndex={-1}>
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-3 pt-2">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={agreeTerms} onChange={e => setAgreeTerms(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 accent-violet-500 cursor-pointer shrink-0" />
                    <span className="text-xs text-text-secondary leading-relaxed">
                      <Shield className="w-3 h-3 inline text-accent-purple ml-1" />
                      {authT?.termsConsent}{' '}
                      <Link href="/terms" target="_blank" className="text-accent-purple hover:underline">{authT?.termsLink}</Link>{' '}
                      <Link href="/privacy" target="_blank" className="text-accent-purple hover:underline">{authT?.privacyLink}</Link>{' '}
                      <Link href="/refund" target="_blank" className="text-accent-purple hover:underline">{authT?.refundLink}</Link>
                    </span>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={agreeCookies} onChange={e => setAgreeCookies(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 accent-violet-500 cursor-pointer shrink-0" />
                    <span className="text-xs text-text-secondary leading-relaxed">
                      <Cookie className="w-3 h-3 inline text-accent-purple ml-1" />
                      {authT?.cookieConsent}{' '}
                      <Link href="/cookies" target="_blank" className="text-accent-purple hover:underline">{authT?.cookieLink}</Link>
                    </span>
                  </label>
                </div>
                <button type="submit" disabled={loading}
                  className="btn-gradient w-full py-3 text-white font-bold rounded-xl hover:-translate-y-0.5 transition disabled:opacity-50 mt-2">
                  {loading ? authT?.loading : authT?.submit}
                </button>
              </form>
              <p className="text-center text-sm text-text-secondary mt-4">
                {authT?.hasAccount}{' '}
                <Link href="/auth/login" className="text-accent-purple hover:text-accent-purple/80 transition font-semibold">{authT?.loginLink}</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )

  return pageWrap
}
