'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import NavBar from '@/components/NavBar'

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
  audience: string
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

function downloadCampaign(result: CampaignResult) {
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
  lines.push(strategy.audience)
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
  lines.push('Generated by NEXUS AI — nexus-ai.com')
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
  const { isAuthenticated, loading } = useAuth()
  const [result, setResult] = useState<CampaignResult | null>(null)
  const [activeTab, setActiveTab] = useState(0)
  const [calendarWeek, setCalendarWeek] = useState(0)

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/auth/login')
      return
    }
    const stored = sessionStorage.getItem('nexus_campaign_result')
    if (stored) {
      setResult(JSON.parse(stored))
    } else {
      router.push('/campaign/new')
    }
  }, [loading, isAuthenticated, router])

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
    <div className="min-h-screen bg-gradient-to-br from-dark via-dark-secondary to-dark-tertiary">
      <NavBar />

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-accent/20 via-accent/10 to-transparent border-b border-accent/20">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-accent text-sm font-semibold mb-2">
                <span>✓</span> <span>AI Generation Complete</span>
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
                onClick={() => result && downloadCampaign(result)}
                className="px-4 py-2 border border-accent/50 text-accent text-sm font-semibold rounded-lg hover:bg-accent hover:text-dark transition"
              >
                ⬇ Export
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
        <div className="max-w-6xl mx-auto px-6 py-4">
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
        <div className="max-w-6xl mx-auto px-6">
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
      <div className="max-w-6xl mx-auto px-6 py-8">

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
                  <p className="text-gray-300 text-sm leading-relaxed">{strategy.audience}</p>
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
              onClick={() => result && downloadCampaign(result)}
              className="px-5 py-3 border border-accent/50 text-accent font-semibold rounded-lg hover:bg-accent hover:text-dark transition text-sm"
            >
              ⬇ Download Campaign
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
    </div>
  )
}
