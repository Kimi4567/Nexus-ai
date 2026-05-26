'use client'

import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import AppShell from '@/components/AppShell'
import Link from 'next/link'

export default function ImportsPage() {
  const { isAuthenticated, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/auth/login')
  }, [loading, isAuthenticated, router])

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
  if (!isAuthenticated) return null

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-6 py-16 flex flex-col items-center text-center">

        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-6">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent">
            <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M8 12l4 4 4-4M12 4v12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold mb-2">Imports</h1>
        <p className="text-gray-400 max-w-sm mb-8">
          Import assets, captions, and brand materials from third-party sources like Google Drive, Dropbox, and Notion. Coming soon.
        </p>

        {/* Upcoming integrations */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {[
            { name: 'Google Drive', icon: '📁', status: 'Coming soon' },
            { name: 'Dropbox', icon: '📦', status: 'Coming soon' },
            { name: 'Notion', icon: '📝', status: 'Coming soon' },
          ].map(i => (
            <div key={i.name} className="bg-dark-secondary border border-dark-tertiary rounded-xl p-5 flex flex-col items-center gap-2">
              <span className="text-3xl">{i.icon}</span>
              <div className="font-semibold text-sm">{i.name}</div>
              <div className="text-[11px] text-gray-500 bg-dark-tertiary px-2 py-0.5 rounded-full">{i.status}</div>
            </div>
          ))}
        </div>

        <p className="text-sm text-gray-500 mb-4">
          For now, upload assets directly via the{' '}
          <Link href="/media" className="text-accent hover:underline">Media Library</Link>.
        </p>

        <Link href="/media" className="px-5 py-2.5 bg-accent text-dark rounded-lg font-semibold text-sm hover:bg-accent-light transition">
          Go to Media Library
        </Link>

      </div>
    </AppShell>
  )
}
