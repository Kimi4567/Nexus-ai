export type JourneyStepId =
  | 'COMPLETE_BRAND_BRAIN'
  | 'CREATE_FIRST_STRATEGY'
  | 'REVIEW_DRAFT_STRATEGY'
  | 'CREATE_CAMPAIGN_CONTENT_PLAN'
  | 'REVIEW_APPROVE_CONTENT'
  | 'CHECK_PUBLISH_READINESS'

export type StrategyState = 'none' | 'draft' | 'approved'

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

export function getFirstUserJourneyStep(input: FirstUserJourneyInput): FirstUserJourneyStep {
  if (!input.brandBrainReady) return STEP_MAP.COMPLETE_BRAND_BRAIN
  if (input.strategyState === 'none') return STEP_MAP.CREATE_FIRST_STRATEGY
  if (input.strategyState === 'draft') return STEP_MAP.REVIEW_DRAFT_STRATEGY
  if (!input.hasCampaignOrContent || !input.hasContent) return STEP_MAP.CREATE_CAMPAIGN_CONTENT_PLAN
  if (!input.contentApproved) return STEP_MAP.REVIEW_APPROVE_CONTENT
  return STEP_MAP.CHECK_PUBLISH_READINESS
}
