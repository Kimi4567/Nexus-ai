import type { CampaignOperatingState } from './campaignOperatingState'
import type { CreativeRequirementsSummary } from './creativeRequirements'
import type { PublishTabReadinessSummary } from './publishReadiness'

export type CampaignCommandFlowStepStatus =
  | 'complete'
  | 'current'
  | 'review'
  | 'blocked'
  | 'pending'

export type CampaignCommandFlowStepId =
  | 'brand'
  | 'strategy'
  | 'content'
  | 'creative'
  | 'approval'
  | 'publishing'
  | 'performance'

export interface CampaignCommandFlowStep {
  id: CampaignCommandFlowStepId
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
  brandTruthBlocked?: boolean
  isPaidOnlyStrategy?: boolean
  includesPaidPlanning?: boolean
  hasCreativeBrief?: boolean
  currentStepId?: CampaignCommandFlowStepId
  operatingSnapshotsLoaded?: boolean
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
    en: `Core profile ${score}/100`,
    ar: `الملف الأساسي ${score}/100`,
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
  if (state.truthFlags.hasDraftContent || state.truthFlags.hasChannelScopeMismatch) return 'review'
  return 'complete'
}

function creativeStatus(
  state: CampaignOperatingState,
  creativeSummary?: CreativeRequirementsSummary | null,
): CampaignCommandFlowStepStatus {
  if (!state.truthFlags.hasContentPlan) return 'pending'
  if (!creativeSummary || creativeSummary.total === 0) return 'review'
  if (hasOutstandingMediaReview(creativeSummary)) return 'current'
  if (creativeSummary.attachedToPost > 0) return 'complete'
  return 'review'
}

function hasOutstandingMediaReview(
  creativeSummary?: CreativeRequirementsSummary | null,
): boolean {
  if (!creativeSummary || creativeSummary.total === 0) return false

  return creativeSummary.mediaNeeded > 0
    || creativeSummary.readinessPending > 0
    || creativeSummary.attachedToPost < creativeSummary.total
}

function approvalStatus(
  state: CampaignOperatingState,
  creativeSummary?: CreativeRequirementsSummary | null,
): CampaignCommandFlowStepStatus {
  if (!state.truthFlags.hasContentPlan) return 'pending'
  if (!creativeSummary || creativeSummary.total === 0) return 'review'
  if (hasOutstandingMediaReview(creativeSummary)) return 'review'
  if (state.truthFlags.hasDraftContent || state.truthFlags.hasApprovalEvidenceGap || state.truthFlags.hasChannelScopeMismatch) return 'current'
  if (state.truthFlags.hasReviewedContent) {
    return 'complete'
  }
  return 'review'
}

