export type JourneyStepId =
  | 'COMPLETE_BRAND_BRAIN'
  | 'CREATE_FIRST_STRATEGY'
  | 'REVIEW_DRAFT_STRATEGY'
  | 'CREATE_CAMPAIGN_CONTENT_PLAN'
  | 'REVIEW_APPROVE_CONTENT'
  | 'CHECK_PUBLISH_READINESS'

export type StrategyState = 'none' | 'draft' | 'approved'
export type FirstRunJourneyState =
  | 'no_workspace'
  | 'brand_missing'
  | 'brand_partial'
  | 'brand_ready_for_initial_strategy'
  | 'strategy_missing'
  | 'strategy_draft_ready'
  | 'content_plan_missing'
  | 'content_review_needed'
  | 'execution_ready_later'

export interface FirstUserJourneyInput {
  brandBrainReady: boolean
  strategyState: StrategyState
  hasCampaignOrContent: boolean
  hasContent: boolean
  contentApproved: boolean
}

export interface FirstUserJourneyStep {
  id: JourneyStepId
  title: string
  titleAr: string
  helper: string
  helperAr: string
  button: string
  buttonAr: string
  href: string
}

export interface FirstRunJourneyInput {
  hasWorkspace: boolean
  hasBrandProfile?: boolean
  brandBrainReady: boolean
  strategyState?: StrategyState
  hasCampaignOrContent?: boolean
  hasContent?: boolean
  contentApproved?: boolean
}

export interface FirstRunJourneyDecision {
  state: FirstRunJourneyState
  title: string
  titleAr: string
  helper: string
  helperAr: string
  button: string
  buttonAr: string
  href: string
  blockedBy: string[]
}

const STEP_MAP: Record<JourneyStepId, FirstUserJourneyStep> = {
  COMPLETE_BRAND_BRAIN: {
    id: 'COMPLETE_BRAND_BRAIN',
    title: 'Complete Brand Brain',
    titleAr: 'أكمل Brand Brain',
    helper: 'Start by teaching NEXUS about your business. This helps your strategy, content, and publishing decisions stay accurate.',
    helperAr: 'ابدأ بتعليم NEXUS عن نشاطك. هذا يساعد الاستراتيجية والمحتوى وقرارات النشر تكون أدق.',
    button: 'Complete Brand Brain',
    buttonAr: 'أكمل Brand Brain',
    href: '/brand',
  },
  CREATE_FIRST_STRATEGY: {
    id: 'CREATE_FIRST_STRATEGY',
    title: 'Create first strategy',
    titleAr: 'أنشئ أول استراتيجية',
    helper: 'Create a clear first strategy before generating campaigns or content.',
    helperAr: 'أنشئ استراتيجية أولى واضحة قبل إنشاء الحملات أو المحتوى.',
    button: 'Create first strategy',
    buttonAr: 'أنشئ أول استراتيجية',
    href: '/strategy',
  },
  REVIEW_DRAFT_STRATEGY: {
    id: 'REVIEW_DRAFT_STRATEGY',
    title: 'Review draft strategy',
    titleAr: 'راجع الاستراتيجية المسودة',
    helper: 'A draft strategy already exists. Review and confirm it before moving forward.',
    helperAr: 'توجد استراتيجية مسودة بالفعل. راجعها واعتمدها قبل المتابعة.',
    button: 'Review draft strategy',
    buttonAr: 'راجع الاستراتيجية المسودة',
    href: '/strategy',
  },
  CREATE_CAMPAIGN_CONTENT_PLAN: {
    id: 'CREATE_CAMPAIGN_CONTENT_PLAN',
    title: 'Create campaign/content plan',
    titleAr: 'أنشئ حملة/خطة محتوى',
    helper: 'Your strategy is approved. The next step is to create campaign structure and content plan.',
    helperAr: 'الاستراتيجية معتمدة. الخطوة التالية هي إنشاء هيكل الحملة وخطة المحتوى.',
    button: 'Create campaign/content plan',
    buttonAr: 'أنشئ حملة/خطة محتوى',
    href: '/campaigns/new',
  },
  REVIEW_APPROVE_CONTENT: {
    id: 'REVIEW_APPROVE_CONTENT',
    title: 'Review and approve content',
    titleAr: 'راجع واعتمد المحتوى',
    helper: 'Content exists, but approval is still required before scheduling or publishing.',
    helperAr: 'المحتوى موجود، لكن ما زال يحتاج اعتمادًا قبل الجدولة أو النشر.',
    button: 'Review and approve content',
    buttonAr: 'راجع واعتمد المحتوى',
    href: '/content-hub',
  },
  CHECK_PUBLISH_READINESS: {
    id: 'CHECK_PUBLISH_READINESS',
    title: 'Check publish readiness',
    titleAr: 'تحقق من جاهزية النشر',
    helper: 'Content is approved. Check publish readiness before posting.',
    helperAr: 'المحتوى معتمد. تحقق من جاهزية النشر قبل الإرسال.',
    button: 'Check publish readiness',
    buttonAr: 'تحقق من جاهزية النشر',
    href: '/campaigns',
  },
}

