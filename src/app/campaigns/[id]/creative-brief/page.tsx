'use client'

/**
 * Creative Brief Page — /campaigns/[id]/creative-brief
 *
 * Sprint F — Creative Direction
 *
 * Two modes:
 * 1. User Asset Mode — upload real assets, AI analyzes them, produces creative briefs
 * 2. AI Concept Mode — AI generates image prompts, storyboards, production brief
 *
 * Opened in a new tab from the Campaign Visuals tab.
 */

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MediaItem {
  id: string
  fileName: string
  url: string
  type: string
  width?: number
  height?: number
  size: number
}

interface AssetAnalysis {
  mediaId: string
  fileName: string
  url: string
  type: string
  brandAlignment: string
  contentType: string
  suggestedUse: string[]
  qualityNotes: string
  campaignFit: string
  adCopyHook: string
  captionSuggestion: string
}

interface StoryboardScene {
  sceneNumber: number
  description: string
  visualNotes: string
  textOverlay: string
  duration: string
  platform: string
}

interface ImagePrompt {
  platform: string
  style: string
  prompt: string
  aspectRatio: string
  notes: string
}

interface CreativeBrief {
  mode: 'asset' | 'concept'
  generatedAt: string
  // Asset
  assetAnalyses?: AssetAnalysis[]
  overallCreativeDirection?: string
  adCopyVariants?: string[]
  captionFormulas?: string[]
  topAssetsForCampaign?: string[]
  assetBasedScripts?: string[]
  // Concept
  imagePrompts?: ImagePrompt[]
  storyboardScenes?: StoryboardScene[]
  productionBrief?: string
  moodDescription?: string
  colorDirections?: string[]
  platformLayouts?: Record<string, string>
  creativeNotes?: string
}

interface Campaign {
  id: string
  name: string
  goal?: string
  audience?: string
  platforms: string[]
  aiOutput?: any
}

// ─── Utility Components ───────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      style={btnStyle(copied)}
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

function CopyAllButton({ texts, label = 'Copy All' }: { texts: string[]; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(texts.join('\n\n')); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      style={{ ...btnStyle(copied), background: copied ? '#22C55E' : '#6366F1', color: '#fff' }}
    >
      {copied ? '✓ Copied All' : label}
    </button>
  )
}

function btnStyle(active: boolean): React.CSSProperties {
  return {
    fontSize: 11, padding: '4px 12px', borderRadius: 6, cursor: 'pointer', border: 'none',
    fontWeight: 600, transition: 'all 0.15s', flexShrink: 0, whiteSpace: 'nowrap',
    background: active ? '#22C55E' : '#F0F0F0', color: active ? '#fff' : '#444',
  }
}

