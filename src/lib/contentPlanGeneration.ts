/**
 * Content-plan generation reliability (Trust Sprint #5).
 *
 * Root cause of the intermittent 502: the single gpt-4o content-plan call had no
 * HTTP-error handling and no retry. A transient provider hiccup (429 / 5xx /
 * network blip) or a slow response left `choices` undefined, the parse produced
 * an empty array, and the route returned 502 — even though an immediate retry
 * succeeds (exactly what was observed in PR #4 QA).
 *
 * This module:
 *  - classifies a chat-completion response clearly (ok / truncated / malformed /
 *    empty / provider) so failures are never silent or ambiguous;
 *  - retries ONLY transient failures, in-process, BEFORE any posts are created —
 *    so a retry can never produce duplicate posts or a second credit charge;
 *  - short-circuits deterministic failures (truncated/malformed) that a retry
 *    cannot fix, so the caller refunds and surfaces a clear error fast.
 *
 * It is intentionally provider-agnostic and fetch-injectable so it can be unit
 * tested without network or prisma.
 */

export interface ChatChoiceLike {
  message?: { content?: unknown }
  finish_reason?: string
}

export interface ChatResponseLike {
  choices?: ChatChoiceLike[]
  error?: unknown
}

export type ContentPlanFailure = 'truncated' | 'malformed' | 'empty' | 'provider'

export type ParseResult =
  | { ok: true; posts: any[] }
  | { ok: false; reason: ContentPlanFailure }

/** Pull the posts array out of a (possibly wrapped) json_object response. */
export function extractPostsArray(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw
  if (raw && typeof raw === 'object') {
    const arr = Object.values(raw as Record<string, unknown>).find((v) => Array.isArray(v))
    if (Array.isArray(arr)) return arr
  }
  return []
}

/**
 * Parse one chat-completion response into posts, classifying failures clearly.
 * - `truncated`: model hit its token ceiling (finish_reason === 'length') →
 *   output is incomplete; retrying the same request will not help.
 * - `malformed`: content present but not valid JSON.
 * - `empty`: no choice / empty content / zero posts → usually a transient
 *   provider issue worth retrying.
 */
export function parseContentPlanResponse(data: ChatResponseLike): ParseResult {
  const choice = data?.choices?.[0]
  if (!choice) return { ok: false, reason: 'empty' }
  if (choice.finish_reason === 'length') return { ok: false, reason: 'truncated' }

  const content = typeof choice.message?.content === 'string' ? choice.message.content : ''
  if (!content.trim()) return { ok: false, reason: 'empty' }

  let raw: unknown
  try {
    raw = JSON.parse(content)
  } catch {
    return { ok: false, reason: 'malformed' }
  }

  const posts = extractPostsArray(raw)
  if (!posts.length) return { ok: false, reason: 'empty' }
  return { ok: true, posts }
}

/** Transient failures are worth retrying; deterministic ones are not. */
export function isRetryableFailure(reason: ContentPlanFailure): boolean {
  return reason === 'provider' || reason === 'empty'
}

export interface FetchLikeResponse {
  ok: boolean
  status: number
  json: () => Promise<any>
}

export interface RetryOpts {
  /** Total attempts including the first (default 2). */
  maxAttempts?: number
  /** Linear backoff base; delay before attempt n+1 is baseDelayMs * n (default 700). */
  baseDelayMs?: number
  /** Injectable sleep for fast tests. */
  sleep?: (ms: number) => Promise<void>
}

export interface RetryResult {
  result: ParseResult
  attempts: number
}

export interface ContentPlanQuotaLike {
  postsPerCampaign?: number | null
  videoSlotsPerMonth?: number | null
}

export interface ContentPlanSlotScope {
  canGenerate: boolean
  imagePosts: number
  videoSlots: number
  totalSlots: number
  source: 'strategy-deliverables' | 'plan-quota'
  blockedReason?: 'paid-planning-only' | 'no-organic-post-count'
}

export interface ContentPlanSlot {
  publishTarget: string
  isVideoPost: boolean
  index: number
}

export interface StrategyAngleLike {
  platform?: unknown
  format?: unknown
  contentType?: unknown
  type?: unknown
}

const VIDEO_ONLY_TARGETS = new Set(['YOUTUBE', 'YOUTUBE_SHORTS', 'TIKTOK', 'REELS', 'STORIES'])

function normalizeContentTarget(raw: string): string {
  const target = raw.trim().toUpperCase().replace(/[\s-]+/g, '_')
  if (target === 'TWITTER') return 'X'
  return target
}

