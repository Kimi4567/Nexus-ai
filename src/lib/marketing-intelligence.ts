import { prisma } from '@/lib/prisma'
import { derivePublishingState, type PublishingState } from '@/lib/operatingBriefStatus'
import { hasRealPerformanceAnalytics, numberFromPerformanceMetric } from '@/lib/performanceEvidence'

type SignalSeverity = 'good' | 'watch' | 'risk'
type ActionPriority = 'high' | 'medium' | 'low'

export interface MarketingSignal {
  id: string
  label: string
  labelAr: string
  value: string
  valueAr: string
  severity: SignalSeverity
}

export interface MarketingAction {
  id: string
  title: string
  titleAr: string
  reason: string
  reasonAr: string
  href: string
  priority: ActionPriority
}

export interface MarketingRisk {
  id: string
  title: string
  titleAr: string
  detail: string
  detailAr: string
}

export interface MarketingIntelligenceBrief {
  maturityScore: number
  stage: string
  stageAr: string
  summary: string
  summaryAr: string
  nextBestAction: MarketingAction
  actions: MarketingAction[]
  signals: MarketingSignal[]
  risks: MarketingRisk[]
  loop: {
    strategy: boolean
    content: boolean
    publishing: boolean
    learning: boolean
  }
  /**
   * PR-1N — display-only publishing state for the Operating Brief publishing tile.
   * Derived from real post counts (published/scheduled/draft); does NOT feed the
   * maturity score or the `loop` coverage math. Keeps the tile from reading as
   * "published ✓" when nothing is actually live.
   */
  publishingState: PublishingState
}

type BrandProfileSnapshot = {
  brandName: string | null
  industry: string | null
  description: string | null
  targetAudience: string | null
  primaryOffer: string | null
  winningHooks: string[]
  winningAngles: string[]
  failedAngles: string[]
  topPlatforms: string[]
  aiInsights: unknown
}

type SocialPostSnapshot = {
  status: string
  scheduledAt: Date | null
  publishedAt: Date | null
  analyticsData: unknown
  variantGroup: string | null
  variantWinner: boolean
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value && value.trim().length > 0)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function averageEngagement(posts: SocialPostSnapshot[]): number | null {
  const rates = posts
    .map(post => {
      if (!hasRealPerformanceAnalytics(post.analyticsData) || !isRecord(post.analyticsData)) return null
      return numberFromPerformanceMetric(post.analyticsData.engagementRate)
    })
    .filter((rate): rate is number => rate !== null)

  if (rates.length === 0) return null
  return rates.reduce((sum, rate) => sum + rate, 0) / rates.length
}

function hasAiInsights(value: unknown): boolean {
  if (!isRecord(value)) return false
  const summary = typeof value.summary === 'string' ? value.summary.trim() : ''
  const recommendations = Array.isArray(value.recommendations) ? value.recommendations : []
  return summary.length > 0 || recommendations.length > 0
}

/**
 * A campaign row is only a strategy signal when it contains a usable strategy
 * contract. JSON presence alone is not enough: failed engine runs and legacy
 * rows can persist `aiOutput` with only status/error metadata.
 */
export function hasSavedStrategyContract(value: unknown): boolean {
  if (!isRecord(value)) return false
  const strategy = isRecord(value.strategy) ? value.strategy : value
  if (Object.keys(strategy).length === 0) return false

  const contractKeys = [
    'keyMessage',
    'coreMessage',
    'positioning',
    'contentPillars',
    'contentCalendar',
    'weeklyPlan',
    'weeklyExecutionPlan',
    'funnelStages',
    'measurementPlan',
  ]

  return contractKeys.some((key) => {
    const candidate = strategy[key]
    if (typeof candidate === 'string') return candidate.trim().length > 0
    if (Array.isArray(candidate)) return candidate.length > 0
    return isRecord(candidate) && Object.keys(candidate).length > 0
  })
}