function Tag({ label, color = '#6366F1' }: { label: string; color?: string }) {
  return (
    <span style={{
      fontSize: 11, padding: '2px 8px', borderRadius: 20, border: `1px solid ${color}40`,
      color, background: `${color}15`, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

function SectionCard({ title, icon, children, accent = '#6366F1' }: {
  title: string; icon: string; children: React.ReactNode; accent?: string
}) {
  return (
    <div style={{ background: '#fff', border: `1px solid #E5E7EB`, borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111' }}>{title}</h3>
        <div style={{ flex: 1, height: 2, background: `${accent}30`, borderRadius: 2, marginLeft: 8 }} />
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  )
}

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 32, height: 32, border: '3px solid #E5E7EB', borderTopColor: '#6366F1',
          borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <p style={{ color: '#9CA3AF', fontSize: 13 }}>Loading...</p>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CreativeBriefPage() {
  const params = useParams()
  const router = useRouter()
  const campaignId = params?.id as string
  const { isAuthenticated, loading, authHeader } = useAuth()

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [selectedMedia, setSelectedMedia] = useState<Set<string>>(new Set())
  const [creativeBrief, setCreativeBrief] = useState<CreativeBrief | null>(null)
  const [mode, setMode] = useState<'asset' | 'concept'>('asset')
  const [fetching, setFetching] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  // ── Data loading ──
  const loadData = useCallback(async () => {
    const token = authHeader()
    if (!token) return
    try {
      const [campaignRes, mediaRes, briefRes] = await Promise.all([
        fetch(`/api/campaigns/${campaignId}`, { headers: { Authorization: token } }),
        fetch(`/api/media?limit=50`, { headers: { Authorization: token } }),
        fetch(`/api/campaigns/${campaignId}/creative-brief`, { headers: { Authorization: token } }),
      ])
      const [cd, md, bd] = await Promise.all([campaignRes.json(), mediaRes.json(), briefRes.json()])
      if (cd.campaign) setCampaign(cd.campaign)
      if (Array.isArray(md.media)) setMediaItems(md.media)
      if (bd.creativeBrief) {
        setCreativeBrief(bd.creativeBrief)
        setMode(bd.creativeMode || 'asset')
      }
    } catch {}
  }, [campaignId, authHeader])

  useEffect(() => {
    if (!loading && !isAuthenticated) { router.push('/auth/login'); return }
    if (!isAuthenticated) return
    loadData().finally(() => setFetching(false))
  }, [loading, isAuthenticated, loadData, router])

  // ── Generate ──
  const handleGenerate = async () => {
    const token = authHeader()
    if (!token || !campaign) return
    setGenerating(true)
    setError('')
    try {
      const body: any = { mode }
      if (mode === 'asset' && selectedMedia.size > 0) {
        body.mediaIds = Array.from(selectedMedia)
      }
      const res = await fetch(`/api/campaigns/${campaignId}/creative-brief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify(body),
      })
      const d = await res.json()
      if (d.creativeBrief) {
        setCreativeBrief(d.creativeBrief)
      } else {
        setError(d.error || 'Generation failed')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setGenerating(false)
    }
  }

  // ── Asset selection ──
  const toggleMedia = (id: string) => {
    setSelectedMedia(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedMedia.size === mediaItems.length) {
      setSelectedMedia(new Set())
    } else {
      setSelectedMedia(new Set(mediaItems.map(m => m.id)))
    }
  }

  // ── Loading / empty states ──
  if (loading || fetching) return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB' }}>
      <Spinner />
    </div>
  )

  if (!campaign) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#F9FAFB' }}>
      <p style={{ color: '#9CA3AF' }}>Campaign not found.</p>
    </div>
  )

  const hasStrategy = !!(campaign.aiOutput?.strategy)
  const imageMedia = mediaItems.filter(m => m.type === 'IMAGE' || m.type === 'LOGO')
  const videoMedia = mediaItems.filter(m => m.type === 'VIDEO')

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* ── Global print styles ── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff; }
        }
        * { box-sizing: border-box; }
      `}</style>

      {/* ── Header ── */}
      <div className="no-print" style={{
        background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '16px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
            <span style={{ fontSize: 20 }}>🎨</span>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#111' }}>Creative Brief</h1>
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#6366F115',
              color: '#6366F1', fontWeight: 700, border: '1px solid #6366F130',
            }}>NEXUS Visual Director</span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#6B7280' }}>{campaign.name}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => window.print()}
            style={{
              padding: '8px 16px', borderRadius: 8, border: '1px solid #E5E7EB',
              background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            🖨️ Export / Print
          </button>
          <button
            onClick={() => window.close()}
            style={{
              padding: '8px 16px', borderRadius: 8, border: '1px solid #E5E7EB',
              background: '#F9FAFB', color: '#6B7280', fontSize: 13, cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Strategy Warning ── */}
        {!hasStrategy && (
          <div style={{
            background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 10,
            padding: '12px 16px', marginBottom: 24, display: 'flex', gap: 10,
          }}>
            <span>⚠️</span>
            <p style={{ margin: 0, fontSize: 13, color: '#92400E' }}>
              <strong>No strategy found.</strong> For best results, run Full Strategy first — the Visual Director uses your brand positioning, key message, and content pillars to create more relevant creative direction.
            </p>
          </div>
        )}

        {/* ── Mode Selector ── */}
        <div className="no-print" style={{ marginBottom: 28 }}>
          <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: '#374151' }}>Choose creative mode:</p>
          <div style={{ display: 'flex', gap: 12 }}>
            {([
              {
                key: 'asset',
                icon: '🖼️',
                title: 'User Asset Mode',
                desc: 'I have real client photos, videos, or logos',
                color: '#6366F1',
              },
              {
                key: 'concept',
                icon: '🤖',
                title: 'AI Concept Mode',
                desc: 'Generate visual direction from scratch',
                color: '#EC4899',
              },
            ] as const).map(m => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                style={{
                  flex: 1, padding: '16px 20px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                  border: `2px solid ${mode === m.key ? m.color : '#E5E7EB'}`,
                  background: mode === m.key ? `${m.color}08` : '#fff',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 20 }}>{m.icon}</span>
                  <span style={{ fontWeight: 700, fontSize: 14, color: mode === m.key ? m.color : '#111' }}>{m.title}</span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>{m.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* ── Asset Mode Controls ── */}
        {mode === 'asset' && !generating && (
          <div className="no-print">
            {mediaItems.length === 0 ? (
              <div style={{
                background: '#fff', border: '1px dashed #D1D5DB', borderRadius: 12,
                padding: '32px 24px', textAlign: 'center', marginBottom: 24,
              }}>
                <p style={{ fontSize: 15, fontWeight: 600, color: '#374151', margin: '0 0 8px' }}>No media in your workspace yet</p>
                <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 16px' }}>Upload photos, videos, or logos via the Media Library, then return here to analyze them.</p>
                <a
                  href="/media"
                  target="_blank"
                  style={{
                    display: 'inline-block', padding: '8px 18px', borderRadius: 8,
                    background: '#6366F1', color: '#fff', fontSize: 13, fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Open Media Library ↗
                </a>
              </div>
            ) : (
              <div style={{
                background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12,
                padding: 20, marginBottom: 20,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111' }}>
                      Select Assets to Analyze
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#9CA3AF' }}>
                      {imageMedia.length} image{imageMedia.length !== 1 ? 's' : ''}
                      {videoMedia.length > 0 && ` · ${videoMedia.length} video${videoMedia.length !== 1 ? 's' : ''}`}
                      {' '}in workspace
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: '#6B7280' }}>
                      {selectedMedia.size} selected
                    </span>
                    <button
                      onClick={toggleAll}
                      style={{
                        fontSize: 12, padding: '4px 12px', borderRadius: 6, cursor: 'pointer',
                        border: '1px solid #D1D5DB', background: '#F9FAFB', color: '#374151', fontWeight: 600,
                      }}
                    >
                      {selectedMedia.size === mediaItems.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                </div>

                {/* Asset grid */}
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10,
                  maxHeight: 340, overflowY: 'auto', padding: '4px 2px',
                }}>
                  {mediaItems.map(m => {
                    const isSelected = selectedMedia.has(m.id)
                    const isImage = m.type === 'IMAGE' || m.type === 'LOGO'
                    return (
                      <div
                        key={m.id}
                        onClick={() => toggleMedia(m.id)}
                        style={{
                          position: 'relative', borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                          border: `2px solid ${isSelected ? '#6366F1' : '#E5E7EB'}`,
                          transition: 'all 0.12s', background: '#F3F4F6',
                        }}
                      >
                        {isImage ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={m.url} alt={m.fileName}
                            style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }}
                          />
                        ) : (
                          <div style={{
                            height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 28, background: '#1F2937',
                          }}>
                            {m.type === 'VIDEO' ? '🎬' : '📄'}
                          </div>
                        )}
                        <div style={{ padding: '6px 8px' }}>
                          <p style={{
                            margin: 0, fontSize: 10, color: '#374151', fontWeight: 600,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {m.fileName}
                          </p>
                          <p style={{ margin: 0, fontSize: 9, color: '#9CA3AF' }}>{m.type}</p>
                        </div>
                        {isSelected && (
                          <div style={{
                            position: 'absolute', top: 6, right: 6, width: 20, height: 20,
                            borderRadius: '50%', background: '#6366F1', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                          }}>
                            <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>✓</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {videoMedia.length > 0 && (
                  <p style={{ margin: '10px 0 0', fontSize: 11, color: '#9CA3AF' }}>
                    ℹ️ Video analysis (frame-level) is coming in V2. Videos will be included with a manual review note.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Generate Button ── */}
        {!generating && (
          <div className="no-print" style={{ marginBottom: 28 }}>
            {error && (
              <div style={{
                background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
                padding: '10px 14px', marginBottom: 12,
              }}>
                <p style={{ margin: 0, fontSize: 13, color: '#DC2626' }}>⚠️ {error}</p>
              </div>
            )}
            <button
              onClick={handleGenerate}
              disabled={mode === 'asset' && mediaItems.length === 0}
              style={{
                width: '100%', padding: '14px 24px', borderRadius: 10, border: 'none',
                background: (mode === 'asset' && mediaItems.length === 0) ? '#E5E7EB' : '#6366F1',
                color: (mode === 'asset' && mediaItems.length === 0) ? '#9CA3AF' : '#fff',
                fontSize: 14, fontWeight: 700, cursor: (mode === 'asset' && mediaItems.length === 0) ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {mode === 'asset'
                ? `🔍 Analyze ${selectedMedia.size > 0 ? `${selectedMedia.size} Selected Asset${selectedMedia.size !== 1 ? 's' : ''}` : 'All Assets'} with AI`
                : '✨ Generate Visual Concepts'
              }
            </button>
            {creativeBrief && (
              <p style={{ textAlign: 'center', margin: '8px 0 0', fontSize: 12, color: '#9CA3AF' }}>
                Last generated: {new Date(creativeBrief.generatedAt).toLocaleString()}
                {' · '}
                <span
                  onClick={handleGenerate}
                  style={{ color: '#6366F1', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Regenerate
                </span>
              </p>
            )}
          </div>
        )}

        {/* ── Generating State ── */}
        {generating && (
          <div className="no-print" style={{
            background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12,
            padding: '40px 24px', textAlign: 'center', marginBottom: 28,
          }}>
            <div style={{
              width: 40, height: 40, border: '3px solid #E5E7EB', borderTopColor: '#6366F1',
              borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
            }} />
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#111' }}>
              {mode === 'asset' ? 'Analyzing your assets…' : 'Generating visual concepts…'}
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: '#9CA3AF' }}>
              {mode === 'asset'
                ? 'NEXUS Visual Director is analyzing each asset with GPT-4o vision. This may take 30–60 seconds.'
                : 'NEXUS Visual Director is building your complete visual concept package. This takes about 20 seconds.'}
            </p>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────────
            RESULTS — Asset Mode
        ───────────────────────────────────────────────────────────────────── */}

        {creativeBrief && creativeBrief.mode === 'asset' && (

          <div>
            {/* Overall Creative Direction */}
            {creativeBrief.overallCreativeDirection && (
              <SectionCard title="Overall Creative Direction" icon="🎯" accent="#6366F1">
                <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.7 }}>
                  {creativeBrief.overallCreativeDirection}
                </p>
              </SectionCard>
            )}

            {/* Top Assets Recommendation */}
            {(creativeBrief.topAssetsForCampaign?.length ?? 0) > 0 && (
              <SectionCard title="Top Assets for This Campaign" icon="⭐" accent="#F59E0B">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {creativeBrief.topAssetsForCampaign!.map((name, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8,
                      padding: '6px 12px',
                    }}>
                      <span style={{ fontSize: 14 }}>#{i + 1}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#92400E' }}>{name}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Per-Asset Analyses */}
            {(creativeBrief.assetAnalyses?.length ?? 0) > 0 && (
              <SectionCard title={`Asset Analyses (${creativeBrief.assetAnalyses!.length})`} icon="🖼️" accent="#6366F1">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {creativeBrief.assetAnalyses!.map((a, i) => (
                    <div key={i} style={{
                      border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden',
                    }}>
                      {/* Asset header */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
                        background: '#F9FAFB', borderBottom: '1px solid #E5E7EB',
                      }}>
                        {(a.type === 'IMAGE' || a.type === 'LOGO') && a.url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={a.url} alt={a.fileName}
                            style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
                          />
                        ) : (
                          <div style={{
                            width: 56, height: 56, background: '#1F2937', borderRadius: 6, flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                          }}>
                            {a.type === 'VIDEO' ? '🎬' : '📄'}
                          </div>
                        )}
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111' }}>{a.fileName}</p>
                          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                            <Tag label={a.type} color="#6B7280" />
                            {a.contentType && a.contentType !== 'Unknown' && (
                              <Tag label={a.contentType} color="#6366F1" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Analysis body */}
                      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {a.brandAlignment && (
                          <div>
                            <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 }}>Brand Alignment</p>
                            <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{a.brandAlignment}</p>
                          </div>
                        )}
                        {a.campaignFit && (
                          <div>
                            <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 }}>Campaign Fit</p>
                            <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{a.campaignFit}</p>
                          </div>
                        )}
                        {a.qualityNotes && (
                          <div>
                            <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 }}>Quality Notes</p>
                            <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{a.qualityNotes}</p>
                          </div>
                        )}
                        {a.suggestedUse.length > 0 && (
                          <div>
                            <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 }}>Suggested Use</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {a.suggestedUse.map((u, j) => <Tag key={j} label={u} color="#22C55E" />)}
                            </div>
                          </div>
                        )}
                        {a.adCopyHook && (
                          <div style={{ background: '#FFF7ED', border: '1px solid #FDBA74', borderRadius: 8, padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                              <div>
                                <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#EA580C', textTransform: 'uppercase', letterSpacing: 0.5 }}>Ad Copy Hook</p>
                                <p style={{ margin: 0, fontSize: 13, color: '#374151', fontStyle: 'italic', lineHeight: 1.6 }}>"{a.adCopyHook}"</p>
                              </div>
                              <CopyButton text={a.adCopyHook} />
                            </div>
                          </div>
                        )}
                        {a.captionSuggestion && (
                          <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 8, padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                              <div style={{ flex: 1 }}>
                                <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#16A34A', textTransform: 'uppercase', letterSpacing: 0.5 }}>Caption Suggestion</p>
                                <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{a.captionSuggestion}</p>
                              </div>
                              <CopyButton text={a.captionSuggestion} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Ad Copy Variants */}
            {(creativeBrief.adCopyVariants?.length ?? 0) > 0 && (
              <SectionCard title="Ad Copy Variants" icon="✍️" accent="#F59E0B">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>Ready-to-use ad copy based on your assets</p>
                  <CopyAllButton texts={creativeBrief.adCopyVariants!} label="Copy All Variants" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {creativeBrief.adCopyVariants!.map((variant, i) => (
                    <div key={i} style={{
                      background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: '12px 14px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10,
                    }}>
                      <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.6, flex: 1 }}>{variant}</p>
                      <CopyButton text={variant} />
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Caption Formulas */}
            {(creativeBrief.captionFormulas?.length ?? 0) > 0 && (
              <SectionCard title="Caption Formulas" icon="📝" accent="#6366F1">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>Reusable templates — replace [brackets] with your specifics</p>
                  <CopyAllButton texts={creativeBrief.captionFormulas!} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {creativeBrief.captionFormulas!.map((formula, i) => (
                    <div key={i} style={{
                      background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 8, padding: '10px 14px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10,
                    }}>
                      <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.6, flex: 1 }}>{formula}</p>
                      <CopyButton text={formula} />
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Asset-Based Scripts */}
            {(creativeBrief.assetBasedScripts?.length ?? 0) > 0 && (
              <SectionCard title="Content Scripts" icon="🎬" accent="#EC4899">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>Reel / TikTok scripts built around your assets</p>
                  <CopyAllButton texts={creativeBrief.assetBasedScripts!} label="Copy All Scripts" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {creativeBrief.assetBasedScripts!.map((script, i) => (
                    <div key={i} style={{
                      background: '#FDF4FF', border: '1px solid #F0ABFC', borderRadius: 8, padding: '14px 16px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#A21CAF' }}>Script {i + 1}</p>
                        <CopyButton text={script} />
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{script}</p>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────────
            RESULTS — Concept Mode
        ───────────────────────────────────────────────────────────────────── */}

        {creativeBrief && creativeBrief.mode === 'concept' && (
          <div>

            {/* Mood + Color Direction */}
            {(creativeBrief.moodDescription || (creativeBrief.colorDirections?.length ?? 0) > 0) && (
              <SectionCard title="Visual Mood & Color Direction" icon="🎨" accent="#EC4899">
                {creativeBrief.moodDescription && (
                  <p style={{ margin: '0 0 16px', fontSize: 14, color: '#374151', lineHeight: 1.7, fontStyle: 'italic' }}>
                    "{creativeBrief.moodDescription}"
                  </p>
                )}
                {(creativeBrief.colorDirections?.length ?? 0) > 0 && (
                  <div>
                    <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 }}>Color Directions</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {creativeBrief.colorDirections!.map((dir, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px',
                          background: '#FDF4FF', border: '1px solid #E9D5FF', borderRadius: 8,
                        }}>
                          <span style={{ fontSize: 14, flexShrink: 0 }}>🎨</span>
                          <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{dir}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </SectionCard>
            )}

            {/* Image Prompts */}
            {(creativeBrief.imagePrompts?.length ?? 0) > 0 && (
              <SectionCard title="Image Generation Prompts" icon="✨" accent="#6366F1">
                <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>
                    Ready to use in Midjourney, DALL-E, or brief your photographer
                  </p>
                  <CopyAllButton
                    texts={creativeBrief.imagePrompts!.map(p => `[${p.platform} — ${p.aspectRatio}]\n${p.prompt}\n\nNotes: ${p.notes}`)}
                    label="Copy All Prompts"
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {creativeBrief.imagePrompts!.map((prompt, i) => (
                    <div key={i} style={{ border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                        background: '#F9FAFB', borderBottom: '1px solid #E5E7EB',
                      }}>
                        <Tag label={prompt.platform} color="#6366F1" />
                        <Tag label={prompt.aspectRatio} color="#6B7280" />
                        <span style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic', flex: 1 }}>{prompt.style}</span>
                      </div>
                      <div style={{ padding: '12px 14px' }}>
                        <div style={{
                          background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 8,
                          padding: '10px 14px', marginBottom: 10,
                          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10,
                        }}>
                          <p style={{ margin: 0, fontSize: 13, color: '#0C4A6E', lineHeight: 1.7, fontFamily: 'monospace', flex: 1 }}>
                            {prompt.prompt}
                          </p>
                          <CopyButton text={prompt.prompt} />
                        </div>
                        {prompt.notes && (
                          <p style={{ margin: 0, fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
                            <strong>Production note:</strong> {prompt.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Storyboard */}
            {(creativeBrief.storyboardScenes?.length ?? 0) > 0 && (
              <SectionCard title="Storyboard" icon="🎬" accent="#F59E0B">
                <p style={{ margin: '0 0 16px', fontSize: 12, color: '#6B7280' }}>
                  Scene-by-scene visual plan for Reels / TikTok
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {creativeBrief.storyboardScenes!.map((scene, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: 14, padding: '14px 16px',
                      background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10,
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%', background: '#F59E0B',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        color: '#fff', fontWeight: 800, fontSize: 14,
                      }}>
                        {scene.sceneNumber}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                          <Tag label={scene.platform} color="#F59E0B" />
                          {scene.duration && <Tag label={scene.duration} color="#6B7280" />}
                        </div>
                        <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: '#111' }}>{scene.description}</p>
                        {scene.visualNotes && (
                          <p style={{ margin: '0 0 4px', fontSize: 12, color: '#6B7280' }}>
                            <strong>Visual:</strong> {scene.visualNotes}
                          </p>
                        )}
                        {scene.textOverlay && scene.textOverlay !== 'none' && (
                          <p style={{ margin: 0, fontSize: 12, color: '#D97706' }}>
                            <strong>Text overlay:</strong> "{scene.textOverlay}"
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Production Brief */}
            {creativeBrief.productionBrief && (
              <SectionCard title="Production Brief" icon="📋" accent="#22C55E">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.8, flex: 1 }}>
                    {creativeBrief.productionBrief}
                  </p>
                  <CopyButton text={creativeBrief.productionBrief} />
                </div>
              </SectionCard>
            )}

            {/* Platform Layouts */}
            {creativeBrief.platformLayouts && Object.keys(creativeBrief.platformLayouts).length > 0 && (
              <SectionCard title="Platform Layouts" icon="📱" accent="#6366F1">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {Object.entries(creativeBrief.platformLayouts).map(([platform, direction]) => (
                    <div key={platform} style={{
                      border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden',
                    }}>
                      <div style={{
                        padding: '8px 12px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB',
                      }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'capitalize' }}>
                          {platform.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div style={{
                        padding: '10px 14px', display: 'flex',
                        alignItems: 'flex-start', justifyContent: 'space-between', gap: 10,
                      }}>
                        <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.6, flex: 1 }}>{direction}</p>
                        <CopyButton text={direction} />
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Creative Notes */}
            {creativeBrief.creativeNotes && (
              <SectionCard title="Creative Director Notes" icon="💡" accent="#F59E0B">
                <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.8 }}>
                  {creativeBrief.creativeNotes}
                </p>
              </SectionCard>
            )}
          </div>
        )}

        {/* ── Empty state ── */}
        {!creativeBrief && !generating && (
          <div style={{
            background: '#fff', border: '1px dashed #D1D5DB', borderRadius: 16,
            padding: '48px 24px', textAlign: 'center',
          }}>
            <p style={{ fontSize: 40, margin: '0 0 12px' }}>
              {mode === 'asset' ? '🖼️' : '✨'}
            </p>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#111' }}>
              {mode === 'asset' ? 'Ready to analyze your assets' : 'Ready to generate visual concepts'}
            </h3>
            <p style={{ margin: '0 auto', fontSize: 14, color: '#9CA3AF', maxWidth: 440 }}>
              {mode === 'asset'
                ? 'Select the assets above and click Analyze. NEXUS will produce per-asset creative direction, ad copy, captions, and campaign-ready scripts.'
                : 'Click Generate to produce a complete visual concept package: image prompts, storyboard, production brief, and platform-specific layout directions.'}
            </p>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid #E5E7EB', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 12, color: '#D1D5DB' }}>
            NEXUS AI — Visual Director · {campaign.name}
          </p>
        </div>

      </div>
    </div>
  )
}
