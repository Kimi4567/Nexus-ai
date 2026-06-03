'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'

// ─── Types ────────────────────────────────────────────────────────────────────

interface VideoScene {
  sceneNumber: number
  timeRange: string
  visual: string
  cameraMotion: string
  voiceover?: string
  purpose: string
}

interface VideoBrief {
  concept: string
  narrative: string
  durationSeconds: number
  primaryPlatform: string
  scenes: VideoScene[]
  script: string
  visualTreatment: string
  musicMood: string
  callToAction: string
  generationPrompt: string
}

type GenerationStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | null

interface VideoGeneratorProps {
  campaignId: string
  campaignName?: string
}

// ─── Status pill ──────────────────────────────────────────────────────────────

function StatusPill({ status, progress }: { status: GenerationStatus; progress: number }) {
  if (!status) return null

  const configs: Record<NonNullable<GenerationStatus>, { label: string; color: string; bg: string; border: string; pulse: boolean }> = {
    QUEUED:     { label: 'Queued',     color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  pulse: true  },
    PROCESSING: { label: 'Generating', color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   pulse: true  },
    COMPLETED:  { label: 'Completed',  color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/30',  pulse: false },
    FAILED:     { label: 'Failed',     color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30',    pulse: false },
    CANCELLED:  { label: 'Cancelled',  color: 'text-gray-400',   bg: 'bg-gray-500/10',   border: 'border-gray-500/30',   pulse: false },
  }

  const c = configs[status]

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${c.bg} ${c.border} ${c.color}`}>
      {c.pulse && (
        <span className="relative flex h-2 w-2">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${status === 'QUEUED' ? 'bg-amber-400' : 'bg-blue-400'}`} />
          <span className={`relative inline-flex rounded-full h-2 w-2 ${status === 'QUEUED' ? 'bg-amber-400' : 'bg-blue-400'}`} />
        </span>
      )}
      {status === 'COMPLETED' && <span>✓</span>}
      {status === 'FAILED' && <span>✕</span>}
      {c.label}
      {(status === 'PROCESSING') && progress > 0 && ` · ${progress}%`}
    </div>
  )
}

// ─── Scene card ───────────────────────────────────────────────────────────────

