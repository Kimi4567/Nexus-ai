import type { StrategyType } from '@/lib/strategy/strategyOrder'

export type StrategyBriefMode = StrategyType

export type StrategyBriefFieldKey =
  | 'brandName'
  | 'industry'
  | 'description'
  | 'primaryOffer'
  | 'targetAudience'
  | 'audiencePainPoints'
  | 'businessGoal'
  | 'topPlatforms'
  | 'toneOrLanguage'
  | 'marketingBudget'
  | 'conversionDestination'
  | 'leadHandling'
  | 'audienceLocation'
  | 'trackingReadiness'
  | 'platformReadiness'
  | 'budgetApproval'
  | 'verifiedProof'

export type StrategyBriefBlocker =
  | 'organic_brief_incomplete'
  | 'paid_brief_incomplete'
  | 'full_paid_brief_incomplete'

export type StrategyBriefWarning =
  | 'verified_proof_missing'
  | 'paid_planning_only'
  | 'no_launch_or_spend'

export interface StrategyBriefProfileLike {
  brandName?: string | null
  industry?: string | null
  description?: string | null
  primaryOffer?: string | null
  targetAudience?: string | null
  audiencePainPoints?: string[] | null
  businessGoal?: string | null
  topPlatforms?: string[] | null
  writingStyle?: string | null
  languagePreference?: string | null
  marketingBudget?: string | null
  conversionDestination?: string | null
  leadHandling?: string | null
  audienceLocation?: string | null
  verifiedProof?: string[] | null
  strategyType?: StrategyBriefMode | null
  strategyDuration?: '30' | '90' | '180' | 'custom' | null
  strategyCustomDays?: number | null
  campaignObjective?: 'leads' | 'sales' | 'awareness' | 'traffic' | null
}

export interface StrategyBriefPlatformSummary {
  trackingReady?: boolean
  paidPlatformReady?: boolean
  budgetApproved?: boolean
  launchApproved?: boolean
}

export interface StrategyBriefReadinessInput {
  mode: StrategyBriefMode
  brandProfile: StrategyBriefProfileLike | null | undefined
  platform?: StrategyBriefPlatformSummary | null
}

export interface StrategyBriefReadinessResult {
  mode: StrategyBriefMode
  canGenerate: boolean
  canGenerateOrganic: boolean
  canGeneratePaidPlan: boolean
  paidPlanningOnly: boolean
  missingRequiredFields: StrategyBriefFieldKey[]
  recommendedFields: StrategyBriefFieldKey[]
  blockers: StrategyBriefBlocker[]
  warnings: StrategyBriefWarning[]
  safeScope: string
  safeScopeAr: string
  explanation: string
  explanationAr: string
}

export interface StrategyPageReadinessSurface {
  organic: {
    ready: boolean
    label: string
    labelAr: string
  }
  paid: {
    ready: boolean
    label: string
    labelAr: string
  }
  full: {
    ready: boolean
    label: string
    labelAr: string
  }
  nextAction: {
    label: string
    labelAr: string
  }
}

const hasText = (value: unknown): boolean =>
  typeof value === 'string' && value.trim().length > 0

const hasList = (value: unknown): boolean =>
  Array.isArray(value) && value.some((item) => hasText(item))

const hasToneOrLanguage = (profile: StrategyBriefProfileLike): boolean =>
  hasText(profile.writingStyle) || hasText(profile.languagePreference)

const unique = <T>(items: T[]): T[] => Array.from(new Set(items))

const organicChecks: Array<{ key: StrategyBriefFieldKey; ok: (p: StrategyBriefProfileLike) => boolean }> = [
  { key: 'brandName', ok: (p) => hasText(p.brandName) },
  { key: 'industry', ok: (p) => hasText(p.industry) },
  { key: 'description', ok: (p) => hasText(p.description) },
  { key: 'primaryOffer', ok: (p) => hasText(p.primaryOffer) },
  { key: 'targetAudience', ok: (p) => hasText(p.targetAudience) },
  { key: 'audiencePainPoints', ok: (p) => hasList(p.audiencePainPoints) },
  { key: 'businessGoal', ok: (p) => hasText(p.businessGoal) },
  { key: 'topPlatforms', ok: (p) => hasList(p.topPlatforms) },
  { key: 'toneOrLanguage', ok: hasToneOrLanguage },
]

