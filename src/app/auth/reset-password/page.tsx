'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'
import { supabase } from '@/lib/supabaseClient'
import LuxuryAuthShell from '@/components/auth/LuxuryAuthShell'

type Stage = 'verifying' | 'form' | 'success' | 'expired'

function ResetPasswordForm() {
  const { t, isRTL, dir } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [stage, setStage] = useState<Stage>('verifying')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const rpT = t('auth.resetPassword') as Record<string, any>

  // ── On mount: exchange PKCE code for a session ───────────────────────────
  useEffect(() => {
    const code = searchParams.get('code')
    const errorCode = searchParams.get('error_code') || searchParams.get('error')

    if (errorCode) {
      setStage('expired')
      return
    }

    if (code) {
      supabase.auth.exchangeCodeForSession(code)
        .then(({ error }) => {
          if (error) {
            console.error('[reset-password] exchangeCodeForSession error:', error.message)
            setStage('expired')
          } else {
            setStage('form')
          }
        })
      return
    }

    // Implicit flow — detectSessionInUrl handles hash tokens automatically.
    // Wait briefly to let the Supabase client parse the URL hash.
    const timer = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setStage('form')
      } else {
        setStage('expired')
      }
    }, 800)

    return () => clearTimeout(timer)
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!password.trim()) { setError(rpT?.errors?.passwordRequired || ''); return }
    if (password.length < 8) { setError(rpT?.errors?.passwordLength || ''); return }
    if (password !== confirm) { setError(rpT?.errors?.passwordMatch || ''); return }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setStage('success')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : (rpT?.errors?.updateFailed || ''))
    } finally {
      setLoading(false)
    }
  }

  const inputClass = `nx-auth-input w-full px-4 py-3 placeholder-slate-400 ${isRTL ? 'text-right' : 'text-left'}`

  const wrap = (children: React.ReactNode, title?: React.ReactNode, subtitle?: React.ReactNode) => (
    <LuxuryAuthShell
      dir={dir}
      title={title ?? rpT?.title}
      subtitle={subtitle ?? rpT?.subtitle}
      eyebrow={isRTL ? 'تعيين كلمة مرور آمن' : 'Secure password reset'}
    >
      {children}
    </LuxuryAuthShell>
  )

  // ── Verifying ────────────────────────────────────────────────────────────
  if (stage === 'verifying') {
    return wrap(
      <div className="text-center py-8">
        <div className="w-10 h-10 border-2 border-accent-purple border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-600 text-sm">{rpT?.verifyingTitle || 'Verifying...'}</p>
      </div>,
      rpT?.verifyingTitle || (isRTL ? 'جاري التحقق' : 'Verifying reset link'),
      isRTL ? 'نتحقق من رابط إعادة التعيين قبل عرض النموذج.' : 'We are checking the reset link before showing the password form.'
    )
  }

  // ── Link expired ─────────────────────────────────────────────────────────
  if (stage === 'expired') {
    return wrap(
      <div className="text-center">
        <Link
          href="/auth/forgot-password"
          className="nx-auth-primary block w-full py-3 text-center font-bold"
        >
          {rpT?.requestNew}
        </Link>
      </div>,
      rpT?.expiredTitle,
      rpT?.expiredDesc
    )
  }

  // ── Success ──────────────────────────────────────────────────────────────
  if (stage === 'success') {
    return wrap(
      <div className="text-center">
        <button
          onClick={() => router.push('/auth/login')}
          className="nx-auth-primary block w-full py-3 text-center font-bold"
        >
          {rpT?.backToLogin}
        </button>
      </div>,
      rpT?.successTitle,
      rpT?.successDesc
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────────
  return wrap(
    <>
      {error && (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* New password */}
        <div>
          <label className="block text-sm font-semibold mb-2 text-text-secondary">
            {rpT?.passwordLabel}
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={rpT?.passwordPlaceholder || '••••••••'}
              autoComplete="new-password"
              className={`${inputClass} ${isRTL ? 'pl-11' : 'pr-11'}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className={`absolute inset-y-0 ${isRTL ? 'left-3' : 'right-3'} flex items-center text-slate-400 hover:text-slate-950 transition`}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Confirm password */}
        <div>
          <label className="block text-sm font-semibold mb-2 text-text-secondary">
            {rpT?.confirmLabel}
          </label>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder={rpT?.confirmPlaceholder || '••••••••'}
              autoComplete="new-password"
              className={`${inputClass} ${isRTL ? 'pl-11' : 'pr-11'}`}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(v => !v)}
              className={`absolute inset-y-0 ${isRTL ? 'left-3' : 'right-3'} flex items-center text-slate-400 hover:text-slate-950 transition`}
              tabIndex={-1}
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="nx-auth-primary w-full py-3 font-bold disabled:opacity-50"
        >
          {loading ? rpT?.loading : rpT?.submit}
        </button>
      </form>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-base" />}>
      <ResetPasswordForm />
    </Suspense>
  )
}
