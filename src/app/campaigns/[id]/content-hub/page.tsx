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
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED'
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

interface BrandProfile {
  brandName: string | null
  logoUrl: string | null
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
  const [brandProfile, setBrandProfile] = useState<BrandProfile>({ brandName: null, logoUrl: null })
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
  const [approving, setApproving] = useState(false)
  const [showApproveConfirm, setShowApproveConfirm] = useState(false)
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

      // Load brand profile (for name + logo in mockups)
      const bRes = await fetch('/api/brand', { headers: { Authorization: authHeader() } })
      if (bRes.ok) {
        const bData = await bRes.json()
        if (bData.brandProfile) {
          setBrandProfile({
            brandName: bData.brandProfile.brandName ?? null,
            logoUrl: bData.brandProfile.logoUrl ?? null,
          })
        }
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

  // ── Approve all posts → scheduled ────────────────────────────────────────────

  async function approveAll() {
    if (!isAuthenticated) return
    setApproving(true)
    setShowApproveConfirm(false)
    setError(null)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/approve-content-plan`, {
        method: 'POST',
        headers: { Authorization: authHeader() },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Approval failed')
      setSuccessMsg(`✅ ${data.approved} posts approved and scheduled for auto-publishing`)
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setApproving(false)
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
                {/* Approve All — primary CTA when posts exist */}
                {posts.filter(p => p.status === 'DRAFT').length > 0 ? (
                  <button
                    onClick={() => setShowApproveConfirm(true)}
                    disabled={approving}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
                    style={{
                      background: 'linear-gradient(135deg, #059669, #047857)',
                      color: 'white',
                      opacity: approving ? 0.6 : 1,
                    }}
                  >
                    {approving ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        Approving...
                      </>
                    ) : (
                      <>
                        ✓ Approve All &amp; Schedule
                        <span className="bg-white/20 rounded-full px-1.5 py-0.5 text-xs">
                          {posts.filter(p => p.status === 'DRAFT').length}
                        </span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium"
                    style={{ background: 'rgba(5,150,105,0.1)', color: '#34d399', border: '1px solid rgba(5,150,105,0.2)' }}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13.5 4.5l-7 7-3-3"/></svg>
                    All posts scheduled
                  </div>
                )}

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
                      ✨ Generate Images
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
                  brandName={brandProfile.brandName ?? campaign?.name ?? 'your_brand'}
                  brandLogo={brandProfile.logoUrl ?? null}
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

        {/* ── Approve All confirm dialog ───────────────────────────────── */}
        {showApproveConfirm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.75)' }}
            onClick={() => setShowApproveConfirm(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
              style={{ background: '#1a1625', border: '1px solid rgba(5,150,105,0.3)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4"
                style={{ background: 'rgba(5,150,105,0.12)', border: '1px solid rgba(5,150,105,0.2)' }}>
                📅
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Approve &amp; Schedule all posts?</h3>
              <p className="text-sm text-gray-400 mb-1">
                This will mark all <span className="text-white font-semibold">{posts.filter(p => p.status === 'DRAFT').length} draft posts</span> as scheduled.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                Posts will auto-publish at their scheduled times. You can still edit captions before they go live.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowApproveConfirm(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white border transition-all"
                  style={{ borderColor: 'rgba(255,255,255,0.1)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={approveAll}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #059669, #047857)' }}
                >
                  ✓ Yes, Schedule All
                </button>
              </div>
            </div>
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
  brandName: string
  brandLogo: string | null
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
  brandName,
  brandLogo,
  isExpanded,
  isEditingCaption,
  onToggleExpand,
  onEditCaption,
  onOpenMediaPicker,
  onSaveEdit,
  onPendingEdit,
}: PostCardProps) {
  const platform = post.platform.toUpperCase()
  const caption = pendingEdit.caption ?? post.caption
  const hasImage = !!post.imageUrl
  const isVideo = post.isVideoPost
  const status = post.generationStatus

  const statusColor = {
    PENDING: '#f59e0b', GENERATING: '#6366f1', DONE: '#10b981',
    FAILED: '#ef4444', AWAITING_UPLOAD: '#8b5cf6', SKIPPED: '#6b7280',
  }[status] ?? '#6b7280'

  const statusLabel = {
    PENDING: 'Pending', GENERATING: 'Generating…', DONE: 'Ready',
    FAILED: 'Failed', AWAITING_UPLOAD: 'Upload Video', SKIPPED: 'Skipped',
  }[status] ?? status

  const scheduledDate = post.scheduledAt
    ? new Date(post.scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  // Wrapper with status bar on top + action row on bottom
  return (
    <div className="rounded-2xl overflow-hidden flex flex-col" style={{ background: '#161020', border: '1px solid rgba(255,255,255,0.07)' }}>

      {/* ── Top meta bar ─────────────────── */}
      <div className="flex items-center justify-between px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">#{post.contentPlanIndex}</span>
          {scheduledDate && <span className="text-[10px] text-gray-600">· {scheduledDate}</span>}
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"
          style={{ background: `${statusColor}18`, color: statusColor }}>
          {status === 'GENERATING' && <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block" style={{ background: statusColor }} />}
          {statusLabel}
        </span>
      </div>

      {/* ── Platform Mockup ──────────────── */}
      {(platform === 'META' || platform === 'FACEBOOK' || platform === 'INSTAGRAM') && (
        <InstagramMockup caption={caption} imageUrl={post.imageUrl} isVideo={isVideo} status={status} isExpanded={isExpanded} onExpandToggle={onToggleExpand} brandName={brandName} brandLogo={brandLogo} />
      )}
      {platform === 'LINKEDIN' && (
        <LinkedInMockup caption={caption} imageUrl={post.imageUrl} isVideo={isVideo} status={status} isExpanded={isExpanded} onExpandToggle={onToggleExpand} brandName={brandName} brandLogo={brandLogo} />
      )}
      {platform === 'TIKTOK' && (
        <TikTokMockup caption={caption} imageUrl={post.imageUrl} isVideo={isVideo} status={status} brandName={brandName} brandLogo={brandLogo} />
      )}
      {!['META','FACEBOOK','INSTAGRAM','LINKEDIN','TIKTOK'].includes(platform) && (
        <GenericMockup caption={caption} imageUrl={post.imageUrl} isVideo={isVideo} status={status} platform={platform} isExpanded={isExpanded} onExpandToggle={onToggleExpand} brandName={brandName} brandLogo={brandLogo} />
      )}

      {/* ── Edit caption overlay ─────────── */}
      {isEditingCaption && (
        <div className="px-3 pb-3 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <textarea
            className="w-full rounded-xl text-sm p-3 resize-none focus:outline-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(124,58,237,0.4)', color: '#e5e7eb', minHeight: '90px' }}
            value={caption}
            onChange={e => onPendingEdit({ caption: e.target.value })}
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={onEditCaption} className="text-xs px-3 py-1.5 rounded-lg text-gray-500 hover:text-white transition-colors">Cancel</button>
            <button
              onClick={() => { onSaveEdit({ caption }); onEditCaption() }}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white transition-all"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}
            >Save</button>
          </div>
        </div>
      )}

      {/* ── Action row ───────────────────── */}
      <div className="flex border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <button onClick={onEditCaption}
          className="flex-1 py-2.5 text-xs font-medium text-gray-500 hover:text-purple-400 hover:bg-purple-500/5 transition-all flex items-center justify-center gap-1.5">
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11.5 2.5a2.121 2.121 0 013 3L5 15l-4 1 1-4L11.5 2.5z"/></svg>
          Edit Caption
        </button>
        <button onClick={onOpenMediaPicker}
          className="flex-1 py-2.5 text-xs font-medium text-gray-500 hover:text-blue-400 hover:bg-blue-500/5 transition-all border-l flex items-center justify-center gap-1.5"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="2" width="12" height="12" rx="2"/><circle cx="5.5" cy="5.5" r="1"/><path d="M14 10l-4-4-3 3-1.5-1.5L2 11"/></svg>
          {isVideo ? 'Upload Video' : 'My Images'}
        </button>
      </div>
    </div>
  )
}

// ── Brand Avatar helper ────────────────────────────────────────────────────────

function BrandAvatar({ brandName, brandLogo, size = 32, gradientBg, rounded = 'full' }: {
  brandName: string; brandLogo: string | null; size?: number; gradientBg?: string; rounded?: 'full' | 'lg'
}) {
  const initial = (brandName || 'B').charAt(0).toUpperCase()
  const bg = gradientBg ?? 'linear-gradient(135deg,#7c3aed,#6d28d9)'
  const radius = rounded === 'full' ? '9999px' : '8px'
  if (brandLogo) {
    return (
      <div style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden', flexShrink: 0 }}>
        <img src={brandLogo} alt={brandName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    )
  }
  return (
    <div style={{ width: size, height: size, borderRadius: radius, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: size * 0.38, fontWeight: 700, flexShrink: 0 }}>
      {initial}
    </div>
  )
}

// ── Instagram Mockup ───────────────────────────────────────────────────────────

function InstagramMockup({ caption, imageUrl, isVideo, status, isExpanded, onExpandToggle, brandName, brandLogo }: {
  caption: string; imageUrl: string | null; isVideo: boolean; status: string; isExpanded: boolean; onExpandToggle: () => void; brandName: string; brandLogo: string | null
}) {
  const handle = brandName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  const shortCaption = !isExpanded && caption.length > 100 ? caption.slice(0, 100) + '…' : caption
  return (
    <div style={{ background: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      {/* Profile row */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div style={{ padding: '2px', borderRadius: '9999px', background: 'linear-gradient(135deg,#f58529,#dd2a7b,#8134af,#515bd4)' }}>
            <BrandAvatar brandName={brandName} brandLogo={brandLogo} size={30} />
          </div>
          <div>
            <div className="text-[12px] font-semibold text-gray-900 leading-tight">{handle}</div>
            <div className="text-[10px] text-gray-500">Sponsored</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[20px] text-gray-900 leading-none font-light">···</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </div>
      </div>

      {/* Image — 1:1 square */}
      <div className="relative w-full" style={{ aspectRatio: '1/1', background: '#f3f3f3', overflow: 'hidden' }}>
        {imageUrl ? (
          <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <ImagePlaceholder isVideo={isVideo} status={status} dark={false} />
        )}
      </div>

      {/* Action icons */}
      <div className="px-3 pt-2.5 pb-1">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3.5">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="1.8"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="1.8"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </div>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="1.8"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
        </div>
        <div className="text-[12px] font-semibold text-gray-900 mb-1">1,234 likes</div>
        <div className="text-[12px] text-gray-900 leading-relaxed">
          <span className="font-semibold">{handle}</span>{' '}
          <span className="text-gray-800">{shortCaption || <span className="text-gray-400 italic">Caption will appear here…</span>}</span>
          {caption.length > 100 && (
            <button onClick={onExpandToggle} className="text-gray-500 ml-1 text-[11px]">
              {isExpanded ? 'less' : 'more'}
            </button>
          )}
        </div>
        <div className="text-[11px] text-gray-400 mt-1">View all 42 comments</div>
        <div className="text-[10px] text-gray-400 uppercase tracking-wide mt-1">2 hours ago</div>
      </div>
    </div>
  )
}

// ── LinkedIn Mockup ────────────────────────────────────────────────────────────

function LinkedInMockup({ caption, imageUrl, isVideo, status, isExpanded, onExpandToggle, brandName, brandLogo }: {
  caption: string; imageUrl: string | null; isVideo: boolean; status: string; isExpanded: boolean; onExpandToggle: () => void; brandName: string; brandLogo: string | null
}) {
  const shortCaption = !isExpanded && caption.length > 140 ? caption.slice(0, 140) + '…' : caption
  return (
    <div style={{ background: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      {/* Profile */}
      <div className="flex items-start justify-between px-3 py-3">
        <div className="flex items-start gap-2.5">
          <BrandAvatar brandName={brandName} brandLogo={brandLogo} size={40} gradientBg="#0A66C2" />
          <div>
            <div className="text-[13px] font-semibold text-gray-900 leading-tight">{brandName}</div>
            <div className="text-[11px] text-gray-500 leading-tight">Marketing · Company</div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[11px] text-gray-400">2h</span>
              <span className="text-gray-300">·</span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            </div>
          </div>
        </div>
        <button className="text-[11px] font-semibold px-3 py-1 rounded-full border" style={{ borderColor: '#0A66C2', color: '#0A66C2' }}>+ Follow</button>
      </div>

      {/* Caption */}
      <div className="px-3 pb-2.5 text-[13px] text-gray-800 leading-relaxed">
        {shortCaption || <span className="text-gray-400 italic">Caption will appear here…</span>}
        {caption.length > 140 && (
          <button onClick={onExpandToggle} className="ml-1 font-semibold text-gray-500 text-[12px]">
            {isExpanded ? 'Show less' : '…see more'}
          </button>
        )}
      </div>

      {/* Image — 4:3 */}
      <div className="relative w-full" style={{ aspectRatio: '4/3', background: '#f3f3f3', overflow: 'hidden' }}>
        {imageUrl ? (
          <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <ImagePlaceholder isVideo={isVideo} status={status} dark={false} />
        )}
      </div>

      {/* Reactions */}
      <div className="px-3 pt-2 pb-1">
        <div className="flex items-center justify-between text-[11px] text-gray-500 mb-2 pb-1.5" style={{ borderBottom: '1px solid #e5e7eb' }}>
          <div className="flex items-center gap-1">
            <span>👍❤️💡</span>
            <span>1,847</span>
          </div>
          <span>84 comments</span>
        </div>
        <div className="flex items-center justify-around pb-1">
          {[['👍','Like'],['💬','Comment'],['🔁','Repost'],['✉️','Send']].map(([icon, label]) => (
            <button key={label} className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-800 font-medium">
              <span className="text-[14px]">{icon}</span>{label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── TikTok Mockup ──────────────────────────────────────────────────────────────

function TikTokMockup({ caption, imageUrl, isVideo, status, brandName, brandLogo }: {
  caption: string; imageUrl: string | null; isVideo: boolean; status: string; brandName: string; brandLogo: string | null
}) {
  const handle = '@' + brandName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  return (
    <div className="relative flex" style={{ background: '#000', aspectRatio: '9/14', overflow: 'hidden' }}>
      {/* Background image/video */}
      {imageUrl ? (
        <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)' }}>
          <ImagePlaceholder isVideo={isVideo} status={status} dark={true} />
        </div>
      )}
      {/* Overlay gradient */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 50%)' }} />

      {/* Right sidebar icons */}
      <div className="absolute right-2.5 bottom-16 flex flex-col items-center gap-4">
        <div style={{ width: 36, height: 36, borderRadius: '9999px', border: '2px solid white', overflow: 'hidden', flexShrink: 0 }}>
          <BrandAvatar brandName={brandName} brandLogo={brandLogo} size={36} gradientBg="#fe2c55" />
        </div>
        {[
          { icon: '♥', count: '142K' }, { icon: '💬', count: '1.2K' },
          { icon: '⤴', count: '8.4K' }, { icon: '⊙', count: '' },
        ].map(({ icon, count }) => (
          <div key={icon} className="flex flex-col items-center gap-0.5">
            <span className="text-white text-2xl drop-shadow">{icon}</span>
            {count && <span className="text-white text-[10px] font-semibold">{count}</span>}
          </div>
        ))}
      </div>

      {/* Bottom caption */}
      <div className="absolute bottom-0 left-0 right-10 p-3">
        <div className="text-white text-[12px] font-bold mb-1">{handle}</div>
        <p className="text-white text-[11px] leading-relaxed line-clamp-2 drop-shadow">
          {caption || <span className="text-white/60 italic">Caption will appear here…</span>}
        </p>
        <div className="flex items-center gap-1.5 mt-2">
          <span className="text-white text-[13px] animate-spin" style={{ display: 'inline-block', animationDuration: '3s' }}>♪</span>
          <span className="text-white text-[10px]">Original Sound · {handle}</span>
        </div>
      </div>
    </div>
  )
}

// ── Generic Mockup ─────────────────────────────────────────────────────────────

function GenericMockup({ caption, imageUrl, isVideo, status, platform, isExpanded, onExpandToggle, brandName, brandLogo }: {
  caption: string; imageUrl: string | null; isVideo: boolean; status: string; platform: string; isExpanded: boolean; onExpandToggle: () => void; brandName: string; brandLogo: string | null
}) {
  const cfg = getPlatformConfig(platform)
  const shortCaption = !isExpanded && caption.length > 120 ? caption.slice(0, 120) + '…' : caption
  return (
    <div style={{ background: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <BrandAvatar brandName={brandName} brandLogo={brandLogo} size={32} gradientBg={cfg.color} />
        <div>
          <div className="text-[12px] font-semibold text-gray-900">{brandName}</div>
          <div className="text-[10px] text-gray-400">2h ago</div>
        </div>
      </div>
      <div className="px-3 pb-2 text-[12px] text-gray-800 leading-relaxed">
        {shortCaption || <span className="text-gray-400 italic">Caption will appear here…</span>}
        {caption.length > 120 && (
          <button onClick={onExpandToggle} className="text-gray-500 ml-1 text-[11px]">{isExpanded ? 'less' : 'more'}</button>
        )}
      </div>
      <div className="relative w-full" style={{ aspectRatio: '16/9', background: '#f3f3f3', overflow: 'hidden' }}>
        {imageUrl ? (
          <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <ImagePlaceholder isVideo={isVideo} status={status} dark={false} />
        )}
      </div>
      <div className="flex items-center gap-4 px-3 py-2 text-[11px] text-gray-500">
        <button className="flex items-center gap-1 hover:text-gray-800">👍 Like</button>
        <button className="flex items-center gap-1 hover:text-gray-800">💬 Comment</button>
        <button className="flex items-center gap-1 hover:text-gray-800">↗ Share</button>
      </div>
    </div>
  )
}

// ── Image Placeholder ──────────────────────────────────────────────────────────

function ImagePlaceholder({ isVideo, status, dark }: { isVideo: boolean; status: string; dark: boolean }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2"
      style={{ background: dark ? 'transparent' : '#f9f9f9' }}>
      <div className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{ background: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }}>
        <span className="text-2xl">{isVideo ? '🎬' : '🖼'}</span>
      </div>
      <span className="text-xs font-medium" style={{ color: dark ? 'rgba(255,255,255,0.5)' : '#9ca3af' }}>
        {status === 'GENERATING' ? (
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block" />
            Generating…
          </span>
        ) : isVideo ? 'Upload your video' : status === 'PENDING' ? 'Image will be generated' : 'No image yet'}
      </span>
    </div>
  )
}
