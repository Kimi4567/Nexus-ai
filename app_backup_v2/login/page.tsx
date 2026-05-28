'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '../hooks/useAuth'
import { ArrowLeft, Sparkles } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { login } = useAuth()
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const ok = login(email, password)
    if (ok) {
      router.push('/dashboard')
    } else {
      setError('البريد أو كلمة المرور غير صحيحة')
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
          <h1 className="text-2xl font-bold">تسجيل الدخول</h1>
          <p className="text-text-muted text-sm mt-1">رجعنا لك! سجل دخولك للوحة التحكم</p>
        </div>

        <form onSubmit={handleSubmit} className="glass p-6 space-y-4" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

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
          </div>

          <button type="submit" className="w-full btn-primary">
            دخول
            <ArrowLeft className="w-4 h-4" />
          </button>

          <p className="text-center text-sm text-text-muted">
            مش معانا لسه؟{' '}
            <Link href="/register" className="text-amber hover:text-amber-dark transition-colors">
              سجل الآن
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
