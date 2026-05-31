'use client'

/**
 * Content Pack Page — /campaigns/[id]/content-pack
 *
 * Interactive, copy-ready page showing all campaign content
 * organized by platform. Opened in a new tab from Campaign Detail.
 *
 * Sprint E — Campaign Execution Pipeline
 */

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

interface Campaign {
  id: string
  name: string
  goal: string
  audience?: string
  platforms: string[]
  aiOutput?: any
  createdAt: string
}

const PLATFORM_LABELS: Record<string, string> = {
  INSTAGRAM: 'Instagram', TIKTOK: 'TikTok', FACEBOOK: 'Facebook',
  YOUTUBE_SHORTS: 'YouTube Shorts', LINKEDIN: 'LinkedIn', SNAPCHAT: 'Snapchat',
}

const PLATFORM_ICONS: Record<string, string> = {
  INSTAGRAM: '📸', TIKTOK: '🎵', FACEBOOK: '👥',
  YOUTUBE_SHORTS: '▶️', LINKEDIN: '💼', SNAPCHAT: '👻',
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      style={{
        fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
        background: copied ? '#22C55E' : '#F0F0F0', color: copied ? '#fff' : '#555',
        border: 'none', fontWeight: 600, transition: 'all 0.15s', flexShrink: 0,
        whiteSpace: 'nowrap',
      }}
    >
      {copied ? '✓ Copied' : label}
    </button>
  )
}

function CopyAllButton({ texts }: { texts: string[] }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(texts.join('\n\n'))
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      style={{
        fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
        background: copied ? '#22C55E' : '#FF9500', color: copied ? '#fff' : '#000',
        border: 'none', fontWeight: 700, transition: 'all 0.15s',
      }}
    >
      {copied ? '✓ Copied All' : 'Copy All'}
    </button>
  )
}

