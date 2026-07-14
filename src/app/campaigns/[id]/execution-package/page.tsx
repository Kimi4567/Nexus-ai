'use client'

/**
 * Execution Package Page — /campaigns/[id]/execution-package
 *
 * Printable team briefing document. Includes full strategic context,
 * 4-week execution plan, content bank, checklist, risk notes,
 * and next best action. Printing is always an explicit user action.
 *
 * Sprint E — Campaign Execution Pipeline
 */

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { fetchWithTimeout } from '@/lib/fetchWithTimeout'

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

export default function ExecutionPackagePage() {
  const params = useParams()
  const router = useRouter()
  const campaignId = params?.id as string
  const { isAuthenticated, loading, authHeader } = useAuth()
  const { locale } = useI18n()
  const ar = locale === 'ar'
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [fetching, setFetching] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const fetchCampaign = useCallback(async () => {
    const token = authHeader()
    if (!token) {
      setFetching(false)
      setLoadError(true)
      return
    }
    setFetching(true)
    setLoadError(false)
    try {
      const res = await fetchWithTimeout(`/api/campaigns/${campaignId}`, { headers: { Authorization: token } })
      if (res.status === 404) {
        setCampaign(null)
        return
      }
      if (!res.ok) throw new Error('campaign-load-failed')
      const d = await res.json()
      if (d.campaign) setCampaign(d.campaign)
    } catch {
      setCampaign(null)
      setLoadError(true)
    } finally {
      setFetching(false)
    }
  }, [campaignId, authHeader])

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/auth/login')
      return
    }
    if (!isAuthenticated) return
    void fetchCampaign()
  }, [loading, isAuthenticated, fetchCampaign, router])

  if (!loading && !isAuthenticated) return null

  if (loading || fetching) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#fff' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 24, height: 24, border: '2px solid #ddd', borderTopColor: '#FF9500', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          <p style={{ color: '#999', fontSize: 14 }}>{ar ? 'جارٍ تجهيز حزمة التنفيذ...' : 'Preparing your execution package...'}</p>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#fff', padding: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#334155', fontWeight: 700 }}>{ar ? 'تعذّر تحميل حزمة التنفيذ.' : 'Could not load the execution package.'}</p>
          <button type="button" onClick={() => void fetchCampaign()} style={{ marginTop: 12, borderRadius: 10, background: '#101A4D', color: '#fff', padding: '10px 16px', border: 0, cursor: 'pointer' }}>
            {ar ? 'إعادة المحاولة' : 'Retry'}
          </button>
        </div>
      </div>
    )
  }

  if (!campaign) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#fff' }}>
        <p style={{ color: '#999' }}>{ar ? 'الحملة غير موجودة.' : 'Campaign not found.'}</p>
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
  const weeklyPlan: any[] = strategy.weeklyPlan || []
  const calendar: any[] = aiOutput?.contentCalendar || strategy.contentCalendar || []
  const audienceSegments: string[] = strategy.audienceSegments || []
  const successMetrics: string[] = strategy.successMetrics || []
  const riskNotes: string[] = strategy.riskNotes || []
  const executionChecklist: string[] = strategy.executionChecklist || []

  // Sprint M structured fields (with fallback to legacy)
  const diagnosisDetails: any = strategy.diagnosisDetails || null
  const businessObjective: any = strategy.businessObjective || null
  const audienceSegmentsDetailed: any[] = strategy.audienceSegmentsDetailed || []
  const funnelStages: any[] = strategy.funnelStages || []
  const assetRequirements: any = strategy.assetRequirements || null
  const adSetupPlan: any = strategy.adSetupPlan || null
  const weeklyExecutionPlan: any[] = strategy.weeklyExecutionPlan || []
  const readinessChecklist: any[] = strategy.readinessChecklist || []
  const doNotDoYet: string[] = strategy.doNotDoYet || []
  const successMetricsDetailed: any[] = strategy.successMetricsDetailed || []
  const contentAnglesDetailed: any[] = strategy.contentAnglesDetailed || []

  const date = new Date(campaign.createdAt).toLocaleDateString(ar ? 'ar-EG' : 'en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
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
          @page { margin: 14mm 18mm; size: A4; }
        }

        .doc { max-width: 800px; margin: 0 auto; padding: 48px 40px; }

        /* Header */
        .hdr { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 36px; padding-bottom: 24px; border-bottom: 3px solid #F0F0F0; }
        .hdr-brand { font-size: 12px; font-weight: 800; letter-spacing: 0.15em; color: #FF9500; }
        .hdr-badge { display: inline-block; background: #111; color: #FF9500; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; padding: 3px 10px; border-radius: 20px; margin-top: 6px; }
        .hdr-title { font-size: 24px; font-weight: 800; color: #111; margin-top: 8px; line-height: 1.2; }
        .hdr-meta { text-align: right; font-size: 12px; color: #888; line-height: 1.9; }

        /* Overview bar */
        .overview { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0; border: 1px solid #E8E8E8; border-radius: 10px; overflow: hidden; margin-bottom: 32px; }
        .ov-cell { padding: 12px 14px; border-right: 1px solid #E8E8E8; }
        .ov-cell:last-child { border-right: none; }
        .ov-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #AAA; margin-bottom: 4px; }
        .ov-value { font-size: 13px; font-weight: 700; color: #111; }

        /* Section */
        .section { margin-bottom: 28px; }
        .sec-divider { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
        .sec-line { flex: 1; height: 1px; background: #EDEDED; }
        .sec-label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; color: #999; white-space: nowrap; }

        /* Agent banners */
        .agent-banner { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; }
        .ab-strategist { background: #EEF2FF; border-left: 3px solid #6366F1; }
        .ab-nex        { background: #FDF2F8; border-left: 3px solid #EC4899; }
        .ab-pulse      { background: #FFFBEB; border-left: 3px solid #F59E0B; }
        .ab-name { font-size: 13px; font-weight: 700; }
        .ab-name.strategist { color: #6366F1; }
        .ab-name.nex        { color: #EC4899; }
        .ab-name.pulse      { color: #F59E0B; }
        .ab-title { font-size: 11px; color: #AAA; margin-left: 4px; }

        /* Diagnosis */
        .diagnosis { background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 10px; padding: 16px 18px; margin-bottom: 12px; }
        .diagnosis-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #92400E; margin-bottom: 6px; }
        .diagnosis-text { font-size: 13px; color: #78350F; line-height: 1.7; }

        /* Key message */
        .key-msg { background: #EEF2FF; border: 1px solid #C7D2FE; border-radius: 10px; padding: 16px 18px; margin-bottom: 12px; }
        .key-msg-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #4F46E5; margin-bottom: 6px; }
        .key-msg-text { font-size: 15px; font-weight: 700; color: #1E1B4B; font-style: italic; }

        /* Cards */
        .card { background: #F9F9F9; border: 1px solid #EDEDED; border-radius: 10px; padding: 16px 18px; margin-bottom: 10px; }
        .card-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #999; margin-bottom: 8px; }
        .card-body { font-size: 13px; color: #333; line-height: 1.7; }

        /* Funnel grid */
        .funnel-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .funnel-cell { border-radius: 8px; padding: 12px 14px; }
        .fc-awareness    { background: #EFF6FF; border: 1px solid #BFDBFE; }
        .fc-consideration{ background: #F5F3FF; border: 1px solid #DDD6FE; }
        .fc-conversion   { background: #ECFDF5; border: 1px solid #A7F3D0; }
        .fc-retention    { background: #FFFBEB; border: 1px solid #FDE68A; }
        .funnel-stage { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px; }
        .funnel-text  { font-size: 12px; color: #444; line-height: 1.6; }

        /* Audience segments */
        .seg-list { list-style: none; }
        .seg-item { display: flex; align-items: flex-start; gap: 8px; padding: 7px 0; border-bottom: 1px solid #F0F0F0; font-size: 13px; color: #333; }
        .seg-item:last-child { border-bottom: none; }
        .seg-num { font-weight: 700; color: #FF9500; flex-shrink: 0; width: 18px; font-size: 11px; margin-top: 2px; }

        /* Week plan */
        .week-card { background: white; border: 1px solid #E8E8E8; border-radius: 10px; padding: 18px 20px; margin-bottom: 12px; }
        .week-hdr { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
        .week-title { font-size: 14px; font-weight: 800; color: #111; }
        .week-cta { font-size: 11px; background: #FF950018; border: 1px solid #FF950040; color: #B45309; padding: 3px 10px; border-radius: 20px; font-weight: 700; }
        .week-objective { font-size: 13px; font-weight: 600; color: #333; margin-bottom: 8px; }
        .week-msg { background: #EEF2FF; border-radius: 6px; padding: 8px 12px; font-size: 12px; color: #4338CA; font-style: italic; margin-bottom: 10px; }
        .week-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .week-sub { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #AAA; margin-bottom: 6px; }
        .week-sub-body { background: #F9F9F9; border-radius: 6px; padding: 8px 10px; }
        .week-item { font-size: 12px; color: #444; padding: 3px 0; display: flex; align-items: flex-start; gap: 6px; }
        .week-item-dot { flex-shrink: 0; margin-top: 2px; }
        .week-channels { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
        .week-ch-badge { font-size: 10px; background: #F0F0F0; border-radius: 20px; padding: 2px 8px; color: #666; }

        /* Content bank */
        .hook-item { display: flex; gap: 8px; padding: 8px 0; border-bottom: 1px solid #F0F0F0; font-size: 13px; }
        .hook-item:last-child { border-bottom: none; }
        .hook-num { color: #CCC; font-weight: 700; font-size: 11px; flex-shrink: 0; width: 18px; margin-top: 2px; }
        .hook-text { color: #FF9500; font-weight: 600; font-style: italic; }
        .cta-item { display: flex; gap: 8px; padding: 6px 0; border-bottom: 1px solid #F0F0F0; font-size: 13px; color: #333; }
        .cta-item:last-child { border-bottom: none; }
        .cta-arrow { color: #FF9500; font-weight: 700; flex-shrink: 0; }
        .caption-item { padding: 8px 0; border-bottom: 1px solid #F0F0F0; font-size: 12px; color: #444; line-height: 1.6; }
        .caption-item:last-child { border-bottom: none; }
        .angle-item { display: flex; gap: 8px; padding: 7px 0; border-bottom: 1px solid #F0F0F0; font-size: 13px; color: #333; }
        .angle-item:last-child { border-bottom: none; }

        /* Checklist */
        .checklist { list-style: none; }
        .checklist li { display: flex; gap: 8px; padding: 7px 0; border-bottom: 1px solid #F0F0F0; font-size: 13px; color: #333; }
        .checklist li:last-child { border-bottom: none; }
        .check-box { width: 14px; height: 14px; border: 2px solid #DDD; border-radius: 3px; flex-shrink: 0; margin-top: 2px; }

        /* Risk notes */
        .risk-item { display: flex; gap: 8px; padding: 7px 0; border-bottom: 1px solid #FEE2E2; font-size: 13px; color: #7F1D1D; }
        .risk-item:last-child { border-bottom: none; }
        .risk-icon { flex-shrink: 0; color: #EF4444; }

        /* Metrics */
        .metric-item { display: flex; gap: 8px; padding: 7px 0; border-bottom: 1px solid #F0F0F0; font-size: 13px; color: #333; }
        .metric-item:last-child { border-bottom: none; }
        .metric-dot { color: #22C55E; flex-shrink: 0; margin-top: 3px; }

        /* Next best action */
        .next-action { background: #111; border-radius: 10px; padding: 20px 22px; margin-bottom: 12px; }
        .na-label { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; color: #FF9500; margin-bottom: 8px; }
        .na-text { font-size: 15px; font-weight: 700; color: #fff; line-height: 1.5; }

        /* Calendar rows */
        .cal-week { font-size: 13px; font-weight: 700; margin-bottom: 4px; }
        .cal-theme { font-size: 11px; color: #999; font-style: italic; margin-bottom: 8px; }
        .cal-row { display: flex; gap: 12px; padding: 6px 0; border-bottom: 1px solid #F7F7F7; font-size: 12px; }
        .cal-day { color: #999; width: 60px; flex-shrink: 0; }
        .cal-plat { width: 80px; color: #666; flex-shrink: 0; }
        .cal-topic { flex: 1; color: #333; }
        .cal-hook { font-size: 11px; color: #FF9500; font-style: italic; display: block; margin-top: 2px; }
        .cal-type { font-size: 10px; background: #F0F0F0; padding: 2px 8px; border-radius: 20px; color: #888; white-space: nowrap; }

        /* Sprint M — extra styles */
        .m-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .m-tag { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; }
        .m-tag-red { background: #FEE2E2; color: #DC2626; }
        .m-tag-yellow { background: #FEF9C3; color: #CA8A04; }
        .m-tag-blue { background: #DBEAFE; color: #1D4ED8; }
        .m-tag-green { background: #DCFCE7; color: #15803D; }
        .m-tag-purple { background: #F3E8FF; color: #7C3AED; }
        .m-tag-orange { background: #FFEDD5; color: #C2410C; }
        .m-asset-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
        .m-asset-box { border-radius: 8px; padding: 10px 12px; }
        .m-seg-card { background: #F9F9F9; border: 1px solid #E8E8E8; border-radius: 8px; padding: 12px 14px; margin-bottom: 8px; }
        .m-seg-name { font-size: 13px; font-weight: 700; color: #111; margin-bottom: 4px; }
        .m-seg-detail { font-size: 12px; color: #555; line-height: 1.6; }
        .m-funnel-card { border-radius: 8px; padding: 12px 14px; margin-bottom: 8px; }
        .m-obj-row { display: flex; gap: 10px; padding: 6px 0; border-bottom: 1px solid #F0F0F0; font-size: 13px; }
        .m-obj-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #AAA; width: 100px; flex-shrink: 0; padding-top: 2px; }
        .m-obj-value { flex: 1; color: #333; }
        .m-adsetup-row { display: flex; gap: 8px; padding: 6px 0; border-bottom: 1px solid #F0F0F0; font-size: 12px; align-items: flex-start; }
        .m-adsetup-label { font-weight: 700; color: #999; width: 120px; flex-shrink: 0; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; padding-top: 1px; }
        .m-adsetup-value { flex: 1; color: #333; }
        .m-wex-card { background: white; border: 1px solid #E8E8E8; border-radius: 10px; padding: 16px 18px; margin-bottom: 10px; }
        .m-wex-week { font-size: 13px; font-weight: 800; color: #111; margin-bottom: 4px; }
        .m-wex-theme { font-size: 12px; color: #666; font-style: italic; margin-bottom: 8px; }
        .m-wex-msg { background: #EEF2FF; border-radius: 6px; padding: 7px 10px; font-size: 12px; color: #4338CA; font-style: italic; margin-bottom: 8px; }
        .m-check-item { display: flex; align-items: flex-start; gap: 8px; padding: 6px 0; border-bottom: 1px solid #F0F0F0; font-size: 13px; }
        .m-check-item:last-child { border-bottom: none; }
        .m-donot-item { display: flex; gap: 8px; padding: 6px 0; border-bottom: 1px solid #FEE2E2; font-size: 13px; color: #7F1D1D; }
        .m-donot-item:last-child { border-bottom: none; }
        .m-metric-row { display: flex; gap: 8px; padding: 6px 0; border-bottom: 1px solid #F0F0F0; font-size: 12px; }
        .m-metric-row:last-child { border-bottom: none; }

        /* Footer */
        .doc-footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #EDEDED; display: flex; justify-content: space-between; align-items: center; }
        .footer-brand { font-size: 12px; font-weight: 700; color: #FF9500; letter-spacing: 0.1em; }
        .footer-text { font-size: 11px; color: #BBB; }

        .print-btn { position: fixed; bottom: 28px; right: 28px; background: #FF9500; color: black; font-weight: 700; font-size: 14px; padding: 12px 24px; border: none; border-radius: 12px; cursor: pointer; box-shadow: 0 4px 16px rgba(255,149,0,0.3); z-index: 100; transition: background 0.15s; }
        .print-btn:hover { background: #FFB340; }
      `}</style>

      <button className="print-btn no-print" onClick={() => window.print()}>{ar ? '⬇ حفظ كملف PDF' : '⬇ Save as PDF'}</button>

      <div className="doc">

        {/* Header */}
        <div className="hdr">
          <div>
            <div className="hdr-brand">NEXUS AI</div>
            <div><span className="hdr-badge">Execution Package</span></div>
            <div className="hdr-title">{campaign.name}</div>
            <div style={{ marginTop: 8, fontSize: 13, color: '#666' }}>
              <span style={{ textTransform: 'capitalize' }}>{campaign.goal?.toLowerCase()}</span>
              {campaign.platforms?.length > 0 && (
                <> · {campaign.platforms.map(p => PLATFORM_LABELS[p] || p).join(', ')}</>
              )}
            </div>
          </div>
          <div className="hdr-meta">
            <div style={{ fontWeight: 600, color: '#555' }}>Team Execution Guide</div>
            <div>{date}</div>
            {campaign.audience && (
              <div style={{ marginTop: 6, maxWidth: 200, textAlign: 'right', color: '#666' }}>Audience: {campaign.audience}</div>
            )}
          </div>
        </div>

        {/* Overview bar */}
        <div className="overview">
          <div className="ov-cell"><div className="ov-label">Goal</div><div className="ov-value" style={{ textTransform: 'capitalize' }}>{campaign.goal?.toLowerCase() || '—'}</div></div>
          {strategy.keyMessage && <div className="ov-cell" style={{ gridColumn: 'span 2' }}><div className="ov-label">Key Message</div><div className="ov-value" style={{ fontWeight: 600, fontSize: 12 }}>"{strategy.keyMessage}"</div></div>}
          {strategy.offerCTAStrategy?.primaryCTA && <div className="ov-cell"><div className="ov-label">Primary CTA</div><div className="ov-value" style={{ fontSize: 12 }}>{strategy.offerCTAStrategy.primaryCTA}</div></div>}
          {strategy.nextBestAction && <div className="ov-cell"><div className="ov-label">Next Action</div><div className="ov-value" style={{ fontSize: 11, fontWeight: 600, color: '#FF9500' }}>→ See bottom</div></div>}
        </div>

        {/* ── SECTION 1: STRATEGIC FOUNDATION ── */}
        <div className="section">
          <div className="sec-divider">
            <div className="sec-label">Strategic Foundation</div>
            <div className="sec-line" />
          </div>

          <div className="agent-banner ab-strategist">
            <span style={{ fontSize: 16 }}>🧠</span>
            <span className="ab-name strategist">Strategist</span>
            <span className="ab-title">· Chief Marketing Strategist</span>
          </div>

          {/* Diagnosis — Sprint M detailed or legacy */}
          {(diagnosisDetails || strategy.diagnosis) && (
            <div className="diagnosis">
              <div className="diagnosis-label">🔎 Marketing Diagnosis</div>
              {diagnosisDetails ? (
                <div>
                  {diagnosisDetails.currentSituation && <div className="diagnosis-text" style={{ marginBottom: 6 }}><strong>Situation:</strong> {diagnosisDetails.currentSituation}</div>}
                  {diagnosisDetails.biggestChallenge && <div className="diagnosis-text" style={{ marginBottom: 6 }}><strong>Challenge:</strong> {diagnosisDetails.biggestChallenge}</div>}
                  {diagnosisDetails.marketOpportunity && <div className="diagnosis-text" style={{ marginBottom: 6 }}><strong>Opportunity:</strong> {diagnosisDetails.marketOpportunity}</div>}
                  {diagnosisDetails.criticalAssumption && <div className="diagnosis-text"><strong>Key Assumption:</strong> {diagnosisDetails.criticalAssumption}</div>}
                </div>
              ) : (
                <div className="diagnosis-text">{strategy.diagnosis}</div>
              )}
            </div>
          )}

          {/* Business Objective (Sprint M) */}
          {businessObjective && (
            <div className="card" style={{ background: '#EEF2FF', border: '1px solid #C7D2FE' }}>
              <div className="card-label" style={{ color: '#4338CA' }}>🎯 Business Objective</div>
              <div style={{ marginTop: 8 }}>
                {[
                  { label: 'Primary Goal', value: businessObjective.primaryGoal },
                  { label: 'Revenue Target', value: businessObjective.revenueTarget },
                  { label: 'Timeline', value: businessObjective.timeline },
                  { label: 'Success Looks Like', value: businessObjective.successLooksLike },
                  { label: 'Constraint', value: businessObjective.biggestConstraint },
                ].filter(r => r.value).map((r, i) => (
                  <div key={i} className="m-obj-row">
                    <span className="m-obj-label">{r.label}</span>
                    <span className="m-obj-value">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {strategy.keyMessage && (
            <div className="key-msg">
              <div className="key-msg-label">💬 Key Message</div>
              <div className="key-msg-text">"{strategy.keyMessage}"</div>
            </div>
          )}

          {strategy.positioning && (
            <div className="card">
              <div className="card-label">Positioning</div>
              <div className="card-body">{strategy.positioning}</div>
            </div>
          )}

          {strategy.differentiation && (
            <div className="card">
              <div className="card-label">⚡ Differentiation</div>
              <div className="card-body">{strategy.differentiation}</div>
            </div>
          )}

          {/* Audience Segments — detailed (Sprint M) or legacy */}
          {(audienceSegmentsDetailed.length > 0 || audienceSegments.length > 0) && (
            <div className="card">
              <div className="card-label">👥 Audience Segments</div>
              {audienceSegmentsDetailed.length > 0 ? (
                <div style={{ marginTop: 8 }}>
                  {audienceSegmentsDetailed.map((seg: any, i: number) => (
                    <div key={i} className="m-seg-card">
                      <div className="m-seg-name">{seg.name || seg.segment || `Segment ${i + 1}`}</div>
                      {seg.description && <div className="m-seg-detail">{seg.description}</div>}
                      {seg.painPoint && <div className="m-seg-detail" style={{ marginTop: 4 }}><strong>Pain:</strong> {seg.painPoint}</div>}
                      {seg.desire && <div className="m-seg-detail"><strong>Desire:</strong> {seg.desire}</div>}
                      {(seg.channel || seg.messagingAngle) && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                          {seg.channel && <span className="m-tag m-tag-blue">{seg.channel}</span>}
                          {seg.messagingAngle && <span className="m-tag m-tag-purple">{seg.messagingAngle}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <ul className="seg-list" style={{ marginTop: 8 }}>
                  {audienceSegments.map((seg, i) => (
                    <li key={i} className="seg-item">
                      <span className="seg-num">{i + 1}</span>
                      <span>{seg}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Funnel — detailed (Sprint M) or legacy */}
          {(funnelStages.length > 0 || strategy.funnelStrategy) && (
            <div className="card">
              <div className="card-label">🔻 Funnel Mechanism</div>
              {funnelStages.length > 0 ? (
                <div style={{ marginTop: 10 }}>
                  {funnelStages.map((fs: any, i: number) => {
                    const colors: Record<string, string> = {
                      awareness: '#1D4ED8', consideration: '#7C3AED',
                      conversion: '#065F46', retention: '#92400E', activation: '#B45309',
                    }
                    const bgColors: Record<string, string> = {
                      awareness: '#EFF6FF', consideration: '#F5F3FF',
                      conversion: '#ECFDF5', retention: '#FFFBEB', activation: '#FFF7ED',
                    }
                    const stage = (fs.stage || '').toLowerCase()
                    const color = colors[stage] || '#374151'
                    const bg = bgColors[stage] || '#F9F9F9'
                    return (
                      <div key={i} className="m-funnel-card" style={{ background: bg, border: `1px solid ${color}30`, marginBottom: 8 }}>
                        <div className="funnel-stage" style={{ color }}>{fs.stage}</div>
                        {fs.goal && <div className="funnel-text" style={{ marginBottom: 4 }}><strong>Goal:</strong> {fs.goal}</div>}
                        {fs.mechanism && <div className="funnel-text" style={{ marginBottom: 4 }}><strong>Mechanism:</strong> {fs.mechanism}</div>}
                        {Array.isArray(fs.tactics) && fs.tactics.length > 0 && (
                          <div className="funnel-text">{fs.tactics.map((t: string, j: number) => (
                            <span key={j} className="m-tag m-tag-blue" style={{ marginRight: 4, marginBottom: 2, display: 'inline-block' }}>{t}</span>
                          ))}</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : strategy.funnelStrategy && (
                <div className="funnel-grid" style={{ marginTop: 10 }}>
                  {strategy.funnelStrategy.awareness && (
                    <div className="funnel-cell fc-awareness">
                      <div className="funnel-stage" style={{ color: '#1D4ED8' }}>📢 Awareness</div>
                      <div className="funnel-text">{strategy.funnelStrategy.awareness}</div>
                    </div>
                  )}
                  {strategy.funnelStrategy.consideration && (
                    <div className="funnel-cell fc-consideration">
                      <div className="funnel-stage" style={{ color: '#7C3AED' }}>🤔 Consideration</div>
                      <div className="funnel-text">{strategy.funnelStrategy.consideration}</div>
                    </div>
                  )}
                  {strategy.funnelStrategy.conversion && (
                    <div className="funnel-cell fc-conversion">
                      <div className="funnel-stage" style={{ color: '#065F46' }}>✅ Conversion</div>
                      <div className="funnel-text">{strategy.funnelStrategy.conversion}</div>
                    </div>
                  )}
                  {strategy.funnelStrategy.retention && (
                    <div className="funnel-cell fc-retention">
                      <div className="funnel-stage" style={{ color: '#92400E' }}>🔄 Retention</div>
                      <div className="funnel-text">{strategy.funnelStrategy.retention}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {strategy.offerCTAStrategy && (
            <div className="card">
              <div className="card-label">📣 Offer & CTA Strategy</div>
              <div style={{ marginTop: 8 }}>
                {[
                  { label: 'Primary CTA',    value: strategy.offerCTAStrategy.primaryCTA,   color: '#FF9500' },
                  { label: 'Secondary CTA',  value: strategy.offerCTAStrategy.secondaryCTA, color: '#666' },
                  { label: 'Lead Magnet',    value: strategy.offerCTAStrategy.leadMagnet,   color: '#6366F1' },
                  { label: 'Beta Offer',     value: strategy.offerCTAStrategy.betaOffer,    color: '#8B5CF6' },
                  { label: 'Contact Flow',   value: strategy.offerCTAStrategy.contactFlow,  color: '#059669' },
                ].filter(row => row.value).map((row, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: '1px solid #F0F0F0', fontSize: 13 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#AAA', width: 90, flexShrink: 0, paddingTop: 2 }}>{row.label}</span>
                    <span style={{ color: row.color, fontWeight: row.label === 'Primary CTA' ? 700 : 400 }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Asset Requirements (Sprint M) */}
          {assetRequirements && (
            <div className="card">
              <div className="card-label">📦 Asset Requirements</div>
              <div className="m-asset-grid">
                {assetRequirements.mustHave?.length > 0 && (
                  <div className="m-asset-box" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>🔴 Must Have</div>
                    {assetRequirements.mustHave.map((item: string, i: number) => (
                      <div key={i} style={{ fontSize: 12, color: '#374151', padding: '2px 0', display: 'flex', gap: 6 }}>
                        <span style={{ color: '#DC2626', flexShrink: 0 }}>·</span>{item}
                      </div>
                    ))}
                  </div>
                )}
                {assetRequirements.forAds?.length > 0 && (
                  <div className="m-asset-box" style={{ background: '#EEF2FF', border: '1px solid #C7D2FE' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#4338CA', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>🎯 For Ads</div>
                    {assetRequirements.forAds.map((item: string, i: number) => (
                      <div key={i} style={{ fontSize: 12, color: '#374151', padding: '2px 0', display: 'flex', gap: 6 }}>
                        <span style={{ color: '#4338CA', flexShrink: 0 }}>·</span>{item}
                      </div>
                    ))}
                  </div>
                )}
                {assetRequirements.forOrganic?.length > 0 && (
                  <div className="m-asset-box" style={{ background: '#F0FDF4', border: '1px solid #86EFAC' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#15803D', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>📱 For Organic</div>
                    {assetRequirements.forOrganic.map((item: string, i: number) => (
                      <div key={i} style={{ fontSize: 12, color: '#374151', padding: '2px 0', display: 'flex', gap: 6 }}>
                        <span style={{ color: '#15803D', flexShrink: 0 }}>·</span>{item}
                      </div>
                    ))}
                  </div>
                )}
                {assetRequirements.nextToCreate?.length > 0 && (
                  <div className="m-asset-box" style={{ background: '#FFF7ED', border: '1px solid #FDBA74' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#C2410C', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>📸 Shoot Next</div>
                    {assetRequirements.nextToCreate.map((item: string, i: number) => (
                      <div key={i} style={{ fontSize: 12, color: '#374151', padding: '2px 0', display: 'flex', gap: 6 }}>
                        <span style={{ color: '#C2410C', flexShrink: 0 }}>·</span>{item}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── SECTION 1B: VEX AD SETUP PLAN (Sprint M) ── */}
        {adSetupPlan && (
          <div className="section page-break">
            <div className="sec-divider">
              <div className="sec-label">VEX Ad Setup Plan</div>
              <div className="sec-line" />
            </div>
            <div className="agent-banner ab-pulse">
              <span style={{ fontSize: 16 }}>⚡</span>
              <span className="ab-name pulse">VEX</span>
              <span className="ab-title">· Ad Setup Draft (manual setup guide)</span>
            </div>
            <div className="card">
              <div className="card-label">📣 Ad Campaign Draft</div>
              <div style={{ marginTop: 8 }}>
                {[
                  { label: 'Objective', value: adSetupPlan.objective },
                  { label: 'Targeting', value: adSetupPlan.targeting },
                  { label: 'Platform Priority', value: adSetupPlan.platformPriority },
                  { label: 'Test Budget', value: adSetupPlan.testBudget },
                  { label: 'Duration', value: adSetupPlan.duration },
                  { label: 'Landing Path', value: adSetupPlan.landingPath },
                  { label: 'Tracking', value: adSetupPlan.tracking },
                ].filter(r => r.value).map((r, i) => (
                  <div key={i} className="m-adsetup-row">
                    <span className="m-adsetup-label">{r.label}</span>
                    <span className="m-adsetup-value">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
            {adSetupPlan.creativeFormats?.length > 0 && (
              <div className="card">
                <div className="card-label">🎨 Creative Formats</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {adSetupPlan.creativeFormats.map((f: string, i: number) => (
                    <span key={i} className="m-tag m-tag-blue">{f}</span>
                  ))}
                </div>
              </div>
            )}
            {adSetupPlan.adCopyAngles?.length > 0 && (
              <div className="card">
                <div className="card-label">✍�� Ad Copy Angles</div>
                {adSetupPlan.adCopyAngles.map((angle: string, i: number) => (
                  <div key={i} className="m-adsetup-row">
                    <span className="m-adsetup-label">Angle {i + 1}</span>
                    <span className="m-adsetup-value">{angle}</span>
                  </div>
                ))}
              </div>
            )}
            {adSetupPlan.abTestPlan && (
              <div className="card">
                <div className="card-label">🔬 A/B Test Plan</div>
                <div className="card-body" style={{ marginTop: 6 }}>{adSetupPlan.abTestPlan}</div>
              </div>
            )}
            {adSetupPlan.preLaunchChecklist?.length > 0 && (
              <div className="card">
                <div className="card-label">✅ Pre-Launch Checklist</div>
                <ul className="checklist" style={{ marginTop: 8 }}>
                  {adSetupPlan.preLaunchChecklist.map((item: string, i: number) => (
                    <li key={i}><div className="check-box" /><span>{item}</span></li>
                  ))}
                </ul>
              </div>
            )}
            {adSetupPlan.notReadyIf?.length > 0 && (
              <div className="card" style={{ background: '#FFF5F5', border: '1px solid #FECACA' }}>
                <div className="card-label" style={{ color: '#DC2626' }}>🚫 Do NOT Launch If…</div>
                <div style={{ marginTop: 8 }}>
                  {adSetupPlan.notReadyIf.map((item: string, i: number) => (
                    <div key={i} className="risk-item">
                      <span className="risk-icon">!</span><span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SECTION 2: WEEKLY EXECUTION PLAN — Sprint M preferred ── */}
        {(weeklyExecutionPlan.length > 0 || weeklyPlan.length > 0) && (
          <div className="section page-break">
            <div className="sec-divider">
              <div className="sec-label">{weeklyExecutionPlan.length > 0 ? 'Weekly Execution Plan' : '4-Week Execution Plan'}</div>
              <div className="sec-line" />
            </div>

            <div className="agent-banner ab-pulse">
              <span style={{ fontSize: 16 }}>⚡</span>
              <span className="ab-name pulse">PULSE</span>
              <span className="ab-title">· Campaign Operations</span>
            </div>

            {weeklyExecutionPlan.length > 0 ? weeklyExecutionPlan.map((wk: any, i: number) => (
              <div key={i} className="m-wex-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div className="m-wex-week">Week {wk.week}{wk.theme ? ` — ${wk.theme}` : ''}</div>
                  {wk.successMetric && <div className="week-cta">{wk.successMetric}</div>}
                </div>
                {wk.keyMessage && <div className="m-wex-msg">"{wk.keyMessage}"</div>}
                <div className="week-grid">
                  {wk.deliverables?.length > 0 && (
                    <div>
                      <div className="week-sub">Deliverables ({wk.contentPieces || wk.deliverables.length})</div>
                      <div className="week-sub-body">
                        {wk.deliverables.map((d: string, di: number) => (
                          <div key={di} className="week-item">
                            <span className="week-item-dot" style={{ color: '#22C55E' }}>□</span>
                            <span>{d}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    {wk.organicFocus && (
                      <div style={{ marginBottom: 8 }}>
                        <div className="week-sub">Organic Focus</div>
                        <div className="week-sub-body"><div className="week-item"><span className="week-item-dot" style={{ color: '#22C55E' }}>·</span><span>{wk.organicFocus}</span></div></div>
                      </div>
                    )}
                    {wk.paidFocus && (
                      <div>
                        <div className="week-sub">Paid Focus</div>
                        <div className="week-sub-body"><div className="week-item"><span className="week-item-dot" style={{ color: '#6366F1' }}>·</span><span>{wk.paidFocus}</span></div></div>
                      </div>
                    )}
                  </div>
                </div>
                {(Array.isArray(wk.platforms) && wk.platforms.length > 0) && (
                  <div className="week-channels" style={{ marginTop: 8 }}>
                    {wk.platforms.map((ch: string, ci: number) => (
                      <span key={ci} className="week-ch-badge">{ch}</span>
                    ))}
                    {wk.adBudget && <span className="week-ch-badge" style={{ background: '#FFF7ED', color: '#C2410C' }}>Budget: {wk.adBudget}</span>}
                  </div>
                )}
              </div>
            )) : weeklyPlan.map((wk: any, i: number) => (
              <div key={i} className="week-card">
                <div className="week-hdr">
                  <div className="week-title">Week {wk.week}</div>
                  {wk.cta && <div className="week-cta">CTA: {wk.cta}</div>}
                </div>
                {wk.objective && <div className="week-objective">Objective: {wk.objective}</div>}
                {wk.keyMessage && <div className="week-msg">"{wk.keyMessage}"</div>}
                <div className="week-grid">
                  {wk.contentThemes?.length > 0 && (
                    <div>
                      <div className="week-sub">Content Themes</div>
                      <div className="week-sub-body">
                        {wk.contentThemes.map((t: string, ti: number) => (
                          <div key={ti} className="week-item"><span className="week-item-dot" style={{ color: '#FF9500' }}>·</span><span>{t}</span></div>
                        ))}
                      </div>
                    </div>
                  )}
                  {wk.deliverables?.length > 0 && (
                    <div>
                      <div className="week-sub">Deliverables</div>
                      <div className="week-sub-body">
                        {wk.deliverables.map((d: string, di: number) => (
                          <div key={di} className="week-item"><span className="week-item-dot" style={{ color: '#22C55E' }}>□</span><span>{d}</span></div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {wk.channels?.length > 0 && (
                  <div className="week-channels">
                    {wk.channels.map((ch: string, ci: number) => (
                      <span key={ci} className="week-ch-badge">{ch}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── SECTION 3: CONTENT BANK ── */}
        {(topHooks.length > 0 || ctaVariations.length > 0 || captionFormulas.length > 0 || contentAngles.length > 0 || scriptTemplate) && (
          <div className="section page-break">
            <div className="sec-divider">
              <div className="sec-label">Content Bank</div>
              <div className="sec-line" />
            </div>

            <div className="agent-banner ab-nex">
              <span style={{ fontSize: 16 }}>✍️</span>
              <span className="ab-name nex">NEX</span>
              <span className="ab-title">· Content Director</span>
            </div>

            {topHooks.length > 0 && (
              <div className="card">
                <div className="card-label">🪝 Top Hooks ({topHooks.length})</div>
                {topHooks.map((hook, i) => (
                  <div key={i} className="hook-item">
                    <span className="hook-num">{i + 1}</span>
                    <span className="hook-text">"{hook}"</span>
                  </div>
                ))}
              </div>
            )}

            {contentAngles.length > 0 && (
              <div className="card">
                <div className="card-label">💡 Content Angles ({contentAngles.length})</div>
                {contentAngles.map((angle, i) => (
                  <div key={i} className="angle-item">
                    <span className="hook-num">{i + 1}</span>
                    <span>{angle}</span>
                  </div>
                ))}
              </div>
            )}

            {ctaVariations.length > 0 && (
              <div className="card">
                <div className="card-label">📣 CTA Variations</div>
                {ctaVariations.map((cta, i) => (
                  <div key={i} className="cta-item">
                    <span className="cta-arrow">→</span>
                    <span>{cta}</span>
                  </div>
                ))}
              </div>
            )}

            {captionFormulas.length > 0 && (
              <div className="card">
                <div className="card-label">✍️ Caption Formulas</div>
                {captionFormulas.map((cap, i) => (
                  <div key={i} className="caption-item">{cap}</div>
                ))}
              </div>
            )}

            {scriptTemplate && (
              <div className="card">
                <div className="card-label">📝 Script Template</div>
                <div style={{ marginTop: 8, fontSize: 13, color: '#333', whiteSpace: 'pre-wrap', fontFamily: 'monospace', lineHeight: 1.7 }}>{scriptTemplate}</div>
              </div>
            )}
          </div>
        )}

        {/* ── SECTION 4: CALENDAR ── */}
        {calendar.length > 0 && weeklyPlan.length === 0 && (
          <div className="section page-break">
            <div className="sec-divider">
              <div className="sec-label">Content Calendar</div>
              <div className="sec-line" />
            </div>
            {calendar.map((week: any, wi: number) => (
              <div key={wi} className="card" style={{ marginBottom: 14 }}>
                <div className="cal-week">Week {week.week || wi + 1}</div>
                {week.theme && <div className="cal-theme">{week.theme}</div>}
                {(week.posts || []).map((post: any, pi: number) => (
                  <div key={pi} className="cal-row">
                    <span className="cal-day">{post.day}</span>
                    <span className="cal-plat">{PLATFORM_LABELS[post.platform] || post.platform}</span>
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

        {/* ── SECTION 5: READINESS CHECKLIST + METRICS + RISK + DO NOT DO ── */}
        {(readinessChecklist.length > 0 || executionChecklist.length > 0 || successMetrics.length > 0 || successMetricsDetailed.length > 0 || riskNotes.length > 0 || doNotDoYet.length > 0) && (
          <div className="section page-break">
            <div className="sec-divider">
              <div className="sec-label">Readiness, Metrics & Compliance</div>
              <div className="sec-line" />
            </div>

            {/* Readiness Checklist — Sprint M preferred */}
            {(readinessChecklist.length > 0 || executionChecklist.length > 0) && (
              <div className="card">
                <div className="card-label">✅ {readinessChecklist.length > 0 ? 'Launch Readiness' : 'Launch Checklist'}</div>
                <ul className="checklist" style={{ marginTop: 8 }}>
                  {(readinessChecklist.length > 0 ? readinessChecklist : executionChecklist.map(item => ({ label: item, done: false }))).map((item: any, i: number) => (
                    <li key={i} className="m-check-item">
                      <div className="check-box" style={{ borderColor: item.done ? '#22C55E' : '#DDD', background: item.done ? '#22C55E18' : 'transparent' }}>
                        {item.done && <span style={{ fontSize: 9, color: '#16A34A', fontWeight: 700, lineHeight: '14px', display: 'block', textAlign: 'center' }}>✓</span>}
                      </div>
                      <span style={{ color: item.done ? '#16A34A' : '#333' }}>{item.label || item}</span>
                      {item.done && <span style={{ marginLeft: 'auto', fontSize: 10, color: '#16A34A', fontWeight: 600 }}>Done</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Do Not Do Yet (Sprint M) */}
            {doNotDoYet.length > 0 && (
              <div className="card" style={{ background: '#FFF5F5', border: '1px solid #FECACA' }}>
                <div className="card-label" style={{ color: '#DC2626' }}>🚫 Do NOT Do Yet</div>
                <div style={{ marginTop: 8 }}>
                  {doNotDoYet.map((item: string, i: number) => (
                    <div key={i} className="m-donot-item">
                      <span className="risk-icon">✗</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Success Metrics — Sprint M detailed or legacy */}
            {(successMetricsDetailed.length > 0 || successMetrics.length > 0) && (
              <div className="card">
                <div className="card-label">📈 Success Metrics</div>
                <div style={{ marginTop: 8 }}>
                  {successMetricsDetailed.length > 0 ? successMetricsDetailed.map((m: any, i: number) => (
                    <div key={i} className="m-metric-row">
                      {m.category && <span className="m-tag m-tag-blue" style={{ marginRight: 8, flexShrink: 0 }}>{m.category}</span>}
                      <span style={{ flex: 1, color: '#333' }}>{m.metric || m.kpi || m}</span>
                      {m.target && <span style={{ color: '#FF9500', fontWeight: 600, fontSize: 12, marginLeft: 8 }}>{m.target}</span>}
                    </div>
                  )) : successMetrics.map((metric: string, i: number) => (
                    <div key={i} className="metric-item">
                      <span className="metric-dot">✓</span>
                      <span>{metric}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Risk Notes */}
            {riskNotes.length > 0 && (
              <div className="card" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                <div className="card-label" style={{ color: '#B45309' }}>⚠️ Risk & Compliance Notes</div>
                <div style={{ marginTop: 8 }}>
                  {riskNotes.map((note: string, i: number) => (
                    <div key={i} className="risk-item" style={{ borderBottomColor: '#FDE68A', color: '#78350F' }}>
                      <span style={{ color: '#B45309' }}>!</span>
                      <span>{note}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── NEXT BEST ACTION ── */}
        {strategy.nextBestAction && (
          <div className="section">
            <div className="sec-divider">
              <div className="sec-label">Next Best Action</div>
              <div className="sec-line" />
            </div>
            <div className="next-action">
              <div className="na-label">🚀 Do This First</div>
              <div className="na-text">{strategy.nextBestAction}</div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="doc-footer">
          <div className="footer-brand">NEXUS AI</div>
          <div className="footer-text">Execution Package · Strategist · NEX · PULSE — Nexus AI Marketing OS</div>
        </div>
      </div>
    </>
  )
}
