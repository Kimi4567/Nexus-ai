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
  // A/B Testing fields
  variantGroup: string | null
  variantLabel: string | null   // 'A' | 'B' | null
  variantWinner: boolean
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
  colorPalette: string[]
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
  const [brandProfile, setBrandProfile] = useState<BrandProfile>({ brandName: null, logoUrl: null, colorPalette: [] })
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
  const [approveResult, setApproveResult] = useState<{
    approved: number
    linked: number
    unlinked: number
    learned: { hooks: number; angles: number }
    platforms: string[]
    firstDate: string | null
    lastDate: string | null
  } | null>(null)
  const [rewritingPost, setRewritingPost] = useState<string | null>(null)
  const [enableABTesting, setEnableABTesting] = useState(false)
  const [pickingWinner, setPickingWinner] = useState<string | null>(null)
  const [generatingImageId, setGeneratingImageId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'DONE' | 'SCHEDULED'>('ALL')
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const autoBuildStartedRef = useRef(false)

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
            colorPalette: bData.brandProfile.colorPalette ?? [],
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

  const filteredPosts = posts
    .filter(p => activePlatform === 'ALL' || p.platform.toUpperCase() === activePlatform)
    .filter(p => {
      if (statusFilter === 'ALL') return true
      if (statusFilter === 'PENDING') return p.generationStatus === 'PENDING' || p.generationStatus === 'AWAITING_UPLOAD'
      if (statusFilter === 'DONE') return p.generationStatus === 'DONE'
      if (statusFilter === 'SCHEDULED') return p.status === 'SCHEDULED'
      return true
    })

  const platforms = ['ALL', ...Array.from(new Set(posts.map(p => p.platform.toUpperCase())))]

  const doneCount = posts.filter(p => p.generationStatus === 'DONE').length
  const totalImagePosts = posts.filter(p => !p.isVideoPost).length
  const progress = totalImagePosts > 0 ? Math.round((doneCount / totalImagePosts) * 100) : 0

  const getPendingEdit = (postId: string) => pendingEdits[postId] ?? {}

  // ── Generate content plan ────────────────────────────────────────────────────

  async function generatePlan(mediaSource: 'GENERATE' | 'MIXED' = 'GENERATE') {
    if (!isAuthenticated) return
    setGeneratingPlan(true)
    setError(null)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/generate-content-plan`, {
        method: 'POST',
        headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaSource, enableABTesting }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Generation failed')
      const abInfo = data.summary?.abTesting?.enabled
        ? ` · ${data.summary.abTesting.bVariants} B variants`
        : ''
      setSuccessMsg(`Content plan created: ${data.summary.total} posts ready for review${abInfo}`)
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGeneratingPlan(false)
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (autoBuildStartedRef.current || authLoading || loading || !isAuthenticated || generatingPlan || posts.length > 0) return

    const params = new URLSearchParams(window.location.search)
    if (params.get('buildPlan') !== '1') return

    autoBuildStartedRef.current = true
    params.delete('buildPlan')
    const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`
    window.history.replaceState(null, '', nextUrl)
    void generatePlan('MIXED')
  }, [authLoading, loading, isAuthenticated, generatingPlan, posts.length])

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

      // Reload posts so we can compute schedule window from updated state
      await loadData()

      // Build approval result for the summary modal
      // (posts state is now updated after loadData)
      const scheduledPosts = posts.filter(p => p.status === 'SCHEDULED' && p.scheduledAt)
      const scheduledDates = scheduledPosts
        .map(p => p.scheduledAt!)
        .sort()
      const platformsUsed = [...new Set(scheduledPosts.map(p => p.platform.toUpperCase()))]

      setApproveResult({
        approved:  data.approved  ?? 0,
        linked:    data.linked    ?? 0,
        unlinked:  data.unlinked  ?? 0,
        learned: {
          hooks:  data.learned?.hooks  ?? 0,
          angles: data.learned?.angles ?? 0,
        },
        platforms: platformsUsed.length > 0 ? platformsUsed : (data.summary?.platforms ?? []),
        firstDate: scheduledDates[0] ?? null,
        lastDate:  scheduledDates[scheduledDates.length - 1] ?? null,
      })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setApproving(false)
    }
  }

  // ── AI Rewrite a post caption ─────────────────────────────────────────────────

  async function rewritePost(postId: string, instruction: string) {
    if (!isAuthenticated) return
    setRewritingPost(postId)
    setError(null)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/content-plan/${postId}/rewrite`, {
        method: 'POST',
        headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.code === 'INSUFFICIENT_CREDITS') {
          setError('Not enough credits to rewrite. Upgrade your plan.')
        } else {
          throw new Error(data.error ?? 'Rewrite failed')
        }
        return
      }
      // Update caption in state immediately (no re-fetch needed)
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, caption: data.post.caption } : p))
      // Clear any pending edit for this post so it shows the fresh caption
      setPendingEdits(prev => {
        const next = { ...prev }
        delete next[postId]
        return next
      })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setRewritingPost(null)
    }
  }

  // ── Generate real AI image for a single post ─────────────────────────────────
  // Calls /api/visuals/generate → gpt-image-1 or Flux → Cloudinary + brand overlay

  async function generatePostImage(postId: string, platform: string) {
    if (!isAuthenticated) return
    const post = posts.find(p => p.id === postId)
    if (!post) return

    setGeneratingImageId(postId)
    setError(null)
    try {
      // Platform mapping — drives both image dimensions and Cloudinary crop.
      // META feed posts are square (1:1) same as INSTAGRAM; FACEBOOK is landscape.
      // TIKTOK is portrait 4:5. LINKEDIN is landscape 1.91:1.
      const platformMap: Record<string, string> = {
        META:      'INSTAGRAM',  // Meta feed → square 1024×1024
        INSTAGRAM: 'INSTAGRAM',  // Instagram → square 1024×1024
        FACEBOOK:  'FACEBOOK',   // Facebook  → landscape 1536×1024
        LINKEDIN:  'LINKEDIN',   // LinkedIn  → landscape 1536×1024
        TIKTOK:    'TIKTOK',     // TikTok    → portrait  1024×1536
        X:         'FACEBOOK',   // X/Twitter → landscape
        TWITTER:   'FACEBOOK',   // X/Twitter → landscape
      }
      const mappedPlatform = platformMap[platform.toUpperCase()] || 'INSTAGRAM'

      // Call the existing brand-aware image generation route
      // postCaption drives the scene; brand colors + logo overlay applied server-side
      const res = await fetch('/api/visuals/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader(),
        },
        body: JSON.stringify({
          campaignId:  campaign?.id,
          platform:    mappedPlatform,
          visualType:  'SOCIAL_PREVIEW',
          visualStyle: 'Premium',
          postCaption: post.caption || post.imagePrompt || '',
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Image generation failed')
      }

      const data = await res.json()
      const imageUrl = data?.visual?.imageUrl
      if (!imageUrl) throw new Error('No image URL returned')

      await savePostEdit(postId, { imageUrl, generationStatus: 'DONE' })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGeneratingImageId(null)
    }
  }

  // ── Pick A/B winner ───────────────────────────────────────────────────────────

  async function pickWinner(postId: string) {
    if (!isAuthenticated) return
    setPickingWinner(postId)
    setError(null)
    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/content-plan/${postId}/pick-winner`,
        { method: 'PATCH', headers: { Authorization: authHeader() } },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to pick winner')

      // Remove the loser from local state, mark winner
      setPosts(prev => {
        const winner = prev.find(p => p.id === postId)
        if (!winner) return prev
        const varGroup = winner.variantGroup
        // Keep posts where: not in this variantGroup OR same id as winner
        return prev
          .filter(p => !varGroup || p.variantGroup !== varGroup || p.id === postId)
          .map(p => p.id === postId
            ? { ...p, variantWinner: true, variantGroup: null, variantLabel: null }
            : p,
          )
      })

      setSuccessMsg(
        data.hookLearned
          ? '🏆 Winner selected! Hook added to Brand Brain.'
          : '🏆 Winner selected!',
      )
    } catch (err: any) {
      setError(err.message)
    } finally {
      setPickingWinner(null)
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
                  onClick={() => generatePlan()}
                  disabled={generatingPlan}
                  className="px-4 py-2 rounded-xl text-sm border transition-all"
                  style={{ borderColor: 'rgba(139,92,246,0.3)', color: '#a78bfa' }}
                >
                  {generatingPlan ? 'Regenerating...' : '↻ Regenerate Plan'}
                </button>
              </>
            )}

            {posts.length === 0 && (
              <div className="flex items-center gap-3">
                {/* A/B Testing toggle */}
                <button
                  onClick={() => setEnableABTesting(prev => !prev)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                  style={{
                    background: enableABTesting ? 'rgba(234,179,8,0.12)' : 'rgba(255,255,255,0.04)',
                    border: enableABTesting ? '1px solid rgba(234,179,8,0.35)' : '1px solid rgba(255,255,255,0.08)',
                    color: enableABTesting ? '#fbbf24' : '#6b7280',
                  }}
                  title="Generate A/B variants for each post — compare two hook styles and pick the winner"
                >
                  <span>A/B</span>
                  <span className={`w-6 h-3 rounded-full relative transition-all ${enableABTesting ? 'bg-yellow-500' : 'bg-gray-600'}`}>
                    <span className={`absolute top-0.5 w-2 h-2 bg-white rounded-full shadow transition-all ${enableABTesting ? 'left-3.5' : 'left-0.5'}`} />
                  </span>
                </button>
                <button
                  onClick={() => generatePlan()}
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
              </div>
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

        {/* ── Filter bar (sticky) ──────────────────────────────────── */}
        {posts.length > 0 && (
          <div className="sticky top-0 z-10 mb-5 -mx-6 px-6 py-3"
            style={{ background: 'rgba(13,10,25,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {/* Platform tabs */}
            <div className="flex gap-2 flex-wrap mb-2.5">
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
                      background: isActive ? (cfg ? cfg.color : 'rgba(139,92,246,0.8)') : 'rgba(255,255,255,0.05)',
                      color: isActive ? '#fff' : '#9ca3af',
                      border: isActive ? `1px solid ${cfg ? cfg.color : '#7c3aed'}` : '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    {cfg && <span>{cfg.icon}</span>}
                    {p === 'ALL' ? 'All Platforms' : (cfg?.label ?? p)}
                    <span className="text-xs px-1.5 py-0.5 rounded-full"
                      style={{ background: isActive ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)', color: isActive ? '#fff' : '#6b7280' }}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
            {/* Status filter */}
            <div className="flex gap-1.5 items-center">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-600 mr-1">Status</span>
              {(['ALL', 'PENDING', 'DONE', 'SCHEDULED'] as const).map(s => {
                const isActive = statusFilter === s
                const label = s === 'ALL' ? 'All' : s === 'PENDING' ? 'Pending' : s === 'DONE' ? '✓ Ready' : '🗓 Scheduled'
                const activeColor = s === 'DONE' ? '#10b981' : s === 'PENDING' ? '#f59e0b' : s === 'SCHEDULED' ? '#6366f1' : '#7c3aed'
                return (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: isActive ? `${activeColor}22` : 'rgba(255,255,255,0.03)',
                      color: isActive ? activeColor : '#6b7280',
                      border: isActive ? `1px solid ${activeColor}44` : '1px solid rgba(255,255,255,0.06)',
                    }}>
                    {label}
                  </button>
                )
              })}
              {(activePlatform !== 'ALL' || statusFilter !== 'ALL') && (
                <button onClick={() => { setActivePlatform('ALL'); setStatusFilter('ALL') }}
                  className="px-2 py-1 rounded-lg text-xs text-gray-600 hover:text-gray-400 transition-all ml-1"
                  style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                  ✕ Clear
                </button>
              )}
            </div>
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
        {filteredPosts.length > 0 && (() => {
          // Group posts: A/B pairs are rendered together, standalone posts are standalone
          const sorted = [...filteredPosts].sort((a, b) => (a.contentPlanIndex ?? 0) - (b.contentPlanIndex ?? 0))

          // Build render items: A/B pairs as { type: 'ab', a, b } or standalone as { type: 'single', post }
          type RenderItem =
            | { type: 'single'; post: ContentPost }
            | { type: 'ab'; a: ContentPost; b: ContentPost }

          const seen = new Set<string>()
          const items: RenderItem[] = []

          for (const post of sorted) {
            if (seen.has(post.id)) continue
            if (post.variantGroup) {
              const sibling = sorted.find(p => p.variantGroup === post.variantGroup && p.id !== post.id)
              if (sibling && !seen.has(sibling.id)) {
                const [a, b] = post.variantLabel === 'A' ? [post, sibling] : [sibling, post]
                items.push({ type: 'ab', a, b })
                seen.add(post.id)
                seen.add(sibling.id)
                continue
              }
            }
            items.push({ type: 'single', post })
            seen.add(post.id)
          }

          const renderCard = (post: ContentPost) => (
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
              isRewriting={rewritingPost === post.id}
              isPickingWinner={pickingWinner === post.id}
              isGeneratingImage={generatingImageId === post.id}
              onGenerateImage={() => generatePostImage(post.id, post.platform)}
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
              onRewrite={(instruction) => rewritePost(post.id, instruction)}
              onPickWinner={post.variantGroup ? () => pickWinner(post.id) : undefined}
            />
          )

          // Pre-group: consecutive singles share a grid row; A/B pairs break out full-width
          type RenderGroup =
            | { type: 'singles'; posts: ContentPost[] }
            | { type: 'ab'; a: ContentPost; b: ContentPost; groupKey: string }
          const groups: RenderGroup[] = []
          let singlesBuffer: ContentPost[] = []
          for (const item of items) {
            if (item.type === 'single') {
              singlesBuffer.push(item.post)
            } else {
              if (singlesBuffer.length) { groups.push({ type: 'singles', posts: singlesBuffer }); singlesBuffer = [] }
              groups.push({ type: 'ab', a: item.a, b: item.b, groupKey: `ab-${item.a.variantGroup ?? item.a.id}` })
            }
          }
          if (singlesBuffer.length) groups.push({ type: 'singles', posts: singlesBuffer })

          return (
            <div className="space-y-4">
              {groups.map((group) => {
                if (group.type === 'singles') {
                  return (
                    <div key={`singles-${group.posts[0].id}`} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {group.posts.map(p => renderCard(p))}
                    </div>
                  )
                }
                // A/B pair — full-width container
                return (
                  <div key={group.groupKey} className="rounded-2xl overflow-hidden"
                    style={{ border: '1px solid rgba(234,179,8,0.25)', background: 'rgba(234,179,8,0.02)' }}>
                    <div className="flex items-center gap-2 px-4 py-2.5"
                      style={{ background: 'rgba(234,179,8,0.06)', borderBottom: '1px solid rgba(234,179,8,0.15)' }}>
                      <span className="text-sm font-semibold" style={{ color: '#fbbf24' }}>⚡ A/B Test</span>
                      <span className="text-xs text-gray-500">· Compare both variants and pick the winner</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                      {renderCard(group.a)}
                      {renderCard(group.b)}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()}

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

        {/* ── Approval Summary Modal ────────────────────────────────── */}
        {approveResult && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.8)' }}
            onClick={() => setApproveResult(null)}
          >
            <div
              className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
              style={{ background: '#1a1625', border: '1px solid rgba(5,150,105,0.35)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Top accent bar */}
              <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #059669, #34d399, #7c3aed)' }} />

              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                      style={{ background: 'rgba(5,150,105,0.12)', border: '1px solid rgba(5,150,105,0.25)' }}>
                      🚀
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        {approveResult.approved} posts scheduled!
                      </h3>
                      <p className="text-sm text-emerald-400">Your content plan is live</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setApproveResult(null)}
                    className="text-gray-500 hover:text-gray-300 text-xl leading-none"
                  >×</button>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="rounded-xl p-3 text-center"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="text-2xl font-bold text-white">{approveResult.approved}</div>
                    <div className="text-xs text-gray-400 mt-0.5">Posts</div>
                  </div>
                  <div className="rounded-xl p-3 text-center"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="text-2xl font-bold text-emerald-400">{approveResult.linked}</div>
                    <div className="text-xs text-gray-400 mt-0.5">Linked</div>
                  </div>
                  <div className="rounded-xl p-3 text-center"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="text-2xl font-bold text-purple-400">{approveResult.platforms.length}</div>
                    <div className="text-xs text-gray-400 mt-0.5">Platforms</div>
                  </div>
                </div>

                {/* Platform breakdown */}
                {approveResult.platforms.length > 0 && (
                  <div className="rounded-xl p-3 mb-4"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Publishing to</p>
                    <div className="flex flex-wrap gap-2">
                      {approveResult.platforms.map(p => {
                        const cfg = getPlatformConfig(p)
                        const count = posts.filter(post => post.platform.toUpperCase() === p && post.status === 'SCHEDULED').length
                        return (
                          <div key={p} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                            style={{ background: `${cfg.color}18`, border: `1px solid ${cfg.color}35`, color: cfg.color }}>
                            <span>{cfg.icon}</span>
                            <span>{cfg.label}</span>
                            {count > 0 && <span className="opacity-70">×{count}</span>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Schedule window */}
                {(approveResult.firstDate || approveResult.lastDate) && (
                  <div className="rounded-xl p-3 mb-4 flex items-center gap-3"
                    style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.18)' }}>
                    <span className="text-lg">📅</span>
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Publishing window</p>
                      <p className="text-sm text-purple-300 font-medium">
                        {approveResult.firstDate
                          ? new Date(approveResult.firstDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : '—'}
                        {' → '}
                        {approveResult.lastDate
                          ? new Date(approveResult.lastDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : '—'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Brand Brain learning */}
                {(approveResult.learned.hooks > 0 || approveResult.learned.angles > 0) && (
                  <div className="rounded-xl p-3 mb-5 flex items-start gap-3"
                    style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)' }}>
                    <span className="text-xl mt-0.5">🧠</span>
                    <div>
                      <p className="text-sm font-semibold text-purple-300 mb-0.5">Brand Brain updated</p>
                      <p className="text-xs text-gray-400">
                        Learned{' '}
                        {approveResult.learned.hooks > 0 && (
                          <span className="text-purple-300 font-medium">{approveResult.learned.hooks} winning hooks</span>
                        )}
                        {approveResult.learned.hooks > 0 && approveResult.learned.angles > 0 && ' + '}
                        {approveResult.learned.angles > 0 && (
                          <span className="text-purple-300 font-medium">{approveResult.learned.angles} content angles</span>
                        )}
                        {' '}from your approved content — future campaigns will feel even more on-brand.
                      </p>
                    </div>
                  </div>
                )}

                {/* Unlinked warning */}
                {approveResult.unlinked > 0 && (
                  <div className="rounded-xl p-3 mb-5 flex items-start gap-3"
                    style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <span className="text-base mt-0.5">⚠️</span>
                    <div>
                      <p className="text-xs text-amber-400">
                        {approveResult.unlinked} post{approveResult.unlinked !== 1 ? 's have' : ' has'} no connected platform yet.
                        Connect your social accounts in{' '}
                        <button
                          onClick={() => { setApproveResult(null); router.push('/connections') }}
                          className="underline hover:no-underline"
                        >Connections</button>{' '}
                        to enable auto-publishing.
                      </p>
                    </div>
                  </div>
                )}

                {/* CTA buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setApproveResult(null)
                      generateAllImages()
                    }}
                    disabled={posts.filter(p => p.generationStatus === 'PENDING' && !p.isVideoPost).length === 0}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
                  >
                    ✨ Generate Images
                  </button>
                  <button
                    onClick={() => { setApproveResult(null); router.push('/schedule') }}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border"
                    style={{ borderColor: 'rgba(5,150,105,0.35)', color: '#34d399' }}
                  >
                    📅 View Schedule
                  </button>
                </div>
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

// ── Caption Quality Scorer ────────────────────────────────────────────────────
// Pure client-side — no API call. Returns grade + score + breakdown for tooltip.

const PLATFORM_IDEAL_LEN: Record<string, [number, number]> = {
  TIKTOK:    [60,  150],
  INSTAGRAM: [125, 300],
  META:      [100, 250],
  FACEBOOK:  [100, 250],
  LINKEDIN:  [200, 500],
  X:         [80,  230],
  TWITTER:   [80,  230],
  GENERAL:   [100, 300],
}

function scoreCaption(caption: string, platform: string): { grade: 'A+' | 'A' | 'B' | 'C'; score: number; color: string; tip: string } {
  if (!caption || caption.length < 10) return { grade: 'C', score: 0, color: '#ef4444', tip: 'Caption is too short' }

  let score = 0
  const tips: string[] = []
  const p = platform?.toUpperCase() || 'GENERAL'
  const first = caption.split('\n')[0] || caption.slice(0, 100)

  // ── Hook quality (25 pts) — compelling opening ─────────────────────────���───
  const hookPatterns = [/^[🔥💡⚡🚀🎯✨💪🙌👇]/u, /\?/, /^[0-9]/, /\b(how|why|what|top|best|secret|truth|want|need|stop|start|never|always|warning|attention|breaking|introducing|announcing)\b/i]
  const hookScore = hookPatterns.filter(p => p.test(first)).length
  if (hookScore >= 2) score += 25
  else if (hookScore === 1) { score += 12; tips.push('Strengthen your opening hook') }
  else tips.push('Add a compelling hook to the first line')

  // ── CTA presence (25 pts) ───────────────────────��─────────────────────────
  const ctaPatterns = /\b(click|tap|swipe|comment|follow|save|share|like|tag|visit|check|learn|get|sign up|subscribe|dm|message|link in bio|try|buy|order|book|register)\b/i
  if (ctaPatterns.test(caption)) score += 25
  else tips.push('Add a clear call-to-action')

  // ── Length appropriateness (20 pts) ──────────────────────────────────────
  const [minLen, maxLen] = PLATFORM_IDEAL_LEN[p] ?? [100, 300]
  const len = caption.length
  if (len >= minLen && len <= maxLen) score += 20
  else if (len < minLen) { score += 8; tips.push(`Caption is short for ${p}`) }
  else { score += 12; tips.push('Consider trimming for better reach') }

  // ── Emoji presence (15 pts) ───────────────────────────────────────────────
  const emojiCount = (caption.match(/\p{Emoji}/gu) || []).length
  if (emojiCount >= 1 && emojiCount <= 5) score += 15
  else if (emojiCount > 5) { score += 8; tips.push('Too many emojis — aim for 1-5') }
  else tips.push('Add 1-2 emojis to increase engagement')

  // ── Hashtags (15 pts) ─────────────────────────────────────────────────────
  const hashCount = (caption.match(/#\w+/g) || []).length
  if (hashCount >= 2 && hashCount <= 10) score += 15
  else if (hashCount === 1) { score += 8; tips.push('Add 3-5 relevant hashtags') }
  else if (hashCount > 10) { score += 10; tips.push('Too many hashtags — aim for 3-7') }
  else tips.push('Add relevant hashtags')

  const clampedScore = Math.min(100, score)
  const grade = clampedScore >= 85 ? 'A+' : clampedScore >= 70 ? 'A' : clampedScore >= 50 ? 'B' : 'C'
  const color = clampedScore >= 85 ? '#10b981' : clampedScore >= 70 ? '#06b6d4' : clampedScore >= 50 ? '#f59e0b' : '#ef4444'
  const tip = tips.length > 0 ? tips[0] : grade === 'A+' ? 'Excellent post quality!' : 'Good post'
  return { grade, score: clampedScore, color, tip }
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
  isRewriting: boolean
  isPickingWinner: boolean
  isGeneratingImage: boolean
  onGenerateImage: () => Promise<void>
  onToggleExpand: () => void
  onEditCaption: () => void
  onEditPrompt: () => void
  onOpenMediaPicker: () => void
  onCloseMediaPicker: () => void
  onSaveEdit: (updates: Partial<ContentPost>) => Promise<void>
  onAssignMedia: (mediaId: string, url: string) => Promise<void>
  onPendingEdit: (updates: Partial<ContentPost>) => void
  onRewrite: (instruction: string) => Promise<void>
  onPickWinner?: () => void
}

function PostCard({
  post,
  pendingEdit,
  brandName,
  brandLogo,
  isExpanded,
  isEditingCaption,
  isRewriting,
  isPickingWinner,
  isGeneratingImage,
  onGenerateImage,
  onToggleExpand,
  onEditCaption,
  onOpenMediaPicker,
  onSaveEdit,
  onPendingEdit,
  onRewrite,
  onPickWinner,
}: PostCardProps) {
  const [showRewriteInput, setShowRewriteInput] = useState(false)
  const [rewriteInstruction, setRewriteInstruction] = useState('')

  const platform = post.platform.toUpperCase()
  const caption = pendingEdit.caption ?? post.caption
  const hasImage = !!post.imageUrl
  const isVideo = post.isVideoPost
  const status = post.generationStatus
  const quality = caption.length > 20 ? scoreCaption(caption, platform) : null

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
          {/* A/B variant badge */}
          {post.variantLabel && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
              style={{
                background: post.variantLabel === 'A' ? 'rgba(234,179,8,0.15)' : 'rgba(99,102,241,0.15)',
                color: post.variantLabel === 'A' ? '#fbbf24' : '#a5b4fc',
                border: post.variantLabel === 'A' ? '1px solid rgba(234,179,8,0.35)' : '1px solid rgba(99,102,241,0.35)',
              }}>
              Variant {post.variantLabel}
            </span>
          )}
          {post.variantWinner && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
              style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}>
              🏆 Winner
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {/* Quality Score Badge */}
          {quality && (
            <span
              title={quality.tip}
              className="text-[10px] font-black px-1.5 py-0.5 rounded-md cursor-help"
              style={{ background: `${quality.color}15`, color: quality.color, border: `1px solid ${quality.color}35`, letterSpacing: '0.02em' }}>
              {quality.grade}
            </span>
          )}
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"
            style={{ background: `${statusColor}18`, color: statusColor }}>
            {status === 'GENERATING' && <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block" style={{ background: statusColor }} />}
            {statusLabel}
          </span>
        </div>
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

      {/* ── AI Rewrite input overlay ──────── */}
      {showRewriteInput && !isEditingCaption && (
        <div className="px-3 pb-3 pt-2" style={{ borderTop: '1px solid rgba(124,58,237,0.15)', background: 'rgba(124,58,237,0.04)' }}>
          <p className="text-[10px] text-purple-400 font-medium mb-1.5 flex items-center gap-1">
            <span>✨</span> Rewrite instruction <span className="text-gray-600">(optional)</span>
          </p>
          <input
            type="text"
            className="w-full rounded-xl text-xs px-3 py-2 focus:outline-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(124,58,237,0.35)', color: '#e5e7eb' }}
            placeholder='e.g. "make it more casual" or "add urgency"'
            value={rewriteInstruction}
            onChange={e => setRewriteInstruction(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onRewrite(rewriteInstruction).then(() => {
                  setShowRewriteInput(false)
                  setRewriteInstruction('')
                })
              }
              if (e.key === 'Escape') {
                setShowRewriteInput(false)
                setRewriteInstruction('')
              }
            }}
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => { setShowRewriteInput(false); setRewriteInstruction('') }}
              className="text-xs px-3 py-1.5 rounded-lg text-gray-500 hover:text-white transition-colors"
            >Cancel</button>
            <button
              onClick={() => {
                onRewrite(rewriteInstruction).then(() => {
                  setShowRewriteInput(false)
                  setRewriteInstruction('')
                })
              }}
              disabled={isRewriting}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white transition-all flex items-center gap-1.5"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', opacity: isRewriting ? 0.7 : 1 }}
            >
              {isRewriting
                ? <><span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />Rewriting…</>
                : <>✨ Rewrite</>
              }
            </button>
          </div>
        </div>
      )}

      {/* ── Action row ───────────────────── */}
      <div className="flex border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <button onClick={onEditCaption}
          className="flex-1 py-2.5 text-xs font-medium text-gray-500 hover:text-purple-400 hover:bg-purple-500/5 transition-all flex items-center justify-center gap-1.5">
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11.5 2.5a2.121 2.121 0 013 3L5 15l-4 1 1-4L11.5 2.5z"/></svg>
          Edit
        </button>
        <button
          onClick={() => { setShowRewriteInput(v => !v); setRewriteInstruction('') }}
          disabled={isRewriting}
          className="flex-1 py-2.5 text-xs font-medium hover:bg-purple-500/5 transition-all border-l flex items-center justify-center gap-1"
          style={{ borderColor: 'rgba(255,255,255,0.06)', color: isRewriting ? '#7c3aed' : '#9b87f5' }}
        >
          {isRewriting
            ? <><span className="w-2.5 h-2.5 border border-purple-400/40 border-t-purple-400 rounded-full animate-spin" />Rewriting</>
            : <>✨ Rewrite</>
          }
        </button>
        {/* Generate AI image (disabled for TikTok — needs real video) */}
        {platform === 'TIKTOK' ? (
          <button onClick={onOpenMediaPicker}
            className="flex-1 py-2.5 text-xs font-medium transition-all border-l flex items-center justify-center gap-1"
            style={{ borderColor: 'rgba(255,255,255,0.06)', color: '#f472b6' }}
            title="TikTok requires real video — upload yours">
            📹 Vid
          </button>
        ) : (
          <button
            onClick={onGenerateImage}
            disabled={isGeneratingImage}
            className="flex-1 py-2.5 text-xs font-medium transition-all border-l flex items-center justify-center gap-1"
            style={{ borderColor: 'rgba(255,255,255,0.06)', color: isGeneratingImage ? '#a78bfa' : '#8b5cf6' }}
          >
            {isGeneratingImage
              ? <><span className="w-2.5 h-2.5 border border-purple-400/40 border-t-purple-400 rounded-full animate-spin" />Gen…</>
              : <>🎨 Gen</>
            }
          </button>
        )}
        {onPickWinner ? (
          /* A/B test: replace "Image" button with "Pick Winner" */
          <button
            onClick={onPickWinner}
            disabled={isPickingWinner}
            className="flex-1 py-2.5 text-xs font-semibold transition-all border-l flex items-center justify-center gap-1"
            style={{
              borderColor: 'rgba(234,179,8,0.25)',
              color: isPickingWinner ? '#fbbf24' : '#fcd34d',
              background: 'rgba(234,179,8,0.04)',
            }}
          >
            {isPickingWinner
              ? <><span className="w-2.5 h-2.5 border border-yellow-400/40 border-t-yellow-400 rounded-full animate-spin" />Picking…</>
              : <>🏆 Win</>
            }
          </button>
        ) : (
          <button onClick={onOpenMediaPicker}
            className="flex-1 py-2.5 text-xs font-medium text-gray-500 hover:text-blue-400 hover:bg-blue-500/5 transition-all border-l flex items-center justify-center gap-1.5"
            style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="2" width="12" height="12" rx="2"/><circle cx="5.5" cy="5.5" r="1"/><path d="M14 10l-4-4-3 3-1.5-1.5L2 11"/></svg>
            {isVideo ? 'Vid' : 'Img'}
          </button>
        )}
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
            <div className="text-[10px] text-gray-400">Just now</div>
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