const DECISION_MAP: Record<FirstRunJourneyState, FirstRunJourneyDecision> = {
  no_workspace: {
    state: 'no_workspace',
    title: 'Start your workspace',
    titleAr: 'ابدأ مساحة العمل',
    helper: 'Create the workspace and starter Brand Brain before NEXUS plans strategy or content.',
    helperAr: 'أنشئ مساحة العمل وذاكرة العلامة الأولية قبل أن يخطط NEXUS للاستراتيجية أو المحتوى.',
    button: 'Start setup',
    buttonAr: 'ابدأ الإعداد',
    href: '/onboarding',
    blockedBy: ['workspace'],
  },
  brand_missing: {
    state: 'brand_missing',
    title: 'Set up Brand Brain',
    titleAr: 'أعد Brand Brain',
    helper: 'NEXUS needs the basics of your business before it can recommend a strategy.',
    helperAr: 'يحتاج NEXUS أساسيات نشاطك قبل أن يوصي باستراتيجية.',
    button: 'Set up Brand Brain',
    buttonAr: 'إعداد Brand Brain',
    href: '/brand',
    blockedBy: ['brand'],
  },
  brand_partial: {
    state: 'brand_partial',
    title: 'Continue Brand Brain',
    titleAr: 'أكمل Brand Brain',
    helper: 'Your Brand Brain has started. Add the missing essentials before asking NEXUS for a stronger strategy.',
    helperAr: 'بدأت ذاكرة علامتك. أضف الأساسيات الناقصة قبل طلب استراتيجية أقوى من NEXUS.',
    button: 'Continue Brand Brain',
    buttonAr: 'أكمل Brand Brain',
    href: '/brand',
    blockedBy: ['brand_required_fields'],
  },
  brand_ready_for_initial_strategy: {
    state: 'brand_ready_for_initial_strategy',
    title: 'Create first strategy',
    titleAr: 'أنشئ أول استراتيجية',
    helper: 'Your Brand Brain core context is available for an initial strategy brief. Cost is confirmed before any credits are spent.',
    helperAr: 'السياق الأساسي في Brand Brain متاح لموجز استراتيجية أولي. يتم تأكيد التكلفة قبل صرف أي رصيد.',
    button: 'Create first strategy',
    buttonAr: 'أنشئ أول استراتيجية',
    href: '/strategy',
    blockedBy: [],
  },
  strategy_missing: {
    state: 'strategy_missing',
    title: 'Create first strategy',
    titleAr: 'أنشئ أول استراتيجية',
    helper: 'Turn your Brand Brain into a clear marketing plan before creating content or scheduling work.',
    helperAr: 'حوّل ذاكرة علامتك إلى خطة تسويق واضحة قبل إنشاء المحتوى أو جدولته.',
    button: 'Create first strategy',
    buttonAr: 'أنشئ أول استراتيجية',
    href: '/strategy',
    blockedBy: ['strategy'],
  },
  strategy_draft_ready: {
    state: 'strategy_draft_ready',
    title: 'Review draft strategy',
    titleAr: 'راجع الاستراتيجية المسودة',
    helper: 'A draft strategy exists. Review the current strategy output before moving into content.',
    helperAr: 'توجد استراتيجية مسودة. راجع مخرجات الاستراتيجية الحالية قبل الانتقال إلى المحتوى.',
    button: 'Review draft strategy',
    buttonAr: 'راجع الاستراتيجية المسودة',
    href: '/strategy',
    blockedBy: [],
  },
  content_plan_missing: {
    state: 'content_plan_missing',
    title: 'Create content plan',
    titleAr: 'أنشئ خطة محتوى',
    helper: 'The strategy layer exists. Next, create and review a content plan before scheduling or publishing.',
    helperAr: 'طبقة الاستراتيجية موجودة. أنشئ وراجع خطة محتوى قبل الجدولة أو النشر.',
    button: 'Create content plan',
    buttonAr: 'أنشئ خطة محتوى',
    href: '/content-hub',
    blockedBy: ['content_plan'],
  },
  content_review_needed: {
    state: 'content_review_needed',
    title: 'Review content plan',
    titleAr: 'راجع خطة المحتوى',
    helper: 'Draft content exists. Review the content plan before scheduling or publishing.',
    helperAr: 'توجد مسودات محتوى. راجع خطة المحتوى قبل الجدولة أو النشر.',
    button: 'Review content plan',
    buttonAr: 'راجع خطة المحتوى',
    href: '/content-hub',
    blockedBy: ['content_review'],
  },
  execution_ready_later: {
    state: 'execution_ready_later',
    title: 'Review publishing readiness',
    titleAr: 'راجع جاهزية النشر',
    helper: 'Content exists. Review platform readiness before scheduling or publishing any posts.',
    helperAr: 'المحتوى موجود. راجع جاهزية المنصات قبل جدولة أو نشر أي منشورات.',
    button: 'Review readiness',
    buttonAr: 'راجع الجاهزية',
    href: '/connections',
    blockedBy: [],
  },
}

