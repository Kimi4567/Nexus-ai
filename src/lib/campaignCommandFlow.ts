import type { CampaignOperatingState } from './campaignOperatingState'
import type { CreativeRequirementsSummary } from './creativeRequirements'
import type { PublishTabReadinessSummary } from './publishReadiness'

export type CampaignCommandFlowStepStatus =
  | 'complete'
  | 'current'
  | 'review'
  | 'blocked'
  | 'pending'

export interface CampaignCommandFlowStep {
  id: 'brand' | 'strategy' | 'content' | 'creative' | 'approval' | 'publishing' | 'performance'
  status: CampaignCommandFlowStepStatus
  titleEn: string
  titleAr: string
  helperEn: string
  helperAr: string
  metricEn: string
  metricAr: string
  href: string
}

export interface CampaignCommandFlowAction {
  titleEn: string
  titleAr: string
  helperEn: string
  helperAr: string
  labelEn: string
  labelAr: string
  href: string
}

export interface CampaignCommandFlow {
  scopeLabelEn: string
  scopeLabelAr: string
  headlineEn: string
  headlineAr: string
  helperEn: string
  helperAr: string
  boundaryEn: string
  boundaryAr: string
  nextAction: CampaignCommandFlowAction
  steps: CampaignCommandFlowStep[]
}

export interface DeriveCampaignCommandFlowInput {
  campaignId: string
  operatingState: CampaignOperatingState
  creativeSummary?: CreativeRequirementsSummary | null
  publishSummary?: PublishTabReadinessSummary | null
  brandScore?: number | null
  isPaidOnlyStrategy?: boolean
  includesPaidPlanning?: boolean
  hasCreativeBrief?: boolean
}

function statusForBrand(score: number | null | undefined): CampaignCommandFlowStepStatus {
  if (typeof score !== 'number') return 'review'
  if (score >= 70) return 'complete'
  if (score >= 50) return 'review'
  return 'blocked'
}

function brandMetric(score: number | null | undefined): { en: string; ar: string } {
  if (typeof score !== 'number') {
    return {
      en: 'Brand context needs review',
      ar: 'سياق البراند يحتاج مراجعة',
    }
  }

  return {
    en: `Brand Brain ${score}/100`,
    ar: `Brand Brain ${score}/100`,
  }
}

function strategyStatus(state: CampaignOperatingState): CampaignCommandFlowStepStatus {
  if (!state.truthFlags.hasStrategy) return 'current'
  if (state.stage === 'strategy_review_needed') return 'review'
  return 'complete'
}

function contentStatus(state: CampaignOperatingState): CampaignCommandFlowStepStatus {
  if (!state.truthFlags.hasStrategy) return 'pending'
  if (!state.truthFlags.hasContentPlan) return 'current'
  if (state.truthFlags.hasDraftContent) return 'review'
  return 'complete'
}

function creativeStatus(
  state: CampaignOperatingState,
  creativeSummary?: CreativeRequirementsSummary | null,
): CampaignCommandFlowStepStatus {
  if (!state.truthFlags.hasContentPlan) return 'pending'
  if (!creativeSummary || creativeSummary.total === 0) return 'review'
  if (creativeSummary.mediaNeeded > 0 || creativeSummary.readinessPending > 0) return 'current'
  if (creativeSummary.attachedToPost > 0) return 'complete'
  return 'review'
}

function approvalStatus(state: CampaignOperatingState): CampaignCommandFlowStepStatus {
  if (state.truthFlags.hasPublishedContent || state.truthFlags.hasScheduledContent || state.truthFlags.hasApprovedContent) {
    return 'complete'
  }
  if (state.truthFlags.hasDraftContent) return 'current'
  if (state.truthFlags.hasContentPlan) return 'review'
  return 'pending'
}

function publishingStatus(
  state: CampaignOperatingState,
  publishSummary?: PublishTabReadinessSummary | null,
): CampaignCommandFlowStepStatus {
  if (state.truthFlags.hasPublishedContent) return 'complete'
  if (state.truthFlags.hasScheduledContent || state.truthFlags.hasApprovedContent) return 'current'
  if (!state.truthFlags.hasContentPlan) return 'pending'
  if (publishSummary && !publishSummary.hasConnectedPublishingAccount) return 'review'
  return 'review'
}

