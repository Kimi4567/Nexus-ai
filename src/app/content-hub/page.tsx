'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import AppShell from '@/components/AppShell'
import { LayoutGrid, Loader2, ArrowRight, Image, CheckCircle2, Clock, AlertCircle, Plus } from 'lucide-react'

interface CampaignHub {
  id: string
  name: string
  platforms: string[]
  totalPosts: number
  donePosts: number
  pendingPosts: number
  failedPosts: number
  createdAt: string
}

export default function ContentHubPage() {
  const router = useRouter()
  const { authHeader, isAuthenticated, loading: authLoading } = useAuth()
  const { locale } = useI18n()

  const [campaigns, setCampaigns] = useState<CampaignHub[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isAr = locale === 'ar'

  const loadCampaigns = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      // Load all campaigns
      const res = await fetch('/api/campaigns', { headers: { Authorization: authHeader() } })
      if (!res.ok) throw new Error('Failed to load campaigns')
      const { campaigns: raw } = await res.json()

      // For each campaign, load its content plan summary
      const hubs: CampaignHub[] = await Promise.all(
        (raw ?? []).map(async (c: any) => {
          try {
            const pr = await fetch(`/api/campaigns/${c.id}/content-plan`, {
              headers: { Authorization: authHeader() },
            })
            if (!pr.ok) return { ...c, totalPosts: 0, donePosts: 0, pendingPosts: 0, failedPosts: 0 }
            const { posts } = await pr.json()
            const total = posts?.length ?? 0
            const done = posts?.filter((p: any) => p.generationStatus === 'DONE').length ?? 0
            const failed = posts?.filter((p: any) => p.generationStatus === 'FAILED').length ?? 0
            const pending = total - done - failed
            return {
              id: c.id,
              name: c.name,
              platforms: c.platforms ?? [],
              totalPosts: total,
              donePosts: done,
              pendingPosts: pending,
              failedPosts: failed,
              createdAt: c.createdAt,
            }
          } catch {
            return {
              id: c.id,
              name: c.name,
              platforms: c.platforms ?? [],
              totalPosts: 0,
              donePosts: 0,
              pendingPosts: 0,
              failedPosts: 0,
              createdAt: c.createdAt,
            }
          }
        })
      )

      setCampaigns(hubs)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [authHeader, isAuthenticated])

  useEffect(() => {
    if (!authLoading && isAuthenticated) loadCampaigns()
  }, [authLoading, isAuthenticated, loadCampaigns])

  const StatusBadge = ({ done, total, pending, failed }: { done: number; total: number; pending: number; failed: number }) => {
    if (total === 0) return (
      <span className="text-xs px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(15,23,42,0.05)', color: '#6b7280', border: '1px solid rgba(15,23,42,0.08)' }}>
        {isAr ? 'لا يوجد محتوى' : 'No content yet'}
      </span>
    )
    if (done === total) return (
      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
        <CheckCircle2 className="w-3 h-3" />
        {isAr ? 'مكتمل' : 'Complete'}
      </span>
    )
    if (pending > 0) return (
      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(94,92,230,0.1)', color: '#5E5CE6', border: '1px solid rgba(94,92,230,0.2)' }}>
        <Clock className="w-3 h-3" />
        {done}/{total} {isAr ? 'مكتمل' : 'done'}
      </span>
    )
    if (failed > 0) return (
      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(239,68,68,0.1)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.2)' }}>
        <AlertCircle className="w-3 h-3" />
        {isAr ? 'فشل بعض' : 'Some failed'}
      </span>
    )
    return null
  }

  return (
    <AppShell>
      <div className="relative min-h-screen">
        <div className="absolute inset-0 nx-bg-grid pointer-events-none opacity-20" />
        <div className="relative max-w-6xl mx-auto px-4 py-10">

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <LayoutGrid className="w-4 h-4 text-violet-400" />
                <span className="text-xs text-violet-400/70 font-mono tracking-wider">CONTENT HUB</span>
              </div>
              <h1 className="text-2xl font-bold">
                {isAr ? 'مركز المحتوى' : 'Content Hub'}
              </h1>
              <p className="text-text-muted text-sm mt-0.5">
                {isAr
                  ? 'كل خطط المحتوى الشهرية في مكان واحد'
                  : 'All your monthly content plans in one place'}
              </p>
            </div>
            <Link href="/campaigns/new"
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg,#5E5CE6,#6366f1)', color: 'white', boxShadow: '0 4px 15px rgba(94,92,230,0.3)' }}>
              <Plus className="w-4 h-4" />
              {isAr ? 'خطة جديدة' : 'New Content Plan'}
            </Link>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 rounded-xl text-red-400 text-sm"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </div>
          )}

          {/* Empty */}
          {!loading && !error && campaigns.length === 0 && (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(94,92,230,0.1)', border: '1px solid rgba(94,92,230,0.2)' }}>
                <Image className="w-8 h-8 text-violet-400" />
              </div>
              <h3 className="font-bold text-lg mb-1">{isAr ? 'لا يوجد كامبينات بعد' : 'No campaigns yet'}</h3>
              <p className="text-text-muted text-sm mb-6">
                {isAr ? 'أنشئ أول كامبين وابدأ في بناء المحتوى' : 'Create your first campaign to start building content'}
              </p>
              <Link href="/campaigns/new"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm"
                style={{ background: 'linear-gradient(135deg,#5E5CE6,#6366f1)', color: 'white' }}>
                <Plus className="w-4 h-4" />
                {isAr ? 'أنشئ كامبين' : 'Create Campaign'}
              </Link>
            </div>
          )}

          {/* Campaign Grid */}
          {!loading && campaigns.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {campaigns.map((c) => {
                const pct = c.totalPosts > 0 ? Math.round((c.donePosts / c.totalPosts) * 100) : 0
                return (
                  <button key={c.id}
                    onClick={() => router.push(`/campaigns/${c.id}/content-hub`)}
                    className="text-left rounded-2xl p-5 transition-all hover:scale-[1.01] group"
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid rgba(15,23,42,0.08)',
                      boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
                    }}>
                    {/* Top row */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0 mr-2">
                        <p className="font-bold text-sm truncate" style={{ color: 'var(--nx-text-1)' }}>{c.name}</p>
                        <p className="text-xs text-text-muted mt-0.5">
                          {c.platforms.slice(0, 3).join(' · ')}
                          {c.platforms.length > 3 && ` +${c.platforms.length - 3}`}
                        </p>
                      </div>
                      <StatusBadge done={c.donePosts} total={c.totalPosts} pending={c.pendingPosts} failed={c.failedPosts} />
                    </div>

                    {/* Progress bar */}
                    {c.totalPosts > 0 && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                          <span>{isAr ? 'الصور المولّدة' : 'Images generated'}</span>
                          <span>{c.donePosts}/{c.totalPosts}</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden"
                          style={{ background: 'rgba(15,23,42,0.08)' }}>
                          <div className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              background: pct === 100
                                ? 'linear-gradient(90deg,#10b981,#059669)'
                                : 'linear-gradient(90deg,#5E5CE6,#6366f1)',
                            }} />
                        </div>
                      </div>
                    )}

                    {/* Stats row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-text-muted">
                        {c.totalPosts > 0 ? (
                          <>
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              {c.donePosts}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-violet-400" />
                              {c.pendingPosts}
                            </span>
                            {c.failedPosts > 0 && (
                              <span className="flex items-center gap-1">
                                <AlertCircle className="w-3 h-3 text-red-400" />
                                {c.failedPosts}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="font-medium" style={{ color: '#5E5CE6' }}>
                            {isAr ? 'اضغط لإنشاء المحتوى' : 'Click to generate content'}
                          </span>
                        )}
                      </div>
                      <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-violet-400 transition-colors" />
                    </div>
                  </button>
                )
              })}
            </div>
          )}

        </div>
      </div>
    </AppShell>
  )
}
