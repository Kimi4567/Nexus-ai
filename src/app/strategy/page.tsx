'use client'

/**
 * /strategy — Marketing Strategy page (PR-B: read-only IA foundation).
 *
 * This is the Strategy stage of the journey:
 *   Brand Brain → Strategy → Organic Content Direction + Paid Planning Brief → execution
 *
 * IMPORTANT — this page is the strategy workbench. It renders existing strategy
 * state and opens the explicit cost-review modal for strategy generation. It
 * never schedules, publishes, starts ads, or spends credits without the modal's
 * final cost confirmation. It surfaces the Strategy stage using data that
 * already exists:
 *   - GET /api/brand      → maturity.status (Building/Active) + brandName
 *   - GET /api/campaigns  → existing campaigns + their aiOutput.strategy
 * When no strategy/campaign exists yet, every section shows an honest empty
 * state. Nothing here invents budgets, KPIs, results, percentages, timelines,
 * or platform readiness, and nothing implies ads/spend/publishing are active.
 */

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { BrandReadinessStatus } from '@/lib/brandReadiness'
import { getStrategyPageReadinessSurface } from '@/lib/strategyBriefReadiness'
import { getCampaignPlatformSummary } from '@/lib/campaignPlatforms'
import { getStrategyBrandAlignment } from '@/lib/strategy/strategyBrandAlignment'
import { selectStrategyWorkbenchCampaign } from '@/lib/strategy/strategyWorkbenchCampaign'
import { resolveStrategyScope } from '@/lib/strategy/strategyScope'
import { guardStrategyOutputContract } from '@/lib/ai/strategyOutputContractGuard'
import { guardStrategyProof } from '@/lib/ai/strategyProofGuard'
import AppShell from '@/components/AppShell'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import RunFullStrategyModal from '@/components/RunFullStrategyModal'
import {
  AlertTriangle, ArrowRight, BarChart3, Brain, CalendarDays,
  CheckCircle2, ClipboardList, Diamond,
  Eye, FileText, Gauge, Layers, Lightbulb, Loader2, Megaphone,
  MessageCircle, PieChart, RefreshCw, Rocket,
  Send, ShieldCheck, Sparkles, Target, TrendingUp, Users,
} from 'lucide-react'

interface CampaignLite {
  id: string
  name: string
  status: string
  goal?: string | null
  thumbnail?: string | null
  platforms: string[]
  aiOutput: unknown
  createdAt: string
  updatedAt: string
}

type StrategyPrimaryAction =
  | { label: string; description: string; href: string }
  | { label: string; description: string; onClick: () => void }

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}
function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === 'object' && !Array.isArray(v))
}
function pillarLabel(p: unknown): string {
  if (typeof p === 'string') return p
  if (p && typeof p === 'object') {
    const o = p as Record<string, unknown>
    return String(o.name ?? o.title ?? o.pillar ?? '').trim()
  }
  return ''
}
function textLabel(p: unknown): string {
  if (typeof p === 'string') return p
  if (p && typeof p === 'object') {
    const o = p as Record<string, unknown>
    return String(o.hook ?? o.text ?? o.cta ?? o.value ?? '').trim()
  }
  return ''
}
function uniqueLabels(items: string[]): string[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = item.trim().toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (Array.isArray(value)) {
      const nested = firstString(...value)
      if (nested) return nested
    }
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>
      const nested = firstString(record.title, record.name, record.summary, record.description, record.value, record.text)
      if (nested) return nested
    }
  }
  return ''
}

function funnelStageLabel(value: unknown, ar: boolean): string {
  const stage = typeof value === 'string' ? value.trim().toLowerCase() : ''
  const labels: Record<string, [string, string]> = {
    awareness: ['Awareness', 'الوعي'],
    consideration: ['Consideration', 'الاعتبار'],
    conversion: ['Conversion', 'التحويل'],
    followup: ['Follow-up', 'المتابعة'],
    'follow-up': ['Follow-up', 'المتابعة'],
    retention: ['Retention', 'الاحتفاظ'],
  }
  return labels[stage]?.[ar ? 1 : 0] ?? (typeof value === 'string' ? value.trim() : '')
}

