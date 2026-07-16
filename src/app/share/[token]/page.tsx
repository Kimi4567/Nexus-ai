'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

const PLATFORM_ICONS: Record<string, string> = {
  INSTAGRAM: '📸', TIKTOK: '🎵', FACEBOOK: '👥',
  YOUTUBE_SHORTS: '▶️', LINKEDIN: '💼', SNAPCHAT: '👻',
}

const GOAL_LABELS: Record<string, string> = {
  SALES: 'Sales', AWARENESS: 'Brand Awareness', LEADS: 'Lead Generation',
  TRAFFIC: 'Traffic', ENGAGEMENT: 'Engagement', BRAND_BUILDING: 'Brand Building',
}

function normalizeAudience(audience: any): string {
  if (!audience) return 'General audience'
  if (typeof audience === 'string') return audience
  if (typeof audience === 'object') {
    const parts: string[] = []
    if (audience.demographics) parts.push(typeof audience.demographics === 'string' ? audience.demographics : JSON.stringify(audience.demographics))
    if (audience.psychographics) parts.push(typeof audience.psychographics === 'string' ? audience.psychographics : JSON.stringify(audience.psychographics))
    return parts.join('. ') || JSON.stringify(audience)
  }
  return String(audience)
}

export default function SharePage() {
  const params = useParams()
  const token = params?.token as string

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState(0)

  useEffect(() => {
    if (!token) return
    fetch(`/api/share/${token}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setNotFound(true); setLoading(false) })
  }, [token])

  if (loading) return (
    <div className="min-h-screen bg-dark flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (notFound) return (
    <div className="min-h-screen bg-dark flex items-center justify-center px-4 text-center">
      <div>
        <div className="text-6xl mb-4">🔒</div>
        <h1 className="text-2xl font-bold mb-2">Link not found</h1>
        <p className="text-gray-400 mb-6">This campaign link has been revoked or doesn't exist.</p>
        <Link href="/" className="px-5 py-2.5 bg-accent text-dark font-bold rounded-xl text-sm hover:bg-accent-light transition">
          Try Nexus AI free →
        </Link>
      </div>
    </div>
  )

  const { name, goal, platforms, tone, aiOutput, workspaceName } = data
  const strategy = aiOutput?.strategy || {}
  const concepts = aiOutput?.concepts || []
  const tabs = ['Strategy', 'Ad Concepts', 'Content Calendar']

  return (
    <div className="min-h-screen bg-dark text-white">

      {/* Top bar */}
      <div className="border-b border-dark-tertiary bg-dark/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 28 28" fill="none">
                <path d="M7 7L14 21L21 7" stroke="#080807" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 7H21" stroke="#080807" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
            <span className="font-bold text-sm hidden sm:block">Nexus AI</span>
            <span className="text-dark-tertiary hidden sm:block">·</span>
            <span className="text-xs text-gray-400 hidden sm:block">Campaign by <strong className="text-gray-300">{workspaceName}</strong></span>
          </div>
          <Link
            href="/auth/register"
            className="px-4 py-2 bg-accent text-dark text-xs font-bold rounded-lg hover:bg-accent-light transition whitespace-nowrap"
          >
            Generate yours free →
          </Link>
        </div>
      </div>

      {/* Hero */}
      <div className="bg-gradient-to-r from-accent/15 via-accent/5 to-transparent border-b border-accent/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-accent mb-3">
            <span>✦ AI-Generated Campaign</span>
            <span className="text-dark-tertiary">·</span>
            <span className="text-gray-400">by {workspaceName}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-3">{name}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
            <span className="px-2.5 py-1 bg-dark-secondary border border-dark-tertiary rounded-full">
              🎯 {GOAL_LABELS[goal] || goal}
            </span>
            {(platforms || []).map((p: string) => (
              <span key={p} className="px-2.5 py-1 bg-dark-secondary border border-dark-tertiary rounded-full">
                {PLATFORM_ICONS[p] || '📱'} {p.replace('_', ' ')}
              </span>
            ))}
            {tone && (
              <span className="px-2.5 py-1 bg-dark-secondary border border-dark-tertiary rounded-full">
                🎨 {tone}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tab nav */}
      <div className="border-b border-dark-tertiary bg-dark/80 backdrop-blur sticky top-[49px] z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
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

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ── STRATEGY TAB ── */}
        {activeTab === 0 && (
          <>
            {strategy.overview && (
              <div className="bg-dark-secondary border border-dark-tertiary rounded-xl p-6">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">🧠 Campaign Strategy</h2>
                <div className="bg-accent/5 border border-accent/20 rounded-lg p-4 mb-5">
                  <p className="text-gray-200 leading-relaxed">{strategy.overview}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {strategy.positioning && (
                    <div>
                      <div className="text-xs font-bold text-accent uppercase tracking-wider mb-2">Positioning</div>
                      <p className="text-gray-300 text-sm leading-relaxed">{strategy.positioning}</p>
                    </div>
                  )}
                  {strategy.audience && (
                    <div>
                      <div className="text-xs font-bold text-accent uppercase tracking-wider mb-2">Target Audience</div>
                      <p className="text-gray-300 text-sm leading-relaxed">{normalizeAudience(strategy.audience)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {strategy.valueProps?.length > 0 && (
              <div className="bg-dark-secondary border border-dark-tertiary rounded-xl p-6">
                <h2 className="text-lg font-bold mb-4">💎 Value Propositions</h2>
                <div className="space-y-2">
                  {strategy.valueProps.map((vp: string, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-dark rounded-lg">
                      <span className="text-accent font-bold mt-0.5">→</span>
                      <span className="text-gray-300 text-sm leading-relaxed">{vp}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {strategy.contentPillars?.length > 0 && (
              <div className="bg-dark-secondary border border-dark-tertiary rounded-xl p-6">
                <h2 className="text-lg font-bold mb-4">🏛️ Content Pillars</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {strategy.contentPillars.map((p: string, i: number) => (
                    <div key={i} className="p-3 bg-accent/5 border border-accent/20 rounded-lg text-sm text-gray-200 font-medium">
                      {p}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {strategy.ctaStrategies?.length > 0 && (
              <div className="bg-dark-secondary border border-dark-tertiary rounded-xl p-6">
                <h2 className="text-lg font-bold mb-4">📣 CTA Strategies</h2>
                <div className="space-y-2">
                  {strategy.ctaStrategies.map((cta: string, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-dark rounded-lg">
                      <span className="text-accent font-bold">▸</span>
                      <span className="text-gray-300 text-sm">{cta}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── AD CONCEPTS TAB ── */}
        {activeTab === 1 && (
          <div className="space-y-6">
            {concepts.map((c: any, i: number) => (
              <div key={i} className="bg-dark-secondary border border-dark-tertiary rounded-xl overflow-hidden">
                <div className="flex items-start justify-between p-5 border-b border-dark-tertiary bg-gradient-to-r from-dark to-dark-secondary">
                  <div>
                    <div className="font-bold text-lg mb-1">{c.name}</div>
                    <div className="text-xs text-gray-400 flex items-center gap-2">
                      <span>{PLATFORM_ICONS[c.platform] || '📱'} {c.platform?.replace('_', ' ')}</span>
                      <span>·</span>
                      <span>{c.format}</span>
                      <span>·</span>
                      <span className="italic">{c.angle}</span>
                    </div>
                  </div>
                  <span className="text-3xl font-black text-accent/25">#{i + 1}</span>
                </div>
                <div className="p-5 space-y-4">
                  {c.description && <p className="text-gray-300 text-sm leading-relaxed">{c.description}</p>}
                  {c.hook && (
                    <div className="bg-accent/5 border border-accent/20 rounded-lg p-4">
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Opening Hook</div>
                      <p className="text-accent font-semibold text-sm italic">"{c.hook}"</p>
                    </div>
                  )}
                  {c.script && (
                    <div>
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Script</div>
                      <pre className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap bg-dark rounded-lg p-4 font-sans">{c.script}</pre>
                    </div>
                  )}
                  {c.cta && (
                    <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">CTA</span>
                      <span className="text-amber-300 font-semibold text-sm">{c.cta}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── CONTENT CALENDAR TAB ── */}
        {activeTab === 2 && (
          <div className="space-y-6">
            {(strategy.contentCalendar || []).map((week: any, wi: number) => (
              <div key={wi} className="bg-dark-secondary border border-dark-tertiary rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-dark-tertiary">
                  <span className="font-bold text-accent text-sm">{week.week}</span>
                </div>
                <div className="divide-y divide-dark-tertiary">
                  {(week.posts || []).map((post: any, pi: number) => (
                    <div key={pi} className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <span className="text-gray-500 w-20 flex-shrink-0 text-xs">{post.day}</span>
                        <span className="text-gray-400">{PLATFORM_ICONS[post.platform] || '📱'} {post.platform?.replace('_', ' ')}</span>
                        <span className="px-2 py-0.5 bg-accent/10 text-accent text-xs rounded-full font-semibold">{post.type}</span>
                        <span className="text-gray-200 flex-1">{post.topic}</span>
                        <span className="text-gray-500 text-xs">{post.format}</span>
                      </div>
                      {post.caption && (
                        <div className="ml-[92px] mt-1.5 text-xs text-gray-500 italic leading-relaxed">{post.caption}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* Viral CTA footer */}
      <div className="border-t border-dark-tertiary mt-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-5">
            <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
              <path d="M7 7L14 21L21 7" stroke="#080807" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M7 7H21" stroke="#080807" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-2">Build a reviewed campaign workflow from your Brand Brain</h2>
          <p className="text-gray-400 text-sm mb-6 max-w-sm mx-auto">
            Create Brand Brain-grounded strategy and content drafts, then review every claim before execution.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/auth/register"
              className="px-6 py-3 bg-accent text-dark font-bold rounded-xl hover:bg-accent-light transition text-sm"
            >
              Start with 15 trial credits →
            </Link>
            <Link
              href="/"
              className="px-6 py-3 border border-dark-tertiary text-gray-400 font-semibold rounded-xl hover:border-accent/40 hover:text-white transition text-sm"
            >
              Learn more
            </Link>
          </div>
          <p className="text-xs text-gray-600 mt-4">No credit card needed · 15 one-time trial credits</p>
        </div>
      </div>

    </div>
  )
}
