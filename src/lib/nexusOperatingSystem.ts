import {
  deriveCampaignOperatingState,
  type CampaignOperatingInput,
  type CampaignOperatingState,
  type CampaignOperatingStage,
} from '@/lib/campaignOperatingState'
import {
  summarizeContentHubMediaReadiness,
  type ContentHubMediaStateInput,
} from '@/lib/contentHubMediaState'

export type NexusOsSurfaceKey =
  | 'strategy'
  | 'content'
  | 'calendar'
  | 'creative'
  | 'publish'
  | 'autopilot'
  | 'performance'

export type NexusOsSurfaceStatus =
  | 'missing'
  | 'needs_review'
  | 'ready_for_next_step'
  | 'in_progress'
  | 'waiting'
  | 'locked'
  | 'truth_safe'

export type NexusOsActionRisk =
  | 'read_only'
  | 'credit_spend'
  | 'data_mutation'
  | 'external_publish'
  | 'learning_update'
  | 'admin_or_refund'

export type NexusOsActionId =
  | 'create_strategy'
  | 'review_strategy'
  | 'build_content_plan'
  | 'review_content_hub'
  | 'schedule_approved_posts'
  | 'review_publish_readiness'
  | 'review_performance'
  | 'review_brand_signals'
  | 'complete_brand_brain'
  | 'no_action'

export type NexusOsCalendarSource =
  | 'none'
  | 'strategy_plan'
  | 'social_posts'

export type NexusOsI18nString = {
  en: string
  ar: string
}

export type NexusOsPostInput = NonNullable<CampaignOperatingInput['posts']>[number] & ContentHubMediaStateInput & {
  contentPlanIndex?: number | null
}

export interface NexusOsGeneratedVisualInput {
  status?: string | null
  visualType?: string | null
  imageUrl?: string | null
  metadata?: unknown
  assetRole?: string | null
}

export interface NexusOperatingSystemInput extends CampaignOperatingInput {
  posts?: NexusOsPostInput[]
  generatedVisuals?: NexusOsGeneratedVisualInput[] | null
  hasConnectedPublishingAccount?: boolean | null
  brandBrainReady?: boolean | null
}

export interface NexusOsSurface {
  key: NexusOsSurfaceKey
  status: NexusOsSurfaceStatus
  title: NexusOsI18nString
  helper: NexusOsI18nString
  primaryAction: NexusOsAction
  blockers: string[]
}

export interface NexusOsAction {
  id: NexusOsActionId
  label: NexusOsI18nString
  href: string
  risk: NexusOsActionRisk
  requiresExplicitConfirmation: boolean
  reason: NexusOsI18nString
}

export interface NexusOsTruthMap {
  hasStrategy: boolean
  hasGeneratedContent: boolean
  hasApprovedContent: boolean
  hasScheduledContent: boolean
  hasPublishedContent: boolean
  hasManualPublishedContent: boolean
  hasApiPublishedContent: boolean
  hasAnalyticsData: boolean
  hasConnectedPublishingAccount: boolean
  hasAutopilotEnabled: boolean
  hasWeeklyExecutionPlan: boolean
  hasStrategyCalendarPlan: boolean
  hasScheduledPostCalendar: boolean
  contentHubIsFinalPostSourceOfTruth: boolean
  performanceLearningAllowed: boolean
}

export interface NexusOsVisualSummary {
  totalCompletedVisuals: number
  conceptVisuals: number
  postBackgroundVisuals: number
  ambiguousCompletedVisuals: number
}

export interface NexusOperatingSystemSnapshot {
  operatingState: CampaignOperatingState
  stage: CampaignOperatingStage
  truth: NexusOsTruthMap
  counts: {
    totalPosts: number
    draftPosts: number
    approvedPosts: number
    scheduledPosts: number
    publishedPosts: number
    manualPublishedPosts: number
    apiPublishedPosts: number
    mediaReadyPosts: number
    mediaNeedsAttentionPosts: number
    ambiguousMediaPreviewPosts: number
  }
  calendar: {
    source: NexusOsCalendarSource
    scheduledPostCount: number
    strategyPlanCount: number
    title: NexusOsI18nString
    helper: NexusOsI18nString
  }
  visuals: NexusOsVisualSummary
  surfaces: Record<NexusOsSurfaceKey, NexusOsSurface>
  nextBestAction: NexusOsAction
  productLaws: string[]
}

