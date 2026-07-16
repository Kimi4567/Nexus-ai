import type { StrategyApprovalState } from '@/lib/strategyApproval'

export type ExecutionStage =
  | 'ARCHIVED'
  | 'PAUSED'
  | 'STRATEGY_REQUIRED'
  | 'STRATEGY_REVIEW'
  | 'CONTENT_PLANNING'
  | 'CONTENT_REVIEW'
  | 'MEDIA_REVIEW'
  | 'SCHEDULING'
  | 'IN_FLIGHT'
  | 'LEARNING'
  | 'OPTIMIZING'
  | 'NEEDS_ATTENTION'

export type ExecutionActionKind =
  | 'FIX_BRAND_TRUTH'
  | 'REVIEW_CAMPAIGN'
  | 'CREATE_STRATEGY'
  | 'REVIEW_STRATEGY'
  | 'GENERATE_CONTENT'
  | 'REVIEW_CONTENT'
  | 'REVIEW_MEDIA'
  | 'SCHEDULE_CONTENT'
  | 'RESOLVE_FAILURE'
  | 'RESOLVE_OVERDUE_SCHEDULE'
  | 'MONITOR_SCHEDULE'
  | 'SYNC_ANALYTICS'
  | 'REVIEW_PERFORMANCE'

export type ExecutionPriority = 'critical' | 'high' | 'medium' | 'low'
export type ExecutionSafety = 'review_required' | 'manual_action' | 'monitor_only'

export interface ExecutionPostCounts {
  draft: number
  approved: number
  approvedMissingApproval?: number
  approvedMissingMedia?: number
  scheduled: number
  invalidScheduled?: number
  published: number
  failed: number
  publishedWithoutAnalytics: number
  overdueScheduled?: number
}

export interface CampaignExecutionSnapshot {
  campaignId: string
  campaignName: string
  campaignStatus: string
  updatedAt: string
  strategyApprovalState: StrategyApprovalState
  strategyBlockers: string[]
  strategyEvidenceCount: number
  posts: ExecutionPostCounts
}

export interface ExecutionQueueItem {
  id: string
  campaignId: string
  campaignName: string
  kind: ExecutionActionKind
  stage: ExecutionStage
  priority: ExecutionPriority
  safety: ExecutionSafety
  requiresApproval: boolean
  href: string
  title: { en: string; ar: string }
  reason: { en: string; ar: string }
  evidence: {
    campaignStatus: string
    strategyApprovalState: StrategyApprovalState
    strategyEvidenceCount: number
    strategyBlockers: string[]
    posts: ExecutionPostCounts
  }
  updatedAt: string
}

export interface CampaignExecutionTruth {
  campaignId: string
  campaignName: string
  campaignStatus: string
  stage: ExecutionStage
  strategyApprovalState: StrategyApprovalState
  posts: ExecutionPostCounts
  nextAction: ExecutionQueueItem | null
  updatedAt: string
}

export interface WorkspaceExecutionTruth {
  version: 1
  generatedAt: string
  summary: {
    campaigns: number
    needsAttention: number
    awaitingApproval: number
    scheduledPosts: number
    publishedPosts: number
  }
  queue: ExecutionQueueItem[]
  campaigns: CampaignExecutionTruth[]
}

const PRIORITY_ORDER: Record<ExecutionPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

function item(
  snapshot: CampaignExecutionSnapshot,
  stage: ExecutionStage,
  kind: ExecutionActionKind,
  priority: ExecutionPriority,
  safety: ExecutionSafety,
  href: string,
  title: { en: string; ar: string },
  reason: { en: string; ar: string },
): ExecutionQueueItem {
  return {
    id: `${snapshot.campaignId}:${kind}`,
    campaignId: snapshot.campaignId,
    campaignName: snapshot.campaignName,
    kind,
    stage,
    priority,
    safety,
    requiresApproval: safety === 'review_required',
    href,
    title,
    reason,
    evidence: {
      campaignStatus: snapshot.campaignStatus,
      strategyApprovalState: snapshot.strategyApprovalState,
      strategyEvidenceCount: snapshot.strategyEvidenceCount,
      strategyBlockers: snapshot.strategyBlockers,
      posts: snapshot.posts,
    },
    updatedAt: snapshot.updatedAt,
  }
}

