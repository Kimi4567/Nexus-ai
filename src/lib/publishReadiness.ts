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
  | 'READY_MANUAL'
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
  READY_MANUAL: {
    title: { en: 'Ready for manual publish', ar: 'جاهز للنشر اليدوي' },
    copy: {
      en: 'NEXUS will publish only when you click this button.',
      ar: 'لن ينشر NEXUS إلا عند الضغط على هذا الزر.',
    },
    buttonLabel: { en: 'Publish now', ar: 'انشر الآن' },
  },
  READY_SCHEDULE: {
    title: { en: 'Ready to schedule', ar: 'جاهز للجدولة' },
    copy: {
      en: 'Scheduling prepares the post for the selected time. It does not bypass approval.',
      ar: 'الجدولة تجهّز المنشور للوقت المحدد ولا تتجاوز الاعتماد.',
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
  const reason: PublishReason = mode === 'schedule' ? 'READY_SCHEDULE' : 'READY_MANUAL'
  return {
    status: 'ready',
    reason,
    title: COPY[reason].title,
    copy: COPY[reason].copy,
    buttonLabel: COPY[reason].buttonLabel,
  }
}
