'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import Link from 'next/link'
import { Shield, Cookie, Eye, EyeOff } from 'lucide-react'
import { getRegisterErrorCopy, getRegisterErrorMetadata } from './registerErrors'
import LuxuryAuthShell from '@/components/auth/LuxuryAuthShell'

function warnRegisterSignupFailure(err: unknown) {
  if (process.env.NODE_ENV === 'production') return
  console.warn('[register] signup failed', getRegisterErrorMetadata(err))
}

export default function RegisterPage() {
  const { signup } = useAuth()
  const { t, isRTL, dir } = useI18n()
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
      // Supabase owns the confirmation email. Product welcome messages are sent
      // only after an authenticated session exists; registration never invokes
      // an unauthenticated arbitrary-email endpoint.
      setDone(result.needsEmailConfirmation ? 'verify' : 'active')
    } catch (err: unknown) {
      warnRegisterSignupFailure(err)
      setError(getRegisterErrorCopy(err, isRTL ? 'ar' : 'en'))
      setLoading(false)
    }
  }

  // D0.2 — light operator inputs, mirroring /auth/login (white bg, dark readable
  // text, soft border, violet focus). Replaces the dark-on-light broken styling.
  const inputStyle = { background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.12)' }
  const inputClass = `w-full rounded-2xl px-4 py-3 text-slate-950 placeholder-slate-400 outline-none transition ${isRTL ? 'text-right' : 'text-left'}`

  const pageWrap = (
    <LuxuryAuthShell
      dir={dir}
      title={done !== 'idle'
        ? (done === 'verify' ? authT?.verifyTitle : (isRTL ? 'تم إنشاء الحساب' : 'Account created'))
        : authT?.title}
      subtitle={done !== 'idle'
        ? (done === 'verify'
            ? authT?.verifySent
            : (isRTL ? 'تم تفعيل حسابك ويمكنك المتابعة الآن.' : 'Your account is active. You can continue now.'))
        : authT?.subtitle}
      eyebrow={isRTL ? 'إنشاء مساحة عمل آمنة' : 'Create a secure workspace'}
      footer={done === 'idle' ? (
        <p className="text-center text-sm text-slate-600">
          {authT?.hasAccount}{' '}
          <Link href="/auth/login" className="font-semibold text-indigo-600 transition hover:text-indigo-500">{authT?.loginLink}</Link>
        </p>
      ) : undefined}
    >
          {done !== 'idle' ? (
            <div className="text-center">
              <p className="font-semibold text-indigo-600 mb-6">{email}</p>
              <p className="text-sm text-slate-500 mb-6">
                {done === 'verify'
                  ? authT?.verifyCheck
                  : (isRTL ? 'استخدم الزر بالأسفل لبدء إعداد Brand Brain.' : 'Use the button below to start Brand Brain setup.')}
              </p>
              {/* Next steps hint */}
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 mb-6 text-start">
                <p className="text-xs font-bold text-indigo-700 mb-2">
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
                    <p key={item} className="text-xs text-slate-600">{item}</p>
                  ))}
                </div>
              </div>
              <Link href={done === 'verify' ? '/auth/login' : '/onboarding'} className="block w-full rounded-2xl bg-[#071332] py-3 text-center font-bold text-white shadow-[0_16px_32px_rgba(7,19,50,0.20)] transition hover:-translate-y-0.5">
                {done === 'verify'
                  ? authT?.verifyCta
                  : (isRTL ? 'ابدأ إعداد Brand Brain' : 'Start Brand Brain setup')} →
              </Link>
            </div>
          ) : (
            <>
              {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 mb-6 text-sm font-medium text-red-700">{error}</div>}
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
                      className={`${inputClass} ${isRTL ? 'pl-11' : 'pr-11'}`} style={inputStyle}
                      onFocus={e => (e.currentTarget.style.border = '1px solid rgba(94,92,230,0.5)')}
                      onBlur={e => (e.currentTarget.style.border = '1px solid rgba(15,23,42,0.12)')} />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className={`absolute inset-y-0 ${isRTL ? 'left-3' : 'right-3'} flex items-center text-slate-400 hover:text-slate-950 transition`} tabIndex={-1}>
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
                      className={`${inputClass} ${isRTL ? 'pl-11' : 'pr-11'}`} style={inputStyle}
                      onFocus={e => (e.currentTarget.style.border = '1px solid rgba(94,92,230,0.5)')}
                      onBlur={e => (e.currentTarget.style.border = '1px solid rgba(15,23,42,0.12)')} />
                    <button type="button" onClick={() => setShowConfirm(v => !v)}
                      className={`absolute inset-y-0 ${isRTL ? 'left-3' : 'right-3'} flex items-center text-slate-400 hover:text-slate-950 transition`} tabIndex={-1}>
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-3 pt-2">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={agreeTerms} onChange={e => setAgreeTerms(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 bg-white accent-indigo-600 cursor-pointer shrink-0" />
                    <span className="text-xs text-text-secondary leading-relaxed">
                      <Shield className="w-3 h-3 inline text-indigo-600 ml-1" />
                      {authT?.termsConsent}{' '}
                      <Link href="/terms" target="_blank" className="text-indigo-600 hover:underline">{authT?.termsLink}</Link>{' '}
                      <Link href="/privacy" target="_blank" className="text-indigo-600 hover:underline">{authT?.privacyLink}</Link>{' '}
                      <Link href="/refund" target="_blank" className="text-indigo-600 hover:underline">{authT?.refundLink}</Link>
                    </span>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={agreeCookies} onChange={e => setAgreeCookies(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 bg-white accent-indigo-600 cursor-pointer shrink-0" />
                    <span className="text-xs text-text-secondary leading-relaxed">
                      <Cookie className="w-3 h-3 inline text-indigo-600 ml-1" />
                      {authT?.cookieConsent}{' '}
                      <Link href="/cookies" target="_blank" className="text-indigo-600 hover:underline">{authT?.cookieLink}</Link>
                    </span>
                  </label>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full rounded-2xl bg-[#071332] py-3 text-white font-bold shadow-[0_16px_32px_rgba(7,19,50,0.20)] hover:-translate-y-0.5 transition disabled:opacity-50 mt-2">
                  {loading ? authT?.loading : authT?.submit}
                </button>
              </form>
            </>
          )}
    </LuxuryAuthShell>
  )

  return pageWrap
}