export function buildCampaignExecutionTruth(snapshot: CampaignExecutionSnapshot): CampaignExecutionTruth {
  const campaignHref = `/campaigns/${snapshot.campaignId}`
  const contentHref = `/campaigns/${snapshot.campaignId}/content-hub`
  let stage: ExecutionStage = 'OPTIMIZING'
  let nextAction: ExecutionQueueItem | null = null

  if (snapshot.campaignStatus === 'ARCHIVED') {
    stage = 'ARCHIVED'
  } else if (snapshot.campaignStatus === 'PAUSED') {
    stage = 'PAUSED'
    nextAction = item(
      snapshot,
      stage,
      'REVIEW_CAMPAIGN',
      'high',
      'manual_action',
      campaignHref,
      { en: 'Review paused campaign', ar: 'راجع الحملة المتوقفة' },
      {
        en: 'This campaign is paused. Review its strategy and outstanding work before resuming execution.',
        ar: 'هذه الحملة متوقفة. راجع استراتيجيتها والعمل المعلّق قبل استئناف التنفيذ.',
      },
    )
  } else if (snapshot.posts.failed > 0) {
    stage = 'NEEDS_ATTENTION'
    nextAction = item(
      snapshot,
      stage,
      'RESOLVE_FAILURE',
      'critical',
      'manual_action',
      contentHref,
      { en: 'Resolve failed content', ar: 'عالج المحتوى المتعثر' },
      {
        en: `${snapshot.posts.failed} post${snapshot.posts.failed === 1 ? '' : 's'} failed and need a decision before retrying.`,
        ar: `${snapshot.posts.failed} منشور متعثر يحتاج قراراً قبل إعادة المحاولة.`,
      },
    )
  } else if ((snapshot.posts.invalidScheduled ?? 0) > 0) {
    const invalidScheduled = snapshot.posts.invalidScheduled ?? 0
    stage = 'NEEDS_ATTENTION'
    nextAction = item(
      snapshot,
      stage,
      'REVIEW_CONTENT',
      'critical',
      'review_required',
      contentHref,
      { en: 'Restore schedule approval evidence', ar: 'أعد توثيق اعتماد الجدولة' },
      {
        en: `${invalidScheduled} scheduled row${invalidScheduled === 1 ? ' is' : 's are'} missing immutable copy, media, time, or scheduling evidence. NEXUS does not consider ${invalidScheduled === 1 ? 'it' : 'them'} scheduled; reopen and approve ${invalidScheduled === 1 ? 'it' : 'them'} before execution.`,
        ar: `${invalidScheduled} سجل جدولة يفتقد دليلاً ثابتاً للنص أو الوسائط أو الموعد أو قرار الجدولة. لا يعتبره NEXUS مجدولاً؛ أعد فتحه واعتماده قبل التنفيذ.`,
      },
    )
  } else if ((snapshot.posts.overdueScheduled ?? 0) > 0) {
    const overdue = snapshot.posts.overdueScheduled ?? 0
    stage = 'NEEDS_ATTENTION'
    nextAction = item(
      snapshot,
      stage,
      'RESOLVE_OVERDUE_SCHEDULE',
      'critical',
      'manual_action',
      contentHref,
      { en: 'Resolve overdue scheduled content', ar: 'عالج المحتوى المتأخر عن موعده' },
      {
        en: `${overdue} scheduled post${overdue === 1 ? '' : 's'} passed the planned time without verified publication. Publish manually, reschedule, or cancel the execution decision.`,
        ar: `${overdue} منشور مجدول تجاوز موعده دون إثبات نشر. انشره يدويًا أو أعد جدولته أو ألغِ قرار التنفيذ.`,
      },
    )
  } else if (snapshot.strategyBlockers.includes('BRAND_TRUTH_CONFLICT')) {
    stage = 'NEEDS_ATTENTION'
    nextAction = item(
      snapshot,
      stage,
      'FIX_BRAND_TRUTH',
      'critical',
      'manual_action',
      '/brand',
      { en: 'Resolve the Brand Brain source conflict', ar: 'احسم تعارض مصدر الحقيقة في Brand Brain' },
      {
        en: 'The current Brand Brain contradicts the business description. Strategy, content, media, and publishing remain blocked without spending credits until it is corrected.',
        ar: 'يتعارض Brand Brain الحالي مع وصف النشاط. تظل الاستراتيجية والمحتوى والوسائط والنشر محجوبة دون خصم كريديت حتى تصحيح المصدر.',
      },
    )
  } else if (snapshot.strategyApprovalState === 'draft') {
    stage = 'STRATEGY_REQUIRED'
    nextAction = item(
      snapshot,
      stage,
      'CREATE_STRATEGY',
      'high',
      'manual_action',
      campaignHref,
      { en: 'Create the campaign strategy', ar: 'أنشئ استراتيجية الحملة' },
      {
        en: 'Execution cannot start until the campaign has a real strategy grounded in Brand Brain.',
        ar: 'لا يبدأ التنفيذ قبل وجود استراتيجية حقيقية مبنية على Brand Brain.',
      },
    )
  } else if (snapshot.strategyApprovalState !== 'approved') {
    stage = 'STRATEGY_REVIEW'
    const blocked = snapshot.strategyApprovalState === 'blocked'
    nextAction = item(
      snapshot,
      stage,
      'REVIEW_STRATEGY',
      'high',
      'review_required',
      campaignHref,
      {
        en: blocked ? 'Complete strategy quality review' : 'Review and approve strategy',
        ar: blocked ? 'أكمل مراجعة جودة الاستراتيجية' : 'راجع الاستراتيجية واعتمدها',
      },
      {
        en: blocked
          ? 'Strategy execution is blocked until its quality checks are resolved.'
          : 'The strategy is ready, but content generation still needs your approval.',
        ar: blocked
          ? 'تنفيذ الاستراتيجية متوقف حتى معالجة فحوصات الجودة.'
          : 'الاستراتيجية جاهزة، لكن إنشاء المحتوى ما زال يحتاج موافقتك.',
      },
    )
  } else {
    const totalPosts = snapshot.posts.draft
      + snapshot.posts.approved
      + snapshot.posts.scheduled
      + (snapshot.posts.invalidScheduled ?? 0)
      + snapshot.posts.published
      + snapshot.posts.failed

    if (totalPosts === 0) {
      stage = 'CONTENT_PLANNING'
      nextAction = item(
        snapshot,
        stage,
        'GENERATE_CONTENT',
        'high',
        'manual_action',
        `${campaignHref}?action=generate-plan`,
        { en: 'Generate the content plan', ar: 'ولّد خطة المحتوى' },
        {
          en: 'The strategy is approved; the next execution artifact is a reviewable content plan.',
          ar: 'تم اعتماد الاستراتيجية؛ الخطوة التالية هي خطة محتوى قابلة للمراجعة.',
        },
      )
    } else if (snapshot.posts.draft > 0) {
      stage = 'CONTENT_REVIEW'
      nextAction = item(
        snapshot,
        stage,
        'REVIEW_CONTENT',
        'high',
        'review_required',
        contentHref,
        { en: 'Review draft content', ar: 'راجع مسودات المحتوى' },
        {
          en: `${snapshot.posts.draft} draft${snapshot.posts.draft === 1 ? '' : 's'} must be approved before scheduling.`,
          ar: `${snapshot.posts.draft} مسودة تحتاج اعتماداً قبل الجدولة.`,
        },
      )
    } else if ((snapshot.posts.approvedMissingApproval ?? 0) > 0) {
      const missingApproval = snapshot.posts.approvedMissingApproval ?? 0
      stage = 'CONTENT_REVIEW'
      nextAction = item(
        snapshot,
        stage,
        'REVIEW_CONTENT',
        'critical',
        'review_required',
        contentHref,
        { en: 'Restore copy approval evidence', ar: 'أعد توثيق اعتماد النصوص' },
        {
          en: `${missingApproval} approved post${missingApproval === 1 ? '' : 's'} do not have an immutable copy-approval revision. Reopen and approve them before any execution decision.`,
          ar: `${missingApproval} منشور معتمد بلا نسخة ثابتة لاعتماد النص. أعد فتحه واعتماده قبل أي قرار تنفيذ.`,
        },
      )
    } else if ((snapshot.posts.approvedMissingMedia ?? 0) > 0) {
      const pendingMedia = snapshot.posts.approvedMissingMedia ?? 0
      stage = 'MEDIA_REVIEW'
      nextAction = item(
        snapshot,
        stage,
        'REVIEW_MEDIA',
        'high',
        'manual_action',
        contentHref,
        { en: 'Complete and approve final media', ar: 'أكمل واعتمد الوسائط النهائية' },
        {
          en: `${pendingMedia} approved post${pendingMedia === 1 ? '' : 's'} still need complete, separately approved media before scheduling.`,
          ar: `${pendingMedia} منشور معتمد ما زال يحتاج وسائط مكتملة ومعتمدة بقرار منفصل قبل الجدولة.`,
        },
      )
    } else if (snapshot.posts.approved > 0) {
      stage = 'SCHEDULING'
      nextAction = item(
        snapshot,
        stage,
        'SCHEDULE_CONTENT',
        'medium',
        'manual_action',
        contentHref,
        { en: 'Schedule approved content', ar: 'جدول المحتوى المعتمد' },
        {
          en: `${snapshot.posts.approved} approved post${snapshot.posts.approved === 1 ? '' : 's'} still need explicit scheduling.`,
          ar: `${snapshot.posts.approved} منشور معتمد ما زال يحتاج جدولة صريحة.`,
        },
      )
    } else if (snapshot.posts.scheduled > 0) {
      stage = 'IN_FLIGHT'
      nextAction = item(
        snapshot,
        stage,
        'MONITOR_SCHEDULE',
        'medium',
        'monitor_only',
        contentHref,
        { en: 'Monitor scheduled content', ar: 'راقب المحتوى المجدول' },
        {
          en: `${snapshot.posts.scheduled} post${snapshot.posts.scheduled === 1 ? '' : 's'} are scheduled; NEXUS will surface failures or new evidence.`,
          ar: snapshot.posts.scheduled === 1
            ? 'منشور واحد مجدول؛ سيُظهر NEXUS أي تعثر أو دليل جديد.'
            : `${snapshot.posts.scheduled} منشورات مجدولة؛ سيُظهر NEXUS أي تعثر أو دليل جديد.`,
        },
      )
    } else if (snapshot.posts.publishedWithoutAnalytics > 0) {
      stage = 'LEARNING'
      nextAction = item(
        snapshot,
        stage,
        'SYNC_ANALYTICS',
        'medium',
        'manual_action',
        '/analytics',
        { en: 'Collect performance evidence', ar: 'اجمع دليل الأداء' },
        {
          en: `${snapshot.posts.publishedWithoutAnalytics} published post${snapshot.posts.publishedWithoutAnalytics === 1 ? '' : 's'} do not have analytics evidence yet.`,
          ar: `${snapshot.posts.publishedWithoutAnalytics} منشور حي لا يملك دليل تحليلات بعد.`,
        },
      )
    } else {
      stage = 'OPTIMIZING'
      nextAction = item(
        snapshot,
        stage,
        'REVIEW_PERFORMANCE',
        'low',
        'monitor_only',
        '/analytics',
        { en: 'Review performance and learn', ar: 'راجع الأداء والتعلّم' },
        {
          en: 'Published work has evidence; review it before changing the next campaign cycle.',
          ar: 'المحتوى المنشور لديه دليل؛ راجعه قبل تغيير دورة الحملة التالية.',
        },
      )
    }
  }

  return {
    campaignId: snapshot.campaignId,
    campaignName: snapshot.campaignName,
    campaignStatus: snapshot.campaignStatus,
    stage,
    strategyApprovalState: snapshot.strategyApprovalState,
    posts: snapshot.posts,
    nextAction,
    updatedAt: snapshot.updatedAt,
  }
}

export function buildWorkspaceExecutionTruth(
  snapshots: CampaignExecutionSnapshot[],
  generatedAt = new Date(),
): WorkspaceExecutionTruth {
  const campaigns = snapshots.map(buildCampaignExecutionTruth)
  const queue = campaigns
    .flatMap((campaign) => campaign.nextAction ? [campaign.nextAction] : [])
    .sort((a, b) => {
      const priority = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      if (priority !== 0) return priority
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })

  return {
    version: 1,
    generatedAt: generatedAt.toISOString(),
    summary: {
      campaigns: campaigns.length,
      needsAttention: campaigns.filter((campaign) => campaign.stage === 'NEEDS_ATTENTION').length,
      awaitingApproval: queue.filter((action) => action.requiresApproval).length,
      scheduledPosts: campaigns.reduce((sum, campaign) => sum + campaign.posts.scheduled, 0),
      publishedPosts: campaigns.reduce((sum, campaign) => sum + campaign.posts.published, 0),
    },
    queue,
    campaigns,
  }
}
