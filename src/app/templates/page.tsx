'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useEffect } from 'react'
import AppShell from '@/components/AppShell'
import Link from 'next/link'

const TEMPLATES = [
  { id: 't1', icon: '⚡', name: 'Product Launch', desc: 'Full launch campaign with hooks, scripts, and 30-day calendar', goal: 'SALES', platforms: ['INSTAGRAM', 'TIKTOK'] },
  { id: 't2', icon: '🎯', name: 'Lead Generation', desc: 'Capture qualified leads with targeted messaging and CTAs', goal: 'LEADS', platforms: ['FACEBOOK', 'LINKEDIN'] },
  { id: 't3', icon: '📣', name: 'Brand Awareness', desc: 'Build visibility and recognition across all platforms', goal: 'AWARENESS', platforms: ['INSTAGRAM', 'YOUTUBE_SHORTS', 'TIKTOK'] },
  { id: 't4', icon: '❤️', name: 'Community Growth', desc: 'Engage your audience and build a loyal community', goal: 'ENGAGEMENT', platforms: ['INSTAGRAM', 'FACEBOOK'] },
  { id: 't5', icon: '🚦', name: 'Traffic Driver', desc: 'Drive targeted website visits and increase conversions', goal: 'TRAFFIC', platforms: ['FACEBOOK', 'LINKEDIN'] },
  { id: 't6', icon: '🛍️', name: 'Flash Sale', desc: 'High-urgency campaign for time-limited offers', goal: 'SALES', platforms: ['INSTAGRAM', 'TIKTOK', 'FACEBOOK'] },
]

export default function TemplatesPage() {
  const { isAuthenticated, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/auth/login')
  }, [loading, isAuthenticated, router])

  if (loading) return <div className="min-h-screen bg-dark flex items-center justify-center"><div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
  if (!isAuthenticated) return null

  const useTemplate = (template: typeof TEMPLATES[0]) => {
    // Pre-fill the campaign wizard via query params
    const params = new URLSearchParams({
      goal: template.goal,
      platforms: template.platforms.join(','),
      template: template.name,
    })
    router.push(`/campaign/new?${params.toString()}`)
  }

  return (
    <AppShell>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-2">Campaign Templates</h1>
          <p className="text-gray-400">Start from a proven template — pre-filled goal, platforms, and strategy.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {TEMPLATES.map(t => (
            <div key={t.id} className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6 hover:border-accent/40 transition group">
              <div className="text-4xl mb-4">{t.icon}</div>
              <h3 className="font-bold text-lg mb-2 group-hover:text-accent transition">{t.name}</h3>
              <p className="text-gray-400 text-sm mb-4 leading-relaxed">{t.desc}</p>
              <div className="flex flex-wrap gap-2 mb-5">
                {t.platforms.map(p => (
                  <span key={p} className="text-xs bg-dark-tertiary px-2 py-1 rounded-full text-gray-400">
                    {p.replace('_', ' ')}
                  </span>
                ))}
              </div>
              <button
                onClick={() => useTemplate(t)}
                className="w-full py-2.5 bg-accent text-dark font-bold rounded-xl hover:bg-accent-light transition text-sm"
              >
                Use Template →
              </button>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link href="/campaign/new" className="text-sm text-gray-400 hover:text-white transition">
            Or start from scratch →
          </Link>
        </div>
      </div>
    </AppShell>
  )
}