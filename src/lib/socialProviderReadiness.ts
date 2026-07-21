import {
  getMetaOrganicScopes,
  LINKEDIN_MEMBER_SCOPES,
  LINKEDIN_ORGANIZATION_SCOPES,
  META_INSTAGRAM_SCOPES,
  PINTEREST_CONTENT_SCOPES,
  THREADS_CONTENT_SCOPES,
  TIKTOK_CONTENT_SCOPES,
  X_CONTENT_SCOPES,
  YOUTUBE_CONTENT_SCOPES,
} from '@/lib/socialPlatformConfig'

export type SocialProviderReadinessPlatform =
  | 'META'
  | 'LINKEDIN'
  | 'TIKTOK'
  | 'YOUTUBE'
  | 'X'
  | 'PINTEREST'
  | 'THREADS'

export type ProviderPublicAccessBoundary =
  | 'PROVIDER_REVIEW_REQUIRED'
  | 'PROVIDER_PRODUCT_ACCESS_REQUIRED'
  | 'PROVIDER_AUDIT_REQUIRED'
  | 'PROVIDER_PLAN_AND_APP_ACCESS_REQUIRED'
  | 'PROVIDER_STANDARD_ACCESS_REQUIRED'
  | 'PROVIDER_LIVE_ACCESS_REQUIRED'

export interface SocialProviderReadiness {
  platform: SocialProviderReadinessPlatform
  credentialsConfigured: boolean
  callbackUrl: string
  requestedScopes: string[]
  deferredScopes: string[]
  testBoundary: string
  publicAccess: ProviderPublicAccessBoundary
  proofState: 'configuration_only'
}

type ReadinessEnvironment = Record<string, string | undefined>

function hasAll(environment: ReadinessEnvironment, keys: string[]): boolean {
  return keys.every(key => Boolean(environment[key]?.trim()))
}

/**
 * Describes only NEXUS-side OAuth configuration. It intentionally cannot return
 * provider approval or publishing readiness; those require a connected account,
 * provider-returned scope evidence, a publish ID, and readback.
 */
export function buildSocialProviderReadiness(input: {
  baseUrl: string
  secureStateConfigured: boolean
  environment?: ReadinessEnvironment
}): SocialProviderReadiness[] {
  const environment = input.environment ?? process.env
  const baseUrl = input.baseUrl.replace(/\/$/, '')
  const instagramScopesEnabled = environment.META_ENABLE_INSTAGRAM_SCOPES === 'true'
  const linkedInOrganizationEnabled = environment.LINKEDIN_ORGANIZATION_PUBLISHING_ENABLED === 'true'
  const configured = (keys: string[]) => input.secureStateConfigured && hasAll(environment, keys)

  return [
    {
      platform: 'META',
      credentialsConfigured: configured(['META_APP_ID', 'META_APP_SECRET']),
      callbackUrl: `${baseUrl}/api/social/callback/meta`,
      requestedScopes: getMetaOrganicScopes(instagramScopesEnabled),
      deferredScopes: instagramScopesEnabled ? [] : [...META_INSTAGRAM_SCOPES],
      testBoundary: instagramScopesEnabled
        ? 'Provider-granted Facebook Page and professional Instagram capabilities must still be verified separately.'
        : 'Facebook Page testing is enabled; Instagram publishing scopes remain deferred until its review path is ready.',
      publicAccess: 'PROVIDER_REVIEW_REQUIRED',
      proofState: 'configuration_only',
    },
    {
      platform: 'LINKEDIN',
      credentialsConfigured: configured(['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET']),
      callbackUrl: `${baseUrl}/api/social/callback/linkedin`,
      requestedScopes: [
        ...LINKEDIN_MEMBER_SCOPES,
        ...(linkedInOrganizationEnabled ? LINKEDIN_ORGANIZATION_SCOPES : []),
      ],
      deferredScopes: linkedInOrganizationEnabled ? [] : [...LINKEDIN_ORGANIZATION_SCOPES],
      testBoundary: linkedInOrganizationEnabled
        ? 'Member and provider-approved Company Page capabilities must be verified independently.'
        : 'Member OAuth is enabled; Company Page scopes remain deferred until Community Management access is available.',
      publicAccess: 'PROVIDER_PRODUCT_ACCESS_REQUIRED',
      proofState: 'configuration_only',
    },
    {
      platform: 'TIKTOK',
      credentialsConfigured: configured(['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET']),
      callbackUrl: `${baseUrl}/api/social/callback/tiktok`,
      requestedScopes: [...TIKTOK_CONTENT_SCOPES],
      deferredScopes: [],
      testBoundary: 'Unaudited Direct Post testing remains provider-limited; public visibility is not treated as available before audit evidence.',
      publicAccess: 'PROVIDER_AUDIT_REQUIRED',
      proofState: 'configuration_only',
    },
    {
      platform: 'YOUTUBE',
      credentialsConfigured: configured(['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']),
      callbackUrl: `${baseUrl}/api/social/callback/youtube`,
      requestedScopes: [...YOUTUBE_CONTENT_SCOPES],
      deferredScopes: [],
      testBoundary: 'OAuth and private upload testing do not prove public distribution; upload, processing readback, refresh, and API-project audit evidence remain required.',
      publicAccess: 'PROVIDER_AUDIT_REQUIRED',
      proofState: 'configuration_only',
    },
    {
      platform: 'X',
      credentialsConfigured: configured(['X_CLIENT_ID', 'X_CLIENT_SECRET']),
      callbackUrl: `${baseUrl}/api/social/callback/x`,
      requestedScopes: [...X_CONTENT_SCOPES],
      deferredScopes: [],
      testBoundary: 'OAuth configuration does not prove plan access; write, media, readback, refresh, provider ID, and account access must all be verified.',
      publicAccess: 'PROVIDER_PLAN_AND_APP_ACCESS_REQUIRED',
      proofState: 'configuration_only',
    },
    {
      platform: 'PINTEREST',
      credentialsConfigured: configured(['PINTEREST_APP_ID', 'PINTEREST_APP_SECRET']),
      callbackUrl: `${baseUrl}/api/social/callback/pinterest`,
      requestedScopes: [...PINTEREST_CONTENT_SCOPES],
      deferredScopes: [],
      testBoundary: 'Trial access is not public publishing proof; Standard access, Board selection, refresh, provider Pin ID, and readback remain required.',
      publicAccess: 'PROVIDER_STANDARD_ACCESS_REQUIRED',
      proofState: 'configuration_only',
    },
    {
      platform: 'THREADS',
      credentialsConfigured: configured(['THREADS_APP_ID', 'THREADS_APP_SECRET']),
      callbackUrl: `${baseUrl}/api/social/callback/threads`,
      requestedScopes: [...THREADS_CONTENT_SCOPES],
      deferredScopes: [],
      testBoundary: 'Development access is not public publishing proof; Live access, refresh, provider post ID, and insight readback remain required.',
      publicAccess: 'PROVIDER_LIVE_ACCESS_REQUIRED',
      proofState: 'configuration_only',
    },
  ]
}
