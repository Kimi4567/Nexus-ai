export type StrategyRoomLocale = 'en' | 'ar'

export interface StrategyRoomStateCopyInput {
  locale: StrategyRoomLocale
  isPaidOnlyStrategy: boolean
  hasContentPlan: boolean
  operatingSnapshotsLoaded: boolean
}

export interface StrategyRoomStateCopy {
  guidance: {
    hint: string
    brief: string
  }
  checklist: {
    title: string
    helper: string
  }
  nextDecision: string
  organicPlanValue: string
  contentPlanStatusValue: string
  contentPlanTone: 'positive' | 'muted'
  contentHubCta: string
  contentHooks: {
    title: string
    helper: string
    cta: string
  }
}

export function deriveStrategyRoomStateCopy(input: StrategyRoomStateCopyInput): StrategyRoomStateCopy {
  const { locale, isPaidOnlyStrategy, hasContentPlan, operatingSnapshotsLoaded } = input
  const isArabic = locale === 'ar'

  if (isPaidOnlyStrategy) {
    return {
      guidance: {
        hint: isArabic
          ? '📌 هذا بريف تخطيط مدفوع فقط. لا توجد خطة Content Hub من هذا التوليد.'
          : '📌 This is a paid planning brief only. No Content Hub plan was created by this run.',
        brief: isArabic
          ? 'راجع فرضيات الجمهور والزوايا والقيود قبل أي قرار إطلاق. التنفيذ والصرف والنشر يتطلبون جاهزية وموافقة صريحة منفصلة.'
          : 'Review audience hypotheses, paid angles, and limits before any launch decision. Execution, spend, and publishing require separate readiness and explicit approval.',
      },
      checklist: {
        title: isArabic ? 'قائمة مراجعة التخطيط المدفوع' : 'Paid planning review checklist',
        helper: isArabic
          ? 'استخدمها لمراجعة حدود التخطيط المدفوع قبل أي قرار إطلاق أو صرف. هذه اللوحة لا تولّد ولا تعتمد ولا تنشر ولا تطلق إعلانات ولا تحدّث Brand Brain.'
          : 'Use this to review paid planning boundaries before any launch or spend decision. This panel does not generate, approve, publish, launch ads, or update Brand Brain.',
      },
      nextDecision: isArabic
        ? 'راجع بريف التخطيط المدفوع وأكمل التتبع والحسابات قبل أي إطلاق.'
        : 'Review the paid planning brief and complete tracking/accounts before any launch.',
      organicPlanValue: isArabic ? 'غير مشمولة في هذا التوليد' : 'Not included in this run',
      contentPlanStatusValue: isArabic ? 'غير منشأة في تشغيل Paid فقط' : 'Not created in a Paid-only run',
      contentPlanTone: 'muted',
      contentHubCta: isArabic ? 'راجع بريف التخطيط المدفوع' : 'Review paid planning brief',
      contentHooks: {
        title: isArabic ? 'هذا بريف تخطيط مدفوع وليس خطة منشورات عضوية' : 'This is a paid planning brief, not an organic post plan',
        helper: isArabic
          ? 'راجع الزوايا المدفوعة والقيود كمواد تخطيط. Content Hub لا يحتوي خطة منشورات عضوية من هذا التشغيل.'
          : 'Review paid angles and constraints as planning material. Content Hub does not contain an organic post plan from this run.',
        cta: isArabic ? 'راجع بريف التخطيط المدفوع' : 'Review paid planning brief',
      },
    }
  }

  if (!operatingSnapshotsLoaded) {
    return {
      guidance: {
        hint: isArabic
          ? '🔎 يتحقق NEXUS من حالة Content Hub قبل عرض خطوة التنفيذ التالية.'
          : '🔎 NEXUS is checking Content Hub state before showing the next execution step.',
        brief: isArabic
          ? 'هذه هي الاستراتيجية الغنية الحالية للحملة كمادة مرجعية. يتحقق NEXUS الآن مما إذا كانت منشورات Content Hub موجودة قبل عرض خطوة التنفيذ التالية.'
          : 'This is the current rich strategy output for the campaign as reference material. NEXUS is checking whether Content Hub post records already exist before showing the next execution step.',
      },
      checklist: {
        title: isArabic ? 'جارٍ التحقق من حالة Content Hub' : 'Checking Content Hub state',
        helper: isArabic
          ? 'يتحقق NEXUS مما إذا كانت منشورات Content Hub موجودة قبل عرض قائمة المراجعة المناسبة. هذه اللوحة لا تولّد ولا تعتمد ولا تجدول ولا تنشر ولا تحدّث Brand Brain.'
          : 'NEXUS is checking whether Content Hub posts already exist before showing the right review checklist. This panel does not generate, approve, schedule, publish, or update Brand Brain.',
      },
      nextDecision: isArabic
        ? 'انتظر اكتمال التحقق من Content Hub قبل اتخاذ خطوة التنفيذ التالية.'
        : 'Wait for Content Hub state to finish loading before choosing the next execution step.',
      organicPlanValue: isArabic ? 'جارٍ التحقق من Content Hub' : 'Checking Content Hub state',
      contentPlanStatusValue: isArabic ? 'جارٍ التحقق من Content Hub' : 'Checking Content Hub state',
      contentPlanTone: 'muted',
      contentHubCta: isArabic ? 'افتح Content Hub' : 'Open Content Hub',
      contentHooks: {
        title: isArabic ? 'جارٍ التحقق من حالة Content Hub' : 'Checking Content Hub state',
        helper: isArabic
          ? 'يتحقق NEXUS مما إذا كانت معاينات المنشورات النهائية موجودة قبل وصف هذه المواد كمسار تخطيط أو كمرجع للتنفيذ.'
          : 'NEXUS is checking whether final post previews already exist before describing these notes as planning inputs or execution reference material.',
        cta: isArabic ? 'افتح Content Hub' : 'Open Content Hub',
      },
    }
  }

  if (hasContentPlan) {
    return {
      guidance: {
        hint: isArabic
          ? '📌 الاستراتيجية أصبحت مادة مرجعية. حالة التنفيذ الحالية موجودة في Content Hub.'
          : '📌 Strategy is reference material. Content Hub shows the current execution state.',
        brief: isArabic
          ? 'هذه هي الاستراتيجية الغنية الحالية للحملة كمادة مرجعية. راجع الاتجاه والافتراضات والقيود، لكن حالة المنشورات والتنفيذ الحالية موجودة في Content Hub.'
          : 'This is the current rich strategy output for the campaign as reference material. Review the direction, assumptions, and limits, but use Content Hub for the current post and execution state.',
      },
      checklist: {
        title: isArabic ? 'قائمة مراجعة الاستراتيجية' : 'Strategy review checklist',
        helper: isArabic
          ? 'استخدمها لمراجعة القرار والتشخيص قبل تعديل أو اعتماد المحتوى الموجود في Content Hub. هذه اللوحة لا تولّد ولا تعتمد ولا تجدول ولا تنشر ولا تحدّث Brand Brain.'
          : 'Use this to review the decision and diagnosis before editing or approving the content already in Content Hub. This panel does not generate, approve, schedule, publish, or update Brand Brain.',
      },
      nextDecision: isArabic ? 'راجع التنفيذ الحالي في Content Hub.' : 'Review current execution in Content Hub.',
      organicPlanValue: isArabic ? 'متاحة للمراجعة في Content Hub' : 'Available for review in Content Hub',
      contentPlanStatusValue: isArabic ? 'موجودة في Content Hub' : 'Exists in Content Hub',
      contentPlanTone: 'positive',
      contentHubCta: isArabic ? 'راجع التنفيذ في Content Hub' : 'Review execution in Content Hub',
      contentHooks: {
        title: isArabic
          ? 'Content Hub هو المسار النهائي لمعاينة المنشورات'
          : 'Content Hub is the final post preview path',
        helper: isArabic
          ? 'راجع النسخ، جاهزية الوسائط، حالة دورة الحياة، وحالة النشر اليدوي في Content Hub. ملاحظات الحملة المحفوظة هنا للمراجعة فقط.'
          : 'Review copy, media readiness, lifecycle state, and manual publish status in Content Hub. Saved campaign notes here are review material only.',
        cta: isArabic ? 'راجع معاينات المنشورات النهائية' : 'Review final post previews',
      },
    }
  }

  return {
    guidance: {
      hint: isArabic
        ? '🔍 راجع جودة الاستراتيجية قبل إنشاء أول خطة محتوى.'
        : '🔍 Review strategy quality before building the first content plan.',
      brief: isArabic
        ? 'هذه هي الاستراتيجية الغنية الحالية للحملة. راجع الاتجاه والافتراضات والقيود قبل إنشاء أول خطة محتوى.'
        : 'This is the current rich strategy output for the campaign. Review the direction, assumptions, and limits before building the first content plan.',
    },
    checklist: {
      title: isArabic ? 'قائمة ما قبل Content Hub' : 'Before Content Hub checklist',
      helper: isArabic
        ? 'استخدمها كفحص قرار قبل تحضير أول خطة محتوى. هذه اللوحة لا تولّد ولا تعتمد ولا تجدول ولا تنشر ولا تحدّث Brand Brain.'
        : 'Use this as the go/no-go check before preparing the first content plan. This panel does not generate, approve, schedule, publish, or update Brand Brain.',
    },
    nextDecision: isArabic
      ? 'راجع جودة الاستراتيجية قبل بناء أول خطة محتوى.'
      : 'Review strategy quality before building the first content plan.',
    organicPlanValue: isArabic ? 'جاهزة لبناء خطة محتوى بعد المراجعة' : 'Ready to build a content plan after review',
    contentPlanStatusValue: isArabic ? 'حضّرها بعد مراجعة الاستراتيجية' : 'Prepare it after strategy review',
    contentPlanTone: 'muted',
    contentHubCta: isArabic ? 'افتح Content Hub لتحضير خطة المحتوى' : 'Open Content Hub to prepare content plan',
    contentHooks: {
      title: isArabic
        ? 'هذه مدخلات تخطيط وليست خطة منشورات نهائية'
        : 'These are planning inputs, not final post drafts',
      helper: isArabic
        ? 'الهوكس والزوايا هنا مواد استراتيجية تساعد على بناء أول خطة محتوى. لا توجد معاينات منشورات نهائية حتى يتم تحضير Content Hub.'
        : 'Hooks and angles here are strategy material for building the first content plan. Final post previews do not exist until Content Hub is prepared.',
      cta: isArabic ? 'افتح Content Hub لتحضير خطة المحتوى' : 'Open Content Hub to prepare content plan',
    },
  }
}
