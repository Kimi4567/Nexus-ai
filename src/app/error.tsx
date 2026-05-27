'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Global Error]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center px-4">
      <div className="text-center max-w-md">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M7 7L14 21L21 7" stroke="#080807" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M7 7H21" stroke="#080807" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-red-400">
            <circle cx="10" cy="10" r="8.5" />
            <path d="M10 6v4M10 13.5v.5" strokeLinecap="round" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-white mb-3">Something went wrong</h1>
        <p className="text-gray-400 text-sm leading-relaxed mb-8">
          An unexpected error occurred. It's been logged and we'll look into it.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 bg-accent text-dark font-bold rounded-xl hover:bg-accent-light transition text-sm"
          >
            Try Again
          </button>
          <Link
            href="/dashboard"
            className="px-6 py-3 border border-dark-tertiary text-gray-400 font-semibold rounded-xl hover:border-accent/40 hover:text-white transition text-sm"
          >
            Go to Dashboard
          </Link>
        </div>

      </div>
    </div>
  )
}
