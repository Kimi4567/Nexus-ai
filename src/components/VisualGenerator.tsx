'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'

type VisualStyle =
  | 'Minimal' | 'Luxury' | 'Corporate' | 'Editorial' | 'Cinematic'
  | 'Bold' | 'Gen Z' | 'Premium' | 'Futuristic' | 'Elegant'

type VisualType = 'HERO' | 'SOCIAL_PREVIEW' | 'AD_CREATIVE' | 'THUMBNAIL'

interface Visual {
  id: string
  imageUrl?: string
  status: string
  visualType: string
  visualStyle: string
  isPrimary: boolean
  isArchived: boolean
  createdAt: string
}

interface CampaignContext {
  campaignId?: string
  campaignName?: string
  campaignGoal?: string
  campaignTone?: string
  audience?: string
  brandName?: string
  brandToneWords?: string[]
  primaryOffer?: string
  industry?: string
}

interface VisualGeneratorProps {
  context: CampaignContext
  onVisualSaved?: (visual: Visual) => void
}

const VISUAL_STYLES: { value: VisualStyle; label: string; desc: string }[] = [
  { value: 'Minimal', label: 'Minimal', desc: 'Clean space, refined' },
  { value: 'Luxury', label: 'Luxury', desc: 'Premium, aspirational' },
  { value: 'Cinematic', label: 'Cinematic', desc: 'Dramatic, film-like' },
  { value: 'Bold', label: 'Bold', desc: 'High contrast, punchy' },
  { value: 'Editorial', label: 'Editorial', desc: 'Magazine, artistic' },
  { value: 'Elegant', label: 'Elegant', desc: 'Soft, sophisticated' },
  { value: 'Premium', label: 'Premium', desc: 'Subtle, refined' },
  { value: 'Corporate', label: 'Corporate', desc: 'Professional, clean' },
  { value: 'Futuristic', label: 'Futuristic', desc: 'Tech-forward, neon' },
  { value: 'Gen Z', label: 'Gen Z', desc: 'Vibrant, raw, playful' },
]

const VISUAL_TYPES: { value: VisualType; label: string; desc: string; icon: string }[] = [
  { value: 'HERO', label: 'Hero Image', desc: 'Campaign header visual', icon: '🖼️' },
  { value: 'SOCIAL_PREVIEW', label: 'Social Post', desc: 'Instagram / Facebook', icon: '📱' },
  { value: 'AD_CREATIVE', label: 'Ad Creative', desc: 'Paid ads banner', icon: '📢' },
  { value: 'THUMBNAIL', label: 'Thumbnail', desc: 'Video / content thumb', icon: '▶️' },
]

function GeneratingAnimation() {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setFrame(f => (f + 1) % 4), 600)
    return () => clearInterval(t)
  }, [])

  const bars = [0.4, 0.7, 1, 0.6, 0.9, 0.5, 0.8, 0.45, 0.75, 0.55]

  return (
    <div className="flex flex-col items-center justify-center py-16 px-8">
      {/* Waveform animation */}
      <div className="flex items-end gap-1 h-12 mb-6">
        {bars.map((h, i) => (
          <div
            key={i}
            className="w-1.5 bg-accent rounded-full transition-all duration-300"
            style={{
              height: `${((Math.sin((frame + i) * 0.8) + 1) / 2 * 0.6 + 0.4) * 48}px`,
              opacity: 0.4 + ((Math.sin((frame + i) * 0.6) + 1) / 2) * 0.6,
            }}
          />
        ))}
      </div>
      <div className="mb-1 text-sm font-semibold text-slate-950">Generating visual</div>
      <div className="text-[11px] text-gray-500 text-center max-w-48">
        Creating campaign-aligned imagery from your brand strategy…
      </div>
    </div>
  )
}