function scoreBrandReadiness(brand: BrandProfileSnapshot | null): number {
  if (!brand) return 0
  const checks = [
    hasText(brand.brandName),
    hasText(brand.industry),
    hasText(brand.description),
    hasText(brand.targetAudience),
    hasText(brand.primaryOffer),
    brand.winningHooks.length > 0 || brand.winningAngles.length > 0,
    brand.topPlatforms.length > 0,
    hasAiInsights(brand.aiInsights),
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

function stageFor(score: number): { stage: string; stageAr: string } {
  if (score >= 80) return { stage: 'Operating system', stageAr: 'نظام تشغيل تسويقي' }
  if (score >= 55) return { stage: 'Guided marketing machine', stageAr: 'ماكينة تسويق موجهة' }
  if (score >= 30) return { stage: 'Campaign assistant', stageAr: 'مساعد حملات' }
  return { stage: 'Setup mode', stageAr: 'مرحلة الإعداد' }
}

function action(
  id: string,
  priority: ActionPriority,
  href: string,
  title: string,
  titleAr: string,
  reason: string,
  reasonAr: string
): MarketingAction {
  return { id, priority, href, title, titleAr, reason, reasonAr }
}

export async function buildMarketingIntelligenceBrief(userId: string): Promise<MarketingIntelligenceBrief> {
  const workspace = await prisma.workspace.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })


  const emptyAction = action(
    'create-workspace',
    'high',
    '/onboarding',
    'Finish onboarding',
    'أكمل الإعداد',
    'NEXUS needs a workspace before it can coordinate strategy, content, publishing, signals, and analytics.',
    'NEXUS يحتاج مساحة عمل قبل تنسيق الاستراتيجية والمحتوى والنشر والإشارات والتحليلات.'
  )

  if (!workspace) {
    return {
      maturityScore: 5,
      ...stageFor(5),
      summary: 'NEXUS is waiting for onboarding so the agents can start operating from one shared workspace.',
      summaryAr: 'NEXUS ينتظر إكمال الإعداد حتى يبدأ الوكلاء العمل من مساحة واحدة مشتركة.',
      nextBestAction: emptyAction,
      actions: [emptyAction],
      signals: [],
      risks: [{ id: 'no-workspace', title: 'No workspace yet', titleAr: 'لا توجد مساحة عمل', detail: 'Campaigns, analytics, and Brand Brain signals need a workspace anchor.', detailAr: 'الحملات والتحليلات وإشارات Brand Brain تحتاج مساحة عمل أساسية.' }],
      loop: { strategy: false, content: false, publishing: false, learning: false },
      publishingState: 'none',
    }
  }

  const db = prisma as unknown as {
    socialPost: {
      findMany(args: unknown): Promise<SocialPostSnapshot[]>
      count(args: unknown): Promise<number>
    }
    agentSuggestion: {
      count(args: unknown): Promise<number>
    }
    integration: {
      count(args: unknown): Promise<number>
    }
  }

  const [
    brand,
    totalCampaigns,
    strategyCandidates,
    activeCampaigns,
    recentPosts,
    draftPosts,
    scheduledPosts,
    publishedPosts,
    connectedIntegrations,
    pendingSuggestions,
    urgentSuggestions,
    mostRecentCampaign,
  ] = await Promise.all([
    prisma.brandProfile.findUnique({
      where: { workspaceId: workspace.id },
      select: {
        brandName: true,
        industry: true,
        description: true,
        targetAudience: true,
        primaryOffer: true,
        winningHooks: true,
        winningAngles: true,
        failedAngles: true,
        topPlatforms: true,
        aiInsights: true,
      },
    }) as Promise<BrandProfileSnapshot | null>,
    prisma.campaign.count({ where: { workspaceId: workspace.id } }),
    prisma.campaign.findMany({
      where: {
        workspaceId: workspace.id,
      },
      select: {
        strategy: true,
        aiOutput: true,
      },
    }),
    prisma.campaign.count({ where: { workspaceId: workspace.id, status: 'ACTIVE' } }),
    db.socialPost.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { updatedAt: 'desc' },
      take: 40,
      select: {
        status: true,
        scheduledAt: true,
        publishedAt: true,
        analyticsData: true,
        variantGroup: true,
        variantWinner: true,
      },
    }),
    db.socialPost.count({ where: { workspaceId: workspace.id, status: 'DRAFT' } }),
    db.socialPost.count({ where: { workspaceId: workspace.id, status: 'SCHEDULED' } }),
    db.socialPost.count({ where: { workspaceId: workspace.id, status: 'PUBLISHED' } }),
    db.integration.count({ where: { workspaceId: workspace.id, status: 'CONNECTED' } }),
    db.agentSuggestion.count({ where: { workspaceId: workspace.id, status: 'PENDING' } }),
    db.agentSuggestion.count({ where: { workspaceId: workspace.id, status: 'PENDING', priority: 1 } }),
    prisma.campaign.findFirst({
      where: { workspaceId: workspace.id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    }),
  ])

  const brandScore = scoreBrandReadiness(brand)
  const strategyCampaigns = strategyCandidates.filter((campaign) => (
    hasSavedStrategyContract(campaign.strategy) || hasSavedStrategyContract(campaign.aiOutput)
  )).length
  const hasStrategy = strategyCampaigns > 0
  const hasContent = recentPosts.length > 0
  // A connected account proves publishing *readiness*, not execution. Keep
  // setup/connection progress separate from the operating loop: publishing is
  // complete only after at least one post is scheduled or actually published.
  // Otherwise a newly connected workspace would appear to have completed the
  // publishing stage before any content left the system.
  const hasPublishing = publishedPosts > 0 || scheduledPosts > 0
  const hasReviewedSignals = Boolean(
    brand &&
    (brand.winningHooks.length > 0 ||
      brand.winningAngles.length > 0 ||
      brand.failedAngles.length > 0 ||
      brand.topPlatforms.length > 0 ||
      hasAiInsights(brand.aiInsights))
  )
  const postsWithAnalytics = recentPosts.filter(post => hasRealPerformanceAnalytics(post.analyticsData)).length
  const hasPerformanceLearning = postsWithAnalytics > 0
  const loop = { strategy: hasStrategy, content: hasContent, publishing: hasPublishing, learning: hasPerformanceLearning }
  const completedLoopCount = Object.values(loop).filter(Boolean).length
  const loopScore = completedLoopCount * 15
  const volumeScore = Math.min(20, totalCampaigns * 4 + publishedPosts * 2 + scheduledPosts)
  const rawMaturityScore = Math.round(brandScore * 0.4 + loopScore + volumeScore)
  const loopCap = completedLoopCount === 4 ? 100 : completedLoopCount === 3 ? 84 : completedLoopCount === 2 ? 64 : completedLoopCount === 1 ? 42 : 24
  const maturityScore = Math.min(loopCap, rawMaturityScore)
  const stage = stageFor(maturityScore)
  const avgEngagement = averageEngagement(recentPosts)
  const hasAbTests = recentPosts.some(post => post.variantGroup)

  // Dynamic hrefs — context-aware routing
  const mostRecentCampaignId = mostRecentCampaign?.id ?? null
  const contentPlanHref = mostRecentCampaignId
    ? `/campaigns/${mostRecentCampaignId}/content-hub`
    : '/campaigns'

  const actions: MarketingAction[] = []
  if (brandScore < 70) {
    actions.push(action(
      'complete-brand-brain',
      'high',
      '/brand?from=brief',
      'Complete Brand Brain',
      'أكمل Brand Brain',
      'The agents need sharper positioning, audience, offer, and reviewed signal context before they can behave like a senior marketing team.',
      'الوكلاء يحتاجون تموضعًا وجمهورًا وعرضًا وسياق إشارات مراجَعًا أوضح حتى يعملوا كفريق تسويق ناضج.'
    ))
  }
  if (totalCampaigns === 0) {
    // PR-F: Strategy-first journey. With no campaigns yet, the next step is to
    // turn the Brand Brain into a plan on the Strategy page — NOT to jump
    // straight into campaign creation. This routes to /strategy only (a planning
    // entry point); it does not create a campaign, does not open Run Full
    // Strategy, and triggers no generation. Execution guidance returns via later
    // states once a strategy/campaign exists.
    actions.push(action(
      'create-first-strategy',
      'high',
      '/strategy',
      'Create your first strategy',
      'إنشاء أول استراتيجية',
      'Turn your Brand Brain into a clear plan first. On the Strategy page, NEXUS organizes organic content direction and paid planning before any execution step.',
      'حوّل ذاكرة علامتك التجارية إلى خطة واضحة أولاً. في صفحة الاستراتيجية، ينظّم NEXUS اتجاه المحتوى العضوي والتخطيط المدفوع قبل أي خطوة تنفيذ.'
    ))
  }
  if (totalCampaigns > 0 && !hasStrategy) {
    actions.push(action(
      'run-full-strategy',
      'high',
      '/strategy',
      'Open the strategy workflow',
      'افتح مسار الاستراتيجية',
      'Campaigns exist, but the strategy loop is not confirmed yet. Review the strategy workflow before approving execution.',
      'توجد حملات، لكن حلقة الاستراتيجية غير مؤكدة بعد. راجع مسار الاستراتيجية قبل الموافقة على التنفيذ.'
    ))
  }
  if (totalCampaigns > 0 && recentPosts.length === 0) {
    actions.push(action(
      'generate-content-plan',
      'high',
      contentPlanHref,
      'Generate a content plan',
      'ولّد خطة محتوى',
      'The strategy layer exists, but the workflow needs planned posts before publishing decisions and analytics-backed learning are possible.',
      'طبقة الاستراتيجية موجودة، لكن سير العمل يحتاج منشورات مخططة قبل قرارات النشر وقبل أن يصبح تعلم الأداء المبني على التحليلات ممكناً.'
    ))
  }
  if (recentPosts.length > 0 && connectedIntegrations === 0) {
    actions.push(action(
      'connect-platforms',
      'medium',
      '/connections',
      'Connect publishing channels',
      'اربط قنوات النشر',
      'Content exists, but publishing and analytics need at least one connected platform.',
      'المحتوى موجود، لكن النشر والتحليلات يحتاجان منصة واحدة مرتبطة على الأقل.'
    ))
  }
  if (draftPosts > 0 && scheduledPosts === 0 && publishedPosts === 0) {
    actions.push(action(
      'schedule-drafts',
      'medium',
      '/calendar',
      'Schedule draft content',
      'جدول المحتوى المسود',
      'Drafts are waiting in the system; scheduling turns the plan into execution.',
      'المسودات تنتظر داخل النظام؛ الجدولة تحول الخطة إلى تنفيذ.'
    ))
  }
  if (publishedPosts > 0 && !hasPerformanceLearning) {
    actions.push(action(
      'connect-performance-evidence',
      'medium',
      '/analytics',
      'Connect performance evidence',
      'اربط دليل الأداء',
      'Published or manually recorded work is a workflow signal only. Connect trusted analytics before NEXUS learns performance patterns.',
      'المحتوى المنشور أو المسجل يدويًا هو إشارة سير عمل فقط. اربط تحليلات موثوقة قبل أن يتعلم NEXUS أنماط الأداء.'
    ))
  }
  if (publishedPosts >= 2 && !hasAbTests) {
    actions.push(action(
      'create-ab-test',
      'low',
      mostRecentCampaignId ? `/campaigns/${mostRecentCampaignId}/content-hub` : '/campaigns',
      'Create an A/B variant',
      'أنشئ اختبار A/B',
      'The next jump in intelligence comes from comparing hooks, angles, and CTAs instead of guessing.',
      'القفزة التالية في الذكاء تأتي من مقارنة الخطافات والزوايا والدعوات بدلا من التخمين.'
    ))
  }

  if (actions.length === 0) {
    actions.push(action(
      'inspect-analytics',
      'low',
      '/analytics',
      'Inspect performance trends',
      'راجع اتجاهات الأداء',
      'The core loop has evidence; the best next move is to inspect what is compounding and what is slowing down.',
      'الدورة الأساسية لديها أدلة؛ أفضل خطوة هي مراجعة ما يتراكم وما يبطئ النمو.'
    ))
  }

  const signals: MarketingSignal[] = [
    {
      id: 'loop',
      label: 'Loop coverage',
      labelAr: 'تغطية الدورة',
      value: `${completedLoopCount}/4`,
      valueAr: `${completedLoopCount}/4`,
      severity: Object.values(loop).every(Boolean) ? 'good' : 'watch',
    },
    {
      // PX-2B.2 — label aligned with /brand and /strategy ("Brand Memory").
      // The value/severity below are the brief's internal default; the dashboard
      // OVERRIDES this signal with the maturity STATUS (Early/Developing/Strong)
      // via getBrandMemoryStatusCopy(brandStatus), so the scoreBrandReadiness()
      // percentage is never user-facing. brandScore stays internal (maturity
      // ordering + action thresholds), its math unchanged.
      id: 'brand',
      label: 'Brand Memory',
      labelAr: 'ذاكرة العلامة التجارية',
      value: `${brandScore}%`,
      valueAr: `${brandScore}%`,
      severity: brandScore >= 70 ? 'good' : brandScore >= 40 ? 'watch' : 'risk',
    },
    {
      id: 'execution',
      label: 'Execution surface',
      labelAr: 'سطح التنفيذ',
      value: `${publishedPosts} published · ${scheduledPosts} scheduled`,
      valueAr: `${publishedPosts} منشور · ${scheduledPosts} مجدول`,
      severity: publishedPosts > 0 || scheduledPosts > 0 ? 'good' : recentPosts.length > 0 ? 'watch' : 'risk',
    },
    {
      id: 'learning',
      label: 'Signal evidence',
      labelAr: 'دليل الإشارات',
      value: hasReviewedSignals ? 'Reviewed signals saved' : 'Not captured',
      valueAr: hasReviewedSignals ? 'إشارات مراجَعة محفوظة' : 'غير مسجل',
      severity: hasReviewedSignals ? 'good' : 'watch',
    },
    {
      id: 'performance-evidence',
      label: 'Performance evidence',
      labelAr: 'دليل الأداء',
      value: hasPerformanceLearning ? `${postsWithAnalytics} post${postsWithAnalytics === 1 ? '' : 's'} with analytics` : 'Waiting for analytics',
      valueAr: hasPerformanceLearning ? `${postsWithAnalytics} منشور بتحليلات` : 'بانتظار التحليلات',
      severity: hasPerformanceLearning ? 'good' : 'watch',
    },
  ]

  if (avgEngagement !== null) {
    signals.push({
      id: 'engagement',
      label: 'Avg engagement',
      labelAr: 'متوسط التفاعل',
      value: `${avgEngagement.toFixed(1)}%`,
      valueAr: `${avgEngagement.toFixed(1)}%`,
      severity: avgEngagement >= 3 ? 'good' : avgEngagement >= 1 ? 'watch' : 'risk',
    })
  }
  if (pendingSuggestions > 0) {
    signals.push({
      id: 'pending-suggestions',
      label: 'Pending approvals',
      labelAr: 'موافقات معلقة',
      value: urgentSuggestions > 0 ? `${pendingSuggestions} pending · ${urgentSuggestions} urgent` : `${pendingSuggestions} pending`,
      valueAr: urgentSuggestions > 0 ? `${pendingSuggestions} معلقة · ${urgentSuggestions} عاجلة` : `${pendingSuggestions} معلقة`,
      severity: urgentSuggestions > 0 ? 'risk' : 'watch',
    })
  }

  const risks: MarketingRisk[] = []
  if (pendingSuggestions > 0) {
    risks.push({
      id: 'pending-approvals',
      title: 'Recommendations need decisions',
      titleAr: 'التوصيات تحتاج قرارا',
      detail: 'Agent recommendations are useful approvals, but they should not replace the next operating step.',
      detailAr: 'توصيات الوكلاء مفيدة كموافقات، لكنها لا يجب أن تستبدل خطوة التشغيل التالية.',
    })
  }
  if (connectedIntegrations === 0 && recentPosts.length > 0) {
    risks.push({
      id: 'manual-execution',
      title: 'Execution may stay manual',
      titleAr: 'التنفيذ قد يظل يدويا',
      detail: 'Content is being created before channels are connected, so analytics and publishing feedback will be limited.',
      detailAr: 'يتم إنشاء المحتوى قبل ربط القنوات، لذلك ستكون التحليلات وملاحظات النشر محدودة.',
    })
  }
  if (brandScore < 50) {
    risks.push({
      id: 'thin-brand-memory',
      title: 'Brand memory is thin',
      titleAr: 'ذاكرة العلامة ضعيفة',
      detail: 'Outputs can become generic until the brand profile captures audience, offer, positioning, and proof.',
      detailAr: 'قد تصبح المخرجات عامة إلى أن يسجل ملف العلامة الجمهور والعرض والتموضع والدليل.',
    })
  }
  if (totalCampaigns > 0 && activeCampaigns === 0) {
    risks.push({
      id: 'no-active-campaigns',
      title: 'No campaign in ongoing management',
      titleAr: 'لا توجد حملة في إدارة مستمرة',
      detail: 'The system has campaign assets, but no campaign workflow is currently marked for ongoing management inside NEXUS.',
      detailAr: 'النظام لديه أصول حملات، لكن لا يوجد سير عمل حملة محدد للإدارة المستمرة داخل NEXUS.',
    })
  }

  const summary = maturityScore >= 80
    ? 'NEXUS has a coordinated marketing operating view: strategy, content, execution records, reviewed signals, and analytics are connected.'
    : maturityScore >= 55
    ? 'NEXUS has the pieces of a marketing machine; the next gain is tightening execution and feedback.'
    : maturityScore >= 30
    ? 'NEXUS can guide campaigns now, but needs stronger memory and execution signals before it becomes more dependable.'
    : 'NEXUS is still in setup mode; complete the operating loop before judging output quality.'

  const summaryAr = maturityScore >= 80
    ? 'NEXUS لديه رؤية تشغيل تسويقية منسقة: الاستراتيجية والمحتوى وسجلات التنفيذ والإشارات المراجَعة والتحليلات متصلة.'
    : maturityScore >= 55
    ? 'NEXUS لديه مكونات ماكينة تسويق؛ المكسب التالي هو إحكام التنفيذ والتغذية الراجعة.'
    : maturityScore >= 30
    ? 'NEXUS قادر على توجيه الحملات الآن، لكنه يحتاج ذاكرة أقوى وإشارات تنفيذ ليصبح أكثر اعتمادية.'
    : 'NEXUS لا يزال في مرحلة الإعداد؛ أكمل دورة التشغيل قبل الحكم على جودة المخرجات.'

  return {
    maturityScore,
    ...stage,
    summary,
    summaryAr,
    nextBestAction: actions[0],
    actions: actions.slice(0, 4),
    signals,
    risks: risks.slice(0, 3),
    loop,
    // Display-only (PR-1N): honest publishing tile state from real counts.
    publishingState: derivePublishingState({
      published: publishedPosts,
      scheduled: scheduledPosts,
      pending: draftPosts,
    }),
  }
}
