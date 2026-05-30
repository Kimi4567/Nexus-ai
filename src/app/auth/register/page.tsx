'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import Link from 'next/link'
import { Shield, Cookie } from 'lucide-react'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'

export default function RegisterPage() {
  const { signup } = useAuth()
  const { t, isRTL } = useI18n()
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
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    if (supabaseUrl.includes('placeholder') || !supabaseUrl) {
      setError('⚠️ خدمة التسجيل غير متاحة حالياً. يُرجى المحاولة لاحقاً.')
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
      localStorage.setItem('nexus_consent', JSON.stringify({ terms: true, privacy: true, cookies: true, timestamp: new Date().toISOString(), email }))
      setDone(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('already registered')) setError(errorsT?.emailUsed || 'هذا البريد مستخدم بالفعل')
      else setError(errorsT?.generic || 'فشل إنشاء الحساب. حاول مرة أخرى.')
      setLoading(false)
    }
  }

  const inputStyle = { background: 'rgba(17,21,54,0.6)', border: '1px solid rgba(108,99,255,0.15)' }
  const inputClass = "w-full px-4 py-3 rounded-xl text-white placeholder-text-muted focus:outline-none transition text-right"

  const pageWrap = (
    <div className="min-h-screen bg-bg-base text-white flex items-center justify-center px-4 py-12"
      style={{ backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(108,99,255,0.12), transparent)' }}>
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-4"><LanguageSwitcher /></div>
        <div className="glass-panel p-8 rounded-2xl shadow-2xl">
          <Link href="/" className="flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-lg grid place-items-center font-black text-lg text-white"
              style={{ background: 'linear-gradient(135deg,#6C63FF,#00BFA6)' }}>N</div>
            <span className="text-2xl font-extrabold tracking-wider font-heading text-gradient">NEXUS AI</span>
          </Link>
          {done ? (
            <div className="text-center">
              <div className="text-6xl mb-6">📬</div>
              <h2 className="text-2xl font-bold font-heading mb-3">{authT?.verifyTitle}</h2>
              <p className="text-text-secondary text-sm mb-2">{authT?.verifySent}</p>
              <p className="text-accent-purple font-semibold mb-6">{email}</p>
              <p className="text-text-muted text-sm mb-8">{authT?.verifyCheck}</p>
              <Link href="/auth/login" className="btn-gradient block w-full py-3 text-white font-bold rounded-xl text-center hover:-translate-y-0.5 transition">
                {authT?.verifyCta} →
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold font-heading mb-1">{authT?.title}</h2>
              <p className="text-text-secondary text-sm mb-8">{authT?.subtitle}</p>
              {error && <div className="bg-rose-500/10 border border-rose-500/40 rounded-xl px-4 py-3 mb-6 text-sm text-rose-300">{error}</div>}
              <form onSubmit={handleSubmit} className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
                {[
                  { label: authT?.nameLabel, value: name, set: setName, type: 'text', placeholder: authT?.namePlaceholder, auto: 'name' },
                  { label: authT?.emailLabel, value: email, set: setEmail, type: 'email', placeholder: 'you@example.com', auto: 'email' },
                  { label: authT?.passwordLabel, value: password, set: setPassword, type: 'password', placeholder: authT?.passwordPlaceholder, auto: 'new-password' },
                  { label: authT?.confirmLabel, value: confirmPassword, set: setConfirmPassword, type: 'password', placeholder: authT?.confirmPlaceholder, auto: 'new-password' },
                ].map(f => (
                  <div key={String(f.label)}>
                    <label className="block text-sm font-semibold mb-2 text-text-secondary">{f.label}</label>
                    <input type={f.type} value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                      autoComplete={f.auto} className={inputClass} style={inputStyle}
                      onFocus={e => (e.currentTarget.style.border = '1px solid rgba(108,99,255,0.5)')}
                      onBlur={e => (e.currentTarget.style.border = '1px solid rgba(108,99,255,0.15)')} />
                  </div>
                ))}
                <div className="space-y-3 pt-2">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={agreeTerms} onChange={e => setAgreeTerms(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 accent-violet-500 cursor-pointer shrink-0" />
                    <span className="text-xs text-text-secondary leading-relaxed">
                      <Shield className="w-3 h-3 inline text-accent-purple ml-1" />
                      {authT?.termsConsent}{' '}
                      <Link href="/terms" target="_blank" className="text-accent-purple hover:underline">{authT?.termsLink}</Link>{' '}
                      <Link href="/privacy" target="_blank" className="text-accent-purple hover:underline">{authT?.privacyLink}</Link>{' '}
                      <Link href="/refund" target="_blank" className="text-accent-purple hover:underline">{authT?.refundLink}</Link>
                    </span>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={agreeCookies} onChange={e => setAgreeCookies(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 accent-violet-500 cursor-pointer shrink-0" />
                    <span className="text-xs text-text-secondary leading-relaxed">
                      <Cookie className="w-3 h-3 inline text-accent-purple ml-1" />
                      {authT?.cookieConsent}{' '}
                      <Link href="/cookies" target="_blank" className="text-accent-purple hover:underline">{authT?.cookieLink}</Link>
                    </span>
                  </label>
                </div>
                <button type="submit" disabled={loading}
                  className="btn-gradient w-full py-3 text-white font-bold rounded-xl hover:-translate-y-0.5 transition disabled:opacity-50 mt-2">
                  {loading ? authT?.loading : authT?.submit}
                </button>
              </form>
              <p className="text-center text-sm text-text-secondary mt-4">
                {authT?.hasAccount}{' '}
                <Link href="/auth/login" className="text-accent-purple hover:text-accent-purple/80 transition font-semibold">{authT?.loginLink}</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )

  return pageWrap
}
