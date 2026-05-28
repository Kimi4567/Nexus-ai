'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '../hooks/useAuth'
import { ArrowLeft, Sparkles } from 'lucide-react'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { register } = useAuth()
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('كلمة المرور لازم 8 أحرف على الأقل')
      return
    }
    const ok = register(name, email, password)
    if (ok) {
      router.push('/dashboard')
    } else {
      setError('حدث خطأ، جرب تاني')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#020204' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-2xl font-bold gradient-text mb-4">
            <Sparkles className="w-7 h-7 text-amber" />
            NEXUS AI
          </Link>
          <h1 className="text-2xl font-bold">إنشاء حساب</h1>
          <p className="text-text-muted text-sm mt-1">ابدأ رحلتك مع NEXUS AI مجاناً</p>
        </div>

        <form onSubmit={handleSubmit} className="glass p-6 space-y-4" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5">الاسم</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="محمد أحمد"
              className="input-nexus"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">البريد الإلكتروني</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="input-nexus"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input-nexus"
              required
            />
            <p className="text-xs text-text-muted mt-1">8 أحرف على الأقل</p>
          </div>

          <button type="submit" className="w-full btn-primary">
            إنشاء الحساب
            <ArrowLeft className="w-4 h-4" />
          </button>

          <p className="text-center text-sm text-text-muted">
            عندك حساب؟{' '}
            <Link href="/login" className="text-amber hover:text-amber-dark transition-colors">
              سجل دخول
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
