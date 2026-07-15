// Keep this helper client-safe. These mirror src/lib/credits.ts costs without
// importing server-only billing/prisma code into Content Hub.
export const CONTENT_HUB_IMAGE_COST = 3
export const CONTENT_HUB_REWRITE_COST = 1
export const CONTENT_HUB_REGENERATION_COST = 2

export type ContentHubConfirmationResult =
  | { ok: true }
  | { ok: false; error: string }

export type BulkImageGenerationOutcome = {
  requested: number
  attempted: number
  generated: number
  failed: number
  refundPending: number
  creditsUsed: number | null
  stoppedReason?: string | null
}

export type BulkImageGenerationSummary = {
  tone: 'success' | 'warning' | 'error'
  message: string
}

export function getBulkImageGenerationCost(imageCount: number): number {
  return Math.max(0, Math.trunc(imageCount)) * CONTENT_HUB_IMAGE_COST
}

export function summarizeBulkImageGenerationOutcome(
  input: BulkImageGenerationOutcome,
  locale: 'en' | 'ar' = 'en',
): BulkImageGenerationSummary {
  const requested = Math.max(0, Math.trunc(input.requested))
  const attempted = Math.max(0, Math.min(requested, Math.trunc(input.attempted)))
  const generated = Math.max(0, Math.min(attempted, Math.trunc(input.generated)))
  const failed = Math.max(0, Math.min(attempted - generated, Math.trunc(input.failed)))
  const refundPending = Math.max(0, Math.min(failed, Math.trunc(input.refundPending)))
  const notAttempted = Math.max(0, requested - attempted)
  const credits = input.creditsUsed == null
    ? null
    : Math.max(0, Math.trunc(input.creditsUsed))
  const stoppedReason = input.stoppedReason?.trim()

  const creditCopy = locale === 'ar'
    ? (credits == null
        ? 'حالة الخصم غير مؤكدة من هذا الرد؛ راجع سجل الكريديت بعد تحديث المحفظة.'
        : refundPending > 0
          ? `الخصم المؤكد للصور المكتملة: ${credits} كريديت؛ ولا يشمل الاسترداد المعلّق.`
          : `الكريديت المستخدم فعليًا: ${credits}.`)
    : (credits == null
        ? 'This response could not confirm the final charge; refresh the wallet and review credit history.'
        : refundPending > 0
          ? `Confirmed charge for completed images: ${credits} credits; pending restoration is not included.`
          : `Credits actually used: ${credits}.`)

  if (generated === requested && failed === 0 && refundPending === 0 && !stoppedReason) {
    return {
      tone: 'success',
      message: locale === 'ar'
        ? `تم توليد ${generated} صور منشورات وربطها للمراجعة. ${creditCopy} لم تتم جدولة أو نشر أي منشور.`
        : `${generated} post image${generated === 1 ? '' : 's'} generated and attached for review. ${creditCopy} Nothing was scheduled or published.`,
    }
  }

  const tone: BulkImageGenerationSummary['tone'] = generated > 0 ? 'warning' : 'error'
  const restoredFailures = Math.max(0, failed - refundPending)

  if (locale === 'ar') {
    const parts = [
      generated > 0 ? `تم توليد ${generated} من ${requested} صور.` : 'لم يتم توليد أي صورة.',
      restoredFailures > 0 ? `فشل ${restoredFailures} وتم تأكيد استرداد كريديته.` : null,
      refundPending > 0 ? `${refundPending} عملية استرداد معلقة للمصالحة التلقائية.` : null,
      notAttempted > 0 ? `${notAttempted} صور لم تبدأ.` : null,
      creditCopy,
      stoppedReason ? `سبب التوقف: ${stoppedReason}` : null,
      'لم تتم جدولة أو نشر أي منشور.',
    ].filter(Boolean)
    return { tone, message: parts.join(' ') }
  }

  const parts = [
    generated > 0
      ? `${generated} of ${requested} post images generated.`
      : 'No post images were generated.',
    restoredFailures > 0
      ? `${restoredFailures} failed and ${restoredFailures === 1 ? 'its charge was' : 'their charges were'} confirmed restored.`
      : null,
    refundPending > 0
      ? `${refundPending} credit restoration ${refundPending === 1 ? 'is' : 'are'} pending automatic reconciliation.`
      : null,
    notAttempted > 0 ? `${notAttempted} ${notAttempted === 1 ? 'image was' : 'images were'} not started.` : null,
    creditCopy,
    stoppedReason ? `Stopped because: ${stoppedReason}` : null,
    'Nothing was scheduled or published.',
  ].filter(Boolean)

  return { tone, message: parts.join(' ') }
}

export function validateBulkImageGenerationConfirmation(input: {
  confirmed?: unknown
  acknowledgedImageCount?: unknown
  acknowledgedCreditCost?: unknown
  expectedImageCount: number
}): ContentHubConfirmationResult {
  if (input.confirmed !== true) {
    return { ok: false, error: 'Image generation requires explicit confirmation. No credits were spent.' }
  }

  const expectedImageCount = Math.max(0, Math.trunc(input.expectedImageCount))
  const expectedCreditCost = getBulkImageGenerationCost(expectedImageCount)

  if (input.acknowledgedImageCount !== expectedImageCount) {
    return { ok: false, error: 'Image generation count confirmation is out of date. No credits were spent.' }
  }

  if (input.acknowledgedCreditCost !== expectedCreditCost) {
    return { ok: false, error: 'Image generation credit confirmation is out of date. No credits were spent.' }
  }

  return { ok: true }
}

export function validateSingleImageGenerationConfirmation(input: {
  confirmed?: unknown
  acknowledgedCreditCost?: unknown
  acknowledgedNoPublishOrSchedule?: unknown
  acknowledgedPostMediaForReview?: unknown
}): ContentHubConfirmationResult {
  if (
    input.confirmed !== true ||
    input.acknowledgedCreditCost !== CONTENT_HUB_IMAGE_COST ||
    input.acknowledgedNoPublishOrSchedule !== true
  ) {
    return { ok: false, error: 'Image generation requires explicit confirmation. No credits were spent.' }
  }

  if (
    'acknowledgedPostMediaForReview' in input &&
    input.acknowledgedPostMediaForReview !== true
  ) {
    return { ok: false, error: 'Image generation requires explicit confirmation. No credits were spent.' }
  }

  return { ok: true }
}

export function validateRewriteConfirmation(input: {
  confirmed?: unknown
  acknowledgedCreditCost?: unknown
}): ContentHubConfirmationResult {
  if (input.confirmed !== true || input.acknowledgedCreditCost !== CONTENT_HUB_REWRITE_COST) {
    return { ok: false, error: 'Rewrite requires explicit confirmation. No credits were spent.' }
  }

  return { ok: true }
}

export function getMediaPendingVisualStateCopy(locale: 'en' | 'ar' = 'en') {
  return locale === 'ar'
    ? {
        title: 'الوسائط بانتظار القرار',
        body: 'المنشورات التي تنتظر وسائط ليست نهائية بصريًا ولا تعني أنها منشورة أو مباشرة.',
      }
    : {
        title: 'Media decision pending',
        body: 'Media-pending posts are not visually final and do not mean anything is published or live.',
      }
}
