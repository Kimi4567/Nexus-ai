// Keep this helper client-safe. These mirror src/lib/credits.ts costs without
// importing server-only billing/prisma code into Content Hub.
export const CONTENT_HUB_IMAGE_COST = 3
export const CONTENT_HUB_REWRITE_COST = 1
export const CONTENT_HUB_REGENERATION_COST = 2

export type ContentHubConfirmationResult =
  | { ok: true }
  | { ok: false; error: string }

export function getBulkImageGenerationCost(imageCount: number): number {
  return Math.max(0, Math.trunc(imageCount)) * CONTENT_HUB_IMAGE_COST
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
