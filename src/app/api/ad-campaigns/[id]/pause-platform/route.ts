import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/apiAuth'
import { createMetaAdsApi } from '@/lib/adPlatforms/metaAdsApi'
import { createGoogleAdsApi } from '@/lib/adPlatforms/googleAdsApi'

export const maxDuration = 30

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json().catch(() => ({}))
    if (body.explicitPlatformPauseConfirmed !== true) {
      return NextResponse.json({
        error: 'Pausing a live platform campaign requires explicit confirmation. No platform action was taken.',
        mode: 'pause_blocked',
      }, { status: 400 })
    }

    const campaign = await db.adCampaign.findFirst({
      where: { id: params.id, workspace: { ownerId: user.id } },
      include: { adAccount: true, adSets: { include: { ads: true } } },
    })
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    if (!['META', 'GOOGLE'].includes(campaign.platform)) {
      return NextResponse.json({
        error: `${campaign.platform} platform pause is not implemented. No platform action was taken.`,
        mode: 'unsupported_platform',
      }, { status: 400 })
    }
    if (campaign.status !== 'ACTIVE' || !campaign.platformCampaignId) {
      return NextResponse.json({
        error: 'Only a platform-active campaign with a verified platform ID can be paused.',
        mode: 'pause_blocked',
      }, { status: 409 })
    }
    const account = campaign.adAccount
    if (!account?.hasApiAccess || !account.accessToken || !account.platformAccountId) {
      return NextResponse.json({
        error: 'Connected platform credentials and verified API access are required. No platform action was taken.',
        mode: 'pause_blocked',
      }, { status: 409 })
    }
    const adSetResourceNames = campaign.adSets.map((adSet: Record<string, unknown>) => String(adSet.platformAdSetId || '')).filter(Boolean)
    const adResourceNames = campaign.adSets.flatMap((adSet: { ads?: Array<Record<string, unknown>> }) => (
      (adSet.ads || []).map(ad => String(ad.platformAdId || '')).filter(Boolean)
    ))

    const childPauseErrors: string[] = []
    if (campaign.platform === 'GOOGLE') {
      if (!account.refreshToken) {
        return NextResponse.json({ error: 'Google Ads refresh token is missing. Reconnect before pausing.' }, { status: 409 })
      }
      const api = createGoogleAdsApi({
        customerId: String(account.platformAccountId),
        loginCustomerId: account.loginCustomerId,
        encryptedAccessToken: account.accessToken,
        encryptedRefreshToken: account.refreshToken,
      })
      await api.pauseSearchCampaign({
        campaignResourceName: String(campaign.platformCampaignId),
        adGroupResourceNames: adSetResourceNames,
        adResourceNames,
      })
    } else {
      const api = createMetaAdsApi(String(account.accessToken), String(account.platformAccountId))
      // Stop campaign delivery first. Child updates preserve a fully paused review state.
      await api.updateCampaignStatus(String(campaign.platformCampaignId), 'PAUSED')
      for (const id of adSetResourceNames) {
        try { await api.updateObjectStatus(id, 'PAUSED') }
        catch (error) { childPauseErrors.push(error instanceof Error ? error.message : String(error)) }
      }
      for (const id of adResourceNames) {
        try { await api.updateObjectStatus(id, 'PAUSED') }
        catch (error) { childPauseErrors.push(error instanceof Error ? error.message : String(error)) }
      }
    }

    await db.$transaction(async (tx: any) => {
      await tx.adCampaign.update({
        where: { id: campaign.id },
        data: { status: 'PAUSED', platformStatus: 'PAUSED', lastSyncError: null },
      })
      await tx.adSet.updateMany({
        where: { adCampaignId: campaign.id },
        data: { status: 'PAUSED' },
      })
      await tx.ad.updateMany({
        where: { adSetId: { in: campaign.adSets.map((adSet: { id: string }) => adSet.id) } },
        data: { status: 'PAUSED' },
      })
    })

    return NextResponse.json({
      success: true,
      partial: childPauseErrors.length > 0,
      childPauseErrors,
      mode: 'platform_pause',
      platform: campaign.platform,
      note: childPauseErrors.length > 0
        ? 'The campaign-level platform object is paused, which stops delivery. Some child status updates need reconciliation.'
        : 'The connected platform campaign and its child delivery objects are paused. New paid delivery should stop subject to provider reporting latency.',
    })
  } catch (error) {
    console.error('[pause-platform]', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Platform pause failed',
      mode: 'platform_pause_failed',
    }, { status: 502 })
  }
}
