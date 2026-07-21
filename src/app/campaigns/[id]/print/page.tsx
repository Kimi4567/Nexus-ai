'use client'

import { useCallback, useEffect, useState } from 'react'
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

interface ContentPost {
  id: string
  platform: string
  publishTarget?: string | null
  caption: string
  status: string
  scheduledAt?: string | null
  publishedAt?: string | null
}

interface DeliveryManifest {
  state: 'NO_CONTENT' | 'REVIEW_DRAFT' | 'COPY_APPROVED' | 'READY_FOR_SCHEDULING'
  generatedAt: string
  counts: {
    posts: number
    copyApproved: number
    mediaApproved: number
    providerPublicationVerified: number
  }
  posts: Array<{
    id: string
    copyApproved: boolean
    mediaApproved: boolean
    scheduleRecorded: boolean
    providerPublicationVerified: boolean
    approvalEvidence: {
      copy?: { version: number; payloadHash: string } | null
      media?: { version: number; payloadHash: string } | null
    }
  }>
  approvedStrategy?: { campaign?: Partial<Campaign> } | null
}

const PLATFORM_LABELS: Record<string, string> = {
  INSTAGRAM: 'Instagram', TIKTOK: 'TikTok', FACEBOOK: 'Facebook',
  YOUTUBE_SHORTS: 'YouTube Shorts', LINKEDIN: 'LinkedIn', SNAPCHAT: 'Snapchat',
}

