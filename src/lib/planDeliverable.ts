/**
 * Per-campaign content deliverable — what ONE content-plan run actually generates.
 *
 * This is DISTINCT from the monthly post quota (PLAN_QUOTAS.postsPerMonth). The
 * content-plan generator builds `postsPerCampaign` image posts + `videoSlotsPerMonth`
 * video slots per run, so the wizard must promise THIS number (e.g. 16 + 2 = 18),
 * not the monthly quota (e.g. 25).
 *
 * Mirrors src/lib/stripe.ts PLAN_QUOTAS (postsPerCampaign + videoSlotsPerMonth),
 * plus the marketing display aliases the billing status may report
 * (GROWTH → PRO, AGENCY → BUSINESS). Kept client-safe (no server deps) so the
 * wizard can import it; a unit test keeps it in sync with PLAN_QUOTAS.
 */

export interface CampaignDeliverable {
  /** AI-generated image+caption posts produced this run. */
  imagePosts: number
  /** Video post slots produced this run (user uploads their own video). */
  videoSlots: number
  /** Total posts produced this run = imagePosts + videoSlots. */
  total: number
}

const PER_CAMPAIGN: Record<string, { imagePosts: number; videoSlots: number }> = {
  FREE:     { imagePosts: 3,  videoSlots: 0 },
  STARTER:  { imagePosts: 12, videoSlots: 0 },
  PRO:      { imagePosts: 16, videoSlots: 2 },
  GROWTH:   { imagePosts: 16, videoSlots: 2 }, // display alias of PRO
  ACTIVE:   { imagePosts: 16, videoSlots: 2 },
  BUSINESS: { imagePosts: 20, videoSlots: 5 },
  AGENCY:   { imagePosts: 20, videoSlots: 5 }, // display alias of BUSINESS
}

const FALLBACK = { imagePosts: 12, videoSlots: 0 }

/** How many posts a single content-plan run will generate for `plan`. */
export function getCampaignDeliverable(plan: string | null | undefined): CampaignDeliverable {
  const key = (plan ?? 'FREE').toUpperCase()
  const d = PER_CAMPAIGN[key] ?? FALLBACK
  return { imagePosts: d.imagePosts, videoSlots: d.videoSlots, total: d.imagePosts + d.videoSlots }
}