export default function ContentPackPage() {
  const params = useParams()
  const router = useRouter()
  const campaignId = params?.id as string
  const { isAuthenticated, loading, authHeader } = useAuth()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [fetching, setFetching] = useState(true)
  const [activePlatform, setActivePlatform] = useState('ALL')

  const fetchCampaign = useCallback(async () => {
    const token = authHeader()
    if (!token) return
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, { headers: { Authorization: token } })
      const d = await res.json()
      if (d.campaign) setCampaign(d.campaign)
    } catch {}
  }, [campaignId, authHeader])

  useEffect(() => {
    if (!loading && !isAuthenticated) { router.push('/auth/login'); return }
    if (!isAuthenticated) return
    fetchCampaign().finally(() => setFetching(false))
  }, [loading, isAuthenticated, fetchCampaign, router])

  if (loading || fetching) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#fff' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 24, height: 24, border: '2px solid #ddd', borderTopColor: '#FF9500', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          <p style={{ color: '#999', fontSize: 14 }}>Loading content pack...</p>
        </div>
      </div>
    )
  }

  if (!campaign || !campaign.aiOutput) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#fff' }}>
        <p style={{ color: '#999' }}>No content available for this campaign.</p>
      </div>
    )
  }

  const aiOutput = campaign.aiOutput as any
  const strategy = aiOutput?.strategy || {}
  const topHooks: string[] = aiOutput?.topHooks || strategy.topHooks || []
  const ctaVariations: string[] = aiOutput?.ctaVariations || strategy.ctaVariations || []
  const captionFormulas: string[] = aiOutput?.captionFormulas || []
  const scriptTemplate: string = aiOutput?.scriptTemplate || ''
  const contentAngles: string[] = strategy.contentAngles || []
  const contentAnglesDetailed: any[] = strategy.contentAnglesDetailed || []
  const contentCalendar: any[] = aiOutput?.contentCalendar || strategy.contentCalendar || []
  const channelStrategy: any[] = strategy.channelStrategy || []

  // Build platform list from calendar posts + detailed angles
  const calendarPlatforms = Array.from(new Set([
    ...contentCalendar.flatMap(week => (week.posts || []).map((p: any) => p.platform as string)),
    ...contentAnglesDetailed.map(a => (a.platform as string)?.toUpperCase()).filter(Boolean),
  ])).filter(Boolean)

  const allPlatforms = ['ALL', ...calendarPlatforms]

  // Filter calendar by active platform
  const filteredCalendar = activePlatform === 'ALL'
    ? contentCalendar
    : contentCalendar
        .map(week => ({
          ...week,
          posts: (week.posts || []).filter((p: any) => p.platform === activePlatform),
        }))
        .filter(week => week.posts.length > 0)

  // Filter detailed angles by active platform
  const filteredAngles = activePlatform === 'ALL'
    ? contentAnglesDetailed
    : contentAnglesDetailed.filter(a => (a.platform as string)?.toUpperCase() === activePlatform)

  const platformInfo = channelStrategy.find((ch: any) =>
    ch.platform?.toUpperCase() === activePlatform.toUpperCase()
  )

  const date = new Date(campaign.createdAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const s = {
    page: { fontFamily: "'Inter', system-ui, sans-serif", background: '#fff', minHeight: '100vh', color: '#111' } as React.CSSProperties,
    header: { background: '#111', color: '#fff', padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 12 },
    brand: { fontSize: 12, fontWeight: 800, letterSpacing: '0.15em', color: '#FF9500', marginBottom: 4 },
    title: { fontSize: 20, fontWeight: 800, color: '#fff' },
    meta: { fontSize: 12, color: '#888', marginTop: 4 },
    tabs: { display: 'flex', gap: 8, padding: '16px 32px', borderBottom: '1px solid #F0F0F0', overflowX: 'auto' as const, background: '#FAFAFA', flexWrap: 'wrap' as const },
    tab: (active: boolean): React.CSSProperties => ({
      padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
      background: active ? '#FF9500' : '#fff', color: active ? '#000' : '#666',
      boxShadow: active ? '0 2px 8px rgba(255,149,0,0.3)' : '0 1px 4px rgba(0,0,0,0.08)',
      transition: 'all 0.15s', whiteSpace: 'nowrap',
    }),
    body: { maxWidth: 860, margin: '0 auto', padding: '32px 32px 64px' } as React.CSSProperties,
    section: { marginBottom: 32 } as React.CSSProperties,
    sectionTitle: { fontSize: 13, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#888', marginBottom: 12 },
    card: { background: '#F9F9F9', border: '1px solid #EDEDED', borderRadius: 10, padding: '16px 18px', marginBottom: 10 } as React.CSSProperties,
    weekTitle: { fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 4 },
    weekTheme: { fontSize: 12, color: '#999', fontStyle: 'italic', marginBottom: 12 },
    postCard: { background: '#fff', border: '1px solid #E8E8E8', borderRadius: 8, padding: '14px 16px', marginBottom: 8 } as React.CSSProperties,
    postMeta: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' as const },
    badge: (color: string): React.CSSProperties => ({
      fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700,
      background: color + '18', color: color, border: `1px solid ${color}40`,
    }),
    fieldRow: { display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 } as React.CSSProperties,
    fieldLabel: { fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#999', width: 70, flexShrink: 0, paddingTop: 2 },
    fieldValue: { fontSize: 13, color: '#333', flex: 1, lineHeight: 1.5 },
    copyRow: { display: 'flex', alignItems: 'flex-start', gap: 8, justifyContent: 'space-between' },
    hookCard: { display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #E8E8E8', borderRadius: 8, padding: '12px 14px', marginBottom: 6 } as React.CSSProperties,
    hookText: { fontSize: 13, fontWeight: 600, color: '#FF9500', fontStyle: 'italic', flex: 1 },
    ctaCard: { display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #E8E8E8', borderRadius: 8, padding: '10px 14px', marginBottom: 6 } as React.CSSProperties,
    ctaText: { fontSize: 13, color: '#333', flex: 1 },
    captionCard: { background: '#fff', border: '1px solid #E8E8E8', borderRadius: 8, padding: '12px 14px', marginBottom: 6 } as React.CSSProperties,
    captionText: { fontSize: 13, color: '#444', lineHeight: 1.6 },
    platformInfo: { background: '#FFF8EE', border: '1px solid #FFE0A0', borderRadius: 10, padding: '14px 16px', marginBottom: 20 } as React.CSSProperties,
    platformInfoTitle: { fontSize: 12, fontWeight: 700, color: '#B45309', marginBottom: 4 },
    platformInfoText: { fontSize: 12, color: '#92400E', lineHeight: 1.6 },
    empty: { textAlign: 'center' as const, padding: '40px 20px', color: '#BBB', fontSize: 14 },
    printBtn: { position: 'fixed' as const, bottom: 24, right: 24, background: '#FF9500', color: '#000', fontWeight: 700, fontSize: 13, padding: '10px 20px', border: 'none', borderRadius: 10, cursor: 'pointer', boxShadow: '0 4px 16px rgba(255,149,0,0.3)', zIndex: 100 },
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        @media print {
          .no-print { display: none !important; }
          @page { margin: 14mm 18mm; size: A4; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <button className="no-print" style={s.printBtn} onClick={() => window.print()}>⬇ Save as PDF</button>

      <div style={s.page}>
        {/* Header */}
        <div style={s.header}>
          <div>
            <div style={s.brand}>NEXUS AI</div>
            <div style={s.title}>{campaign.name}</div>
            <div style={s.meta}>
              {campaign.goal?.toLowerCase()} · Content Pack · {date}
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12, color: '#888' }}>
            {campaign.audience && <div>Audience: {campaign.audience}</div>}
            <div style={{ marginTop: 4, color: '#666' }}>
              {campaign.platforms?.map(p => (PLATFORM_ICONS[p] || '🌐') + ' ' + (PLATFORM_LABELS[p] || p)).join('  ')}
            </div>
          </div>
        </div>

        {/* Platform Tabs */}
        <div style={s.tabs}>
          {allPlatforms.map(platform => (
            <button
              key={platform}
              className="no-print"
              style={s.tab(activePlatform === platform)}
              onClick={() => setActivePlatform(platform)}
            >
              {platform === 'ALL' ? '🗂 All Platforms' : `${PLATFORM_ICONS[platform] || '🌐'} ${PLATFORM_LABELS[platform] || platform}`}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={s.body}>

          {/* Platform context (when a specific platform is selected) */}
          {activePlatform !== 'ALL' && platformInfo && (
            <div style={s.platformInfo}>
              <div style={s.platformInfoTitle}>{PLATFORM_ICONS[activePlatform] || '🌐'} {PLATFORM_LABELS[activePlatform] || activePlatform} — Platform Strategy</div>
              {platformInfo.role && <div style={s.platformInfoText}><strong>Role:</strong> {platformInfo.role}</div>}
              {platformInfo.contentType && <div style={s.platformInfoText}><strong>Content Type:</strong> {platformInfo.contentType}</div>}
              {platformInfo.postingApproach && <div style={s.platformInfoText}><strong>Approach:</strong> {platformInfo.postingApproach}</div>}
              {platformInfo.cta && <div style={s.platformInfoText}><strong>Platform CTA:</strong> {platformInfo.cta}</div>}
            </div>
          )}

          {/* Calendar Posts */}
          {filteredCalendar.length > 0 ? (
            <div style={s.section}>
              <div style={s.sectionTitle}>
                {activePlatform === 'ALL' ? 'Content Calendar — All Platforms' : `${PLATFORM_LABELS[activePlatform] || activePlatform} — Scheduled Posts`}
              </div>
              {filteredCalendar.map((week: any, wi: number) => (
                <div key={wi} style={s.card}>
                  <div style={s.weekTitle}>Week {week.week || wi + 1}</div>
                  {week.theme && <div style={s.weekTheme}>{week.theme}</div>}
                  {(week.posts || []).map((post: any, pi: number) => (
                    <div key={pi} style={s.postCard}>
                      {/* Post meta */}
                      <div style={s.postMeta}>
                        <span style={s.badge('#6366F1')}>{post.day || `Post ${pi + 1}`}</span>
                        <span style={s.badge('#FF9500')}>{PLATFORM_ICONS[post.platform] || '🌐'} {PLATFORM_LABELS[post.platform] || post.platform}</span>
                        {(post.type || post.format) && <span style={s.badge('#10B981')}>{post.type || post.format}</span>}
                        {post.contentPillar && <span style={s.badge('#888')}>{post.contentPillar}</span>}
                      </div>

                      {/* Hook */}
                      {post.hook && (
                        <div style={{ ...s.fieldRow, marginBottom: 10 }}>
                          <span style={s.fieldLabel}>Hook</span>
                          <div style={s.copyRow}>
                            <span style={{ ...s.fieldValue, color: '#FF9500', fontWeight: 600, fontStyle: 'italic' }}>"{post.hook}"</span>
                            <CopyButton text={post.hook} />
                          </div>
                        </div>
                      )}

                      {/* Caption */}
                      {post.caption && (
                        <div style={{ ...s.fieldRow, marginBottom: 10 }}>
                          <span style={s.fieldLabel}>Caption</span>
                          <div style={s.copyRow}>
                            <span style={s.fieldValue}>{post.caption}</span>
                            <CopyButton text={post.caption} />
                          </div>
                        </div>
                      )}

                      {/* Hashtags */}
                      {post.hashtags?.length > 0 && (
                        <div style={{ ...s.fieldRow, marginBottom: 10 }}>
                          <span style={s.fieldLabel}>Hashtags</span>
                          <div style={s.copyRow}>
                            <span style={{ ...s.fieldValue, color: '#6366F1' }}>{post.hashtags.map((h: string) => h.startsWith('#') ? h : '#' + h).join(' ')}</span>
                            <CopyButton text={post.hashtags.map((h: string) => h.startsWith('#') ? h : '#' + h).join(' ')} />
                          </div>
                        </div>
                      )}

                      {/* CTA */}
                      {post.cta && (
                        <div style={{ ...s.fieldRow, marginBottom: 10 }}>
                          <span style={s.fieldLabel}>CTA</span>
                          <div style={s.copyRow}>
                            <span style={{ ...s.fieldValue, color: '#22C55E', fontWeight: 600 }}>{post.cta}</span>
                            <CopyButton text={post.cta} />
                          </div>
                        </div>
                      )}

                      {/* Visual Note */}
                      {post.visualNote && (
                        <div style={s.fieldRow}>
                          <span style={{ ...s.fieldLabel, color: '#C084FC' }}>Visual</span>
                          <span style={{ ...s.fieldValue, color: '#7C3AED', fontStyle: 'italic' }}>{post.visualNote}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            activePlatform !== 'ALL' && (
              <div style={s.empty}>No posts scheduled for {PLATFORM_LABELS[activePlatform] || activePlatform} in this campaign.</div>
            )
          )}

          {/* General Content Bank — always visible */}
          <div style={{ ...s.section, borderTop: filteredCalendar.length > 0 ? '1px solid #F0F0F0' : 'none', paddingTop: filteredCalendar.length > 0 ? 24 : 0 }}>
            <div style={s.sectionTitle}>General Content Bank</div>

            {/* Top Hooks */}
            {topHooks.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#555' }}>🪝 Top Hooks ({topHooks.length})</span>
                  <CopyAllButton texts={topHooks} />
                </div>
                {topHooks.map((hook, i) => (
                  <div key={i} style={s.hookCard}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#CCC', width: 20, flexShrink: 0 }}>{i + 1}</span>
                    <span style={s.hookText}>"{hook}"</span>
                    <CopyButton text={hook} />
                  </div>
                ))}
              </div>
            )}

            {/* CTA Variations */}
            {ctaVariations.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#555' }}>📣 CTA Variations ({ctaVariations.length})</span>
                  <CopyAllButton texts={ctaVariations} />
                </div>
                {ctaVariations.map((cta, i) => (
                  <div key={i} style={s.ctaCard}>
                    <span style={{ color: '#FF9500', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>→</span>
                    <span style={s.ctaText}>{cta}</span>
                    <CopyButton text={cta} />
                  </div>
                ))}
              </div>
            )}

            {/* Caption Formulas */}
            {captionFormulas.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#555' }}>✍️ Caption Formulas ({captionFormulas.length})</span>
                  <CopyAllButton texts={captionFormulas} />
                </div>
                {captionFormulas.map((cap, i) => (
                  <div key={i} style={s.captionCard}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <span style={s.captionText}>{cap}</span>
                      <CopyButton text={cap} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Content Angles — rich (Sprint M) or fallback string list */}
            {filteredAngles.length > 0 ? (
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#555' }}>💡 Content Angles ({filteredAngles.length})</span>
                  <CopyAllButton texts={filteredAngles.map((a: any) => [a.hook, a.caption, a.cta].filter(Boolean).join('\n'))} />
                </div>
                {filteredAngles.map((angle: any, i: number) => (
                  <div key={i} style={{
                    ...s.captionCard,
                    marginBottom: 12,
                    padding: '14px 16px',
                    border: '1px solid #E0E0E0',
                    borderRadius: 10,
                  }}>
                    {/* Angle header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' as const }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#111', flex: 1 }}>{angle.title || angle.angle || `Angle ${i + 1}`}</span>
                      {angle.platform && (
                        <span style={s.badge('#6366F1')}>{PLATFORM_ICONS[angle.platform?.toUpperCase()] || '🌐'} {angle.platform}</span>
                      )}
                      {angle.format && <span style={s.badge('#10B981')}>{angle.format}</span>}
                      {angle.funnelStage && <span style={s.badge('#F59E0B')}>{angle.funnelStage}</span>}
                    </div>
                    {/* Hook */}
                    {angle.hook && (
                      <div style={{ ...s.fieldRow, marginBottom: 8 }}>
                        <span style={s.fieldLabel}>Hook</span>
                        <div style={s.copyRow}>
                          <span style={{ ...s.fieldValue, color: '#FF9500', fontWeight: 600, fontStyle: 'italic' }}>"{angle.hook}"</span>
                          <CopyButton text={angle.hook} />
                        </div>
                      </div>
                    )}
                    {/* Caption */}
                    {angle.caption && (
                      <div style={{ ...s.fieldRow, marginBottom: 8 }}>
                        <span style={s.fieldLabel}>Caption</span>
                        <div style={s.copyRow}>
                          <span style={s.fieldValue}>{angle.caption}</span>
                          <CopyButton text={angle.caption} />
                        </div>
                      </div>
                    )}
                    {/* CTA */}
                    {angle.cta && (
                      <div style={{ ...s.fieldRow, marginBottom: angle.assetNeeded ? 8 : 0 }}>
                        <span style={s.fieldLabel}>CTA</span>
                        <div style={s.copyRow}>
                          <span style={{ ...s.fieldValue, color: '#22C55E', fontWeight: 600 }}>{angle.cta}</span>
                          <CopyButton text={angle.cta} />
                        </div>
                      </div>
                    )}
                    {/* Asset needed */}
                    {angle.assetNeeded && (
                      <div style={{ ...s.fieldRow, marginBottom: 0, marginTop: 4 }}>
                        <span style={{ ...s.fieldLabel, color: '#C084FC' }}>Asset</span>
                        <span style={{ ...s.fieldValue, color: '#7C3AED', fontStyle: 'italic', fontSize: 12 }}>{angle.assetNeeded}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : contentAngles.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#555' }}>💡 Content Angles ({contentAngles.length})</span>
                  <CopyAllButton texts={contentAngles} />
                </div>
                {contentAngles.map((angle, i) => (
                  <div key={i} style={{ ...s.captionCard, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#CCC', width: 20, flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ ...s.captionText, flex: 1 }}>{angle}</span>
                    <CopyButton text={angle} />
                  </div>
                ))}
              </div>
            )}

            {/* Script Template */}
            {scriptTemplate && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#555' }}>📝 Script Template</span>
                  <CopyButton text={scriptTemplate} />
                </div>
                <div style={{ ...s.captionCard, whiteSpace: 'pre-wrap' }}>
                  <span style={{ ...s.captionText, fontFamily: 'monospace' }}>{scriptTemplate}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