const READ_ONLY: NexusOsActionRisk = 'read_only'

function action(
  id: NexusOsActionId,
  label: NexusOsI18nString,
  href: string,
  reason: NexusOsI18nString,
  risk: NexusOsActionRisk = READ_ONLY,
  requiresExplicitConfirmation = false,
): NexusOsAction {
  return { id, label, href, risk, requiresExplicitConfirmation, reason }
}

const ACTIONS: Record<NexusOsActionId, NexusOsAction> = {
  create_strategy: action(
    'create_strategy',
    { en: 'Create strategy', ar: 'إنشاء استراتيجية' },
    '/strategy',
    {
      en: 'A strategy is required before NEXUS can plan content or execution.',
      ar: 'تحتاج الحملة إلى استراتيجية قبل أن يخطط NEXUS للمحتوى أو التنفيذ.',
    },
    'credit_spend',
    true,
  ),
  review_strategy: action(
    'review_strategy',
    { en: 'Review strategy', ar: 'راجع الاستراتيجية' },
    '#strategy',
    {
      en: 'Strategy exists and needs review before downstream planning.',
      ar: 'توجد استراتيجية وتحتاج مراجعة قبل التخطيط اللاحق.',
    },
  ),
  build_content_plan: action(
    'build_content_plan',
    { en: 'Build content plan', ar: 'إنشاء خطة محتوى' },
    '#build-content-plan',
    {
      en: 'No post plan exists yet. Build reviewable content before scheduling or publishing.',
      ar: 'لا توجد خطة منشورات بعد. أنشئ محتوى قابلًا للمراجعة قبل الجدولة أو النشر.',
    },
    'credit_spend',
    true,
  ),
  review_content_hub: action(
    'review_content_hub',
    { en: 'Review Content Hub', ar: 'راجع Content Hub' },
    '/content-hub',
    {
      en: 'Content Hub is the source of truth for post copy, lifecycle, and media decisions.',
      ar: 'Content Hub هو مصدر الحقيقة لنصوص المنشورات وحالتها وقرارات الوسائط.',
    },
  ),
  schedule_approved_posts: action(
    'schedule_approved_posts',
    { en: 'Schedule approved posts', ar: 'جدولة المنشورات المعتمدة' },
    '/content-hub',
    {
      en: 'Approved posts are waiting for schedule decisions.',
      ar: 'المنشورات المعتمدة تنتظر قرارات الجدولة.',
    },
    'data_mutation',
    true,
  ),
  review_publish_readiness: action(
    'review_publish_readiness',
    { en: 'Review publish readiness', ar: 'راجع جاهزية النشر' },
    '#publish',
    {
      en: 'Publishing requires account, permission, media, and explicit confirmation checks.',
      ar: 'النشر يحتاج تحقق الحساب والصلاحيات والوسائط والتأكيد الصريح.',
    },
  ),
  review_performance: action(
    'review_performance',
    { en: 'Review performance', ar: 'راجع الأداء' },
    '#performance',
    {
      en: 'Performance is only meaningful after real analytics data is fetched.',
      ar: 'الأداء لا يصبح ذا معنى إلا بعد جلب تحليلات حقيقية.',
    },
  ),
  review_brand_signals: action(
    'review_brand_signals',
    { en: 'Review Brand Brain signals', ar: 'راجع إشارات Brand Brain' },
    '/brand',
    {
      en: 'Signals must be reviewed before they become durable brand memory.',
      ar: 'يجب مراجعة الإشارات قبل أن تصبح ذاكرة علامة دائمة.',
    },
    'learning_update',
    true,
  ),
  complete_brand_brain: action(
    'complete_brand_brain',
    { en: 'Complete Brand Brain', ar: 'أكمل Brand Brain' },
    '/brand',
    {
      en: 'Brand Brain context improves strategy, content, and creative quality.',
      ar: 'سياق Brand Brain يحسن جودة الاستراتيجية والمحتوى والإبداع.',
    },
  ),
  no_action: action(
    'no_action',
    { en: 'No action required', ar: 'لا توجد خطوة مطلوبة' },
    '#',
    {
      en: 'This surface is informational for the current campaign state.',
      ar: 'هذه الواجهة معلوماتية لحالة الحملة الحالية.',
    },
  ),
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function arrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0
}

