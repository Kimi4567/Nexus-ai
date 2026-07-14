import { normalizeCampaignPlatforms, platformLabel } from './campaignPlatforms'
import type { PlatformKey, PlatformState, ReadinessStatus } from './platformReadiness'
import type { StrategyScopeType } from './strategy/strategyScope'

export type StrategyExecutionLane = 'organic' | 'paid'
export type StrategyExecutionRequirementStatus = 'ready' | 'blocked' | 'checking' | 'not_in_scope'

export interface StrategyExecutionRequirement {
  id: string
  lane: StrategyExecutionLane
  platformKey: PlatformKey | 'unknown'
  platformLabelEn: string
  platformLabelAr: string
  status: StrategyExecutionRequirementStatus
  readinessStatus?: ReadinessStatus
  titleEn: string
  titleAr: string
  reasonEn: string
  reasonAr: string
  actionHref?: string
  actionLabelEn?: string
  actionLabelAr?: string
}

export interface StrategyExecutionBridge {
  scopeType: StrategyScopeType
  includesOrganic: boolean
  includesPaid: boolean
  overallStatus: 'ready' | 'blocked' | 'checking' | 'not_in_scope'
  summaryEn: string
  summaryAr: string
  helperEn: string
  helperAr: string
  organicNoteEn: string | null
  organicNoteAr: string | null
  paidNoteEn: string | null
  paidNoteAr: string | null
  organicRequirements: StrategyExecutionRequirement[]
  paidRequirements: StrategyExecutionRequirement[]
  readyCount: number
  blockedCount: number
}

export interface DeriveStrategyExecutionBridgeInput {
  scopeType: StrategyScopeType
  campaignPlatforms?: ReadonlyArray<string | null | undefined> | null
  platformStates?: PlatformState[] | null
  platformReadinessLoaded?: boolean
  campaignId?: string
}

const PLATFORM_READINESS_KEY_BY_CAMPAIGN_PLATFORM: Record<string, PlatformKey> = {
  FACEBOOK: 'facebook',
  META: 'facebook',
  INSTAGRAM: 'instagram',
  TIKTOK: 'tiktok',
  LINKEDIN: 'linkedin',
  X: 'x',
  TWITTER: 'x',
  YOUTUBE: 'youtube',
  YOUTUBE_SHORTS: 'youtube',
  PINTEREST: 'pinterest',
  GOOGLE: 'google',
  SNAPCHAT: 'snapchat',
  WHATSAPP: 'whatsapp',
}

function isReadyStatus(status: ReadinessStatus | undefined): boolean {
  return status === 'ready'
}

function labelEnForPlatform(key: string): string {
  if (key === 'META') return 'Meta / Facebook'
  return platformLabel(key)
}

function labelArForPlatform(key: string): string {
  const labels: Record<string, string> = {
    FACEBOOK: 'فيسبوك',
    META: 'ميتا / فيسبوك',
    INSTAGRAM: 'إنستغرام',
    TIKTOK: 'تيك توك',
    LINKEDIN: 'لينكدإن',
    YOUTUBE: 'يوتيوب',
    YOUTUBE_SHORTS: 'يوتيوب شورتس',
    GOOGLE: 'جوجل',
    SNAPCHAT: 'سناب شات',
    WHATSAPP: 'واتساب',
    X: 'إكس',
    TWITTER: 'إكس',
    PINTEREST: 'بينترست',
  }
  return labels[key] ?? labelEnForPlatform(key)
}

function titleForState(platformLabelEn: string, platformLabelAr: string, status: StrategyExecutionRequirementStatus) {
  if (status === 'ready') {
    return {
      titleEn: `${platformLabelEn} prerequisites available`,
      titleAr: `متطلبات ${platformLabelAr} متاحة`,
    }
  }
  if (status === 'checking') {
    return {
      titleEn: `Checking ${platformLabelEn}`,
      titleAr: `جاري فحص ${platformLabelAr}`,
    }
  }
  return {
    titleEn: `${platformLabelEn} needs setup`,
    titleAr: `${platformLabelAr} يحتاج إعداداً`,
  }
}