function SceneCard({ scene }: { scene: VideoScene }) {
  return (
    <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-[10px] font-bold text-violet-400">
            {scene.sceneNumber}
          </span>
          <span className="text-[10px] font-semibold text-gray-500 font-mono">{scene.timeRange}</span>
        </div>
      </div>
      <p className="text-[12px] text-gray-200 leading-relaxed">{scene.visual}</p>
      <div className="flex flex-wrap gap-2 text-[10px]">
        <span className="px-2 py-0.5 rounded bg-[#1a1a1a] border border-[#2a2a2a] text-gray-500">
          📷 {scene.cameraMotion}
        </span>
        {scene.voiceover && (
          <span className="px-2 py-0.5 rounded bg-[#1a1a1a] border border-[#2a2a2a] text-gray-500">
            🎙 {scene.voiceover.slice(0, 60)}{scene.voiceover.length > 60 ? '…' : ''}
          </span>
        )}
      </div>
      <p className="text-[10px] text-gray-600 italic">{scene.purpose}</p>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function VideoGenerator({ campaignId, campaignName }: VideoGeneratorProps) {
  const { authHeader } = useAuth()

  // ── Mode toggle: strategy-based vs image-to-video ─────────────────────────
  const [videoMode, setVideoMode] = useState<'strategy' | 'img2video'>('strategy')

  // ── Strategy mode state ───────────────────────────────────────────────────
  const [brief, setBrief] = useState<VideoBrief | null>(null)
  const [loadingBrief, setLoadingBrief] = useState(true)
  const [generatingBrief, setGeneratingBrief] = useState(false)
  const [briefError, setBriefError] = useState('')

  // ── Image-to-video mode state ─────────────────────────────────────────────
  const [selectedImage, setSelectedImage] = useState<{ id: string; url: string; fileName: string } | null>(null)
  const [motionHint, setMotionHint] = useState('smooth cinematic motion')
  const [mediaList, setMediaList] = useState<Array<{ id: string; url: string; fileName: string; type: string }>>([])
  const [loadingMedia, setLoadingMedia] = useState(false)

  // ── Duration ──────────────────────────────────────────────────────────────
  const [durationSeconds, setDurationSeconds] = useState<5 | 10>(5)

  // ── Shared generation state — per mode ───────────────────────────────────
  // Each mode keeps its own video URL so switching tabs doesn't erase the video
  const [strategyVideoUrl, setStrategyVideoUrl] = useState<string | null>(null)
  const [img2videoUrl, setImg2VideoUrl] = useState<string | null>(null)

  const [generationId, setGenerationId] = useState<string | null>(null)
  const [genStatus, setGenStatus] = useState<GenerationStatus>(null)
  const [genProgress, setGenProgress] = useState(0)
  const [genError, setGenError] = useState('')
  const [upgradeNeeded, setUpgradeNeeded] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [providerAvailable, setProviderAvailable] = useState<boolean | null>(null)

  // Active video URL derived from current mode
  const videoUrl = videoMode === 'strategy' ? strategyVideoUrl : img2videoUrl
  const setVideoUrl = videoMode === 'strategy' ? setStrategyVideoUrl : setImg2VideoUrl

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollCountRef = useRef(0)
  const MAX_POLLS = 120 // 10 minutes at 5s interval
  // Captures the mode at generation start so polling saves to the correct URL slot
  const generationModeRef = useRef<'strategy' | 'img2video'>('strategy')

  // ── Fetch existing brief + restore last generated videos on mount ─────────
  useEffect(() => {
    const load = async () => {
      const token = authHeader()
      if (!token) { setLoadingBrief(false); return }

      // Load brief
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/video-brief`, {
          headers: { Authorization: token },
        })
        if (res.ok) {
          const data = await res.json()
          if (data.videoBrief) setBrief(data.videoBrief)
        }
      } catch { /* ignore */ }

      // Restore last completed videos from DB (so switching tabs / navigating away doesn't lose the video)
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/video-status`, {
          headers: { Authorization: token },
        })
        if (res.ok) {
          const data = await res.json()
          if (data.strategy?.videoUrl) {
            setStrategyVideoUrl(data.strategy.videoUrl)
            // Default mode is strategy — set status so the video renders
            setGenStatus('COMPLETED')
          }
          if (data.img2video?.videoUrl) {
            setImg2VideoUrl(data.img2video.videoUrl)
          }
        }
      } catch { /* ignore — table may not exist yet */ }

      setLoadingBrief(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId])

  // ── Stop polling on unmount ───────────────────────────────────────────────
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  // ── Reset generation state for current mode (clears this mode's video) ───
  const resetGeneration = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    // Clear only current mode's video
    if (videoMode === 'strategy') setStrategyVideoUrl(null)
    else setImg2VideoUrl(null)
    setGenStatus(null)
    setGenProgress(0)
    setGenerationId(null)
    setGenError('')
    setUpgradeNeeded(false)
    setSubmitting(false)
  }, [videoMode])

  // ── Switch mode — preserve each mode's video, restore correct status ────
  const handleModeSwitch = useCallback((mode: 'strategy' | 'img2video') => {
    // Stop any active poll first
    if (pollRef.current) clearInterval(pollRef.current)
    setGenError('')
    setUpgradeNeeded(false)
    setGenProgress(0)
    setGenerationId(null)
    setSubmitting(false)
    setVideoMode(mode)
    // Restore status for the target mode
    if (mode === 'strategy') {
      setGenStatus(strategyVideoUrl ? 'COMPLETED' : null)
    } else {
      setGenStatus(img2videoUrl ? 'COMPLETED' : null)
    }
  }, [strategyVideoUrl, img2videoUrl])

  // ── Load workspace images when img2video mode is selected ─────────────────
  useEffect(() => {
    if (videoMode !== 'img2video' || mediaList.length > 0) return
    const token = authHeader()
    if (!token) return
    setLoadingMedia(true)
    fetch('/api/media?type=IMAGE&limit=24', { headers: { Authorization: token } })
      .then(r => r.json())
      .then(data => {
        setMediaList(
          (data.media || []).filter((m: any) => m.type === 'IMAGE' || m.type === 'LOGO')
        )
      })
      .catch(() => {})
      .finally(() => setLoadingMedia(false))
  }, [videoMode, mediaList.length, authHeader])

  // ── Generate video brief ──────────────────────────────────────────────────
  const handleGenerateBrief = async () => {
    const token = authHeader()
    if (!token) return
    setGeneratingBrief(true)
    setBriefError('')
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/video-brief`, {
        method: 'POST',
        headers: { Authorization: token },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Video brief generation failed')
      setBrief(data.videoBrief)
    } catch (err: any) {
      setBriefError(err.message || 'Failed to generate video brief. Please try again.')
    }
    setGeneratingBrief(false)
  }

  // ── Poll generation status ────────────────────────────────────────────────
  const startPolling = useCallback((gId: string) => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollCountRef.current = 0

    pollRef.current = setInterval(async () => {
      pollCountRef.current++
      if (pollCountRef.current > MAX_POLLS) {
        clearInterval(pollRef.current!)
        setGenStatus('FAILED')
        setGenError('Video generation timed out. Please try again.')
        return
      }

      const token = authHeader()
      if (!token) return
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/video-status/${gId}`, {
          headers: { Authorization: token },
        })
        if (!res.ok) return
        const data = await res.json()

        setGenStatus(data.status)
        setGenProgress(data.progress || 0)

        if (data.status === 'COMPLETED' && data.output) {
          // Use ref (not state) to avoid stale closure when mode switches during polling
          if (generationModeRef.current === 'strategy') setStrategyVideoUrl(data.output)
          else setImg2VideoUrl(data.output)
          clearInterval(pollRef.current!)
        }
        if (data.status === 'FAILED' || data.status === 'CANCELLED') {
          setGenError(data.error || 'Video generation failed. Please try again.')
          clearInterval(pollRef.current!)
        }
      } catch { /* ignore network blips */ }
    }, 5000)
  }, [authHeader, campaignId])

  // ── Start video generation ────────────────────────────────────────────────
  const handleGenerate = async () => {
    const token = authHeader()
    if (!token) return

    // Validate based on mode
    if (videoMode === 'strategy' && !brief?.generationPrompt) return
    if (videoMode === 'img2video' && !selectedImage) {
      setGenError('Please select an image to animate.')
      return
    }

    setSubmitting(true)
    setGenError('')
    setUpgradeNeeded(false)
    // Capture mode so polling saves to the correct URL slot even if user switches tabs
    generationModeRef.current = videoMode
    // Clear current mode's video for fresh generation
    if (videoMode === 'strategy') setStrategyVideoUrl(null)
    else setImg2VideoUrl(null)
    setGenStatus(null)

    try {
      const body = videoMode === 'img2video'
        ? { mode: 'img2video', sourceImageUrl: selectedImage!.url, motionHint, durationSeconds }
        : { mode: 'text2video', prompt: brief!.generationPrompt, durationSeconds }

      const res = await fetch(`/api/campaigns/${campaignId}/video-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      // Quota exceeded → show upgrade prompt, not a generic error
      if (res.status === 402 || data.error === 'VIDEO_QUOTA_EXCEEDED') {
        setUpgradeNeeded(true)
        setSubmitting(false)
        return
      }

      if (!res.ok) throw new Error(data.message || data.error || 'Failed to start video generation')

      // Provider not configured
      if (data.providerAvailable === false) {
        setProviderAvailable(false)
        setSubmitting(false)
        return
      }

      setProviderAvailable(true)
      setGenerationId(data.generationId)
      setGenStatus('QUEUED')
      startPolling(data.generationId)
    } catch (err: any) {
      setGenError(err.message || 'Video generation failed to start.')
    }
    setSubmitting(false)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  if (loadingBrief) {
    return (
      <div className="py-8 text-center text-gray-600 text-xs">Loading video brief…</div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-sm font-semibold text-white flex items-center gap-2">
            <span>🎬</span> Video Intelligence
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">
            Generate a video brief, then render with AI if provider is configured
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {genStatus && <StatusPill status={genStatus} progress={genProgress} />}
          <button
            onClick={handleGenerateBrief}
            disabled={generatingBrief}
            className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition"
          >
            {generatingBrief ? (
              <>
                <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                Generating…
              </>
            ) : (
              <>🎬 {brief ? 'Regenerate Brief' : 'Generate Video Brief'}</>
            )}
          </button>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 p-1 rounded-xl bg-[#0f0f0f] border border-[#1f1f1f]">
        <button
          onClick={() => handleModeSwitch('strategy')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all ${
            videoMode === 'strategy'
              ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/20'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          📝 From Strategy
        </button>
        <button
          onClick={() => handleModeSwitch('img2video')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all ${
            videoMode === 'img2video'
              ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/20'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          🖼️ Animate My Image
        </button>
      </div>

      {/* ── IMAGE-TO-VIDEO PANEL ─────────────────────────────────────────────── */}
      {videoMode === 'img2video' && (
        <div className="space-y-4">
          {/* Explainer */}
          <div className="bg-[#111111] border border-violet-500/20 rounded-xl p-4 flex items-start gap-3">
            <span className="text-violet-400 mt-0.5 text-base">🎥</span>
            <div>
              <div className="text-xs font-semibold text-violet-300 mb-0.5">Animate your image</div>
              <div className="text-[11px] text-gray-500 leading-relaxed">
                Pick one of your uploaded photos and transform it into a short animated video clip. The result is saved to your Media Library.
              </div>
            </div>
          </div>

          {/* Media picker */}
          <div>
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">
              Choose an image from your library
            </div>

            {loadingMedia && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="aspect-square rounded-lg bg-[#1a1a1a] animate-pulse" />
                ))}
              </div>
            )}

            {!loadingMedia && mediaList.length === 0 && (
              <div className="bg-[#111111] border border-dashed border-[#2a2a2a] rounded-xl py-10 text-center">
                <div className="text-2xl mb-2">📁</div>
                <div className="text-xs text-gray-500 mb-1">No images in your library yet</div>
                <div className="text-[11px] text-gray-600">
                  Upload photos in the Media Library tab to animate them here.
                </div>
              </div>
            )}

            {!loadingMedia && mediaList.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {mediaList.map(media => (
                  <button
                    key={media.id}
                    onClick={() => setSelectedImage({ id: media.id, url: media.url, fileName: media.fileName })}
                    className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all group ${
                      selectedImage?.id === media.id
                        ? 'border-violet-500 ring-2 ring-violet-500/30'
                        : 'border-transparent hover:border-violet-500/40'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={media.url}
                      alt={media.fileName}
                      className="w-full h-full object-cover"
                    />
                    {selectedImage?.id === media.id && (
                      <div className="absolute inset-0 bg-violet-500/20 flex items-center justify-center">
                        <span className="w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center text-white text-[10px] font-bold">✓</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected image preview + motion hint */}
          {selectedImage && (
            <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedImage.url}
                  alt={selectedImage.fileName}
                  className="w-14 h-14 rounded-lg object-cover border border-[#2a2a2a] flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-white truncate">{selectedImage.fileName}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">Selected for animation</div>
                </div>
                <button
                  onClick={() => setSelectedImage(null)}
                  className="text-gray-600 hover:text-gray-400 text-xs transition"
                >✕</button>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest block mb-1.5">
                  Motion hint
                </label>
                <input
                  type="text"
                  value={motionHint}
                  onChange={e => setMotionHint(e.target.value)}
                  placeholder="e.g. smooth cinematic motion, slow zoom in, gentle parallax"
                  className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-violet-500/50 transition"
                />
                <div className="text-[10px] text-gray-600 mt-1">
                  Describe the camera movement or motion style you want (e.g. "slow zoom in", "gentle pan left").
                </div>
              </div>

              {/* Duration selector */}
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest block mb-1.5">
                  Duration
                </label>
                <div className="flex gap-2">
                  {([5, 10] as const).map(d => (
                    <button
                      key={d}
                      onClick={() => setDurationSeconds(d)}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold transition border ${
                        durationSeconds === d
                          ? 'bg-violet-600 text-white border-violet-500'
                          : 'bg-[#0f0f0f] text-gray-400 border-[#2a2a2a] hover:border-violet-500/40'
                      }`}
                    >
                      {d}s
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Provider notice for img2video */}
          {providerAvailable === false && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-start gap-3">
              <span className="text-amber-400 mt-0.5">⚡</span>
              <div>
                <div className="text-xs font-semibold text-amber-300 mb-0.5">Image-to-video not configured</div>
                <div className="text-[11px] text-amber-500">
                  Add <code className="font-mono bg-amber-500/10 px-1 rounded">REPLICATE_API_TOKEN</code> to your environment to enable image animation. Optionally set <code className="font-mono bg-amber-500/10 px-1 rounded">REPLICATE_IMG2VIDEO_MODEL_VERSION</code>.
                </div>
              </div>
            </div>
          )}

          {/* Upgrade prompt — video quota exceeded */}
          {upgradeNeeded && (
            <div className="rounded-xl border border-violet-500/40 bg-gradient-to-br from-violet-500/10 to-purple-500/5 px-5 py-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🎬</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-violet-300 mb-1">Video Generation — Pro Feature</div>
                  <div className="text-xs text-gray-400 mb-3">
                    Video generation is available on the Pro plan (5 videos/month) and Business plan (20 videos/month). Upgrade to start animating your content.
                  </div>
                  <a
                    href="/billing"
                    className="inline-block text-xs font-semibold px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors"
                  >
                    Upgrade to Pro →
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Gen error */}
          {genError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-xs text-red-400">
              {genError}
            </div>
          )}

          {/* Progress bar */}
          {(genStatus === 'QUEUED' || genStatus === 'PROCESSING') && (
            <div className="space-y-2">
              <div className="w-full h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500 rounded-full transition-all duration-1000"
                  style={{ width: `${Math.max(5, genProgress)}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-600">
                {genStatus === 'QUEUED' ? 'Queued — waiting for render slot…' : `Animating your image · ${genProgress}% complete`}
              </p>
            </div>
          )}

          {/* Video output */}
          {img2videoUrl && genStatus === 'COMPLETED' && (
            <div className="space-y-3">
              <div className="rounded-xl overflow-hidden bg-black aspect-video">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video src={img2videoUrl} controls autoPlay={false} className="w-full h-full" playsInline />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <a href={img2videoUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-500 text-white text-xs font-semibold rounded-lg transition">
                  ↗ Open video
                </a>
                <a href={img2videoUrl} download={`nexus-img2video-${campaignId.slice(0, 8)}.mp4`}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-gray-300 text-xs font-semibold rounded-lg transition">
                  ⬇ Download
                </a>
                <button
                  onClick={resetGeneration}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#1a1a1a] border border-red-500/30 hover:bg-red-500/10 text-red-400 text-xs font-semibold rounded-lg transition"
                >
                  ✕ Clear
                </button>
                <span className="text-[10px] text-gray-600">Saved to Media Library</span>
              </div>
            </div>
          )}

          {/* Animate button — always visible except while in-flight */}
          {genStatus !== 'QUEUED' && genStatus !== 'PROCESSING' && (
            <button
              onClick={handleGenerate}
              disabled={submitting || !selectedImage}
              className="w-full py-2.5 rounded-xl font-bold text-sm transition-all bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white flex items-center justify-center gap-2"
            >
              {submitting ? (
                <><span className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" /> Starting…</>
              ) : genStatus === 'FAILED' ? (
                '↺ Retry animation'
              ) : genStatus === 'COMPLETED' ? (
                '↺ Animate again'
              ) : (
                '🎥 Animate image'
              )}
            </button>
          )}
        </div>
      )}

      {/* ── STRATEGY-BASED PANEL ────────────────────────────────────────────── */}
      {videoMode === 'strategy' && (
        <>
      {/* Brief error */}
      {briefError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-xs text-red-400">
          {briefError}
        </div>
      )}

      {/* Provider not available notice */}
      {providerAvailable === false && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="text-amber-400 mt-0.5">⚡</span>
          <div>
            <div className="text-xs font-semibold text-amber-300 mb-0.5">Video generation not configured</div>
            <div className="text-[11px] text-amber-500">
              Add <code className="font-mono bg-amber-500/10 px-1 rounded">REPLICATE_API_TOKEN</code> and <code className="font-mono bg-amber-500/10 px-1 rounded">REPLICATE_VIDEO_MODEL_VERSION</code> to your environment to enable actual video rendering. Your Video Brief is still available above.
            </div>
          </div>
        </div>
      )}

      {/* No brief yet */}
      {!brief && !generatingBrief && (
        <div className="bg-[#111111] border border-[#1f1f1f] border-dashed rounded-xl py-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#1a1a1a] flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">🎬</span>
          </div>
          <div className="text-sm font-semibold text-gray-400 mb-1">No video brief yet</div>
          <div className="text-[11px] text-gray-600 mb-4 max-w-xs mx-auto">
            Generate a brand-aware video concept, storyboard, and script based on your campaign strategy.
          </div>
          <button
            onClick={handleGenerateBrief}
            className="text-[11px] font-semibold text-violet-400 hover:underline"
          >
            Generate video brief →
          </button>
        </div>
      )}

      {/* Brief generating skeleton */}
      {generatingBrief && (
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-6 space-y-3 animate-pulse">
          <div className="h-3 bg-[#1f1f1f] rounded w-2/3" />
          <div className="h-3 bg-[#1f1f1f] rounded w-full" />
          <div className="h-3 bg-[#1f1f1f] rounded w-5/6" />
          <div className="text-[11px] text-gray-600 text-center pt-2">Crafting your video brief…</div>
        </div>
      )}

      {/* Video Brief */}
      {brief && !generatingBrief && (
        <div className="space-y-4">
          {/* Concept */}
          <div className="bg-[#111111] border border-violet-500/20 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h4 className="text-xs font-bold text-violet-400 uppercase tracking-widest">Video Concept</h4>
              <div className="flex items-center gap-2 text-[10px] text-gray-500">
                <span className="px-2 py-0.5 rounded bg-[#1a1a1a] border border-[#2a2a2a]">
                  ⏱ {brief.durationSeconds}s
                </span>
                <span className="px-2 py-0.5 rounded bg-[#1a1a1a] border border-[#2a2a2a]">
                  📱 {brief.primaryPlatform}
                </span>
              </div>
            </div>
            <p className="text-sm text-gray-200 leading-relaxed mb-3">{brief.concept}</p>
            <p className="text-xs text-gray-500 leading-relaxed">{brief.narrative}</p>
          </div>

          {/* Visual treatment + music */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-4">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">🎥 Visual Treatment</div>
              <p className="text-xs text-gray-300 leading-relaxed">{brief.visualTreatment}</p>
            </div>
            <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-4">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">🎵 Music Mood</div>
              <p className="text-xs text-gray-300 leading-relaxed">{brief.musicMood}</p>
            </div>
          </div>

          {/* Storyboard scenes */}
          {brief.scenes && brief.scenes.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">
                🎞 Storyboard — {brief.scenes.length} scenes
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {brief.scenes.map(scene => (
                  <SceneCard key={scene.sceneNumber} scene={scene} />
                ))}
              </div>
            </div>
          )}

          {/* Script */}
          {brief.script && (
            <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-5">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">📝 Script / Voiceover</div>
              <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-line">{brief.script}</p>
            </div>
          )}

          {/* CTA */}
          <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-4 flex items-center gap-3">
            <span className="text-lg">🎯</span>
            <div>
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Call to Action</div>
              <p className="text-xs text-gray-200 font-semibold">{brief.callToAction}</p>
            </div>
          </div>

          {/* Generation prompt (collapsed by default) */}
          <details className="group bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl">
            <summary className="px-4 py-3 text-[10px] font-semibold text-gray-500 cursor-pointer select-none hover:text-gray-400 transition list-none flex items-center justify-between">
              <span>🤖 Replicate generation prompt</span>
              <span className="group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="px-4 pb-4">
              <p className="text-[11px] text-gray-400 font-mono leading-relaxed bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-3">
                {brief.generationPrompt}
              </p>
            </div>
          </details>

          {/* Generate video section */}
          <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Generate Video</div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  Render the video brief using AI — requires Replicate provider
                </div>
              </div>
              {genStatus && <StatusPill status={genStatus} progress={genProgress} />}
            </div>

            {/* Duration selector */}
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest block mb-1.5">
                Duration
              </label>
              <div className="flex gap-2">
                {([5, 10] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => setDurationSeconds(d)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition border ${
                      durationSeconds === d
                        ? 'bg-violet-600 text-white border-violet-500'
                        : 'bg-[#0f0f0f] text-gray-400 border-[#2a2a2a] hover:border-violet-500/40'
                    }`}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>

            {/* Upgrade prompt — video quota exceeded */}
            {upgradeNeeded && (
              <div className="rounded-xl border border-violet-500/40 bg-gradient-to-br from-violet-500/10 to-purple-500/5 px-5 py-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🎬</span>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-violet-300 mb-1">Video Generation — Pro Feature</div>
                    <div className="text-xs text-gray-400 mb-3">
                      Video generation is available on the Pro plan (5 videos/month) and Business plan (20 videos/month). Upgrade to start animating your content.
                    </div>
                    <a
                      href="/billing"
                      className="inline-block text-xs font-semibold px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors"
                    >
                      Upgrade to Pro →
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Generation error */}
            {genError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-xs text-red-400">
                {genError}
              </div>
            )}

            {/* Video preview */}
            {videoUrl && (
              <div className="space-y-3">
                <div className="rounded-xl overflow-hidden bg-black aspect-video">
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video
                    src={videoUrl}
                    controls
                    autoPlay={false}
                    className="w-full h-full"
                    playsInline
                  />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href={videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-500 text-white text-xs font-semibold rounded-lg transition"
                  >
                    ↗ Open video
                  </a>
                  <a
                    href={videoUrl}
                    download={`nexus-video-${campaignId.slice(0, 8)}.mp4`}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-gray-300 text-xs font-semibold rounded-lg transition"
                  >
                    ⬇ Download
                  </a>
                  <button
                    onClick={resetGeneration}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#1a1a1a] border border-red-500/30 hover:bg-red-500/10 text-red-400 text-xs font-semibold rounded-lg transition"
                  >
                    ✕ Clear
                  </button>
                  <span className="text-[10px] text-gray-600">Saved to Media Library</span>
                </div>
              </div>
            )}

            {/* Generating progress bar */}
            {(genStatus === 'QUEUED' || genStatus === 'PROCESSING') && (
              <div className="space-y-2">
                <div className="w-full h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500 rounded-full transition-all duration-1000"
                    style={{ width: `${Math.max(5, genProgress)}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-600">
                  {genStatus === 'QUEUED' ? 'Queued — waiting for render slot…' : `Generating your video · ${genProgress}% complete`}
                </p>
              </div>
            )}

            {/* Generate / Regenerate button — always visible */}
            {genStatus !== 'QUEUED' && genStatus !== 'PROCESSING' && (
              <button
                onClick={handleGenerate}
                disabled={submitting}
                className="w-full py-2.5 rounded-xl font-bold text-sm transition-all bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <span className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" />
                    Starting…
                  </>
                ) : genStatus === 'FAILED' ? (
                  '↺ Retry generation'
                ) : genStatus === 'COMPLETED' ? (
                  '↺ Generate new video'
                ) : (
                  '🎬 Generate video'
                )}
              </button>
            )}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  )
}
