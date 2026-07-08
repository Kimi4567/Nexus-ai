import type { StrategyFulfillmentSummary, StrategyFulfillmentTone } from './strategyFulfillment'

export interface ContentHubFirstScreenTruthCard {
  label: string
  value: string
  helper: string
  tone: StrategyFulfillmentTone
}

interface ContentHubFirstScreenTruthInput {
  locale?: string
  fulfillmentSummary: StrategyFulfillmentSummary
  totalPosts: number
  draftCount: number
  approvedCount: number
  scheduledCount: number
  publishedCount: number
  manuallyPublishedCount: number
  totalImagePosts: number
  readyMediaCount: number
  ambiguousPreviewCount: number
  videoPostCount: number
  hasOrderMismatch: boolean
}

function text(ar: boolean, arText: string, enText: string): string {
  return ar ? arText : enText
}

function englishPlural(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

function postStateCard(input: ContentHubFirstScreenTruthInput, ar: boolean): ContentHubFirstScreenTruthCard {
  const total = input.totalPosts

  if (total === 0) {
    return {
      label: text(ar, 'حالة المنشورات', 'Post state'),
      value: text(ar, 'لا توجد مسودات في Content Hub بعد', 'No Content Hub drafts yet'),
      helper: text(
        ar,
        'الاستراتيجية لا تحفظ منشورات نهائية تلقائياً؛ أنشئ مسودات محتوى عندما تكون مستعداً للمراجعة.',
        'The strategy does not automatically save final posts; create draft content when you are ready to review.',
      ),
      tone: 'warning',
    }
  }

  if (input.draftCount > 0) {
    return {
      label: text(ar, 'حالة المنشورات', 'Post state'),
      value: text(
        ar,
        `${input.draftCount} مسودات منشورات للمراجعة`,
        `${englishPlural(input.draftCount, 'draft post')} to review`,
      ),
      helper: text(
        ar,
        'هذه مسودات مراجعة داخل NEXUS. الاعتماد والجدولة والنشر قرارات منفصلة.',
        'These are review drafts inside NEXUS. Approval, scheduling, and publishing are separate decisions.',
      ),
      tone: 'warning',
    }
  }

  if (input.approvedCount > 0) {
    return {
      label: text(ar, 'حالة المنشورات', 'Post state'),
      value: text(
        ar,
        `${input.approvedCount} منشورات معتمدة بانتظار الجدولة`,
        `${englishPlural(input.approvedCount, 'approved post')} awaiting scheduling`,
      ),
      helper: text(
        ar,
        'الاعتماد لا يعني أن المنشورات مجدولة أو منشورة.',
        'Approval does not mean posts are scheduled or published.',
      ),
      tone: 'positive',
    }
  }

  if (input.manuallyPublishedCount > 0 && input.scheduledCount > 0) {
    return {
      label: text(ar, 'حالة المنشورات', 'Post state'),
      value: text(
        ar,
        `${input.manuallyPublishedCount} منشور مؤكد يدوياً · ${input.scheduledCount} مجدولة غير منشورة`,
        `${englishPlural(input.manuallyPublishedCount, 'manually published post')} · ${englishPlural(input.scheduledCount, 'scheduled post')} not published`,
      ),
      helper: text(
        ar,
        'النشر اليدوي سجل مستخدم فقط؛ المنشورات المجدولة محفوظة داخل NEXUS ولم تُنشر عبر منصة.',
        'Manual publish is a user record only; scheduled posts are saved in NEXUS and have not been platform-published.',
      ),
      tone: 'positive',
    }
  }

  if (input.scheduledCount > 0) {
    return {
      label: text(ar, 'حالة المنشورات', 'Post state'),
      value: text(
        ar,
        `${input.scheduledCount} منشورات مجدولة — غير منشورة`,
        `${englishPlural(input.scheduledCount, 'scheduled post')} — not published`,
      ),
      helper: text(
        ar,
        'الجدولة داخل NEXUS ليست نشرًا. النشر يحتاج جاهزية منصة وتأكيداً صريحاً.',
        'Scheduling inside NEXUS is not publishing. Publishing requires platform readiness and explicit confirmation.',
      ),
      tone: 'positive',
    }
  }

  if (input.publishedCount > 0) {
    return {
      label: text(ar, 'حالة المنشورات', 'Post state'),
      value: text(
        ar,
        `${input.publishedCount} منشورات منشورة أو مؤكدة`,
        `${englishPlural(input.publishedCount, 'published or confirmed post')}`,
      ),
      helper: text(
        ar,
        'التعلّم من الأداء يبدأ فقط بعد توفر تحليلات حقيقية.',
        'Performance learning starts only after real analytics are available.',
      ),
      tone: 'positive',
    }
  }

  return {
    label: text(ar, 'حالة المنشورات', 'Post state'),
    value: text(ar, `${total} منشورات محفوظة`, `${englishPlural(total, 'saved post')}`),
    helper: text(ar, 'راجع حالة كل منشور قبل أي خطوة تنفيذية.', 'Review each post state before any execution step.'),
    tone: 'muted',
  }
}

function mediaStateCard(input: ContentHubFirstScreenTruthInput, ar: boolean): ContentHubFirstScreenTruthCard {
  if (input.totalImagePosts === 0) {
    return {
      label: text(ar, 'جاهزية الوسائط', 'Media readiness'),
      value: text(ar, 'لا توجد خانات صور مطلوبة', 'No image slots required'),
      helper: input.videoPostCount > 0
        ? text(ar, `${input.videoPostCount} خانات فيديو تبقى للتخطيط فقط.`, `${englishPlural(input.videoPostCount, 'video slot')} remain planning-only.`)
        : text(ar, 'لا توجد وسائط منشورات مطلوبة لهذه الحالة.', 'No post media is required for this state.'),
      tone: 'muted',
    }
  }

  const pending = Math.max(0, input.totalImagePosts - input.readyMediaCount)
  return {
    label: text(ar, 'جاهزية الوسائط', 'Media readiness'),
    value: text(
      ar,
      `${input.readyMediaCount} من ${input.totalImagePosts} وسائط جاهزة`,
      `${input.readyMediaCount} / ${input.totalImagePosts} media ready`,
    ),
    helper: input.ambiguousPreviewCount > 0
      ? text(
        ar,
        `${input.ambiguousPreviewCount} معاينات ظاهرة لا تُحتسب جاهزة حتى يتم تأكيد مصدرها.`,
        `${englishPlural(input.ambiguousPreviewCount, 'visible preview')} not counted ready until the source is confirmed.`,
      )
      : pending > 0
        ? text(
          ar,
          `${pending} خانات تحتاج قرار وسائط قبل اعتبار المعاينة نهائية بصرياً.`,
          `${englishPlural(pending, 'slot')} need a media decision before the preview is visually final.`,
        )
        : text(ar, 'كل وسائط المنشورات المطلوبة جاهزة للمراجعة.', 'All required post media is ready for review.'),
    tone: pending > 0 || input.ambiguousPreviewCount > 0 ? 'warning' : 'positive',
  }
}

function nextDecisionCard(input: ContentHubFirstScreenTruthInput, ar: boolean): ContentHubFirstScreenTruthCard {
  const pendingMedia = Math.max(0, input.totalImagePosts - input.readyMediaCount)

  if (input.fulfillmentSummary.status === 'paid_planning_only') {
    return {
      label: text(ar, 'القرار التالي', 'Next decision'),
      value: text(ar, 'راجع بريف التخطيط المدفوع', 'Review the paid planning brief'),
      helper: text(
        ar,
        'لا توجد منشورات عضوية مطلوبة في Content Hub لهذا التشغيل المدفوع فقط.',
        'No organic Content Hub posts are required for this paid-only run.',
      ),
      tone: 'muted',
    }
  }

  if (input.hasOrderMismatch || input.fulfillmentSummary.tone === 'danger') {
    return {
      label: text(ar, 'القرار التالي', 'Next decision'),
      value: text(ar, 'أصلح تطابق الخطة أولاً', 'Repair plan match first'),
      helper: text(
        ar,
        'لا تعتمد أو تجدول قبل تطابق منشورات Content Hub مع وعد الاستراتيجية.',
        'Do not approve or schedule before Content Hub posts match the strategy promise.',
      ),
      tone: 'danger',
    }
  }

  if (input.totalPosts === 0) {
    return {
      label: text(ar, 'القرار التالي', 'Next decision'),
      value: text(ar, 'أنشئ مسودات محتوى للمراجعة', 'Create draft content for review'),
      helper: text(
        ar,
        'هذه خطوة توليد مسودات فقط؛ لا تعتمد أو تجدول أو تنشر.',
        'This creates review drafts only; it does not approve, schedule, or publish.',
      ),
      tone: 'warning',
    }
  }

  if (input.draftCount > 0) {
    return {
      label: text(ar, 'القرار التالي', 'Next decision'),
      value: pendingMedia > 0
        ? text(ar, 'راجع المسودات واحسم الوسائط', 'Review drafts and resolve media')
        : text(ar, 'راجع المسودات قبل الاعتماد', 'Review drafts before approval'),
      helper: pendingMedia > 0
        ? text(
          ar,
          'النصوص والوسائط يجب أن يكونا واضحين قبل الاعتماد أو الجدولة.',
          'Copy and media should be clear before approval or scheduling.',
        )
        : text(
          ar,
          'إذا كانت النصوص جاهزة، يصبح الاعتماد هو القرار التالي الصريح.',
          'If copy is ready, approval becomes the next explicit decision.',
        ),
      tone: 'warning',
    }
  }

  if (input.approvedCount > 0) {
    return {
      label: text(ar, 'القرار التالي', 'Next decision'),
      value: text(ar, 'قرر الجدولة صراحة', 'Decide scheduling explicitly'),
      helper: text(ar, 'المنشورات معتمدة فقط وليست مجدولة أو منشورة.', 'Posts are approved only; they are not scheduled or published.'),
      tone: 'positive',
    }
  }

  if (input.scheduledCount > 0) {
    return {
      label: text(ar, 'القرار التالي', 'Next decision'),
      value: text(ar, 'راجع جاهزية النشر', 'Review publish readiness'),
      helper: text(
        ar,
        'النشر يحتاج حسابات متصلة، صلاحيات، وسائط جاهزة، وتأكيداً صريحاً.',
        'Publishing requires connected accounts, permissions, ready media, and explicit confirmation.',
      ),
      tone: 'muted',
    }
  }

  return {
    label: text(ar, 'القرار التالي', 'Next decision'),
    value: text(ar, 'انتظر بيانات الأداء', 'Wait for performance data'),
    helper: text(
      ar,
      'لا توجد قراءة أداء أو تعلّم حقيقي قبل وصول analyticsData.',
      'There is no performance read or real learning before analyticsData arrives.',
    ),
    tone: 'muted',
  }
}

export function deriveContentHubFirstScreenTruth(input: ContentHubFirstScreenTruthInput): ContentHubFirstScreenTruthCard[] {
  const ar = input.locale === 'ar'

  return [
    {
      label: input.fulfillmentSummary.label,
      value: input.fulfillmentSummary.value,
      helper: input.fulfillmentSummary.helper,
      tone: input.fulfillmentSummary.tone,
    },
    postStateCard(input, ar),
    mediaStateCard(input, ar),
    nextDecisionCard(input, ar),
  ]
}