/**
 * Bind generated Content Hub slots to the exact reviewed strategy directions.
 * Campaign platforms define the allowed set; an angle may choose only within
 * that set. This prevents a later round-robin from silently moving a strategy
 * direction to another channel.
 */
export function bindContentPlanSlotsToStrategyAngles(
  slots: ContentPlanSlot[],
  angles: StrategyAngleLike[],
  allowedPlatforms: string[],
): ContentPlanSlot[] {
  if (angles.length === 0) return slots
  const allowed = new Set(allowedPlatforms.map(normalizeContentTarget))

  return slots.map((slot, index) => {
    const angle = angles[index % angles.length] || {}
    const requestedTarget = typeof angle.platform === 'string'
      ? normalizeContentTarget(angle.platform)
      : null
    const requestedTargetAllowed = requestedTarget && (
      allowed.has(requestedTarget)
      || (['YOUTUBE_SHORT', 'YOUTUBE_SHORTS'].includes(requestedTarget) && allowed.has('YOUTUBE'))
      || (requestedTarget === 'YOUTUBE' && (allowed.has('YOUTUBE_SHORT') || allowed.has('YOUTUBE_SHORTS')))
    )
    const publishTarget = requestedTargetAllowed
      ? requestedTarget
      : normalizeContentTarget(slot.publishTarget)
    const format = [angle.format, angle.contentType, angle.type]
      .filter((value): value is string => typeof value === 'string')
      .join(' ')
    const explicitlyVideo = /video|reel|short|story|tiktok|فيديو|ريل|ستوري/i.test(format)
    const explicitlyStatic = /image|static|carousel|photo|post|صورة|كاروسيل|منشور/i.test(format)
    const isVideoPost = VIDEO_ONLY_TARGETS.has(publishTarget)
      || explicitlyVideo
      || (!explicitlyStatic && slot.isVideoPost)

    return {
      ...slot,
      publishTarget,
      isVideoPost,
    }
  })
}

/**
 * Build a deterministic platform/media matrix while respecting video-native
 * destinations. The reviewed total remains binding. When possible, a flexible
 * video slot is swapped to image so the requested image/video totals also stay
 * unchanged; a video-only destination can never be saved as an image draft.
 */