function reasonForReadinessStatus(status: ReadinessStatus | undefined, platformLabelEn: string, platformLabelAr: string) {
  switch (status) {
    case 'ready':
      return {
        reasonEn: `${platformLabelEn} has the required account/page prerequisite for review. This remains a review-only signal.`,
        reasonAr: `${platformLabelAr} لديه متطلبات الحساب أو الصفحة للمراجعة. هذه إشارة للمراجعة فقط.`,
      }
    case 'needs_setup':
      return {
        reasonEn: `${platformLabelEn} is connected but still needs setup before execution can be reviewed.`,
        reasonAr: `${platformLabelAr} متصل لكنه يحتاج إعداداً قبل مراجعة التنفيذ.`,
      }
    case 'permission_unverified':
      return {
        reasonEn: `${platformLabelEn} is connected, but API permission or execution capability is not verified yet.`,
        reasonAr: `${platformLabelAr} متصل، لكن صلاحية API أو قدرة التنفيذ غير مثبتة بعد.`,
      }
    case 'not_connected':
      return {
        reasonEn: `${platformLabelEn} is not connected yet.`,
        reasonAr: `${platformLabelAr} غير متصل بعد.`,
      }
    case 'planning_only':
      return {
        reasonEn: `${platformLabelEn} is available for planning only here; no execution is implied.`,
        reasonAr: `${platformLabelAr} متاح للتخطيط فقط هنا؛ لا توجد دلالة على التنفيذ.`,
      }
    case 'not_available':
      return {
        reasonEn: `${platformLabelEn} does not have a supported publishing integration in NEXUS yet.`,
        reasonAr: `${platformLabelAr} لا يملك تكاملاً مدعوماً للنشر داخل NEXUS بعد.`,
      }
    default:
      return {
        reasonEn: `${platformLabelEn} readiness is unknown, so execution cannot be assumed.`,
        reasonAr: `جاهزية ${platformLabelAr} غير معروفة، لذلك لا يمكن افتراض التنفيذ.`,
      }
  }
}

function makeCheckingRequirement(
  lane: StrategyExecutionLane,
  platformKey: PlatformKey | 'unknown',
  platformLabelEn: string,
  platformLabelAr: string,
): StrategyExecutionRequirement {
  const title = titleForState(platformLabelEn, platformLabelAr, 'checking')
  return {
    id: `${lane}-${platformKey}-checking`,
    lane,
    platformKey,
    platformLabelEn,
    platformLabelAr,
    status: 'checking',
    ...title,
    reasonEn: 'Connected account state is still loading. NEXUS will not assume readiness.',
    reasonAr: 'حالة الحسابات المتصلة ما زالت قيد التحميل. لن يفترض NEXUS الجاهزية.',
  }
}

function requirementFromPlatformState(
  lane: StrategyExecutionLane,
  campaignPlatformKey: string,
  platformKey: PlatformKey,
  state: PlatformState | undefined,
  actionHref: string,
): StrategyExecutionRequirement {
  const platformLabelEn = labelEnForPlatform(campaignPlatformKey)
  const platformLabelAr = labelArForPlatform(campaignPlatformKey)
  const status: StrategyExecutionRequirementStatus = isReadyStatus(state?.status) ? 'ready' : 'blocked'
  const title = titleForState(platformLabelEn, platformLabelAr, status)
  const reason = reasonForReadinessStatus(state?.status, platformLabelEn, platformLabelAr)

  return {
    id: `${lane}-${campaignPlatformKey.toLowerCase()}`,
    lane,
    platformKey,
    platformLabelEn,
    platformLabelAr,
    status,
    readinessStatus: state?.status,
    ...title,
    ...reason,
    actionHref: state?.status === 'not_available' ? undefined : actionHref,
    actionLabelEn: state?.status === 'not_available' ? undefined : (lane === 'paid' ? 'Review Connections' : 'Open Connections'),
    actionLabelAr: state?.status === 'not_available' ? undefined : (lane === 'paid' ? 'راجع الاتصالات' : 'افتح الاتصالات'),
  }
}