export default function CampaignPrintPage() {
  const params = useParams()
  const router = useRouter()
  const campaignId = params?.id as string
  const { isAuthenticated, loading, authHeader } = useAuth()
  const { locale } = useI18n()
  const ar = locale === 'ar'
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [contentPosts, setContentPosts] = useState<ContentPost[]>([])
  const [deliveryManifest, setDeliveryManifest] = useState<DeliveryManifest | null>(null)
  const [contentPlanUnavailable, setContentPlanUnavailable] = useState(false)
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
      const [response, deliveryResponse] = await Promise.all([
        fetchWithTimeout(`/api/campaigns/${campaignId}`, { headers: { Authorization: token } }),
        fetchWithTimeout(`/api/campaigns/${campaignId}/delivery-package`, { headers: { Authorization: token } }).catch(() => null),
      ])
      if (response.status === 404) {
        setCampaign(null)
        return
      }
      if (!response.ok) throw new Error('campaign-load-failed')
      const data = await response.json()
      if (deliveryResponse?.ok) {
        const deliveryData = await deliveryResponse.json().catch(() => ({}))
        const manifest = deliveryData.manifest as DeliveryManifest | undefined
        const approvedCampaign = manifest?.approvedStrategy?.campaign
        setCampaign(data.campaign ? { ...data.campaign, ...(approvedCampaign || {}) } : null)
        setDeliveryManifest(manifest || null)
        setContentPosts(Array.isArray(deliveryData.posts) ? deliveryData.posts : [])
        setContentPlanUnavailable(false)
      } else {
        if (data.campaign) setCampaign(data.campaign)
        setDeliveryManifest(null)
        setContentPosts([])
        setContentPlanUnavailable(true)
      }
    } catch {
      setCampaign(null)
      setLoadError(true)
    } finally {
      setFetching(false)
    }
  }, [authHeader, campaignId])

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/auth/login')
      return
    }
    if (!isAuthenticated) return
    void fetchCampaign()
  }, [fetchCampaign, isAuthenticated, loading, router])

  if (!loading && !isAuthenticated) return null

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">{ar ? 'جارٍ تجهيز مستند خطة المحتوى...' : 'Preparing your content plan document...'}</p>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6">
        <div className="text-center">
          <p className="font-bold text-slate-700">{ar ? 'تعذّر تحميل مستند خطة المحتوى.' : 'Could not load the content plan document.'}</p>
          <button type="button" onClick={() => void fetchCampaign()} className="mt-3 rounded-xl bg-[#101A4D] px-4 py-2.5 text-sm font-bold text-white">
            {ar ? 'إعادة المحاولة' : 'Retry'}
          </button>
        </div>
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <p className="text-gray-500">{ar ? 'الحملة غير موجودة.' : 'Campaign not found.'}</p>
      </div>
    )
  }

  const aiOutput = campaign.aiOutput as any
  const strategy = aiOutput?.strategy || {}

  // Sprint M fields
  const businessObjective: any = strategy.businessObjective || null
  const diagnosisDetails: any = strategy.diagnosisDetails || null
  const audienceSegmentsDetailed: any[] = strategy.audienceSegmentsDetailed || []
  const audienceSegments: string[] = strategy.audienceSegments || []
  const funnelStages: any[] = strategy.funnelStages || []
  const contentAnglesDetailed: any[] = strategy.contentAnglesDetailed || []
  const weeklyExecutionPlan: any[] = strategy.weeklyExecutionPlan || []
  const weeklyPlan: any[] = strategy.weeklyPlan || []
  const assetRequirements: any = strategy.assetRequirements || null
  const readinessChecklist: any[] = strategy.readinessChecklist || []
  const doNotDoYet: string[] = strategy.doNotDoYet || []
  const successMetricsDetailed: any[] = strategy.successMetricsDetailed || []
  const channelStrategy: any[] = strategy.channelStrategy || []

  // Legacy / shared fields
  const topHooks: string[] = aiOutput?.topHooks || strategy.topHooks || []
  const ctaVariations: string[] = aiOutput?.ctaVariations || strategy.ctaVariations || []
  const captionFormulas: string[] = aiOutput?.captionFormulas || []
  const calendar: any[] = aiOutput?.contentCalendar || strategy.contentCalendar || []
  const storedLanguage = String(
    aiOutput?.language
    ?? aiOutput?.strategyOrder?.language
    ?? strategy?.language
    ?? '',
  ).toLowerCase()
  const documentIsArabic = storedLanguage === 'ar' || (storedLanguage !== 'en' && ar)
  const documentDir = documentIsArabic ? 'rtl' : 'ltr'

  const date = new Date(campaign.createdAt).toLocaleDateString(ar ? 'ar-EG' : 'en-US', {
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
        .doc[dir="rtl"] { text-align: right; }
        .doc[dir="rtl"] .doc-meta { text-align: left; }

        /* ── Header ─────────────────────────────────────────── */
        .doc-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 3px solid #FF9500; }
        .brand { font-size: 11px; font-weight: 800; letter-spacing: 0.2em; color: #FF9500; margin-bottom: 6px; }
        .doc-title { font-size: 28px; font-weight: 800; color: #111; line-height: 1.2; }
        .doc-meta { text-align: right; font-size: 12px; color: #888; line-height: 1.9; }
        .delivery-state { border: 2px solid #FCD34D; background: #FFFBEB; border-radius: 12px; padding: 16px 18px; margin: -18px 0 26px; }
        .delivery-state.ready { border-color: #86EFAC; background: #F0FDF4; }
        .delivery-state-title { font-size: 13px; font-weight: 800; color: #111827; margin-bottom: 5px; }
        .delivery-state-meta { font-size: 10px; color: #64748B; line-height: 1.65; }

        /* ── Chapter dividers ───────────────────────────────── */
        .chapter { display: flex; align-items: center; gap: 12px; margin: 32px 0 20px; }
        .chapter-num { font-size: 28px; font-weight: 900; color: rgba(99,102,241,0.15); line-height: 1; }
        .chapter-line { flex: 1; height: 1px; background: linear-gradient(90deg, rgba(99,102,241,0.3) 0%, transparent 100%); }
        .chapter-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.2em; color: #aaa; }

        /* ── Section blocks ─────────────────────────────────── */
        .section { margin-bottom: 20px; }
        .block { background: #F9F9F9; border: 1px solid #EDEDED; border-radius: 10px; padding: 18px 20px; margin-bottom: 12px; }
        .block-amber  { background: #FFFBF0; border-color: #F59E0B33; }
        .block-indigo { background: #F0F1FF; border-color: #6366F155; }
        .block-green  { background: #F0FFF4; border-color: #10B98133; }
        .block-blue   { background: #F0F8FF; border-color: #3B82F633; }

        .block-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.14em; color: #999; margin-bottom: 8px; }
        .block-label.amber  { color: #D97706; }
        .block-label.indigo { color: #6366F1; }
        .block-label.green  { color: #059669; }
        .block-label.blue   { color: #2563EB; }
        .block-label.pink   { color: #DB2777; }

        .block-body  { font-size: 12px; color: #444; line-height: 1.75; }

        /* ── Key message ────────────────────────────────────── */
        .key-message { background: #EEF2FF; border: 1.5px solid #C7D2FE; border-radius: 12px; padding: 18px 22px; margin-bottom: 14px; }
        .key-message-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.14em; color: #6366F1; margin-bottom: 8px; }
        .key-message-text  { font-size: 17px; font-weight: 800; color: #1E1B4B; font-style: italic; line-height: 1.4; }

        /* ── Next action banner ─────────────────────────────── */
        .next-action { background: linear-gradient(135deg, #EEF2FF, #F0F9FF); border: 1px solid #C7D2FE; border-radius: 10px; padding: 14px 18px; display: flex; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
        .next-action-icon { font-size: 20px; flex-shrink: 0; }
        .next-action-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.14em; color: #6366F1; margin-bottom: 4px; }
        .next-action-text  { font-size: 13px; font-weight: 700; color: #1E1B4B; line-height: 1.45; }

        /* ── 2-col / 3-col grids ────────────────────────────── */
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
        .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px; }
        .grid-cell { background: white; border: 1px solid #EDEDED; border-radius: 8px; padding: 12px 14px; }
        .cell-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #aaa; margin-bottom: 4px; }
        .cell-value { font-size: 12px; color: #222; font-weight: 500; line-height: 1.5; }

        /* ── Diagnosis detail grid ──────────────────────────── */
        .diag-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px; padding-top: 10px; border-top: 1px solid #F59E0B22; }
        .diag-cell { background: white; border: 1px solid #EDEDED; border-radius: 7px; padding: 9px 11px; }

        /* ── Audience segments ──────────────────────────────── */
        .seg-block { background: white; border: 1px solid #E8E8E8; border-radius: 9px; padding: 14px 16px; margin-bottom: 10px; }
        .seg-num { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 6px; background: rgba(139,92,246,0.1); color: #7C3AED; font-size: 10px; font-weight: 800; margin-right: 8px; }
        .seg-name { font-size: 13px; font-weight: 700; color: #111; }
        .seg-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 8px; }

        /* ── Funnel stages ──────────────────────────────────── */
        .funnel-stage { border-radius: 9px; padding: 13px 15px; margin-bottom: 8px; border: 1px solid transparent; }
        .funnel-awareness     { background: #EFF6FF; border-color: #BFDBFE; }
        .funnel-consideration { background: #F5F3FF; border-color: #DDD6FE; }
        .funnel-conversion    { background: #ECFDF5; border-color: #A7F3D0; }
        .funnel-followup      { background: #FFFBEB; border-color: #FDE68A; }
        .funnel-default       { background: #F9F9F9; border-color: #E8E8E8; }
        .funnel-stage-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 8px; }
        .funnel-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }

        /* ── Weekly plan ────────────────────────────────────── */
        .week-block { border: 1px solid #E8E8E8; border-radius: 9px; overflow: hidden; margin-bottom: 10px; }
        .week-header { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #F4F3FF; }
        .week-num { font-size: 10px; font-weight: 900; color: #6366F1; min-width: 24px; }
        .week-objective { font-size: 12px; font-weight: 700; color: #1E1B4B; flex: 1; }
        .week-cta { font-size: 10px; color: #6366F1; font-weight: 600; }
        .week-body { padding: 10px 14px; }
        .week-message { font-size: 11px; color: #666; font-style: italic; margin-bottom: 8px; }
        .week-deliverable { display: flex; align-items: flex-start; gap: 6px; font-size: 11px; color: #333; margin-bottom: 4px; }
        .week-arrow { color: #FF9500; font-weight: 700; flex-shrink: 0; }
        .week-metric { font-size: 10px; color: #059669; font-weight: 600; margin-top: 6px; }

        /* ── Content angles ─────────────────────────────────── */
        .angle-block { background: white; border: 1px solid #E8E8E8; border-radius: 9px; padding: 13px 15px; margin-bottom: 8px; }

        /* ── Hooks ──────────────────────────────────────────── */
        .hook-item { background: white; border: 1px solid #E8E8E8; border-radius: 8px; padding: 11px 14px; margin-bottom: 7px; }
        .hook-num  { font-size: 9px; font-weight: 700; color: #bbb; margin-bottom: 3px; }
        .hook-text { font-size: 12px; font-weight: 600; color: #FF9500; font-style: italic; line-height: 1.5; }

        /* ── CTAs ───────────────────────────────────────────── */
        .cta-item { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: white; border: 1px solid #E8E8E8; border-radius: 7px; margin-bottom: 5px; font-size: 12px; color: #333; }
        .cta-arrow { color: #FF9500; font-weight: 700; flex-shrink: 0; }

        /* ── Pillars ────────────────────────────────────────── */
        .pillars-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .pillar { background: white; border: 1px solid #EDEDED; border-radius: 7px; padding: 9px 11px; font-size: 11px; color: #333; text-align: center; font-weight: 600; }

        /* ── KPI grid ───────────────────────────────────────── */
        .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .kpi-card { background: white; border: 1px solid #EDEDED; border-radius: 8px; padding: 12px; text-align: center; }
        .kpi-value { font-size: 17px; font-weight: 900; color: #FF9500; }
        .kpi-label { font-size: 10px; color: #666; margin-top: 3px; }
        .kpi-time  { font-size: 9px; color: #BBB; margin-top: 2px; }

        /* ── Success metrics ────────────────────────────────── */
        .metric-cat-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 6px; }
        .metric-item { display: flex; align-items: center; justify-content: space-between; background: white; border: 1px solid #E8E8E8; border-radius: 8px; padding: 9px 12px; margin-bottom: 5px; }
        .metric-name { font-size: 11px; color: #333; }
        .metric-tf   { font-size: 10px; color: #aaa; }
        .metric-target { font-size: 13px; font-weight: 800; }

        /* ── Readiness checklist ────────────────────────────── */
        .check-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        .check-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid; border-radius: 7px; font-size: 11px; }
        .check-done    { background: #F0FFF4; border-color: #A7F3D0; color: #065F46; }
        .check-pending { background: #F9F9F9; border-color: #E8E8E8; color: #555; }
        .check-icon { flex-shrink: 0; font-weight: 700; }

        /* ── Assets ─────────────────────────────────────────── */
        .asset-section { margin-bottom: 12px; }
        .asset-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 6px; }
        .asset-item { display: flex; align-items: flex-start; gap: 6px; font-size: 11px; color: #444; margin-bottom: 4px; }

        /* ── Do Not Do ──────────────────────────────────────── */
        .dnd-item { display: flex; align-items: flex-start; gap: 8px; font-size: 12px; color: #555; padding: 7px 0; border-bottom: 1px solid #F0F0F0; }
        .dnd-item:last-child { border-bottom: none; }

        /* ── Calendar ───────────────────────────────────────── */
        .week-cal-header { font-size: 12px; font-weight: 700; color: #111; margin-bottom: 3px; padding-bottom: 6px; border-bottom: 1px solid #EDEDED; }
        .week-cal-theme  { font-size: 10px; color: #888; font-style: italic; margin-bottom: 8px; }
        .cal-row { display: flex; align-items: center; gap: 12px; padding: 6px 0; border-bottom: 1px solid #F7F7F7; font-size: 11px; }
        .cal-day      { color: #999; width: 58px; flex-shrink: 0; }
        .cal-platform { width: 76px; color: #888; flex-shrink: 0; }
        .cal-topic    { color: #333; flex: 1; }
        .cal-hook     { font-size: 10px; color: #FF9500; font-style: italic; display: block; margin-top: 2px; }
        .cal-type     { font-size: 10px; color: #888; background: #F0F0F0; padding: 2px 7px; border-radius: 20px; white-space: nowrap; }

        /* ── Item list ──────────────────────────────────────── */
        .item-list { list-style: none; }
        .item-list li { display: flex; align-items: flex-start; gap: 8px; padding: 6px 0; border-bottom: 1px solid #F0F0F0; font-size: 12px; color: #333; }
        .item-list li:last-child { border-bottom: none; }
        .item-arrow { color: #FF9500; font-weight: 700; flex-shrink: 0; margin-top: 1px; }

        /* ── Footer ─────────────────────────────────────────── */
        .doc-footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #EDEDED; display: flex; justify-content: space-between; align-items: center; }
        .footer-brand { font-size: 12px; font-weight: 800; color: #FF9500; letter-spacing: 0.1em; }
        .footer-text { font-size: 10px; color: #CCC; }

        /* ── Print button ───────────────────────────────────── */
        .print-btn { position: fixed; bottom: 28px; right: 28px; background: #FF9500; color: black; font-weight: 700; font-size: 14px; padding: 12px 24px; border: none; border-radius: 12px; cursor: pointer; box-shadow: 0 4px 16px rgba(255,149,0,0.3); z-index: 100; transition: background 0.15s; }
        .print-btn:hover { background: #FFB340; }
      `}</style>

      <button className="print-btn no-print" onClick={() => window.print()}>
        {ar ? '⬇ حفظ كملف PDF' : '⬇ Save as PDF'}
      </button>

      <div className="doc" dir={documentDir} lang={documentIsArabic ? 'ar' : 'en'}>

        {/* ══ HEADER ══════════════════════════════════════════════════════ */}
        <div className="doc-header">
          <div>
            <div className="brand">NEXUS AI</div>
            <div className="doc-title">{campaign.name}</div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
              <span style={{ textTransform: 'capitalize' }}>{campaign.goal?.toLowerCase()?.replace(/_/g, ' ')}</span>
              &nbsp;·&nbsp; {campaign.tone}
              {campaign.platforms?.length > 0 && (
                <>&nbsp;·&nbsp; {campaign.platforms.map(p => PLATFORM_LABELS[p] || p).join(', ')}</>
              )}
            </div>
          </div>
          <div className="doc-meta">
            <div style={{ fontWeight: 700, color: '#444' }}>Nexus AI — Content Plan</div>
            <div>{date}</div>
            {campaign.audience && (
              <div style={{ marginTop: 6, maxWidth: 220, textAlign: 'right', color: '#666' }}>
                Audience: {campaign.audience}
              </div>
            )}
          </div>
        </div>

        <div className={`delivery-state ${deliveryManifest?.state === 'READY_FOR_SCHEDULING' ? 'ready' : ''}`}>
          <div className="delivery-state-title">
            {deliveryManifest?.state === 'READY_FOR_SCHEDULING'
              ? (documentIsArabic ? 'حزمة معتمدة — جاهزة لقرار الجدولة' : 'Approved package — ready for scheduling decision')
              : deliveryManifest?.state === 'COPY_APPROVED'
                ? (documentIsArabic ? 'النص معتمد — الوسائط تحتاج مراجعة' : 'Copy approved — media review required')
                : deliveryManifest?.state === 'NO_CONTENT'
                  ? (documentIsArabic ? 'لا يوجد محتوى نهائي داخل الحزمة' : 'No final content in this package')
                  : (documentIsArabic ? 'مسودة مراجعة — غير معتمدة للتنفيذ' : 'Review draft — not approved for execution')}
          </div>
          <div className="delivery-state-meta">
            {deliveryManifest
              ? `${deliveryManifest.counts.copyApproved}/${deliveryManifest.counts.posts} ${documentIsArabic ? 'نصوص معتمدة' : 'copy approved'} · ${deliveryManifest.counts.mediaApproved}/${deliveryManifest.counts.posts} ${documentIsArabic ? 'وسائط معتمدة' : 'media approved'} · ${deliveryManifest.counts.providerPublicationVerified} ${documentIsArabic ? 'منشورات مثبتة بمعرّف مزود' : 'provider publications verified'}`
              : (documentIsArabic ? 'تعذّر تحميل دليل الاعتماد؛ يعامل هذا المستند كمسودة فقط.' : 'Approval evidence could not be loaded; treat this document as a draft only.')}
            <br />
            {documentIsArabic
              ? 'لا تثبت هذه الحزمة تصريح المنصة أو النشر أو الإنفاق أو الأداء.'
              : 'This package does not prove provider permission, publication, spend, or performance.'}
          </div>
        </div>

        {/* ══ NEXT BEST ACTION BANNER ═════════════════════════════════════ */}
        {strategy.nextBestAction && (
          <div className="next-action" style={{ marginBottom: 24 }}>
            <div className="next-action-icon">🚀</div>
            <div>
              <div className="next-action-label">Your Next Action</div>
              <div className="next-action-text">{strategy.nextBestAction}</div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            CHAPTER 01 — THE BRIEF
        ═════════════════════════════════════════════════════════════════════ */}
        {(strategy.diagnosis || businessObjective) && (
          <>
            <div className="chapter">
              <span className="chapter-num">01</span>
              <div className="chapter-line" />
              <span className="chapter-label">The Brief</span>
            </div>

            {/* Diagnosis */}
            {strategy.diagnosis && (
              <div className="block block-amber section">
                <div className="block-label amber">🔎 Marketing Diagnosis</div>
                <div className="block-body">{strategy.diagnosis}</div>

                {diagnosisDetails && (
                  <div className="diag-grid">
                    {[
                      { label: 'Stage',          value: diagnosisDetails.stage,               color: '#D97706' },
                      { label: 'Bottleneck',      value: diagnosisDetails.bottleneck,          color: '#EA580C' },
                      { label: 'Trust Gap',       value: diagnosisDetails.trustGap,            color: '#DC2626' },
                      { label: 'Main Risk',       value: diagnosisDetails.mainRisk,            color: '#DC2626' },
                      {
                        label: 'Paid Ads Ready',
                        value: diagnosisDetails.readyForPaidAds ? '✓ Yes' : '✗ Not yet',
                        color: diagnosisDetails.readyForPaidAds ? '#059669' : '#D97706',
                      },
                      diagnosisDetails.readyForPaidAdsReason
                        ? { label: 'Why', value: diagnosisDetails.readyForPaidAdsReason, color: '#666' }
                        : null,
                    ].filter(Boolean).map((item: any, i: number) => (
                      <div key={i} className="diag-cell">
                        <div className="cell-label">{item.label}</div>
                        <div className="cell-value" style={{ color: item.color, fontWeight: 600 }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Business Objective */}
            {businessObjective && (
              <div className="block block-indigo section">
                <div className="block-label indigo">🎯 Business Objective</div>
                <div className="grid-2">
                  {[
                    { label: '🏆 Business Goal',      value: businessObjective.primary },
                    { label: '📣 Marketing Goal',     value: businessObjective.marketing },
                    { label: '⚡ Conversion Action',  value: businessObjective.conversionAction },
                    { label: '👆 Expected Action',    value: businessObjective.expectedUserAction },
                    { label: '⏰ Why Now',            value: businessObjective.whyNow },
                    { label: '📅 Win in 30 Days',     value: businessObjective.successIn30Days },
                  ].filter(item => item.value).map((item, i) => (
                    <div key={i} className="grid-cell">
                      <div className="cell-label">{item.label}</div>
                      <div className="cell-value">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            CHAPTER 02 — THE STRATEGY
        ═════════════════════════════════════════════════════════════════════ */}
        {(strategy.keyMessage || strategy.positioning || strategy.differentiation || audienceSegmentsDetailed.length > 0 || audienceSegments.length > 0 || strategy.valueProps?.length > 0) && (
          <>
            <div className="chapter page-break">
              <span className="chapter-num">02</span>
              <div className="chapter-line" />
              <span className="chapter-label">The Strategy</span>
            </div>

            {/* Key Message */}
            {strategy.keyMessage && (
              <div className="key-message section">
                <div className="key-message-label">Core Message</div>
                <div className="key-message-text">"{strategy.keyMessage}"</div>
              </div>
            )}

            {/* Positioning + Differentiation */}
            {(strategy.positioning || strategy.differentiation) && (
              <div className="grid-2 section">
                {strategy.positioning && (
                  <div className="block" style={{ marginBottom: 0 }}>
                    <div className="block-label">🎯 Positioning</div>
                    <div className="block-body">{strategy.positioning}</div>
                  </div>
                )}
                {strategy.differentiation && (
                  <div className="block" style={{ marginBottom: 0 }}>
                    <div className="block-label">⚡ Differentiation</div>
                    <div className="block-body">{strategy.differentiation}</div>
                  </div>
                )}
              </div>
            )}

            {/* Audience Segments */}
            {(audienceSegmentsDetailed.length > 0 || audienceSegments.length > 0) && (
              <div className="block section">
                <div className="block-label">👥 Audience Segments</div>
                {audienceSegmentsDetailed.length > 0 ? (
                  <div style={{ marginTop: 8 }}>
                    {audienceSegmentsDetailed.map((seg: any, i: number) => (
                      <div key={i} className="seg-block">
                        <div style={{ marginBottom: 8 }}>
                          <span className="seg-num">#{i + 1}</span>
                          <span className="seg-name">{seg.segment}</span>
                        </div>
                        {seg.situation && (
                          <div style={{ fontSize: 11, color: '#555', marginBottom: 6 }}>
                            <span style={{ color: '#aaa', fontSize: 9, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.08em' }}>Situation: </span>
                            {seg.situation}
                          </div>
                        )}
                        <div className="seg-detail-grid">
                          {seg.pain && (
                            <div className="grid-cell" style={{ padding: '8px 10px' }}>
                              <div className="cell-label" style={{ color: '#DC2626' }}>Pain</div>
                              <div className="cell-value" style={{ fontSize: 11 }}>{seg.pain}</div>
                            </div>
                          )}
                          {seg.desiredOutcome && (
                            <div className="grid-cell" style={{ padding: '8px 10px' }}>
                              <div className="cell-label" style={{ color: '#059669' }}>Wants</div>
                              <div className="cell-value" style={{ fontSize: 11 }}>{seg.desiredOutcome}</div>
                            </div>
                          )}
                          {seg.objection && (
                            <div className="grid-cell" style={{ padding: '8px 10px' }}>
                              <div className="cell-label" style={{ color: '#D97706' }}>Objection</div>
                              <div className="cell-value" style={{ fontSize: 11 }}>{seg.objection}</div>
                            </div>
                          )}
                          {seg.message && (
                            <div className="grid-cell" style={{ padding: '8px 10px' }}>
                              <div className="cell-label" style={{ color: '#6366F1' }}>Message</div>
                              <div className="cell-value" style={{ fontSize: 11, fontWeight: 600 }}>{seg.message}</div>
                            </div>
                          )}
                        </div>
                        {(seg.platform || seg.format || seg.cta) && (
                          <div style={{ display: 'flex', gap: 12, marginTop: 8, paddingTop: 8, borderTop: '1px solid #F0F0F0', fontSize: 10, color: '#888' }}>
                            {seg.platform && <span>📱 {seg.platform}</span>}
                            {seg.format && <span>📄 {seg.format}</span>}
                            {seg.cta && <span style={{ color: '#FF9500', fontWeight: 700, marginLeft: 'auto' }}>→ {seg.cta}</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ marginTop: 8 }}>
                    {audienceSegments.map((seg: string, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: 8, padding: '8px 0', borderBottom: '1px solid #F0F0F0', fontSize: 12, color: '#333' }}>
                        <span style={{ color: '#FF9500', fontWeight: 700 }}>{i + 1}.</span> {seg}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Value Propositions */}
            {strategy.valueProps?.length > 0 && (
              <div className="block section">
                <div className="block-label">💎 Value Propositions</div>
                <ul className="item-list" style={{ marginTop: 6 }}>
                  {strategy.valueProps.map((vp: string, i: number) => (
                    <li key={i}><span className="item-arrow">→</span> {vp}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Top Hooks */}
            {topHooks.length > 0 && (
              <div className="block section">
                <div className="block-label">🎯 Top Hooks</div>
                <div style={{ marginTop: 8 }}>
                  {topHooks.map((hook: string, i: number) => (
                    <div key={i} className="hook-item">
                      <div className="hook-num">Hook {String(i + 1).padStart(2, '0')}</div>
                      <div className="hook-text">"{hook}"</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Content Angles */}
            {contentAnglesDetailed.length > 0 && (
              <div className="block section">
                <div className="block-label">📐 Content Angles</div>
                <div style={{ marginTop: 8 }}>
                  {contentAnglesDetailed.map((angle: any, i: number) => (
                    <div key={i} className="angle-block">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: '#6366F1', background: '#EEF2FF', padding: '2px 7px', borderRadius: 4 }}>
                          {angle.angle || angle.type || `Angle ${i + 1}`}
                        </span>
                        {angle.platform && (
                          <span style={{ fontSize: 10, color: '#888' }}>📱 {angle.platform}</span>
                        )}
                      </div>
                      {angle.hook && (
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#FF9500', fontStyle: 'italic', marginBottom: 4 }}>
                          "{angle.hook}"
                        </div>
                      )}
                      {angle.rationale && (
                        <div style={{ fontSize: 11, color: '#555', lineHeight: 1.6 }}>{angle.rationale}</div>
                      )}
                      {angle.example && (
                        <div style={{ fontSize: 10, color: '#888', marginTop: 5, fontStyle: 'italic' }}>
                          Example: {angle.example}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            CHAPTER 03 — EXECUTION PLAN
        ═════════════════════════════════════════════════════════════════════ */}
        {(funnelStages.length > 0 || strategy.funnelStrategy || channelStrategy.length > 0 || strategy.channelMix?.length > 0 || strategy.contentPillars?.length > 0 || strategy.offerCTAStrategy || strategy.visualDirection || weeklyExecutionPlan.length > 0 || weeklyPlan.length > 0 || ctaVariations.length > 0 || captionFormulas.length > 0) && (
          <>
            <div className="chapter page-break">
              <span className="chapter-num">03</span>
              <div className="chapter-line" />
              <span className="chapter-label">Execution Plan</span>
            </div>

            {/* Marketing Funnel */}
            {(funnelStages.length > 0 || strategy.funnelStrategy) && (
              <div className="block section">
                <div className="block-label">🔻 Marketing Funnel</div>
                {funnelStages.length > 0 ? (
                  <div style={{ marginTop: 8 }}>
                    {funnelStages.map((stage: any, i: number) => {
                      const stageClass: Record<string, string> = {
                        awareness: 'funnel-awareness',
                        consideration: 'funnel-consideration',
                        conversion: 'funnel-conversion',
                        followUp: 'funnel-followup',
                        follow_up: 'funnel-followup',
                      }
                      const stageIcons: Record<string, string> = {
                        awareness: '📢', consideration: '🤔', conversion: '✅', followUp: '🔄', follow_up: '🔄',
                      }
                      const cls = stageClass[stage.stage] || 'funnel-default'
                      return (
                        <div key={i} className={`funnel-stage ${cls}`}>
                          <div className="funnel-stage-title">
                            {stageIcons[stage.stage] || '📌'} {stage.stage?.toUpperCase()}
                            {stage.productArea && (
                              <span style={{ fontSize: 9, fontWeight: 400, color: '#888', marginLeft: 6, textTransform: 'none' }}>
                                ({stage.productArea})
                              </span>
                            )}
                          </div>
                          <div className="funnel-meta">
                            {stage.userMindset && (
                              <div className="grid-cell" style={{ padding: '6px 9px' }}>
                                <div className="cell-label">Mindset</div>
                                <div className="cell-value" style={{ fontSize: 11, fontStyle: 'italic' }}>{stage.userMindset}</div>
                              </div>
                            )}
                            {stage.message && (
                              <div className="grid-cell" style={{ padding: '6px 9px' }}>
                                <div className="cell-label">Message</div>
                                <div className="cell-value" style={{ fontSize: 11 }}>{stage.message}</div>
                              </div>
                            )}
                            {stage.contentType && (
                              <div className="grid-cell" style={{ padding: '6px 9px' }}>
                                <div className="cell-label">Format</div>
                                <div className="cell-value" style={{ fontSize: 11 }}>{stage.contentType}</div>
                              </div>
                            )}
                            {stage.platform && (
                              <div className="grid-cell" style={{ padding: '6px 9px' }}>
                                <div className="cell-label">Platform</div>
                                <div className="cell-value" style={{ fontSize: 11 }}>{stage.platform}</div>
                              </div>
                            )}
                            {stage.cta && (
                              <div className="grid-cell" style={{ padding: '6px 9px' }}>
                                <div className="cell-label">CTA</div>
                                <div className="cell-value" style={{ fontSize: 11, color: '#FF9500', fontWeight: 700 }}>{stage.cta}</div>
                              </div>
                            )}
                            {stage.successMetric && (
                              <div className="grid-cell" style={{ padding: '6px 9px' }}>
                                <div className="cell-label">Metric</div>
                                <div className="cell-value" style={{ fontSize: 11, color: '#059669' }}>{stage.successMetric}</div>
                              </div>
                            )}
                          </div>
                          {stage.nextStep && (
                            <div style={{ fontSize: 10, color: '#666', marginTop: 8, paddingTop: 6, borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                              → Next: {stage.nextStep}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : strategy.funnelStrategy && (
                  <div className="grid-2" style={{ marginTop: 8 }}>
                    {([
                      { key: 'awareness',     icon: '📢', label: 'Awareness',     color: '#2563EB' },
                      { key: 'consideration', icon: '🤔', label: 'Consideration', color: '#7C3AED' },
                      { key: 'conversion',    icon: '✅', label: 'Conversion',    color: '#059669' },
                      { key: 'retention',     icon: '🔄', label: 'Retention',     color: '#D97706' },
                    ] as const).map(({ key, icon, label, color }) => (
                      strategy.funnelStrategy[key] && (
                        <div key={key} className="grid-cell">
                          <div className="cell-label" style={{ color }}>{icon} {label}</div>
                          <div className="cell-value">{strategy.funnelStrategy[key]}</div>
                        </div>
                      )
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Channel Strategy */}
            {(channelStrategy.length > 0 || strategy.channelMix?.length > 0) && (
              <div className="block section">
                <div className="block-label">📡 Channel Strategy</div>
                <div style={{ marginTop: 8 }}>
                  {(channelStrategy.length > 0 ? channelStrategy : strategy.channelMix || []).map((ch: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid #F0F0F0' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#FF9500', minWidth: 90, textTransform: 'capitalize' }}>{ch.platform}</span>
                      <div style={{ flex: 1 }}>
                        {(ch.role || ch.rationale) && (
                          <div style={{ fontSize: 11, color: '#555', fontStyle: 'italic', marginBottom: 3 }}>{ch.role || ch.rationale}</div>
                        )}
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 10, color: '#888' }}>
                          {ch.contentType && <span>📄 {ch.contentType}</span>}
                          {ch.postingApproach && <span>{ch.postingApproach}</span>}
                          {ch.cta && <span style={{ color: '#FF9500', fontWeight: 600 }}>{ch.cta}</span>}
                        </div>
                      </div>
                      {ch.budgetPercent && (
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#FF9500' }}>{ch.budgetPercent}%</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Content Pillars */}
            {strategy.contentPillars?.length > 0 && (
              <div className="block section">
                <div className="block-label">📐 Content Pillars</div>
                <div className="pillars-grid" style={{ marginTop: 10 }}>
                  {strategy.contentPillars.map((p: string, i: number) => (
                    <div key={i} className="pillar">{p}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Offer & CTA Strategy */}
            {strategy.offerCTAStrategy && (
              <div className="block section">
                <div className="block-label">📣 Offer & CTA Strategy</div>
                <div style={{ marginTop: 8 }}>
                  {strategy.offerCTAStrategy.primaryCTA && (
                    <div className="cta-item" style={{ background: '#F4F3FF', borderColor: '#C7D2FE', marginBottom: 6 }}>
                      <span className="cta-arrow">→</span>
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#6366F1', minWidth: 80 }}>Primary CTA</span>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{strategy.offerCTAStrategy.primaryCTA}</span>
                    </div>
                  )}
                  {strategy.offerCTAStrategy.secondaryCTA && (
                    <div className="cta-item" style={{ marginBottom: 6 }}>
                      <span className="cta-arrow">→</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#888', minWidth: 80 }}>Secondary</span>
                      <span style={{ fontSize: 12 }}>{strategy.offerCTAStrategy.secondaryCTA}</span>
                    </div>
                  )}
                  {strategy.offerCTAStrategy.leadMagnet && (
                    <div className="cta-item" style={{ marginBottom: 6 }}>
                      <span className="cta-arrow">→</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#2563EB', minWidth: 80 }}>Lead Magnet</span>
                      <span style={{ fontSize: 12 }}>{strategy.offerCTAStrategy.leadMagnet}</span>
                    </div>
                  )}
                  {strategy.offerCTAStrategy.betaOffer && (
                    <div className="cta-item" style={{ marginBottom: 6 }}>
                      <span className="cta-arrow">→</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED', minWidth: 80 }}>Beta Offer</span>
                      <span style={{ fontSize: 12 }}>{strategy.offerCTAStrategy.betaOffer}</span>
                    </div>
                  )}
                  {strategy.offerCTAStrategy.contactFlow && (
                    <div className="cta-item">
                      <span className="cta-arrow">→</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#059669', minWidth: 80 }}>Contact Flow</span>
                      <span style={{ fontSize: 12 }}>{strategy.offerCTAStrategy.contactFlow}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Visual Direction */}
            {strategy.visualDirection && (
              <div className="block section" style={{ borderColor: '#DDD6FE', background: '#F5F3FF' }}>
                <div className="block-label" style={{ color: '#7C3AED' }}>🎨 Visual Direction</div>
                <div className="block-body">{strategy.visualDirection}</div>
              </div>
            )}

            {/* CTA Variations */}
            {ctaVariations.length > 0 && (
              <div className="block section">
                <div className="block-label">🎯 CTA Variations</div>
                <div style={{ marginTop: 8 }}>
                  {ctaVariations.map((cta: string, i: number) => (
                    <div key={i} className="cta-item">
                      <span className="cta-arrow">→</span> {cta}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Caption Formulas */}
            {captionFormulas.length > 0 && (
              <div className="block section">
                <div className="block-label">✍️ Caption Formulas</div>
                <div style={{ marginTop: 8 }}>
                  {captionFormulas.map((cap: string, i: number) => (
                    <div key={i} style={{ background: 'white', border: '1px solid #E8E8E8', borderRadius: 7, padding: '10px 13px', marginBottom: 7, fontSize: 11, color: '#444', lineHeight: 1.65 }}>{cap}</div>
                  ))}
                </div>
              </div>
            )}

            {/* 4-Week Execution Plan */}
            {(weeklyExecutionPlan.length > 0 || weeklyPlan.length > 0) && (
              <div className="block section">
                <div className="block-label">📅 4-Week Execution Plan</div>
                <div style={{ marginTop: 8 }}>
                  {(weeklyExecutionPlan.length > 0 ? weeklyExecutionPlan : weeklyPlan).map((w: any) => (
                    <div key={w.week} className="week-block">
                      <div className="week-header">
                        <span className="week-num">W{w.week}</span>
                        <span className="week-objective">{w.objective}</span>
                        {w.cta && <span className="week-cta">{w.cta}</span>}
                      </div>
                      <div className="week-body">
                        {w.keyMessage && (
                          <div className="week-message">"{w.keyMessage}"</div>
                        )}
                        {w.deliverables?.length > 0 && (
                          <div>
                            {w.deliverables.map((d: string, di: number) => (
                              <div key={di} className="week-deliverable">
                                <span className="week-arrow">→</span> {d}
                              </div>
                            ))}
                          </div>
                        )}
                        {(w.platforms?.length > 0 || w.successMetric) && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                            {w.platforms?.map((p: string, pi: number) => (
                              <span key={pi} style={{ fontSize: 10, background: '#F3F4F6', borderRadius: 4, padding: '2px 7px', color: '#666' }}>{p}</span>
                            ))}
                            {w.successMetric && (
                              <span className="week-metric" style={{ marginLeft: 'auto' }}>📈 {w.successMetric}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            CHAPTER 04 — METRICS & READINESS
        ═════════════════════════════════════════════════════════════════════ */}
        {(strategy.kpis?.length > 0 || successMetricsDetailed.length > 0 || readinessChecklist.length > 0 || assetRequirements || doNotDoYet.length > 0 || strategy.executionChecklist?.length > 0) && (
          <>
            <div className="chapter page-break">
              <span className="chapter-num">04</span>
              <div className="chapter-line" />
              <span className="chapter-label">Metrics &amp; Readiness</span>
            </div>

            {/* KPIs */}
            {strategy.kpis?.length > 0 && (
              <div className="block section">
                <div className="block-label">📊 KPIs</div>
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

            {/* Success Metrics Detailed */}
            {successMetricsDetailed.length > 0 && (
              <div className="block section">
                <div className="block-label">📈 Success Metrics</div>
                <div style={{ marginTop: 10 }}>
                  {(['lead', 'engagement', 'conversion', 'operational'] as const).map((cat) => {
                    const catMetrics = successMetricsDetailed.filter((m: any) => m.category === cat)
                    if (!catMetrics.length) return null
                    const catColors: Record<string, string> = {
                      lead: '#2563EB', engagement: '#DB2777',
                      conversion: '#059669', operational: '#D97706',
                    }
                    const catLabels: Record<string, string> = {
                      lead: 'Lead', engagement: 'Engagement',
                      conversion: 'Conversion', operational: 'Operational',
                    }
                    return (
                      <div key={cat} style={{ marginBottom: 12 }}>
                        <div className="metric-cat-label" style={{ color: catColors[cat] }}>{catLabels[cat]}</div>
                        <div className="grid-2" style={{ marginBottom: 0 }}>
                          {catMetrics.map((m: any, idx: number) => (
                            <div key={idx} className="metric-item">
                              <div>
                                <div className="metric-name">{m.metric}</div>
                                <div className="metric-tf">{m.timeframe}</div>
                              </div>
                              <div className="metric-target" style={{ color: catColors[cat] }}>{m.target}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Launch Readiness Checklist */}
            {readinessChecklist.length > 0 && (
              <div className="block block-green section">
                <div className="block-label green">✅ Launch Readiness Checklist</div>
                <div className="check-grid" style={{ marginTop: 8 }}>
                  {readinessChecklist.map((item: any, i: number) => (
                    <div key={i} className={`check-item ${item.done ? 'check-done' : 'check-pending'}`}>
                      <span className="check-icon">{item.done ? '✓' : '○'}</span>
                      <span>{item.label || item.item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Asset Requirements */}
            {assetRequirements && (
              <div className="block section">
                <div className="block-label">📦 Asset Requirements</div>
                <div className="grid-2" style={{ marginTop: 10 }}>
                  {assetRequirements.mustHave?.length > 0 && (
                    <div className="asset-section">
                      <div className="asset-label" style={{ color: '#DC2626' }}>✦ Must Have</div>
                      {assetRequirements.mustHave.map((a: string, i: number) => (
                        <div key={i} className="asset-item">
                          <span style={{ color: '#DC2626', flexShrink: 0 }}>✦</span> {a}
                        </div>
                      ))}
                    </div>
                  )}
                  {assetRequirements.niceToHave?.length > 0 && (
                    <div className="asset-section">
                      <div className="asset-label" style={{ color: '#D97706' }}>◦ Nice to Have</div>
                      {assetRequirements.niceToHave.map((a: string, i: number) => (
                        <div key={i} className="asset-item">
                          <span style={{ color: '#D97706', flexShrink: 0 }}>◦</span> {a}
                        </div>
                      ))}
                    </div>
                  )}
                  {assetRequirements.forAds?.length > 0 && (
                    <div className="asset-section">
                      <div className="asset-label" style={{ color: '#2563EB' }}>◦ For Paid Ads</div>
                      {assetRequirements.forAds.map((a: string, i: number) => (
                        <div key={i} className="asset-item">
                          <span style={{ color: '#2563EB', flexShrink: 0 }}>◦</span> {a}
                        </div>
                      ))}
                    </div>
                  )}
                  {assetRequirements.forProof?.length > 0 && (
                    <div className="asset-section">
                      <div className="asset-label" style={{ color: '#059669' }}>◦ Social Proof</div>
                      {assetRequirements.forProof.map((a: string, i: number) => (
                        <div key={i} className="asset-item">
                          <span style={{ color: '#059669', flexShrink: 0 }}>◦</span> {a}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {assetRequirements.nextToCreate?.length > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #EDEDED' }}>
                    <div className="asset-label" style={{ color: '#FF9500' }}>★ Create These First</div>
                    {assetRequirements.nextToCreate.map((a: string, i: number) => (
                      <div key={i} className="asset-item">
                        <span style={{ color: '#FF9500', fontWeight: 700, minWidth: 16 }}>{i + 1}.</span> {a}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Do Not Do Yet */}
            {doNotDoYet.length > 0 && (
              <div className="block section" style={{ borderColor: '#FCA5A5', background: '#FFF5F5' }}>
                <div className="block-label" style={{ color: '#DC2626' }}>🚫 Do Not Do Yet</div>
                <div style={{ marginTop: 6 }}>
                  {doNotDoYet.map((item: string, i: number) => (
                    <div key={i} className="dnd-item">
                      <span style={{ color: '#DC2626', flexShrink: 0 }}>✕</span> {item}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Execution Checklist (legacy fallback) */}
            {strategy.executionChecklist?.length > 0 && readinessChecklist.length === 0 && (
              <div className="block section">
                <div className="block-label">□ Launch Checklist</div>
                <ul className="item-list" style={{ marginTop: 6 }}>
                  {strategy.executionChecklist.map((item: string, i: number) => (
                    <li key={i}><span className="item-arrow">□</span> {item}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {/* Content Hub records are the only final post source of truth. */}
        {(contentPosts.length > 0 || contentPlanUnavailable) && (
          <>
            <div className="chapter page-break">
              <span className="chapter-num" style={{ fontSize: '20px' }}>✓</span>
              <div className="chapter-line" />
              <span className="chapter-label">
                {documentIsArabic ? 'منشورات Content Hub الحالية' : 'Current Content Hub Posts'}
              </span>
            </div>
            <div className="block section" style={{ borderColor: contentPlanUnavailable ? '#FCA5A5' : '#C7D2FE' }}>
              <div className="block-label" style={{ color: contentPlanUnavailable ? '#DC2626' : '#4F46E5' }}>
                {documentIsArabic ? 'مصدر الحقيقة النهائي للمنشورات' : 'Authoritative post source'}
              </div>
              {contentPlanUnavailable ? (
                <div className="block-body">
                  {documentIsArabic
                    ? 'تعذّر تحميل سجلات Content Hub؛ لا يعرض هذا المستند مسودات الاستراتيجية كأنها منشورات نهائية.'
                    : 'Content Hub records could not be loaded; this document will not present strategy drafts as final posts.'}
                </div>
              ) : contentPosts.map((post, index) => {
                const evidence = deliveryManifest?.posts.find(item => item.id === post.id)
                return (
                <div key={post.id} className="angle-block">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8, fontSize: 10, color: '#64748B' }}>
                    <strong style={{ color: '#4F46E5' }}>#{index + 1}</strong>
                    <span>{PLATFORM_LABELS[post.publishTarget || post.platform] || post.publishTarget || post.platform}</span>
                    <span>·</span>
                    <strong>{post.status}</strong>
                    <span>· {evidence?.copyApproved ? (documentIsArabic ? 'نص معتمد' : 'copy approved') : (documentIsArabic ? 'نص غير معتمد' : 'copy unapproved')}</span>
                    <span>· {evidence?.mediaApproved ? (documentIsArabic ? 'وسائط معتمدة' : 'media approved') : (documentIsArabic ? 'وسائط غير معتمدة' : 'media unapproved')}</span>
                    {post.scheduledAt && <span>· {new Date(post.scheduledAt).toLocaleDateString(documentIsArabic ? 'ar-EG' : 'en-US')}</span>}
                  </div>
                  <div className="block-body" style={{ whiteSpace: 'pre-wrap' }}>{post.caption}</div>
                </div>
              )})}
            </div>
          </>
        )}

        {/* The strategy calendar is a planning roadmap, never final post state. */}
        {calendar.length > 0 && (
          <>
            <div className="chapter">
              <span className="chapter-num" style={{ fontSize: '20px' }}>📅</span>
              <div className="chapter-line" />
              <span className="chapter-label">
                {documentIsArabic ? 'خارطة تخطيط الاستراتيجية — ليست حالة نشر' : 'Strategy Planning Roadmap — Not Post Status'}
              </span>
            </div>

            {calendar.map((week: any, wi: number) => (
              <div key={wi} className="block" style={{ marginBottom: 16 }}>
                <div className="week-cal-header">{week.week || `Week ${wi + 1}`}</div>
                {week.theme && <div className="week-cal-theme">{week.theme}</div>}
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
          </>
        )}

        {/* ══ FOOTER ══════════════════════════════════════════════════════ */}
        <div className="doc-footer">
          <div className="footer-brand">NEXUS AI</div>
          <div className="footer-text">Strategist · NEX · PULSE — Nexus AI Marketing OS · {date}</div>
        </div>

      </div>
    </>
  )
}
