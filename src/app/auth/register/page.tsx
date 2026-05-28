'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const { signup } = useAuth()
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim() || !email || !password) { setError('جميع الحقول مطلوبة'); return }
    if (password.length < 8) { setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل'); return }
    if (password !== confirmPassword) { setError('كلمتا المرور غير متطابقتين'); return }
    setLoading(true)
    try {
      await signup(email, password, { name })
      setDone(true)
    } catch (err: any) {
      const msg = err?.message || ''
      if (msg.includes('already registered')) {
        setError('هذا البريد الإلكتروني مستخدم بالفعل. جرب تسجيل الدخول.')
      } else {
        setError(msg || 'فشل إنشاء الحساب. حاول مرة أخرى.')
      }
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#020204] text-[#f8fafc] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="glass p-10 rounded-2xl border border-white/[0.08] shadow-2xl">
            <div className="text-6xl mb-6">📬</div>
            <h2 className="text-2xl font-bold mb-3">تحقق من بريدك الإلكتروني</h2>
            <p className="text-[#94a3b8] text-sm mb-2">أرسلنا رابط تأكيد إلى</p>
            <p className="text-amber-500 font-semibold mb-6">{email}</p>
            <p className="text-[#64748b] text-sm mb-8">
              انقر على الرابط في البريد لتفعيل حسابك. تحقق من مجلد Spam لو لم تجده خلال دقيقة.
            </p>
            <Link
              href="/auth/login"
              className="block w-full py-3 bg-gradient-to-br from-amber-500 to-amber-700 text-black font-bold rounded-xl hover:-translate-y-0.5 transition"
            >
              الانتقال لتسجيل الدخول →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#020204] text-[#f8fafc] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="glass p-8 rounded-2xl border border-white/[0.08] shadow-2xl">
          <Link href="/" className="flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 border-2 border-amber-500 rounded-lg grid place-items-center font-black text-amber-500 text-lg">N</div>
            <span className="text-2xl font-extrabold tracking-wider bg-gradient-to-br from-amber-400 via-cyan-400 to-violet-500 bg-clip-text text-transparent">NEXUS AI</span>
          </Link>

          <h2 className="text-2xl font-bold mb-1">إنشاء حساب جديد</h2>
          <p className="text-[#94a3b8] text-sm mb-8">ابدأ مجاناً — لا بطاقة ائتمان مطلوبة</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/40 rounded-xl px-4 py-3 mb-6 text-sm text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2 text-[#94a3b8]">الاسم الكامل</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="محمد أحمد"
                autoComplete="name"
                className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-[#f8fafc] placeholder-[#64748b] focus:outline-none focus:border-amber-500/50 transition text-right"
              />
            </div>

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
              <label className="block text-sm font-semibold mb-2 text-[#94a3b8]">كلمة المرور</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="8 أحرف على الأقل"
                autoComplete="new-password"
                className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-[#f8fafc] placeholder-[#64748b] focus:outline-none focus:border-amber-500/50 transition text-right"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2 text-[#94a3b8]">تأكيد كلمة المرور</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-[#f8fafc] placeholder-[#64748b] focus:outline-none focus:border-amber-500/50 transition text-right"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-br from-amber-500 to-amber-700 text-black font-bold rounded-xl hover:-translate-y-0.5 transition disabled:opacity-50 mt-2"
            >
              {loading ? 'جاري إنشاء الحساب...' : 'إنشاء حساب →'}
            </button>
          </form>

          <p className="text-center text-xs text-[#64748b] mt-4">
            بالتسجيل فإنك توافق على{' '}
            <Link href="/terms" className="text-[#94a3b8] hover:text-[#f8fafc]">الشروط</Link>
            {' و'}
            <Link href="/privacy" className="text-[#94a3b8] hover:text-[#f8fafc]">سياسة الخصوصية</Link>
          </p>

          <p className="text-center text-sm text-[#94a3b8] mt-4">
            لديك حساب بالفعل؟{' '}
            <Link href="/auth/login" className="text-amber-500 hover:text-amber-400 transition font-semibold">
              سجّل دخولك
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