function getStrategyRecord(aiOutput: unknown): Record<string, unknown> {
  if (!isRecord(aiOutput)) return {}
  return isRecord(aiOutput.strategy) ? aiOutput.strategy : {}
}

function hasWeeklyExecutionPlan(aiOutput: unknown): boolean {
  if (!isRecord(aiOutput)) return false
  const strategy = getStrategyRecord(aiOutput)
  return arrayLength(strategy.weeklyExecutionPlan) > 0 || arrayLength(aiOutput.weeklyExecutionPlan) > 0
}

function strategyCalendarPlanCount(aiOutput: unknown): number {
  if (!isRecord(aiOutput)) return 0
  const strategy = getStrategyRecord(aiOutput)
  return Math.max(
    arrayLength(aiOutput.calendarItems),
    arrayLength(aiOutput.contentCalendar),
    arrayLength(strategy.contentCalendar),
    arrayLength(strategy.weeklyPlan),
    arrayLength(strategy.weeklyExecutionPlan),
  )
}

function visualRole(visual: NexusOsGeneratedVisualInput): string {
  if (typeof visual.assetRole === 'string') return visual.assetRole
  if (!isRecord(visual.metadata)) return ''
  const candidates = [
    visual.metadata.assetRole,
    visual.metadata.role,
    visual.metadata.sourceRole,
    visual.metadata.outputClassification,
  ]
  return candidates.find((value): value is string => typeof value === 'string') ?? ''
}

function summarizeVisuals(visuals: NexusOsGeneratedVisualInput[] = []): NexusOsVisualSummary {
  return visuals.reduce<NexusOsVisualSummary>((summary, visual) => {
    const status = String(visual.status ?? '').toUpperCase()
    if (status !== 'COMPLETED' || !visual.imageUrl) return summary

    summary.totalCompletedVisuals += 1
    const role = visualRole(visual).toLowerCase()
    if (role.includes('concept')) summary.conceptVisuals += 1
    else if (role.includes('post') || role.includes('background') || role.includes('draft_visual_asset')) {
      summary.postBackgroundVisuals += 1
    } else {
      summary.ambiguousCompletedVisuals += 1
    }
    return summary
  }, {
    totalCompletedVisuals: 0,
    conceptVisuals: 0,
    postBackgroundVisuals: 0,
    ambiguousCompletedVisuals: 0,
  })
}

function surface(
  key: NexusOsSurfaceKey,
  status: NexusOsSurfaceStatus,
  title: NexusOsI18nString,
  helper: NexusOsI18nString,
  primaryAction: NexusOsAction,
  blockers: string[] = [],
): NexusOsSurface {
  return { key, status, title, helper, primaryAction, blockers }
}

function chooseNextBestAction(operatingState: CampaignOperatingState): NexusOsAction {
  if (operatingState.truthFlags.hasPendingLearning) return ACTIONS.review_brand_signals
  if (operatingState.truthFlags.hasAnalyticsData) return ACTIONS.review_performance
  if (operatingState.truthFlags.hasPublishedContent) return ACTIONS.review_performance
  if (operatingState.truthFlags.hasScheduledContent) return ACTIONS.review_publish_readiness
  if (operatingState.truthFlags.hasApprovedContent) return ACTIONS.schedule_approved_posts
  if (operatingState.truthFlags.hasDraftContent) return ACTIONS.review_content_hub
  if (operatingState.truthFlags.hasStrategy) {
    return operatingState.stage === 'strategy_review_needed' ? ACTIONS.review_strategy : ACTIONS.build_content_plan
  }
  return ACTIONS.create_strategy
}

