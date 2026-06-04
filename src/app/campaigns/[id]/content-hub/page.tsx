'use client'

/**
 * Content Hub — /campaigns/[id]/content-hub
 *
 * Shows ALL planned posts for the month in a beautiful hub:
 * - Platform filter tabs (All / Facebook / Instagram / X / LinkedIn / TikTok)
 * - Realistic platform-native post preview cards
 * - Per-post media source toggle: Generate AI / Use Uploaded / Upload Now
 * - Editable captions + image prompts inline
 * - "Generate All Images" — triggers bulk generation for approved posts
 * - Progress bar showing generation status
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import AppShell from '@/components/AppShell'

// ── Types ─────────────────────────────────────────────────────────────────────

type Platform = 'ALL' | 'META' | 'INSTAGRAM' | 'LINKEDIN' | 'X' | 'TIKTOK' | 'TWITTER'
type MediaSource = 'GENERATE' | 'UPLOAD' | 'UPLOAD_RAW'
type GenStatus = 'PENDING' | 'GENERATING' | 'DONE' | 'FAILED' | 'AWAITING_UPLOAD' | 'SKIPPED'

interface ContentPost {
  id: string
  platform: string
  caption: string
  imageUrl: string | null
  imagePrompt: string | null
  videoPrompt: string | null
  isVideoPost: boolean
  generationStatus: GenStatus
  mediaSource: MediaSource
  uploadedMediaId: string | null
  contentPlanIndex: number
  scheduledAt: string | null
}

interface MediaItem {
  id: string
  url: string
  fileName: string
  type: string
}

interface Campaign {
  id: string
  name: string
  platforms: string[]
}

// ── Platform config ────────────────────────────────────────────────────────────

const PLATFORM_CONFIG: Record<string, {
  label: string
  color: string
  bg: string
  border: string
  icon: string
  cardStyle: string
}> = {
  META: {
    label: 'Facebook',
    color: '#1877F2',
    bg: '#f0f7ff',
    border: '#1877F2',
    icon: '📘',
    cardStyle: 'facebook',
  },
  INSTAGRAM: {
    label: 'Instagram',
    color: '#E1306C',
    bg: '#fff0f5',
    border: '#E1306C',
    icon: '📸',
    cardStyle: 'instagram',
  },
  X: {
    label: 'X',
    color: '#000000',
    bg: '#f7f7f7',
    border: '#000000',
    icon: '✕',
    cardStyle: 'twitter',
  },
  TWITTER: {
    label: 'X',
    color: '#000000',
    bg: '#f7f7f7',
    border: '#000000',
    icon: '✕',
    cardStyle: 'twitter',
  },
  LINKEDIN: {
    label: 'LinkedIn',
    color: '#0A66C2',
    bg: '#f0f5ff',
    border: '#0A66C2',
    icon: '💼',
    cardStyle: 'linkedin',
  },
  TIKTOK: {
    label: 'TikTok',
    color: '#010101',
    bg: '#f5f5f5',
    border: '#010101',
    icon: '🎵',
    cardStyle: 'tiktok',
  },
}

const getPlatformConfig = (p: string) =>
  PLATFORM_CONFIG[p.toUpperCase()] ?? {
    label: p,
    color: '#6366f1',
    bg: '#f0f0ff',
    border: '#6366f1',
    icon: '📣',
    cardStyle: 'default',
  }

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ContentHubPage() {
  const params = useParams()
  const router = useRouter()
  const campaignId = params.id as string
  const { authHeader, isAuthenticated, loading: authLoading } = useAuth()
  const { t } = useI18n()

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [posts, setPosts] = useState<ContentPost[]>([])
  const [mediaLibrary, setMediaLibrary] = useState<MediaItem[]>([])
  const [activePlatform, setActivePlatform] = useState<Platform>('ALL')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [expandedPost, setExpandedPost] = useState<string | null>(null)
  const [mediaPickerOpen, setMediaPickerOpen] = useState<string | null>(null) // postId
  const [editingCaption, setEditingCaption] = useState<string | null>(null)
  const [editingPrompt, setEditingPrompt] = useState<string | null>(null)
  const [pendingEdits, setPendingEdits] = useState<Record<string, Partial<ContentPost>>>({})
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  // ── Load data ────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      // Load campaign
      const cRes = await fetch(`/api/campaigns/${campaignId}`, { headers: { Authorization: authHeader() } })
      if (!cRes.ok) throw new Error('Campaign not found')
      const { campaign: c } = await cRes.json()
      setCampaign({ id: c.id, name: c.name, platforms: c.platforms ?? [] })

      // Load content plan posts
      const pRes = await fetch(`/api/campaigns/${campaignId}/content-plan`, {
        headers: { Authorization: authHeader() },
      })
      if (pRes.ok) {
        const { posts: rawPosts } = await pRes.json()
        setPosts(rawPosts ?? [])
      }

      // Load media library
      const mRes = await fetch('/api/media', { headers: { Authorization: authHeader() } })
      if (mRes.ok) {
        const mData = await mRes.json()
        setMediaLibrary(mData.media ?? mData.items ?? [])
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [authHeader, campaignId])

  useEffect(() => {
    if (!authLoading && isAuthenticated) loadData()
  }, [authLoading, isAuthenticated, loadData])

  // ── Poll generating status ────────────────────────────────────────────────────

  useEffect(() => {
    const generating = posts.some(p => p.generationStatus === 'GENERATING')
    if (generating && !pollRef.current) {
      pollRef.current = setInterval(loadData, 4000)
    } else if (!generating && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [posts, loadData])

  // ── Helpers ───────────────────────────────────────────────────────────────────

  const filteredPosts = activePlatform === 'ALL'
    ? posts
    : posts.filter(p => p.platform.toUpperCase() === activePlatform)

  const platforms = ['ALL', ...Array.from(new Set(posts.map(p => p.platform.toUpperCase())))]

  const doneCount = posts.filter(p => p.generationStatus === 'DONE').length
  const totalImagePosts = posts.filter(p => !p.isVideoPost).length
  const progress = totalImagePosts > 0 ? Math.round((doneCount / totalImagePosts) * 100) : 0

  const getPendingEdit = (postId: string) => pendingEdits[postId] ?? {}

  // ── Generate content plan ────────────────────────────────────────────────────

  async function generatePlan() {
    if (!isAuthenticated) return
    setGeneratingPlan(true)
    setError(null)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/generate-content-plan`, {
        method: 'POST',
        headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaSource: 'GENERATE' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Generation failed')
      setSuccessMsg(`Content plan created: ${data.summary.total} posts ready for review`)
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGeneratingPlan(false)
    }
  }

  // ── Save inline edits ────────────────────────────────────────────────────────

  async function savePostEdit(postId: string, updates: Partial<ContentPost>) {
    if (!isAuthenticated) return
    try {
      await fetch(`/api/campaigns/${campaignId}/content-plan/${postId}`, {
        method: 'PATCH',
        headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, ...updates } : p))
      setPendingEdits(prev => {
        const next = { ...prev }
        delete next[postId]
        return next
      })
    } catch (err) {
      console.error('Failed to save edit', err)
    }
  }

  // ── Assign uploaded media to a post ─────────────────────────────────────────

  async function assignMedia(postId: string, mediaId: string, mediaUrl: string) {
    await savePostEdit(postId, {
      uploadedMediaId: mediaId,
      imageUrl: mediaUrl,
      mediaSource: 'UPLOAD_RAW',
      generationStatus: 'DONE',
    })
    setMediaPickerOpen(null)
  }

  // ── Bulk generate images ─────────────────────────────────────────────────────

  async function generateAllImages() {
    if (!isAuthenticated) return
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/generate-content-plan/generate`, {
        method: 'POST',
        headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ postIds: posts.filter(p => p.generationStatus === 'PENDING' && !p.isVideoPost).map(p => p.id) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Generation failed')
      setSuccessMsg('Image generation started — this may take a few minutes')
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    )
  }

  if (!campaign) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64 text-gray-400">Campaign not found</div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <button
              onClick={() => router.push(`/campaigns/${campaignId}`)}
              className="text-sm text-gray-500 hover:text-purple-400 flex items-center gap-1 mb-2 transition-colors"
            >
              ← {campaign.name}
            </button>
            <h1 className="text-2xl font-bold text-white">Content Hub</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {posts.length > 0
                ? `${posts.length} posts · ${doneCount} images ready · ${posts.filter(p => p.isVideoPost).length} video slots`
                : 'Generate your monthly content plan'}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {posts.length > 0 && (
              <>
                <button
                  onClick={generateAllImages}
                  disabled={generating || posts.filter(p => p.generationStatus === 'PENDING' && !p.isVideoPost).length === 0}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                    color: 'white',
                    opacity: generating ? 0.6 : 1,
                  }}
                >
                  {generating ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      ✨ Generate All Images
                      {posts.filter(p => p.generationStatus === 'PENDING' && !p.isVideoPost).length > 0 && (
                        <span className="bg-white/20 rounded-full px-1.5 py-0.5 text-xs">
                          {posts.filter(p => p.generationStatus === 'PENDING' && !p.isVideoPost).length}
                        </span>
                      )}
                    </>
                  )}
                </button>
                <button
                  onClick={generatePlan}
                  disabled={generatingPlan}
                  className="px-4 py-2 rounded-xl text-sm border transition-all"
                  style={{ borderColor: 'rgba(139,92,246,0.3)', color: '#a78bfa' }}
                >
                  {generatingPlan ? 'Regenerating...' : '↻ Regenerate Plan'}
                </button>
              </>
            )}

            {posts.length === 0 && (
              <button
                onClick={generatePlan}
                disabled={generatingPlan}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                  color: 'white',
                  opacity: generatingPlan ? 0.6 : 1,
                }}
              >
                {generatingPlan ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Building Content Plan...
                  </>
                ) : '✨ Build Monthly Content Plan'}
              </button>
            )}
          </div>
        </div>

        {/* ── Messages ─────────────────────────────────────────────── */}
        {error && (
          <div className="mb-4 p-3 rounded-xl text-sm text-red-400 bg-red-500/10 border border-red-500/20">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3 rounded-xl text-sm text-green-400 bg-green-500/10 border border-green-500/20 flex items-center justify-between">
            {successMsg}
            <button onClick={() => setSuccessMsg(null)} className="text-green-600 hover:text-green-400">×</button>
          </div>
        )}

        {/* ── Progress bar ─────────────────────────────────────────── */}
        {totalImagePosts > 0 && (
          <div className="mb-5 p-3 rounded-xl" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-purple-300 font-medium">Image generation progress</span>
              <span className="text-gray-400">{doneCount} / {totalImagePosts} images</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(139,92,246,0.15)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #7c3aed, #a78bfa)' }}
              />
            </div>
          </div>
        )}

        {/* ── Platform filter tabs ───────────────────────────────────── */}
        {posts.length > 0 && (
          <div className="flex gap-2 mb-6 flex-wrap">
            {platforms.map(p => {
              const cfg = p === 'ALL' ? null : getPlatformConfig(p)
              const count = p === 'ALL' ? posts.length : posts.filter(post => post.platform.toUpperCase() === p).length
              const isActive = activePlatform === p
              return (
                <button
                  key={p}
                  onClick={() => setActivePlatform(p as Platform)}
                  className="px-3 py-1.5 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5"
                  style={{
                    background: isActive
                      ? (cfg ? cfg.color : 'rgba(139,92,246,0.8)')
                      : 'rgba(255,255,255,0.05)',
                    color: isActive ? '#fff' : '#9ca3af',
                    border: isActive
                      ? `1px solid ${cfg ? cfg.color : '#7c3aed'}`
                      : '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  {cfg && <span>{cfg.icon}</span>}
                  {p === 'ALL' ? 'All Platforms' : (cfg?.label ?? p)}
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full"
                    style={{
                      background: isActive ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
                      color: isActive ? '#fff' : '#6b7280',
                    }}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* ── Empty state ───────────────────────────────────────────── */}
        {posts.length === 0 && !generatingPlan && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl"
              style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}>
              📅
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No content plan yet</h3>
            <p className="text-sm text-gray-400 max-w-sm mx-auto mb-6">
              Generate your monthly content plan. The AI will write all post captions and image prompts based on your campaign strategy.
            </p>
          </div>
        )}

        {generatingPlan && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}>
              <span className="w-8 h-8 border-2 border-purple-500/40 border-t-purple-400 rounded-full animate-spin" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Building your content plan...</h3>
            <p className="text-sm text-gray-400">Writing captions and image prompts for all posts</p>
          </div>
        )}

        {/* ── Post grid ────────────────────────────────────────────── */}
        {filteredPosts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredPosts
              .sort((a, b) => (a.contentPlanIndex ?? 0) - (b.contentPlanIndex ?? 0))
              .map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  pendingEdit={getPendingEdit(post.id)}
                  mediaLibrary={mediaLibrary}
                  isExpanded={expandedPost === post.id}
                  isEditingCaption={editingCaption === post.id}
                  isEditingPrompt={editingPrompt === post.id}
                  mediaPickerOpen={mediaPickerOpen === post.id}
                  onToggleExpand={() => setExpandedPost(expandedPost === post.id ? null : post.id)}
                  onEditCaption={() => setEditingCaption(editingCaption === post.id ? null : post.id)}
                  onEditPrompt={() => setEditingPrompt(editingPrompt === post.id ? null : post.id)}
                  onOpenMediaPicker={() => setMediaPickerOpen(mediaPickerOpen === post.id ? null : post.id)}
                  onCloseMediaPicker={() => setMediaPickerOpen(null)}
                  onSaveEdit={(updates) => savePostEdit(post.id, updates)}
                  onAssignMedia={(mediaId, url) => assignMedia(post.id, mediaId, url)}
                  onPendingEdit={(updates) => setPendingEdits(prev => ({
                    ...prev,
                    [post.id]: { ...(prev[post.id] ?? {}), ...updates }
                  }))}
                />
              ))}
          </div>
        )}

        {/* ── Media picker overlay ───────────────────────────────────── */}
        {mediaPickerOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.7)' }}
            onClick={() => setMediaPickerOpen(null)}
          >
            <div
              className="w-full max-w-2xl rounded-2xl p-6 shadow-2xl"
              style={{ background: '#1a1625', border: '1px solid rgba(139,92,246,0.3)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">Choose from Media Library</h3>
                <button onClick={() => setMediaPickerOpen(null)} className="text-gray-400 hover:text-white text-xl">×</button>
              </div>
              {mediaLibrary.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p className="mb-3">No images uploaded yet</p>
                  <button
                    onClick={() => router.push('/media')}
                    className="text-sm text-purple-400 hover:text-purple-300"
                  >
                    Go to Media Library →
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 max-h-80 overflow-y-auto">
                  {mediaLibrary
                    .filter(m => ['image', 'IMAGE', 'logo', 'LOGO'].includes(m.type))
                    .map(m => (
                      <button
                        key={m.id}
                        onClick={() => mediaPickerOpen && assignMedia(mediaPickerOpen, m.id, m.url)}
                        className="relative group aspect-square rounded-xl overflow-hidden transition-all hover:ring-2 hover:ring-purple-500"
                      >
                        <img src={m.url} alt={m.fileName} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <span className="text-white text-xs font-medium">Use this</span>
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </AppShell>
  )
}

// ── PostCard Component ─────────────────────────────────────────────────────────

interface PostCardProps {
  post: ContentPost
  pendingEdit: Partial<ContentPost>
  mediaLibrary: MediaItem[]
  isExpanded: boolean
  isEditingCaption: boolean
  isEditingPrompt: boolean
  mediaPickerOpen: boolean
  onToggleExpand: () => void
  onEditCaption: () => void
  onEditPrompt: () => void
  onOpenMediaPicker: () => void
  onCloseMediaPicker: () => void
  onSaveEdit: (updates: Partial<ContentPost>) => Promise<void>
  onAssignMedia: (mediaId: string, url: string) => Promise<void>
  onPendingEdit: (updates: Partial<ContentPost>) => void
}

function PostCard({
  post,
  pendingEdit,
  isExpanded,
  isEditingCaption,
  isEditingPrompt,
  onToggleExpand,
  onEditCaption,
  onEditPrompt,
  onOpenMediaPicker,
  onSaveEdit,
  onPendingEdit,
}: PostCardProps) {
  const cfg = getPlatformConfig(post.platform)
  const caption = pendingEdit.caption ?? post.caption
  const imagePrompt = pendingEdit.imagePrompt ?? post.imagePrompt ?? ''
  const hasImage = !!post.imageUrl
  const isVideo = post.isVideoPost
  const status = post.generationStatus

  const statusColor = {
    PENDING: '#f59e0b',
    GENERATING: '#6366f1',
    DONE: '#10b981',
    FAILED: '#ef4444',
    AWAITING_UPLOAD: '#8b5cf6',
    SKIPPED: '#6b7280',
  }[status] ?? '#6b7280'

  const statusLabel = {
    PENDING: 'Pending',
    GENERATING: 'Generating...',
    DONE: 'Ready',
    FAILED: 'Failed',
    AWAITING_UPLOAD: 'Upload Video',
    SKIPPED: 'Skipped',
  }[status] ?? status

  const scheduledDate = post.scheduledAt
    ? new Date(post.scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col transition-all"
      style={{
        background: '#1a1625',
        border: `1px solid rgba(255,255,255,0.08)`,
        boxShadow: isExpanded ? `0 0 0 2px ${cfg.color}40` : 'none',
      }}
    >
      {/* ── Platform header bar ───────────────── */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ background: `${cfg.color}18`, borderBottom: `1px solid ${cfg.color}30` }}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">{cfg.icon}</span>
          <span className="text-xs font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
          <span className="text-xs text-gray-600">#{post.contentPlanIndex}</span>
        </div>
        <div className="flex items-center gap-2">
          {scheduledDate && (
            <span className="text-xs text-gray-500">{scheduledDate}</span>
          )}
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: `${statusColor}20`, color: statusColor }}
          >
            {status === 'GENERATING' && (
              <span className="inline-block w-2 h-2 rounded-full mr-1 animate-pulse" style={{ background: statusColor }} />
            )}
            {statusLabel}
          </span>
        </div>
      </div>

      {/* ── Image area ───────────────────────── */}
      <div className="relative" style={{ aspectRatio: '16/9', background: '#120f1c' }}>
        {hasImage ? (
          <img src={post.imageUrl!} alt="Post visual" className="w-full h-full object-cover" />
        ) : isVideo ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)' }}>
              <span className="text-2xl">🎬</span>
            </div>
            <span className="text-xs text-gray-400">Upload your video</span>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}>
              <span className="text-2xl">🖼</span>
            </div>
            <span className="text-xs text-gray-400">
              {status === 'PENDING' ? 'Awaiting generation' : 'No image yet'}
            </span>
          </div>
        )}

        {/* Media source badge */}
        <div className="absolute top-2 left-2">
          <MediaSourceBadge
            source={post.mediaSource as MediaSource}
            isVideo={isVideo}
            onGenerateClick={() => onSaveEdit({ mediaSource: 'GENERATE', generationStatus: 'PENDING' })}
            onUploadClick={onOpenMediaPicker}
            onUploadRawClick={onOpenMediaPicker}
          />
        </div>
      </div>

      {/* ── Caption area ─────────────────────── */}
      <div className="p-3 flex-1 flex flex-col gap-2">
        {isEditingCaption ? (
          <div>
            <textarea
              className="w-full rounded-lg text-sm p-2 resize-none focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(139,92,246,0.4)', color: '#e5e7eb', minHeight: '80px' }}
              value={caption}
              onChange={e => onPendingEdit({ caption: e.target.value })}
              onBlur={() => {
                onSaveEdit({ caption })
                onEditCaption()
              }}
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-1">
              <button onClick={onEditCaption} className="text-xs text-gray-500 hover:text-gray-300">Cancel</button>
              <button
                onClick={() => { onSaveEdit({ caption }); onEditCaption() }}
                className="text-xs text-purple-400 hover:text-purple-300"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <div
            className="text-sm text-gray-300 cursor-pointer hover:text-white transition-colors"
            style={{ lineHeight: '1.5' }}
            onClick={onEditCaption}
          >
            <p className={isExpanded ? '' : 'line-clamp-3'}>
              {caption || <span className="text-gray-600 italic">No caption</span>}
            </p>
            {caption && caption.length > 120 && !isExpanded && (
              <button
                className="text-xs text-purple-400 mt-1 hover:text-purple-300"
                onClick={e => { e.stopPropagation(); onToggleExpand() }}
              >
                See more
              </button>
            )}
          </div>
        )}

        {/* Image prompt (collapsed by default) */}
        {!isVideo && (
          <details className="group" open={isExpanded}>
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-purple-400 list-none flex items-center gap-1 select-none">
              <span className="group-open:rotate-90 transition-transform duration-150 inline-block">▶</span>
              Image prompt
            </summary>
            <div className="mt-1.5">
              {isEditingPrompt ? (
                <div>
                  <textarea
                    className="w-full rounded-lg text-xs p-2 resize-none focus:outline-none"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(139,92,246,0.3)', color: '#9ca3af', minHeight: '60px' }}
                    value={imagePrompt}
                    onChange={e => onPendingEdit({ imagePrompt: e.target.value })}
                    onBlur={() => { onSaveEdit({ imagePrompt }); onEditPrompt() }}
                    autoFocus
                  />
                </div>
              ) : (
                <p
                  className="text-xs text-gray-500 cursor-pointer hover:text-gray-300 transition-colors italic rounded p-1"
                  style={{ background: 'rgba(255,255,255,0.03)' }}
                  onClick={onEditPrompt}
                >
                  {imagePrompt || <span className="text-gray-700">No prompt</span>}
                </p>
              )}
            </div>
          </details>
        )}

        {/* Video post instructions */}
        {isVideo && (
          <div className="text-xs text-purple-400/70 rounded-lg p-2" style={{ background: 'rgba(139,92,246,0.08)' }}>
            📎 Upload your video file to fill this slot
          </div>
        )}
      </div>

      {/* ── Action buttons ────────────────────── */}
      <div className="flex border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <button
          onClick={onEditCaption}
          className="flex-1 py-2 text-xs text-gray-500 hover:text-purple-400 hover:bg-purple-500/5 transition-all"
        >
          ✏️ Edit
        </button>
        {!isVideo && (
          <button
            onClick={onOpenMediaPicker}
            className="flex-1 py-2 text-xs text-gray-500 hover:text-blue-400 hover:bg-blue-500/5 transition-all border-l"
            style={{ borderColor: 'rgba(255,255,255,0.06)' }}
          >
            📁 My Images
          </button>
        )}
        {isVideo && (
          <button
            onClick={onOpenMediaPicker}
            className="flex-1 py-2 text-xs text-gray-500 hover:text-green-400 hover:bg-green-500/5 transition-all border-l"
            style={{ borderColor: 'rgba(255,255,255,0.06)' }}
          >
            🎬 Upload Video
          </button>
        )}
      </div>
    </div>
  )
}

// ── MediaSourceBadge ───────────────────────────────────────────────────────────

function MediaSourceBadge({
  source,
  isVideo,
  onGenerateClick,
  onUploadClick,
  onUploadRawClick,
}: {
  source: MediaSource
  isVideo: boolean
  onGenerateClick: () => void
  onUploadClick: () => void
  onUploadRawClick: () => void
}) {
  if (isVideo) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(139,92,246,0.7)', color: '#fff' }}>
        Video
      </span>
    )
  }

  const options: Array<{ key: MediaSource; label: string; color: string; onClick: () => void }> = [
    { key: 'GENERATE', label: '✨ AI Generate', color: 'rgba(139,92,246,0.8)', onClick: onGenerateClick },
    { key: 'UPLOAD', label: '📁 From Library', color: 'rgba(59,130,246,0.8)', onClick: onUploadClick },
    { key: 'UPLOAD_RAW', label: '⬆ Upload', color: 'rgba(16,185,129,0.8)', onClick: onUploadRawClick },
  ]

  const active = options.find(o => o.key === source) ?? options[0]

  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer"
      style={{ background: active.color, color: '#fff' }}
      onClick={active.onClick}
      title="Click to change"
    >
      {active.label}
    </span>
  )
}