function performanceStatus(state: CampaignOperatingState): CampaignCommandFlowStepStatus {
  if (state.truthFlags.hasAnalyticsData) return 'complete'
  if (state.truthFlags.hasPublishedContent) return 'current'
  return 'pending'
}

function deriveNextAction(input: DeriveCampaignCommandFlowInput): CampaignCommandFlowAction {
  const { campaignId, operatingState, creativeSummary, hasCreativeBrief } = input

  if (!operatingState.truthFlags.hasStrategy) {
    return {
      titleEn: 'Start with a reviewed strategy',
      titleAr: 'ابدأ باستراتيجية قابلة للمراجعة',
      helperEn: 'The marketing workflow needs positioning, audience, offer, and platform direction before content or creative work.',
      helperAr: 'مسار التسويق يحتاج تموضعاً وجمهوراً وعرضاً واتجاهاً للمنصات قبل المحتوى أو الإبداع.',
      labelEn: 'Open strategy',
      labelAr: 'افتح الاستراتيجية',
      href: `/campaigns/${campaignId}?tab=strategy`,
    }
  }

  if (operatingState.stage === 'strategy_review_needed') {
    return {
      titleEn: 'Review strategy quality before production',
      titleAr: 'راجع جودة الاستراتيجية قبل الإنتاج',
      helperEn: 'Lock the message, audience, proof, and execution assumptions before turning the plan into content.',
      helperAr: 'ثبّت الرسالة والجمهور والإثباتات وافتراضات التنفيذ قبل تحويل الخطة إلى محتوى.',
      labelEn: 'Review strategy',
      labelAr: 'راجع الاستراتيجية',
      href: `/campaigns/${campaignId}?tab=strategy`,
    }
  }

  if (!operatingState.truthFlags.hasContentPlan) {
    return {
      titleEn: 'Turn the strategy into a Content Hub plan',
      titleAr: 'حوّل الاستراتيجية إلى خطة Content Hub',
      helperEn: 'Create post-level work before asking Creative to generate or compose media.',
      helperAr: 'أنشئ عملًا مرتبطًا بالمنشورات قبل طلب توليد أو تركيب الوسائط من الإبداع.',
      labelEn: 'Build content plan',
      labelAr: 'أنشئ خطة المحتوى',
      href: `/campaigns/${campaignId}/content-hub`,
    }
  }

  if (creativeSummary && (creativeSummary.mediaNeeded > 0 || creativeSummary.readinessPending > 0)) {
    return {
      titleEn: 'Resolve creative and media readiness',
      titleAr: 'حسم جاهزية الإبداع والوسائط',
      helperEn: 'Review post media requirements, image/background needs, and layer boundaries before approval or publishing.',
      helperAr: 'راجع متطلبات وسائط المنشورات واحتياجات الصور أو الخلفيات وحدود الطبقات قبل الاعتماد أو النشر.',
      labelEn: 'Open Creative',
      labelAr: 'افتح الإبداع',
      href: `/campaigns/${campaignId}?tab=creative`,
    }
  }

  if (!hasCreativeBrief && operatingState.truthFlags.hasContentPlan) {
    return {
      titleEn: 'Add a creative brief before serious production',
      titleAr: 'أضف موجزاً إبداعياً قبل الإنتاج الجاد',
      helperEn: 'A creative brief turns strategy and post copy into art direction, asset needs, and review criteria.',
      helperAr: 'الموجز الإبداعي يحوّل الاستراتيجية ونصوص المنشورات إلى اتجاه فني واحتياجات أصول ومعايير مراجعة.',
      labelEn: 'Open creative brief',
      labelAr: 'افتح الموجز الإبداعي',
      href: `/campaigns/${campaignId}/creative-brief`,
    }
  }

  if (operatingState.truthFlags.hasDraftContent) {
    return {
      titleEn: 'Review draft posts before scheduling',
      titleAr: 'راجع مسودات المنشورات قبل الجدولة',
      helperEn: 'Approve copy and media together in Content Hub before any scheduling or publishing decision.',
      helperAr: 'اعتمد النص والوسائط معاً في Content Hub قبل أي قرار جدولة أو نشر.',
      labelEn: 'Review Content Hub',
      labelAr: 'راجع Content Hub',
      href: `/campaigns/${campaignId}/content-hub`,
    }
  }

  if (operatingState.truthFlags.hasPublishedContent) {
    return {
      titleEn: 'Wait for real analytics before learning',
      titleAr: 'انتظر التحليلات الحقيقية قبل التعلم',
      helperEn: 'Manual records and approvals are workflow signals. Performance learning starts only after real analytics are available.',
      helperAr: 'السجلات اليدوية والموافقات إشارات تشغيلية. يبدأ التعلم من الأداء فقط بعد توفر تحليلات حقيقية.',
      labelEn: 'Open Performance',
      labelAr: 'افتح الأداء',
      href: `/campaigns/${campaignId}?tab=performance`,
    }
  }

  return {
    titleEn: 'Review publishing readiness',
    titleAr: 'راجع جاهزية النشر',
    helperEn: 'Publishing, manual records, API publishing, and paid launch remain separate explicit decisions.',
    helperAr: 'النشر والسجلات اليدوية والنشر عبر API وإطلاق الإعلانات تظل قرارات صريحة منفصلة.',
    labelEn: 'Open Publish',
    labelAr: 'افتح النشر',
    href: `/campaigns/${campaignId}?tab=publish`,
  }
}