export function deriveNexusOperatingSystem(input: NexusOperatingSystemInput): NexusOperatingSystemSnapshot {
  const posts = Array.isArray(input.posts) ? input.posts : []
  const operatingState = deriveCampaignOperatingState(input)
  const media = summarizeContentHubMediaReadiness(posts)
  const visuals = summarizeVisuals(input.generatedVisuals ?? [])

  const campaign = input.campaign ?? null
  const aiOutput = campaign?.aiOutput
  const weeklyPlanExists = hasWeeklyExecutionPlan(aiOutput)
  const strategyPlanCount = strategyCalendarPlanCount(aiOutput)
  const scheduledPostCount = operatingState.counts.scheduledPosts + operatingState.counts.publishedPosts
  const hasScheduledPostCalendar = scheduledPostCount > 0
  const hasConnectedPublishingAccount = Boolean(input.hasConnectedPublishingAccount)
  const hasAutopilotEnabled = Boolean(campaign?.autopilotEnabled)

  const truth: NexusOsTruthMap = {
    hasStrategy: operatingState.truthFlags.hasStrategy,
    hasGeneratedContent: operatingState.truthFlags.hasContentPlan,
    hasApprovedContent: operatingState.truthFlags.hasApprovedContent,
    hasScheduledContent: operatingState.truthFlags.hasScheduledContent,
    hasPublishedContent: operatingState.truthFlags.hasPublishedContent,
    hasManualPublishedContent: operatingState.truthFlags.hasManualPublishedContent,
    hasApiPublishedContent: operatingState.truthFlags.hasApiPublishedContent,
    hasAnalyticsData: operatingState.truthFlags.hasAnalyticsData,
    hasConnectedPublishingAccount,
    hasAutopilotEnabled,
    hasWeeklyExecutionPlan: weeklyPlanExists,
    hasStrategyCalendarPlan: strategyPlanCount > 0,
    hasScheduledPostCalendar,
    contentHubIsFinalPostSourceOfTruth: operatingState.truthFlags.hasContentPlan,
    performanceLearningAllowed: operatingState.truthFlags.hasAnalyticsData,
  }

  const calendarSource: NexusOsCalendarSource = hasScheduledPostCalendar
    ? 'social_posts'
    : strategyPlanCount > 0
      ? 'strategy_plan'
      : 'none'

  const calendar = {
    source: calendarSource,
    scheduledPostCount,
    strategyPlanCount,
    title: calendarSource === 'social_posts'
      ? { en: 'Scheduled post calendar', ar: 'تقويم المنشورات المجدولة' }
      : calendarSource === 'strategy_plan'
        ? { en: 'Strategy execution plan', ar: 'خطة تنفيذ الاستراتيجية' }
        : { en: 'No calendar yet', ar: 'لا يوجد تقويم بعد' },
    helper: calendarSource === 'social_posts'
      ? {
          en: 'Calendar should use scheduled and published SocialPosts as the current execution source of truth.',
          ar: 'يجب أن يستخدم التقويم المنشورات المجدولة والمنشورة كمصدر حقيقة التنفيذ الحالي.',
        }
      : calendarSource === 'strategy_plan'
        ? {
            en: 'Only a planning calendar exists. Nothing is scheduled or published until SocialPosts move through the workflow.',
            ar: 'توجد خطة تقويم فقط. لا تتم الجدولة أو النشر حتى تتحرك المنشورات عبر سير العمل.',
          }
        : {
            en: 'No strategy calendar or scheduled SocialPosts exist yet.',
            ar: 'لا توجد خطة تقويم أو منشورات مجدولة بعد.',
          },
  }

  const strategySurface = (() => {
    if (!truth.hasStrategy) {
      return surface(
        'strategy',
        'missing',
        { en: 'Strategy missing', ar: 'الاستراتيجية غير موجودة' },
        { en: 'Create a strategy before content, creative, calendar, or publishing work.', ar: 'أنشئ استراتيجية قبل المحتوى أو الإبداع أو التقويم أو النشر.' },
        ACTIONS.create_strategy,
        ['strategy'],
      )
    }
    if (truth.hasGeneratedContent) {
      return surface(
        'strategy',
        'truth_safe',
        { en: 'Strategy is reference material', ar: 'الاستراتيجية مادة مرجعية' },
        { en: 'Content already exists. Use Content Hub and the operating state for current execution truth.', ar: 'المحتوى موجود بالفعل. استخدم Content Hub وحالة التشغيل كمصدر حقيقة التنفيذ الحالي.' },
        ACTIONS.review_content_hub,
      )
    }
    if (operatingState.stage === 'strategy_review_needed') {
      return surface(
        'strategy',
        'needs_review',
        { en: 'Strategy needs review', ar: 'الاستراتيجية تحتاج مراجعة' },
        { en: 'Review the strategy before building the first content plan.', ar: 'راجع الاستراتيجية قبل إنشاء أول خطة محتوى.' },
        ACTIONS.review_strategy,
        ['strategy_review'],
      )
    }
    return surface(
      'strategy',
      'ready_for_next_step',
      { en: 'Strategy ready for content planning', ar: 'الاستراتيجية جاهزة لتخطيط المحتوى' },
      { en: 'Build a reviewable content plan. Nothing publishes from strategy.', ar: 'أنشئ خطة محتوى قابلة للمراجعة. لا يتم نشر شيء من الاستراتيجية.' },
      ACTIONS.build_content_plan,
    )
  })()

  const contentSurface = (() => {
    if (!truth.hasGeneratedContent) {
      return surface(
        'content',
        truth.hasStrategy ? 'missing' : 'locked',
        { en: 'Content plan missing', ar: 'خطة المحتوى غير موجودة' },
        { en: 'Content appears after a strategy-backed content plan is generated.', ar: 'يظهر المحتوى بعد توليد خطة محتوى مبنية على الاستراتيجية.' },
        truth.hasStrategy ? ACTIONS.build_content_plan : ACTIONS.create_strategy,
        truth.hasStrategy ? ['content_plan'] : ['strategy'],
      )
    }
    if (operatingState.truthFlags.hasDraftContent) {
      return surface(
        'content',
        'needs_review',
        { en: 'Draft content needs review', ar: 'مسودات المحتوى تحتاج مراجعة' },
        { en: 'Review and approve drafts before scheduling or publishing.', ar: 'راجع واعتمد المسودات قبل الجدولة أو النشر.' },
        ACTIONS.review_content_hub,
        ['content_review'],
      )
    }
    return surface(
      'content',
      'truth_safe',
      { en: 'Content exists in Content Hub', ar: 'المحتوى موجود في Content Hub' },
      { en: 'Content Hub is the final post preview and lifecycle source of truth.', ar: 'Content Hub هو مصدر الحقيقة لمعاينة المنشورات النهائية وحالتها.' },
      ACTIONS.review_content_hub,
    )
  })()

  const calendarSurface = surface(
    'calendar',
    calendarSource === 'none' ? 'missing' : 'truth_safe',
    calendar.title,
    calendar.helper,
    calendarSource === 'none'
      ? (truth.hasGeneratedContent ? ACTIONS.review_content_hub : ACTIONS.build_content_plan)
      : ACTIONS.review_content_hub,
    calendarSource === 'none' ? ['calendar'] : [],
  )

  const creativeSurface = surface(
    'creative',
    media.needsAttentionCount > 0 ? 'needs_review' : 'truth_safe',
    media.total > 0
      ? { en: 'Post media decisions', ar: 'قرارات وسائط المنشورات' }
      : { en: 'Creative planning only', ar: 'تخطيط إبداعي فقط' },
    media.total > 0
      ? {
          en: `${media.confirmedReady}/${media.total} post media slots are confirmed ready. Content Hub remains the attachment source of truth.`,
          ar: `${media.confirmedReady}/${media.total} من خانات وسائط المنشورات مؤكدة الجاهزية. يبقى Content Hub مصدر حقيقة الربط.`,
        }
      : {
          en: 'Creative requirements can be reviewed before post media exists. No asset is attached automatically.',
          ar: 'يمكن مراجعة متطلبات الإبداع قبل وجود وسائط المنشورات. لا يتم ربط أي أصل تلقائيًا.',
        },
    ACTIONS.review_content_hub,
    media.needsAttentionCount > 0 ? ['media_decision'] : [],
  )

  const publishSurface = (() => {
    if (!truth.hasGeneratedContent) {
      return surface(
        'publish',
        'locked',
        { en: 'Nothing to publish yet', ar: 'لا يوجد ما يمكن نشره بعد' },
        { en: 'Publishing readiness starts after content exists and moves through approval/scheduling.', ar: 'تبدأ جاهزية النشر بعد وجود المحتوى ومروره بالموافقة والجدولة.' },
        ACTIONS.build_content_plan,
        ['content_plan'],
      )
    }
    if (!hasConnectedPublishingAccount) {
      return surface(
        'publish',
        'locked',
        { en: 'Platform publishing locked', ar: 'النشر عبر المنصة مقفل' },
        { en: 'Scheduled/manual states are saved in NEXUS. API publishing needs a connected account, permissions, media readiness, and explicit confirmation.', ar: 'حالات الجدولة والنشر اليدوي محفوظة داخل NEXUS. النشر عبر API يحتاج حسابًا متصلًا وصلاحيات ووسائط جاهزة وتأكيدًا صريحًا.' },
        ACTIONS.review_publish_readiness,
        ['publishing_account'],
      )
    }
    return surface(
      'publish',
      'truth_safe',
      { en: 'Publishing readiness', ar: 'جاهزية النشر' },
      { en: 'Publishing remains explicit. Scheduled posts are not automatically published unless an approved API path is ready and confirmed.', ar: 'النشر يبقى صريحًا. المنشورات المجدولة لا تُنشر تلقائيًا إلا إذا كان مسار API معتمدًا وجاهزًا ومؤكدًا.' },
      ACTIONS.review_publish_readiness,
    )
  })()

  const autopilotSurface = (() => {
    if (hasAutopilotEnabled && operatingState.truthFlags.autoPublishEnabled) {
      return surface(
        'autopilot',
        'in_progress',
        { en: 'Autopilot enabled', ar: 'الأوتوبايلوت مفعّل' },
        { en: 'Only AUTO scheduled posts can be handled by Autopilot.', ar: 'الأوتوبايلوت يتعامل فقط مع المنشورات المجدولة بصيغة AUTO.' },
        ACTIONS.review_publish_readiness,
      )
    }
    if (truth.hasScheduledContent || truth.hasManualPublishedContent) {
      return surface(
        'autopilot',
        'truth_safe',
        { en: 'Autopilot not enabled', ar: 'الأوتوبايلوت غير مفعّل' },
        { en: 'Existing scheduled or manually published posts are workflow records, not Autopilot execution. Do not ask the user to regenerate strategy just because weeklyExecutionPlan is missing.', ar: 'المنشورات المجدولة أو المؤكدة يدويًا هي سجلات سير عمل وليست تنفيذ أوتوبايلوت. لا تطلب إعادة توليد الاستراتيجية لمجرد غياب weeklyExecutionPlan.' },
        ACTIONS.review_publish_readiness,
      )
    }
    if (!weeklyPlanExists) {
      return surface(
        'autopilot',
        'locked',
        { en: 'Autopilot needs execution planning', ar: 'الأوتوبايلوت يحتاج خطة تنفيذ' },
        { en: 'For early campaigns without scheduled posts, a weekly execution plan can be required before Autopilot setup.', ar: 'في الحملات المبكرة بدون منشورات مجدولة، قد تكون خطة التنفيذ الأسبوعية مطلوبة قبل إعداد الأوتوبايلوت.' },
        ACTIONS.review_strategy,
        ['weekly_execution_plan'],
      )
    }
    return surface(
      'autopilot',
      'locked',
      { en: 'Autopilot not enabled', ar: 'الأوتوبايلوت غير مفعّل' },
      { en: 'Autopilot requires explicit enablement and publishing account readiness.', ar: 'الأوتوبايلوت يحتاج تفعيلًا صريحًا وجاهزية حساب النشر.' },
      ACTIONS.review_publish_readiness,
      ['publishing_account'],
    )
  })()

  const performanceSurface = (() => {
    if (truth.hasAnalyticsData) {
      return surface(
        'performance',
        'truth_safe',
        { en: 'Performance data ready', ar: 'بيانات الأداء جاهزة' },
        { en: 'Analytics-backed learning can be reviewed because real analytics data exists.', ar: 'يمكن مراجعة التعلم المبني على التحليلات لأن بيانات حقيقية موجودة.' },
        ACTIONS.review_performance,
      )
    }
    if (truth.hasPublishedContent) {
      return surface(
        'performance',
        'waiting',
        { en: 'Published, waiting for analytics', ar: 'منشور وينتظر التحليلات' },
        { en: 'Do not show KPI cards or learning claims before analyticsData exists.', ar: 'لا تعرض بطاقات مؤشرات أو ادعاءات تعلم قبل وجود analyticsData.' },
        ACTIONS.review_performance,
        ['analytics'],
      )
    }
    return surface(
      'performance',
      'waiting',
      { en: 'No published performance data yet', ar: 'لا توجد بيانات أداء منشورة بعد' },
      { en: 'Performance appears only after posts are published and analytics are fetched.', ar: 'يظهر الأداء فقط بعد نشر المنشورات وجلب التحليلات.' },
      ACTIONS.review_content_hub,
      ['published_content'],
    )
  })()

  return {
    operatingState,
    stage: operatingState.stage,
    truth,
    counts: {
      totalPosts: operatingState.counts.totalPosts,
      draftPosts: operatingState.counts.draftPosts,
      approvedPosts: operatingState.counts.approvedPosts,
      scheduledPosts: operatingState.counts.scheduledPosts,
      publishedPosts: operatingState.counts.publishedPosts,
      manualPublishedPosts: operatingState.counts.manualPublishedPosts,
      apiPublishedPosts: operatingState.counts.apiPublishedPosts,
      mediaReadyPosts: media.confirmedReady,
      mediaNeedsAttentionPosts: media.needsAttentionCount,
      ambiguousMediaPreviewPosts: media.ambiguousPreviewCount,
    },
    calendar,
    visuals,
    surfaces: {
      strategy: strategySurface,
      content: contentSurface,
      calendar: calendarSurface,
      creative: creativeSurface,
      publish: publishSurface,
      autopilot: autopilotSurface,
      performance: performanceSurface,
    },
    nextBestAction: chooseNextBestAction(operatingState),
    productLaws: [
      'Strategy is reference material once SocialPosts exist.',
      'Content Hub is the source of truth for final post previews, lifecycle, and media attachment.',
      'Scheduled does not mean published.',
      'Manual publish means the user published outside NEXUS and NEXUS recorded it.',
      'API publish requires connected account readiness and explicit confirmation.',
      'Autopilot is separate from manual scheduled content and requires explicit enablement.',
      'Performance learning requires real analyticsData.',
      'Generated backgrounds, concept visuals, and final attached post media are separate asset states.',
    ],
  }
}
