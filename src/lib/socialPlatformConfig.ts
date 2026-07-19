/**
 * Versioned social-provider configuration.
 *
 * Keep provider versions in one place so OAuth, publishing, analytics, and
 * token maintenance cannot silently drift onto different API generations.
 * Environment overrides make upgrades testable in Preview before Production.
 */

export const META_GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v25.0'
export const LINKEDIN_API_VERSION = process.env.LINKEDIN_API_VERSION || '202606'

export const META_FACEBOOK_ORGANIC_SCOPES = [
  'public_profile',
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
] as const

export const META_INSTAGRAM_SCOPES = [
  'instagram_basic',
  'instagram_content_publish',
] as const

/** Keep the first Facebook review flow least-privilege. */
export function getMetaOrganicScopes(instagramEnabled = process.env.META_ENABLE_INSTAGRAM_SCOPES === 'true'): string[] {
  return instagramEnabled
    ? [...META_FACEBOOK_ORGANIC_SCOPES, ...META_INSTAGRAM_SCOPES]
    : [...META_FACEBOOK_ORGANIC_SCOPES]
}

export const META_ADS_SCOPES = [
  'public_profile',
  'ads_management',
  'ads_read',
  'business_management',
] as const

export const LINKEDIN_MEMBER_SCOPES = [
  'openid',
  'profile',
  'email',
  'w_member_social',
] as const

/**
 * Product-gated Company Page scopes. They are deliberately excluded from the
 * default member flow until Community Management access is available; asking
 * for unavailable scopes would break an otherwise valid OAuth connection.
 */
export const LINKEDIN_ORGANIZATION_SCOPES = [
  'r_organization_admin',
  'r_organization_social',
  'w_organization_social',
] as const

export const TIKTOK_CONTENT_SCOPES = [
  'user.info.basic',
  'video.publish',
] as const

export const YOUTUBE_CONTENT_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
] as const

export const X_CONTENT_SCOPES = [
  'tweet.read',
  'tweet.write',
  'users.read',
  'media.write',
  'offline.access',
] as const

/**
 * Pinterest's create-Pin endpoint currently declares all four board/Pin
 * scopes. user_accounts:read is used during OAuth to bind the token to the
 * exact account shown in NEXUS.
 */
export const PINTEREST_CONTENT_SCOPES = [
  'boards:read',
  'boards:write',
  'pins:read',
  'pins:write',
  'user_accounts:read',
] as const

/**
 * Keep the requested Threads surface deliberately small: identity, organic
 * publishing, and first-party insight readback. Reply moderation, discovery,
 * location, and deletion are separate product capabilities and are not
 * requested until NEXUS actually exposes them.
 */
export const THREADS_CONTENT_SCOPES = [
  'threads_basic',
  'threads_content_publish',
  'threads_manage_insights',
] as const

export function threadsApiUrl(path: string): string {
  return `https://graph.threads.net/${path.replace(/^\//, '')}`
}

export function pinterestApiUrl(path: string): string {
  return `https://api.pinterest.com/v5/${path.replace(/^\//, '')}`
}

export function metaGraphUrl(path: string): string {
  return `https://graph.facebook.com/${META_GRAPH_VERSION}/${path.replace(/^\//, '')}`
}

export function linkedInHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'Linkedin-Version': LINKEDIN_API_VERSION,
    'X-Restli-Protocol-Version': '2.0.0',
  }
}

export function hasVerifiedProviderScope(config: unknown, scope: string): boolean {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return false
  const record = config as Record<string, unknown>
  return record.scopeEvidence === 'provider_response'
    && Array.isArray(record.scopes)
    && record.scopes.includes(scope)
}
