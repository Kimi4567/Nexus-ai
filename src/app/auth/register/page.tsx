'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Shield, Cookie } from 'lucide-react'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'

export default function RegisterPage() {
  const { signup } = useAuth()
  const { t, isRTL } = useI18n()
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreeCookies, setAgreeCookies] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const authT = t('auth.register')
  const errorsT = authT?.errors || {}

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    // Check if Supabase is configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    if (supabaseUrl.includes('placeholder') || !supabaseUrl) {
      setError('⚠️ خدمة التسجيل غير متاحة حالياً. فريقنا يعمل على تفعيلها. يُرجى المحاولة لاحقاً.')
      return
    }
    
    if (!name.trim() || !email || !password) { setError(errorsT?.allFields || 'جميع الحقول مطلوبة'); return }
    if (password.length < 8) { setError(errorsT?.passwordLength || 'يجب أن تكون كلمة المرور ٨ أحرف على الأقل'); return }
    if (password !== confirmPassword) { setError(errorsT?.passwordMatch || 'كلمتا المرور غير متطابقتين'); return }
    if (!agreeTerms) { setError(errorsT?.termsRequired || 'يجب الموافقة على الشروط'); return }
    if (!agreeCookies) { setError(errorsT?.cookiesRequired || 'يجب الموافقة على الكوكيز'); return }
    setLoading(true)
    try {
      await signup(email, password, { name })
      localStorage.setItem('nexus_consent', JSON.stringify({
        terms: true, privacy: true, cookies: true,
        timestamp: new Date().toISOString(), email,
      }))
      setDone(true)
    } catch (err: any) {
      const msg = err?.message || ''
      if (msg.includes('already registered')) {
        setError(errorsT?.emailUsed || 'هذا البريد مستخدم بالفعل')
      } else if (msg.includes('Invalid login credentials')) {
        setError('بيانات الدخول غير صحيحة')
      } else {
        setError(errorsT?.generic || 'فشل إنشاء الحساب. حاول مرة أخرى.')
      }
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#020204] text-[#f8fafc] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="glass p-10 rounded-2xl border border-white/[0.08] shadow-2xl" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)' }}>
            <div className="text-6xl mb-6">📬</div>
            <h2 className="text-2xl font-bold mb-3">{authT.verifyTitle}</h2>
            <p className="text-[#94a3b8] text-sm mb-2">{authT.verifySent}</p>
            <p className="text-amber-500 font-semibold mb-6">{email}</p>
            <p className="text-[#64748b] text-sm mb-8">{authT.verifyCheck}</p>
            <Link href="/auth/login" className="block w-full py-3 bg-gradient-to-br from-amber-500 to-amber-700 text-black font-bold rounded-xl hover:-translate-y-0.5 transition">
              {authT.verifyCta} →
            </Link>
          </div>
        </div>
      </div>
    )
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

          <h2 className="text-2xl font-bold mb-1">{authT.title}</h2>
          <p className="text-[#94a3b8] text-sm mb-8">{authT.subtitle}</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/40 rounded-xl px-4 py-3 mb-6 text-sm text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
            <div>
              <label className="block text-sm font-semibold mb-2 text-[#94a3b8]">{authT.nameLabel}</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder={authT.namePlaceholder}
                autoComplete="name" className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-[#f8fafc] placeholder-[#64748b] focus:outline-none focus:border-amber-500/50 transition text-right" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-[#94a3b8]">{authT.emailLabel}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
                autoComplete="email" className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-[#f8fafc] placeholder-[#64748b] focus:outline-none focus:border-amber-500/50 transition text-right" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-[#94a3b8]">{authT.passwordLabel}</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={authT.passwordPlaceholder}
                autoComplete="new-password" className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-[#f8fafc] placeholder-[#64748b] focus:outline-none focus:border-amber-500/50 transition text-right" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-[#94a3b8]">{authT.confirmLabel}</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder={authT.confirmPlaceholder}
                autoComplete="new-password" className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-[#f8fafc] placeholder-[#64748b] focus:outline-none focus:border-amber-500/50 transition text-right" />
            </div>

            {/* Consent Checkboxes */}
            <div className="space-y-3 pt-2">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input type="checkbox" checked={agreeTerms} onChange={e => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 accent-amber-500 cursor-pointer shrink-0" />
                <span className="text-xs text-[#94a3b8] leading-relaxed">
                  <Shield className="w-3 h-3 inline text-amber-500 ml-1" />
                  {authT.termsConsent}{' '}
                  <Link href="/terms" target="_blank" className="text-amber-500 hover:text-amber-400 underline">{authT.termsLink}</Link>
                  {' '}
                  <Link href="/privacy" target="_blank" className="text-amber-500 hover:text-amber-400 underline">{authT.privacyLink}</Link>
                  {' '}
                  <Link href="/refund" target="_blank" className="text-amber-500 hover:text-amber-400 underline">{authT.refundLink}</Link>
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer group">
                <input type="checkbox" checked={agreeCookies} onChange={e => setAgreeCookies(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 accent-amber-500 cursor-pointer shrink-0" />
                <span className="text-xs text-[#94a3b8] leading-relaxed">
                  <Cookie className="w-3 h-3 inline text-amber-500 ml-1" />
                  {authT.cookieConsent}{' '}
                  <Link href="/cookies" target="_blank" className="text-amber-500 hover:text-amber-400 underline">{authT.cookieLink}</Link>
                </span>
              </label>
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3 bg-gradient-to-br from-amber-500 to-amber-700 text-black font-bold rounded-xl hover:-translate-y-0.5 transition disabled:opacity-50 mt-2">
              {loading ? authT.loading : authT.submit}
            </button>
          </form>

          <p className="text-center text-sm text-[#94a3b8] mt-4">
            {authT.hasAccount}{' '}
            <Link href="/auth/login" className="text-amber-500 hover:text-amber-400 transition font-semibold">{authT.loginLink}</Link>
          </p>
        </div>
      </div>
    </div>
  )
}