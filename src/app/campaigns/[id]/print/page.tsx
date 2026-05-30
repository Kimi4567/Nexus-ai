'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

interface Campaign {
  id: string
  name: string
  goal: string
  audience?: string
  tone: string
  platforms: string[]
  aiOutput?: any
  createdAt: string
}

const PLATFORM_LABELS: Record<string, string> = {
  INSTAGRAM: 'Instagram', TIKTOK: 'TikTok', FACEBOOK: 'Facebook',
  YOUTUBE_SHORTS: 'YouTube Shorts', LINKEDIN: 'LinkedIn', SNAPCHAT: 'Snapchat',
}

export default function CampaignPrintPage() {
  const params = useParams()
  const campaignId = params?.id as string
  const { isAuthenticated, loading, authHeader } = useAuth()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [fetching, setFetching] = useState(true)
  const printTriggered = useRef(false)

  useEffect(() => {
    if (!loading && !isAuthenticated) return
    if (!isAuthenticated) return
    const token = authHeader()
    if (!token) return

    fetch(`/api/campaigns/${campaignId}`, { headers: { Authorization: token } })
      .then(r => r.json())
      .then(d => { if (d.campaign) setCampaign(d.campaign) })
      .finally(() => setFetching(false))
  }, [loading, isAuthenticated, campaignId, authHeader])

  // Auto-print once loaded
  useEffect(() => {
    if (!fetching && campaign && !printTriggered.current) {
      printTriggered.current = true
      setTimeout(() => window.print(), 500)
    }
  }, [fetching, campaign])

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Preparing your campaign document...</p>
        </div>
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <p className="text-gray-500">Campaign not found.</p>
      </div>
    )
  }

  const aiOutput = campaign.aiOutput as any
  const strategy = aiOutput?.strategy || {}
  const topHooks: string[] = aiOutput?.topHooks || strategy.topHooks || []
  const ctaVariations: string[] = aiOutput?.ctaVariations || strategy.ctaVariations || []
  const captionFormulas: string[] = aiOutput?.captionFormulas || []
  const calendar: any[] = aiOutput?.contentCalendar || strategy.contentCalendar || []

  const date = new Date(campaign.createdAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  })

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: white; color: #111; }

        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
          @page { margin: 16mm 20mm; size: A4; }
        }

        .doc { max-width: 800px; margin: 0 auto; padding: 48px 40px; }

        /* Header */
        .doc-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 2px solid #f0f0f0; }
        .brand { font-size: 13px; font-weight: 800; letter-spacing: 0.15em; color: #FF9500; }
        .doc-title { font-size: 26px; font-weight: 800; color: #111; margin-top: 8px; line-height: 1.2; }
        .doc-meta { text-align: right; font-size: 12px; color: #888; line-height: 1.8; }

        /* Section headers */
        .section { margin-bottom: 32px; }
        .agent-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; padding: 10px 14px; border-radius: 8px; }
        .agent-header.strategist { background: #EEF2FF; border-left: 3px solid #6366F1; }
        .agent-header.nex        { background: #FDF2F8; border-left: 3px solid #EC4899; }
        .agent-header.pulse      { background: #FFFBEB; border-left: 3px solid #F59E0B; }
        .agent-icon { font-size: 16px; }
        .agent-name { font-size: 13px; font-weight: 700; }
        .agent-name.strategist { color: #6366F1; }
        .agent-name.nex        { color: #EC4899; }
        .agent-name.pulse      { color: #F59E0B; }
        .agent-title { font-size: 11px; color: #888; margin-left: 4px; }

        /* Key message highlight */
        .key-message { background: #EEF2FF; border: 1px solid #C7D2FE; border-radius: 10px; padding: 16px 20px; margin-bottom: 12px; }
        .key-message-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #6366F1; margin-bottom: 6px; }
        .key-message-text { font-size: 15px; font-weight: 700; color: #1E1B4B; font-style: italic; }

        /* Cards */
        .card { background: #F9F9F9; border: 1px solid #EDEDED; border-radius: 10px; padding: 18px 20px; margin-bottom: 12px; }
        .card-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #999; margin-bottom: 6px; }
        .card-title { font-size: 15px; font-weight: 700; color: #111; margin-bottom: 6px; }
        .card-body { font-size: 13px; color: #333; line-height: 1.7; }

        /* Hooks */
        .hook-item { background: white; border: 1px solid #E8E8E8; border-radius: 8px; padding: 12px 14px; margin-bottom: 8px; }
        .hook-num { font-size: 10px; font-weight: 700; color: #999; margin-bottom: 4px; }
        .hook-text { font-size: 13px; font-weight: 600; color: #FF9500; font-style: italic; }

        /* CTA variations */
        .cta-item { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: white; border: 1px solid #E8E8E8; border-radius: 7px; margin-bottom: 6px; font-size: 12px; color: #333; }
        .cta-arrow { color: #FF9500; font-weight: 700; flex-shrink: 0; }

        /* Caption formulas */
        .caption-item { background: white; border: 1px solid #E8E8E8; border-radius: 8px; padding: 12px 14px; margin-bottom: 8px; font-size: 12px; color: #444; line-height: 1.6; }

        /* Pillars */
        .pillars-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .pillar { background: white; border: 1px solid #EDEDED; border-radius: 8px; padding: 10px 12px; font-size: 12px; color: #333; text-align: center; font-weight: 500; }

        /* List items */
        .item-list { list-style: none; }
        .item-list li { display: flex; align-items: flex-start; gap: 8px; padding: 7px 0; border-bottom: 1px solid #F0F0F0; font-size: 13px; color: #333; }
        .item-list li:last-child { border-bottom: none; }
        .item-arrow { color: #FF9500; font-weight: 700; flex-shrink: 0; margin-top: 1px; }

        /* KPI grid */
        .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .kpi-card { background: white; border: 1px solid #EDEDED; border-radius: 8px; padding: 12px; text-align: center; }
        .kpi-value { font-size: 16px; font-weight: 800; color: #FF9500; }
        .kpi-label { font-size: 11px; color: #666; margin-top: 4px; }
        .kpi-time  { font-size: 10px; color: #AAA; margin-top: 2px; }

        /* Calendar */
        .week-header { font-size: 13px; font-weight: 700; color: #111; margin-bottom: 4px; padding-bottom: 6px; border-bottom: 1px solid #EDEDED; }
        .week-theme  { font-size: 11px; color: #888; font-style: italic; margin-bottom: 8px; }
        .cal-row { display: flex; align-items: center; gap: 14px; padding: 7px 0; border-bottom: 1px solid #F7F7F7; font-size: 12px; }
        .cal-day { color: #999; width: 60px; flex-shrink: 0; }
        .cal-platform { width: 80px; color: #888; flex-shrink: 0; }
        .cal-topic { color: #333; flex: 1; }
        .cal-hook { font-size: 11px; color: #FF9500; font-style: italic; display: block; margin-top: 2px; }
        .cal-type { font-size: 11px; color: #888; background: #F0F0F0; padding: 2px 8px; border-radius: 20px; white-space: nowrap; }

        /* Footer */
        .doc-footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #EDEDED; display: flex; justify-content: space-between; align-items: center; }
        .footer-brand { font-size: 12px; font-weight: 700; color: #FF9500; letter-spacing: 0.1em; }
        .footer-text { font-size: 11px; color: #BBB; }

        /* Print button (hidden in print) */
        .print-btn { position: fixed; bottom: 28px; right: 28px; background: #FF9500; color: black; font-weight: 700; font-size: 14px; padding: 12px 24px; border: none; border-radius: 12px; cursor: pointer; box-shadow: 0 4px 16px rgba(255,149,0,0.3); z-index: 100; transition: background 0.15s; }
        .print-btn:hover { background: #FFB340; }
      `}</style>

      {/* Print trigger button */}
      <button className="print-btn no-print" onClick={() => window.print()}>
        ⬇ Save as PDF
      </button>

      <div className="doc">
        {/* Header */}
        <div className="doc-header">
          <div>
            <div className="brand">NEXUS AI</div>
            <div className="doc-title">{campaign.name}</div>
            <div style={{ marginTop: 8, fontSize: 13, color: '#666' }}>
              <span style={{ textTransform: 'capitalize' }}>{campaign.goal?.toLowerCase()}</span>
              &nbsp;·&nbsp; {campaign.tone}
              {campaign.platforms?.length > 0 && <>&nbsp;·&nbsp; {campaign.platforms.map(p => PLATFORM_LABELS[p] || p).join(', ')}</>}
            </div>
          </div>
          <div className="doc-meta">
            <div style={{ fontWeight: 600, color: '#555' }}>Generated by Nexus AI</div>
            <div>{date}</div>
            {campaign.audience && (
              <div style={{ marginTop: 6, maxWidth: 220, textAlign: 'right', color: '#666' }}>
                Audience: {campaign.audience}
              </div>
            )}
          </div>
        </div>

        {/* Strategist — Strategy */}
        <div className="section">
          <div className="agent-header strategist">
            <span className="agent-icon">🧠</span>
            <span className="agent-name strategist">Strategist</span>
            <span className="agent-title">· Chief Marketing Strategist</span>
          </div>

          {/* Key Message */}
          {strategy.keyMessage && (
            <div className="key-message">
              <div className="key-message-label">Key Message</div>
              <div className="key-message-text">"{strategy.keyMessage}"</div>
            </div>
          )}

          {strategy.overview && (
            <div className="card">
              <div className="card-label">Campaign Overview</div>
              <div className="card-body">{strategy.overview}</div>
            </div>
          )}

          {strategy.positioning && (
            <div className="card">
              <div className="card-label">Positioning</div>
              <div className="card-body">{strategy.positioning}</div>
            </div>
          )}

          {strategy.valueProps?.length > 0 && (
            <div className="card">
              <div className="card-label">Value Propositions</div>
              <ul className="item-list" style={{ marginTop: 4 }}>
                {strategy.valueProps.map((vp: string, i: number) => (
                  <li key={i}><span className="item-arrow">→</span> {vp}</li>
                ))}
              </ul>
            </div>
          )}

          {strategy.contentPillars?.length > 0 && (
            <div className="card">
              <div className="card-label">Content Pillars</div>
              <div className="pillars-grid" style={{ marginTop: 10 }}>
                {strategy.contentPillars.map((p: string, i: number) => (
                  <div key={i} className="pillar">{p}</div>
                ))}
              </div>
            </div>
          )}

          {strategy.kpis?.length > 0 && (
            <div className="card">
              <div className="card-label">KPIs</div>
              <div className="kpi-grid" style={{ marginTop: 10 }}>
                {strategy.kpis.map((kpi: any, i: number) => (
                  <div key={i} className="kpi-card">
                    <div className="kpi-value">{kpi.target}</div>
                    <div className="kpi-label">{kpi.metric}</div>
                    <div className="kpi-time">{kpi.timeframe}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {strategy.visualDirection && (
            <div className="card">
              <div className="card-label">Visual Direction</div>
              <div className="card-body">{strategy.visualDirection}</div>
            </div>
          )}

          {strategy.executionChecklist?.length > 0 && (
            <div className="card">
              <div className="card-label">Launch Checklist</div>
              <ul className="item-list" style={{ marginTop: 4 }}>
                {strategy.executionChecklist.map((item: string, i: number) => (
                  <li key={i}><span className="item-arrow">□</span> {item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* NEX — Content & Hooks */}
        {(topHooks.length > 0 || ctaVariations.length > 0 || captionFormulas.length > 0) && (
          <div className="section page-break">
            <div className="agent-header nex">
              <span className="agent-icon">✍️</span>
              <span className="agent-name nex">NEX</span>
              <span className="agent-title">· Content Director</span>
            </div>

            {topHooks.length > 0 && (
              <div className="card">
                <div className="card-label">Top Hooks</div>
                <div style={{ marginTop: 8 }}>
                  {topHooks.map((hook: string, i: number) => (
                    <div key={i} className="hook-item">
                      <div className="hook-num">Hook {i + 1}</div>
                      <div className="hook-text">"{hook}"</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {ctaVariations.length > 0 && (
              <div className="card">
                <div className="card-label">CTA Variations</div>
                <div style={{ marginTop: 8 }}>
                  {ctaVariations.map((cta: string, i: number) => (
                    <div key={i} className="cta-item">
                      <span className="cta-arrow">→</span> {cta}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {captionFormulas.length > 0 && (
              <div className="card">
                <div className="card-label">Caption Formulas</div>
                <div style={{ marginTop: 8 }}>
                  {captionFormulas.map((cap: string, i: number) => (
                    <div key={i} className="caption-item">{cap}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PULSE — Content Calendar */}
        {calendar.length > 0 && (
          <div className="section page-break">
            <div className="agent-header pulse">
              <span className="agent-icon">⚡</span>
              <span className="agent-name pulse">PULSE</span>
              <span className="agent-title">· Campaign Operations</span>
            </div>

            {calendar.map((week: any, wi: number) => (
              <div key={wi} className="card" style={{ marginBottom: 16 }}>
                <div className="week-header">{week.week || `Week ${wi + 1}`}</div>
                {week.theme && <div className="week-theme">{week.theme}</div>}
                {(week.posts || []).map((post: any, pi: number) => (
                  <div key={pi} className="cal-row">
                    <span className="cal-day">{post.day}</span>
                    <span className="cal-platform">{PLATFORM_LABELS[post.platform] || post.platform}</span>
                    <span className="cal-topic">
                      {post.topic || post.contentPillar}
                      {post.hook && <span className="cal-hook">"{post.hook}"</span>}
                    </span>
                    <span className="cal-type">{post.type || post.format}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="doc-footer">
          <div className="footer-brand">NEXUS AI</div>
          <div className="footer-text">Generated by Strategist · NEX · PULSE — Nexus AI Marketing OS</div>
        </div>
      </div>
    </>
  )
}
