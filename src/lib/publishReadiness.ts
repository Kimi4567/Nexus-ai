/**
 * publishReadiness.ts
 *
 * Pure, side-effect-free helper that computes whether a social publish action
 * is locked or ready, and the exact honest copy to show the user.
 *
 * No API calls. No mutations. Safe to call on every render.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type PublishReason =
  | 'CONTENT_NOT_APPROVED'
  | 'NO_ACCOUNT'
  | 'NO_PAGE'
  | 'SCHEDULE_TIME_REQUIRED'
  | 'INSTAGRAM_BUSINESS_REQUIRED'
  | 'INSTAGRAM_IMAGE_REQUIRED'
  | 'READY_EXPLICIT_API_PUBLISH'
  | 'READY_SCHEDULE'

export interface I18nString {
  en: string
  ar: string
}

export interface PublishReadiness {
  status: 'locked' | 'ready'
  reason: PublishReason
  title: I18nString
  copy: I18nString
  buttonLabel?: I18nString
}

export interface PublishReadinessInput {
  /** Whether campaign content has been approved (ACTIVE or approvalState === 'done') */
  contentApproved: boolean
  /** Number of connected social accounts available */
  accountCount: number
  /** Whether a page has been selected */
  hasPage: boolean
  /** Whether the selected page has an Instagram Business account linked */
  pageHasIgAccount: boolean
  /** Current platform selection */
  platform: 'FACEBOOK' | 'INSTAGRAM'
  /** Whether an image URL is present */
  hasImage: boolean
  /** 'now' = manual immediate publish, 'schedule' = future date */
  mode: 'now' | 'schedule'
  /** Whether a scheduled date/time is set (relevant for 'schedule' mode only) */
  hasScheduledAt: boolean
}

export interface PublishTabPostInput {
  status?: string | null
  publishMode?: string | null
  scheduledAt?: string | Date | null
  publishedAt?: string | Date | null
  manuallyPublishedAt?: string | Date | null
  platformPostId?: string | null
  platformUrl?: string | null
  analyticsData?: unknown
}

export interface PublishTabReadinessSummary {
  totalPosts: number
  scheduledNotPublished: number
  manualPublished: number
  manualPublishedWithoutUrl: number
  apiPublished: number
  autoScheduled: number
  hasConnectedPublishingAccount: boolean
  hasAutopilotEnabled: boolean
  hasAnalyticsData: boolean
  safeCopy: {
    title: I18nString
    helper: I18nString
    scheduled: I18nString
    manual: I18nString
    api: I18nString
    accounts: I18nString
    automation: I18nString
    performance: I18nString
  }
}

// ─── Honest copy map ──────────────────────────────────────────────────────────

const COPY: Record<
  PublishReason,
  { title: I18nString; copy: I18nString; buttonLabel?: I18nString }
