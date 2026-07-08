'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n-context'
import supabase from '@/lib/supabaseClient'
import LuxuryAuthShell from '@/components/auth/LuxuryAuthShell'

export default function ForgotPasswordPage() {
  const { t, isRTL, dir } = useI18n()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const fpT = t('auth.forgotPassword')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) { setError(fpT?.errors?.emailRequired || ''); return }
    setLoading(true)
    setError('')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (error) throw error
      setDone(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : (fpT?.errors?.sendFailed || ''))
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = { background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.12)' }
  const inputClass = `w-full rounded-2xl px-4 py-3 text-slate-950 placeholder-slate-400 outline-none transition ${isRTL ? 'text-right' : 'text-left'}`

  if (done) {
    return (
      <LuxuryAuthShell
        dir={dir}
        title={fpT?.successTitle}
        subtitle={<>{fpT?.successDesc} <span className="font-semibold text-slate-950">{email}</span></>}
        eyebrow={isRTL ? 'استرجاع آمن للحساب' : 'Secure account recovery'}
      >
        <div className="text-center">
          <Link
            href="/auth/login"
            className="block w-full rounded-2xl bg-[#071332] py-3 text-center font-bold text-white shadow-[0_16px_32px_rgba(7,19,50,0.20)] transition hover:-translate-y-0.5"
          >
            {fpT?.backToLogin}
          </Link>
        </div>
      </LuxuryAuthShell>
    )
  }

  return (
    <LuxuryAuthShell
      dir={dir}
      title={fpT?.title}
      subtitle={fpT?.subtitle}
      eyebrow={isRTL ? 'استرجاع آمن للحساب' : 'Secure account recovery'}
      footer={
        <p className="text-center text-sm text-slate-600">
          {fpT?.rememberPassword}{' '}
          <Link
            href="/auth/login"
            className="font-semibold text-indigo-600 transition hover:text-indigo-500"
          >
            {fpT?.loginLink}
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
              <label className="block text-sm font-semibold mb-2 text-text-secondary">
                {fpT?.emailLabel}
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className={inputClass}
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.border = '1px solid rgba(139,92,246,0.5)')}
                onBlur={e => (e.currentTarget.style.border = '1px solid rgba(15,23,42,0.12)')}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-[#071332] py-3 font-bold text-white shadow-[0_16px_32px_rgba(7,19,50,0.20)] transition hover:-translate-y-0.5 disabled:opacity-50"
            >
              {loading ? fpT?.loading : fpT?.submit}
            </button>
          </form>
    </LuxuryAuthShell>
  )
}