function campaignGoalLabel(value: string, ar: boolean): string {
  const key = value.trim().toUpperCase().replace(/[\s-]+/g, '_')
  const labels: Record<string, [string, string]> = {
    SALES: ['Sales', 'زيادة المبيعات'],
    AWARENESS: ['Awareness', 'بناء الوعي'],
    LEADS: ['Lead generation', 'توليد عملاء محتملين'],
    TRAFFIC: ['Traffic', 'زيادة الزيارات'],
    ENGAGEMENT: ['Engagement', 'زيادة التفاعل'],
    BRAND_BUILDING: ['Brand building', 'بناء العلامة التجارية'],
  }
  return labels[key]?.[ar ? 1 : 0] ?? value
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function formatShortDate(date: string | undefined, locale: string): string {
  if (!date) return locale === 'ar' ? 'غير محدد' : 'Not set'
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return locale === 'ar' ? 'غير محدد' : 'Not set'
  return parsed.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function SoftCard({
  children,
  className = '',
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      {...props}
      className={`rounded-[22px] border border-slate-200/80 bg-white/95 shadow-[0_18px_54px_rgba(15,23,42,0.06)] ${className}`}
    >
      {children}
    </section>
  )
}

function ProgressBar({ value, color = '#5E63FF' }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full" style={{ width: `${clampPercent(value)}%`, background: color }} />
    </div>
  )
}

function ReadinessRing({
  value,
  label,
  size = 'lg',
}: {
  value: number
  label: string
  size?: 'sm' | 'lg'
}) {
  const pct = clampPercent(value)
  const dimension = size === 'sm' ? 'h-24 w-24' : 'h-32 w-32'
  return (
    <div
      className={`${dimension} flex shrink-0 items-center justify-center rounded-full`}
      style={{
        background: `conic-gradient(#5E63FF ${pct * 3.6}deg, #E8ECF7 0deg)`,
        boxShadow: '0 18px 46px rgba(94,99,255,0.18)',
      }}
    >
      <div className="flex h-[76%] w-[76%] flex-col items-center justify-center rounded-full bg-white">
        <span className="text-[28px] font-black leading-none text-[#0B1028]">{pct}%</span>
        <span className="mt-1 text-[11px] font-bold text-slate-500">{label}</span>
      </div>
    </div>
  )
}

function PlatformDot({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-600">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

export default function StrategyPage() {
  const { authHeader, isAuthenticated, loading: authLoading } = useAuth()
  const { locale } = useI18n()
  const router = useRouter()
  const ar = locale === 'ar'

  const [loading, setLoading] = useState(true)
  const [brandStatus, setBrandStatus] = useState<BrandReadinessStatus | null>(null)
  const [brandName, setBrandName] = useState<string>('')
  // PX-2B.1 — capability-specific readiness reuses the SAME brand profile already
  // returned by GET /api/brand (no extra request, no new math, no new score).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [brandProfile, setBrandProfile] = useState<any>(null)
  const [campaigns, setCampaigns] = useState<CampaignLite[]>([])
  const [runStrategyOpen, setRunStrategyOpen] = useState(false)
  const [startFreshStrategyRequest, setStartFreshStrategyRequest] = useState(false)

  const load = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const [cRes, bRes] = await Promise.all([
        fetch('/api/campaigns?limit=20&sort=updatedAt', { headers: { Authorization: authHeader() } }),
        fetch('/api/brand', { headers: { Authorization: authHeader() } }),
      ])
      if (cRes.ok) {
        const d = await cRes.json()
        setCampaigns(Array.isArray(d.campaigns) ? d.campaigns : [])
      }
      if (bRes.ok) {
        const d = await bRes.json()
        setBrandStatus(d.maturity?.status ?? null)
        setBrandName(d.brandProfile?.brandName ?? '')
        setBrandProfile(d.brandProfile ?? null)
      }
    } catch {
      /* non-fatal — render honest empty states */
    } finally {
      setLoading(false)
    }
  }, [authHeader, isAuthenticated])

  useEffect(() => {
    if (!authLoading && isAuthenticated) load()
  }, [authLoading, isAuthenticated, load])

  // Standard app auth gate (same pattern as the dashboard): once auth has
  // resolved with no user, send them to login instead of hanging on a spinner.
  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/login')
  }, [authLoading, isAuthenticated, router])

  // ── Derived, truthful state (no invention) ──────────────────────────────────
  const recent = selectStrategyWorkbenchCampaign(campaigns, brandName)
  const rawAi = (recent?.aiOutput ?? null) as Record<string, unknown> | null
  const rawStrat = (rawAi?.strategy ?? rawAi ?? null) as Record<string, unknown> | null
  const hasStrategy = Boolean(recent && isRecord(rawStrat) && Object.keys(rawStrat).length > 0)
  const hasDraftStrategy = Boolean(hasStrategy && recent?.status && recent.status.toLowerCase() === 'draft')
  const strategyScope = resolveStrategyScope(rawAi)
  const strategyLanguage = typeof rawAi?.language === 'string' ? rawAi.language : locale
  const includesPaidPlanning = strategyScope.includesPaid
  const displayGuardContext = {
    verifiedProof: Array.isArray(brandProfile?.verifiedProof) ? brandProfile.verifiedProof : [],
    allowedClaimText: [
      brandProfile?.description,
      brandProfile?.primaryOffer,
      brandProfile?.pricePoint,
      brandProfile?.languagePreference,
      ...(Array.isArray(brandProfile?.uniqueAdvantages) ? brandProfile.uniqueAdvantages : []),
      brandProfile?.complianceNotes,
      ...(Array.isArray(brandProfile?.verifiedProof) ? brandProfile.verifiedProof : []),
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
  }
  const displayAllowedPlatforms = (recent?.platforms?.length ? recent.platforms : brandProfile?.topPlatforms) ?? []
  const ai = rawAi
    ? guardStrategyOutputContract(
        guardStrategyProof(rawAi, displayGuardContext),
        {
          allowedPlatforms: displayAllowedPlatforms,
          language: strategyLanguage,
          strategyType: strategyScope.type,
          hasConversionDestination: Boolean(brandProfile?.conversionDestination),
          allowedCompetitors: Array.isArray(brandProfile?.competitors) ? brandProfile.competitors : [],
        },
      ) as Record<string, unknown>
    : null
  const strat = rawStrat
    ? guardStrategyOutputContract(
        guardStrategyProof(rawStrat, displayGuardContext),
        {
          allowedPlatforms: displayAllowedPlatforms,
          language: strategyLanguage,
          strategyType: strategyScope.type,
          hasConversionDestination: Boolean(brandProfile?.conversionDestination),
          allowedCompetitors: Array.isArray(brandProfile?.competitors) ? brandProfile.competitors : [],
        },
      ) as Record<string, unknown>
    : null

  const pillars = uniqueLabels([
    ...asArray(strat?.contentPillars),
    ...asArray(ai?.contentPillars),
  ].map(pillarLabel).filter(Boolean)).slice(0, 6)
  const platformSummary = getCampaignPlatformSummary(recent?.platforms ?? [], locale)
  const hooks = [
    ...asArray(ai?.topHooks),
    ...asArray(strat?.topHooks),
  ].map(textLabel).filter(Boolean).slice(0, 4)
  const ctas = [
    ...asArray(ai?.ctaVariations),
    ...asArray(strat?.ctaVariations),
  ].map(textLabel).filter(Boolean).slice(0, 4)
  const hasOrganicData = strategyScope.includesOrganic && (pillars.length > 0 || hooks.length > 0 || ctas.length > 0 || !platformSummary.isEmpty)
  const strategyBrandAlignment = getStrategyBrandAlignment({
    currentBrandName: brandName,
    campaignName: recent?.name,
    strategy: rawStrat,
    aiOutput: rawAi,
  })
  const strategyBrandMismatch = hasStrategy && strategyBrandAlignment.isStale
  const hasCurrentBrandOrganicData = hasOrganicData && !strategyBrandMismatch
  const recentStrategyHref = recent?.id ? `/campaigns/${recent.id}?tab=strategy` : '/strategy'
  const recentContentHubHref = recent?.id ? `/campaigns/${recent.id}/content-hub` : '/content-hub'
  const recentPublishHref = recent?.id ? `/campaigns/${recent.id}?tab=publish` : '/content-hub'
  const recentPerformanceHref = recent?.id ? `/campaigns/${recent.id}?tab=performance` : '/analytics'
  const primaryAction: StrategyPrimaryAction = !hasStrategy || strategyBrandMismatch
    ? {
        label: !hasStrategy
          ? (ar ? 'إنشاء أول استراتيجية' : 'Create first strategy')
          : (ar ? 'تحديث الاستراتيجية للعلامة الحالية' : 'Update strategy for current Brand Brain'),
        description: strategyBrandMismatch
          ? (ar
            ? 'المسودة الموجودة تبدو مرتبطة بذاكرة علامة سابقة. راجع التكلفة قبل إنشاء استراتيجية جديدة من Brand Brain الحالي.'
            : 'The existing draft appears tied to a previous Brand Brain. Review cost before creating a new strategy from the current Brand Brain.')
          : (ar
            ? 'سيتم تأكيد التكلفة قبل صرف أي رصيد.'
            : 'Cost is confirmed before any credits are spent.'),
        onClick: () => {
          setStartFreshStrategyRequest(hasStrategy)
          setRunStrategyOpen(true)
        },
      }
    : hasDraftStrategy
      ? {
          label: ar ? 'فتح بريف استراتيجية الحملة' : 'Open campaign strategy brief',
          description: strategyScope.paidOnly
            ? (ar ? 'هذا بريف تخطيط مدفوع للمراجعة فقط. لا ينشئ خطة Content Hub عضوية ولا يطلق إعلانات.' : 'This is a paid planning brief for review only. It does not create an organic Content Hub plan or launch ads.')
            : hasCurrentBrandOrganicData
              ? (ar ? 'الـ brief الكامل موجود داخل الحملة. راجعه قبل تحويله إلى Content Hub.' : 'The full strategy brief lives inside the campaign. Review it before turning it into Content Hub work.')
              : (ar ? 'افتح بريف الحملة الكامل قبل تحويله إلى محتوى.' : 'Open the full campaign brief before turning it into content.'),
          href: recentStrategyHref,
        }
      : {
          label: ar ? 'فتح بريف استراتيجية الحملة' : 'Open campaign strategy brief',
          description: strategyScope.paidOnly
            ? (ar ? 'افتح بريف التخطيط المدفوع الحالي. التنفيذ والصرف والنشر خطوات منفصلة ومقفلة.' : 'Open the current paid planning brief. Execution, spend, and publishing remain separate locked steps.')
            : hasCurrentBrandOrganicData
              ? (ar ? 'استخدم هذه الصفحة كمركز متابعة، وافتح بريف الحملة للمراجعة التفصيلية.' : 'Use this page as a strategy workbench, then open the campaign brief for detailed review.')
              : (ar ? 'افتح بريف الحملة الحالي.' : 'Open the current campaign brief.'),
          href: recentStrategyHref,
        }

  const nextSteps = !hasStrategy
      ? [
          ar ? 'أنشئ الاستراتيجية من ذاكرة العلامة التجارية' : 'Create strategy from Brand Brain',
          ar ? 'راجع الاتجاه قبل تحويله إلى محتوى' : 'Review direction before turning it into content',
          ar ? 'ولّد المحتوى إلى مركز المحتوى' : 'Generate content into Content Hub',
          ar ? 'جهّز خطة الإعلانات المدفوعة بعد الجاهزية والموافقة' : 'Prepare paid planning only after readiness and approval',
        ]
    : strategyBrandMismatch
      ? [
          ar ? 'حدّث الاستراتيجية من Brand Brain الحالي' : 'Update strategy from the current Brand Brain',
          ar ? 'راجع المسودة الجديدة قبل تحويلها إلى محتوى' : 'Review the new draft before turning it into content',
          ar ? 'لا تستخدم اتجاه المسودة القديمة للحملة الجديدة' : 'Do not use the old draft direction for the new brand',
          ar ? 'يبقى التخطيط المدفوع مرتبطاً بالموافقة' : 'Paid planning remains approval-gated',
        ]
    : hasDraftStrategy
      ? strategyScope.paidOnly
        ? [
            ar ? 'راجع بريف التخطيط المدفوع الحالي' : 'Review the current paid planning brief',
            ar ? 'أكمل التتبع والحسابات والموافقة قبل أي إطلاق' : 'Complete tracking, accounts, and approval before any launch',
            ar ? 'لا توجد خطة Content Hub عضوية من هذا التوليد' : 'No organic Content Hub plan was created by this run',
            ar ? 'لا صرف ولا نشر ولا إطلاق بدون تأكيد صريح' : 'No spend, publishing, or launch without explicit confirmation',
          ]
        : !includesPaidPlanning
          ? [
              ar ? 'راجع المسودة العضوية الحالية' : 'Review the current organic draft',
              ar ? 'تابع إلى Content Hub للمحتوى العضوي' : 'Continue to Content Hub for organic content',
              ar ? 'حضّر الجدول بعد الموافقة على المحتوى' : 'Prepare the schedule after content approval',
              ar ? 'التخطيط المدفوع غير مشمول؛ شغّل Paid أو Full لاحقاً عند الحاجة' : 'Paid planning is not included; run Paid or Full later if needed',
            ]
        : [
            ar ? 'راجع المسودة الحالية' : 'Review the current draft',
            ar ? 'تابع إلى مركز المحتوى' : 'Continue to Content Hub',
            ar ? 'حضّر الجدول بعد الموافقة على المحتوى' : 'Prepare the schedule after content approval',
            ar ? 'يبقى التخطيط المدفوع مرتبطاً بالموافقة' : 'Paid planning remains approval-gated',
          ]
      : [
          ...(strategyScope.paidOnly
            ? [
                ar ? 'تابع من بريف التخطيط المدفوع الحالي' : 'Continue from the current paid planning brief',
                ar ? 'راجع فرضيات الجمهور والزوايا قبل أي صرف' : 'Review audience hypotheses and angles before any spend',
                ar ? 'أكمل التتبع والحسابات والموافقة الصريحة' : 'Complete tracking, accounts, and explicit approval',
                ar ? 'لا توجد خطة Content Hub عضوية من هذا التوليد' : 'No organic Content Hub plan was created by this run',
              ]
            : !includesPaidPlanning
              ? [
                  ar ? 'تابع من الاستراتيجية العضوية الحالية' : 'Continue from the current organic strategy',
                  ar ? 'راجع اتجاه المحتوى العضوي' : 'Review the organic content direction',
                  ar ? 'حضّر الجدول بعد الموافقة على المحتوى' : 'Prepare the schedule after content approval',
                  ar ? 'التخطيط المدفوع غير مشمول؛ شغّل Paid أو Full لاحقاً عند الحاجة' : 'Paid planning is not included; run Paid or Full later if needed',
                ]
              : [
                ar ? 'تابع من الاستراتيجية الحالية' : 'Continue from the existing strategy',
                ar ? 'راجع اتجاه المحتوى العضوي' : 'Review the organic content direction',
                ar ? 'حضّر الجدول بعد الموافقة على المحتوى' : 'Prepare the schedule after content approval',
                ar ? 'استخدم التخطيط المدفوع فقط بعد الجاهزية والموافقة' : 'Use paid planning only after readiness and approval',
              ]),
        ]

  const brandActive = brandStatus === 'active'
  // STRATEGY-OS-1B — page labels use the same Strategy Brief readiness contract
  // as the generation modal, so Full cannot read ready when paid inputs are missing.
  // The headline remains the memory maturity STAGE (Early/Developing/Strong),
  // never a bare number.
  const readinessSurface = getStrategyPageReadinessSurface(brandProfile)
  const memStage = brandStatus === 'active'
    ? (ar ? 'قوية' : 'Strong')
    : brandStatus === 'building'
      ? (ar ? 'قيد التطوّر' : 'Developing')
      : (ar ? 'مبكرة' : 'Early')
  const capRows: { label: string; value: string; ready?: boolean }[] = [
    { label: ar ? 'طلب عضوي جديد' : 'New organic request',
      value: ar ? readinessSurface.organic.labelAr : readinessSurface.organic.label,
      ready: readinessSurface.organic.ready },
    { label: ar ? 'طلب كامل جديد' : 'New full request',
      value: ar ? readinessSurface.full.labelAr : readinessSurface.full.label,
      ready: readinessSurface.full.ready },
    { label: ar ? 'طلب تخطيط مدفوع جديد' : 'New paid planning request',
      value: ar ? readinessSurface.paid.labelAr : readinessSurface.paid.label,
      ready: readinessSurface.paid.ready },
    { label: ar ? 'النتائج' : 'Results', value: ar ? 'تُفحص من بيانات المنصات الفعلية' : 'Checked from real platform data' },
    { label: ar ? 'أتمتة النشر' : 'Publishing automation', value: ar ? 'تُراجع لكل حملة بعد الموافقات' : 'Reviewed per campaign after approvals' },
  ]

  const operatingModelSteps = [
    {
      label: ar ? 'Brand Brain' : 'Brand Brain',
      value: ar ? 'مدخلات العلامة والجمهور والقيود' : 'Brand, audience, and constraint inputs',
      href: '/brand',
    },
    {
      label: ar ? 'الاستراتيجية والحملة' : 'Strategy & campaign',
      value: ar ? 'النطاق والتكلفة ثم مساحة تنفيذ واحدة' : 'Scope, cost, then one execution workspace',
      href: '/strategy',
    },
    {
      label: ar ? 'المحتوى والإبداع' : 'Content & creative',
      value: ar ? 'إنتاج ومراجعة المنشورات والوسائط' : 'Post and media production review',
      href: recentContentHubHref,
    },
    {
      label: ar ? 'النشر والأتمتة' : 'Publishing & automation',
      value: ar ? 'تنفيذ بعد جاهزية الحسابات والموافقة الصريحة' : 'Execution after account readiness and explicit approval',
      href: recentPublishHref,
    },
    {
      label: ar ? 'النتائج' : 'Results',
      value: ar ? 'قياس حقيقي ثم مقترحات تعلّم للموافقة' : 'Real measurement, then learning proposals for approval',
      href: recentPerformanceHref,
    },
  ]

  const campaignTitle = recent?.name || brandName || (ar ? 'حملة استراتيجية جديدة' : 'New strategy campaign')
  const campaignSubtitle = !hasStrategy
    ? (ar ? 'لم يتم اختيار النطاق بعد' : 'Scope not selected yet')
    : strategyScope.paidOnly
      ? (ar ? 'بريف تخطيط مدفوع' : 'Paid planning brief')
      : includesPaidPlanning
        ? (ar ? 'استراتيجية شاملة' : 'Full strategy')
        : (ar ? 'استراتيجية نمو عضوي' : 'Organic growth strategy')
  const savedCampaignGoal = firstString(
    recent?.goal,
    strat?.goal,
    strat?.campaignGoal,
    strat?.strategicGoal,
    ai?.goal,
    ai?.campaignGoal,
  )
  const campaignGoal = savedCampaignGoal
    ? campaignGoalLabel(savedCampaignGoal, ar)
    : (ar ? 'لا يوجد هدف محفوظ في الاستراتيجية الحالية.' : 'No goal is saved in the current strategy.')
  const savedCampaignPositioning = firstString(
    strat?.positioning,
    strat?.brandPositioning,
    strat?.valueProposition,
    ai?.positioning,
    ai?.valueProposition,
  )
  const campaignPositioning = savedCampaignPositioning || (ar ? 'لا يوجد بيان تموضع محفوظ في الاستراتيجية الحالية.' : 'No positioning statement is saved in the current strategy.')
  const strategyAudienceLabels = uniqueLabels([
    firstString(strat?.targetAudienceRefined),
    ...asArray(strat?.targetAudience),
    ...asArray(strat?.audiences),
    ...asArray(strat?.audienceSegments),
    ...asArray(strat?.audienceSegmentsDetailed).map((item) => firstString(
      isRecord(item) ? item.segment : item,
      item,
    )),
    ...asArray(ai?.targetAudience),
    ...asArray(ai?.audiences),
    ...asArray(ai?.audienceSegments),
    ...asArray(ai?.audienceSegmentsDetailed).map((item) => firstString(
      isRecord(item) ? item.segment : item,
      item,
    )),
  ].map((item) => typeof item === 'string' ? item : textLabel(item)).filter(Boolean)).slice(0, 4)
  const brandAudienceFallback = firstString(brandProfile?.targetAudience)
  const audienceLabels = strategyAudienceLabels.length > 0
    ? strategyAudienceLabels
    : brandAudienceFallback
      ? [brandAudienceFallback]
      : []
  const audienceUsesBrandFallback = strategyAudienceLabels.length === 0 && Boolean(brandAudienceFallback)
  const safeAudiences = audienceLabels.length > 0 ? audienceLabels : [ar ? 'لا توجد شرائح جمهور محفوظة.' : 'No audience segments are saved.']
  const safePillars = pillars.length > 0 ? pillars : [ar ? 'لا توجد ركائز محتوى محفوظة.' : 'No content pillars are saved.']
  const strategyAngleHooks = asArray(strat?.contentAnglesDetailed).map(item => firstString(isRecord(item) ? item.hook : item))
  const safeMessages = uniqueLabels([
    firstString(strat?.keyMessage, ai?.keyMessage),
    firstString(strat?.differentiation, ai?.differentiation),
    ...strategyAngleHooks,
    ...hooks,
    ...ctas,
  ]).slice(0, 4)
  const messageCards = (safeMessages.length > 0 ? safeMessages : [ar ? 'لا توجد رسائل أساسية محفوظة.' : 'No core messages are saved.']).slice(0, 3)
  const audienceDetails = asArray(strat?.audienceSegmentsDetailed)
    .filter(isRecord)
    .slice(0, 4)
  const measurementPlan = isRecord(strat?.measurementPlan) ? strat.measurementPlan : null
  const operatingCadence = isRecord(strat?.operatingCadence) ? strat.operatingCadence : null
  const experimentBacklog = asArray(strat?.experimentBacklog).filter(isRecord).slice(0, 3)
  const decisionRules = asArray(strat?.decisionRules).filter(isRecord).slice(0, 3)
  const roadmapPhases = asArray(strat?.roadmap30_60_90).filter(isRecord).slice(0, 3)
  const savedRiskNotes = uniqueLabels([
    ...asArray(strat?.riskNotes).map(textLabel),
    ...asArray(strat?.assumptions).map(textLabel),
  ]).slice(0, 6)

  const coveragePercent = (checks: boolean[]) => Math.round((checks.filter(Boolean).length / checks.length) * 100)
  const dataConfidence = coveragePercent([
    brandActive,
    hasStrategy,
    hasCurrentBrandOrganicData,
    !platformSummary.isEmpty,
    !strategyBrandMismatch,
  ])
  const executionReadiness = coveragePercent([
    hasStrategy,
    pillars.length > 0,
    safeMessages.length > 0,
    !platformSummary.isEmpty,
    !strategyBrandMismatch,
  ])
  const positioningClarity = coveragePercent([
    Boolean(savedCampaignGoal),
    Boolean(savedCampaignPositioning),
    audienceLabels.length > 0,
  ])
  const messageStrength = coveragePercent([
    hooks.length > 0,
    ctas.length > 0,
    pillars.length > 0,
  ])
  const contentDirectionReady = Boolean(
    hasStrategy &&
    !strategyBrandMismatch &&
    !strategyScope.paidOnly &&
    audienceLabels.length > 0 &&
    pillars.length > 0 &&
    safeMessages.length > 0 &&
    !platformSummary.isEmpty
  )

  const channelRows = platformSummary.isEmpty
    ? [{ label: ar ? 'لم تُحدَّد قنوات في الاستراتيجية بعد' : 'No strategy channels selected yet', color: '#94A3B8' }]
    : platformSummary.labels.slice(0, 5).map((label, index) => ({
        label,
        color: ['#5E63FF', '#22C55E', '#0A66C2', '#F59E0B', '#EF4444'][index] ?? '#64748B',
      }))

  const strategicCards = [
    {
      icon: Target,
      title: ar ? 'الهدف الاستراتيجي' : 'Strategic goal',
      value: campaignGoal,
      score: positioningClarity,
      tone: '#5E63FF',
    },
    {
      icon: Users,
      title: ar ? 'شرائح الجمهور' : 'Audience segments',
      value: safeAudiences.slice(0, 2).join(' · '),
      score: audienceLabels.length > 0 ? 100 : 0,
      tone: '#2563EB',
    },
    {
      icon: Diamond,
      title: ar ? 'التموضع' : 'Positioning',
      value: campaignPositioning,
      score: positioningClarity,
      tone: '#7C3AED',
    },
    {
      icon: MessageCircle,
      title: ar ? 'الرسائل الرئيسية' : 'Core messages',
      value: messageCards[0],
      score: messageStrength,
      tone: '#22C55E',
    },
    {
      icon: Layers,
      title: ar ? 'ركائز المحتوى' : 'Content pillars',
      value: safePillars.slice(0, 2).join(' · '),
      score: pillars.length > 0 ? 100 : 0,
      tone: '#F59E0B',
    },
  ]

  const strategicCardDetailHrefs = [
    '#strategy-goal',
    '#strategy-audience',
    '#strategy-diagnosis',
    '#strategy-content',
    '#strategy-content',
  ]

  const workflowSteps = [
    { label: 'Brand Brain', number: '01', icon: Brain, status: ar ? 'تم' : 'Done', href: '/brand' },
    { label: ar ? 'الاستراتيجية' : 'Strategy', number: '02', icon: Target, status: ar ? 'الحالي' : 'Current', href: '/strategy' },
    { label: ar ? 'المحتوى والإبداع' : 'Content & creative', number: '03', icon: Lightbulb, status: contentDirectionReady ? (ar ? 'جاهز للمراجعة' : 'Ready for review') : (ar ? 'يحتاج استراتيجية' : 'Needs strategy'), href: recentContentHubHref },
    { label: ar ? 'النشر والأتمتة' : 'Publishing & automation', number: '04', icon: Send, status: ar ? 'بعد الموافقة' : 'After approval', href: recentPublishHref },
    { label: ar ? 'النتائج' : 'Results', number: '05', icon: BarChart3, status: ar ? 'بعد بيانات حقيقية' : 'After real data', href: recentPerformanceHref },
  ]

  const rawExecutionStages = [
    ...asArray(strat?.funnelStages),
    ...asArray(ai?.funnelStages),
  ]
  const rawWeeklyStages = rawExecutionStages.length > 0
    ? []
    : [...asArray(strat?.weeklyExecutionPlan), ...asArray(strat?.weeklyPlan)]
  const mappedExecutionStages = (rawExecutionStages.length > 0 ? rawExecutionStages : rawWeeklyStages)
    .slice(0, 4)
    .map((item) => {
      const record = isRecord(item) ? item : null
      const stageTitle = funnelStageLabel(record?.stage, ar)
      return {
        sourceKey: firstString(record?.stage, record?.week, record?.objective, record?.title, record?.name, item).toLowerCase(),
        title: stageTitle || firstString(record?.objective, record?.title, record?.name, item),
        detail: firstString(record?.message, record?.userMindset, record?.keyMessage, record?.nextStep, record?.contentType),
        cta: firstString(record?.cta),
      }
    })
    .filter((stage) => stage.title || stage.detail || stage.cta)
  const executionStageKeys = new Set<string>()
  const executionStages = mappedExecutionStages
    .filter((stage) => {
      const key = stage.sourceKey || stage.title.trim().toLowerCase()
      if (!key || executionStageKeys.has(key)) return false
      executionStageKeys.add(key)
      return true
    })
    .map((stage, index) => ({ ...stage, number: String(index + 1).padStart(2, '0') }))
  const duplicateExecutionStageCount = mappedExecutionStages.length - executionStages.length

  const sidebarSteps = [
    !hasStrategy
      ? { number: '01', title: ar ? 'إنشاء الاستراتيجية' : 'Create strategy', state: ar ? 'الخطوة الحالية' : 'Current step', detail: ar ? 'أنشئ أول استراتيجية من Brand Brain بعد مراجعة النطاق والتكلفة.' : 'Create the first strategy from Brand Brain after reviewing scope and cost.' }
      : { number: '01', title: ar ? 'مراجعة الاستراتيجية' : 'Review strategy', state: ar ? 'الحالي' : 'Current', detail: ar ? 'راجع المنطق قبل الانتقال إلى الإنتاج.' : 'Review logic before moving to production.' },
    { number: '02', title: ar ? 'تحويل إلى مركز المحتوى' : 'Move to Content Hub', state: contentDirectionReady ? (ar ? 'جاهز للإنشاء' : 'Ready to create') : (ar ? 'يحتاج مدخلات' : 'Needs inputs'), detail: contentDirectionReady ? (ar ? 'حوّل الركائز والرسائل إلى مسودات للمراجعة.' : 'Turn pillars and messages into review drafts.') : (ar ? 'أكمل الجمهور والرسائل والركائز والقنوات أولاً.' : 'Complete audience, messages, pillars, and channels first.') },
    { number: '03', title: ar ? 'فتح استوديو الإبداع' : 'Open Creative Studio', state: contentDirectionReady ? (ar ? 'بعد بريف المحتوى' : 'After content brief') : (ar ? 'مقفل' : 'Locked'), detail: ar ? 'أنتج الأصول البصرية بعد بريف محتوى واضح.' : 'Produce assets after a clear content brief.' },
    { number: '04', title: ar ? 'التحقق من جاهزية النشر' : 'Check publish readiness', state: ar ? 'في الانتظار' : 'Pending', detail: ar ? 'حسابات، صلاحيات، وموافقة صريحة.' : 'Accounts, permissions, and explicit approval.' },
  ]
  const strategyStatusText = !hasStrategy
    ? (ar ? 'لم يتم إنشاء استراتيجية بعد' : 'Strategy not created yet')
    : strategyBrandMismatch
      ? (ar ? 'المسودة الحالية قد لا تطابق Brand Brain الحالي' : 'Existing draft may not match current Brand Brain')
      : hasDraftStrategy
        ? (ar ? 'مسودة استراتيجية جاهزة للمراجعة' : 'Draft strategy ready for review')
        : (ar ? `استراتيجية مرتبطة بحملة: ${recent?.name}` : `Strategy linked to campaign: ${recent?.name}`)
  const strategySummaryLabel = hasStrategy && !strategyBrandMismatch
    ? (ar ? 'محفوظة' : 'Saved')
    : strategyBrandMismatch
      ? (ar ? 'تحتاج تحديثًا' : 'Needs update')
      : (ar ? 'لم تُنشأ' : 'Not created')
  const strategyInputChecks = [
    Boolean(savedCampaignGoal),
    audienceLabels.length > 0,
    Boolean(savedCampaignPositioning),
    safeMessages.length > 0,
    pillars.length > 0,
    !platformSummary.isEmpty,
  ]
  const savedStrategyInputCount = strategyInputChecks.filter(Boolean).length
  const missingStrategyInputCount = strategyInputChecks.length - savedStrategyInputCount
  const readinessCards = [
    { title: ar ? 'تغطية التموقع' : 'Positioning coverage', value: positioningClarity, label: ar ? 'مدخلات محفوظة' : 'Saved inputs', icon: Diamond, color: '#22C55E' },
    { title: ar ? 'تغطية الرسائل' : 'Message coverage', value: messageStrength, label: ar ? 'مدخلات محفوظة' : 'Saved inputs', icon: MessageCircle, color: '#5E63FF' },
    { title: ar ? 'تغطية مدخلات التنفيذ' : 'Execution input coverage', value: executionReadiness, label: ar ? 'ليست وعد أداء' : 'Not a performance score', icon: Rocket, color: '#7C3AED' },
    { title: ar ? 'تغطية المصادر' : 'Source coverage', value: dataConfidence, label: ar ? 'ليست ثقة إحصائية' : 'Not statistical confidence', icon: BarChart3, color: '#F59E0B' },
  ]
  const currentTruthRows = [
    {
      label: ar ? 'مصدر الحقيقة الحالي' : 'Current source of truth',
      value: ar ? 'الاستراتيجية تحدد الاتجاه؛ Content Hub يحولها إلى منشورات.' : 'Strategy sets direction; Content Hub turns it into posts.',
    },
    {
      label: ar ? 'ما لم يحدث هنا' : 'What does not happen here',
      value: ar ? 'لا نشر، لا صرف إعلاني، لا جدولة، ولا تعلم أداء بدون تحليلات.' : 'No publishing, ad spend, scheduling, or performance learning without analytics.',
    },
    {
      label: ar ? 'قرار المستخدم التالي' : 'Next user decision',
      value: nextSteps[0],
    },
  ]

  // Redirecting to login — render nothing (avoids an infinite spinner when
  // there is no authenticated session).
  if (!authLoading && !isAuthenticated) return null

  if (authLoading || loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-7 h-7 animate-spin" style={{ color: '#8B5CF6' }} />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-[#F8FAFF]">
        <div className="mx-auto max-w-[1580px] px-3 py-5 sm:px-5 lg:px-7">
          <LuxuryWorkspaceHeader
            pageTitle={ar ? 'الاستراتيجية' : 'Strategy'}
            pageSubtitle={hasStrategy
              ? (ar ? `استراتيجية الحملة: ${campaignTitle}` : `Campaign strategy: ${campaignTitle}`)
              : (ar ? `العلامة المرجعية: ${brandName || 'Brand Brain'}` : `Source brand: ${brandName || 'Brand Brain'}`)}
            primaryHref={null}
            secondaryHref={null}
          />

          <div className="hidden">
            <Link href="/campaigns" className="hover:text-[#5E63FF]">{ar ? 'الحملات' : 'Campaigns'}</Link>
            <span>›</span>
            <span>{campaignTitle}</span>
            <span>›</span>
            <span className="text-[#5E63FF]">{ar ? 'الاستراتيجية' : 'Strategy'}</span>
          </div>

          <SoftCard className="mb-4 overflow-hidden p-4" dir="ltr">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,620px)_1fr] xl:items-center">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
	                <div className="hidden">
	                  {recent?.thumbnail ? (
	                    // eslint-disable-next-line @next/next/no-img-element
	                    <img src={recent.thumbnail} alt={campaignTitle} className="h-full w-full object-cover" />
	                  ) : (
	                    <div className="relative h-full w-full overflow-hidden bg-[radial-gradient(circle_at_28%_18%,rgba(255,255,255,0.92),transparent_26%),linear-gradient(135deg,#DCE5F4_0%,#FFFFFF_46%,#D4B27D_100%)]">
	                      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(7,19,51,0.16),transparent_44%,rgba(94,99,255,0.18))]" />
	                      <div className="absolute bottom-5 left-7 h-14 w-16 rounded-b-[22px] rounded-t-md bg-[#071333] shadow-[0_16px_32px_rgba(7,19,51,0.26)]">
	                        <div className="absolute -right-4 top-4 h-7 w-7 rounded-full border-4 border-[#071333]" />
	                        <div className="flex h-full flex-col items-center justify-center text-center">
	                          <Sparkles className="mb-1 h-4 w-4 text-[#C7D2FE]" />
	                          <span className="text-[9px] font-black tracking-[0.22em] text-white">NEXUS</span>
	                        </div>
	                      </div>
	                      <div className="absolute bottom-4 right-4 rounded-full bg-white/80 px-3 py-1 text-[10px] font-black text-[#5E63FF] shadow-sm">
	                        {ar ? 'مسار استراتيجي' : 'Strategy path'}
	                      </div>
	                    </div>
	                  )}
	                </div>
                <div className="min-w-0 flex-1" dir={ar ? 'rtl' : 'ltr'}>
                  <div className="flex flex-wrap items-center gap-2">
	                    <h2 className="max-w-full overflow-hidden text-[22px] font-black leading-8 tracking-normal text-[#0B1028] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] sm:text-[24px]">
	                      {campaignTitle}
	                    </h2>
                    <span className={`rounded-full px-3 py-1 text-[12px] font-black ${hasStrategy && !strategyBrandMismatch ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
	                      {strategyStatusText}
                    </span>
                  </div>
                  <p className="mt-1 max-w-2xl text-[13px] font-semibold leading-6 text-slate-500">{campaignGoal}</p>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-[12px] font-bold text-slate-600 md:grid-cols-4">
                    <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[#5E63FF]" />{formatShortDate(recent?.createdAt, locale)}</div>
                    <div className="flex items-center gap-2"><RefreshCw className="h-4 w-4 text-[#5E63FF]" />{formatShortDate(recent?.updatedAt, locale)}</div>
                    <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#5E63FF]" />{memStage}</div>
                    <div className="flex items-center gap-2"><Megaphone className="h-4 w-4 text-[#5E63FF]" />{campaignSubtitle}</div>
                  </div>
                </div>
              </div>

              <div className="hidden" dir={ar ? 'rtl' : 'ltr'}>
                {workflowSteps.map((step, index) => {
                  const Icon = step.icon
                  const active = index === 1
                  const done = index === 0
                  return (
                    <Link key={step.number} href={step.href} className="group relative flex min-w-[84px] flex-col items-center gap-2">
                      {index > 0 ? <span className="absolute top-7 hidden h-px w-8 -translate-x-[58px] border-t border-dashed border-slate-300 xl:block" /> : null}
                      <div
                        className={`flex h-14 w-14 items-center justify-center rounded-2xl border text-sm font-black transition ${active ? 'border-[#5E63FF] bg-[#F7F5FF] text-[#5E63FF] shadow-[0_16px_34px_rgba(94,99,255,0.18)]' : done ? 'border-emerald-100 bg-white text-emerald-600' : 'border-slate-200 bg-white text-slate-500 group-hover:border-[#C7D2FE]'}`}
                      >
                        {done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                      </div>
                      <div className="text-center">
                        <p className="text-[11px] font-black text-slate-400">{step.number}</p>
                        <p className="text-[12px] font-black text-slate-700">{step.label}</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          </SoftCard>

          <div dir="ltr">
            <div className="space-y-4" dir={ar ? 'rtl' : 'ltr'}>
              <SoftCard id="strategy-executive" className="scroll-mt-6 overflow-hidden border-[#C7D2FE] bg-[linear-gradient(135deg,#FFFFFF,#F6F5FF)] p-4" dir="ltr">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_310px] lg:items-center">
	                  <div className="hidden">
	                    <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-[radial-gradient(circle,#C7D2FE_0%,#7C83FF_38%,#EEF2FF_64%,transparent_70%)] shadow-[0_24px_62px_rgba(94,99,255,0.24)]">
	                      <Sparkles className="h-10 w-10 text-white drop-shadow" />
	                    </div>
	                  </div>
	                  <div dir={ar ? 'rtl' : 'ltr'}>
	                    <p className="text-[12px] font-black text-[#5E63FF]">{ar ? 'ملخص الاتجاه الاستراتيجي' : 'Strategic direction summary'}</p>
	                    <h2 className="mt-2 max-w-3xl overflow-hidden text-[18px] font-black leading-7 text-[#0B1028] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]">
	                      {campaignPositioning}
	                    </h2>
	                    <div id="strategy-diagnosis" className="mt-3 grid scroll-mt-6 gap-2 sm:grid-cols-3">
	                      {[
	                        [ar ? 'سجل الاستراتيجية' : 'Strategy record', hasStrategy ? (ar ? 'محفوظ' : 'Saved') : (ar ? 'مفقود' : 'Missing')],
	                        [ar ? 'مصدر المدخلات' : 'Input source', 'Brand Brain'],
                        [ar ? 'نطاق الاستراتيجية' : 'Strategy scope', campaignSubtitle],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                          <p className="text-[11px] font-black text-slate-400">{label}</p>
                          <p className="mt-1 text-[15px] font-black text-[#0B1028]">{value}</p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[10px] font-semibold text-slate-400">
                      {ar ? 'أي نسب جاهزية هنا تقيس اكتمال المدخلات والتشغيل، وليست أداءً فعليًا أو وعدًا بالنتائج.' : 'Numbers here are operational readiness, not actual performance.'}
                    </p>
                    <div className="hidden">
                      {readinessCards.map((card) => {
                        const Icon = card.icon
                        return (
                          <div key={card.title} className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-[11px] font-black text-slate-500">{card.title}</p>
                                <p className="text-[17px] font-black leading-6 text-[#0B1028]">{card.value}%</p>
                              </div>
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: `${card.color}14`, color: card.color }}>
                                <Icon className="h-4 w-4" />
                              </span>
                            </div>
                            <ProgressBar value={card.value} color={card.color} />
                          </div>
                        )
                      })}
                    </div>
                  </div>
	                  <div className="flex flex-wrap justify-end gap-2" dir={ar ? 'rtl' : 'ltr'}>
	                    <div className="hidden">
	                      <ReadinessRing value={dataConfidence} label={ar ? 'تغطية المصادر' : 'Source coverage'} size="sm" />
	                    </div>
	                    <div className="hidden">
	                      <p className="text-[12px] font-black text-slate-500">{ar ? 'تغطية التنفيذ' : 'Execution coverage'}</p>
	                      <p className="text-[24px] font-black text-[#0B1028]">{executionReadiness}%</p>
                      <ProgressBar value={executionReadiness} />
                    </div>
	                    <div className="flex flex-wrap gap-2">
	                      {'href' in primaryAction ? (
	                        <Link href={primaryAction.href} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#071333] px-4 text-[13px] font-black text-white">
	                          <CheckCircle2 className="h-4 w-4" />
	                          {primaryAction.label}
	                        </Link>
	                      ) : (
	                        <button type="button" onClick={primaryAction.onClick} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#071333] px-4 text-[13px] font-black text-white">
	                          <Sparkles className="h-4 w-4" />
	                          {primaryAction.label}
	                        </button>
	                      )}
	                      {'href' in primaryAction && (
	                        <button type="button" onClick={() => {
	                          setStartFreshStrategyRequest(true)
	                          setRunStrategyOpen(true)
	                        }}
	                          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 text-[12px] font-black text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100">
	                          <Sparkles className="h-4 w-4" />
	                          {ar ? 'طلب استراتيجية جديد' : 'New strategy request'}
	                        </button>
	                      )}
	                    </div>
                  </div>
                </div>
              </SoftCard>

	              <div id="strategy-goal" className="hidden">
	                {strategicCards.map((item, index) => {
	                  const Icon = item.icon
	                  return (
	                    <SoftCard key={item.title} className="min-h-[168px] p-3">
	                      <div className="mb-2 flex items-center justify-between">
	                        <div className="flex h-9 w-9 items-center justify-center rounded-2xl" style={{ background: `${item.tone}14`, color: item.tone }}>
	                          <Icon className="h-5 w-5" />
	                        </div>
	                        <span className="text-[11px] font-black text-slate-400">{String(index + 1).padStart(2, '0')}</span>
	                      </div>
	                      <h3 className="text-[14px] font-black text-[#0B1028]">{item.title}</h3>
	                      <p className="mt-2 min-h-[44px] overflow-hidden text-[12px] font-semibold leading-5 text-slate-500 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]">{item.value}</p>
	                      <a href={strategicCardDetailHrefs[index] ?? '#strategy-executive'} className="mt-2 inline-flex text-[12px] font-black text-[#5E63FF]">{ar ? 'عرض التفاصيل' : 'View details'}</a>
	                    </SoftCard>
	                  )
                })}
              </div>

              <SoftCard className="overflow-hidden">
                <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                  <div className="space-y-4">
                    <div id="strategy-audience" className="scroll-mt-6">
                      <div className="mb-3 flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#5E63FF]"><Users className="h-4 w-4" /></span>
                        <h3 className="text-[17px] font-black text-[#0B1028]">{ar ? 'شرائح الجمهور' : 'Audience segments'}</h3>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {(audienceDetails.length > 0 ? audienceDetails : safeAudiences.slice(0, 4)).map((item, index) => {
                          const detail = isRecord(item) ? item : null
                          const audience = firstString(detail?.segment, item)
                          return (
                            <div key={`${audience}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-[14px] font-black text-[#0B1028]">{audience}</p>
                                <span className="rounded-full bg-white px-2 py-1 text-[11px] font-black text-[#5E63FF]">{String(index + 1).padStart(2, '0')}</span>
                              </div>
                              {detail ? (
                                <div className="mt-3 space-y-2 text-[12px] leading-5">
                                  <p><span className="font-black text-slate-700">{ar ? 'الموقف: ' : 'Situation: '}</span><span className="font-semibold text-slate-500">{firstString(detail.situation)}</span></p>
                                  <p><span className="font-black text-slate-700">{ar ? 'الألم: ' : 'Pain: '}</span><span className="font-semibold text-slate-500">{firstString(detail.pain)}</span></p>
                                  <p><span className="font-black text-slate-700">{ar ? 'الاعتراض: ' : 'Objection: '}</span><span className="font-semibold text-slate-500">{firstString(detail.objection)}</span></p>
                                  <p className="rounded-xl bg-white px-3 py-2 font-bold text-[#4F46E5]">{firstString(detail.message, detail.cta)}</p>
                                </div>
                              ) : (
                                <p className="mt-2 text-[12px] font-semibold leading-5 text-slate-500">
                                  {audienceUsesBrandFallback
                                    ? (ar ? 'سياق محفوظ في Brand Brain؛ يحتاج تفصيلًا تشغيليًا داخل الاستراتيجية.' : 'Saved Brand Brain context; operational detail is still needed in strategy.')
                                    : (ar ? 'شريحة محفوظة؛ لم يفترض NEXUS حجمها أو أولويتها.' : 'Saved segment; NEXUS has not inferred its size or priority.')}
                                </p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div id="strategy-content" className="grid scroll-mt-6 gap-4 lg:grid-cols-2">
                      <div className="rounded-[20px] border border-slate-200 bg-white p-4">
                        <h3 className="mb-3 flex items-center gap-2 text-[15px] font-black text-[#0B1028]"><MessageCircle className="h-4 w-4 text-[#5E63FF]" />{ar ? 'ملخص الرسائل الأساسية' : 'Core message summary'}</h3>
                        <div className="space-y-2">
                          {messageCards.map((message, index) => (
                            <div key={message} className="rounded-2xl bg-slate-50 px-3 py-2">
                              <p className="text-[12px] font-black text-[#5E63FF]">{ar ? `رسالة ${index + 1}` : `Message ${index + 1}`}</p>
                              <p className="mt-1 text-[13px] font-semibold text-slate-600">{message}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-[20px] border border-slate-200 bg-white p-4">
                        <h3 className="mb-3 flex items-center gap-2 text-[15px] font-black text-[#0B1028]"><Layers className="h-4 w-4 text-[#5E63FF]" />{ar ? 'أعمدة المحتوى' : 'Content pillars'}</h3>
                        <div className="space-y-2">
                          {safePillars.slice(0, 5).map((pillar, index) => (
                            <div key={pillar} className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2">
                              <span className="text-[13px] font-bold text-slate-700">{pillar}</span>
                              <span className="rounded-full px-2 py-1 text-[11px] font-black" style={{ background: ['#ECFDF5', '#EEF2FF', '#FEF3C7', '#FCE7F3', '#F1F5F9'][index], color: ['#059669', '#5E63FF', '#D97706', '#BE185D', '#64748B'][index] }}>
                                {pillars.length > 0 ? (ar ? 'ضمن النطاق' : 'In scope') : (ar ? 'مفقود' : 'Missing')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div id="strategy-measurement" className="scroll-mt-6 rounded-[20px] border border-slate-200 bg-white p-4">
	                      <h3 className="mb-4 flex items-center gap-2 text-[15px] font-black text-[#0B1028]"><PieChart className="h-4 w-4 text-[#5E63FF]" />{ar ? 'قنوات الاستراتيجية' : 'Strategy channels'}</h3>
                      <div className="grid gap-4 sm:grid-cols-[130px_minmax(0,1fr)] sm:items-center">
                        <div className="flex justify-center">
                          <div className="flex h-28 w-28 items-center justify-center rounded-full border-[12px] border-[#E8EBFF] bg-white">
                            <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-white text-center">
                              <span className="text-[24px] font-black text-[#0B1028]">{platformSummary.labels.length}</span>
	                              <span className="text-[10px] font-bold text-slate-400">{ar ? 'قنوات الاستراتيجية' : 'strategy channels'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {channelRows.map((row) => (
                            <div key={row.label} className="flex items-center justify-between gap-3">
                              <PlatformDot label={row.label} color={row.color} />
                              <span className="text-[12px] font-black text-slate-500">{platformSummary.isEmpty ? (ar ? 'مفقود' : 'Missing') : (ar ? 'ضمن النطاق' : 'In scope')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="hidden">
                      <h3 className="mb-4 flex items-center gap-2 text-[15px] font-black text-[#0B1028]"><BarChart3 className="h-4 w-4 text-[#5E63FF]" />{ar ? 'مؤشرات تغطية المدخلات' : 'Input coverage indicators'}</h3>
                      <div className="space-y-3">
                        {[
                          [ar ? 'تغطية المصادر' : 'Source coverage', dataConfidence],
                          [ar ? 'تغطية التنفيذ' : 'Execution coverage', executionReadiness],
                          [ar ? 'تغطية الرسائل' : 'Message coverage', messageStrength],
                          [ar ? 'تغطية التموقع' : 'Positioning coverage', positioningClarity],
                        ].map(([label, value]) => (
                          <div key={String(label)}>
                            <div className="mb-1 flex items-center justify-between text-[12px] font-bold text-slate-600">
                              <span>{label}</span>
                              <span>{value}%</span>
                            </div>
                            <ProgressBar value={Number(value)} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </SoftCard>

              {hasStrategy && (
                <div className="grid gap-4 xl:grid-cols-2">
                  <SoftCard id="strategy-operating-system" className="scroll-mt-6 p-4">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="flex items-center gap-2 text-[16px] font-black text-[#0B1028]"><Gauge className="h-4 w-4 text-[#5E63FF]" />{ar ? 'نظام القياس والتشغيل' : 'Measurement & operating system'}</h3>
                        <p className="mt-1 text-[12px] font-semibold leading-5 text-slate-500">{ar ? 'ما الذي نقيسه، وكيف نراجع، ومن يملك القرار. لا توجد أهداف أداء مخترعة.' : 'What gets measured, how reviews run, and who owns the decision. No invented performance targets.'}</p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-700">{ar ? 'تشغيلي' : 'Operational'}</span>
                    </div>
                    <div className="space-y-3">
                      {[
                        [ar ? 'النتيجة الأساسية' : 'Primary outcome', firstString(measurementPlan?.primaryOutcome)],
                        [ar ? 'حالة خط الأساس' : 'Baseline status', firstString(measurementPlan?.baselineStatus)],
                        [ar ? 'قاعدة الإسناد' : 'Attribution rule', firstString(measurementPlan?.attributionRule)],
                        [ar ? 'وتيرة المراجعة' : 'Review cadence', firstString(measurementPlan?.reportingCadence)],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-2xl bg-slate-50 px-3 py-2">
                          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p>
                          <p className="mt-1 text-[12px] font-semibold leading-5 text-slate-700">{value || (ar ? 'يحتاج تأكيدًا' : 'Needs confirmation')}</p>
                        </div>
                      ))}
                      <div className="grid gap-2 sm:grid-cols-3">
                        {[
                          [ar ? 'يوميًا' : 'Daily', asArray(operatingCadence?.daily)],
                          [ar ? 'أسبوعيًا' : 'Weekly', asArray(operatingCadence?.weekly)],
                          [ar ? 'شهريًا' : 'Monthly', asArray(operatingCadence?.monthly)],
                        ].map(([label, items]) => (
                          <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-3">
                            <p className="text-[11px] font-black text-[#5E63FF]">{String(label)}</p>
                            <p className="mt-2 text-[11px] font-semibold leading-5 text-slate-600">{firstString(...(items as unknown[])) || (ar ? 'يحتاج اتفاقًا تشغيليًا' : 'Needs an operating agreement')}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </SoftCard>

                  <SoftCard id="strategy-decision-rules" className="scroll-mt-6 p-4">
                    <h3 className="flex items-center gap-2 text-[16px] font-black text-[#0B1028]"><ShieldCheck className="h-4 w-4 text-[#5E63FF]" />{ar ? 'قواعد القرار' : 'Decision rules'}</h3>
                    <p className="mt-1 text-[12px] font-semibold leading-5 text-slate-500">{ar ? 'متى نستمر، نعدّل، أو نوقف — قبل أن تتحول المراقبة إلى تغيير عشوائي.' : 'When to continue, iterate, or stop—before monitoring turns into random changes.'}</p>
                    <div className="mt-4 space-y-3">
                      {decisionRules.map((rule, index) => (
                        <div key={`${firstString(rule.signal)}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                          <p className="text-[12px] font-black text-[#0B1028]">{firstString(rule.signal)}</p>
                          <div className="mt-2 grid gap-2 text-[11px] leading-5 sm:grid-cols-3">
                            <p className="rounded-xl bg-emerald-50 px-2 py-1.5 font-semibold text-emerald-800"><span className="font-black">{ar ? 'استمر: ' : 'Continue: '}</span>{firstString(rule.continueWhen)}</p>
                            <p className="rounded-xl bg-amber-50 px-2 py-1.5 font-semibold text-amber-800"><span className="font-black">{ar ? 'عدّل: ' : 'Iterate: '}</span>{firstString(rule.iterateWhen)}</p>
                            <p className="rounded-xl bg-rose-50 px-2 py-1.5 font-semibold text-rose-800"><span className="font-black">{ar ? 'أوقف: ' : 'Stop: '}</span>{firstString(rule.stopWhen)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </SoftCard>
                </div>
              )}

              {hasStrategy && (
                <SoftCard id="strategy-experiments" className="scroll-mt-6 p-4">
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h3 className="flex items-center gap-2 text-[16px] font-black text-[#0B1028]"><Lightbulb className="h-4 w-4 text-[#5E63FF]" />{ar ? 'قائمة التجارب وخارطة 30/60/90' : 'Experiment backlog & 30/60/90 roadmap'}</h3>
                      <p className="mt-1 text-[12px] font-semibold text-slate-500">{ar ? 'اختبار متغير واحد ثم الانتقال عند بوابة دليل واضحة.' : 'Test one variable at a time and advance through evidence gates.'}</p>
                    </div>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                    <div className="grid gap-3 md:grid-cols-3">
                      {experimentBacklog.map((experiment, index) => (
                        <div key={`${firstString(experiment.hypothesis)}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase text-[#5E63FF]">{firstString(experiment.priority) || (ar ? 'لاحقًا' : 'later')}</span>
                            <span className="text-[10px] font-bold text-slate-400">{String(index + 1).padStart(2, '0')}</span>
                          </div>
                          <p className="mt-2 text-[12px] font-black leading-5 text-[#0B1028]">{firstString(experiment.hypothesis)}</p>
                          <p className="mt-2 text-[11px] font-semibold leading-5 text-slate-500"><span className="font-black text-slate-700">{ar ? 'المتغير: ' : 'Variable: '}</span>{firstString(experiment.variable)}</p>
                          <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-500"><span className="font-black text-slate-700">{ar ? 'قاعدة القرار: ' : 'Decision: '}</span>{firstString(experiment.decisionRule)}</p>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {roadmapPhases.map((phase, index) => (
                        <div key={`${firstString(phase.phase)}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-3">
                          <p className="text-[10px] font-black uppercase tracking-wide text-[#5E63FF]">{firstString(phase.phase).replace(/_/g, ' ')}</p>
                          <p className="mt-1 text-[12px] font-black text-[#0B1028]">{firstString(phase.objective)}</p>
                          <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-500"><span className="font-black">{ar ? 'بوابة الانتقال: ' : 'Exit gate: '}</span>{firstString(phase.exitGate)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </SoftCard>
              )}

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <SoftCard id="strategy-execution" className="scroll-mt-6 p-4">
                  <h3 className="mb-4 flex items-center gap-2 text-[16px] font-black text-[#0B1028]"><Rocket className="h-4 w-4 text-[#5E63FF]" />{ar ? 'مراحل التنفيذ المحفوظة' : 'Saved execution stages'}</h3>
                  {duplicateExecutionStageCount > 0 ? (
                    <div className="mb-3 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <p className="text-[12px] font-semibold leading-5">
                        {ar
                          ? `تم استبعاد ${duplicateExecutionStageCount} مرحلة مكررة من الملخص. راجع البريف الكامل قبل التنفيذ.`
                          : `${duplicateExecutionStageCount} duplicate saved stage ${duplicateExecutionStageCount === 1 ? 'was' : 'were'} omitted from this summary. Review the full brief before execution.`}
                      </p>
                    </div>
                  ) : null}
                  {executionStages.length > 0 ? (
                    <div className={`grid gap-3 ${executionStages.length >= 4 ? 'md:grid-cols-4' : executionStages.length === 3 ? 'md:grid-cols-3' : executionStages.length === 2 ? 'md:grid-cols-2' : ''}`}>
                    {executionStages.map((phase) => (
                      <div key={phase.number} className="rounded-[18px] border border-slate-200 bg-slate-50/60 p-4">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#5E63FF] text-[12px] font-black text-white">{phase.number}</span>
                        <h4 className="mt-3 text-[14px] font-black text-[#0B1028]">{phase.title}</h4>
                        {phase.detail ? <p className="mt-2 min-h-[44px] text-[12px] font-semibold leading-5 text-slate-500">{phase.detail}</p> : null}
                        {phase.cta ? <span className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-black text-[#5E63FF]">{phase.cta}</span> : null}
                      </div>
                    ))}
                    </div>
                  ) : (
                    <div className="rounded-[18px] border border-dashed border-slate-300 bg-slate-50/70 p-5">
                      <p className="text-[13px] font-black text-[#0B1028]">{ar ? 'لا توجد مراحل تنفيذ محفوظة.' : 'No execution stages are saved.'}</p>
                      <p className="mt-1 text-[12px] font-semibold text-slate-500">{ar ? 'افتح بريف الحملة لمراجعة الخطة الكاملة؛ لن يفترض NEXUS مراحل غير موجودة.' : 'Open the campaign brief to review the full plan; NEXUS will not invent missing stages.'}</p>
                    </div>
                  )}
                </SoftCard>

                <SoftCard id="strategy-risks" className="scroll-mt-6 p-4">
                  <h3 className="mb-4 flex items-center gap-2 text-[16px] font-black text-[#0B1028]"><AlertTriangle className="h-4 w-4 text-amber-500" />{ar ? 'المخاطر والافتراضات' : 'Risks and assumptions'}</h3>
                  <div className="space-y-2">
                    {(savedRiskNotes.length > 0 ? savedRiskNotes : [
                      ar ? 'لا توجد مخاطر محفوظة؛ يحتاج البريف إلى مراجعة قبل التنفيذ.' : 'No risks are saved; the brief needs review before execution.',
                    ]).map((item, index) => (
                      <div key={item} className="flex items-start gap-2 rounded-2xl bg-slate-50 px-3 py-2">
                        <span className={`mt-1 h-2 w-2 rounded-full ${index < 3 ? 'bg-amber-400' : 'bg-slate-300'}`} />
                        <p className="text-[12px] font-semibold leading-5 text-slate-600">{item}</p>
                      </div>
                    ))}
                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 px-3 py-2 text-[11px] font-semibold leading-5 text-indigo-800">
                      {ar ? 'حدود ثابتة: لا نشر أو صرف أو توسيع دون صلاحية وموافقة ودليل قابل للمراجعة.' : 'Fixed boundary: no publishing, spend, or scaling without permission, approval, and reviewable evidence.'}
                    </div>
                  </div>
                </SoftCard>
              </div>

              <SoftCard className="hidden">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-[16px] font-black text-[#0B1028]">{ar ? 'كيف تغذي هذه الاستراتيجية بقية النظام' : 'How this strategy feeds the rest of the system'}</h3>
                    <p className="mt-1 text-[13px] font-semibold text-slate-500">
                      {ar ? 'المسار الجديد يربط القرار بالمحتوى والإبداع والنشر والأداء بدون خلط بين التخطيط والتنفيذ.' : 'The new path connects decision, content, creative, publishing, and performance without mixing planning with execution.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {operatingModelSteps.map((step) => (
                      <Link key={step.label} href={step.href} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-black text-slate-600 hover:border-[#C7D2FE] hover:text-[#5E63FF]">
                        {step.label}
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    ))}
                  </div>
                </div>
              </SoftCard>

            </div>

            <aside className="hidden" dir={ar ? 'rtl' : 'ltr'}>
              <SoftCard className="hidden">
                <p className="mb-1 text-[11px] font-black text-[#5E63FF]">
                  {ar ? 'الخطوات الاستراتيجية التالية' : 'Next strategic steps'}
                </p>
                <h2 className="mb-4 flex items-center gap-2 text-[15px] font-black text-[#0B1028]">
                  <Sparkles className="h-4 w-4 text-[#5E63FF]" />
                  {ar ? 'الإجراءات التالية' : 'Next actions'}
                </h2>
                <div className="space-y-4">
                  {sidebarSteps.map((step) => (
                    <div key={step.number} className="relative ps-9">
                      <span className="absolute start-0 top-0 flex h-7 w-7 items-center justify-center rounded-full border border-[#C7D2FE] bg-white text-[11px] font-black text-[#5E63FF]">{step.number}</span>
                      <p className="text-[13px] font-black text-[#0B1028]">{step.title}</p>
                      <p className="mt-1 text-[11px] font-bold text-[#5E63FF]">{step.state}</p>
                      <p className="mt-1 text-[12px] font-semibold leading-5 text-slate-500">{step.detail}</p>
                    </div>
                  ))}
                </div>
              </SoftCard>

              <SoftCard className="order-2 p-4">
                <h2 className="mb-4 flex items-center gap-2 text-[15px] font-black text-[#0B1028]">
                  <ShieldCheck className="h-4 w-4 text-[#5E63FF]" />
                  {ar ? 'ملخص الحملة' : 'Campaign summary'}
                </h2>
                <div className="space-y-3 text-[12px] font-semibold">
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2">
                    <span className="text-slate-500">{ar ? 'الحالة' : 'Status'}</span>
                    <span className={`font-black ${hasStrategy && !strategyBrandMismatch ? 'text-emerald-600' : 'text-slate-600'}`}>{strategySummaryLabel}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2">
                    <span className="text-slate-500">{ar ? 'النطاق' : 'Scope'}</span>
                    <span className="font-black text-[#0B1028]">{campaignSubtitle}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2">
                    <span className="text-slate-500">{ar ? 'آخر تحديث' : 'Last update'}</span>
                    <span className="font-black text-[#0B1028]">{formatShortDate(recent?.updatedAt, locale)}</span>
                  </div>
                </div>
              </SoftCard>

              <SoftCard className="hidden">
                <h2 className="mb-4 flex items-center gap-2 text-[15px] font-black text-[#0B1028]">
                  <Gauge className="h-4 w-4 text-[#5E63FF]" />
                  {ar ? 'جاهزية التنفيذ' : 'Execution readiness'}
                </h2>
                <div className="flex justify-center">
                <ReadinessRing value={executionReadiness} label={ar ? 'تغطية مدخلات' : 'Input coverage'} />
                </div>
                <div className="mt-4 space-y-2">
                  {capRows.slice(0, 4).map((row) => (
                    <div key={row.label} className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2">
                      <span className="text-[12px] font-bold text-slate-500">{row.label}</span>
                      <span className={`text-[12px] font-black ${row.ready ? 'text-emerald-600' : 'text-slate-500'}`}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </SoftCard>

              <SoftCard className="order-first p-4">
                <h2 className="mb-4 flex items-center gap-2 text-[15px] font-black text-[#0B1028]">
                  <Rocket className="h-4 w-4 text-[#5E63FF]" />
                  {ar ? 'الخطوة التالية الموصى بها' : 'Recommended next step'}
                </h2>
                <p className="text-[13px] font-semibold leading-6 text-slate-500">{contentDirectionReady ? (ar ? 'الانتقال إلى Content Hub لإنشاء مسودات قابلة للمراجعة.' : 'Move to Content Hub to create reviewable drafts.') : nextSteps[0]}</p>
                {contentDirectionReady ? (
                  <Link href={recentContentHubHref} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#071333] px-4 text-[13px] font-black text-white shadow-[0_18px_38px_rgba(7,19,51,0.22)]">
                    {ar ? 'الانتقال إلى مركز المحتوى' : 'Go to Content Hub'}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : 'href' in primaryAction ? (
                  <Link href={primaryAction.href} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#071333] px-4 text-[13px] font-black text-white shadow-[0_18px_38px_rgba(7,19,51,0.22)]">
                    {primaryAction.label}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <button type="button" onClick={primaryAction.onClick} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#071333] px-4 text-[13px] font-black text-white shadow-[0_18px_38px_rgba(7,19,51,0.22)]">
                    {primaryAction.label}
                    <Sparkles className="h-4 w-4" />
                  </button>
                )}
              </SoftCard>

              <SoftCard className="hidden">
                <h2 className="mb-3 flex items-center gap-2 text-[15px] font-black text-[#0B1028]">
                  <ClipboardList className="h-4 w-4 text-[#5E63FF]" />
                  {ar ? 'مراجعة مدخلات الاستراتيجية' : 'Strategy input review'}
                </h2>
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-2xl bg-emerald-50 px-3 py-2">
                    <span className="text-[12px] font-bold text-emerald-700">{ar ? 'مدخلات محفوظة' : 'Saved inputs'}</span>
                    <span className="text-[12px] font-black text-emerald-700">{savedStrategyInputCount}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-amber-50 px-3 py-2">
                    <span className="text-[12px] font-bold text-amber-700">{ar ? 'مدخلات ناقصة' : 'Missing inputs'}</span>
                    <span className="text-[12px] font-black text-amber-700">{missingStrategyInputCount}</span>
                  </div>
                </div>
              </SoftCard>

              <SoftCard className="hidden">
                <h2 className="mb-3 flex items-center gap-2 text-[15px] font-black text-[#0B1028]">
                  <Eye className="h-4 w-4 text-[#5E63FF]" />
                  {ar ? 'الحقيقة التشغيلية' : 'Operating truth'}
                </h2>
                <div className="space-y-2">
                  {currentTruthRows.map((row) => (
                    <div key={row.label} className="rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2">
                      <p className="text-[11px] font-black text-[#5E63FF]">{row.label}</p>
                      <p className="mt-1 text-[12px] font-semibold leading-5 text-slate-600">{row.value}</p>
                    </div>
                  ))}
                </div>
              </SoftCard>

              <SoftCard className="hidden">
                <h2 className="mb-3 flex items-center gap-2 text-[15px] font-black text-[#0B1028]">
                  <Eye className="h-4 w-4 text-[#5E63FF]" />
                  {ar ? 'روابط سريعة' : 'Quick links'}
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: ar ? 'مركز المحتوى' : 'Content Hub', href: recentContentHubHref, icon: FileText },
                    { label: ar ? 'الاستوديو' : 'Creative', href: recent?.id ? `/campaigns/${recent.id}?tab=creative` : '/studio', icon: Lightbulb },
                    { label: ar ? 'جاهزية النشر' : 'Publish', href: recentPublishHref, icon: Send },
                    { label: ar ? 'الأداء' : 'Performance', href: recentPerformanceHref, icon: TrendingUp },
                  ].map((link) => {
                    const Icon = link.icon
                    return (
                      <Link key={link.label} href={link.href} className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2 py-3 text-center text-[11px] font-black text-slate-600 hover:border-[#C7D2FE] hover:text-[#5E63FF]">
                        <Icon className="h-4 w-4" />
                        {link.label}
                      </Link>
                    )
                  })}
                </div>
              </SoftCard>
            </aside>
          </div>
        </div>
      </div>
      <RunFullStrategyModal
        isOpen={runStrategyOpen}
        startFresh={startFreshStrategyRequest}
        onClose={() => setRunStrategyOpen(false)}
        onSuccess={() => {
          load()
        }}
      />
    </AppShell>
  )
}
