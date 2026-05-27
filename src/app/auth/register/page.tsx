'use client'

import { useState, useEffect, Suspense } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

const GOAL_LABELS: Record<string, string> = {
  SALES: 'Sales Campaign', LEADS: 'Lead Generation',
  AWARENESS: 'Brand Awareness', TRAFFIC: 'Traffic', ENGAGEMENT: 'Community Growth',
}

// ── Inner component (needs useSearchParams) ────────────────────────────
function RegisterForm() {
  const { signup } = useAuth()
  const searchParams = useSearchParams()

  // Demo context from query params
  const isFromDemo = searchParams.get('demo') === '1'
  const demoCompany = searchParams.get('business') || ''
  const demoType = searchParams.get('type') || ''
  const demoGoal = searchParams.get('goal') || ''

  const [name, setName] = useState(demoCompany ? `${demoCompany} team` : '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  // Store demo intent in localStorage when arriving from demo
  useEffect(() => {
    if (isFromDemo && demoGoal) {
      // Will be read after email confirmation + login
      try {
        localStorage.setItem('nexus_demo_intent', JSON.stringify({
          company: demoCompany,
          type: demoType,
          goal: demoGoal,
          ts: Date.now(),
        }))
      } catch {}
    }
  }, [isFromDemo, demoCompany, demoType, demoGoal])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim() || !email || !password) { setError('All fields are required'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      await signup(email, password, { name })
      fetch('/api/auth/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      }).catch(() => {})
      setDone(true)
    } catch (err: any) {
      const msg = err?.message || ''
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        setError('An account with this email already exists. Try signing in.')
      } else {
        setError(msg || 'Registration failed. Please try again.')
      }
      setLoading(false)
    }
  }

  // ── Email confirmation sent screen ─────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark via-dark-secondary to-dark-tertiary flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-10 shadow-2xl">
            <div className="text-6xl mb-6">📬</div>
            <h2 className="text-2xl font-bold mb-3">
              {isFromDemo ? 'Your campaign is waiting!' : 'Check your email'}
            </h2>
            <p className="text-gray-400 text-sm mb-2">We sent a confirmation link to</p>
            <p className="text-accent font-semibold mb-4">{email}</p>

            {isFromDemo && demoGoal && (
              <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 mb-6 text-left">
                <div className="text-xs font-bold text-accent uppercase tracking-wider mb-2">Ready to generate</div>
                <div className="text-sm text-gray-200">
                  <strong>{demoCompany}</strong> — {GOAL_LABELS[demoGoal] || demoGoal}
                </div>
                <div className="text-xs text-gray-400 mt-1">Confirm your email and we'll take you straight to your full campaign.</div>
              </div>
            )}

            <p className="text-gray-500 text-sm mb-8">
              Click the link in the email to activate your account. Check your spam folder if you don't see it within a minute.
            </p>
            <Link
              href="/auth/login"
              className="block w-full py-3 bg-accent text-dark font-bold rounded-xl hover:bg-accent-light transition"
            >
              {isFromDemo ? 'Go to Sign In → get my campaign' : 'Go to Sign In'}
            </Link>
            <p className="text-xs text-gray-600 mt-4">
              Wrong email?{' '}
              <button onClick={() => setDone(false)} className="text-accent hover:underline">Go back</button>
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Registration form ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-dark via-dark-secondary to-dark-tertiary flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        {/* Demo context banner */}
        {isFromDemo && demoGoal && (
          <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 mb-4 flex items-start gap-3">
            <span className="text-accent text-lg mt-0.5">✦</span>
            <div>
              <div className="text-sm font-bold text-white mb-0.5">Your full campaign is one step away</div>
              <div className="text-xs text-gray-400">
                Sign up to get the complete {GOAL_LABELS[demoGoal]?.toLowerCase() || 'campaign'} for{' '}
                <strong className="text-gray-200">{demoCompany}</strong> — strategy, 5 concepts, scripts, and 30-day calendar.
              </div>
            </div>
          </div>
        )}

        <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-8 shadow-2xl">
          <Link href="/" className="flex items-center gap-2.5 mb-8">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 28 28" fill="none">
                <path d="M7 7L14 21L21 7" stroke="#080807" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 7H21" stroke="#080807" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
            <span className="font-bold text-white">Nexus AI</span>
          </Link>

          <h2 className="text-2xl font-bold mb-1">
            {isFromDemo ? 'Create your free account' : 'Create your account'}
          </h2>
          <p className="text-gray-400 text-sm mb-8">
            {isFromDemo
              ? '3 campaigns included free — no credit card needed'
              : 'Start free — no credit card required'}
          </p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/40 rounded-xl px-4 py-3 mb-6 text-sm text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
                className="w-full px-4 py-3 bg-dark border border-dark-tertiary rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-accent transition"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full px-4 py-3 bg-dark border border-dark-tertiary rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-accent transition"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                autoComplete="new-password"
                className="w-full px-4 py-3 bg-dark border border-dark-tertiary rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-accent transition"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                className="w-full px-4 py-3 bg-dark border border-dark-tertiary rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-accent transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-accent text-dark font-bold rounded-xl hover:bg-accent-light transition disabled:opacity-50 mt-2"
            >
              {loading
                ? 'Creating account...'
                : isFromDemo
                  ? 'Create account & get my campaign →'
                  : 'Create Account →'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-500 mt-4">
            By signing up you agree to our{' '}
            <Link href="/terms" className="text-gray-400 hover:text-white">Terms</Link>{' & '}
            <Link href="/privacy" className="text-gray-400 hover:text-white">Privacy Policy</Link>
          </p>

          <p className="text-center text-sm text-gray-400 mt-4">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-accent hover:text-accent-light transition font-semibold">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Page wrapper ───────────────────────────────────────────────────────
export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <RegisterForm />
    </Suspense>
  )
}