function unknownPlatformRequirement(lane: StrategyExecutionLane, key: string): StrategyExecutionRequirement {
  const platformLabelEn = labelEnForPlatform(key)
  const platformLabelAr = labelArForPlatform(key)
  const title = titleForState(platformLabelEn, platformLabelAr, 'blocked')
  return {
    id: `${lane}-${key.toLowerCase()}-unknown`,
    lane,
    platformKey: 'unknown',
    platformLabelEn,
    platformLabelAr,
    status: 'blocked',
    ...title,
    reasonEn: `${platformLabelEn} is in the campaign plan, but NEXUS has no execution-readiness connector for it yet.`,
    reasonAr: `${platformLabelAr} موجود في خطة الحملة، لكن لا يوجد موصل جاهزية تنفيذ له داخل NEXUS بعد.`,
    actionHref: '/connections',
    actionLabelEn: 'Review Connections',
    actionLabelAr: 'راجع الاتصالات',
  }
}

function missingOrganicPlatformsRequirement(): StrategyExecutionRequirement {
  return {
    id: 'organic-platforms-not-set',
    lane: 'organic',
    platformKey: 'unknown',
    platformLabelEn: 'Organic platforms',
    platformLabelAr: 'منصات النشر العضوي',
    status: 'blocked',
    titleEn: 'Organic platforms need selection',
    titleAr: 'منصات النشر العضوي تحتاج تحديداً',
    reasonEn: 'This organic strategy has no saved campaign platforms, so NEXUS cannot map it to publishing readiness.',
    reasonAr: 'هذه الاستراتيجية العضوية لا تحتوي منصات حملة محفوظة، لذلك لا يستطيع NEXUS ربطها بجاهزية النشر.',
    actionHref: '/strategy',
    actionLabelEn: 'Review strategy setup',
    actionLabelAr: 'راجع إعداد الاستراتيجية',
  }
}

