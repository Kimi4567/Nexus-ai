'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import AppShell from '@/components/AppShell'
import { generateCampaignPDF } from '@/lib/pdf/campaignReport'

interface Concept {
  name: string
  description: string
  angle: string
  hook: string
  script: string
  cta: string
  headlines: string[]
  captions: string[]
  platform: string
  format: string
  estimatedReach: string
}

interface Strategy {
  overview: string
  positioning: string
  audience: string | { demographics?: string; psychographics?: string }
  valueProps: string[]
  contentPillars: string[]
  angles: string[]
  platformRecommendations: Record<string, string>
  contentCalendar: any[]
  metrics: Record<string, string>
  ctaStrategies: string[]
}

interface CampaignResult {
  campaign: { name: string; goal: string; audience: string; tone: string; platforms: string[] }
  strategy: Strategy
  concepts: Concept[]
  generatedAt: string
}

const PLATFORM_ICONS: Record<string, string> = {
  INSTAGRAM: '📸', TIKTOK: '🎵', FACEBOOK: '👥',
  YOUTUBE_SHORTS: '▶️', LINKEDIN: '💼', SNAPCHAT: '👻',
}

// Normalize audience — OpenAI sometimes returns an object {demographics, psychographics} instead of a string
function normalizeAudience(audience: any): string {
  if (!audience) return 'General audience'
  if (typeof audience === 'string') return audience
  if (typeof audience === 'object') {
    const parts: string[] = []
    const stringify = (v: any): string => {
      if (typeof v === 'string') return v
      if (Array.isArray(v)) return v.join(', ')
      if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${k}: ${val}`).join(', ')
      return String(v)
    }
    if (audience.demographics) parts.push(stringify(audience.demographics))
    if (audience.psychographics) parts.push(stringify(audience.psychographics))
    if (parts.length === 0) return JSON.stringify(audience)
    return parts.join('. ')
  }
  return String(audience)
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="text-xs px-3 py-1 rounded-lg bg-dark-tertiary hover:bg-accent hover:text-dark transition font-semibold">
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="bg-dark-secondary border border-dark-tertiary rounded-xl overflow-hidden mb-6">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between p-6 hover:bg-dark/30 transition">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <h2 className="text-xl font-bold">{title}</h2>
        </div>
        <span className="text-gray-400 text-lg">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="px-6 pb-6">{children}</div>}
    </div>
  )
}

// Legacy TXT download — kept for reference, replaced by generateCampaignPDF
function _downloadCampaignTxt(result: CampaignResult) {
  const { campaign, strategy, concepts } = result
  const lines: string[] = []

  lines.push('═'.repeat(60))
  lines.push(`NEXUS AI — CAMPAIGN REPORT`)
  lines.push(`Generated: ${new Date(result.generatedAt).toLocaleString()}`)
  lines.push('═'.repeat(60))
  lines.push('')
  lines.push(`Campaign: ${campaign.name}`)
  lines.push(`Goal: ${campaign.goal}`)
  lines.push(`Platforms: ${campaign.platforms.join(', ')}`)
  lines.push(`Tone: ${campaign.tone}`)
  lines.push(`Audience: ${campaign.audience || 'General'}`)
  lines.push('')

  // Strategy
  lines.push('─'.repeat(60))
  lines.push('🧠 CAMPAIGN STRATEGY')
  lines.push('─'.repeat(60))
  lines.push('')
  lines.push('Overview:')
  lines.push(strategy.overview)
  lines.push('')
  lines.push('Positioning:')
  lines.push(strategy.positioning)
  lines.push('')
  lines.push('Target Audience:')
  lines.push(normalizeAudience(strategy.audience))
  lines.push('')
  lines.push('Value Propositions:')
  strategy.valueProps?.forEach((vp, i) => lines.push(`  ${i + 1}. ${vp}`))
  lines.push('')
  lines.push('Content Pillars:')
  strategy.contentPillars?.forEach((p, i) => lines.push(`  ${i + 1}. ${p}`))
  lines.push('')
  lines.push('Platform Playbook:')
  Object.entries(strategy.platformRecommendations || {}).forEach(([platform, rec]) => {
    lines.push(`  ${platform}: ${rec}`)
  })
  lines.push('')
  lines.push('CTA Strategies:')
  strategy.ctaStrategies?.forEach((cta, i) => lines.push(`  ${i + 1}. ${cta}`))
  lines.push('')

  // All Concepts
  lines.push('─'.repeat(60))
  lines.push('💡 AD CONCEPTS')
  lines.push('─'.repeat(60))
  concepts.forEach((concept, i) => {
    lines.push('')
    lines.push(`Concept ${i + 1}: ${concept.name}`)
    lines.push(`Platform: ${concept.platform} | Format: ${concept.format} | Angle: ${concept.angle}`)
    lines.push(`Description: ${concept.description}`)
    lines.push(`Hook: "${concept.hook}"`)
    lines.push(`CTA: ${concept.cta}`)
    lines.push('')
    lines.push('Script:')
    lines.push(concept.script)
    lines.push('')
    if (concept.headlines?.length) {
      lines.push('Headlines:')
      concept.headlines.forEach((h, j) => lines.push(`  ${j + 1}. ${h}`))
    }
    if (concept.captions?.length) {
      lines.push('')
      lines.push('Captions:')
      concept.captions.forEach((c, j) => {
        lines.push(`  Caption ${j + 1}:`)
        lines.push(`  ${c}`)
      })
    }
    lines.push('─'.repeat(40))
  })

  // Content Calendar
  lines.push('')
  lines.push('─'.repeat(60))
  lines.push('📅 30-DAY CONTENT CALENDAR')
  lines.push('─'.repeat(60))
  strategy.contentCalendar?.forEach((week: any) => {
    lines.push('')
    lines.push(`${week.week}:`)
    week.posts?.forEach((post: any) => {
      lines.push(`  ${post.day} | ${post.platform} | ${post.type} | ${post.topic}`)
      lines.push(`    Format: ${post.format}`)
    })
  })

  lines.push('')
  lines.push('═'.repeat(60))
  lines.push('Generated by NEXUS AI — nexus-grow.com')
  lines.push('═'.repeat(60))

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `nexus-${campaign.name.toLowerCase().replace(/\s+/g, '-')}-campaign.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function CampaignResultsPage() {
  const router = useRouter()
  const { isAuthenticated, loading, authHeader } = useAuth()
  const [result, setResult] = useState<CampaignResult | null>(null)
  const [activeTab, setActiveTab] = useState(0)
  const [calendarWeek, setCalendarWeek] = useState(0)
  const [savedId, setSavedId] = useState<string | null>(null)

  // Share link
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)

  const handleShare = async () => {
    if (!savedId) return
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
      return
    }
    setSharing(true)
    try {
      const res = await fetch(`/api/campaigns/${savedId}/share`, {
        method: 'POST',
        headers: { Authorization: authHeader() },
      })
      const data = await res.json()
      if (data.shareToken) {
        const url = `${window.location.origin}/share/${data.shareToken}`
        setShareUrl(url)
        navigator.clipboard.writeText(url)
        setShareCopied(true)
        setTimeout(() => setShareCopied(false), 2000)
      }
    } catch { /* silent */ }
    finally { setSharing(false) }
  }

  // Publish modal
  const [publishOpen, setPublishOpen] = useState(false)
  const [socialAccounts, setSocialAccounts] = useState<any[]>([])
  const [selectedIntegration, setSelectedIntegration] = useState<any>(null)
  const [selectedPage, setSelectedPage] = useState<any>(null)
  const [publishPlatform, setPublishPlatform] = useState<'FACEBOOK' | 'INSTAGRAM'>('FACEBOOK')
  const [publishCaption, setPublishCaption] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<{ ok: boolean; url?: string; error?: string } | null>(null)

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/auth/login')
      return
    }
    const stored = sessionStorage.getItem('nexus_campaign_result')
    if (stored) {
      const parsed = JSON.parse(stored) as CampaignResult
      setResult(parsed)
      // Persist to DB (non-blocking) — give user a "view in history" link
      const token = authHeader()
      if (token && !sessionStorage.getItem('nexus_campaign_saved_id')) {
        fetch('/api/campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: token },
          body: JSON.stringify({
            name: parsed.campaign.name,
            goal: parsed.campaign.goal,
            audience: parsed.campaign.audience,
            tone: parsed.campaign.tone,
            platforms: parsed.campaign.platforms,
            aiOutput: { strategy: parsed.strategy, concepts: parsed.concepts, generatedAt: parsed.generatedAt },
          }),
        })
          .then(r => r.json())
          .then(d => {
            if (d.id) {
              setSavedId(d.id)
              sessionStorage.setItem('nexus_campaign_saved_id', d.id)
            }
          })
          .catch(() => {})
      } else {
        const cachedId = sessionStorage.getItem('nexus_campaign_saved_id')
        if (cachedId) setSavedId(cachedId)
      }
    } else {
      router.push('/campaign/new')
    }
  }, [loading, isAuthenticated, router, authHeader])

  const openPublishModal = async () => {
    const token = authHeader()
    if (!token) return
    setPublishOpen(true)
    setPublishResult(null)
    // Pre-fill caption from first concept caption
    if (result?.concepts?.[0]?.captions?.[0]) {
      setPublishCaption(result.concepts[0].captions[0])
    }
    try {
      const res = await fetch('/api/social/accounts', { headers: { Authorization: token } })
      const data = await res.json()
      const accounts = data.accounts || []
      setSocialAccounts(accounts)
      if (accounts.length > 0) {
        setSelectedIntegration(accounts[0])
        if (accounts[0].pages?.length > 0) setSelectedPage(accounts[0].pages[0])
      }
    } catch { setSocialAccounts([]) }
  }

  const handlePublish = async () => {
    if (!selectedIntegration || !selectedPage || !publishCaption.trim()) return
    const token = authHeader()
    if (!token) return
    setPublishing(true)
    setPublishResult(null)
    try {
      const res = await fetch('/api/social/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({
          integrationId: selectedIntegration.id,
          pageId: selectedPage.id,
          pageName: selectedPage.name,
          caption: publishCaption,
          platform: publishPlatform,
          campaignId: savedId || undefined,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setPublishResult({ ok: true, url: data.platformUrl })
      } else {
        setPublishResult({ ok: false, error: data.error || 'Publish failed' })
      }
    } catch (err: any) {
      setPublishResult({ ok: false, error: err.message })
    } finally {
      setPublishing(false)
    }
  }

  if (loading || !result) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-spin">🤖</div>
          <p className="text-gray-400">Loading your campaign...</p>
        </div>
      </div>
    )
  }

  const { campaign, strategy, concepts } = result
  const platforms = campaign.platforms || []

  const tabs = ['Strategy', 'Hooks & Scripts', 'Captions', 'Content Calendar', 'All Concepts']

  return (
    <AppShell>

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-accent/20 via-accent/10 to-transparent border-b border-accent/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 text-sm font-semibold mb-2">
                <span className="flex items-center gap-1 text-accent"><span>✓</span> AI Generation Complete</span>
                {savedId && (
                  <Link href={`/campaigns/${savedId}`} className="flex items-center gap-1 text-green-400 hover:text-green-300 transition">
                    <span>💾</span> <span>حُفظ في السجل</span>
                  </Link>
                )}
              </div>
              <h1 className="text-3xl font-bold mb-1">{campaign.name}</h1>
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <span className="capitalize">{campaign.goal?.toLowerCase()} campaign</span>
                <span>•</span>
                <span>{platforms.length} platform{platforms.length !== 1 ? 's' : ''}</span>
                <span>•</span>
                <span>{concepts.length} concepts generated</span>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => result && generateCampaignPDF(result)}
                className="px-4 py-2 border border-accent/50 text-accent text-sm font-semibold rounded-lg hover:bg-accent hover:text-dark transition"
              >
                ⬇ Export PDF
              </button>
              <button
                onClick={handleShare}
                disabled={!savedId || sharing}
                className="px-4 py-2 border border-dark-tertiary text-gray-300 text-sm font-semibold rounded-lg hover:border-accent/50 hover:text-accent transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {sharing ? '⏳ Sharing…' : shareCopied ? '✓ Link copied!' : shareUrl ? '🔗 Copy link' : '🔗 Share'}
              </button>
              <button
                onClick={openPublishModal}
                className="px-4 py-2 text-sm font-bold rounded-lg transition"
                style={{ background: 'rgba(24,119,242,0.9)', color: '#fff' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(24,119,242,1)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(24,119,242,0.9)')}
              >
                📤 Publish
              </button>
              {platforms.map(p => (
                <span key={p} className="px-3 py-1 bg-dark-secondary border border-dark-tertiary rounded-full text-sm">
                  {PLATFORM_ICONS[p] || '📱'} {p.replace('_', ' ')}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="border-b border-dark-tertiary bg-dark/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Ad Concepts', value: String(concepts.length), icon: '💡' },
              { label: 'Hooks Generated', value: String(concepts.length * 3), icon: '🎣' },
              { label: 'Platform Captions', value: String(concepts.reduce((a, c) => a + (c.captions?.length || 0), 0)), icon: '✍️' },
              { label: 'Content Calendar', value: '30 days', icon: '📅' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-3">
                <span className="text-2xl">{s.icon}</span>
                <div>
                  <div className="text-lg font-bold">{s.value}</div>
                  <div className="text-xs text-gray-400">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Nav */}
      <div className="sticky top-[65px] z-30 bg-dark/90 backdrop-blur border-b border-dark-tertiary">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto py-2">
            {tabs.map((tab, i) => (
              <button
                key={tab}
                onClick={() => setActiveTab(i)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition ${activeTab === i ? 'bg-accent text-dark' : 'text-gray-400 hover:text-white hover:bg-dark-secondary'}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* TAB 0: STRATEGY */}
        {activeTab === 0 && (
          <div className="space-y-6">
            {/* Overview */}
            <div className="bg-dark-secondary border border-dark-tertiary rounded-xl p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">🧠 Campaign Strategy</h2>
              <div className="bg-accent/5 border border-accent/20 rounded-lg p-4 mb-6">
                <p className="text-gray-200 leading-relaxed">{strategy.overview}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-accent mb-3">🎯 Positioning</h3>
                  <p className="text-gray-300 text-sm leading-relaxed">{strategy.positioning}</p>
                </div>
                <div>
                  <h3 className="font-semibold text-accent mb-3">👥 Target Audience</h3>
                  <p className="text-gray-300 text-sm leading-relaxed">{normalizeAudience(strategy.audience)}</p>
                </div>
              </div>
            </div>

            {/* Value Props */}
            <div className="bg-dark-secondary border border-dark-tertiary rounded-xl p-6">
              <h3 className="font-bold text-lg mb-4">💎 Key Value Propositions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {strategy.valueProps?.map((vp, i) => (
                  <div key={i} className="flex items-start gap-3 bg-dark rounded-lg p-4">
                    <span className="text-accent font-bold text-lg">✓</span>
                    <span className="text-gray-200 text-sm">{vp}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Content Pillars */}
            <div className="bg-dark-secondary border border-dark-tertiary rounded-xl p-6">
              <h3 className="font-bold text-lg mb-4">🏛️ Content Pillars</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {strategy.contentPillars?.map((pillar, i) => {
                  const colors = ['bg-blue-500/10 border-blue-500/30', 'bg-green-500/10 border-green-500/30', 'bg-yellow-500/10 border-yellow-500/30', 'bg-purple-500/10 border-purple-500/30']
                  return (
                    <div key={i} className={`border rounded-lg p-4 ${colors[i % colors.length]}`}>
                      <span className="text-sm text-gray-200">{pillar}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Platform Strategy */}
            <div className="bg-dark-secondary border border-dark-tertiary rounded-xl p-6">
              <h3 className="font-bold text-lg mb-4">📱 Platform Playbook</h3>
              <div className="space-y-4">
                {Object.entries(strategy.platformRecommendations || {}).map(([platform, rec]) => (
                  <div key={platform} className="flex items-start gap-4 bg-dark rounded-lg p-4">
                    <span className="text-2xl">{PLATFORM_ICONS[platform] || '📱'}</span>
                    <div>
                      <div className="font-semibold text-sm mb-1">{platform.replace('_', ' ')}</div>
                      <div className="text-gray-400 text-sm">{rec as string}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Metrics */}
            <div className="bg-dark-secondary border border-dark-tertiary rounded-xl p-6">
              <h3 className="font-bold text-lg mb-4">📊 Target Metrics</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Object.entries(strategy.metrics || {}).map(([key, val]) => (
                  <div key={key} className="bg-dark rounded-lg p-4 text-center">
                    <div className="text-accent font-bold text-lg">{val as string}</div>
                    <div className="text-xs text-gray-400 mt-1">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA Strategies */}
            <div className="bg-dark-secondary border border-dark-tertiary rounded-xl p-6">
              <h3 className="font-bold text-lg mb-4">🎬 CTA Strategies</h3>
              <div className="space-y-3">
                {strategy.ctaStrategies?.map((cta, i) => (
                  <div key={i} className="flex items-center justify-between bg-dark rounded-lg p-4">
                    <span className="text-gray-200 text-sm">{cta}</span>
                    <CopyButton text={cta} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: HOOKS & SCRIPTS */}
        {activeTab === 1 && (
          <div className="space-y-6">
            <div className="bg-dark-secondary border border-dark-tertiary rounded-xl p-6">
              <h2 className="text-xl font-bold mb-2">🎣 Hook Library</h2>
              <p className="text-gray-400 text-sm mb-6">Proven opening lines that stop the scroll. Use the best one for each concept.</p>
              <div className="space-y-3">
                {concepts.flatMap(c => c.headlines || []).filter((h, i, arr) => arr.indexOf(h) === i).map((hook, i) => (
                  <div key={i} className="flex items-center justify-between bg-dark rounded-lg p-4 border border-dark-tertiary hover:border-accent/40 transition group">
                    <div className="flex items-center gap-3">
                      <span className="text-accent font-bold text-sm w-6">{i + 1}</span>
                      <span className="text-gray-200 text-sm">{hook}</span>
                    </div>
                    <CopyButton text={hook} />
                  </div>
                ))}
              </div>
            </div>

            {concepts.map((concept, i) => (
              <div key={i} className="bg-dark-secondary border border-dark-tertiary rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg">{concept.name}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs bg-accent/20 text-accent px-2 py-1 rounded">{concept.angle}</span>
                      <span className="text-xs text-gray-400">{concept.format}</span>
                      <span className="text-xs text-gray-400">{PLATFORM_ICONS[concept.platform]} {concept.platform}</span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">{concept.estimatedReach} reach</span>
                </div>

                <div className="bg-dark rounded-lg p-4 mb-4 border border-dark-tertiary">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-accent uppercase tracking-wide">Full Script</span>
                    <CopyButton text={concept.script} />
                  </div>
                  <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">{concept.script}</pre>
                </div>

                <div className="flex items-center justify-between bg-dark/50 rounded-lg p-3 border border-dark-tertiary">
                  <div>
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">CTA</span>
                    <p className="text-sm text-gray-200 mt-1">{concept.cta}</p>
                  </div>
                  <CopyButton text={concept.cta} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 2: CAPTIONS */}
        {activeTab === 2 && (
          <div className="space-y-6">
            <div className="bg-dark-secondary border border-dark-tertiary rounded-xl p-6">
              <h2 className="text-xl font-bold mb-2">✍️ Ready-to-Post Captions</h2>
              <p className="text-gray-400 text-sm mb-6">Copy, paste, and post. Each caption is optimized for its platform.</p>

              <div className="space-y-6">
                {concepts.map((concept, ci) =>
                  (concept.captions || []).map((caption, cai) => (
                    <div key={`${ci}-${cai}`} className="bg-dark rounded-xl border border-dark-tertiary p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{PLATFORM_ICONS[concept.platform] || '📱'}</span>
                          <span className="font-semibold text-sm">{concept.platform.replace('_', ' ')}</span>
                          <span className="text-xs text-gray-500">— {concept.name}</span>
                        </div>
                        <CopyButton text={caption} />
                      </div>
                      <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{caption}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CONTENT CALENDAR */}
        {activeTab === 3 && (
          <div className="space-y-6">
            <div className="bg-dark-secondary border border-dark-tertiary rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold">📅 30-Day Content Calendar</h2>
                  <p className="text-gray-400 text-sm mt-1">Your complete posting schedule — ready to execute.</p>
                </div>
                <div className="flex gap-2">
                  {(strategy.contentCalendar || []).map((w: any, i: number) => (
                    <button
                      key={i}
                      onClick={() => setCalendarWeek(i)}
                      className={`px-3 py-1 rounded-lg text-sm font-semibold transition ${calendarWeek === i ? 'bg-accent text-dark' : 'bg-dark-tertiary text-gray-400 hover:text-white'}`}
                    >
                      {w.week}
                    </button>
                  ))}
                </div>
              </div>

              {strategy.contentCalendar?.[calendarWeek] && (
                <div className="space-y-3">
                  {strategy.contentCalendar[calendarWeek].posts.map((post: any, i: number) => (
                    <div key={i} className="flex items-start gap-4 bg-dark rounded-xl p-4 border border-dark-tertiary hover:border-accent/30 transition">
                      <div className="w-24 shrink-0">
                        <div className="text-xs font-bold text-accent">{post.day}</div>
                        <div className="text-xs text-gray-500 mt-1">{PLATFORM_ICONS[post.platform]} {post.platform?.replace('_', ' ')}</div>
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-sm">{post.topic}</div>
                        <div className="text-xs text-gray-400 mt-1">Format: {post.format}</div>
                        {post.caption && (
                          <div className="text-xs text-gray-500 mt-2 italic leading-relaxed line-clamp-2">{post.caption}</div>
                        )}
                      </div>
                      <div className="shrink-0">
                        <span className="text-xs bg-dark-tertiary px-2 py-1 rounded">{post.type}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Strategy Summary */}
              <div className="mt-6 bg-accent/5 border border-accent/20 rounded-lg p-4">
                <h3 className="font-semibold text-accent mb-3">📌 Posting Strategy</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {strategy.angles?.map((angle, i) => (
                    <div key={i} className="text-sm text-gray-300 flex items-start gap-2">
                      <span className="text-accent">→</span> {angle}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: ALL CONCEPTS */}
        {activeTab === 4 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {concepts.map((concept, i) => (
                <div key={i} className="bg-dark-secondary border border-dark-tertiary rounded-xl p-6 hover:border-accent/40 transition">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-lg">{concept.name}</h3>
                      <span className="text-xs bg-accent/20 text-accent px-2 py-1 rounded mt-1 inline-block">{concept.angle}</span>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <div>{PLATFORM_ICONS[concept.platform]} {concept.platform}</div>
                      <div className="mt-1">{concept.format}</div>
                      <div className="mt-1 text-accent">{concept.estimatedReach}</div>
                    </div>
                  </div>

                  <p className="text-gray-400 text-sm mb-4">{concept.description}</p>

                  <div className="bg-dark rounded-lg p-3 mb-3 border border-dark-tertiary">
                    <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Opening Hook</div>
                    <p className="text-sm text-gray-200 italic">"{concept.hook}"</p>
                    <div className="mt-2 flex justify-end"><CopyButton text={concept.hook} /></div>
                  </div>

                  <div className="flex items-center justify-between bg-accent/5 border border-accent/20 rounded-lg p-3">
                    <div>
                      <div className="text-xs font-semibold text-accent uppercase tracking-wide mb-1">CTA</div>
                      <p className="text-sm text-gray-200">{concept.cta}</p>
                    </div>
                    <CopyButton text={concept.cta} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4 p-6 bg-dark-secondary border border-dark-tertiary rounded-xl">
          <div className="flex-1">
            <h3 className="font-bold mb-1">What's next?</h3>
            <p className="text-sm text-gray-400">Start posting your content, upload media assets, or create another campaign.</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => result && generateCampaignPDF(result)}
              className="px-5 py-3 border border-accent/50 text-accent font-semibold rounded-lg hover:bg-accent hover:text-dark transition text-sm"
            >
              ⬇ Download PDF Report
            </button>
            <Link
              href="/campaign/new"
              className="px-5 py-3 bg-accent text-dark font-semibold rounded-lg hover:bg-accent-light transition text-sm"
            >
              + New Campaign
            </Link>
            <Link
              href="/media"
              className="px-5 py-3 bg-dark-tertiary font-semibold rounded-lg hover:bg-dark-tertiary/70 transition text-sm"
            >
              Upload Media
            </Link>
            <Link
              href="/dashboard"
              className="px-5 py-3 bg-dark-tertiary font-semibold rounded-lg hover:bg-dark-tertiary/70 transition text-sm"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* ── Publish Modal ─────────────────────────────────────────────── */}
      {publishOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => { setPublishOpen(false); setPublishResult(null) }}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-[18px] overflow-hidden"
              style={{
                background: '#131312',
                border: '1px solid #1c1c28',
                boxShadow: '0 8px 48px rgba(0,0,0,0.6), 0 32px 64px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
              }}>

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div>
                  <div className="font-bold text-lg">Publish to Social</div>
                  <div className="text-xs text-t3 mt-0.5">Post directly from Nexus to your connected pages</div>
                </div>
                <button
                  onClick={() => { setPublishOpen(false); setPublishResult(null) }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-t3 hover:text-white hover:bg-white/5 transition text-lg"
                >×</button>
              </div>

              <div className="p-6 space-y-5">

                {/* No accounts connected */}
                {socialAccounts.length === 0 && (
                  <div className="text-center py-6">
                    <div className="text-4xl mb-3">🔗</div>
                    <p className="text-t2 text-sm mb-4">No social accounts connected yet.</p>
                    <a href="/settings#connected" className="px-5 py-2.5 bg-accent text-dark font-bold rounded-lg text-sm hover:bg-accent-light transition inline-block">
                      Connect Meta Account →
                    </a>
                  </div>
                )}

                {/* Accounts exist */}
                {socialAccounts.length > 0 && !publishResult && (
                  <>
                    {/* Platform selector */}
                    <div>
                      <label className="block text-xs font-semibold text-t3 uppercase tracking-wider mb-2">Post to</label>
                      <div className="flex gap-2">
                        {[
                          { value: 'FACEBOOK' as const, label: '📘 Facebook', icon: '📘' },
                          { value: 'INSTAGRAM' as const, label: '📸 Instagram', icon: '📸' },
                        ].map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => setPublishPlatform(opt.value)}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition border ${
                              publishPlatform === opt.value
                                ? 'bg-accent/10 border-accent/40 text-accent'
                                : 'bg-s1 border-s4 text-t3 hover:border-s5 hover:text-t2'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Page selector */}
                    {selectedIntegration && (
                      <div>
                        <label className="block text-xs font-semibold text-t3 uppercase tracking-wider mb-2">Page</label>
                        <select
                          value={selectedPage?.id || ''}
                          onChange={e => {
                            const p = selectedIntegration.pages.find((pg: any) => pg.id === e.target.value)
                            setSelectedPage(p || null)
                          }}
                          className="w-full px-4 py-3 bg-s0 border border-s4 rounded-xl text-t1 focus:outline-none focus:border-accent/60 transition text-sm"
                        >
                          {selectedIntegration.pages.map((p: any) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Caption editor */}
                    <div>
                      <label className="block text-xs font-semibold text-t3 uppercase tracking-wider mb-2">Caption</label>
                      <textarea
                        value={publishCaption}
                        onChange={e => setPublishCaption(e.target.value)}
                        rows={5}
                        placeholder="اكتب التعليق هنا..."
                        className="w-full px-4 py-3 bg-s0 border border-s4 rounded-xl text-t1 placeholder-t4 focus:outline-none focus:border-accent/60 transition text-sm resize-none"
                      />
                      <div className="text-xs text-t4 text-right mt-1">{publishCaption.length} characters</div>
                    </div>

                    {publishPlatform === 'INSTAGRAM' && !selectedPage?.igAccountId && (
                      <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded-lg p-3 text-sm">
                        ⚠️ This page has no linked Instagram Business Account. Switch to Facebook or link Instagram in Meta Business Suite.
                      </div>
                    )}

                    {/* Publish button */}
                    <button
                      onClick={handlePublish}
                      disabled={publishing || !selectedPage || !publishCaption.trim() || (publishPlatform === 'INSTAGRAM' && !selectedPage?.igAccountId)}
                      className="w-full py-3 font-bold rounded-xl transition disabled:opacity-50 text-sm"
                      style={{ background: 'rgba(24,119,242,0.9)', color: '#fff' }}
                    >
                      {publishing ? '⏳ Publishing…' : `📤 Publish to ${publishPlatform === 'FACEBOOK' ? 'Facebook' : 'Instagram'}`}
                    </button>
                  </>
                )}

                {/* Result */}
                {publishResult && (
                  <div className="text-center py-4">
                    {publishResult.ok ? (
                      <>
                        <div className="text-4xl mb-3">🎉</div>
                        <div className="text-white font-bold text-lg mb-2">Published successfully!</div>
                        {publishResult.url && (
                          <a href={publishResult.url} target="_blank" rel="noopener noreferrer"
                            className="text-sm text-accent hover:underline">
                            View post →
                          </a>
                        )}
                        <button
                          onClick={() => { setPublishOpen(false); setPublishResult(null) }}
                          className="mt-4 block mx-auto px-6 py-2 bg-s3 hover:bg-s4 rounded-lg text-sm font-semibold text-t1 transition"
                        >
                          Done
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="text-4xl mb-3">❌</div>
                        <div className="text-red-400 font-semibold mb-2">Publish failed</div>
                        <div className="text-sm text-t3 mb-4">{publishResult.error}</div>
                        <button
                          onClick={() => setPublishResult(null)}
                          className="px-6 py-2 bg-s3 hover:bg-s4 rounded-lg text-sm font-semibold text-t1 transition"
                        >
                          Try Again
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

    </AppShell>
  )
}