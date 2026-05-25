'use client'

import { useState } from 'react'
import Link from 'next/link'
import supabase from '@/lib/supabaseClient'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) { setError('Please enter your email address'); return }

    setLoading(true)
    setError('')

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (error) throw error
      setDone(true)
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark via-dark-secondary to-dark-tertiary flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="text-5xl mb-4">📬</div>
          <h1 className="text-2xl font-bold mb-2">Check your email</h1>
          <p className="text-gray-400 mb-6">
            We sent a password reset link to <span className="text-white font-semibold">{email}</span>.
            Check your inbox and follow the instructions.
          </p>
          <Link href="/auth/login" className="text-accent hover:text-accent-light transition text-sm">
            ← Back to login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark via-dark-secondary to-dark-tertiary flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-black text-accent tracking-wider">NEXUS</Link>
          <p className="text-gray-400 mt-2 text-sm">AI Marketing Operating System</p>
        </div>

        <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-8">
          <h1 className="text-2xl font-bold mb-1">Reset your password</h1>
          <p className="text-gray-400 text-sm mb-6">
            Enter your email and we'll send you a link to reset your password.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 bg-dark border border-dark-tertiary rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent transition"
                autoFocus
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-accent text-dark font-bold rounded-lg hover:bg-accent-light transition disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-500 text-sm mt-6">
          Remember your password?{' '}
          <Link href="/auth/login" className="text-accent hover:text-accent-light transition">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
