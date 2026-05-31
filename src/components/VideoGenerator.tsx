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
  const [brief, setBrief] = useState<VideoBrief | null>(null)
  const [loadingBrief, setLoadingBrief] = useState(true)
  const [generatingBrief, setGeneratingBrief] = useState(false)
  const [briefError, setBriefError] = useState('')

  const [generationId, setGenerationId] = useState<string | null>(null)
  const [genStatus, setGenStatus] = useState<GenerationStatus>(null)
  const [genProgress, setGenProgress] = useState(0)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [genError, setGenError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [providerAvailable, setProviderAvailable] = useState<boolean | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollCountRef = useRef(0)
  const MAX_POLLS = 120 // 10 minutes at 5s interval

  // ── Fetch existing brief on mount ─────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const token = authHeader()
      if (!token) { setLoadingBrief(false); return }
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/video-brief`, {
          headers: { Authorization: token },
        })
        if (res.ok) {
          const data = await res.json()
          if (data.videoBrief) setBrief(data.videoBrief)
        }
      } catch { /* ignore */ }
      setLoadingBrief(false)
    }
    load()
  }, [authHeader, campaignId])

  // ── Stop polling on unmount ───────────────────────────────────────────────
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

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
          setVideoUrl(data.output)
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
    if (!brief?.generationPrompt) return
    const token = authHeader()
    if (!token) return

    setSubmitting(true)
    setGenError('')
    setVideoUrl(null)
    setGenStatus(null)

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/video-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({
          prompt: brief.generationPrompt,
          durationSeconds: brief.durationSeconds,
        }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed to start video generation')

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
                <div className="flex items-center gap-2">
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

            {/* Generate button */}
            {genStatus !== 'COMPLETED' && (
              <button
                onClick={handleGenerate}
                disabled={submitting || genStatus === 'QUEUED' || genStatus === 'PROCESSING'}
                className="w-full py-2.5 rounded-xl font-bold text-sm transition-all bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <span className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" />
                    Starting…
                  </>
                ) : genStatus === 'QUEUED' || genStatus === 'PROCESSING' ? (
                  <>
                    <span className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" />
                    Generating…
                  </>
                ) : genStatus === 'FAILED' ? (
                  '↺ Retry generation'
                ) : (
                  '🎬 Generate video'
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
