'use client'

/**
 * /paid-campaigns/new — Strategy-linked Paid Execution Draft Builder
 *
 * 5-step wizard:
 *   1. Approved strategy + Platform + Ad Account selection
 *   2. Objective + Budget + Planning Dates
 *   3. Platform execution plan (approved strategy + Brand Brain powered)
 *   4. Ad copy drafts
 *   5. Review + Setup
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import WorkspaceRouteLoading from '@/components/WorkspaceRouteLoading'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabaseClient'
import { useI18n } from '@/lib/i18n-context'
import { normalizePaidDestinationUrl } from '@/lib/paidExecutionReadiness'
import { paidExecutionErrorMessage } from '@/lib/paidExecutionErrorMessage'
import {
  normalizePaidPlanningPlatform,
  normalizePaidPlanningRationale,
  selectSinglePaidPlanningAccount,
} from '@/lib/paidPlanningSuggestion'
import { paidPlatformSupportsObjective } from '@/lib/paidExecutionObjective'
import CreditConfirmModal from '@/components/CreditConfirmModal'
import { creditOperationScope, fetchCreditOperation } from '@/lib/creditOperationClient'
import { CREDIT_ACTION_COSTS } from '@/lib/creditActionTruth'

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

interface PaidStrategySource {
  id: string
  name: string
  goal: string
  executionObjective: 'TRAFFIC' | 'CONVERSIONS' | 'LEAD_GENERATION' | 'BRAND_AWARENESS' | 'ENGAGEMENT'
  status: string
  scope: 'organic' | 'paid' | 'full'
  approvalState: 'draft' | 'blocked' | 'ready_for_review' | 'approved' | 'revoked'
  eligible: boolean
  reason: 'READY' | 'STRATEGY_MISSING' | 'PAID_SCOPE_REQUIRED' | 'QUALITY_REVIEW_REQUIRED' | 'APPROVAL_REQUIRED'
  approvedPlatforms: Array<'META' | 'GOOGLE' | 'TIKTOK' | 'LINKEDIN'>
  planningOnlyPlatforms: string[]
  platformDecisionSource: 'paid_planning' | 'paid_channel_mix' | 'campaign_platforms' | 'missing'
  paidPackage: {
    audienceHypotheses: number
    adAngles: number
    adCopyVariations: number
    creativeBriefs: number
    complete: boolean
  }
  updatedAt: string | null
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
  { id: 'GOOGLE', label: 'Google Ads', subEn: 'Search only · paused review flow', subAr: 'البحث فقط · مسار مراجعة متوقف', color: '#4285F4', badgeEn: 'Draft + API path', badgeAr: 'مسودة + مسار API' },
  { id: 'TIKTOK', label: 'TikTok Ads', subEn: 'In-Feed, TopView, Spark', subAr: 'In-Feed وTopView وSpark', color: '#FF0050', badgeEn: 'Export package', badgeAr: 'حزمة تصدير' },
  { id: 'LINKEDIN', label: 'LinkedIn Ads', subEn: 'Sponsored Content, InMail', subAr: 'محتوى ممول ورسائل InMail', color: '#0A66C2', badgeEn: 'Export package', badgeAr: 'حزمة تصدير' },
]

const OBJECTIVES = [
  { id: 'TRAFFIC', labelEn: 'Traffic', labelAr: 'الزيارات', icon: '🔗', descEn: 'Drive people to your website', descAr: 'جذب زيارات مؤهلة إلى موقعك' },
  { id: 'CONVERSIONS', labelEn: 'Conversions', labelAr: 'التحويلات', icon: '💳', descEn: 'Get purchases, sign-ups, form fills', descAr: 'زيادة الشراء أو التسجيل أو إكمال النماذج' },
  { id: 'LEAD_GENERATION', labelEn: 'Leads', labelAr: 'العملاء المحتملون', icon: '📋', descEn: 'Collect leads with instant forms', descAr: 'جمع بيانات العملاء المحتملين عبر النماذج' },
  { id: 'BRAND_AWARENESS', labelEn: 'Awareness', labelAr: 'الوعي بالعلامة', icon: '📢', descEn: 'Reach people likely to remember you', descAr: 'الوصول إلى أشخاص يُرجح أن يتذكروا علامتك' },
  { id: 'ENGAGEMENT', labelEn: 'Engagement', labelAr: 'التفاعل', icon: '❤️', descEn: 'Boost post likes, comments, shares', descAr: 'زيادة الإعجابات والتعليقات والمشاركات' },
]

// ── Step indicator ─────────────────────────────────────────────────────────
function StepBar({ step, total, locale }: { step: number; total: number; locale: string }) {
  const labels = locale === 'ar'
    ? ['المصدر والمنصة', 'الميزانية', 'التنفيذ', 'نصوص الإعلان', 'المراجعة']
    : ['Source & platform', 'Budget', 'Execution', 'Ad Copy', 'Review']
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
  const { user, isAuthenticated, loading: authLoading, authHeader } = useAuth()
  const { locale } = useI18n()
  const router = useRouter()
  const isArabic = locale === 'ar'
  const copy = (ar: string, en: string) => isArabic ? ar : en

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [accounts, setAccounts] = useState<AdAccount[]>([])
  const [strategySources, setStrategySources] = useState<PaidStrategySource[]>([])
  const [selectedStrategyId, setSelectedStrategyId] = useState('')
  const [requestedStrategyId, setRequestedStrategyId] = useState('')
  const [strategySourcesLoading, setStrategySourcesLoading] = useState(true)
  const [campaignId, setCampaignId] = useState<string | null>(null)

  const [previewVariantId, setPreviewVariantId] = useState<string | null>(null)
  const [aiSuggestLoading, setAiSuggestLoading] = useState(false)
  const [creditConfirmation, setCreditConfirmation] = useState<'plan' | 'copy' | null>(null)

  const selectedStrategy = strategySources.find(source => source.id === selectedStrategyId) ?? null
  const requestedStrategy = strategySources.find(source => source.id === requestedStrategyId) ?? null
  const strategyReasonLabel = (source: PaidStrategySource) => {
    if (source.reason === 'READY') return copy('معتمدة وجاهزة للتنفيذ', 'Approved and execution-ready')
    if (source.reason === 'PAID_SCOPE_REQUIRED') return copy('استراتيجية Organic فقط', 'Organic-only strategy')
    if (source.reason === 'QUALITY_REVIEW_REQUIRED') return copy('تحتاج مراجعة جودة ناجحة', 'Quality review required')
    if (source.reason === 'APPROVAL_REQUIRED') return copy('تحتاج مراجعة واعتماد', 'Review and approval required')
    return copy('لا توجد استراتيجية مكتملة', 'Strategy output missing')
  }

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

  // Fetch platform accounts and the only allowed paid source: an approved
  // Paid/Full strategy. A query-string source is honored only when eligible.
  useEffect(() => {
    if (!user) return
    ;(async () => {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (!token) {
        setStrategySourcesLoading(false)
        return
      }
      try {
        const headers = { Authorization: `Bearer ${token}` }
        const [accountsRes, sourcesRes] = await Promise.all([
          fetch('/api/ad-accounts', { headers }),
          fetch('/api/paid-strategy-sources', { headers }),
        ])
        if (accountsRes.ok) {
          const accountsData = await accountsRes.json()
          setAccounts(accountsData.accounts || [])
        }
        if (sourcesRes.ok) {
          const sourcesData = await sourcesRes.json()
          const sources = (sourcesData.sources || []) as PaidStrategySource[]
          setStrategySources(sources)
          const requestedId = new URLSearchParams(window.location.search).get('sourceCampaignId')
          const requested = sources.find(source => source.id === requestedId)
          setRequestedStrategyId(requested?.id || '')
          const eligible = sources.filter(source => source.eligible)
          const initialSource = requested?.eligible ? requested : (eligible.length === 1 ? eligible[0] : null)
          setSelectedStrategyId(initialSource?.id || '')
          if (initialSource) {
            setData(previous => ({ ...previous, objective: initialSource.executionObjective }))
          }
        }
      } catch {
        setError(copy('تعذر تحميل مصادر الاستراتيجية أو حسابات المنصات.', 'Could not load strategy sources or platform accounts.'))
      } finally {
        setStrategySourcesLoading(false)
      }
    })()
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const getToken = async () => {
    const { data: session } = await supabase.auth.getSession()
    return session.session?.access_token || ''
  }

  const handlePlatformSelect = (platformValue: string) => {
    const platform = normalizePaidPlanningPlatform(platformValue)
    if (
      !selectedStrategy
      || !selectedStrategy.approvedPlatforms.includes(platform)
      || !paidPlatformSupportsObjective(platform, selectedStrategy.executionObjective)
    ) return
    const selectedAccount = selectSinglePaidPlanningAccount(accounts, platform)

    setData(previous => ({
      ...previous,
      platform,
      adAccountId: selectedAccount?.id || '',
      currency: selectedAccount?.currency || previous.currency,
      // A manual platform change invalidates the channel-specific AI rationale.
      aiSuggested: false,
      aiSuggestionRationale: '',
    }))
  }

  const handleStrategySelect = (sourceId: string) => {
    const source = strategySources.find(item => item.id === sourceId)
    if (!source?.eligible) return

    setSelectedStrategyId(sourceId)
    setCampaignId(null)
    setStep(1)
    setData(previous => ({
      ...previous,
      platform: '',
      adAccountId: '',
      name: '',
      objective: source.executionObjective,
      aiStrategy: null,
      copyVariants: [],
      selectedVariantIds: [],
      aiSuggested: false,
      aiSuggestionRationale: '',
    }))
  }

  // Accounts may arrive after the user chooses a platform. Keep the one-account
  // path deterministic without overriding an explicit account selection.
  useEffect(() => {
    if (!data.platform || data.adAccountId) return
    const platform = normalizePaidPlanningPlatform(data.platform)
    const selectedAccount = selectSinglePaidPlanningAccount(accounts, platform)
    if (!selectedAccount) return

    setData(previous => {
      if (previous.platform !== platform || previous.adAccountId) return previous
      return {
        ...previous,
        adAccountId: selectedAccount.id,
        currency: selectedAccount.currency || previous.currency,
      }
    })
  }, [accounts, data.adAccountId, data.platform])

  // ── Step handlers ──────────────────────────────────────────────────────

  const handleStep2 = async () => {
    if (!selectedStrategyId) {
      setError(copy('اختر استراتيجية Paid أو Full معتمدة أولاً.', 'Choose an approved Paid or Full strategy first.'))
      return
    }
    if (!data.name || !data.platform) {
      setError(copy('أكمل جميع الحقول المطلوبة.', 'Please fill all required fields.'))
      return
    }
    if (!data.adAccountId) {
      setError(copy('اربط حساباً إعلانياً نشطاً للمنصة قبل بدء التنفيذ.', 'Connect an active ad account for this platform before execution.'))
      return
    }
    const budgetValue = Number(data.budgetType === 'DAILY' ? data.dailyBudget : data.lifetimeBudget)
    if (!Number.isFinite(budgetValue) || budgetValue <= 0) {
      setError(copy('أدخل قيمة ميزانية تخطيطية موجبة قبل المتابعة.', 'Enter a positive planning budget before continuing.'))
      return
    }
    if (!data.startDate || !data.endDate || new Date(data.endDate).getTime() <= new Date(data.startDate).getTime()) {
      setError(copy('أدخل تاريخ بدء وانتهاء صحيحين؛ يجب أن يكون الانتهاء بعد البدء.', 'Enter valid start and end dates; the end must be after the start.'))
      return
    }
    if (!normalizePaidDestinationUrl(data.destinationUrl)) {
      setError(copy(
        'أدخل رابط تحويل عام يبدأ بـ https://. الروابط المحلية أو التجريبية غير مسموحة.',
        'Enter a public HTTPS conversion destination. Local or placeholder URLs are not allowed.'
      ))
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
          organicCampaignId: selectedStrategyId,
          adAccountId: data.adAccountId || undefined,
          objective: data.objective,
          budgetType: data.budgetType,
          dailyBudget: data.budgetType === 'DAILY' ? data.dailyBudget : undefined,
          lifetimeBudget: data.budgetType === 'LIFETIME' ? data.lifetimeBudget : undefined,
          currency: data.currency,
          startDate: data.startDate || undefined,
          endDate: data.endDate || undefined,
          destinationUrl: data.destinationUrl,
          utmCampaign: data.utmCampaign || undefined,
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(paidExecutionErrorMessage(
        result.code || result.error,
        isArabic ? 'ar' : 'en',
        copy('تعذر إنشاء مسودة التنفيذ.', 'Failed to create execution draft.'),
      ))
      setCampaignId(result.campaign.id)
      setStep(3)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : copy('حدث خطأ أثناء إنشاء مسودة التنفيذ.', 'Error creating execution draft'))
    } finally {
      setLoading(false)
    }
  }

  // ── Smart setup: deterministic translation of the approved strategy ──
  const handleAiSuggest = async () => {
    if (!selectedStrategyId) {
      setError(copy('اختر استراتيجية Paid أو Full معتمدة أولاً.', 'Choose an approved Paid or Full strategy first.'))
      return
    }
    setAiSuggestLoading(true)
    setError('')
    try {
      const token = await getToken()
      const res = await fetch('/api/ad-campaigns/ai-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sourceCampaignId: selectedStrategyId }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(paidExecutionErrorMessage(
        result.code || result.error,
        isArabic ? 'ar' : 'en',
        copy('تعذر إنشاء اقتراح التنفيذ.', 'Execution suggestion failed.'),
      ))
      const platform = normalizePaidPlanningPlatform(result.platform)
      const selectedAccount = result.suggestedAdAccountId
        ? accounts.find(account => account.id === result.suggestedAdAccountId) ?? null
        : selectSinglePaidPlanningAccount(accounts, platform)
      const objective = selectedStrategy?.executionObjective || result.sourceStrategy?.executionObjective
      if (!OBJECTIVES.some(item => item.id === objective)) {
        throw new Error(copy('تعذر التحقق من الهدف المعتمد.', 'Could not verify the approved strategy objective.'))
      }
      const language = ['ar', 'en', 'bilingual'].includes(result.language)
        ? result.language
        : 'en'
      setData(previous => ({
        ...previous,
        platform,
        adAccountId: selectedAccount?.id || '',
        objective,
        dailyBudget: result.dailyBudget ? String(result.dailyBudget) : '',
        currency: selectedAccount?.currency || result.currency || 'USD',
        name: result.name || '',
        language,
        aiSuggested: true,
        aiSuggestionRationale: normalizePaidPlanningRationale({
          platform,
          objective,
          rationale: result.rationale,
          locale: isArabic ? 'ar' : 'en',
        }),
      }))
      setStep(2)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : copy('تعذر إنشاء اقتراح التنفيذ.', 'Execution suggestion failed'))
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
      const strategyPayload = {
        language: data.language,
        destinationUrl: data.destinationUrl,
        utmCampaign: data.utmCampaign || data.name,
      }
      const res = await fetchCreditOperation(creditOperationScope('paid:execution-plan', JSON.stringify({ campaignId, ...strategyPayload })), `/api/ad-campaigns/${campaignId}/generate-strategy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(strategyPayload),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(paidExecutionErrorMessage(
        result.code || result.error,
        isArabic ? 'ar' : 'en',
        copy('تعذر إنشاء خطة التنفيذ المدفوع.', 'Execution plan generation failed.'),
      ))
      set('aiStrategy', result.strategy)
      setStep(4)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : copy('حدث خطأ أثناء إنشاء خطة التنفيذ.', 'Error generating execution plan'))
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
      const res = await fetchCreditOperation(creditOperationScope('paid:copy', JSON.stringify({ campaignId, language: data.language })), `/api/ad-campaigns/${campaignId}/generate-copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ language: data.language }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(paidExecutionErrorMessage(
        result.code || result.error,
        isArabic ? 'ar' : 'en',
        copy('تعذر إنشاء مسودات النصوص الإعلانية.', 'Copy generation failed.'),
      ))
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
      // ── STEP 1: Approved strategy + platform + account ─────────────────
      case 1:
        return (
          <div>
            <h2 className="text-[18px] font-bold text-slate-950 mb-1">
              {copy('اختر مصدر الاستراتيجية ثم منصة التنفيذ', 'Choose strategy source, then execution platform')}
            </h2>
            <p className="text-slate-500 text-[13px] mb-6">
              {copy(
                'لا ينشئ NEXUS استراتيجية ثانية هنا. يجب أن تبدأ الحملة من استراتيجية Paid أو Full معتمدة، ثم تتحول إلى إعداد منصة قابل للمراجعة.',
                'NEXUS does not create a second strategy here. Paid execution must start from an approved Paid or Full strategy, then translate it into a reviewable platform setup.'
              )}
            </p>

            <div className="mb-5 rounded-[16px] border border-slate-200 bg-slate-50/70 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[12px] font-black uppercase tracking-[0.14em] text-indigo-700">
                    {copy('مصدر القرار التسويقي', 'Marketing decision source')}
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-slate-500">
                    {copy('Brand Brain يحدد الحقيقة، والاستراتيجية المعتمدة تحدد الاتجاه، وهذه الصفحة تنفذ فقط.', 'Brand Brain defines truth, the approved strategy defines direction, and this page only executes it.')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => router.push('/strategy')}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700"
                >
                  {copy('فتح الاستراتيجية', 'Open Strategy')}
                </button>
              </div>

              {strategySourcesLoading ? (
                <div className="h-16 animate-pulse rounded-xl bg-white" />
              ) : strategySources.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] leading-6 text-amber-800">
                  {copy('لا توجد استراتيجية بعد. أكمل Brand Brain ثم أنشئ Paid أو Full Strategy وراجعها واعتمدها.', 'No strategy exists yet. Complete Brand Brain, create a Paid or Full strategy, review it, and approve it first.')}
                </div>
              ) : (
                <div className="space-y-2">
                  {requestedStrategy && !requestedStrategy.eligible && (
                    <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] leading-6 text-amber-900">
                      <p className="font-bold">
                        {copy('وصلت من استراتيجية محددة، لكنها ليست قابلة للتنفيذ المدفوع بعد.', 'You arrived from a specific strategy, but it is not eligible for paid execution yet.')}
                      </p>
                      <p className="mt-1 text-amber-800">
                        {requestedStrategy.name} · {strategyReasonLabel(requestedStrategy)}
                      </p>
                      <button
                        type="button"
                        onClick={() => router.push(`/campaigns/${requestedStrategy.id}?tab=strategy`)}
                        className="mt-2 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-[11px] font-bold text-amber-900"
                      >
                        {copy('العودة لإكمال المراجعة والاعتماد', 'Return to complete review and approval')}
                      </button>
                    </div>
                  )}
                  {strategySources.map(source => {
                    const selected = selectedStrategyId === source.id
                    const requested = requestedStrategyId === source.id
                    return (
                      <button
                        type="button"
                        key={source.id}
                        onClick={() => handleStrategySelect(source.id)}
                        disabled={!source.eligible}
                        aria-pressed={selected}
                        className="flex w-full items-center justify-between gap-3 rounded-xl p-3 text-left transition-all"
                        style={{
                          background: selected ? 'rgba(79,70,229,0.07)' : '#fff',
                          border: selected ? '1px solid #4f46e5' : '1px solid rgba(15,23,42,0.08)',
                          cursor: source.eligible ? 'pointer' : 'not-allowed',
                          opacity: source.eligible ? 1 : 0.68,
                        }}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-bold text-slate-950">{source.name}</p>
                          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            {source.scope} · {source.goal.replace(/_/g, ' ')}
                          </p>
                          {source.scope !== 'organic' && (
                            <p className="mt-1 text-[10px] font-semibold text-indigo-600">
                              {copy('Paid:', 'Paid:')} {source.paidPackage.audienceHypotheses} {copy('جماهير', 'audiences')} · {source.paidPackage.adAngles} {copy('زوايا', 'angles')} · {source.paidPackage.adCopyVariations} {copy('نسخ', 'copy')} · {source.paidPackage.creativeBriefs} {copy('بريفات', 'briefs')}
                            </p>
                          )}
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${source.eligible ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                          {selected
                            ? copy('محددة', 'Selected')
                            : requested
                              ? copy(`المصدر المطلوب · ${strategyReasonLabel(source)}`, `Requested source · ${strategyReasonLabel(source)}`)
                              : strategyReasonLabel(source)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Smart setup card — no provider call and no credit spend */}
            <div className="mb-5 p-4 rounded-[14px] relative overflow-hidden"
              style={{ background: '#faf5ff', border: '1px solid rgba(109,40,217,0.15)' }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[14px]">⚡</span>
                    <span className="text-[13px] font-bold text-slate-950">{copy('إعداد ذكي من الاستراتيجية المعتمدة', 'Smart setup from approved strategy')}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                      style={{ background: '#ede9fe', color: '#6d28d9' }}>{copy('مجاني', 'FREE')}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {copy(
                      'يطبّق NEXUS قواعد حتمية على الاستراتيجية المعتمدة والحسابات المتوافقة ليقترح منصة واسم مسودة، بدون استدعاء ذكاء أو خصم كريديت أو اختراع ميزانية.',
                      'NEXUS applies deterministic rules to the approved strategy and compatible accounts to suggest a platform and draft name—no AI call, credit charge, or invented budget.'
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAiSuggest}
                  disabled={aiSuggestLoading || !selectedStrategyId}
                  aria-label={copy('تطبيق الإعداد الذكي من الاستراتيجية', 'Apply smart setup from the strategy')}
                  className="flex-shrink-0 px-4 py-2 rounded-xl text-[12px] font-bold text-white transition-all"
                  style={{
                    background: aiSuggestLoading || !selectedStrategyId ? '#e5e7eb' : '#6d28d9',
                    color: aiSuggestLoading || !selectedStrategyId ? '#94a3b8' : 'white',
                    cursor: aiSuggestLoading ? 'wait' : selectedStrategyId ? 'pointer' : 'not-allowed',
                  }}
                >
                  {aiSuggestLoading ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin inline-block" />
                      {copy('جارٍ إعداد التنفيذ...', 'Preparing...')}
                    </span>
                  ) : copy('تطبيق الإعداد', 'Apply setup')}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 h-px" style={{ background: '#e2e8f0' }} />
              <span className="text-[11px] text-slate-400">{copy('أو اختر يدوياً', 'or choose manually')}</span>
              <div className="flex-1 h-px" style={{ background: '#e2e8f0' }} />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {PLATFORMS.map(p => {
                const objectiveCompatible = Boolean(
                  selectedStrategy
                  && paidPlatformSupportsObjective(p.id, selectedStrategy.executionObjective)
                )
                const approvedByStrategy = Boolean(selectedStrategy?.approvedPlatforms.includes(p.id as PaidStrategySource['approvedPlatforms'][number]))
                const compatible = objectiveCompatible && approvedByStrategy
                return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => handlePlatformSelect(p.id)}
                  disabled={!selectedStrategyId || !compatible}
                  aria-pressed={data.platform === p.id}
                  className="relative flex flex-col items-start gap-1.5 p-4 rounded-[14px] text-left transition-all"
                  style={{
                    background: data.platform === p.id
                      ? `rgba(${p.color === '#1877F2' ? '24,119,242' : p.color === '#4285F4' ? '66,133,244' : '255,0,80'},0.06)`
                      : '#fff',
                    border: data.platform === p.id
                      ? `1px solid ${p.color}`
                      : '1px solid rgba(15,23,42,0.08)',
                    cursor: selectedStrategyId && compatible ? 'pointer' : 'not-allowed',
                    opacity: selectedStrategyId && compatible ? 1 : 0.55,
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
                  {selectedStrategyId && !compatible && (
                    <span className="text-[10px] font-semibold text-amber-700">
                      {!approvedByStrategy
                        ? copy('غير معتمد داخل هذه الاستراتيجية', 'Not approved by this strategy')
                        : copy('غير متوافق مع الهدف المعتمد', 'Not compatible with approved objective')}
                    </span>
                  )}
                  {data.platform === p.id && (
                    <span className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full font-bold"
                      style={{ background: p.color, color: 'white' }}>✓</span>
                  )}
                </button>
                )
              })}
            </div>

            {selectedStrategy && (
              <div className="mb-6 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-indigo-700">
                    {copy('قرار المنصات من الاستراتيجية', 'Strategy platform decision')}
                  </p>
                  <span className="text-[10px] font-bold text-indigo-500">
                    {selectedStrategy.paidPackage.audienceHypotheses} + {selectedStrategy.paidPackage.adAngles} + {selectedStrategy.paidPackage.adCopyVariations} + {selectedStrategy.paidPackage.creativeBriefs}
                  </span>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-slate-600">
                  {copy('المتاح للتنفيذ:', 'Executable:')} {selectedStrategy.approvedPlatforms.map(platform => PLATFORMS.find(item => item.id === platform)?.label || platform).join(', ') || copy('لا توجد منصة معتمدة', 'No approved platform')}
                </p>
                {selectedStrategy.planningOnlyPlatforms.length > 0 && (
                  <p className="mt-1 text-[11px] leading-5 text-amber-700">
                    {copy('تخطيط/تصدير فقط حاليًا:', 'Planning/export only today:')} {selectedStrategy.planningOnlyPlatforms.join(', ')}
                  </p>
                )}
                <p className="mt-2 text-[10px] leading-4 text-slate-500">
                  {copy('الحساب المتصل بمنصة أخرى لا يغيّر قرار الاستراتيجية تلقائيًا.', 'A connected account on another platform never changes the approved strategy automatically.')}
                </p>
              </div>
            )}

            {/* Ad Account selection */}
            {selectedStrategyId && data.platform && (
              <div>
                <label className="text-[12px] text-slate-500 block mb-2 font-medium">
                  {copy('الحساب الإعلاني', 'Ad Account')} {accounts.filter(a => a.platform === data.platform && a.status === 'ACTIVE').length === 0 && (
                    <span className="text-orange-600 ml-1">— {copy('لا يوجد حساب نشط متصل', 'no active connected account')}</span>
                  )}
                </label>
                {accounts.filter(a => a.platform === data.platform && a.status === 'ACTIVE').length > 0 ? (
                  <div className="space-y-2">
                    {accounts.filter(a => a.platform === data.platform && a.status === 'ACTIVE').map(acc => (
                      <button
                        type="button"
                        key={acc.id}
                        onClick={() => setData(previous => ({
                          ...previous,
                          adAccountId: acc.id,
                          currency: acc.currency || previous.currency,
                        }))}
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
                      {copy('تنفيذ المنصة مقفول حتى ربط حساب نشط والتحقق من الصلاحيات. تظل الاستراتيجية محفوظة ويمكن العودة إليها.', 'Platform execution is locked until an active account and permissions are verified. The strategy remains saved and reviewable.')}
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
                disabled={!selectedStrategyId || !data.platform || !data.adAccountId}
                onClick={() => setStep(2)}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all"
                style={{
                  background: selectedStrategyId && data.platform && data.adAccountId ? '#F97316' : '#e2e8f0',
                  color: selectedStrategyId && data.platform && data.adAccountId ? 'white' : '#94a3b8',
                  cursor: selectedStrategyId && data.platform && data.adAccountId ? 'pointer' : 'not-allowed',
                }}
              >
                {copy('متابعة', 'Continue')}
              </button>
            </div>
          </div>
        )

      // ── STEP 2: Budget + Objective ─────────────────────────────────────
      case 2: {
        const planningBudget = parseFloat(data.budgetType === 'DAILY' ? data.dailyBudget : data.lifetimeBudget) || 0
        const approvedObjective = OBJECTIVES.find(objective => objective.id === data.objective) ?? null
        const datesValid = Boolean(
          data.startDate
          && data.endDate
          && new Date(data.endDate).getTime() > new Date(data.startDate).getTime()
        )
        const detailsReady = Boolean(
          selectedStrategyId
          && data.adAccountId
          && data.name.trim()
          && planningBudget > 0
          && datesValid
          && normalizePaidDestinationUrl(data.destinationUrl)
        )

        return (
          <div>
            <h2 className="text-[18px] font-bold text-slate-950 mb-1">{copy('تفاصيل مسودة التنفيذ', 'Execution Draft Details')}</h2>
            <p className="text-slate-500 text-[13px] mb-6">
              {copy('سمِّ المسودة، راجع الهدف الموروث، وأدخل افتراض ميزانية للمراجعة. هذه القيم لا تعني اعتماد الإنفاق.', 'Name the draft, review the inherited objective, and enter a budget assumption. These values do not approve spend.')}
            </p>

            {selectedStrategy && (
              <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wider text-indigo-700">{copy('تنفيذ الاستراتيجية المعتمدة', 'Executing approved strategy')}</p>
                  <p className="mt-1 truncate text-[12px] font-bold text-slate-950">{selectedStrategy.name}</p>
                </div>
                <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-indigo-700">
                  {selectedStrategy.scope.toUpperCase()}
                </span>
              </div>
            )}

            {/* AI Suggestion banner */}
            {data.aiSuggested && data.aiSuggestionRationale && (
              <div className="mb-4 p-3 rounded-xl text-[11px]"
                style={{ background: '#faf5ff', border: '1px solid rgba(109,40,217,0.2)' }}>
                <span className="font-bold" style={{ color: '#6d28d9' }}>⚡ {copy('اقتراح تنفيذ:', 'Execution suggestion:')} </span>
                <span className="text-slate-500">{data.aiSuggestionRationale}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Campaign name */}
              <div>
                <label className="block text-[12px] font-medium text-slate-500 mb-1.5">{copy('اسم مسودة التنفيذ *', 'Execution Draft Name *')}</label>
                <input
                  value={data.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder={copy('مثال: اكتساب حجوزات — بحث Google', 'e.g. Booking acquisition — Google Search')}
                  className="w-full px-3 py-2.5 rounded-xl text-[13px] text-slate-950 placeholder:text-slate-400 focus:outline-none transition-all"
                  style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.12)' }}
                />
              </div>

              {/* Objective */}
              <div>
                <label className="block text-[12px] font-medium text-slate-500 mb-1">{copy('هدف التنفيذ المعتمد', 'Approved execution objective')}</label>
                <p className="mb-2 text-[10px] leading-5 text-slate-400">
                  {copy('موروث من الاستراتيجية المعتمدة ولا يتغير داخل حملة المنصة.', 'Inherited from the approved strategy and cannot be changed inside platform execution.')}
                </p>
                {approvedObjective && (
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-orange-200 bg-orange-50 p-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="text-xl" aria-hidden="true">{approvedObjective.icon}</span>
                      <div>
                        <p className="text-[13px] font-bold text-slate-950">
                          {isArabic ? approvedObjective.labelAr : approvedObjective.labelEn}
                        </p>
                        <p className="mt-1 text-[11px] leading-5 text-slate-600">
                          {isArabic ? approvedObjective.descAr : approvedObjective.descEn}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-orange-700">
                      {copy('من الاستراتيجية', 'From strategy')}
                    </span>
                  </div>
                )}
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

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-[12px] font-medium text-slate-500 mb-1.5">
                    {copy('وجهة التحويل', 'Conversion destination')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="url"
                    inputMode="url"
                    value={data.destinationUrl}
                    onChange={event => set('destinationUrl', event.target.value)}
                    placeholder="https://your-domain.com/book"
                    className="w-full px-3 py-2.5 rounded-xl text-[13px] text-slate-950 focus:outline-none"
                    style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.12)' }}
                  />
                  <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
                    {copy(
                      'الرابط الحقيقي الذي يصل إليه العميل. يضيف NEXUS تتبّع UTM لمسودة الإعلان، ولا يطلق الحملة.',
                      'The real customer destination. NEXUS adds UTM tracking to the ad draft; it does not launch the campaign.'
                    )}
                  </p>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-slate-500 mb-1.5">
                    {copy('اسم حملة التتبّع (اختياري)', 'Tracking campaign name (optional)')}
                  </label>
                  <input
                    type="text"
                    value={data.utmCampaign}
                    onChange={event => set('utmCampaign', event.target.value)}
                    placeholder={data.name || 'spring_campaign'}
                    className="w-full px-3 py-2.5 rounded-xl text-[13px] text-slate-950 focus:outline-none"
                    style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.12)' }}
                  />
                  <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
                    {copy('يُستخدم فقط داخل UTM لقياس الزيارات والتحويلات.', 'Used only in UTM parameters to attribute visits and conversions.')}
                  </p>
                </div>
              </div>

              {/* Forecast boundary */}
              {planningBudget > 0 && (
                <div className="p-3 rounded-xl"
                  style={{ background: '#fff7ed', border: '1px solid rgba(249,115,22,0.2)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#c2410c' }}>
                    {copy('حدود التوقعات', 'Forecast boundary')}
                  </p>
                  <p className="text-[11px] leading-relaxed text-slate-600">
                    {copy(
                      'لن يخمّن NEXUS الوصول أو مرات الظهور أو CPM من جداول عامة. تظهر التوقعات فقط عندما يوفر الحساب الإعلاني المتصل Forecast حقيقياً. هذه الميزانية تخطيطية وغير معتمدة للصرف.',
                      'NEXUS does not guess reach, impressions, or CPM from generic tables. Forecasts appear only when the connected ad account provides a real platform forecast. This budget is for planning and is not approved spend.'
                    )}
                  </p>
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-slate-500 mb-1.5">{copy('تاريخ البدء التخطيطي *', 'Planning start date *')}</label>
                  <input
                    type="date"
                    value={data.startDate}
                    onChange={e => set('startDate', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-[13px] text-slate-950 focus:outline-none"
                    style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.12)' }}
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-slate-500 mb-1.5">{copy('تاريخ الانتهاء التخطيطي *', 'Planning end date *')}</label>
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
                  <span className="ml-1 text-[10px] text-slate-400">— {copy('ستُكتب خطة التنفيذ والنصوص بهذه اللغة', 'execution plan and ad copy will be written in this language')}</span>
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
                disabled={!detailsReady || loading}
                onClick={handleStep2}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all"
                style={{
                  background: detailsReady ? '#F97316' : '#e2e8f0',
                  color: detailsReady ? 'white' : '#94a3b8',
                  cursor: detailsReady && !loading ? 'pointer' : 'not-allowed',
                }}
              >
                {loading ? copy('جارٍ حفظ المسودة...', 'Saving...') : copy('حفظ مسودة التنفيذ والمتابعة', 'Save execution draft & continue')}
              </button>
            </div>
          </div>
        )
      }

      // ── STEP 3: Strategy-aligned execution plan ─────────────────────────
      case 3: {
        const strategy = data.aiStrategy
        return (
          <div>
            <h2 className="text-[18px] font-bold text-slate-950 mb-1">{copy('خطة تنفيذ مدفوعة مرتبطة بالاستراتيجية', 'Strategy-aligned Paid Execution Plan')}</h2>
            <p className="text-slate-500 text-[13px] mb-6">
              {copy(
                'يترجم NEXUS الاستراتيجية المعتمدة وحقائق Brand Brain إلى استهداف وملاحظات ميزانية وموجز إبداعي للمنصة، بدون اختراع استراتيجية جديدة.',
                'NEXUS translates the approved strategy and Brand Brain truth into platform targeting, budget notes, and a creative brief without inventing a second strategy.'
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
                <p className="text-slate-950 font-medium mb-2">{copy('جاهز لإنشاء خطة تنفيذ للمنصة', 'Ready to generate the platform execution plan')}</p>
                <p className="text-slate-500 text-[12px] mb-6 max-w-xs mx-auto">
                  {copy(
                    'يستخدم الاستراتيجية المعتمدة وBrand Brain وميزانية التخطيط والمنصة لإنتاج خطة تنفيذ قابلة للمراجعة. لا ينشئ حملة منصة ولا يعتمد إنفاقاً.',
                    'Uses the approved strategy, Brand Brain, planning budget, and platform to produce a reviewable execution plan. It does not create a platform campaign or approve spend.'
                  )}
                </p>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setCreditConfirmation('plan')}
                  aria-label={copy('مراجعة تكلفة خطة التنفيذ: 4 كريديت', 'Review execution plan cost: 4 credits')}
                  className="px-6 py-3 rounded-xl text-[13px] font-bold text-white transition-all"
                  style={{ background: loading ? '#e5e7eb' : '#6d28d9', color: loading ? '#94a3b8' : 'white' }}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                      {copy('جارٍ إنشاء خطة التنفيذ...', 'Generating execution plan...')}
                    </span>
                  ) : copy('مراجعة التكلفة — 4 كريديت', 'Review cost — 4 credits')}
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
                    <p className="text-[12px] leading-relaxed text-slate-600">
                      {copy(
                        'التوزيع والمراحل مقترحات للمراجعة. توقعات الوصول وCPM والنتائج محجوبة حتى تتوفر بيانات حقيقية من المنصة أو سجل أداء موثوق.',
                        'Allocation and phasing are review suggestions. Reach, CPM, and outcome forecasts stay withheld until real platform data or verified performance history is available.'
                      )}
                    </p>
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
                  onClick={() => setCreditConfirmation('copy')}
                  disabled={loading}
                  aria-label={copy(`إنشاء مسودات النصوص الإعلانية مقابل ${CREDIT_ACTION_COSTS.AD_COPY} أرصدة`, `Generate ad copy drafts for ${CREDIT_ACTION_COSTS.AD_COPY} credits`)}
                  className="flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all"
                  style={{ background: loading ? '#e2e8f0' : '#F97316', color: loading ? '#94a3b8' : 'white' }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                      {copy('جارٍ إنشاء النصوص...', 'Generating copy...')}
                    </span>
                ) : copy(`إنشاء مسودات النصوص الإعلانية — ${CREDIT_ACTION_COSTS.AD_COPY} أرصدة`, `Generate ad copy drafts — ${CREDIT_ACTION_COSTS.AD_COPY} credits`)}
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
                `أنشأ الذكاء الاصطناعي ${data.copyVariants.length} مسودة للمراجعة. حدد النسخ التي تريد الاحتفاظ بها داخل مسودة التنفيذ.`,
                `AI generated ${data.copyVariants.length} drafts for review. Select the ones to keep in this execution draft.`
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
              {copy('حُفظت مسودة التنفيذ للمراجعة. لم يطلق NEXUS إعلاناً ولم يعتمد أو ينفق ميزانية.', 'Your paid execution draft is saved for review. NEXUS has not launched ads, approved spend, or spent budget.')}
            </p>

            {/* Summary card */}
            <div className="p-4 rounded-[14px] mb-6 space-y-3 bg-white"
              style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-slate-500">{copy('مسودة التنفيذ', 'Execution draft')}</span>
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
                <span className="text-[12px] text-slate-500">{copy('خطة التنفيذ', 'Execution plan')}</span>
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
                <li>• {copy('افتح تفاصيل المسودة لمراجعة الاستهداف والافتراضات', 'Open the execution draft details to review targeting and assumptions')}</li>
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
                {copy('فتح مسودة التنفيذ المدفوع', 'Open paid execution draft')}
              </button>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  if (authLoading) {
    return <WorkspaceRouteLoading labelAr="جارٍ تجهيز التنفيذ المدفوع" labelEn="Preparing paid execution" />
  }

  if (!isAuthenticated) return null

  return (
    <AppShell>
      <main className="nx-os-page text-[#071236]">
        <div className="nx-os-container grid gap-6 pb-12 lg:grid-cols-[minmax(0,780px)_360px]">
          <div className="lg:col-span-2">
            <LuxuryWorkspaceHeader
              pageTitle={locale === 'ar' ? 'تنفيذ مدفوع مرتبط بالاستراتيجية' : 'Strategy-linked paid execution'}
              pageSubtitle={locale === 'ar' ? 'حوّل استراتيجية Paid أو Full المعتمدة إلى إعداد منصة قابل للمراجعة. لا حملة ولا إنفاق بدون موافقة لاحقة.' : 'Turn an approved Paid or Full strategy into a reviewable platform setup. No campaign or spend happens without later approval.'}
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
              <h2 className="text-2xl font-black tracking-tight text-slate-950">
                {locale === 'ar' ? 'مسودة تنفيذ مدفوع جديدة' : 'New Paid Execution Draft'}
              </h2>
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
                  ? 'هذه الصفحة تنشئ مسودة تنفيذ مرتبطة باستراتيجية معتمدة. لا يتم إطلاق إعلان، ولا صرف ميزانية، ولا تفعيل منصة إلا من شاشة تأكيد منفصلة.'
                  : 'This page creates an execution draft linked to an approved strategy. No ad launch, budget spend, or platform activation happens without a separate confirmation screen.'}
              </p>
            </div>
            <div className="rounded-[24px] border border-indigo-100 bg-indigo-50/70 p-5">
              <p className="text-sm font-black text-slate-950">{locale === 'ar' ? 'مسار صحيح' : 'Correct path'}</p>
              <ol className="mt-3 space-y-3 text-sm text-slate-600">
                {(locale === 'ar'
                  ? ['اختيار استراتيجية Paid أو Full معتمدة', 'اختيار المنصة والحساب', 'إدخال الميزانية والوجهة والتواريخ', 'إنشاء خطة تنفيذ ونصوص للمراجعة', 'إنشاء مسودة متوقفة ثم التفعيل بعد موافقة صريحة']
                  : ['Choose an approved Paid or Full strategy', 'Choose platform and account', 'Enter budget, destination, and dates', 'Generate execution plan and copy for review', 'Create a paused draft, then activate after explicit approval']
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
      <CreditConfirmModal
        isOpen={creditConfirmation !== null}
        onClose={() => setCreditConfirmation(null)}
        onConfirm={() => {
          if (creditConfirmation === 'plan') void handleGenerateStrategy()
          if (creditConfirmation === 'copy') void handleGenerateCopy()
        }}
        cost={creditConfirmation === 'plan' ? 4 : 2}
        actionTitle={creditConfirmation === 'plan'
          ? copy('إنشاء خطة تنفيذ مدفوعة', 'Generate paid execution plan')
          : copy('إنشاء مسودات النصوص الإعلانية', 'Generate ad copy drafts')}
        reason={creditConfirmation === 'plan'
          ? copy(
              'يحوّل الاستراتيجية المعتمدة إلى خطة تنفيذ منصة قابلة للمراجعة من دون إطلاق أو إنفاق.',
              'Converts the approved strategy into a reviewable platform execution plan without launch or spend.',
            )
          : copy(
              'ينشئ مسودات نصوص إعلانية مرتبطة بالاستراتيجية للمراجعة قبل أي تفعيل.',
              'Creates strategy-aligned ad-copy drafts for review before any activation.',
            )}
        authHeader={authHeader}
        locale={locale}
        includedItems={creditConfirmation === 'plan'
          ? (isArabic
              ? ['استهداف المنصة', 'توزيع الميزانية للمراجعة', 'موجز إبداعي', 'لا إطلاق ولا إنفاق']
              : ['Platform targeting', 'Reviewable budget allocation', 'Creative brief', 'No launch or spend'])
          : (isArabic
              ? ['مسودات مرتبطة بالاستراتيجية', 'نسخ للمراجعة', 'لا نشر ولا إنفاق']
              : ['Strategy-aligned drafts', 'Copy for review', 'No publish or spend'])}
      />
    </AppShell>
  )
}