export function deriveCampaignCommandFlow(input: DeriveCampaignCommandFlowInput): CampaignCommandFlow {
  const { operatingState, creativeSummary, publishSummary, brandScore } = input
  const brand = brandMetric(brandScore)
  const isPaidOnly = Boolean(input.isPaidOnlyStrategy)
  const includesPaid = Boolean(input.includesPaidPlanning)

  const scopeLabelEn = isPaidOnly
    ? 'Paid planning route'
    : includesPaid
      ? 'Full strategy route'
      : 'Organic route'
  const scopeLabelAr = isPaidOnly
    ? 'مسار التخطيط المدفوع'
    : includesPaid
      ? 'مسار استراتيجية شاملة'
      : 'مسار عضوي'

  return {
    scopeLabelEn,
    scopeLabelAr,
    headlineEn: 'Campaign operating flow',
    headlineAr: 'مسار تشغيل الحملة',
    helperEn: 'One journey from Brand Brain to strategy, content, creative, approval, publishing readiness, and analytics-backed learning.',
    helperAr: 'رحلة واحدة من Brand Brain إلى الاستراتيجية، المحتوى، الإبداع، الاعتماد، جاهزية النشر، ثم التعلم المدعوم بالتحليلات.',
    boundaryEn: 'Planning, creative review, publishing, paid launch, and learning stay separated until each explicit gate is satisfied.',
    boundaryAr: 'يبقى التخطيط، مراجعة الإبداع، النشر، إطلاق الإعلانات، والتعلم منفصلين حتى تتحقق بوابة كل خطوة صراحةً.',
    nextAction: deriveNextAction(input),
    steps: [
      {
        id: 'brand',
        status: statusForBrand(brandScore),
        titleEn: 'Brand Brain',
        titleAr: 'Brand Brain',
        helperEn: 'Positioning, audience, tone, proof, assets, and constraints.',
        helperAr: 'التموضع، الجمهور، النبرة، الإثباتات، الأصول، والقيود.',
        metricEn: brand.en,
        metricAr: brand.ar,
        href: '/brand',
      },
      {
        id: 'strategy',
        status: strategyStatus(operatingState),
        titleEn: 'Strategy',
        titleAr: 'الاستراتيجية',
        helperEn: 'The decision layer before production work.',
        helperAr: 'طبقة القرار قبل أي عمل إنتاجي.',
        metricEn: operatingState.truthFlags.hasStrategy ? 'Strategy exists' : 'Strategy needed',
        metricAr: operatingState.truthFlags.hasStrategy ? 'الاستراتيجية موجودة' : 'الاستراتيجية مطلوبة',
        href: `/campaigns/${input.campaignId}?tab=strategy`,
      },
      {
        id: 'content',
        status: contentStatus(operatingState),
        titleEn: 'Content Hub',
        titleAr: 'Content Hub',
        helperEn: 'Post-level copy and platform previews.',
        helperAr: 'نصوص المنشورات ومعاينات المنصات.',
        metricEn: operatingState.counts.totalPosts > 0
          ? `${operatingState.counts.totalPosts} post records`
          : 'No post plan yet',
        metricAr: operatingState.counts.totalPosts > 0
          ? `${operatingState.counts.totalPosts} سجل منشور`
          : 'لا توجد خطة منشورات بعد',
        href: `/campaigns/${input.campaignId}/content-hub`,
      },
      {
        id: 'creative',
        status: creativeStatus(operatingState, creativeSummary),
        titleEn: 'Creative',
        titleAr: 'الإبداع',
        helperEn: 'Media requirements, background ideas, and future editable layers.',
        helperAr: 'متطلبات الوسائط، أفكار الخلفيات، والطبقات القابلة للتعديل لاحقاً.',
        metricEn: creativeSummary && creativeSummary.total > 0
          ? `${creativeSummary.mediaNeeded} need media · ${creativeSummary.attachedToPost} attached`
          : 'Waiting for post context',
        metricAr: creativeSummary && creativeSummary.total > 0
          ? `${creativeSummary.mediaNeeded} تحتاج وسائط · ${creativeSummary.attachedToPost} مرتبطة`
          : 'ينتظر سياق المنشورات',
        href: `/campaigns/${input.campaignId}?tab=creative`,
      },
      {
        id: 'approval',
        status: approvalStatus(operatingState),
        titleEn: 'Approval',
        titleAr: 'الاعتماد',
        helperEn: 'Copy and media reviewed before schedule or publish decisions.',
        helperAr: 'مراجعة النص والوسائط قبل قرارات الجدولة أو النشر.',
        metricEn: `${operatingState.counts.draftPosts} draft · ${operatingState.counts.approvedPosts} approved`,
        metricAr: `${operatingState.counts.draftPosts} مسودة · ${operatingState.counts.approvedPosts} معتمدة`,
        href: `/campaigns/${input.campaignId}/content-hub`,
      },
      {
        id: 'publishing',
        status: publishingStatus(operatingState, publishSummary),
        titleEn: 'Publishing readiness',
        titleAr: 'جاهزية النشر',
        helperEn: 'Manual record, schedule, API publish, and paid launch remain explicit gates.',
        helperAr: 'السجل اليدوي، الجدولة، النشر عبر API، والإطلاق المدفوع بوابات صريحة منفصلة.',
        metricEn: `${operatingState.counts.scheduledPosts} scheduled · ${operatingState.counts.publishedPosts} published`,
        metricAr: `${operatingState.counts.scheduledPosts} مجدولة · ${operatingState.counts.publishedPosts} منشورة`,
        href: `/campaigns/${input.campaignId}?tab=publish`,
      },
      {
        id: 'performance',
        status: performanceStatus(operatingState),
        titleEn: 'Performance learning',
        titleAr: 'تعلم الأداء',
        helperEn: 'Only real analytics can update performance learning.',
        helperAr: 'التحليلات الحقيقية فقط يمكنها دعم تعلم الأداء.',
        metricEn: operatingState.counts.analyticsReadyPosts > 0
          ? `${operatingState.counts.analyticsReadyPosts} posts with analytics`
          : 'Analytics pending',
        metricAr: operatingState.counts.analyticsReadyPosts > 0
          ? `${operatingState.counts.analyticsReadyPosts} منشورات لديها تحليلات`
          : 'التحليلات قيد الانتظار',
        href: `/campaigns/${input.campaignId}?tab=performance`,
      },
    ],
  }
}
