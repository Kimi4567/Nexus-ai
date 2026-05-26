'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'

export default function RegisterPage() {
  const { signup } = useAuth()
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
    if (!name.trim() || !email || !password) { setError('All fields are required'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      await signup(email, password, { name })
      // Fire welcome email (non-blocking — never fails registration)
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

  // Email confirmation sent screen
  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark via-dark-secondary to-dark-tertiary flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-10 shadow-2xl">
            <div className="text-6xl mb-6">📬</div>
            <h2 className="text-2xl font-bold mb-3">Check your email</h2>
            <p className="text-gray-400 text-sm mb-2">We sent a confirmation link to</p>
            <p className="text-accent font-semibold mb-6">{email}</p>
            <p className="text-gray-500 text-sm mb-8">
              Click the link in the email to activate your account. Check your spam folder if you don't see it within a minute.
            </p>
            <Link
              href="/auth/login"
              className="block w-full py-3 bg-accent text-dark font-bold rounded-xl hover:bg-accent-light transition"
            >
              Go to Sign In
            </Link>
            <p className="text-xs text-gray-600 mt-4">
              Wrong email?{' '}
              <button onClick={() => setDone(false)} className="text-accent hover:underline">
                Go back
              </button>
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark via-dark-secondary to-dark-tertiary flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-8 shadow-2xl">
          <Link href="/" className="block mb-8">
            <h1 className="text-3xl font-bold text-accent">NEXUS</h1>
          </Link>

          <h2 className="text-2xl font-bold mb-1">Create your account</h2>
          <p className="text-gray-400 text-sm mb-8">Start free — no credit card required</p>

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
              {loading ? 'Creating account...' : 'Create Account →'}
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