export function distributeContentPlanSlots(
  imagePosts: number,
  videoSlots: number,
  platforms: string[],
): ContentPlanSlot[] {
  const destinations = platforms.map(normalizeContentTarget).filter(Boolean)
  if (destinations.length === 0) return []

  const slots: ContentPlanSlot[] = []
  const append = (count: number, isVideoPost: boolean) => {
    for (let i = 0; i < Math.max(0, Math.floor(count)); i++) {
      slots.push({
        publishTarget: destinations[slots.length % destinations.length],
        isVideoPost,
        index: slots.length,
      })
    }
  }
  append(imagePosts, false)
  append(videoSlots, true)

  for (const slot of slots) {
    if (VIDEO_ONLY_TARGETS.has(slot.publishTarget)) slot.isVideoPost = true
  }

  let extraVideoSlots = slots.filter(slot => slot.isVideoPost).length - Math.max(0, Math.floor(videoSlots))
  for (let i = slots.length - 1; i >= 0 && extraVideoSlots > 0; i--) {
    const slot = slots[i]
    if (slot.isVideoPost && !VIDEO_ONLY_TARGETS.has(slot.publishTarget)) {
      slot.isVideoPost = false
      extraVideoSlots--
    }
  }

  return slots
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function positiveInteger(value: unknown): number | null {
  const n = Math.floor(Number(value))
  return Number.isFinite(n) && n > 0 ? n : null
}

function readStrategyType(aiOutput: unknown): string | null {
  if (!isRecord(aiOutput)) return null
  const direct = typeof aiOutput.strategyType === 'string' ? aiOutput.strategyType : null
  if (direct) return direct

  const order = isRecord(aiOutput.strategyOrder) ? aiOutput.strategyOrder : null
  if (typeof order?.strategyType === 'string') return order.strategyType

  const strategy = isRecord(aiOutput.strategy) ? aiOutput.strategy : null
  return typeof strategy?.strategyType === 'string' ? strategy.strategyType : null
}

function readBindingOrganicPostCount(aiOutput: unknown): number | null {
  if (!isRecord(aiOutput)) return null

  const deliverables = isRecord(aiOutput.strategyDeliverables) ? aiOutput.strategyDeliverables : null
  const deliverablesCount = positiveInteger(deliverables?.organicPostCount)
  if (deliverablesCount) return deliverablesCount

  const outputCount = positiveInteger(aiOutput.organicPostCount)
  if (outputCount) return outputCount

  return null
}

function hasStrategyOrderBinding(aiOutput: unknown): boolean {
  return isRecord(aiOutput) && (
    isRecord(aiOutput.strategyOrder) ||
    isRecord(aiOutput.strategyDeliverables) ||
    positiveInteger(aiOutput.organicPostCount) !== null
  )
}

/**
 * Resolve the exact number of Content Hub draft rows a generation run may save.
 *
 * New strategy-order runs are binding: if the reviewed order says 7 first-window
 * organic post directions, Content Hub must create exactly 7 SocialPost drafts
 * total. Plan quota counts remain the fallback for legacy campaigns that do not
 * have a saved strategyOrder/strategyDeliverables contract.
 */
export function resolveContentPlanSlotScope(
  aiOutput: unknown,
  quota: ContentPlanQuotaLike = {},
): ContentPlanSlotScope {
  const fallbackImagePosts = positiveInteger(quota.postsPerCampaign) ?? 12
  const fallbackVideoSlots = Math.max(0, Math.floor(Number(quota.videoSlotsPerMonth) || 0))
  const strategyType = readStrategyType(aiOutput)
  const bindingCount = readBindingOrganicPostCount(aiOutput)
  const hasBinding = hasStrategyOrderBinding(aiOutput)

  if (hasBinding && strategyType === 'paid') {
    return {
      canGenerate: false,
      imagePosts: 0,
      videoSlots: 0,
      totalSlots: 0,
      source: 'strategy-deliverables',
      blockedReason: 'paid-planning-only',
    }
  }

  if (hasBinding && !bindingCount) {
    return {
      canGenerate: false,
      imagePosts: 0,
      videoSlots: 0,
      totalSlots: 0,
      source: 'strategy-deliverables',
      blockedReason: 'no-organic-post-count',
    }
  }

  if (bindingCount) {
    const videoSlots = Math.min(fallbackVideoSlots, bindingCount)
    const imagePosts = bindingCount - videoSlots
    return {
      canGenerate: true,
      imagePosts,
      videoSlots,
      totalSlots: bindingCount,
      source: 'strategy-deliverables',
    }
  }

  return {
    canGenerate: true,
    imagePosts: fallbackImagePosts,
    videoSlots: fallbackVideoSlots,
    totalSlots: fallbackImagePosts + fallbackVideoSlots,
    source: 'plan-quota',
  }
}

/**
 * Call the content-plan model with a safe in-process retry.
 *
 * `doFetch` performs exactly one provider request (fresh each call). Transient
 * failures — non-OK HTTP, empty/no-choice output, or a thrown network error —
 * retry up to `maxAttempts` with linear backoff. Deterministic failures
 * (truncated / malformed) short-circuit immediately. On success returns the
 * parsed posts and the attempt number it succeeded on.
 *
 * Because this runs before the caller writes any SocialPost rows, a retry can
 * never create duplicate posts, and the caller charges credits exactly once.
 */
export async function generateContentPlanWithRetry(
  doFetch: () => Promise<FetchLikeResponse>,
  opts: RetryOpts = {},
): Promise<RetryResult> {
  const maxAttempts = Math.max(1, opts.maxAttempts ?? 2)
  const baseDelayMs = opts.baseDelayMs ?? 700
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))

  let last: ParseResult = { ok: false, reason: 'provider' }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let parsed: ParseResult
    try {
      const res = await doFetch()
      if (!res.ok) {
        parsed = { ok: false, reason: 'provider' }
      } else {
        const data = await res.json()
        parsed = parseContentPlanResponse(data)
      }
    } catch {
      parsed = { ok: false, reason: 'provider' }
    }

    if (parsed.ok) return { result: parsed, attempts: attempt }

    last = parsed
    // Deterministic failure — a retry cannot help. Fail clearly now.
    if (!isRetryableFailure(parsed.reason)) return { result: parsed, attempts: attempt }
    if (attempt < maxAttempts) await sleep(baseDelayMs * attempt)
  }

  return { result: last, attempts: maxAttempts }
}

export interface ContentPlanFailureHttp {
  status: number
  body: { error: string; reason: ContentPlanFailure; refunded: boolean }
}

/**
 * Build the HTTP failure payload for a non-recoverable content-plan generation.
 * Always 502 with a clear, user-safe message and an explicit `refunded` flag so
 * the client knows credits were returned. Centralised so the message stays
 * consistent and testable.
 */
export function contentPlanFailureResponse(
  reason: ContentPlanFailure,
  refunded: boolean,
): ContentPlanFailureHttp {
  const error =
    reason === 'truncated'
      ? 'Content generation produced incomplete output. Please try again.'
      : 'Content generation failed — no posts were produced. Please try again.'
  return { status: 502, body: { error, reason, refunded } }
}
