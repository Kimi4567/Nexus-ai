/**
 * GET /api/social/connect/meta-ads
 *
 * Initiates Meta OAuth with ads_management + ads_read + business_management
 * scopes. This is SEPARATE from the organic Meta connection (/connect/meta)
 * which requests Facebook Page/organic publishing scopes.
 *
 * When approved (requires Meta App Review + Business Verification):
 *   - ads_management        → create/edit/delete campaigns, ad sets, ads
 *   - ads_read              → read campaign + ad performance metrics
 *   - business_management   → access Business Manager + ad accounts
 *
 * During development (before App Review), the token will only work for
 * test ad accounts (developer + tester roles in the Meta app).
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabaseAuth'
import { createOAuthState } from '@/lib/oauthState'
import { META_ADS_SCOPES, META_GRAPH_VERSION } from '@/lib/socialPlatformConfig'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await adminClient.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const appId = process.env.META_APP_ID
    if (!appId) return NextResponse.json({ error: 'Meta App ID not configured' }, { status: 500 })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const redirectUri = `${baseUrl}/api/social/callback/meta-ads`

    const state = createOAuthState(user.id, 'meta_ads')

    // Ads-specific scopes (separate from organic publishing scopes)
    // NOTE: ads_management + business_management require Meta App Review.
    // Without approval, only developer-role test accounts can use this.
    const scopes = META_ADS_SCOPES.join(',')

    const metaOAuthUrl =
      `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth` +
      `?client_id=${appId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&state=${state}` +
      `&response_type=code`

    return NextResponse.json({ url: metaOAuthUrl })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[Meta Ads Connect] Error:', message)
    return NextResponse.json({ error: 'Failed to initiate Meta Ads OAuth' }, { status: 500 })
  }
}
