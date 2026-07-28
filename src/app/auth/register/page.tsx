'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import Link from 'next/link'
import { Shield, Eye, EyeOff } from 'lucide-react'
import { getRegisterErrorCopy, getRegisterErrorMetadata } from './registerErrors'
import LuxuryAuthShell from '@/components/auth/LuxuryAuthShell'
import { isSupabaseConfigured } from '@/lib/supabaseClient'
import { getPublicPaidPlan, type PublicPaidPlan } from '@/lib/commercialPlans'

function warnRegisterSignupFailure(err: unknown) {
  if (process.env.NODE_ENV === 'production') return
  console.warn('[register] signup failed', getRegisterErrorMetadata(err))
}

export default function RegisterPage() {
  const { signup } = useAuth()
  const { t, isRTL, dir } = useI18n()
  const [name, setName] = useState('')
  const [selectedPlanIntent, setSelectedPlanIntent] = useState<PublicPaidPlan | null>(null)

  // Capture referral code for post-signup claim and preserve the commercial
  // context of a pricing CTA without treating plan intent as a subscription.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref')
    if (ref) localStorage.setItem('pendingReferralCode', ref)
    setSelectedPlanIntent(getPublicPaidPlan(params.get('plan')))
  }, [])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<'idle' | 'verify' | 'active'>('idle')

  // Validation copy belongs to the language in which it was produced. Clear
  // it on a language switch so Arabic and English never appear together.
  useEffect(() => setError(''), [isRTL])

  const authT = t('auth.register')
  const errorsT = authT?.errors || {}

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!isSupabaseConfigured) {
      setError(errorsT?.serviceUnavailable || '')
      return
    }
    if (!name.trim() || !email || !password) { setError(errorsT?.allFields || ''); return }
    if (password.length < 8) { setError(errorsT?.passwordLength || ''); return }
    if (password !== confirmPassword) { setError(errorsT?.passwordMatch || ''); return }
    if (!agreeTerms) { setError(errorsT?.termsRequired || ''); return }
    setLoading(true)
    try {
      const result = await signup(email, password, { name })
      localStorage.setItem('nexus_consent', JSON.stringify({
        terms: true,
        privacy: true,
        termsVersion: '2026-07-13',
        timestamp: new Date().toISOString(),
      }))
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

  const inputClass = `nx-auth-input w-full px-4 py-3 placeholder-slate-400 ${isRTL ? 'text-right' : 'text-left'}`

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
              <Link href={done === 'verify' ? '/auth/login' : '/onboarding'} className="nx-auth-primary block w-full py-3 text-center font-bold">
                {done === 'verify'
                  ? authT?.verifyCta
                  : (isRTL ? 'ابدأ إعداد Brand Brain' : 'Start Brand Brain setup')} →
              </Link>
            </div>
          ) : (
            <>
              {selectedPlanIntent && (
                <div className="mb-5 rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3" role="status">
                  <p className="text-xs font-bold text-indigo-800">
                    {isRTL
                      ? `أنت تستكشف باقة ${selectedPlanIntent.slug === 'growth' ? 'جروث' : 'أوتوبايلوت'} — $${selectedPlanIntent.priceUsd}/شهر بعد الإطلاق التجاري`
                      : `You’re exploring ${selectedPlanIntent.name} — $${selectedPlanIntent.priceUsd}/month after commercial launch`}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-indigo-700/80">
                    {isRTL
                      ? 'إنشاء الحساب يبدأ بالتجربة المجانية ذات 15 كريديت، ولا يفعّل اشتراكاً أو خصماً. يمكنك مراجعة الباقة لاحقاً من صفحة الفوترة.'
                      : 'Account creation starts with the 15-credit free trial and does not activate a subscription or charge. You can review the plan later from Billing.'}
                  </p>
                </div>
              )}
              {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 mb-6 text-sm font-medium text-red-700">{error}</div>}
              <form onSubmit={handleSubmit} className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
                {/* Name */}
                <div>
                  <label className="block text-sm font-semibold mb-2 text-text-secondary">{authT?.nameLabel}</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder={authT?.namePlaceholder}
                    autoComplete="name" className={inputClass} />
                </div>
                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold mb-2 text-text-secondary">{authT?.emailLabel}</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
                    autoComplete="email" className={inputClass} />
                </div>
                {/* Password */}
                <div>
                  <label className="block text-sm font-semibold mb-2 text-text-secondary">{authT?.passwordLabel}</label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                      placeholder={authT?.passwordPlaceholder} autoComplete="new-password"
                      className={`${inputClass} ${isRTL ? 'pl-11' : 'pr-11'}`} />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      aria-label={showPassword
                        ? (isRTL ? 'إخفاء كلمة المرور' : 'Hide password')
                        : (isRTL ? 'إظهار كلمة المرور' : 'Show password')}
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
                      className={`${inputClass} ${isRTL ? 'pl-11' : 'pr-11'}`} />
                    <button type="button" onClick={() => setShowConfirm(v => !v)}
                      aria-label={showConfirm
                        ? (isRTL ? 'إخفاء تأكيد كلمة المرور' : 'Hide password confirmation')
                        : (isRTL ? 'إظهار تأكيد كلمة المرور' : 'Show password confirmation')}
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
                      <Link href="/terms" target="_blank" className="text-indigo-600 hover:underline">{authT?.termsLink}</Link>
                      <span aria-hidden="true" className="mx-1 text-slate-400">·</span>
                      <Link href="/privacy" target="_blank" className="text-indigo-600 hover:underline">{authT?.privacyLink}</Link>
                      <span aria-hidden="true" className="mx-1 text-slate-400">·</span>
                      <Link href="/refund" target="_blank" className="text-indigo-600 hover:underline">{authT?.refundLink}</Link>
                    </span>
                  </label>
                </div>
                <button type="submit" disabled={loading}
                  className="nx-auth-primary mt-2 w-full py-3 font-bold disabled:opacity-50">
                  {loading ? authT?.loading : authT?.submit}
                </button>
              </form>
            </>
          )}
    </LuxuryAuthShell>
  )

  return pageWrap
}