const paidChecks: Array<{ key: StrategyBriefFieldKey; ok: (p: StrategyBriefProfileLike) => boolean }> = [
  { key: 'businessGoal', ok: (p) => hasText(p.businessGoal) },
  { key: 'conversionDestination', ok: (p) => hasText(p.conversionDestination) },
  { key: 'marketingBudget', ok: (p) => hasText(p.marketingBudget) },
  { key: 'leadHandling', ok: (p) => hasText(p.leadHandling) },
  { key: 'audienceLocation', ok: (p) => hasText(p.audienceLocation) },
  { key: 'primaryOffer', ok: (p) => hasText(p.primaryOffer) },
  { key: 'targetAudience', ok: (p) => hasText(p.targetAudience) },
  { key: 'audiencePainPoints', ok: (p) => hasList(p.audiencePainPoints) },
  { key: 'topPlatforms', ok: (p) => hasList(p.topPlatforms) },
]

function missingFor(
  profile: StrategyBriefProfileLike,
  checks: Array<{ key: StrategyBriefFieldKey; ok: (p: StrategyBriefProfileLike) => boolean }>,
): StrategyBriefFieldKey[] {
  return checks.filter((check) => !check.ok(profile)).map((check) => check.key)
}

export function getStrategyBriefReadiness(
  input: StrategyBriefReadinessInput,
): StrategyBriefReadinessResult {
  const profile = input.brandProfile ?? {}
  const platform = input.platform ?? {}
  const mode = input.mode

  const organicMissing = missingFor(profile, organicChecks)
  const paidMissing = missingFor(profile, paidChecks)
  const canGenerateOrganic = organicMissing.length === 0
  const canGeneratePaidPlan = paidMissing.length === 0

  const launchMissing: StrategyBriefFieldKey[] = []
  if (!platform.trackingReady) launchMissing.push('trackingReadiness')
  if (!platform.paidPlatformReady) launchMissing.push('platformReadiness')
  if (!platform.budgetApproved) launchMissing.push('budgetApproval')

  const recommendedFields: StrategyBriefFieldKey[] = []
  const warnings: StrategyBriefWarning[] = []
  if (!hasList(profile.verifiedProof)) {
    recommendedFields.push('verifiedProof')
    warnings.push('verified_proof_missing')
  }

  const blockers: StrategyBriefBlocker[] = []
  let missingRequiredFields: StrategyBriefFieldKey[] = []
  let canGenerate = false
  let safeScope: string
  let safeScopeAr: string
  let explanation: string
  let explanationAr: string

  if (mode === 'organic') {
    missingRequiredFields = organicMissing
    canGenerate = canGenerateOrganic
    if (!canGenerateOrganic) blockers.push('organic_brief_incomplete')
    safeScope = canGenerateOrganic
      ? 'Organic strategy only.'
      : 'Complete the organic brief before generating an organic strategy.'
    safeScopeAr = canGenerateOrganic
      ? 'استراتيجية عضوية فقط.'
      : 'أكمل بريف الاستراتيجية العضوية قبل التوليد.'
    explanation = canGenerateOrganic
      ? 'The core Brand Brain fields support organic strategy generation.'
      : 'Organic strategy needs the core brand, offer, audience, goal, platform, and tone fields first.'
    explanationAr = canGenerateOrganic
      ? 'حقول Brand Brain الأساسية تدعم توليد استراتيجية عضوية.'
      : 'الاستراتيجية العضوية تحتاج بيانات العلامة والعرض والجمهور والهدف والمنصات والنبرة أولاً.'
  } else if (mode === 'paid') {
    missingRequiredFields = paidMissing
    canGenerate = canGeneratePaidPlan
    if (!canGeneratePaidPlan) blockers.push('paid_brief_incomplete')
    if (launchMissing.length > 0) {
      warnings.push('paid_planning_only', 'no_launch_or_spend')
    }
    safeScope = canGeneratePaidPlan
      ? 'Paid planning brief only. NEXUS will not launch ads or spend budget without tracking, platform readiness, and explicit approval.'
      : 'Paid strategy is blocked until the paid brief has budget, conversion, lead handling, audience/location, offer, and platform inputs.'
    safeScopeAr = canGeneratePaidPlan
      ? 'بريف تخطيط مدفوع فقط. لن يطلق NEXUS إعلانات أو يصرف ميزانية بدون تتبع وجاهزية منصة وموافقة صريحة.'
      : 'الاستراتيجية المدفوعة متوقفة حتى يكتمل بريف الميزانية والتحويل والتعامل مع العملاء والجمهور/الموقع والعرض والمنصات.'
    explanation = canGeneratePaidPlan
      ? 'Paid planning can be generated, but launch and spend remain separate gated actions.'
      : 'Paid planning needs explicit paid inputs. No internal default budget is treated as user-provided.'
    explanationAr = canGeneratePaidPlan
      ? 'يمكن توليد تخطيط مدفوع، لكن الإطلاق والصرف يبقيان خطوات منفصلة ومقفلة.'
      : 'التخطيط المدفوع يحتاج مدخلات صريحة. لا يتم اعتبار أي ميزانية افتراضية داخلية كميزانية من المستخدم.'
  } else {
    missingRequiredFields = unique([...organicMissing, ...paidMissing])
    canGenerate = canGenerateOrganic && canGeneratePaidPlan
    if (!canGenerateOrganic) blockers.push('organic_brief_incomplete')
    if (!canGeneratePaidPlan) blockers.push('full_paid_brief_incomplete')
    if (launchMissing.length > 0) {
      warnings.push('paid_planning_only', 'no_launch_or_spend')
    }
    safeScope = canGenerate
      ? 'Full strategy can include organic strategy plus paid planning. Launch, spend, publishing, and activation stay outside this run.'
      : canGenerateOrganic
        ? 'Organic strategy is ready. Full strategy is blocked because paid brief inputs are missing; switch to Organic-only or complete paid inputs.'
        : 'Full strategy is blocked until organic and paid brief inputs are complete.'
    safeScopeAr = canGenerate
      ? 'يمكن أن تشمل الاستراتيجية الكاملة استراتيجية عضوية وتخطيطاً مدفوعاً. الإطلاق والصرف والنشر والتفعيل خارج هذا التشغيل.'
      : canGenerateOrganic
        ? 'الاستراتيجية العضوية جاهزة. الاستراتيجية الكاملة متوقفة لأن مدخلات المدفوع ناقصة؛ اختر عضوي فقط أو أكمل مدخلات المدفوع.'
        : 'الاستراتيجية الكاملة متوقفة حتى تكتمل مدخلات البريف العضوي والمدفوع.'
    explanation = canGenerate
      ? 'The brief supports both organic strategy and paid planning, while paid launch remains gated.'
      : 'Full strategy cannot silently fill missing paid assumptions.'
    explanationAr = canGenerate
      ? 'البريف يدعم الاستراتيجية العضوية والتخطيط المدفوع، مع بقاء إطلاق الإعلانات مقفلاً.'
      : 'لا يمكن للاستراتيجية الكاملة ملء افتراضات المدفوع الناقصة بصمت.'
  }

  return {
    mode,
    canGenerate,
    canGenerateOrganic,
    canGeneratePaidPlan,
    paidPlanningOnly: mode !== 'organic' && launchMissing.length > 0,
    missingRequiredFields: unique(missingRequiredFields),
    recommendedFields: unique(recommendedFields),
    blockers: unique(blockers),
    warnings: unique(warnings),
    safeScope,
    safeScopeAr,
    explanation,
    explanationAr,
  }
}

