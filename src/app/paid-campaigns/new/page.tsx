'use client'

/**
 * /paid-campaigns/new — Paid Planning Draft Builder
 *
 * 5-step wizard:
 *   1. Platform + Ad Account selection
 *   2. Objective + Budget + Planning Dates
 *   3. Paid planning strategy (Brand Brain powered)
 *   4. Ad copy drafts
 *   5. Review + Setup
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabaseClient'
import { useI18n } from '@/lib/i18n-context'

// ── Types ──────────────────────────────────────────────────────────────────
interface AdAccount {
  id: string
  platform: string
  platformAccountId: string
  platformAccountName: string | null
  businessName: string | null
  currency: string
  status: string
}

interface CopyVariant {
  id: string
  label: string
  angle: string
  primaryText: string
  headline: string
  description: string
  callToAction: string
  hook: string
}

interface WizardData {
  // Step 1
  platform: string
  adAccountId: string
  // Step 2
  name: string
  objective: string
  budgetType: string
  dailyBudget: string
  lifetimeBudget: string
  currency: string
  startDate: string
  endDate: string
  language: string
  // Step 3 — AI output
  aiStrategy: Record<string, unknown> | null
  // Step 4 — AI copy
  copyVariants: CopyVariant[]
  selectedVariantIds: string[]
  // Step 5
  destinationUrl: string
  utmCampaign: string
  // AI Assist
  aiSuggested: boolean
  aiSuggestionRationale: string
}

// ── Platform data ──────────────────────────────────────────────────────────
const PLATFORMS = [
  { id: 'META', label: 'Meta Ads', subEn: 'Facebook + Instagram', subAr: 'فيسبوك + إنستغرام', color: '#1877F2', badgeEn: 'Draft + API path', badgeAr: 'مسودة + مسار API' },
  { id: 'GOOGLE', label: 'Google Ads', subEn: 'Search, Display, P-Max', subAr: 'البحث، العرض، Performance Max', color: '#4285F4', badgeEn: 'Planning draft', badgeAr: 'مسودة تخطيط' },
  { id: 'TIKTOK', label: 'TikTok Ads', subEn: 'In-Feed, TopView, Spark', subAr: 'In-Feed وTopView وSpark', color: '#FF0050', badgeEn: 'Planning draft', badgeAr: 'مسودة تخطيط' },
  { id: 'LINKEDIN', label: 'LinkedIn Ads', subEn: 'Sponsored Content, InMail', subAr: 'محتوى ممول ورسائل InMail', color: '#0A66C2', badgeEn: 'Planning draft', badgeAr: 'مسودة تخطيط' },
]

const OBJECTIVES = [
  { id: 'TRAFFIC', labelEn: 'Traffic', labelAr: 'الزيارات', icon: '🔗', descEn: 'Drive people to your website', descAr: 'جذب زيارات مؤهلة إلى موقعك' },
  { id: 'CONVERSIONS', labelEn: 'Conversions', labelAr: 'التحويلات', icon: '💳', descEn: 'Get purchases, sign-ups, form fills', descAr: 'زيادة الشراء أو التسجيل أو إكمال النماذج' },
  { id: 'LEAD_GENERATION', labelEn: 'Leads', labelAr: 'العملاء المحتملون', icon: '📋', descEn: 'Collect leads with instant forms', descAr: 'جمع بيانات العملاء المحتملين عبر النماذج' },
  { id: 'BRAND_AWARENESS', labelEn: 'Awareness', labelAr: 'الوعي بالعلامة', icon: '📢', descEn: 'Reach people likely to remember you', descAr: 'الوصول إلى أشخاص يُرجح أن يتذكروا علامتك' },
  { id: 'ENGAGEMENT', labelEn: 'Engagement', labelAr: 'التفاعل', icon: '❤️', descEn: 'Boost post likes, comments, shares', descAr: 'زيادة الإعجابات والتعليقات والمشاركات' },
  { id: 'VIDEO_VIEWS', labelEn: 'Video Views', labelAr: 'مشاهدات الفيديو', icon: '▶️', descEn: 'Maximize video watch time', descAr: 'زيادة وقت مشاهدة الفيديو' },
]

// ── Step indicator ─────────────────────────────────────────────────────────
function StepBar({ step, total, locale }: { step: number; total: number; locale: string }) {
  const labels = locale === 'ar'
    ? ['المنصة', 'الميزانية', 'التخطيط', 'نصوص الإعلان', 'المراجعة']
    : ['Platform', 'Budget', 'Planning', 'Ad Copy', 'Review']
  return (
    <div className="mb-8 rounded-2xl border border-slate-200 bg-white/85 p-3 shadow-sm">
      <div className="flex items-center gap-0">
      {labels.map((label, i) => {
        const idx = i + 1
        const done = idx < step
        const active = idx === step
        return (
          <div key={i} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-9 h-9 rounded-2xl flex items-center justify-center text-[12px] font-black transition-all"
                style={{
                  background: done ? '#ECFDF5' : active ? '#EEF2FF' : '#F8FAFC',
                  border: done ? '1px solid rgba(16,185,129,0.24)' : active ? '1px solid rgba(94,92,230,0.35)' : '1px solid rgba(15,23,42,0.08)',
                  color: done ? '#059669' : active ? '#5E5CE6' : '#94a3b8',
                }}
              >
                {done ? '✓' : idx}
              </div>
              <span className="text-[10px] hidden sm:block"
                style={{ color: active ? '#F97316' : done ? '#059669' : '#94a3b8' }}>
                {label}
              </span>
            </div>
            {i < total - 1 && (
              <div className="flex-1 h-px mx-1 mb-4"
                style={{ background: done ? '#10B981' : '#e2e8f0' }} />
            )}
          </div>
        )
      })}
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function NewPaidCampaignPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth()
  const { locale } = useI18n()
  const router = useRouter()
  const isArabic = locale === 'ar'
  const copy = (ar: string, en: string) => isArabic ? ar : en

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [accounts, setAccounts] = useState<AdAccount[]>([])
  const [campaignId, setCampaignId] = useState<string | null>(null)

  const [previewVariantId, setPreviewVariantId] = useState<string | null>(null)
  const [aiSuggestLoading, setAiSuggestLoading] = useState(false)

  const [data, setData] = useState<WizardData>({
    platform: '',
    adAccountId: '',
    name: '',
    objective: 'TRAFFIC',
    budgetType: 'DAILY',
    dailyBudget: '',
    lifetimeBudget: '',
    currency: 'USD',
    startDate: '',
    endDate: '',
    language: 'en',
    aiStrategy: null,
    copyVariants: [],
    selectedVariantIds: [],
    destinationUrl: '',
    utmCampaign: '',
    aiSuggested: false,
    aiSuggestionRationale: '',
  })

  const set = (k: keyof WizardData, v: unknown) =>
    setData(prev => ({ ...prev, [k]: v }))

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/login')
  }, [authLoading, isAuthenticated, router])

  // Fetch ad accounts
  useEffect(() => {
    if (!user) return
    ;(async () => {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (!token) return
      try {
        const res = await fetch('/api/ad-accounts', { headers: { Authorization: `Bearer ${token}` } })
        if (res.ok) {
          const d = await res.json()
          setAccounts(d.accounts || [])
        }
      } catch { /* ok */ }
    })()
  }, [user])

  const getToken = async () => {
    const { data: session } = await supabase.auth.getSession()
    return session.session?.access_token || ''
  }

  // ── Step handlers ──────────────────────────────────────────────────────

  const handleStep2 = async () => {
    if (!data.name || !data.platform) {
      setError(copy('أكمل جميع الحقول المطلوبة.', 'Please fill all required fields.'))
      return
    }
    setLoading(true)
    setError('')
    try {
      const token = await getToken()
      const res = await fetch('/api/ad-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: data.name,
          platform: data.platform,
          adAccountId: data.adAccountId || undefined,
          objective: data.objective,
          budgetType: data.budgetType,
          dailyBudget: data.budgetType === 'DAILY' ? data.dailyBudget : undefined,
          lifetimeBudget: data.budgetType === 'LIFETIME' ? data.lifetimeBudget : undefined,
          currency: data.currency,
          startDate: data.startDate || undefined,
          endDate: data.endDate || undefined,
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || copy('تعذر إنشاء مسودة التخطيط.', 'Failed to create planning draft'))
      setCampaignId(result.campaign.id)
      setStep(3)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : copy('حدث خطأ أثناء إنشاء مسودة التخطيط.', 'Error creating planning draft'))
    } finally {
      setLoading(false)
    }
  }

  // ── AI Assist: let AI plan the campaign from Brand Brain ──────────────────
  const handleAiSuggest = async () => {
    setAiSuggestLoading(true)
    setError('')
    try {
      const token = await getToken()
      const res = await fetch('/api/ad-campaigns/ai-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || copy('تعذر إنشاء اقتراح التخطيط.', 'AI suggestion failed'))
      set('platform', result.platform || 'META')
      set('objective', result.objective || 'LEAD_GENERATION')
      set('dailyBudget', result.dailyBudget ? String(result.dailyBudget) : '')
      set('currency', result.currency || 'USD')
      set('name', result.name || '')
      set('language', result.language || 'en')
      set('aiSuggested', true)
      set('aiSuggestionRationale', result.rationale || '')
      setStep(2)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : copy('تعذر إنشاء اقتراح التخطيط.', 'AI suggestion failed'))
    } finally {
      setAiSuggestLoading(false)
    }
  }

  const handleGenerateStrategy = async () => {
    if (!campaignId) return
    setLoading(true)
    setError('')
    try {
      const token = await getToken()
      const res = await fetch(`/api/ad-campaigns/${campaignId}/generate-strategy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ language: data.language }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || copy('تعذر إنشاء استراتيجية التخطيط المدفوع.', 'Strategy generation failed'))
      set('aiStrategy', result.strategy)
      setStep(4)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : copy('حدث خطأ أثناء إنشاء الاستراتيجية.', 'Error generating strategy'))
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateCopy = async () => {
    if (!campaignId) return
    setLoading(true)
    setError('')
    try {
      const token = await getToken()
      const res = await fetch(`/api/ad-campaigns/${campaignId}/generate-copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ language: data.language }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || copy('تعذر إنشاء مسودات النصوص الإعلانية.', 'Copy generation failed'))
      const variants = (result.ads || []).map((ad: Record<string, unknown>) => ({
        id: ad.id as string,
        label: ad.name as string,
        angle: ad.aiAngle as string,
        primaryText: ad.primaryText as string,
        headline: ad.headline as string,
        description: ad.description as string,
        callToAction: ad.callToAction as string,
        hook: ad.aiHook as string,
      }))
      set('copyVariants', variants)
      set('selectedVariantIds', variants.slice(0, 2).map((v: CopyVariant) => v.id))
      setStep(4)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : copy('حدث خطأ أثناء إنشاء النصوص الإعلانية.', 'Error generating copy'))
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDraft = () => {
    if (campaignId) router.push(`/paid-campaigns/${campaignId}`)
  }

  const toggleVariant = (id: string) => {
    set('selectedVariantIds',
      data.selectedVariantIds.includes(id)
        ? data.selectedVariantIds.filter(v => v !== id)
        : [...data.selectedVariantIds, id]
    )
  }

  // ── Render steps ───────────────────────────────────────────────────────
  const renderStep = () => {
    switch (step) {
      // ── STEP 1: Platform + Account ─────────────────────────────────────
      case 1:
        return (
          <div>
            <h2 className="text-[18px] font-bold text-slate-950 mb-1">
              {copy('اختر منصة التخطيط المدفوع', 'Choose planning platform')}
            </h2>
            <p className="text-slate-500 text-[13px] mb-6">
              {copy('اختر المنصة التي ستُبنى عليها مسودة التخطيط. الاختيار لا ينشئ حملة على المنصة.', 'Select the advertising platform for this planning draft. This does not create a platform campaign.')}
            </p>

            {/* AI Assist Card */}
            <div className="mb-5 p-4 rounded-[14px] relative overflow-hidden"
              style={{ background: '#faf5ff', border: '1px solid rgba(109,40,217,0.15)' }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[14px]">⚡</span>
                    <span className="text-[13px] font-bold text-slate-950">{copy('اقترح تخطيطاً بالذكاء الاصطناعي', 'Let AI Suggest a Plan')}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                      style={{ background: '#ede9fe', color: '#6d28d9' }}>{copy('مجاني', 'FREE')}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {copy(
                      'يقرأ الذكاء الاصطناعي سياق Brand Brain ويقترح منصة وهدفاً وافتراض ميزانية واسم مسودة للمراجعة. لا يعتمد ميزانية ولا يطلق إعلاناً.',
                      'AI reads your Brand Brain and suggests a platform, objective, budget assumption, and draft name for review. It does not approve spend or launch ads.'
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAiSuggest}
                  disabled={aiSuggestLoading}
                  aria-label={copy('إنشاء اقتراح تخطيط بالذكاء الاصطناعي', 'Generate an AI planning suggestion')}
                  className="flex-shrink-0 px-4 py-2 rounded-xl text-[12px] font-bold text-white transition-all"
                  style={{
                    background: aiSuggestLoading ? '#e5e7eb' : '#6d28d9',
                    color: aiSuggestLoading ? '#94a3b8' : 'white',
                    cursor: aiSuggestLoading ? 'wait' : 'pointer',
                  }}
                >
                  {aiSuggestLoading ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin inline-block" />
                      {copy('جارٍ إعداد الاقتراح...', 'Planning...')}
                    </span>
                  ) : copy('اقتراح تخطيط', 'AI Suggest')}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 h-px" style={{ background: '#e2e8f0' }} />
              <span className="text-[11px] text-slate-400">{copy('أو اختر يدوياً', 'or choose manually')}</span>
              <div className="flex-1 h-px" style={{ background: '#e2e8f0' }} />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {PLATFORMS.map(p => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => set('platform', p.id)}
                  aria-pressed={data.platform === p.id}
                  className="relative flex flex-col items-start gap-1.5 p-4 rounded-[14px] text-left transition-all"
                  style={{
                    background: data.platform === p.id
                      ? `rgba(${p.color === '#1877F2' ? '24,119,242' : p.color === '#4285F4' ? '66,133,244' : '255,0,80'},0.06)`
                      : '#fff',
                    border: data.platform === p.id
                      ? `1px solid ${p.color}`
                      : '1px solid rgba(15,23,42,0.08)',
                    cursor: 'pointer',
                  }}
                >
                  {data.platform !== p.id && (
                    <span className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded"
                      style={{ background: p.id === 'META' ? 'rgba(24,119,242,0.08)' : '#f1f5f9', color: p.id === 'META' ? '#1877F2' : '#64748b' }}>
                      {isArabic ? p.badgeAr : p.badgeEn}
                    </span>
                  )}
                  <span className="text-[13px] font-bold" style={{ color: '#0f172a' }}>
                    {p.label}
                  </span>
                  <span className="text-[11px] text-slate-500">{isArabic ? p.subAr : p.subEn}</span>
                  {data.platform === p.id && (
                    <span className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full font-bold"
                      style={{ background: p.color, color: 'white' }}>✓</span>
                  )}
                </button>
              ))}
            </div>

            {/* Ad Account selection */}
            {data.platform && (
              <div>
                <label className="text-[12px] text-slate-500 block mb-2 font-medium">
                  {copy('الحساب الإعلاني', 'Ad Account')} {accounts.filter(a => a.platform === data.platform).length === 0 && (
                    <span className="text-orange-600 ml-1">— {copy('لا يوجد حساب متصل حتى الآن', 'no connected account yet')}</span>
                  )}
                </label>
                {accounts.filter(a => a.platform === data.platform).length > 0 ? (
                  <div className="space-y-2">
                    {accounts.filter(a => a.platform === data.platform).map(acc => (
                      <button
                        type="button"
                        key={acc.id}
                        onClick={() => set('adAccountId', acc.id)}
                        aria-pressed={data.adAccountId === acc.id}
                        className="w-full flex items-center justify-between p-3 rounded-xl text-left transition-all"
                        style={{
                          background: data.adAccountId === acc.id ? 'rgba(5,150,105,0.06)' : '#fff',
                          border: data.adAccountId === acc.id ? '1px solid #059669' : '1px solid rgba(15,23,42,0.08)',
                        }}
                      >
                        <div>
                          <p className="text-[13px] font-medium text-slate-950">
                            {acc.platformAccountName || acc.platformAccountId}
                          </p>
                          <p className="text-[11px] text-slate-500">{acc.currency} · {acc.status}</p>
                        </div>
                        {data.adAccountId === acc.id && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full"
                            style={{ background: '#10B981', color: 'white' }}>{copy('محدد', 'Selected')}</span>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl text-[12px] text-slate-500"
                    style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)' }}>
                    {copy(`لا يوجد حساب إعلاني متصل بمنصة ${data.platform}.`, `No ${data.platform} ad account connected.`)}{' '}
                    <button type="button" className="text-orange-400 underline" onClick={() => router.push('/connections')}>
                      {copy('افتح التكاملات', 'Connect one')}
                    </button>
                    <br />
                    <span className="text-[11px] opacity-70">
                      {copy('يمكنك إعداد مسودة التخطيط الآن، لكن إنشاء مسودة منصة أو تفعيلها سيظل مقفلاً حتى ربط الحساب والتحقق من الصلاحيات.', 'You can prepare the planning draft now, but platform draft creation and activation remain locked until the account and permissions are verified.')}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 mt-8">
              <button type="button" onClick={() => router.push('/paid-campaigns')}
                className="px-4 py-2.5 rounded-xl text-[13px] font-medium text-slate-500 hover:text-slate-950 transition-all"
                style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.1)' }}>
                {copy('إلغاء', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={!data.platform}
                onClick={() => setStep(2)}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all"
                style={{
                  background: data.platform ? '#F97316' : '#e2e8f0',
                  color: data.platform ? 'white' : '#94a3b8',
                  cursor: data.platform ? 'pointer' : 'not-allowed',
                }}
              >
                {copy('متابعة', 'Continue')}
              </button>
            </div>
          </div>
        )

      // ── STEP 2: Budget + Objective ─────────────────────────────────────
      case 2: {
        // Client-side budget estimate (MENA CPM benchmarks)
        const CPM_BENCH: Record<string, { min: number; max: number }> = {
          META: { min: 1.5, max: 5 }, GOOGLE: { min: 0.8, max: 3.5 },
          TIKTOK: { min: 2, max: 7 }, LINKEDIN: { min: 20, max: 55 },
        }
        const bench = CPM_BENCH[data.platform] || { min: 3, max: 8 }
        const planningBudget = parseFloat(data.budgetType === 'DAILY' ? data.dailyBudget : data.lifetimeBudget) || 0
        const totalEst = data.budgetType === 'DAILY' ? planningBudget * 14 : planningBudget
        const hasComparableBenchmark = data.currency === 'USD'
        const impMin = Math.round((totalEst / bench.max) * 1000)
        const impMax = Math.round((totalEst / bench.min) * 1000)
        const reachMin = Math.round(impMin / 2.5)
        const reachMax = Math.round(impMax / 1.5)

        return (
          <div>
            <h2 className="text-[18px] font-bold text-slate-950 mb-1">{copy('تفاصيل مسودة التخطيط', 'Planning Draft Details')}</h2>
            <p className="text-slate-500 text-[13px] mb-6">
              {copy('سمِّ المسودة وأدخل هدفاً وافتراض ميزانية للمراجعة. هذه القيم لا تعني اعتماد الإنفاق.', 'Name the draft and enter an objective and budget assumption for review. These values do not approve spend.')}
            </p>

            {/* AI Suggestion banner */}
            {data.aiSuggested && data.aiSuggestionRationale && (
              <div className="mb-4 p-3 rounded-xl text-[11px]"
                style={{ background: '#faf5ff', border: '1px solid rgba(109,40,217,0.2)' }}>
                <span className="font-bold" style={{ color: '#6d28d9' }}>⚡ {copy('اقتراح تخطيطي:', 'Planning suggestion:')} </span>
                <span className="text-slate-500">{data.aiSuggestionRationale}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Campaign name */}
              <div>
                <label className="block text-[12px] font-medium text-slate-500 mb-1.5">{copy('اسم مسودة التخطيط *', 'Planning Draft Name *')}</label>
                <input
                  value={data.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder={copy('مثال: حملة الصيف 2025 — Meta', 'e.g. Summer Sale 2025 — Meta')}
                  className="w-full px-3 py-2.5 rounded-xl text-[13px] text-slate-950 placeholder:text-slate-400 focus:outline-none transition-all"
                  style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.12)' }}
                />
              </div>

              {/* Objective */}
              <div>
                <label className="block text-[12px] font-medium text-slate-500 mb-2">{copy('هدف التخطيط *', 'Planning Objective *')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {OBJECTIVES.map(obj => (
                    <button
                      type="button"
                      key={obj.id}
                      onClick={() => set('objective', obj.id)}
                      aria-pressed={data.objective === obj.id}
                      className="flex flex-col items-start gap-1 p-3 rounded-xl text-left transition-all"
                      style={{
                        background: data.objective === obj.id ? '#fff7ed' : '#fff',
                        border: data.objective === obj.id ? '1px solid #F97316' : '1px solid rgba(15,23,42,0.08)',
                      }}
                    >
                      <span className="text-base">{obj.icon}</span>
                      <span className="text-[12px] font-semibold text-slate-950">{isArabic ? obj.labelAr : obj.labelEn}</span>
                      <span className="text-[10px] text-slate-500 leading-tight">{isArabic ? obj.descAr : obj.descEn}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Budget */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-slate-500 mb-1.5">{copy('نوع افتراض الميزانية', 'Budget Assumption Type')}</label>
                  <select
                    value={data.budgetType}
                    onChange={e => set('budgetType', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-[13px] text-slate-950 focus:outline-none"
                    style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.12)' }}
                  >
                    <option value="DAILY">{copy('ميزانية يومية مفترضة', 'Daily budget assumption')}</option>
                    <option value="LIFETIME">{copy('ميزانية إجمالية مفترضة', 'Lifetime budget assumption')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-slate-500 mb-1.5">
                    {data.budgetType === 'DAILY'
                      ? copy('الميزانية اليومية المفترضة', 'Daily budget assumption')
                      : copy('الميزانية الإجمالية المفترضة', 'Total budget assumption')}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400">{data.currency}</span>
                    <input
                      type="number"
                      min="1"
                      value={data.budgetType === 'DAILY' ? data.dailyBudget : data.lifetimeBudget}
                      onChange={e => set(data.budgetType === 'DAILY' ? 'dailyBudget' : 'lifetimeBudget', e.target.value)}
                      placeholder={copy('افتراض للمراجعة', 'Planning assumption')}
                      className="w-full pl-12 pr-3 py-2.5 rounded-xl text-[13px] text-slate-950 focus:outline-none"
                      style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.12)' }}
                    />
                  </div>
                </div>
              </div>

              {/* Currency */}
              <div>
                <label className="block text-[12px] font-medium text-slate-500 mb-1.5">{copy('العملة', 'Currency')}</label>
                <select
                  value={data.currency}
                  onChange={e => set('currency', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-[13px] text-slate-950 focus:outline-none"
                  style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.12)' }}
                >
                  <option value="USD">USD — {copy('دولار أمريكي', 'US Dollar')}</option>
                  <option value="SAR">SAR — {copy('ريال سعودي', 'Saudi Riyal')}</option>
                  <option value="AED">AED — {copy('درهم إماراتي', 'UAE Dirham')}</option>
                  <option value="EGP">EGP — {copy('جنيه مصري', 'Egyptian Pound')}</option>
                  <option value="EUR">EUR — {copy('يورو', 'Euro')}</option>
                  <option value="GBP">GBP — {copy('جنيه إسترليني', 'British Pound')}</option>
                </select>
              </div>

              {/* Budget estimate */}
              {planningBudget > 0 && (
                <div className="p-3 rounded-xl"
                  style={{ background: '#fff7ed', border: '1px solid rgba(249,115,22,0.2)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#c2410c' }}>
                    {copy(
                      data.budgetType === 'DAILY' ? 'تقدير تخطيطي لمدة 14 يوماً — افتراضات مرجعية' : 'تقدير تخطيطي للميزانية الإجمالية — افتراضات مرجعية',
                      data.budgetType === 'DAILY' ? 'Planning estimate (14 days · benchmark assumptions)' : 'Planning estimate (lifetime budget · benchmark assumptions)'
                    )}
                  </p>
                  {hasComparableBenchmark ? (
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-[11px] text-slate-500">{copy('الوصول التقديري', 'Estimated reach')}</p>
                        <p className="text-[12px] font-bold text-slate-950">{(reachMin/1000).toFixed(0)}K–{(reachMax/1000).toFixed(0)}K</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500">{copy('مرات الظهور التقديرية', 'Estimated impressions')}</p>
                        <p className="text-[12px] font-bold text-slate-950">{(impMin/1000).toFixed(0)}K–{(impMax/1000).toFixed(0)}K</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500">CPM</p>
                        <p className="text-[12px] font-bold text-slate-950">${bench.min}–${bench.max}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500">
                      {copy('لن نعرض توقع وصول غير موثوق قبل توفر معيار تكلفة متوافق مع العملة المختارة.', 'Reach projections are withheld until a benchmark matching the selected currency is available.')}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-500 mt-2">
                    {copy('هذا ليس إنفاقاً معتمداً. يجب تأكيد الميزانية والتتبع والإبداع وجاهزية المنصة قبل أي إطلاق أو إنفاق.', 'This is not approved spend. Confirm budget, tracking, creative, and platform readiness before any ad launch or spend.')}
                  </p>
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-slate-500 mb-1.5">{copy('تاريخ البدء التخطيطي (اختياري)', 'Planning start date (optional)')}</label>
                  <input
                    type="date"
                    value={data.startDate}
                    onChange={e => set('startDate', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-[13px] text-slate-950 focus:outline-none"
                    style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.12)' }}
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-slate-500 mb-1.5">{copy('تاريخ الانتهاء التخطيطي (اختياري)', 'Planning end date (optional)')}</label>
                  <input
                    type="date"
                    value={data.endDate}
                    onChange={e => set('endDate', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-[13px] text-slate-950 focus:outline-none"
                    style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.12)' }}
                  />
                </div>
              </div>

              {/* AI Output Language */}
              <div>
                <label className="block text-[12px] font-medium text-slate-500 mb-2">
                  {copy('لغة مخرجات الذكاء الاصطناعي', 'AI Output Language')}
                  <span className="ml-1 text-[10px] text-slate-400">— {copy('ستُكتب استراتيجية التخطيط والنصوص بهذه اللغة', 'planning strategy and ad copy will be written in this language')}</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'en', label: copy('🇺🇸 الإنجليزية', '🇺🇸 English'), desc: copy('للسوق العالمي أو الإنجليزي', 'Global / EN market') },
                    { id: 'ar', label: copy('🇸🇦 العربية', '🇸🇦 Arabic'), desc: copy('للشرق الأوسط والخليج', 'MENA / Gulf market') },
                    { id: 'bilingual', label: copy('⚡ ثنائي اللغة', '⚡ Bilingual'), desc: copy('تُحدد اللغة حسب كل نسخة إعلانية', 'Language selected per ad draft') },
                  ].map(lang => (
                    <button
                      type="button"
                      key={lang.id}
                      onClick={() => set('language', lang.id)}
                      aria-pressed={data.language === lang.id}
                      className="flex flex-col items-start gap-0.5 p-3 rounded-xl text-left transition-all"
                      style={{
                        background: data.language === lang.id ? 'rgba(5,150,105,0.06)' : '#fff',
                        border: data.language === lang.id ? '1px solid #059669' : '1px solid rgba(15,23,42,0.08)',
                      }}
                    >
                      <span className="text-[12px] font-semibold text-slate-950">{lang.label}</span>
                      <span className="text-[10px] text-slate-500">{lang.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button type="button" onClick={() => setStep(1)}
                className="px-4 py-2.5 rounded-xl text-[13px] font-medium text-slate-500 hover:text-slate-950 transition-all"
                style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.1)' }}>
                {copy('الرجوع', 'Back')}
              </button>
              <button
                type="button"
                disabled={!data.name || loading}
                onClick={handleStep2}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all"
                style={{
                  background: data.name ? '#F97316' : '#e2e8f0',
                  color: data.name ? 'white' : '#94a3b8',
                  cursor: data.name && !loading ? 'pointer' : 'not-allowed',
                }}
              >
                {loading ? copy('جارٍ حفظ المسودة...', 'Saving...') : copy('حفظ مسودة التخطيط والمتابعة', 'Save planning draft & continue')}
              </button>
            </div>
          </div>
        )
      }

      // ── STEP 3: AI Strategy ─────────────────────────────────────────────
      case 3: {
        const strategy = data.aiStrategy
        return (
          <div>
            <h2 className="text-[18px] font-bold text-slate-950 mb-1">{copy('استراتيجية التخطيط المدفوع', 'Paid Planning Strategy')}</h2>
            <p className="text-slate-500 text-[13px] mb-6">
              {copy(
                'يستخدم NEXUS سياق Brand Brain لإعداد استهداف جمهور وملاحظات ميزانية وموجز إبداعي للمراجعة فقط.',
                'NEXUS uses your Brand Brain context to prepare audience targeting, budget notes, and a creative brief for review only.'
              )}
            </p>

            {!strategy ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: '#fff7ed', border: '1px solid rgba(249,115,22,0.2)' }}>
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <path d="M14 4C8.5 4 4 8.5 4 14s4.5 10 10 10 10-4.5 10-10S19.5 4 14 4z" stroke="#F97316" strokeWidth="1.5"/>
                    <path d="M10 14h4l3-5" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p className="text-slate-950 font-medium mb-2">{copy('جاهز لإنشاء استراتيجية تخطيط مدفوع', 'Ready to generate your paid planning strategy')}</p>
                <p className="text-slate-500 text-[12px] mb-6 max-w-xs mx-auto">
                  {copy(
                    'يستخدم بيانات Brand Brain وهدف الحملة وافتراض الميزانية والمنصة لإنتاج استراتيجية قابلة للمراجعة. لا ينشئ حملة منصة ولا يعتمد إنفاقاً.',
                    'Uses Brand Brain data, campaign objective, budget assumption, and platform to produce a reviewable strategy. It does not create a platform campaign or approve spend.'
                  )}
                </p>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleGenerateStrategy}
                  aria-label={copy('إنشاء استراتيجية التخطيط مقابل رصيدين', 'Generate planning strategy for 2 credits')}
                  className="px-6 py-3 rounded-xl text-[13px] font-bold text-white transition-all"
                  style={{ background: loading ? '#e5e7eb' : '#6d28d9', color: loading ? '#94a3b8' : 'white' }}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                      {copy('جارٍ إنشاء الاستراتيجية...', 'Generating strategy...')}
                    </span>
                  ) : copy('إنشاء استراتيجية التخطيط — رصيدان', 'Generate planning strategy — 2 credits')}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Positioning */}
                {(strategy.positioning as Record<string, unknown>) && (
                  <div className="p-4 rounded-[12px]"
                    style={{ background: '#faf5ff', border: '1px solid rgba(109,40,217,0.15)' }}>
                    <h3 className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: '#6d28d9' }}>{copy('التموضع التخطيطي', 'Planning Positioning')}</h3>
                    <p className="text-[13px] text-slate-950 font-medium mb-1">
                      {String((strategy.positioning as Record<string, unknown>)?.core_message || '')}
                    </p>
                    <p className="text-[12px] text-slate-500">
                      {String((strategy.positioning as Record<string, unknown>)?.value_proposition || '')}
                    </p>
                  </div>
                )}

                {/* Audience */}
                {(strategy.audience as Record<string, unknown>) && (
                  <div className="p-4 rounded-[12px]"
                    style={{ background: 'rgba(5,150,105,0.05)', border: '1px solid rgba(5,150,105,0.15)' }}>
                    <h3 className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: '#059669' }}>{copy('الجمهور المستهدف', 'Target Audience')}</h3>
                    <p className="text-[13px] text-slate-950 font-medium">
                      {String(((strategy.audience as Record<string, unknown>)?.primary_segment as Record<string, unknown>)?.description || '')}
                    </p>
                  </div>
                )}

                {/* Budget plan */}
                {(strategy.budget_plan as Record<string, unknown>) && (
                  <div className="p-4 rounded-[12px]"
                    style={{ background: '#fff7ed', border: '1px solid rgba(249,115,22,0.2)' }}>
                    <h3 className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: '#c2410c' }}>{copy('خطة الميزانية الافتراضية', 'Budget Assumption Plan')}</h3>
                    <p className="text-[12px] text-slate-500 mb-2">
                      {String((strategy.budget_plan as Record<string, unknown>)?.expected_results || '')}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-center">
                        <p className="text-[11px] text-slate-500">{copy('الوصول التقديري', 'Estimated reach')}</p>
                        <p className="text-[13px] font-bold text-slate-950">
                          {(() => {
                            const r = (strategy.budget_plan as Record<string, unknown>)?.estimated_reach as Record<string, number> | undefined
                            return r ? `${(r.min / 1000).toFixed(0)}K – ${(r.max / 1000).toFixed(0)}K` : '—'
                          })()}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[11px] text-slate-500">{copy('مرات الظهور التقديرية', 'Estimated impressions')}</p>
                        <p className="text-[13px] font-bold text-slate-950">
                          {(() => {
                            const i = (strategy.budget_plan as Record<string, unknown>)?.estimated_impressions as Record<string, number> | undefined
                            return i ? `${(i.min / 1000).toFixed(0)}K – ${(i.max / 1000).toFixed(0)}K` : '—'
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 mt-8">
              <button type="button" onClick={() => setStep(2)}
                className="px-4 py-2.5 rounded-xl text-[13px] font-medium text-slate-500 hover:text-slate-950 transition-all"
                style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.1)' }}>
                {copy('الرجوع', 'Back')}
              </button>
              {strategy && (
                <button
                  type="button"
                  onClick={handleGenerateCopy}
                  disabled={loading}
                  aria-label={copy('إنشاء مسودات النصوص الإعلانية مقابل رصيدين', 'Generate ad copy drafts for 2 credits')}
                  className="flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all"
                  style={{ background: loading ? '#e2e8f0' : '#F97316', color: loading ? '#94a3b8' : 'white' }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                      {copy('جارٍ إنشاء النصوص...', 'Generating copy...')}
                    </span>
                ) : copy('إنشاء مسودات النصوص الإعلانية — رصيدان', 'Generate ad copy drafts — 2 credits')}
                </button>
              )}
            </div>
          </div>
        )
      }

      // ── STEP 4: Copy Variants ──────────────────────────────────────────
      case 4:
        return (
          <div>
            <h2 className="text-[18px] font-bold text-slate-950 mb-1">{copy('مسودات النصوص الإعلانية', 'Ad Copy Drafts')}</h2>
            <p className="text-slate-500 text-[13px] mb-6">
              {copy(
                `أنشأ الذكاء الاصطناعي ${data.copyVariants.length} مسودة للمراجعة. حدد النسخ التي تريد الاحتفاظ بها داخل مسودة التخطيط.`,
                `AI generated ${data.copyVariants.length} drafts for review. Select the ones to keep in this planning draft.`
              )}
            </p>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {data.copyVariants.map(variant => {
                const isSelected = data.selectedVariantIds.includes(variant.id)
                const isPreviewing = previewVariantId === variant.id
                return (
                  <div key={variant.id} className="rounded-[12px] overflow-hidden transition-all"
                    style={{ border: isSelected ? '1px solid #F97316' : '1px solid rgba(15,23,42,0.08)' }}>

                    {/* ── Selection card ─────────────────────────────────────── */}
                    <div
                      onClick={() => toggleVariant(variant.id)}
                      className="w-full text-left p-4 transition-all"
                      style={{
                        background: isSelected ? '#fff7ed' : '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider"
                          style={{ color: isSelected ? '#F97316' : '#94a3b8' }}>
                          {variant.label}
                        </span>
                        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{
                            background: isSelected ? '#F97316' : 'transparent',
                            border: isSelected ? '1px solid #F97316' : '1px solid rgba(15,23,42,0.15)',
                          }}>
                          {isSelected && <span className="text-[10px] text-white">✓</span>}
                        </div>
                      </div>
                      <p className="text-[13px] font-semibold text-slate-950 mb-1">{variant.headline}</p>
                      <p className="text-[12px] text-slate-500 line-clamp-2 leading-relaxed">{variant.primaryText}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] px-2 py-0.5 rounded-full"
                          style={{ background: '#ede9fe', color: '#6d28d9' }}>
                          {variant.angle.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-slate-500">{variant.callToAction}</span>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setPreviewVariantId(isPreviewing ? null : variant.id) }}
                          aria-expanded={isPreviewing}
                          className="ml-auto text-[10px] px-2 py-0.5 rounded-full transition-all"
                          style={{
                            background: isPreviewing ? 'rgba(59,130,246,0.1)' : '#f8fafc',
                            color: isPreviewing ? '#2563eb' : '#64748b',
                            border: isPreviewing ? '1px solid rgba(59,130,246,0.25)' : '1px solid rgba(15,23,42,0.08)',
                          }}
                        >
                          {isPreviewing ? copy('إخفاء المعاينة', 'Hide preview') : copy('معاينة', 'Preview')}
                        </button>
                      </div>
                    </div>

                    {/* ── Facebook Feed Preview Mockup ──────────────────────── */}
                    {isPreviewing && (
                      <div style={{ background: '#f8fafc', borderTop: '1px solid rgba(15,23,42,0.06)', padding: '12px 12px 16px' }}>
                        <p className="text-center text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: '#6B7280' }}>
                          {data.platform === 'GOOGLE'
                            ? copy('معاينة بحث Google', 'Google Search Preview')
                            : data.platform === 'LINKEDIN'
                              ? copy('معاينة موجز LinkedIn', 'LinkedIn Feed Preview')
                              : copy('معاينة موجز Facebook', 'Facebook Feed Preview')}
                        </p>

                        {/* Google Search mockup */}
                        {data.platform === 'GOOGLE' ? (
                          <div style={{ background: '#fff', borderRadius: 8, padding: '12px 14px', maxWidth: 320, margin: '0 auto' }}>
                            <p style={{ fontSize: 10, color: '#006621', margin: '0 0 1px' }}>{copy('إعلان', 'Ad')} · yourbrand.com</p>
                            <p style={{ fontSize: 14, color: '#1a0dab', margin: '0 0 2px', fontWeight: 400, textDecoration: 'underline', cursor: 'default' }}>
                              {variant.headline}
                            </p>
                            <p style={{ fontSize: 12, color: '#545454', margin: 0, lineHeight: 1.4 }}>
                              {variant.description || variant.primaryText.slice(0, 100)}
                            </p>
                          </div>
                        ) : data.platform === 'LINKEDIN' ? (
                          /* LinkedIn mockup */
                          <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', maxWidth: 320, margin: '0 auto' }}>
                            <div style={{ padding: '10px 12px 8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <div style={{ width: 40, height: 40, borderRadius: 8, background: 'linear-gradient(135deg, #0A66C2, #004182)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>N</div>
                                <div>
                                  <p style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{copy('علامتك التجارية', 'Your Brand')}</p>
                                  <p style={{ fontSize: 10, color: '#666', margin: 0 }}>{copy('ممول', 'Promoted')} · 🌐</p>
                                </div>
                              </div>
                              <p style={{ fontSize: 12, color: '#1a1a1a', margin: '0 0 8px', lineHeight: 1.4 }}>
                                {variant.primaryText.length > 140 ? variant.primaryText.slice(0, 140) + '…' : variant.primaryText}
                              </p>
                            </div>
                            <div style={{ height: 130, background: 'linear-gradient(135deg, #e5e7eb, #d1d5db)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                              <span style={{ fontSize: 18 }}>🖼</span>
                              <span style={{ fontSize: 10, color: '#6b7280' }}>1200×627</span>
                            </div>
                            <div style={{ background: '#f3f2ef', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <p style={{ fontSize: 11, fontWeight: 600, color: '#1a1a1a', margin: '0 0 1px' }}>{variant.headline}</p>
                                {variant.description && <p style={{ fontSize: 10, color: '#666', margin: 0 }}>{variant.description}</p>}
                              </div>
                              <div style={{ fontSize: 11, fontWeight: 600, color: '#0A66C2', background: '#fff', border: '1px solid #0A66C2', borderRadius: 20, padding: '4px 10px', flexShrink: 0 }}>
                                {variant.callToAction.replace(/_/g, ' ')}
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* Facebook / Instagram Feed mockup */
                          <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', maxWidth: 320, margin: '0 auto' }}>
                            <div style={{ padding: '10px 12px 6px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #F97316, #EF4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>N</div>
                                <div>
                                  <p style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>{copy('علامتك التجارية', 'Your Brand')}</p>
                                  <p style={{ fontSize: 10, color: '#65676b', margin: 0 }}>{copy('ممول', 'Sponsored')} · 🌐</p>
                                </div>
                              </div>
                              <p style={{ fontSize: 12, color: '#1a1a1a', margin: 0, lineHeight: 1.4 }}>
                                {variant.primaryText.length > 150 ? variant.primaryText.slice(0, 150) + '…' : variant.primaryText}
                              </p>
                            </div>
                            <div style={{ height: 160, background: 'linear-gradient(135deg, #e5e7eb, #d1d5db)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                              <span style={{ fontSize: 22 }}>🖼</span>
                              <span style={{ fontSize: 10, color: '#6b7280' }}>{copy('مساحة أصل إعلاني', 'Ad creative placeholder')} (1080×1080)</span>
                            </div>
                            <div style={{ background: '#f0f2f5', padding: '8px 12px' }}>
                              <p style={{ fontSize: 11, fontWeight: 700, color: '#1a1a1a', margin: '0 0 2px' }}>{variant.headline}</p>
                              {variant.description && <p style={{ fontSize: 10, color: '#65676b', margin: 0 }}>{variant.description}</p>}
                            </div>
                            <div style={{ background: '#fff', padding: '8px 12px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e4e6ea' }}>
                              <div style={{ fontSize: 11, fontWeight: 600, color: '#1877F2', background: '#e7f3ff', border: '1px solid #b0c4de', borderRadius: 6, padding: '4px 12px' }}>
                                {variant.callToAction.replace(/_/g, ' ')}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setStep(3)}
                className="px-4 py-2.5 rounded-xl text-[13px] font-medium text-slate-500 hover:text-slate-950 transition-all"
                style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.1)' }}>
                {copy('الرجوع', 'Back')}
              </button>
              <button
                type="button"
                onClick={() => setStep(5)}
                disabled={data.selectedVariantIds.length === 0}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all"
                style={{
                  background: data.selectedVariantIds.length > 0 ? '#F97316' : '#e2e8f0',
                  color: data.selectedVariantIds.length > 0 ? 'white' : '#94a3b8',
                }}
              >
                {copy(
                  `المتابعة مع ${data.selectedVariantIds.length} من مسودات النصوص`,
                  `Continue with ${data.selectedVariantIds.length} variant${data.selectedVariantIds.length !== 1 ? 's' : ''}`
                )}
              </button>
            </div>
          </div>
        )

      // ── STEP 5: Review + Setup ─────────────────────────────────────────
      case 5:
        return (
          <div>
            <h2 className="text-[18px] font-bold text-slate-950 mb-1">{copy('المراجعة والخطوة التالية', 'Review & Next Step')}</h2>
            <p className="text-slate-500 text-[13px] mb-6">
              {copy('حُفظت مسودة التخطيط للمراجعة. لم يطلق NEXUS إعلاناً ولم يعتمد أو ينفق ميزانية.', 'Your paid planning draft is saved for review. NEXUS has not launched ads, approved spend, or spent budget.')}
            </p>

            {/* Summary card */}
            <div className="p-4 rounded-[14px] mb-6 space-y-3 bg-white"
              style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-slate-500">{copy('مسودة التخطيط', 'Planning draft')}</span>
                <span className="text-[13px] font-semibold text-slate-950">{data.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-slate-500">{copy('المنصة', 'Platform')}</span>
                <span className="text-[13px] font-semibold text-slate-950">{data.platform}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-slate-500">{copy('الهدف', 'Objective')}</span>
                <span className="text-[13px] font-semibold text-slate-950">
                  {(() => {
                    const objective = OBJECTIVES.find(item => item.id === data.objective)
                    return objective ? (isArabic ? objective.labelAr : objective.labelEn) : data.objective.replace(/_/g, ' ')
                  })()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-slate-500">{copy('افتراض الميزانية', 'Budget assumption')}</span>
                <span className="text-[13px] font-semibold text-slate-950">
                  {data.currency} {data.budgetType === 'DAILY'
                    ? copy(`${data.dailyBudget} يومياً`, `${data.dailyBudget}/day`)
                    : copy(`${data.lifetimeBudget} إجمالاً`, `${data.lifetimeBudget} total`)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-slate-500">{copy('مسودات الإعلان', 'Ad drafts')}</span>
                <span className="text-[13px] font-semibold text-slate-950">{copy(`${data.selectedVariantIds.length} محددة`, `${data.selectedVariantIds.length} selected`)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-slate-500">{copy('استراتيجية التخطيط', 'Planning strategy')}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(5,150,105,0.1)', color: '#059669' }}>
                  ✓ {copy('أُنشئت للمراجعة', 'Generated for review')}
                </span>
              </div>
            </div>

            {/* Next steps */}
            <div className="p-4 rounded-[12px] mb-6"
              style={{ background: '#fff7ed', border: '1px solid rgba(249,115,22,0.2)' }}>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: '#c2410c' }}>{copy('الخطوات التالية', 'Next Steps')}</p>
              <ul className="space-y-1.5 text-[12px] text-slate-500">
                <li>• {copy('افتح تفاصيل المسودة لمراجعة الاستهداف والافتراضات', 'Open the planning draft details to review targeting and assumptions')}</li>
                <li>• {copy('أضف الأصول الإبداعية المطلوبة للمراجعة', 'Add the required creative assets for review')}</li>
                <li>
                  • {data.platform === 'META'
                    ? copy('أنشئ مسودة Meta متوقفة فقط بعد اكتمال الجاهزية', 'Create paused Meta platform drafts only after readiness is confirmed')
                    : copy(`صدّر المسودة إلى مدير إعلانات ${data.platform} إلى أن يتوفر موصل API معتمد`, `Export to ${data.platform} Ads Manager until its approved API connector is enabled`)}
                </li>
                <li>• {copy('ابدأ تتبع الأداء فقط بعد وصول مقاييس حقيقية من المنصة؛ الإدخال اليدوي يبقى تقريراً تشغيلياً لا تعلماً آلياً', 'Track performance only after real platform metrics arrive; manual reporting remains an operational record, not machine learning')}</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(4)}
                className="px-4 py-2.5 rounded-xl text-[13px] font-medium text-slate-500 hover:text-slate-950 transition-all"
                style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.1)' }}>
                {copy('الرجوع', 'Back')}
              </button>
              <button
                type="button"
                onClick={handleOpenDraft}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all"
                style={{ background: '#059669' }}
              >
                {copy('فتح مسودة التخطيط المدفوع', 'Open paid planning draft')}
              </button>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  if (authLoading) {
    return (
      <AppShell>
        <div className="flex min-h-screen items-center justify-center bg-[#f6f8fc]">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
        </div>
      </AppShell>
    )
  }

  if (!isAuthenticated) return null

  return (
    <AppShell>
      <main className="min-h-screen bg-[#f6f8fc] text-[#071236]">
        <div className="mx-auto grid w-full max-w-[1540px] gap-6 px-4 py-6 pb-12 sm:px-6 lg:grid-cols-[minmax(0,780px)_360px] lg:px-8">
          <div className="lg:col-span-2">
            <LuxuryWorkspaceHeader
              pageTitle={locale === 'ar' ? 'مسودة تخطيط مدفوع' : 'Paid planning draft'}
              pageSubtitle={locale === 'ar' ? 'حوّل الاستراتيجية إلى خطة مدفوعة قابلة للمراجعة. لا يتم إنشاء حملة منصة أو إنفاق فعلي بدون موافقة لاحقة.' : 'Turn strategy into a reviewable paid plan. No platform campaign or real spend happens without later approval.'}
              primaryHref="/paid-campaigns"
              primaryLabel={locale === 'ar' ? 'مركز الإعلانات المدفوعة' : 'Paid campaigns'}
              secondaryHref="/connections"
              secondaryLabel={locale === 'ar' ? 'التكاملات' : 'Integrations'}
            />
          </div>

          {/* Header */}
          <div className="lg:col-span-2 flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_22px_70px_rgba(15,23,42,0.08)] sm:p-6">
            <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => router.push('/paid-campaigns')}
              aria-label={copy('العودة إلى مركز الإعلانات المدفوعة', 'Back to paid campaigns')}
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-slate-500 hover:text-slate-950 transition-all"
              style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.1)' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 2L4 7l5 5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div>
              <div className="mb-2 inline-flex rounded-full border border-orange-100 bg-orange-50 px-3 py-1 text-xs font-bold text-orange-600">
                {locale === 'ar' ? 'مسار موافقة مدفوع' : 'Approval-gated paid path'}
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950">
                {locale === 'ar' ? 'مسودة تخطيط مدفوع جديدة' : 'New Paid Planning Draft'}
              </h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                {locale === 'ar'
                  ? 'ابدأ بالمسودة، ثم أنشئ مسودة منصة متوقفة، ثم فعّل فقط بعد موافقة نهائية.'
                  : 'Start with a draft, create paused platform objects, then activate only after final approval.'}
              </p>
            </div>
            </div>
            <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
              {[
                locale === 'ar' ? 'لا إنفاق بدون موافقة' : 'No spend without approval',
                locale === 'ar' ? 'الميزانية افتراض تخطيطي' : 'Budget is a planning assumption',
                locale === 'ar' ? 'التحليلات بعد بيانات حقيقية' : 'Analytics after real data',
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 font-semibold">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="min-w-0">
          {/* Step bar */}
          <StepBar step={step} total={5} locale={locale} />

          {/* Card */}
          <div className="rounded-[26px] bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,0.06)]"
            style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
            {error && (
              <div className="mb-4 p-3 rounded-xl text-[12px]"
                style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#dc2626' }}>
                {error}
              </div>
            )}
            {renderStep()}
          </div>
          </div>

          <aside className="space-y-4 lg:pt-[92px]">
            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
              <p className="text-sm font-black text-slate-950">{locale === 'ar' ? 'حقيقة التنفيذ' : 'Execution truth'}</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {locale === 'ar'
                  ? 'هذه الصفحة تنشئ تخطيطاً أو مسودة مراجعة. لا يتم إطلاق إعلان، ولا صرف ميزانية، ولا تفعيل منصة إلا من شاشة تأكيد منفصلة.'
                  : 'This page creates planning or review drafts. No ad launches, budget spend, or platform activation happens without a separate confirmation screen.'}
              </p>
            </div>
            <div className="rounded-[24px] border border-indigo-100 bg-indigo-50/70 p-5">
              <p className="text-sm font-black text-slate-950">{locale === 'ar' ? 'مسار صحيح' : 'Correct path'}</p>
              <ol className="mt-3 space-y-3 text-sm text-slate-600">
                {(locale === 'ar'
                  ? ['اختيار المنصة والحساب', 'إدخال ميزانية كافتراض', 'إنشاء استراتيجية ونصوص للمراجعة', 'إنشاء مسودة منصة متوقفة لاحقاً', 'تفعيل فقط بعد موافقة صريحة']
                  : ['Choose platform and account', 'Enter budget as an assumption', 'Generate strategy and copy for review', 'Create paused platform draft later', 'Activate only after explicit approval']
                ).map((item, index) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-indigo-600">{index + 1}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        </div>
      </main>
    </AppShell>
  )
}
