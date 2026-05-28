'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('يرجى إدخال البريد الإلكتروني وكلمة المرور'); return }
    setLoading(true)
    try {
      await login(email, password)
    } catch (err: any) {
      const msg = err?.message || ''
      if (msg.includes('Email not confirmed')) {
        setError('يرجى التحقق من بريدك الإلكتروني والنقر على رابط التأكيد أولاً.')
      } else if (msg.includes('Invalid login credentials')) {
        setError('البريد الإلكتروني أو كلمة المرور غير صحيحة.')
      } else {
        setError(msg || 'فشل تسجيل الدخول. حاول مرة أخرى.')
      }
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#020204] text-[#f8fafc] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="glass p-8 rounded-2xl border border-white/[0.08] shadow-2xl">
          <Link href="/" className="flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 border-2 border-amber-500 rounded-lg grid place-items-center font-black text-amber-500 text-lg">N</div>
            <span className="text-2xl font-extrabold tracking-wider bg-gradient-to-br from-amber-400 via-cyan-400 to-violet-500 bg-clip-text text-transparent">NEXUS AI</span>
          </Link>

          <h2 className="text-2xl font-bold mb-1">تسجيل الدخول</h2>
          <p className="text-[#94a3b8] text-sm mb-8">أهلاً بعودتك — سجّل دخولك للوصول إلى لوحة التحكم</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/40 rounded-xl px-4 py-3 mb-6 text-sm text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2 text-[#94a3b8]">البريد الإلكتروني</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-[#f8fafc] placeholder-[#64748b] focus:outline-none focus:border-amber-500/50 transition text-right"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-semibold text-[#94a3b8]">كلمة المرور</label>
                <Link href="/auth/forgot-password" className="text-xs text-[#64748b] hover:text-amber-500 transition">
                  نسيت كلمة المرور؟
                </Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-[#f8fafc] placeholder-[#64748b] focus:outline-none focus:border-amber-500/50 transition text-right"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-br from-amber-500 to-amber-700 text-black font-bold rounded-xl hover:-translate-y-0.5 transition disabled:opacity-50 mt-2"
            >
              {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول →'}
            </button>
          </form>

          <p className="text-center text-sm text-[#94a3b8] mt-6">
            ليس لديك حساب؟{' '}
            <Link href="/auth/register" className="text-amber-500 hover:text-amber-400 transition font-semibold">
              أنشئ حساب مجاني
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
