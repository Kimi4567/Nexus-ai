/**
 * Versioned social-provider configuration.
 *
 * Keep provider versions in one place so OAuth, publishing, analytics, and
 * token maintenance cannot silently drift onto different API generations.
 * Environment overrides make upgrades testable in Preview before Production.
 */

export const META_GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v25.0'
export const LINKEDIN_API_VERSION = process.env.LINKEDIN_API_VERSION || '202606'

export const META_ORGANIC_SCOPES = [
  'public_profile',
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_content_publish',
] as const

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
 * Requested now so the complete Company Page workflow can be demonstrated in
 * Development tier and submitted for Community Management review later.
 */
export const LINKEDIN_ORGANIZATION_SCOPES = [
  'r_organization_admin',
  'r_organization_social',
  'w_organization_social',
] as const

export const TIKTOK_CONTENT_SCOPES = [
  'user.info.basic',
  'video.publish',
  'video.list',
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