> = {
  CONTENT_NOT_APPROVED: {
    title: { en: 'Content not approved', ar: 'المحتوى غير معتمد' },
    copy: {
      en: 'Approve content before publishing.',
      ar: 'اعتمد المحتوى قبل النشر.',
    },
  },
  NO_ACCOUNT: {
    title: { en: 'No publishing account connected', ar: 'لا يوجد حساب نشر مربوط' },
    copy: {
      en: 'Connect a publishing account before posting.',
      ar: 'اربط حساب نشر قبل إرسال المنشور.',
    },
  },
  NO_PAGE: {
    title: { en: 'No page selected', ar: 'لم يتم اختيار صفحة' },
    copy: {
      en: 'Connect a publishing account before posting.',
      ar: 'اربط حساب نشر قبل إرسال المنشور.',
    },
  },
  SCHEDULE_TIME_REQUIRED: {
    title: { en: 'Schedule time required', ar: 'مطلوب وقت للجدولة' },
    copy: {
      en: 'Select a scheduled time before scheduling.',
      ar: 'حدد وقت الجدولة قبل جدولة المنشور.',
    },
  },
  INSTAGRAM_BUSINESS_REQUIRED: {
    title: { en: 'Instagram Business account required', ar: 'مطلوب حساب Instagram Business' },
    copy: {
      en: 'Instagram publishing requires an Instagram Business account linked to this Facebook Page.',
      ar: 'نشر Instagram يتطلب حساب Instagram Business مربوط بصفحة Facebook.',
    },
  },
  INSTAGRAM_IMAGE_REQUIRED: {
    title: { en: 'Image required for Instagram', ar: 'صورة مطلوبة لـ Instagram' },
    copy: {
      en: 'Instagram requires an image.',
      ar: 'Instagram يتطلب صورة.',
    },
  },
  READY_EXPLICIT_API_PUBLISH: {
    title: { en: 'Ready for explicit API publish', ar: 'جاهز للنشر عبر API بتأكيد صريح' },
    copy: {
      en: 'NEXUS sends this post through the connected platform API only after this explicit click.',
      ar: 'يرسل NEXUS هذا المنشور عبر API المنصة المتصلة فقط بعد هذه الضغطة الصريحة.',
    },
    buttonLabel: { en: 'Publish via platform API', ar: 'النشر عبر API المنصة' },
  },
  READY_SCHEDULE: {
    title: { en: 'Ready to schedule', ar: 'جاهز للجدولة' },
    copy: {
      en: 'Scheduling saves the selected time in NEXUS. It is not published unless an explicit platform publishing path is ready and confirmed.',
      ar: 'الجدولة تحفظ الوقت المحدد داخل NEXUS. لا يتم النشر إلا إذا كان مسار النشر عبر المنصة جاهزًا ومؤكدًا صراحةً.',
    },
    buttonLabel: { en: 'Schedule post', ar: 'جدولة المنشور' },
  },
}

// ─── Main helper ──────────────────────────────────────────────────────────────

export function getPublishReadiness(input: PublishReadinessInput): PublishReadiness {
  const {
    contentApproved,
    accountCount,
    hasPage,
    pageHasIgAccount,
    platform,
    hasImage,
    mode,
    hasScheduledAt,
  } = input

  const locked = (reason: PublishReason): PublishReadiness => ({
    status: 'locked',
    reason,
    title: COPY[reason].title,
    copy: COPY[reason].copy,
  })

  // Gate 1: content must be approved before any publish is possible
  if (!contentApproved) return locked('CONTENT_NOT_APPROVED')

  // Gate 2: at least one account must be connected
  if (accountCount === 0) return locked('NO_ACCOUNT')

  // Gate 3: a page must be selected
  if (!hasPage) return locked('NO_PAGE')

  // Gate 4: Instagram requires a page with an IG Business account linked
  if (platform === 'INSTAGRAM' && !pageHasIgAccount) return locked('INSTAGRAM_BUSINESS_REQUIRED')

  // Gate 5: Instagram requires an image
  if (platform === 'INSTAGRAM' && !hasImage) return locked('INSTAGRAM_IMAGE_REQUIRED')

  // Gate 6: schedule mode requires a date/time
  if (mode === 'schedule' && !hasScheduledAt) return locked('SCHEDULE_TIME_REQUIRED')

  // Ready
  const reason: PublishReason = mode === 'schedule' ? 'READY_SCHEDULE' : 'READY_EXPLICIT_API_PUBLISH'
  return {
    status: 'ready',
    reason,
    title: COPY[reason].title,
    copy: COPY[reason].copy,
    buttonLabel: COPY[reason].buttonLabel,
  }
}

function hasUsefulAnalytics(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && Object.keys(value as Record<string, unknown>).length > 0)
}

/**
 * Publish-tab operating summary. This is display-only and intentionally
 * conservative: scheduled/manual/API publishing are different states.
 */
