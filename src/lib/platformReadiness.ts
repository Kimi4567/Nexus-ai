/**
 * Platform Readiness — Operator Foundation PR-1A (Platform State Honesty)
 *
 * PURE, READ-ONLY derivation. No network, no I/O, no side effects.
 * Turns the data already returned by GET /api/social/accounts into an honest,
 * conservative per-platform readiness state.
 *
 * Non-negotiable honesty rules (enforced here, asserted in tests):
 *   - "ready" requires provider-specific capability evidence returned by the
 *     server; a generic CONNECTED row is never enough.
 *   - Paid ads is never inferred from a social connection. It depends on AdAccount
 *     readiness, API access, and explicit approval-gated activation routes.
 *   - X readiness requires verified publish, media, readback, and refresh evidence.
 *   - YouTube readiness requires upload, readback, and offline-refresh evidence.
 *   - Google Ads / Snapchat / WhatsApp stay "not_available" until real connectors exist.
 *   - Unknown / missing data → "needs_setup" or "not_connected", NEVER "ready".
 *
 * The function returns i18n KEYS (not literal copy) so the UI renders EN/AR via t().
 */

export type PlatformKey =
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'linkedin'
  | 'x'
  | 'youtube'
  | 'google'
  | 'snapchat'
  | 'whatsapp'
  | 'paid'

export type ReadinessStatus =
  | 'ready'                 // proven publish-capable (Facebook + page only)
  | 'needs_setup'           // connected but a required step is missing
  | 'not_connected'         // no account linked
  | 'permission_unverified' // linked but publish/scope unproven
  | 'planning_only'         // plan/export, no execution (paid)
  | 'not_available'         // no integration exists

export type ReadinessAction =
  | 'connect-meta'
  | 'connect-meta-ads'
  | 'select-page'
  | 'link-instagram'
  | 'connect-tiktok'
  | 'connect-linkedin'
  | 'connect-x'
  | 'connect-youtube'
  | 'open-paid-ads'
  | 'open-connections'
  | 'none'

export interface PlatformState {
  key: PlatformKey
  /** chip status (drives chip label key + tone) */
  status: ReadinessStatus
  /** i18n key for the platform display name, e.g. 'connections.readiness.platform.facebook' */
  nameKey: string
  /** i18n key for the one-line plain-language state */
  lineKey: string
  /** i18n key for the chip label */
  chipKey: string
  /** action the user can take (routes to an existing flow); 'none' = no CTA */
  action: ReadinessAction
  /** i18n key for the action label, or null when action === 'none' */
  actionKey: string | null
  /** visual tone hint for the chip (maps to existing darkened-on-light semantic colors) */
  tone: 'ready' | 'warn' | 'info' | 'planning' | 'muted'
}

/** Minimal shape of an entry from GET /api/social/accounts (tokens already stripped). */
export interface SocialAccount {
  platform?: string | null // 'META' | 'LINKEDIN' | 'TIKTOK' | 'X' | 'YOUTUBE'
  status?: string | null    // 'CONNECTED' | ...
  accountName?: string | null
  pages?: Array<{ id?: string | null; name?: string | null; igAccountId?: string | null }> | null
  capabilities?: {
    facebookPublishing?: boolean
    instagramPublishing?: boolean
    linkedInMemberPublishing?: boolean
    linkedInOrganizationPublishing?: boolean
    tikTokDirectPosting?: boolean
    tikTokCreatorInfoVerified?: boolean
    xPublishing?: boolean
    xMediaPublishing?: boolean
    xReadback?: boolean
    youtubeVideoPublishing?: boolean
    youtubeReadback?: boolean
    tokenRefresh?: boolean
  } | null
}

/** Minimal safe shape from GET /api/ad-accounts (tokens stripped by the route). */
export interface AdAccountReadinessInput {
  platform?: string | null
  status?: string | null
  platformAccountId?: string | null
  pageId?: string | null
  hasApiAccess?: boolean | null
}

const R = 'connections.readiness'
const chipKeyFor: Record<ReadinessStatus, string> = {
  ready: `${R}.chip.ready`,
  needs_setup: `${R}.chip.needsSetup`,
  not_connected: `${R}.chip.notConnected`,
  permission_unverified: `${R}.chip.permissionUnverified`,
  planning_only: `${R}.chip.planningOnly`,
  not_available: `${R}.chip.notAvailable`,
}
const toneFor: Record<ReadinessStatus, PlatformState['tone']> = {
  ready: 'ready',
  needs_setup: 'warn',
  not_connected: 'muted',
  permission_unverified: 'warn',
  planning_only: 'planning',
  not_available: 'muted',
}

