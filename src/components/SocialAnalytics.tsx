/**
 * SocialAnalytics — Real post performance from Meta Insights API.
 *
 * Shows campaign-level totals (reach, impressions, engagement)
 * + per-post breakdown pulled live from Meta Graph API.
 *
 * Sprint S
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { Loader2, RefreshCw, TrendingUp, Eye, Users, MousePointer, ExternalLink, AlertCircle } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PostInsights {
  impressions: number
  reach: number
  engagement: number
  clicks: number
}

interface PostData {
  id: string
  platform: string
  pageName: string | null
  caption: string
  imageUrl: string | null
  platformUrl: string | null
  publishedAt: string | null
  insights: PostInsights | null
  insightsError?: string
}

interface Totals {
  impressions: number
  reach: number
  engagement: number
  clicks: number
  posts: number
}

interface SocialAnalyticsProps {
  campaignId: string
}

// ─── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({ icon, label, value, color }: {
  icon: React.ReactNode
  label: string
  value: number
  color: string
}) {
  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm ${color}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <p className="text-xs font-medium text-slate-500">{label}</p>
      </div>
      <p className="text-2xl font-bold text-slate-950">
        {value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toLocaleString()}
      </p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SocialAnalytics({ campaignId }: SocialAnalyticsProps) {
  const { authHeader } = useAuth()
  const { locale } = useI18n()
  const ar = locale === 'ar'

  const [posts, setPosts] = useState<PostData[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/social/analytics?campaignId=${campaignId}`, {
        headers: { Authorization: authHeader() },
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || `Error ${res.status}`)
      }
      const data = await res.json()
      setPosts(data.posts || [])
      setTotals(data.totals || null)
      setLastRefreshed(new Date())
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [authHeader, campaignId])

  useEffect(() => { load() }, [load])

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-3 text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">{ar ? 'جاري تحميل الإحصائيات...' : 'Loading analytics...'}</span>
      </div>
    )
  }

  // ── Error ───────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        <p>{error}</p>
      </div>
    )
  }

  // ── No posts ────────────────────────────────────────────────────────────────

  if (!totals || totals.posts === 0) {
    return (
      <div className="text-center py-10 space-y-2">
        <div className="text-4xl">📊</div>
        <p className="text-sm text-gray-500">
          {ar
            ? 'لا توجد منشورات منشورة بعد. انشر أول منشور لترى الإحصائيات هنا.'
            : 'No published posts yet. Publish your first post to see analytics here.'}
        </p>
      </div>
    )
  }

  const postsWithInsights = posts.filter(post => post.insights).length
  if (postsWithInsights === 0) {
    return (
      <div className="text-center py-10 space-y-2">
        <div className="text-4xl">📊</div>
        <p className="text-sm font-semibold text-slate-950">
          {ar ? 'لا توجد بيانات أداء منشورة بعد' : 'No published performance data yet'}
        </p>
        <p className="mx-auto max-w-xl text-sm text-slate-500">
          {ar
            ? 'تم تسجيل محتوى منشور أو منشور يدويًا، لكن لم يتم جلب بيانات تحليلية بعد.'
            : 'Published or manually recorded content exists, but analytics have not been fetched yet.'}
        </p>
      </div>
    )
  }

  // ── Main UI ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📊</span>
          <div>
            <h3 className="text-base font-semibold text-slate-950">
              {ar ? 'أداء المنشورات' : 'Post Performance'}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {ar ? 'بيانات من Meta عند توفرها' : 'Meta performance data when available'}
              {lastRefreshed && (
                <span className="mx-1">·</span>
              )}
              {lastRefreshed && (
                <span>{lastRefreshed.toLocaleTimeString(ar ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="rounded-lg p-1.5 text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-700"
          title={ar ? 'تحديث' : 'Refresh'}
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Totals grid */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          icon={<Eye className="w-4 h-4 text-blue-400" />}
          label={ar ? 'الوصول' : 'Reach'}
          value={totals.reach}
          color="border-blue-500/20"
        />
        <MetricCard
          icon={<TrendingUp className="w-4 h-4 text-purple-400" />}
          label={ar ? 'الإمبريشنز' : 'Impressions'}
          value={totals.impressions}
          color="border-purple-500/20"
        />
        <MetricCard
          icon={<Users className="w-4 h-4 text-green-400" />}
          label={ar ? 'التفاعل' : 'Engagement'}
          value={totals.engagement}
          color="border-green-500/20"
        />
        <MetricCard
          icon={<MousePointer className="w-4 h-4 text-accent" />}
          label={ar ? 'الكليكس' : 'Clicks'}
          value={totals.clicks}
          color="border-accent/20"
        />
      </div>

      <p className="text-center text-xs text-slate-500">
        {totals.posts} {ar ? 'منشور' : 'post(s)'} · {ar ? 'إجمالي الحملة' : 'campaign total'}
      </p>

      {/* Per-post breakdown */}
      <div className="space-y-3 border-t border-slate-200 pt-1">
        <p className="pt-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          {ar ? 'تفاصيل المنشورات' : 'Post Breakdown'}
        </p>

        {posts.map(post => (
          <div key={post.id} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            {/* Post header */}
            <div className="flex items-start gap-3">
              {post.imageUrl && (
                <img
                  src={post.imageUrl}
                  alt=""
                  className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="line-clamp-2 text-sm text-slate-700">{post.caption}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-slate-500">
                    {post.pageName} ·{' '}
                    {post.publishedAt
                      ? new Date(post.publishedAt).toLocaleDateString(ar ? 'ar-SA' : 'en-US')
                      : ''}
                  </span>
                  {post.platformUrl && (
                    <a
                      href={post.platformUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-accent hover:underline flex items-center gap-0.5"
                    >
                      {ar ? 'عرض' : 'View'} <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Metrics */}
            {post.insights ? (
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: ar ? 'وصول' : 'Reach', value: post.insights.reach, color: 'text-blue-400' },
                  { label: ar ? 'مشاهدات' : 'Views', value: post.insights.impressions, color: 'text-purple-400' },
                  { label: ar ? 'تفاعل' : 'Engaged', value: post.insights.engagement, color: 'text-green-400' },
                  { label: ar ? 'كليك' : 'Clicks', value: post.insights.clicks, color: 'text-accent' },
                ].map(m => (
                  <div key={m.label} className="text-center">
                    <p className={`text-base font-bold ${m.color}`}>
                      {m.value >= 1000 ? `${(m.value / 1000).toFixed(1)}K` : m.value}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">{m.label}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-600 italic">
                {post.insightsError
                  ? (ar ? `تعذر تحميل البيانات: ${post.insightsError}` : `Could not load: ${post.insightsError}`)
                  : (ar ? 'البيانات غير متاحة بعد' : 'Data not available yet')
                }
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
