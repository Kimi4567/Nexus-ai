'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'
import { supabase } from '@/lib/supabaseClient'

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

  const inputStyle = {
    background: '#FFFFFF',
    border: '1px solid rgba(15,23,42,0.12)',
  }

  const wrap = (children: React.ReactNode) => (
    <div
      className="min-h-screen bg-bg-base text-slate-950 flex items-center justify-center px-4"
      dir={dir}
      style={{
        backgroundImage:
          'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(139,92,246,0.12), transparent)',
      }}
    >
      <div className="w-full max-w-md">
        <div className="glass-panel p-8 rounded-2xl shadow-2xl">
          <Link href="/" className="flex items-center gap-2.5 mb-8">
            <div
              className="w-9 h-9 rounded-lg grid place-items-center font-black text-lg text-white"
              style={{ background: 'linear-gradient(135deg,#8B5CF6,#10B981)' }}
            >
              N
            </div>
            <span className="text-2xl font-extrabold tracking-wider font-heading text-gradient">
              NEXUS AI
            </span>
          </Link>
          {children}
        </div>
      </div>
    </div>
  )

  // ── Verifying ────────────────────────────────────────────────────────────
  if (stage === 'verifying') {
    return wrap(
      <div className="text-center py-8">
        <div className="w-10 h-10 border-2 border-accent-purple border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-text-secondary text-sm">{rpT?.verifyingTitle || 'Verifying…'}</p>
      </div>
    )
  }

  // ── Link expired ─────────────────────────────────────────────────────────
  if (stage === 'expired') {
    return wrap(
      <div className="text-center">
        <div className="text-5xl mb-4">⏰</div>
        <h2 className="text-2xl font-bold font-heading mb-3">{rpT?.expiredTitle}</h2>
        <p className="text-text-secondary text-sm mb-6">{rpT?.expiredDesc}</p>
        <Link
          href="/auth/forgot-password"
          className="btn-gradient block w-full py-3 text-white font-bold rounded-xl text-center hover:-translate-y-0.5 transition"
        >
          {rpT?.requestNew}
        </Link>
      </div>
    )
  }

  // ── Success ──────────────────────────────────────────────────────────────
  if (stage === 'success') {
    return wrap(
      <div className="text-center">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-2xl font-bold font-heading mb-3">{rpT?.successTitle}</h2>
        <p className="text-text-secondary text-sm mb-6">{rpT?.successDesc}</p>
        <button
          onClick={() => router.push('/auth/login')}
          className="btn-gradient block w-full py-3 text-white font-bold rounded-xl text-center hover:-translate-y-0.5 transition"
        >
          {rpT?.backToLogin}
        </button>
      </div>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────────
  return wrap(
    <>
      <h2 className="text-2xl font-bold font-heading mb-1">{rpT?.title}</h2>
      <p className="text-text-secondary text-sm mb-8">{rpT?.subtitle}</p>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/40 rounded-xl px-4 py-3 mb-6 text-sm text-rose-300">
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
              className="w-full px-4 py-3 rounded-xl text-slate-950 placeholder-slate-400 focus:outline-none transition pr-11"
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.border = '1px solid rgba(139,92,246,0.5)')}
              onBlur={e => (e.currentTarget.style.border = '1px solid rgba(139,92,246,0.15)')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute inset-y-0 right-3 flex items-center text-text-muted hover:text-slate-700 transition"
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
              className="w-full px-4 py-3 rounded-xl text-slate-950 placeholder-slate-400 focus:outline-none transition pr-11"
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.border = '1px solid rgba(139,92,246,0.5)')}
              onBlur={e => (e.currentTarget.style.border = '1px solid rgba(139,92,246,0.15)')}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(v => !v)}
              className="absolute inset-y-0 right-3 flex items-center text-text-muted hover:text-slate-700 transition"
              tabIndex={-1}
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-gradient w-full py-3 text-white font-bold rounded-xl hover:-translate-y-0.5 transition disabled:opacity-50"
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
