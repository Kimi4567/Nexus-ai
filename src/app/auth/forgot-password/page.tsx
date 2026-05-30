'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n-context'
import supabase from '@/lib/supabaseClient'

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

  const inputStyle = { background: 'rgba(17,21,54,0.6)', border: '1px solid rgba(108,99,255,0.15)' }

  if (done) {
    return (
      <div
        className="min-h-screen bg-bg-base text-white flex items-center justify-center px-4"
        dir={dir}
        style={{ backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(108,99,255,0.12), transparent)' }}
      >
        <div className="w-full max-w-md text-center glass-panel p-10 rounded-2xl shadow-2xl">
          <div className="text-5xl mb-4">📬</div>
          <h1 className="text-2xl font-bold font-heading mb-2">{fpT?.successTitle}</h1>
          <p className="text-text-secondary mb-6">
            {fpT?.successDesc}{' '}
            <span className="text-white font-semibold">{email}</span>
          </p>
          <Link
            href="/auth/login"
            className="btn-gradient block w-full py-3 text-white font-bold rounded-xl text-center hover:-translate-y-0.5 transition"
          >
            {fpT?.backToLogin}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-bg-base text-white flex items-center justify-center px-4"
      dir={dir}
      style={{ backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(108,99,255,0.12), transparent)' }}
    >
      <div className="w-full max-w-md">
        <div className="glass-panel p-8 rounded-2xl shadow-2xl">
          <Link href="/" className="flex items-center gap-2.5 mb-8">
            <div
              className="w-9 h-9 rounded-lg grid place-items-center font-black text-lg text-white"
              style={{ background: 'linear-gradient(135deg,#6C63FF,#00BFA6)' }}
            >
              N
            </div>
            <span className="text-2xl font-extrabold tracking-wider font-heading text-gradient">NEXUS AI</span>
          </Link>

          <h2 className="text-2xl font-bold font-heading mb-1">{fpT?.title}</h2>
          <p className="text-text-secondary text-sm mb-8">{fpT?.subtitle}</p>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/40 rounded-xl px-4 py-3 mb-6 text-sm text-rose-300">
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
                className="w-full px-4 py-3 rounded-xl text-white placeholder-text-muted focus:outline-none transition"
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.border = '1px solid rgba(108,99,255,0.5)')}
                onBlur={e => (e.currentTarget.style.border = '1px solid rgba(108,99,255,0.15)')}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-gradient w-full py-3 text-white font-bold rounded-xl hover:-translate-y-0.5 transition disabled:opacity-50"
            >
              {loading ? fpT?.loading : fpT?.submit}
            </button>
          </form>

          <p className="text-center text-sm text-text-secondary mt-4">
            {fpT?.rememberPassword}{' '}
            <Link
              href="/auth/login"
              className="text-accent-purple hover:text-accent-purple/80 transition font-semibold"
            >
              {fpT?.loginLink}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
