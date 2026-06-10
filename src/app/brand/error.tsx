'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Brain, RefreshCw, ArrowLeft } from 'lucide-react'

export default function BrandBrainError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[BrandBrain Error]', error?.message, error?.stack)
  }, [error])

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#06071A' }}
    >
      <div className="text-center max-w-md w-full">

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.25)',
              boxShadow: '0 0 30px rgba(239,68,68,0.1)',
            }}
          >
            <Brain size={28} style={{ color: '#f87171' }} />
          </div>
        </div>

        <h1 className="text-2xl font-black text-white mb-3">
          Brand Brain Error
        </h1>
        <p className="text-sm leading-relaxed mb-8" style={{ color: '#475569' }}>
          Something went wrong loading your brand settings.
          Your data is safe — try refreshing the page.
        </p>

        {/* Error detail — always visible so crashes can be diagnosed */}
        {error?.message && (
          <div
            className="text-left rounded-xl p-4 mb-6 font-mono text-xs"
            style={{
              background: 'rgba(239,68,68,0.06)',
              border: '1px solid rgba(239,68,68,0.2)',
              color: '#fca5a5',
            }}
          >
            {error.message}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all"
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#0a0a0a',
              boxShadow: '0 0 24px rgba(245,158,11,0.2)',
            }}
          >
            <RefreshCw size={14} /> Try Again
          </button>
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: 'rgba(12,13,36,0.6)',
              border: '1px solid rgba(139,92,246,0.2)',
              color: '#64748b',
            }}
          >
            <ArrowLeft size={14} /> Dashboard
          </Link>
        </div>

      </div>
    </div>
  )
}