export function getStrategyPageReadinessSurface(
  brandProfile: StrategyBriefProfileLike | null | undefined,
): StrategyPageReadinessSurface {
  const organic = getStrategyBriefReadiness({ mode: 'organic', brandProfile })
  const paid = getStrategyBriefReadiness({ mode: 'paid', brandProfile })
  const full = getStrategyBriefReadiness({ mode: 'full', brandProfile })

  const organicSurface = organic.canGenerateOrganic
    ? {
        ready: true,
        label: 'Ready for an initial brief',
        labelAr: 'جاهز لموجز أولي',
      }
    : {
        ready: false,
        label: 'Needs core data',
        labelAr: 'يحتاج بيانات أساسية',
      }

  const paidSurface = paid.canGeneratePaidPlan
    ? {
        ready: true,
        label: 'Planning-only',
        labelAr: 'تخطيط فقط',
      }
    : {
        ready: false,
        label: 'Needs paid inputs',
        labelAr: 'تحتاج بيانات المدفوع',
      }

  const fullSurface = full.canGenerate
    ? {
        ready: false,
        label: 'Organic ready · paid planning only',
        labelAr: 'العضوي جاهز · المدفوع تخطيط فقط',
      }
    : organic.canGenerateOrganic
      ? {
          ready: false,
          label: 'Organic ready · paid inputs missing',
          labelAr: 'العضوي جاهز · بيانات المدفوع ناقصة',
        }
      : {
          ready: false,
          label: 'Needs core and paid inputs',
          labelAr: 'تحتاج بيانات أساسية ومدفوعة',
        }

  const nextAction = full.canGenerate
    ? {
        label: 'Review strategy / update after cost review',
        labelAr: 'راجع الاستراتيجية / حدّث بعد مراجعة التكلفة',
      }
    : organic.canGenerateOrganic
      ? {
          label: 'Review strategy / complete paid brief',
          labelAr: 'راجع الاستراتيجية / أكمل بريف المدفوع',
        }
      : {
          label: 'Complete Brand Brain',
          labelAr: 'أكمل Brand Brain',
        }

  return {
    organic: organicSurface,
    paid: paidSurface,
    full: fullSurface,
    nextAction,
  }
}