export function derivePublishTabReadinessSummary(input: {
  posts?: PublishTabPostInput[] | null
  hasConnectedPublishingAccount?: boolean | null
  hasAutopilotEnabled?: boolean | null
  hasAnalyticsData?: boolean | null
}): PublishTabReadinessSummary {
  const posts = Array.isArray(input.posts) ? input.posts : []
  const scheduledNotPublished = posts.filter((post) => post.status === 'SCHEDULED').length
  const manualPublishedPosts = posts.filter((post) => (
    post.status === 'PUBLISHED' &&
    (post.publishMode === 'MANUAL' || Boolean(post.manuallyPublishedAt)) &&
    !post.platformPostId
  ))
  const apiPublished = posts.filter((post) => (
    post.status === 'PUBLISHED' &&
    (post.publishMode === 'AUTO' || Boolean(post.platformPostId))
  )).length
  const autoScheduled = posts.filter((post) => post.status === 'SCHEDULED' && post.publishMode === 'AUTO').length
  const hasConnectedPublishingAccount = Boolean(input.hasConnectedPublishingAccount)
  const hasAutopilotEnabled = Boolean(input.hasAutopilotEnabled)
  const hasAnalyticsData = Boolean(input.hasAnalyticsData) || posts.some((post) => hasUsefulAnalytics(post.analyticsData))

  return {
    totalPosts: posts.length,
    scheduledNotPublished,
    manualPublished: manualPublishedPosts.length,
    manualPublishedWithoutUrl: manualPublishedPosts.filter((post) => !post.platformUrl).length,
    apiPublished,
    autoScheduled,
    hasConnectedPublishingAccount,
    hasAutopilotEnabled,
    hasAnalyticsData,
    safeCopy: {
      title: {
        en: 'Publishing readiness',
        ar: 'جاهزية النشر',
      },
      helper: {
        en: 'Review what can and cannot be published. Scheduled posts are not published until the user publishes manually or a connected-account API publish is explicitly ready and confirmed.',
        ar: 'راجع ما يمكن وما لا يمكن نشره. المنشورات المجدولة غير منشورة حتى ينشرها المستخدم يدويًا أو يصبح النشر عبر حساب متصل جاهزًا ومؤكدًا صراحةً.',
      },
      scheduled: {
        en: `${scheduledNotPublished} scheduled in NEXUS — not published`,
        ar: `${scheduledNotPublished} مجدولة داخل NEXUS — غير منشورة`,
      },
      manual: {
        en: manualPublishedPosts.length > 0
          ? `${manualPublishedPosts.length} user-confirmed manual publish${manualPublishedPosts.length === 1 ? '' : 'es'}`
          : 'No user-confirmed manual publishes recorded',
        ar: manualPublishedPosts.length > 0
          ? `${manualPublishedPosts.length} تم تأكيد النشر يدويًا بواسطة المستخدم`
          : 'لا يوجد نشر يدوي مؤكد بواسطة المستخدم',
      },
      api: {
        en: apiPublished > 0
          ? `${apiPublished} platform/API publish${apiPublished === 1 ? '' : 'es'} recorded`
          : 'No platform/API publishing has occurred',
        ar: apiPublished > 0
          ? `${apiPublished} نشر عبر المنصة/API مسجل`
          : 'لم يحدث أي نشر عبر المنصة أو API',
      },
      accounts: {
        en: hasConnectedPublishingAccount
          ? 'A publishing account still needs page, permission, media, and explicit confirmation checks before API publishing.'
          : 'No connected publishing accounts are verified for this campaign tab.',
        ar: hasConnectedPublishingAccount
          ? 'ما زال النشر عبر الحساب يحتاج تحقق الصفحة والصلاحيات والوسائط وتأكيدًا صريحًا قبل النشر عبر API.'
          : 'لا توجد حسابات نشر متصلة مؤكدة في تبويب هذه الحملة.',
      },
      automation: {
        en: hasAutopilotEnabled
          ? 'Autopilot must still be reviewed separately before any automated publishing path is used.'
          : 'Publishing automation is not enabled.',
        ar: hasAutopilotEnabled
          ? 'يجب مراجعة الأوتوبايلوت بشكل منفصل قبل استخدام أي مسار نشر آلي.'
          : 'النشر التلقائي غير مفعّل.',
      },
      performance: {
        en: hasAnalyticsData
          ? 'Performance can be reviewed because analytics data exists.'
          : 'Performance appears only after real analytics are fetched.',
        ar: hasAnalyticsData
          ? 'يمكن مراجعة الأداء لأن بيانات التحليلات موجودة.'
          : 'يظهر الأداء فقط بعد جلب تحليلات حقيقية.',
      },
    },
  }
}
