'use client'

import { useState, Suspense } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
import { supabase } from '@/lib/supabaseClient'

function LoginForm() {
  const { t, isRTL } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const loginT = t('auth.login')
  const redirectTo = searchParams.get('redirect') || '/dashboard'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('يُرجى تعبئة جميع الحقول'); return }
    setLoading(true)
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) {
        const msg = authError.message || ''
        if (msg.includes('Email not confirmed')) {
          setError('يُرجى تأكيد بريدك الإلكتروني أولاً')
        } else if (msg.includes('Invalid login credentials')) {
          setError('البريد الإلكتروني أو كلمة المرور غير صحيحة')
        } else {
          setError(msg || 'فشل تسجيل الدخول. يُرجى المحاولة مجدداً.')
        }
        setLoading(false)
        return
      }
      // Success — hard reload so Supabase session loads from localStorage
      window.location.href = redirectTo
    } catch {
      setError('حدث خطأ غير متوقع. يُرجى المحاولة مجدداً.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#020204] text-[#f8fafc] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-4">
          <LanguageSwitcher />
        </div>
        <div className="glass p-8 rounded-2xl border border-white/[0.08] shadow-2xl" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)' }}>
          <Link href="/" className="flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 border-2 border-amber-500 rounded-lg grid place-items-center font-black text-amber-500 text-lg">N</div>
            <span className="text-2xl font-extrabold tracking-wider bg-gradient-to-br from-amber-400 via-cyan-400 to-violet-500 bg-clip-text text-transparent">NEXUS AI</span>
          </Link>

          <h2 className="text-2xl font-bold mb-1">{loginT?.title}</h2>
          <p className="text-[#94a3b8] text-sm mb-8">{loginT?.subtitle}</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/40 rounded-xl px-4 py-3 mb-6 text-sm text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
            <div>
              <label className="block text-sm font-semibold mb-2 text-[#94a3b8]">{loginT?.emailLabel}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
                autoComplete="email" className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-[#f8fafc] placeholder-[#64748b] focus:outline-none focus:border-amber-500/50 transition text-right" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-[#94a3b8]">{loginT?.passwordLabel}</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                autoComplete="current-password" className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-[#f8fafc] placeholder-[#64748b] focus:outline-none focus:border-amber-500/50 transition text-right" />
            </div>
            <div className="flex justify-between items-center">
              <label className="flex items-center gap-2 text-sm text-[#94a3b8] cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 accent-amber-500"
                />
                {isRTL ? 'تذكّرني' : 'Remember me'}
              </label>
              <Link href="/auth/forgot-password" className="text-sm text-amber-500 hover:text-amber-400 transition">
                {loginT?.forgotPassword}
              </Link>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-gradient-to-br from-amber-500 to-amber-700 text-black font-bold rounded-xl hover:-translate-y-0.5 transition disabled:opacity-50">
              {loading ? (loginT?.loading || 'Signing in...') : loginT?.submit}
            </button>
          </form>

          <p className="text-center text-sm text-[#94a3b8] mt-4">
            {loginT?.noAccount}{' '}
            <Link href="/auth/register" className="text-amber-500 hover:text-amber-400 transition font-semibold">
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
    <Suspense fallback={<div className="min-h-screen bg-[#020204]" />}>
      <LoginForm />
    </Suspense>
  )
}