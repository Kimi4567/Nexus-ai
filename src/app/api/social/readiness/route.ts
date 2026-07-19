import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabaseAuth'
import { isOAuthStateConfigured } from '@/lib/oauthState'
import {
  getMetaOrganicScopes,
  LINKEDIN_MEMBER_SCOPES,
  LINKEDIN_ORGANIZATION_SCOPES,
  META_INSTAGRAM_SCOPES,
  TIKTOK_CONTENT_SCOPES,
} from '@/lib/socialPlatformConfig'

export const dynamic = 'force-dynamic'

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
}

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error } = await adminClient.auth.getUser(token)
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const baseUrl = appBaseUrl()
  const instagramScopesEnabled = process.env.META_ENABLE_INSTAGRAM_SCOPES === 'true'
  const linkedInOrganizationEnabled = process.env.LINKEDIN_ORGANIZATION_PUBLISHING_ENABLED === 'true'
  const secureStateConfigured = isOAuthStateConfigured()

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    providers: [
      {
        platform: 'META',
        credentialsConfigured: Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET && secureStateConfigured),
        callbackUrl: `${baseUrl}/api/social/callback/meta`,
        requestedScopes: getMetaOrganicScopes(instagramScopesEnabled),
        deferredScopes: instagramScopesEnabled ? [] : [...META_INSTAGRAM_SCOPES],
        testBoundary: instagramScopesEnabled
          ? 'Provider-granted Page and Instagram capabilities are verified separately.'
          : 'Facebook Page testing is enabled; Instagram publishing scopes remain deferred until the review path is ready.',
        publicAccess: 'PROVIDER_REVIEW_REQUIRED',
      },
      {
        platform: 'LINKEDIN',
        credentialsConfigured: Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET && secureStateConfigured),
        callbackUrl: `${baseUrl}/api/social/callback/linkedin`,
        requestedScopes: [
          ...LINKEDIN_MEMBER_SCOPES,
          ...(linkedInOrganizationEnabled ? LINKEDIN_ORGANIZATION_SCOPES : []),
        ],
        deferredScopes: linkedInOrganizationEnabled ? [] : [...LINKEDIN_ORGANIZATION_SCOPES],
        testBoundary: linkedInOrganizationEnabled
          ? 'Member and approved Company Page capabilities are verified independently.'
          : 'Member OAuth is enabled; Company Page scopes remain deferred until Community Management access is available.',
        publicAccess: 'PROVIDER_PRODUCT_ACCESS_REQUIRED',
      },
      {
        platform: 'TIKTOK',
        credentialsConfigured: Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET && secureStateConfigured),
        callbackUrl: `${baseUrl}/api/social/callback/tiktok`,
        requestedScopes: [...TIKTOK_CONTENT_SCOPES],
        deferredScopes: [],
        testBoundary: 'Unaudited Direct Post testing is limited by TikTok; public visibility remains locked until audit approval.',
        publicAccess: 'PROVIDER_AUDIT_REQUIRED',
      },
    ],
  })
}
