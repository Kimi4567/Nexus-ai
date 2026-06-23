/**
 * Publish Readiness — OP-D1.3 (Publish Locked-State Honesty)
 *
 * PURE, READ-ONLY derivation. No network, no I/O, no side effects.
 * Derives honest publish readiness state from data already available
 * in the campaign detail page / SocialPublisher context.
 *
 * Non-negotiable honesty rules:
 *   - No real generated post exists → publishing locked
 *   - Content exists but unapproved → needs approval first
 *   - Approved content + no verified platform → manual publishing only
 *   - Connected account exists but not verified → connected publishing locked
 *   - Auto-publish unavailable/unverified → auto-publish locked
 *   - Strategy content ≠ publish-ready content
 *   - Campaign draft ≠ generated post
 *   - Connected account ≠ publish-ready
 *   - Approval does NOT equal publishing
 */

export type PublishLockState =
  | 'no_content'           // no real generated posts exist
  | 'draft_unapproved'     // posts exist but none approved
  | 'manual_only'          // approved content, but no verified platform
  | 'connected_ready'      // approved content + verified platform
  | 'auto_ready'           // approved content + verified platform + autopilot on

export type PublishAction = 'none' | 'approve' | 'connect' | 'manual' | 'connected' | 'auto'

export interface PublishReadinessInput {
  /** Whether the campaign has generated posts (socialPostCount > 0) */
  hasGeneratedPosts: boolean
  /** Whether any posts are APPROVED or SCHEDULED */
  hasApprovedPosts: boolean
  /** Whether a connected social account exists */
  connectedAccountExists: boolean
  /** Whether any connected platform is 'ready' (verified, publish-capable) */
  platformReady: boolean
  /** Whether autopilot is currently enabled */
  autopilotEnabled: boolean
  /** Current campaign status */
  campaignStatus: string
}

export interface PublishReadinessResult {
  /** The derived lock state */
  state: PublishLockState
  /** Can the user publish at all (even manually via copy-paste) */
  canPublish: boolean
  /** Can the user use connected (API) publishing */
  canConnectPublish: boolean
  /** Can the user enable auto-publish */
  canAutoPublish: boolean
  /** Human-readable lock reason (EN) — used as fallback if i18n key missing */
  reasonEn: string
  /** Human-readable lock reason (AR) */
  reasonAr: string
  /** Suggested action for the user */
  suggestedAction: PublishAction
  /** i18n key for the lock reason */
  reasonKey: string
  /** i18n key for the suggested action label */
  actionKey: string
}

const REASONS: Record<PublishLockState, { en: string; ar: string; reasonKey: string; action: PublishAction; actionKey: string }> = {
  no_content: {
    en: 'Publishing is locked until approved content exists.',
    ar: 'النشر مقفل حتى يوجد محتوى معتمد.',
    reasonKey: 'publish.lock.noContent',
    action: 'none',
    actionKey: 'publish.action.generateContent',
  },
  draft_unapproved: {
    en: 'Approve content before publishing or scheduling.',
    ar: 'اعتماد المحتوى قبل النشر أو الجدولة.',
    reasonKey: 'publish.lock.draftUnapproved',
    action: 'approve',
    actionKey: 'publish.action.approveContent',
  },
  manual_only: {
    en: 'Manual publishing is available. NEXUS will not publish this automatically.',
    ar: 'النشر اليدني متاح. NEXUS لن ينشر هذا تلقائياً.',
    reasonKey: 'publish.lock.manualOnly',
    action: 'connect',
    actionKey: 'publish.action.connectPlatform',
  },
  connected_ready: {
    en: 'Connected publishing is available. Approval does not publish this post.',
    ar: 'النشر المتصل متاح. الاعتماد لا ينشر هذا المنشور.',
    reasonKey: 'publish.lock.connectedReady',
    action: 'connected',
    actionKey: 'publish.action.publishNow',
  },
  auto_ready: {
    en: 'Auto-publish is active. Content you approved will publish on schedule.',
    ar: 'النشر التلقائي نشط. المحتوى المعتمد سينشر حسب الجدول.',
    reasonKey: 'publish.lock.autoReady',
    action: 'auto',
    actionKey: 'publish.action.manageAutopilot',
  },
}