export function deriveStrategyExecutionBridge(input: DeriveStrategyExecutionBridgeInput): StrategyExecutionBridge {
  const scopeType = input.scopeType
  const includesOrganic = scopeType !== 'paid'
  const includesPaid = scopeType !== 'organic'
  const loaded = input.platformReadinessLoaded !== false
  const states = Array.isArray(input.platformStates) ? input.platformStates : []
  const stateByKey = new Map(states.map((state) => [state.key, state]))
  const campaignPlatforms = normalizeCampaignPlatforms(input.campaignPlatforms)
  const campaignId = input.campaignId
  const connectionsHref = '/connections'
  const paidPlanHref = campaignId ? `/campaigns/${campaignId}/paid-launch` : '/paid-campaigns'

  const organicRequirements: StrategyExecutionRequirement[] = []
  if (includesOrganic) {
    if (!loaded) {
      organicRequirements.push(makeCheckingRequirement('organic', 'unknown', 'Organic platforms', 'منصات النشر العضوي'))
    } else if (campaignPlatforms.length === 0) {
      organicRequirements.push(missingOrganicPlatformsRequirement())
    } else {
      for (const campaignPlatform of campaignPlatforms) {
        const platformKey = PLATFORM_READINESS_KEY_BY_CAMPAIGN_PLATFORM[campaignPlatform]
        if (!platformKey) {
          organicRequirements.push(unknownPlatformRequirement('organic', campaignPlatform))
          continue
        }
        organicRequirements.push(
          requirementFromPlatformState('organic', campaignPlatform, platformKey, stateByKey.get(platformKey), connectionsHref),
        )
      }
    }
  }

  const paidRequirements: StrategyExecutionRequirement[] = []
  if (includesPaid) {
    if (!loaded) {
      paidRequirements.push(makeCheckingRequirement('paid', 'paid', 'Paid media / Meta Ads API', 'الإعلانات المدفوعة / Meta Ads API'))
    } else {
      const paidState = stateByKey.get('paid')
      paidRequirements.push({
        ...requirementFromPlatformState('paid', 'PAID', 'paid', paidState, connectionsHref),
        id: 'paid-meta-api',
        platformLabelEn: 'Paid media / Meta Ads API',
        platformLabelAr: 'الإعلانات المدفوعة / Meta Ads API',
        titleEn: paidState?.status === 'ready'
          ? 'Paid API prerequisites available for review'
          : 'Paid API prerequisites need setup',
        titleAr: paidState?.status === 'ready'
          ? 'متطلبات API المدفوعة متاحة للمراجعة'
          : 'متطلبات API المدفوعة تحتاج إعداداً',
        reasonEn: paidState?.status === 'ready'
          ? 'Meta Ads API prerequisites are present for a reviewed paid flow. Final platform draft creation still needs explicit confirmation.'
          : reasonForReadinessStatus(paidState?.status, 'Paid media / Meta Ads API', 'الإعلانات المدفوعة / Meta Ads API').reasonEn,
        reasonAr: paidState?.status === 'ready'
          ? 'متطلبات Meta Ads API موجودة لمسار مدفوع بعد المراجعة. إنشاء مسودات المنصة النهائية ما زال يحتاج تأكيداً صريحاً.'
          : reasonForReadinessStatus(paidState?.status, 'Paid media / Meta Ads API', 'الإعلانات المدفوعة / Meta Ads API').reasonAr,
        actionHref: paidState?.status === 'ready' ? paidPlanHref : connectionsHref,
        actionLabelEn: paidState?.status === 'ready' ? 'Review paid planning brief' : 'Review Connections',
        actionLabelAr: paidState?.status === 'ready' ? 'راجع بريف التخطيط المدفوع' : 'راجع الاتصالات',
      })
    }
  }

  const requirements = [...organicRequirements, ...paidRequirements]
  const readyCount = requirements.filter((item) => item.status === 'ready').length
  const blockedCount = requirements.filter((item) => item.status === 'blocked').length
  const hasChecking = requirements.some((item) => item.status === 'checking')
  const overallStatus: StrategyExecutionBridge['overallStatus'] =
    hasChecking ? 'checking' :
      requirements.length === 0 ? 'not_in_scope' :
        blockedCount > 0 ? 'blocked' : 'ready'

  const summary = (() => {
    if (overallStatus === 'checking') {
      return {
        summaryEn: 'Checking execution readiness',
        summaryAr: 'جاري فحص جاهزية التنفيذ',
      }
    }
    if (overallStatus === 'ready') {
      return {
        summaryEn: 'Execution prerequisites available for review',
        summaryAr: 'متطلبات التنفيذ متاحة للمراجعة',
      }
    }
    if (overallStatus === 'not_in_scope') {
      return {
        summaryEn: 'No execution lane is in scope',
        summaryAr: 'لا يوجد مسار تنفيذ ضمن النطاق',
      }
    }
    return {
      summaryEn: 'Execution needs platform/account setup',
      summaryAr: 'التنفيذ يحتاج إعدادات منصات أو حسابات',
    }
  })()

  return {
    scopeType,
    includesOrganic,
    includesPaid,
    overallStatus,
    ...summary,
    helperEn: 'Strategy defines what should be executed. Connections supplies account and permission state. This read-only bridge only routes review to the correct owner surface; no platform action happens here.',
    helperAr: 'الاستراتيجية تحدد ما الذي يجب تنفيذه. صفحة الاتصالات توفر حالة الحسابات والصلاحيات. هذا الربط للقراءة فقط ويوجه المراجعة إلى المكان الصحيح؛ لا يحدث أي إجراء منصة هنا.',
    organicNoteEn: includesOrganic ? null : 'Organic publishing is not part of this paid-only strategy.',
    organicNoteAr: includesOrganic ? null : 'النشر العضوي ليس جزءاً من هذه الاستراتيجية المدفوعة فقط.',
    paidNoteEn: includesPaid ? null : 'Paid execution is not part of this organic-only strategy.',
    paidNoteAr: includesPaid ? null : 'التنفيذ المدفوع ليس جزءاً من هذه الاستراتيجية العضوية فقط.',
    organicRequirements,
    paidRequirements,
    readyCount,
    blockedCount,
  }
}