function isConnected(a?: SocialAccount | null): boolean {
  return !!a && (a.status == null || a.status === 'CONNECTED')
}

function find(accounts: SocialAccount[], platform: string): SocialAccount | undefined {
  return accounts.find((a) => (a.platform || '').toUpperCase() === platform && isConnected(a))
}

function findActiveAdAccount(accounts: AdAccountReadinessInput[], platform: string): AdAccountReadinessInput | undefined {
  return accounts.find((a) => {
    const status = (a.status || '').toUpperCase()
    return (a.platform || '').toUpperCase() === platform && status !== 'DISCONNECTED' && status !== 'ERROR'
  })
}

function mk(
  key: PlatformKey,
  status: ReadinessStatus,
  lineKey: string,
  action: ReadinessAction,
  actionKey: string | null,
): PlatformState {
  return {
    key,
    status,
    nameKey: `${R}.platform.${key}`,
    lineKey,
    chipKey: chipKeyFor[status],
    action,
    actionKey,
    tone: toneFor[status],
  }
}

/**
 * Derive honest platform readiness from the existing /api/social/accounts payload.
 * @param accounts the `accounts` array from GET /api/social/accounts (may be empty)
 */
export function derivePlatformReadiness(
  accounts: SocialAccount[] | null | undefined,
  adAccounts?: AdAccountReadinessInput[] | null,
): PlatformState[] {
  const list = Array.isArray(accounts) ? accounts : []
  const adList = Array.isArray(adAccounts) ? adAccounts : []
  const meta = find(list, 'META')
  const metaPages = meta?.pages ?? []
  const hasPage = metaPages.some((p) => !!p?.id)
  const hasIg = metaPages.some((p) => !!p?.igAccountId)
  const facebookReady = meta?.capabilities?.facebookPublishing ?? hasPage
  const instagramReady = meta?.capabilities?.instagramPublishing === true
  const tiktok = find(list, 'TIKTOK')
  const linkedin = find(list, 'LINKEDIN')
  const x = find(list, 'X')
  const youtube = find(list, 'YOUTUBE')
  const metaAdAccount = findActiveAdAccount(adList, 'META')

  const out: PlatformState[] = []

  // Facebook
  if (!meta) {
    out.push(mk('facebook', 'not_connected', `${R}.line.facebookNotConnected`, 'connect-meta', `${R}.action.connectMeta`))
  } else if (!hasPage) {
    out.push(mk('facebook', 'needs_setup', `${R}.line.facebookNeedsPage`, 'select-page', `${R}.action.selectPage`))
  } else if (facebookReady) {
    out.push(mk('facebook', 'ready', `${R}.line.facebookReady`, 'open-connections', `${R}.action.reviewSetup`))
  } else {
    out.push(mk('facebook', 'permission_unverified', `${R}.line.facebookUnverified`, 'open-connections', `${R}.action.reviewSetup`))
  }

  // Instagram
  if (!meta) {
    out.push(mk('instagram', 'not_connected', `${R}.line.instagramNotConnected`, 'connect-meta', `${R}.action.connectMeta`))
  } else if (!hasIg) {
    out.push(mk('instagram', 'needs_setup', `${R}.line.instagramNeedsBusiness`, 'link-instagram', `${R}.action.linkInstagram`))
  } else if (instagramReady) {
    out.push(mk('instagram', 'ready', `${R}.line.instagramReady`, 'open-connections', `${R}.action.reviewSetup`))
  } else {
    out.push(mk('instagram', 'permission_unverified', `${R}.line.instagramUnverified`, 'open-connections', `${R}.action.reviewSetup`))
  }

  // TikTok
  if (!tiktok) {
    out.push(mk('tiktok', 'not_connected', `${R}.line.tiktokNotConnected`, 'connect-tiktok', `${R}.action.connectTikTok`))
  } else if (tiktok.capabilities?.tikTokDirectPosting && tiktok.capabilities?.tikTokCreatorInfoVerified) {
    out.push(mk('tiktok', 'ready', `${R}.line.tiktokReady`, 'open-connections', `${R}.action.reviewSetup`))
  } else {
    out.push(mk('tiktok', 'permission_unverified', `${R}.line.tiktokUnverified`, 'open-connections', `${R}.action.reviewSetup`))
  }

  // LinkedIn
  if (!linkedin) {
    out.push(mk('linkedin', 'not_connected', `${R}.line.linkedinNotConnected`, 'connect-linkedin', `${R}.action.connectLinkedIn`))
  } else if (linkedin.capabilities?.linkedInMemberPublishing || linkedin.capabilities?.linkedInOrganizationPublishing) {
    out.push(mk('linkedin', 'ready', `${R}.line.linkedinReady`, 'open-connections', `${R}.action.reviewSetup`))
  } else {
    out.push(mk('linkedin', 'permission_unverified', `${R}.line.linkedinUnverified`, 'open-connections', `${R}.action.reviewSetup`))
  }

  if (!x) {
    out.push(mk('x', 'not_connected', `${R}.line.xNotConnected`, 'connect-x', `${R}.action.connectX`))
  } else if (
    x.capabilities?.xPublishing
    && x.capabilities?.xMediaPublishing
    && x.capabilities?.xReadback
    && x.capabilities?.tokenRefresh
  ) {
    out.push(mk('x', 'ready', `${R}.line.xReady`, 'open-connections', `${R}.action.reviewSetup`))
  } else {
    out.push(mk('x', 'permission_unverified', `${R}.line.xUnverified`, 'open-connections', `${R}.action.reviewSetup`))
  }

  if (!youtube) {
    out.push(mk('youtube', 'not_connected', `${R}.line.youtubeNotConnected`, 'connect-youtube', `${R}.action.connectYouTube`))
  } else if (
    youtube.capabilities?.youtubeVideoPublishing
    && youtube.capabilities?.youtubeReadback
    && youtube.capabilities?.tokenRefresh
  ) {
    out.push(mk('youtube', 'ready', `${R}.line.youtubeReady`, 'open-connections', `${R}.action.reviewSetup`))
  } else {
    out.push(mk('youtube', 'permission_unverified', `${R}.line.youtubeUnverified`, 'open-connections', `${R}.action.reviewSetup`))
  }

  // Not available yet — no integration code exists; NO connect CTA.
  out.push(mk('google', 'not_available', `${R}.line.googleNotAvailable`, 'none', null))
  out.push(mk('snapchat', 'not_available', `${R}.line.snapchatNotAvailable`, 'none', null))
  out.push(mk('whatsapp', 'not_available', `${R}.line.whatsappNotAvailable`, 'none', null))

  // Paid ads — Meta-first execution, approval-gated. A social Meta connection
  // does NOT imply paid execution readiness.
  if (!metaAdAccount) {
    out.push(mk('paid', 'not_connected', `${R}.line.paidMetaAdAccountNotConnected`, 'connect-meta-ads', `${R}.action.connectMetaAds`))
  } else if (!metaAdAccount.pageId) {
    out.push(mk('paid', 'needs_setup', `${R}.line.paidNeedsPageIdentity`, 'open-paid-ads', `${R}.action.openPaidAds`))
  } else if (metaAdAccount.hasApiAccess !== true) {
    out.push(mk('paid', 'permission_unverified', `${R}.line.paidNeedsApiAccess`, 'open-paid-ads', `${R}.action.openPaidAds`))
  } else if (typeof metaAdAccount.platformAccountId === 'string' && metaAdAccount.platformAccountId.trim()) {
    out.push(mk('paid', 'ready', `${R}.line.paidMetaReady`, 'open-paid-ads', `${R}.action.openPaidAds`))
  } else {
    out.push(mk('paid', 'needs_setup', `${R}.line.paidNeedsAdAccount`, 'connect-meta-ads', `${R}.action.connectMetaAds`))
  }

  return out
}

/** Compact summary for the dashboard strip (subset + short chips). */
export function summarizeForStrip(states: PlatformState[]): PlatformState[] {
  const order: PlatformKey[] = ['facebook', 'instagram', 'tiktok', 'linkedin', 'x', 'youtube', 'paid']
  return order
    .map((k) => states.find((s) => s.key === k))
    .filter((s): s is PlatformState => !!s)
}