/**
 * Derive honest publish readiness from campaign + platform state.
 *
 * Logic order (cascading):
 *   1. No generated posts → 'no_content' (locked)
 *   2. Has posts but none approved → 'draft_unapproved' (locked)
 *   3. Approved posts + autopilot on → 'auto_ready'
 *   4. Approved posts + platform ready → 'connected_ready'
 *   5. Approved posts + no platform → 'manual_only'
 *
 * @param input publish readiness input
 */
export function derivePublishReadiness(input: PublishReadinessInput): PublishReadinessResult {
  const {
    hasGeneratedPosts,
    hasApprovedPosts,
    connectedAccountExists,
    platformReady,
    autopilotEnabled,
  } = input

  // Determine state
  let state: PublishLockState

  if (!hasGeneratedPosts) {
    state = 'no_content'
  } else if (!hasApprovedPosts) {
    state = 'draft_unapproved'
  } else if (autopilotEnabled) {
    state = 'auto_ready'
  } else if (platformReady) {
    state = 'connected_ready'
  } else {
    state = 'manual_only'
  }

  const config = REASONS[state]

  return {
    state,
    canPublish: state === 'connected_ready' || state === 'manual_only' || state === 'auto_ready',
    canConnectPublish: state === 'connected_ready' || state === 'auto_ready',
    canAutoPublish: state === 'connected_ready' || state === 'auto_ready',
    reasonEn: config.en,
    reasonAr: config.ar,
    suggestedAction: config.action,
    reasonKey: config.reasonKey,
    actionKey: config.actionKey,
  }
}

/**
 * Derive a secondary lock reason specifically for the SocialPublisher composer.
 * This adds context about WHY connected publishing is locked when an account exists.
 *
 * @param connectedAccountExists whether any account is connected
 * @param platformReady whether any platform is verified ready
 */
export function getConnectedPublishLockReason(
  connectedAccountExists: boolean,
  platformReady: boolean,
): { en: string; ar: string; key: string } | null {
  if (connectedAccountExists && !platformReady) {
    return {
      en: 'Connected publishing is not ready yet. Facebook/Instagram may require Meta App Review of publishing permissions before live posting is enabled.',
      ar: 'النشر المتصل غير جاهز بعد. قد يتطلب Facebook/Instagram مراجعة أذونات التطبيق (Meta App Review) قبل تفعيل النشر المباشر.',
      key: 'publish.lock.connectedNotReady',
    }
  }
  if (!connectedAccountExists) {
    return {
      en: 'Connect a social account on the Connections page to enable publishing.',
      ar: 'اربط حساباً اجتماعياً من صفحة الاتصالات لتفعيل النشر.',
      key: 'publish.lock.noConnectedAccount',
    }
  }
  return null
}

/**
 * Derive autopilot lock reason.
 *
 * @param hasApprovedPosts whether approved posts exist
 * @param platformReady whether any platform is verified ready
 * @param campaignApproved whether campaign status is ACTIVE
 */
export function getAutopilotLockReason(
  hasApprovedPosts: boolean,
  platformReady: boolean,
  campaignApproved: boolean,
): { en: string; ar: string; key: string } | null {
  if (!campaignApproved) {
    return {
      en: 'Auto-publish is locked until the campaign is approved.',
      ar: 'النشر التلقائي مقفل حتى يتم اعتماد الحملة.',
      key: 'publish.lock.autopilotNeedsApproval',
    }
  }
  if (!hasApprovedPosts) {
    return {
      en: 'Auto-publish is locked until content is approved.',
      ar: 'النشر التلقائي مقفل حتى يتم اعتماد المحتوى.',
      key: 'publish.lock.autopilotNeedsContent',
    }
  }
  if (!platformReady) {
    return {
      en: 'Auto-publish is locked until platform permissions are verified and the user enables it.',
      ar: 'النشر التلقائي مقفل حتى يتم التحقق من أذونات المنصة ويقوم المستخدم بتفعيله.',
      key: 'publish.lock.autopilotNeedsPlatform',
    }
  }
  return null
}
