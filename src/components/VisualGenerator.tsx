'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { CONTENT_HUB_IMAGE_COST } from '@/lib/contentHubActionSafety'
import { getCreditActionTruth } from '@/lib/creditActionTruth'
import { useBillingStatus } from '@/lib/useBillingStatus'
import { getDefaultTemplateForPlatform } from '@/lib/creativeTemplates'

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
  { value: 'AD_CREATIVE', label: 'Paid Creative Background', desc: 'Planning visual', icon: '📢' },
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
  generationLocked,
  lockedLabel,
}: {
  visual: Visual
  onSetPrimary: (id: string) => void
  onDelete: (id: string) => Promise<void>
  onRegenerate: (visual: Visual) => void
  generationLocked: boolean
  lockedLabel: string
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
    <div className={`relative group rounded-xl border bg-white shadow-sm transition-all ${
      visual.isPrimary ? 'border-indigo-200 ring-1 ring-indigo-100' : 'border-slate-200 hover:border-slate-300'
    }`}>
      {/* Primary badge */}
      {visual.isPrimary && (
        <div className="absolute top-2 left-2 z-10 rounded bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold" style={{ color: '#fff' }}>
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
        <div className="px-3 pt-2 text-[10px] text-red-600">{deleteError}</div>
      )}

      {/* Inline delete confirm */}
      {confirmDelete && (
        <div className="flex items-center gap-2 border-t border-red-100 bg-red-50 px-3 py-2.5">
          <div className="flex-1 text-[11px] font-medium text-red-700">Delete this visual?</div>
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
            <div className="truncate text-[11px] font-medium text-slate-700">
              {visual.visualStyle} · {visual.visualType.replace('_', ' ')}
            </div>
            <div className="mt-0.5 text-[10px] text-slate-500">
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
              title={generationLocked ? lockedLabel : 'Regenerate from same strategy'}
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
                  <div className="absolute bottom-full right-0 z-50 mb-1 w-44 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                    {!visual.isPrimary && (
                      <button
                        onClick={() => { onSetPrimary(visual.id); setMenuOpen(false) }}
                        className="w-full px-3 py-2 text-left text-xs text-slate-700 transition hover:bg-slate-50"
                      >
                        Set as primary
                      </button>
                    )}
                    <button
                      onClick={() => { setMenuOpen(false); setConfirmDelete(true) }}
                      className="w-full px-3 py-2 text-left text-xs text-red-600 transition hover:bg-red-50"
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
  const router = useRouter()
  const { authHeader } = useAuth()
  const {
    creditsRemaining,
    isUnlimited,
    loading: billingLoading,
    invalidate: refreshBillingStatus,
  } = useBillingStatus()
  const [visuals, setVisuals] = useState<Visual[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [selectedType, setSelectedType] = useState<VisualType>('HERO')
  const [selectedStyle, setSelectedStyle] = useState<VisualStyle>('Premium')
  const [panelOpen, setPanelOpen] = useState(false)
  const [confirmGenerateVisual, setConfirmGenerateVisual] = useState<Visual | null | false>(false)
  const [visualGenerationAcknowledged, setVisualGenerationAcknowledged] = useState(false)
  const imageGenerationTruth = getCreditActionTruth({
    action: 'IMAGE_GENERATION',
    creditsRemaining,
    isUnlimited,
  })
  const generationLocked = !billingLoading && !imageGenerationTruth.canAfford
  const lockedLabel = 'Add credits to generate campaign concept visual'

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
    if (generationLocked) {
      setError(lockedLabel)
      router.push('/billing')
      return
    }
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
          assetRole: 'campaign_concept_background',
          creativeTemplate: getDefaultTemplateForPlatform('META'),
          explicitImageGenerationConfirmed: true,
          acknowledgedCreditCost: CONTENT_HUB_IMAGE_COST,
          acknowledgedNoPublishOrSchedule: true,
          acknowledgedPostMediaForReview: true,
        }),
      })
      const data = await res.json()
      // Prefer the friendly `message` (e.g. daily image limit) over the error code.
      if (!res.ok) throw new Error(data.message || data.error || 'Generation failed')

      const newVisual = data.visual
      setVisuals(prev => [newVisual, ...prev])
      onVisualSaved?.(newVisual)
      await refreshBillingStatus()
      setConfirmGenerateVisual(false)
      setVisualGenerationAcknowledged(false)
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
    if (generationLocked) {
      setError(lockedLabel)
      router.push('/billing')
      return
    }
    setSelectedStyle(visual.visualStyle as VisualStyle)
    setSelectedType(visual.visualType as VisualType)
    setVisualGenerationAcknowledged(false)
    setConfirmGenerateVisual(visual)
  }

  const requestConceptVisualGeneration = () => {
    setVisualGenerationAcknowledged(false)
    setConfirmGenerateVisual(null)
  }

  const closeConceptVisualConfirmation = () => {
    if (generating) return
    setConfirmGenerateVisual(false)
    setVisualGenerationAcknowledged(false)
  }

  return (
    <div className="space-y-5">
      {/* Header + generate button */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-950">Campaign concept visuals</div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            {visuals.length > 0 ? `${visuals.length} concept visual${visuals.length === 1 ? '' : 's'} in gallery` : 'No concept visuals yet'}
          </div>
        </div>
        <button
          onClick={generationLocked ? () => router.push('/billing') : () => setPanelOpen(o => !o)}
          disabled={generating}
          className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition disabled:opacity-50 ${generationLocked ? 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100' : 'bg-indigo-600 hover:bg-indigo-500'}`}
          style={{ color: generationLocked ? undefined : '#fff' }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 1v10M1 6h10" strokeLinecap="round" />
          </svg>
          {generationLocked ? lockedLabel : 'Generate campaign concept visual'}
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
            {generationLocked
              ? 'Credits are required before generating a campaign concept visual.'
              : <>Costs <span className="font-semibold text-slate-700">3 credits</span> · failed generations are refunded automatically</>}
          </div>

          <button
            onClick={generationLocked ? () => router.push('/billing') : requestConceptVisualGeneration}
            className={`w-full rounded-lg py-2.5 text-sm font-semibold transition ${generationLocked ? 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100' : 'bg-indigo-600 hover:bg-indigo-500'}`}
            style={{ color: generationLocked ? undefined : '#fff' }}
          >
            {generationLocked ? `${lockedLabel} →` : 'Generate campaign concept visual →'}
          </button>
        </div>
      )}

      {confirmGenerateVisual !== false && !generating && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-950">
                {confirmGenerateVisual ? 'Confirm campaign concept regeneration' : 'Confirm campaign concept visual generation'}
              </div>
              <div className="mt-1 text-[11px] leading-relaxed text-slate-500">
                This creates a campaign concept background/gallery asset for review. It is not final ad creative, not attached to posts automatically, not scheduled, not published, and not used in paid ads automatically.
              </div>
            </div>
            <button onClick={closeConceptVisualConfirmation} className="text-xl leading-none text-slate-400 hover:text-slate-700">×</button>
          </div>
          <div className="space-y-1 rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
            <p>Cost: {CONTENT_HUB_IMAGE_COST} credits. Failed generations are refunded when the existing product refund logic supports it.</p>
            <p>NEXUS does not publish, schedule, change manual/API publish status, or update Brand Brain signals from this visual.</p>
          </div>
          <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-3">
            <input
              type="checkbox"
              checked={visualGenerationAcknowledged}
              onChange={e => setVisualGenerationAcknowledged(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
            />
            <span className="text-[11px] font-semibold text-slate-800">
              I understand this costs {CONTENT_HUB_IMAGE_COST} credits and creates a campaign concept background visual for review only.
            </span>
          </label>
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={closeConceptVisualConfirmation} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900">
              Cancel
            </button>
            <button
              onClick={() => handleGenerate(confirmGenerateVisual || undefined)}
              disabled={!visualGenerationAcknowledged}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Confirm image generation — {CONTENT_HUB_IMAGE_COST} credits
            </button>
          </div>
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
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
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
              generationLocked={generationLocked}
              lockedLabel={lockedLabel}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !generating && visuals.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#FF9500" strokeWidth="1.5">
              <rect x="2" y="2" width="14" height="14" rx="3" />
              <circle cx="6.5" cy="6.5" r="1.5" />
              <path d="M2 12l4.5-4 3.5 3.5 2.5-2.5L16 13" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="mb-1 text-sm font-semibold text-slate-700">No campaign concept visuals yet</div>
          <div className="mb-4 text-[11px] text-slate-500">
            Generate campaign-level concept visuals from your brand strategy. They stay in this gallery until you choose how to use them.
          </div>
          <button
            onClick={generationLocked ? () => router.push('/billing') : () => setPanelOpen(true)}
            className={`text-[11px] font-semibold hover:underline ${generationLocked ? 'text-red-600' : 'text-accent'}`}
          >
            {generationLocked ? `${lockedLabel} →` : 'Generate first campaign concept visual →'}
          </button>
        </div>
      )}
    </div>
  )
}