export function getFirstUserJourneyStep(input: FirstUserJourneyInput): FirstUserJourneyStep {
  if (!input.brandBrainReady) return STEP_MAP.COMPLETE_BRAND_BRAIN
  if (input.strategyState === 'none') return STEP_MAP.CREATE_FIRST_STRATEGY
  if (input.strategyState === 'draft') return STEP_MAP.REVIEW_DRAFT_STRATEGY
  if (!input.hasCampaignOrContent || !input.hasContent) return STEP_MAP.CREATE_CAMPAIGN_CONTENT_PLAN
  if (!input.contentApproved) return STEP_MAP.REVIEW_APPROVE_CONTENT
  return STEP_MAP.CHECK_PUBLISH_READINESS
}

export function getFirstRunJourney(input: FirstRunJourneyInput): FirstRunJourneyDecision {
  if (!input.hasWorkspace) return DECISION_MAP.no_workspace
  if (!input.hasBrandProfile) return DECISION_MAP.brand_missing
  if (!input.brandBrainReady) return DECISION_MAP.brand_partial

  const strategyState = input.strategyState ?? 'none'
  const hasCampaignOrContent = Boolean(input.hasCampaignOrContent)
  const hasContent = Boolean(input.hasContent)

  if (strategyState === 'none' && !hasCampaignOrContent) {
    return DECISION_MAP.brand_ready_for_initial_strategy
  }
  if (strategyState === 'none') return DECISION_MAP.strategy_missing
  if (strategyState === 'draft') return DECISION_MAP.strategy_draft_ready
  if (!hasContent) return DECISION_MAP.content_plan_missing
  if (!input.contentApproved) return DECISION_MAP.content_review_needed
  return DECISION_MAP.execution_ready_later
}