function approvalCopy(
  state: CampaignOperatingState,
  creativeSummary?: CreativeRequirementsSummary | null,
): Pick<CampaignCommandFlowStep, 'helperEn' | 'helperAr' | 'metricEn' | 'metricAr'> {
  const draftPosts = state.counts.draftPosts
  const reviewedPosts = state.counts.reviewedPosts
  const reviewGaps = state.counts.unreviewedProgressedPosts + state.counts.outOfScopePosts
  const reviewedMetricEn = `${reviewedPosts} reviewed revision${reviewedPosts === 1 ? '' : 's'}`
  const reviewedMetricAr = reviewedPosts === 1
    ? 'نسخة واحدة موثقة المراجعة'
    : `${reviewedPosts} نسخ موثقة المراجعة`

  if (!creativeSummary || creativeSummary.total === 0) {
    return {
      helperEn: 'Copy status is available, but media review state is not confirmed yet.',
      helperAr: 'حالة النص متاحة، لكن حالة مراجعة الوسائط لم تتأكد بعد.',
      metricEn: `${reviewedMetricEn} · ${reviewGaps} need review · media unconfirmed`,
      metricAr: `${reviewedMetricAr} · ${reviewGaps} تحتاج مراجعة · الوسائط غير مؤكدة`,
    }
  }

  if (hasOutstandingMediaReview(creativeSummary)) {
    const mediaPending = Math.max(
      creativeSummary.mediaNeeded,
      creativeSummary.readinessPending,
      creativeSummary.total - creativeSummary.attachedToPost,
    )
    const copyApproved = state.truthFlags.hasReviewedContent

    return {
      helperEn: copyApproved
        ? 'Copy approval is saved. Media still needs review before scheduling or publishing.'
        : 'Copy and media review are still open before scheduling or publishing.',
      helperAr: copyApproved
        ? 'تم حفظ اعتماد النص. ما زالت الوسائط تحتاج مراجعة قبل الجدولة أو النشر.'
        : 'ما زالت مراجعة النص والوسائط مفتوحة قبل الجدولة أو النشر.',
      metricEn: copyApproved
        ? `${reviewedMetricEn} · ${mediaPending} media pending`
        : `${draftPosts + reviewGaps} need review · ${reviewedMetricEn} · ${mediaPending} media pending`,
      metricAr: copyApproved
        ? `${reviewedMetricAr} · ${mediaPending} وسائط معلقة`
        : `${draftPosts + reviewGaps} تحتاج مراجعة · ${reviewedMetricAr} · ${mediaPending} وسائط معلقة`,
    }
  }

  return {
    helperEn: 'Copy and attached media have passed review before scheduling or publishing.',
    helperAr: 'اجتاز النص والوسائط المرتبطة المراجعة قبل الجدولة أو النشر.',
    metricEn: `${reviewedMetricEn} · ${creativeSummary.attachedToPost} media reviewed`,
    metricAr: `${reviewedMetricAr} · ${creativeSummary.attachedToPost} وسائط مُراجعة`,
  }
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

function currentStepAction(
  input: DeriveCampaignCommandFlowInput,
  stepId: CampaignCommandFlowStepId,
  action: CampaignCommandFlowAction,
  currentAction: CampaignCommandFlowAction,
): CampaignCommandFlowAction {
  return input.currentStepId === stepId ? currentAction : action
}

function deriveNextAction(input: DeriveCampaignCommandFlowInput): CampaignCommandFlowAction {
  const { campaignId, operatingState, creativeSummary, hasCreativeBrief } = input

  if (input.brandTruthBlocked) {
    return {
      titleEn: 'Fix Brand Brain before continuing the campaign',
      titleAr: 'صحّح Brand Brain قبل متابعة الحملة',
      helperEn: 'The source of truth conflicts. Strategy execution, content, creative, publishing, and spend stay blocked until it is corrected.',
      helperAr: 'مصدر الحقيقة متناقض. يظل تنفيذ الاستراتيجية والمحتوى والإبداع والنشر والصرف مقفلاً حتى التصحيح.',
      labelEn: 'Fix Brand Brain',
      labelAr: 'تصحيح Brand Brain',
      href: '/brand',
    }
  }

  if (!operatingState.truthFlags.hasStrategy) {
    return currentStepAction(input, 'strategy', {
      titleEn: 'Start with a reviewed strategy',
      titleAr: 'ابدأ باستراتيجية قابلة للمراجعة',
      helperEn: 'The marketing workflow needs positioning, audience, offer, and platform direction before content or creative work.',
      helperAr: 'مسار التسويق يحتاج تموضعاً وجمهوراً وعرضاً واتجاهاً للمنصات قبل المحتوى أو الإبداع.',
      labelEn: 'Open strategy',
      labelAr: 'افتح الاستراتيجية',
      href: `/campaigns/${campaignId}?tab=strategy`,
    }, {
      titleEn: 'Continue here: complete the strategy foundation',
      titleAr: 'تابع هنا: أكمل أساس الاستراتيجية',
      helperEn: 'You are already in Strategy. Review positioning, audience, offer, and platform direction before production work.',
      helperAr: 'أنت بالفعل داخل الاستراتيجية. راجع التموضع والجمهور والعرض واتجاه المنصات قبل الإنتاج.',
      labelEn: 'Review strategy below',
      labelAr: 'راجع الاستراتيجية بالأسفل',
      href: '#strategy-summary',
    })
  }

  if (operatingState.stage === 'strategy_review_needed') {
    return currentStepAction(input, 'strategy', {
      titleEn: 'Review strategy quality before production',
      titleAr: 'راجع جودة الاستراتيجية قبل الإنتاج',
      helperEn: 'Lock the message, audience, proof, and execution assumptions before turning the plan into content.',
      helperAr: 'ثبّت الرسالة والجمهور والإثباتات وافتراضات التنفيذ قبل تحويل الخطة إلى محتوى.',
      labelEn: 'Review strategy',
      labelAr: 'راجع الاستراتيجية',
      href: `/campaigns/${campaignId}?tab=strategy`,
    }, {
      titleEn: 'Continue here: review strategy quality',
      titleAr: 'تابع هنا: راجع جودة الاستراتيجية',
      helperEn: 'You are already in Strategy. Use the sections below to review the message, audience, proof, and execution assumptions.',
      helperAr: 'أنت بالفعل داخل الاستراتيجية. استخدم الأقسام بالأسفل لمراجعة الرسالة والجمهور والإثباتات وافتراضات التنفيذ.',
      labelEn: 'Review strategy below',
      labelAr: 'راجع الاستراتيجية بالأسفل',
      href: '#strategy-summary',
    })
  }

  if (input.isPaidOnlyStrategy) {
    return {
      titleEn: 'Review the paid package and launch gates',
      titleAr: 'راجع حزمة Paid وبوابات الإطلاق',
      helperEn: 'Paid-only orders bypass Content Hub. Review audience, copy, creative, tracking, budget, and the separate launch approval before any spend.',
      helperAr: 'أوامر Paid فقط لا تمر عبر Content Hub. راجع الجمهور والنسخ والإبداع والتتبع والميزانية وموافقة الإطلاق المنفصلة قبل أي صرف.',
      labelEn: 'Open paid execution review',
      labelAr: 'افتح مراجعة التنفيذ المدفوع',
      href: `/campaigns/${campaignId}/execution`,
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

  if (operatingState.truthFlags.hasPublishedContent && !operatingState.truthFlags.hasDraftContent) {
    return currentStepAction(input, 'performance', {
      titleEn: 'Wait for real analytics before learning',
      titleAr: 'انتظر التحليلات الحقيقية قبل التعلم',
      helperEn: 'Manual records and approvals are workflow signals. Performance learning starts only after real analytics are available.',
      helperAr: 'السجلات اليدوية والموافقات إشارات تشغيلية. يبدأ التعلم من الأداء فقط بعد توفر تحليلات حقيقية.',
      labelEn: 'Open Performance',
      labelAr: 'افتح الأداء',
      href: `/campaigns/${campaignId}?tab=performance`,
    }, {
      titleEn: 'Continue here: wait for real analytics',
      titleAr: 'تابع هنا: انتظر التحليلات الحقيقية',
      helperEn: 'You are already in Performance. Treat manual records as workflow signals until real analytics arrive.',
      helperAr: 'أنت بالفعل داخل الأداء. اعتبر السجلات اليدوية إشارات تشغيلية فقط حتى تصل تحليلات حقيقية.',
      labelEn: 'Review performance below',
      labelAr: 'راجع الأداء بالأسفل',
      href: '#campaign-performance-work',
    })
  }

  if (hasOutstandingMediaReview(creativeSummary)) {
    return currentStepAction(input, 'creative', {
      titleEn: 'Resolve creative and media readiness',
      titleAr: 'حسم جاهزية الإبداع والوسائط',
      helperEn: 'Review post media requirements, image/background needs, and layer boundaries before approval or publishing.',
      helperAr: 'راجع متطلبات وسائط المنشورات واحتياجات الصور أو الخلفيات وحدود الطبقات قبل الاعتماد أو النشر.',
      labelEn: 'Open Creative',
      labelAr: 'افتح الإبداع',
      href: `/campaigns/${campaignId}?tab=creative`,
    }, {
      titleEn: 'Continue here: resolve creative readiness',
      titleAr: 'تابع هنا: احسم جاهزية الإبداع',
      helperEn: 'You are already in Creative. Use the brief, post media readiness, and concept boundaries below before approval or publishing.',
      helperAr: 'أنت بالفعل داخل الإبداع. استخدم الموجز وجاهزية وسائط المنشورات وحدود المفاهيم بالأسفل قبل الاعتماد أو النشر.',
      labelEn: 'Review creative actions below',
      labelAr: 'راجع إجراءات الإبداع بالأسفل',
      href: '#campaign-creative-work',
    })
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

  return currentStepAction(input, 'publishing', {
    titleEn: 'Review publishing readiness',
    titleAr: 'راجع جاهزية النشر',
    helperEn: 'Publishing, manual records, API publishing, and paid launch remain separate explicit decisions.',
    helperAr: 'النشر والسجلات اليدوية والنشر عبر API وإطلاق الإعلانات تظل قرارات صريحة منفصلة.',
    labelEn: 'Open Publish',
    labelAr: 'افتح النشر',
    href: `/campaigns/${campaignId}?tab=publish`,
  }, {
    titleEn: 'Continue here: review publishing readiness',
    titleAr: 'تابع هنا: راجع جاهزية النشر',
    helperEn: 'You are already in Publish. Review locks, account state, manual records, and explicit API publishing boundaries below.',
    helperAr: 'أنت بالفعل داخل النشر. راجع أسباب القفل وحالة الحساب والسجلات اليدوية وحدود النشر عبر API بالأسفل.',
    labelEn: 'Review publish readiness below',
    labelAr: 'راجع جاهزية النشر بالأسفل',
    href: '#campaign-publish-work',
  })
}

function deriveLoadingContentStateFlow(
  input: DeriveCampaignCommandFlowInput,
  scopeLabelEn: string,
  scopeLabelAr: string,
  brand: { en: string; ar: string },
): CampaignCommandFlow {
  return {
    scopeLabelEn,
    scopeLabelAr,
    headlineEn: 'Campaign operating flow',
    headlineAr: 'مسار تشغيل الحملة',
    helperEn: 'One journey from Brand Brain to strategy, content, creative, approval, publishing readiness, and analytics-backed learning.',
    helperAr: 'رحلة واحدة من Brand Brain إلى الاستراتيجية، المحتوى، الإبداع، الاعتماد، جاهزية النشر، ثم التعلم المدعوم بالتحليلات.',
    boundaryEn: 'NEXUS is checking Content Hub records before deciding the next execution step. No generation, approval, scheduling, publishing, or learning action is implied.',
    boundaryAr: 'يفحص NEXUS سجلات Content Hub قبل تحديد خطوة التنفيذ التالية. لا يعني ذلك توليداً أو اعتماداً أو جدولة أو نشراً أو تعلماً.',
    nextAction: {
      titleEn: 'Checking Content Hub state',
      titleAr: 'جاري فحص حالة Content Hub',
      helperEn: 'Post records are still loading, so NEXUS will not claim a content plan is missing or ready yet.',
      helperAr: 'ما زالت سجلات المنشورات قيد التحميل، لذلك لن يعتبر NEXUS أن خطة المحتوى مفقودة أو جاهزة بعد.',
      labelEn: 'Stay on this flow',
      labelAr: 'ابقَ على هذا المسار',
      href: '#campaign-operating-flow',
    },
    steps: [
      {
        id: 'brand',
        status: input.brandTruthBlocked ? 'blocked' : statusForBrand(input.brandScore),
        titleEn: 'Brand Brain',
        titleAr: 'Brand Brain',
        helperEn: 'Core setup coverage only. Proof, assets, channel connections, and paid readiness have separate gates.',
        helperAr: 'هذه نسبة تغطية الإعداد الأساسي فقط. الإثباتات والأصول وربط القنوات والجاهزية المدفوعة لها بوابات مستقلة.',
        metricEn: brand.en,
        metricAr: brand.ar,
        href: '/brand',
      },
      {
        id: 'strategy',
        status: strategyStatus(input.operatingState),
        titleEn: 'Strategy',
        titleAr: 'الاستراتيجية',
        helperEn: 'The decision layer before production work.',
        helperAr: 'طبقة القرار قبل أي عمل إنتاجي.',
        metricEn: 'Strategy exists',
        metricAr: 'الاستراتيجية موجودة',
        href: `/campaigns/${input.campaignId}?tab=strategy`,
      },
      {
        id: 'content',
        status: 'pending',
        titleEn: 'Content Hub',
        titleAr: 'Content Hub',
        helperEn: 'Post-level records are being checked before NEXUS shows the next step.',
        helperAr: 'يتم فحص سجلات المنشورات قبل أن يعرض NEXUS الخطوة التالية.',
        metricEn: 'Checking post records',
        metricAr: 'جاري فحص سجلات المنشورات',
        href: `/campaigns/${input.campaignId}/content-hub`,
      },
      {
        id: 'creative',
        status: 'pending',
        titleEn: 'Creative',
        titleAr: 'الإبداع',
        helperEn: 'Creative readiness depends on real Content Hub post records.',
        helperAr: 'جاهزية الإبداع تعتمد على سجلات منشورات حقيقية في Content Hub.',
        metricEn: 'Waiting for post state',
        metricAr: 'ينتظر حالة المنشورات',
        href: `/campaigns/${input.campaignId}?tab=creative`,
      },
      {
        id: 'approval',
        status: 'pending',
        titleEn: 'Approval',
        titleAr: 'الاعتماد',
        helperEn: 'Copy and media review starts after post records are known.',
        helperAr: 'تبدأ مراجعة النص والوسائط بعد معرفة سجلات المنشورات.',
        metricEn: 'Waiting for post state',
        metricAr: 'ينتظر حالة المنشورات',
        href: `/campaigns/${input.campaignId}/content-hub`,
      },
      {
        id: 'publishing',
        status: 'pending',
        titleEn: 'Publishing readiness',
        titleAr: 'جاهزية النشر',
        helperEn: 'Publishing gates stay locked until post records and account state are known.',
        helperAr: 'تبقى بوابات النشر مقفلة حتى تُعرف سجلات المنشورات وحالة الحسابات.',
        metricEn: 'Checking readiness',
        metricAr: 'جاري فحص الجاهزية',
        href: `/campaigns/${input.campaignId}?tab=publish`,
      },
      {
        id: 'performance',
        status: 'pending',
        titleEn: 'Performance learning',
        titleAr: 'تعلم الأداء',
        helperEn: 'Only real analytics can update performance learning.',
        helperAr: 'التحليلات الحقيقية فقط يمكنها دعم تعلم الأداء.',
        metricEn: 'Analytics pending',
        metricAr: 'التحليلات قيد الانتظار',
        href: `/campaigns/${input.campaignId}?tab=performance`,
      },
    ],
  }

}

export function deriveCampaignCommandFlow(input: DeriveCampaignCommandFlowInput): CampaignCommandFlow {
  const { operatingState, creativeSummary, publishSummary, brandScore } = input
  const brand = input.brandTruthBlocked
    ? { en: 'Source truth conflict', ar: 'تعارض في مصدر الحقيقة' }
    : brandMetric(brandScore)
  const approval = approvalCopy(operatingState, creativeSummary)
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

  if (input.operatingSnapshotsLoaded === false && operatingState.truthFlags.hasStrategy && !input.brandTruthBlocked) {
    return deriveLoadingContentStateFlow(input, scopeLabelEn, scopeLabelAr, brand)
  }

  const flow: CampaignCommandFlow = {
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
        status: input.brandTruthBlocked ? 'blocked' : statusForBrand(brandScore),
        titleEn: 'Brand Brain',
        titleAr: 'Brand Brain',
        helperEn: 'Core setup coverage only. Proof, assets, channel connections, and paid readiness have separate gates.',
        helperAr: 'هذه نسبة تغطية الإعداد الأساسي فقط. الإثباتات والأصول وربط القنوات والجاهزية المدفوعة لها بوابات مستقلة.',
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
        status: isPaidOnly ? strategyStatus(operatingState) : contentStatus(operatingState),
        titleEn: isPaidOnly ? 'Paid planning package' : 'Content Hub',
        titleAr: isPaidOnly ? 'حزمة التخطيط المدفوع' : 'Content Hub',
        helperEn: isPaidOnly ? 'Audience, angles, copy, and briefs for review—no organic posts.' : 'Post-level copy and platform previews.',
        helperAr: isPaidOnly ? 'الجمهور والزوايا والنسخ والبريفات للمراجعة، دون منشورات عضوية.' : 'نصوص المنشورات ومعاينات المنصات.',
        metricEn: isPaidOnly
          ? 'Paid scope only'
          : operatingState.counts.totalPosts > 0
            ? `${operatingState.counts.totalPosts} post records`
            : 'No post plan yet',
        metricAr: isPaidOnly
          ? 'نطاق مدفوع فقط'
          : operatingState.counts.totalPosts > 0
            ? `${operatingState.counts.totalPosts} سجل منشور`
            : 'لا توجد خطة منشورات بعد',
        href: isPaidOnly ? `/campaigns/${input.campaignId}/execution` : `/campaigns/${input.campaignId}/content-hub`,
      },
      {
        id: 'creative',
        status: isPaidOnly ? 'review' : creativeStatus(operatingState, creativeSummary),
        titleEn: isPaidOnly ? 'Paid creative review' : 'Creative',
        titleAr: isPaidOnly ? 'مراجعة الإبداع المدفوع' : 'الإبداع',
        helperEn: isPaidOnly ? 'Review creative briefs and required assets before production.' : 'Media requirements, background ideas, and future editable layers.',
        helperAr: isPaidOnly ? 'راجع البريفات الإبداعية والأصول المطلوبة قبل الإنتاج.' : 'متطلبات الوسائط، أفكار الخلفيات، والطبقات القابلة للتعديل لاحقاً.',
        metricEn: isPaidOnly
          ? 'Briefs are not launch-ready assets'
          : creativeSummary && creativeSummary.total > 0
            ? `${creativeSummary.mediaNeeded} need media · ${creativeSummary.attachedToPost} attached`
            : 'Waiting for post context',
        metricAr: isPaidOnly
          ? 'البريفات ليست أصول إطلاق نهائية'
          : creativeSummary && creativeSummary.total > 0
            ? `${creativeSummary.mediaNeeded} تحتاج وسائط · ${creativeSummary.attachedToPost} مرتبطة`
            : 'ينتظر سياق المنشورات',
        href: isPaidOnly ? `/campaigns/${input.campaignId}/execution` : `/campaigns/${input.campaignId}?tab=creative`,
      },
      {
        id: 'approval',
        status: isPaidOnly ? 'review' : approvalStatus(operatingState, creativeSummary),
        titleEn: isPaidOnly ? 'Budget & launch approval' : 'Approval',
        titleAr: isPaidOnly ? 'اعتماد الميزانية والإطلاق' : 'الاعتماد',
        ...approval,
        ...(isPaidOnly ? {
          helperEn: 'Budget, tracking, creative, and launch require an explicit final approval.',
          helperAr: 'تحتاج الميزانية والتتبع والإبداع والإطلاق إلى موافقة نهائية صريحة.',
          metricEn: 'No spend before approval',
          metricAr: 'لا صرف قبل الموافقة',
        } : {}),
        href: isPaidOnly ? `/campaigns/${input.campaignId}/execution` : `/campaigns/${input.campaignId}/content-hub`,
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

  if (!input.brandTruthBlocked) return flow

  return {
    ...flow,
    boundaryEn: 'Brand Brain is the first gate. Existing downstream records are reference-only; generation, approval, scheduling, publishing, spend, and learning updates remain blocked until the conflict is fixed.',
    boundaryAr: 'Brand Brain هو البوابة الأولى. السجلات اللاحقة للمرجع فقط؛ ويظل التوليد والاعتماد والجدولة والنشر والصرف وتحديث التعلّم محجوباً حتى حسم التعارض.',
    steps: flow.steps.map((step) => {
      if (step.id === 'brand') {
        return {
          ...step,
          status: 'blocked',
          helperEn: 'The saved industry conflicts with the business description. Fix this source before using any derived work.',
          helperAr: 'المجال المحفوظ يتعارض مع وصف النشاط. صحّح هذا المصدر قبل استخدام أي عمل مشتق.',
        }
      }

      if (step.id === 'performance') {
        return operatingState.truthFlags.hasAnalyticsData
          ? {
              ...step,
              status: 'complete',
              helperEn: 'Verified historical analytics remain viewable, but they cannot update learning until Brand Brain is corrected.',
              helperAr: 'تظل التحليلات التاريخية الموثقة قابلة للعرض، لكنها لا تحدّث التعلّم حتى تصحيح Brand Brain.',
            }
          : {
              ...step,
              status: 'pending',
              helperEn: 'No verified analytics exist. Performance learning stays inactive while the source of truth is blocked.',
              helperAr: 'لا توجد تحليلات موثقة. يظل تعلّم الأداء غير نشط بينما مصدر الحقيقة محجوب.',
              metricEn: 'No verified analytics',
              metricAr: 'لا توجد تحليلات موثقة',
            }
      }

      const recordCount = operatingState.counts.totalPosts
      return {
        ...step,
        status: 'blocked',
        helperEn: 'Existing output is retained for historical reference only. It cannot advance or trigger credit spend.',
        helperAr: 'المخرجات الحالية محفوظة للرجوع التاريخي فقط. لا يمكنها التقدم أو تشغيل خصم كريديت.',
        metricEn: step.id === 'content' && recordCount > 0
          ? `${recordCount} blocked reference records`
          : 'Blocked by Brand Brain',
        metricAr: step.id === 'content' && recordCount > 0
          ? `${recordCount} سجلات مرجعية محجوبة`
          : 'محجوب بواسطة Brand Brain',
      }
    }),
  }
}