function VisualCard({
  visual,
  onSetPrimary,
  onDelete,
  onRegenerate,
}: {
  visual: Visual
  onSetPrimary: (id: string) => void
  onDelete: (id: string) => Promise<void>
  onRegenerate: (visual: Visual) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const handleDownload = async () => {
    if (!visual.imageUrl) return
    setDownloading(true)
    try {
      const res = await fetch(visual.imageUrl)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `nexus-visual-${visual.id.slice(0, 8)}.png`
      a.click()
      URL.revokeObjectURL(url)
    } catch { /* ignore */ }
    setDownloading(false)
  }

  const handleConfirmDelete = async () => {
    setDeleting(true)
    setDeleteError('')
    try {
      await onDelete(visual.id)
      // Parent removes from list — no further state update needed
    } catch (err: any) {
      setDeleteError(err.message || 'Could not delete visual. Please try again.')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    // overflow-hidden removed from card root — only applied to image container below
    // This lets the absolutely-positioned dropdown menu escape the card boundary
    <div className={`relative group bg-[#141414] border rounded-xl transition-all ${
      visual.isPrimary ? 'border-accent/60 ring-1 ring-accent/20' : 'border-[#1f1f1f] hover:border-[#2a2a2a]'
    }`}>
      {/* Primary badge */}
      {visual.isPrimary && (
        <div className="absolute top-2 left-2 z-10 rounded bg-accent px-2 py-0.5 text-[10px] font-semibold" style={{ color: '#fff' }}>
          Primary
        </div>
      )}

      {/* Image — overflow-hidden scoped here only */}
      <div className="aspect-video bg-[#0f0f0f] flex items-center justify-center rounded-t-xl overflow-hidden">
        {visual.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={visual.imageUrl}
            alt="Generated visual"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-gray-700 text-sm">No image</div>
        )}
      </div>

      {/* Delete error */}
      {deleteError && (
        <div className="px-3 pt-2 text-[10px] text-red-400">{deleteError}</div>
      )}

      {/* Inline delete confirm */}
      {confirmDelete && (
        <div className="px-3 py-2.5 flex items-center gap-2 bg-red-500/10 border-t border-red-500/20">
          <div className="flex-1 text-[11px] text-red-300 font-medium">Delete this visual?</div>
          <button
            onClick={() => setConfirmDelete(false)}
            disabled={deleting}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-[10px] font-semibold text-slate-500 transition hover:text-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmDelete}
            disabled={deleting}
            className="rounded-lg bg-red-500 px-2.5 py-1 text-[10px] font-semibold transition hover:bg-red-400 disabled:opacity-50"
            style={{ color: '#fff' }}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      )}

      {/* Metadata bar */}
      {!confirmDelete && (
        <div className="px-3 py-2.5 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-medium text-gray-300 truncate">
              {visual.visualStyle} · {visual.visualType.replace('_', ' ')}
            </div>
            <div className="text-[10px] text-gray-600 mt-0.5">
              {new Date(visual.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleDownload}
              disabled={downloading}
              title="Download"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M6 1v7M3 5.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M1.5 10.5h9" strokeLinecap="round" />
              </svg>
            </button>

            <button
              onClick={() => onRegenerate(visual)}
              title="Regenerate from same strategy"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M1.5 6a4.5 4.5 0 108.5-2" strokeLinecap="round" />
                <path d="M10 2l.5 1.5L9 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* More menu — uses fixed positioning to escape any ancestor overflow */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen(o => !o)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                  <circle cx="6" cy="2" r="1" />
                  <circle cx="6" cy="6" r="1" />
                  <circle cx="6" cy="10" r="1" />
                </svg>
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute bottom-full right-0 mb-1 w-44 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl z-50 py-1">
                    {!visual.isPrimary && (
                      <button
                        onClick={() => { onSetPrimary(visual.id); setMenuOpen(false) }}
                        className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/5 transition"
                      >
                        Set as primary
                      </button>
                    )}
                    <button
                      onClick={() => { setMenuOpen(false); setConfirmDelete(true) }}
                      className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-white/5 transition"
                    >
                      Delete visual
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function VisualGenerator({ context, onVisualSaved }: VisualGeneratorProps) {
  const { authHeader } = useAuth()
  const [visuals, setVisuals] = useState<Visual[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [selectedType, setSelectedType] = useState<VisualType>('HERO')
  const [selectedStyle, setSelectedStyle] = useState<VisualStyle>('Premium')
  const [panelOpen, setPanelOpen] = useState(false)

  const fetchVisuals = useCallback(async () => {
    const token = authHeader()
    if (!token) return
    try {
      const url = context.campaignId
        ? `/api/visuals?campaignId=${context.campaignId}`
        : '/api/visuals'
      const res = await fetch(url, { headers: { Authorization: token } })
      if (res.ok) {
        const data = await res.json()
        setVisuals(data.visuals || [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [authHeader, context.campaignId])

  useEffect(() => {
    fetchVisuals()
  }, [fetchVisuals])

  const handleGenerate = async (regenerateFrom?: Visual) => {
    const token = authHeader()
    if (!token) return
    setGenerating(true)
    setError('')
    setPanelOpen(false)

    try {
      const res = await fetch('/api/visuals/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({
          ...context,
          visualType: selectedType,
          visualStyle: selectedStyle,
          parentId: regenerateFrom?.id || null,
        }),
      })
      const data = await res.json()
      // Prefer the friendly `message` (e.g. daily image limit) over the error code.
      if (!res.ok) throw new Error(data.message || data.error || 'Generation failed')

      const newVisual = data.visual
      setVisuals(prev => [newVisual, ...prev])
      onVisualSaved?.(newVisual)
    } catch (err: any) {
      setError(err.message || 'Image generation failed. Please try again.')
    }
    setGenerating(false)
  }

  const handleSetPrimary = async (id: string) => {
    const token = authHeader()
    if (!token) return
    await fetch(`/api/visuals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: JSON.stringify({ isPrimary: true }),
    })
    setVisuals(prev => prev.map(v => ({ ...v, isPrimary: v.id === id })))
  }

  const handleDelete = async (id: string) => {
    const token = authHeader()
    if (!token) return
    const res = await fetch(`/api/visuals/${id}`, {
      method: 'DELETE',
      headers: { Authorization: token },
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Could not delete visual. Please try again.')
    }
    setVisuals(prev => prev.filter(v => v.id !== id))
  }

  const handleRegenerate = (visual: Visual) => {
    setSelectedStyle(visual.visualStyle as VisualStyle)
    setSelectedType(visual.visualType as VisualType)
    handleGenerate(visual)
  }

  return (
    <div className="space-y-5">
      {/* Header + generate button */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-950">Campaign Visuals</div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            {visuals.length > 0 ? `${visuals.length} visual${visuals.length === 1 ? '' : 's'} generated` : 'No visuals yet'}
          </div>
        </div>
        <button
          onClick={() => setPanelOpen(o => !o)}
          disabled={generating}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold transition hover:bg-indigo-500 disabled:opacity-50"
          style={{ color: '#fff' }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 1v10M1 6h10" strokeLinecap="round" />
          </svg>
          Generate visual
        </button>
      </div>

      {/* Generation panel */}
      {panelOpen && !generating && (
        <div className="space-y-5 rounded-xl border border-slate-200 bg-slate-50 p-5">
          <div className="mb-1 text-xs font-semibold text-slate-950">Creative direction</div>

          {/* Visual type */}
          <div>
            <div className="mb-2 text-[10px] font-medium uppercase tracking-widest text-slate-500">Visual type</div>
            <div className="grid grid-cols-2 gap-2">
              {VISUAL_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setSelectedType(t.value)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition ${
                    selectedType === t.value
                      ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
                  }`}
                >
                  <span className="text-base flex-shrink-0">{t.icon}</span>
                  <div>
                    <div className="text-[11px] font-semibold">{t.label}</div>
                    <div className="text-[10px] text-slate-400">{t.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Visual style */}
          <div>
            <div className="mb-2 text-[10px] font-medium uppercase tracking-widest text-slate-500">Aesthetic direction</div>
            <div className="flex flex-wrap gap-2">
              {VISUAL_STYLES.map(s => (
                <button
                  key={s.value}
                  onClick={() => setSelectedStyle(s.value)}
                  title={s.desc}
                  style={{ color: selectedStyle === s.value ? '#fff' : undefined }}
                  className={`px-3 py-1.5 rounded-lg border text-[11px] font-medium transition ${
                    selectedStyle === s.value
                      ? 'border-indigo-600 bg-indigo-600'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Context preview */}
          <div className="space-y-1 rounded-lg border border-slate-200 bg-white p-3 text-[10px] text-slate-500">
            <div className="mb-1.5 text-[10px] font-semibold text-slate-500">Strategy context (auto-applied)</div>
            {context.campaignGoal && <div>Goal: <span className="text-slate-700">{context.campaignGoal}</span></div>}
            {context.campaignTone && <div>Tone: <span className="text-slate-700">{context.campaignTone}</span></div>}
            {context.brandName && <div>Brand: <span className="text-slate-700">{context.brandName}</span></div>}
            {(context.brandToneWords || []).length > 0 && (
              <div>Brand voice: <span className="text-slate-700">{context.brandToneWords?.slice(0, 3).join(', ')}</span></div>
            )}
          </div>

          {/* Cost transparency — shown before the action (factual, no decoration) */}
          <div className="-mb-1 text-center text-[10px] text-slate-500">
            Costs <span className="font-semibold text-slate-700">3 credits</span> · failed generations are refunded automatically
          </div>

          <button
            onClick={() => handleGenerate()}
            className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold transition hover:bg-indigo-500"
            style={{ color: '#fff' }}
          >
            Generate visual →
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Generating state */}
      {generating && (
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl overflow-hidden">
          <GeneratingAnimation />
        </div>
      )}

      {/* Visuals grid */}
      {!loading && visuals.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {visuals.map(v => (
            <VisualCard
              key={v.id}
              visual={v}
              onSetPrimary={handleSetPrimary}
              onDelete={handleDelete}
              onRegenerate={handleRegenerate}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !generating && visuals.length === 0 && (
        <div className="bg-[#111111] border border-[#1f1f1f] border-dashed rounded-xl py-12 text-center">
          <div className="w-10 h-10 rounded-xl bg-[#1a1a1a] flex items-center justify-center mx-auto mb-3">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#FF9500" strokeWidth="1.5">
              <rect x="2" y="2" width="14" height="14" rx="3" />
              <circle cx="6.5" cy="6.5" r="1.5" />
              <path d="M2 12l4.5-4 3.5 3.5 2.5-2.5L16 13" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="text-sm font-semibold text-gray-400 mb-1">No visuals yet</div>
          <div className="text-[11px] text-gray-600 mb-4">
            Generate campaign visuals from your brand strategy — no prompts required.
          </div>
          <button
            onClick={() => setPanelOpen(true)}
            className="text-[11px] font-semibold text-accent hover:underline"
          >
            Generate first visual →
          </button>
        </div>
      )}
    </div>
  )
}
