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

const PLATFORM_ICONS: Record<string, string> = {
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
        <p className="text-gray-500">لم يتم العثور على الحملة.</p>
      </div>
    )
  }

  const aiOutput = campaign.aiOutput as any
  const strategy = aiOutput?.strategy || {}
  const concepts = aiOutput?.concepts || []
  const calendar = strategy.contentCalendar || []

  const date = new Date(campaign.createdAt).toLocaleDateString('ar-SA', {
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
        .agent-header.sage  { background: #EEF2FF; border-left: 3px solid #6366F1; }
        .agent-header.muse  { background: #FDF2F8; border-left: 3px solid #EC4899; }
        .agent-header.pulse { background: #FFFBEB; border-left: 3px solid #F59E0B; }
        .agent-icon { font-size: 16px; }
        .agent-name { font-size: 13px; font-weight: 700; }
        .agent-name.sage  { color: #6366F1; }
        .agent-name.muse  { color: #EC4899; }
        .agent-name.pulse { color: #F59E0B; }
        .agent-title { font-size: 11px; color: #888; margin-left: 4px; }

        /* Cards */
        .card { background: #F9F9F9; border: 1px solid #EDEDED; border-radius: 10px; padding: 18px 20px; margin-bottom: 12px; }
        .card-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #999; margin-bottom: 6px; }
        .card-title { font-size: 15px; font-weight: 700; color: #111; margin-bottom: 6px; }
        .card-body { font-size: 13px; color: #444; line-height: 1.6; }

        /* Concept grid */
        .concepts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .concept-card { background: #F9F9F9; border: 1px solid #EDEDED; border-radius: 10px; padding: 16px; }
        .concept-name { font-size: 13px; font-weight: 700; margin-bottom: 4px; color: #111; }
        .concept-angle { font-size: 11px; color: #888; background: #EDEDED; padding: 2px 8px; border-radius: 20px; display: inline-block; margin-bottom: 8px; }
        .concept-desc { font-size: 12px; color: #555; margin-bottom: 10px; line-height: 1.5; }
        .hook-box { background: white; border: 1px solid #E8E8E8; border-radius: 7px; padding: 10px 12px; margin-bottom: 8px; }
        .hook-label { font-size: 10px; font-weight: 600; color: #999; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; }
        .hook-text { font-size: 12px; font-weight: 600; color: #FF9500; font-style: italic; }
        .cta-row { font-size: 11px; color: #666; }
        .cta-row strong { color: #111; }

        /* Pillars */
        .pillars-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .pillar { background: white; border: 1px solid #EDEDED; border-radius: 8px; padding: 10px 12px; font-size: 12px; color: #333; text-align: center; font-weight: 500; }

        /* List items */
        .item-list { list-style: none; }
        .item-list li { display: flex; align-items: flex-start; gap: 8px; padding: 7px 0; border-bottom: 1px solid #F0F0F0; font-size: 13px; color: #333; }
        .item-list li:last-child { border-bottom: none; }
        .item-arrow { color: #FF9500; font-weight: 700; flex-shrink: 0; margin-top: 1px; }

        /* Calendar */
        .week-header { font-size: 13px; font-weight: 700; color: #111; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #EDEDED; }
        .cal-row { display: flex; align-items: center; gap: 14px; padding: 7px 0; border-bottom: 1px solid #F7F7F7; font-size: 12px; }
        .cal-day { color: #999; width: 60px; flex-shrink: 0; }
        .cal-platform { width: 80px; color: #888; flex-shrink: 0; }
        .cal-topic { color: #333; flex: 1; }
        .cal-type { font-size: 11px; color: #888; background: #F0F0F0; padding: 2px 8px; border-radius: 20px; }

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
        ⬇ حفظ كـ PDF
      </button>

      <div className="doc">
        {/* Header */}
        <div className="doc-header">
          <div>
            <div className="brand">NEXUS</div>
            <div className="doc-title">{campaign.name}</div>
            <div style={{ marginTop: 8, fontSize: 13, color: '#888' }}>
              {campaign.goal?.toLowerCase()}
              &nbsp;·&nbsp; {campaign.tone}
              {campaign.platforms?.length > 0 && <>&nbsp;·&nbsp; {campaign.platforms.map(p => PLATFORM_ICONS[p] || p).join(', ')}</>}
            </div>
          </div>
          <div className="doc-meta">
            <div>أُنشئ بواسطة Nexus AI</div>
            <div>{date}</div>
            {campaign.audience && <div style={{ marginTop: 6, maxWidth: 200, textAlign: 'right' }}>{campaign.audience}</div>}
          </div>
        </div>

        {/* SAGE — Strategy */}
        <div className="section">
          <div className="agent-header sage">
            <span className="agent-icon">🧠</span>
            <span className="agent-name sage">SAGE</span>
            <span className="agent-title">· كبير المستشارين التسويقيين</span>
          </div>

          {strategy.overview && (
            <div className="card">
              <div className="card-label">نظرة استراتيجية عامة</div>
              <div className="card-body">{strategy.overview}</div>
            </div>
          )}

          {strategy.positioning && (
            <div className="card">
              <div className="card-label">التموضع</div>
              <div className="card-body">{strategy.positioning}</div>
            </div>
          )}

          {strategy.valueProps?.length > 0 && (
            <div className="card">
              <div className="card-label">مزايا المنتج</div>
              <ul className="item-list" style={{ marginTop: 4 }}>
                {strategy.valueProps.map((vp: string, i: number) => (
                  <li key={i}><span className="item-arrow">→</span> {vp}</li>
                ))}
              </ul>
            </div>
          )}

          {strategy.contentPillars?.length > 0 && (
            <div className="card">
              <div className="card-label">ركائز المحتوى</div>
              <div className="pillars-grid" style={{ marginTop: 10 }}>
                {strategy.contentPillars.map((p: string, i: number) => (
                  <div key={i} className="pillar">{p}</div>
                ))}
              </div>
            </div>
          )}

          {strategy.ctaStrategies?.length > 0 && (
            <div className="card">
              <div className="card-label">استراتيجيات الـ CTA</div>
              <ul className="item-list" style={{ marginTop: 4 }}>
                {strategy.ctaStrategies.map((cta: string, i: number) => (
                  <li key={i}><span className="item-arrow">→</span> {cta}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* MUSE — Ad Concepts */}
        {concepts.length > 0 && (
          <div className="section page-break">
            <div className="agent-header muse">
              <span className="agent-icon">🎨</span>
              <span className="agent-name muse">MUSE</span>
              <span className="agent-title">· المدير الإبداعي</span>
            </div>

            <div className="concepts-grid">
              {concepts.map((concept: any, i: number) => (
                <div key={i} className="concept-card">
                  <div className="concept-name">{concept.name}</div>
                  {concept.angle && <div className="concept-angle">{concept.angle}</div>}
                  {concept.description && <div className="concept-desc">{concept.description}</div>}
                  {concept.hook && (
                    <div className="hook-box">
                      <div className="hook-label">الهوك</div>
                      <div className="hook-text">"{concept.hook}"</div>
                    </div>
                  )}
                  {concept.cta && (
                    <div className="cta-row">الـ CTA: <strong>{concept.cta}</strong></div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PULSE — Content Calendar */}
        {calendar.length > 0 && (
          <div className="section page-break">
            <div className="agent-header pulse">
              <span className="agent-icon">⚡</span>
              <span className="agent-name pulse">PULSE</span>
              <span className="agent-title">· إدارة الحملة</span>
            </div>

            {calendar.map((week: any, wi: number) => (
              <div key={wi} className="card" style={{ marginBottom: 16 }}>
                <div className="week-header">{week.week || `Week ${wi + 1}`}</div>
                {(week.posts || []).map((post: any, pi: number) => (
                  <div key={pi} className="cal-row">
                    <span className="cal-day">{post.day}</span>
                    <span className="cal-platform">{PLATFORM_ICONS[post.platform] || post.platform}</span>
                    <span className="cal-topic">{post.topic}</span>
                    <span className="cal-type">{post.type}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="doc-footer">
          <div className="footer-brand">NEXUS AI</div>
          <div className="footer-text">أُنشئ بواسطة SAGE · MUSE · PULSE · PRISM — قسم التسويق الذكي</div>
        </div>
      </div>
    </>
  )
}
