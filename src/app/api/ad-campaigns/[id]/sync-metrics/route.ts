/**
 * POST /api/ad-campaigns/[id]/sync-metrics
 *
 * Pulls performance data from Meta Insights API (when hasApiAccess = true)
 * and saves daily snapshots to AdPerformanceSnapshot table.
 * Also recalculates the campaign's aggregate metrics.
 *
 * When hasApiAccess = false: manual daily entry mode.
 *
 * GET /api/ad-campaigns/[id]/sync-metrics
 * Returns the last 30 performance snapshots for chart display.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/apiAuth'
import { createMetaAdsApi } from '@/lib/adPlatforms/metaAdsApi'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const campaign = await db.adCampaign.findFirst({
      where: { id: params.id, workspace: { ownerId: user.id } },
      select: { id: true, currency: true },
    })
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Campaign-level snapshots only (adSetId=null, adId=null), ordered by date
    const snapshots = await db.adPerformanceSnapshot.findMany({
      where: {
        adCampaignId: params.id,
        adSetId: null,
        adId: null,
      },
      orderBy: { date: 'asc' },
      take: 30,
    })

    return NextResponse.json({ snapshots, currency: campaign.currency })
  } catch (err) {
    console.error('[sync-metrics GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const campaign = await db.adCampaign.findFirst({
      where: { id: params.id, workspace: { ownerId: user.id } },
      include: { adAccount: true },
    })
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    const adAccount = campaign.adAccount

    // ── Manual entry mode (no API access or no platform ID) ───────────────
    if (!adAccount || !adAccount.hasApiAccess || !campaign.platformCampaignId) {
      const body = await req.json().catch(() => ({}))
      const { date, spend, impressions, clicks, conversions, roas } = body

      if (!date || spend === undefined) {
        return NextResponse.json({
          error: 'date and spend are required for manual entry',
          mode: 'manual',
        }, { status: 400 })
      }

      const dateObj = new Date(date)

      // Find-then-update or create (handles nullable unique constraint)
      const existing = await db.adPerformanceSnapshot.findFirst({
        where: {
          adCampaignId: params.id,
          adSetId: null,
          adId: null,
          date: dateObj,
        },
      })

      const data = {
        spend: parseFloat(spend) || 0,
        impressions: parseInt(impressions) || 0,
        clicks: parseInt(clicks) || 0,
        conversions: parseInt(conversions) || 0,
        roas: parseFloat(roas) || 0,
        dataSource: 'manual',
        syncedAt: new Date(),
      }

      let snap
      if (existing) {
        snap = await db.adPerformanceSnapshot.update({ where: { id: existing.id }, data })
      } else {
        snap = await db.adPerformanceSnapshot.create({
          data: {
            adCampaignId: params.id,
            adSetId: null,
            adId: null,
            date: dateObj,
            ...data,
          },
        })
      }

      await recalcAggregates(params.id)

      return NextResponse.json({
        mode: 'manual',
        snapshot: snap,
        message: 'Manual paid metrics signal recorded for review. This is not analytics-backed learning.',
      })
    }

    // ── Live sync via Meta Insights API ────────────────────────────────────
    const api = createMetaAdsApi(
      String(adAccount.accessToken),
      String(adAccount.platformAccountId)
    )

    const insights = await api.getCampaignInsights(campaign.platformCampaignId, 'last_30d')

    if (!insights || insights.length === 0) {
      return NextResponse.json({
        mode: 'live',
        message: 'No platform insights data yet — review platform delivery and tracking before treating metrics as analytics-backed.',
        synced: 0,
      })
    }

    let synced = 0
    for (const row of insights) {
      const date = new Date(row.date_start)
      const spend = parseFloat(row.spend || '0')
      const impressions = parseInt(row.impressions || '0')
      const clicks = parseInt(row.clicks || '0')
      const ctr = parseFloat(row.ctr || '0')
      const cpc = parseFloat(row.cpc || '0')

      const convActions = (row.actions || []).filter((a: { action_type: string; value: string }) =>
        a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase'
      )
      const conversions = Math.round(
        convActions.reduce((s: number, a: { action_type: string; value: string }) => s + parseFloat(a.value || '0'), 0)
      )

      const roasArr = row.purchase_roas || []
      const roas = roasArr.length > 0 ? parseFloat(roasArr[0].value || '0') : 0

      const existing = await db.adPerformanceSnapshot.findFirst({
        where: { adCampaignId: params.id, adSetId: null, adId: null, date },
      })

      const data = {
        spend, impressions, clicks, conversions, ctr, cpc, roas,
        dataSource: 'api', syncedAt: new Date(),
      }

      if (existing) {
        await db.adPerformanceSnapshot.update({ where: { id: existing.id }, data })
      } else {
        await db.adPerformanceSnapshot.create({
          data: {
            adCampaignId: params.id,
            adSetId: null,
            adId: null,
            date,
            ...data,
          },
        })
      }
      synced++
    }

    await recalcAggregates(params.id)

    return NextResponse.json({
      mode: 'live',
      synced,
      message: `Synced ${synced} days of performance data from Meta.`,
    })
  } catch (err) {
    console.error('[sync-metrics POST]', err)
    const message = err instanceof Error ? err.message : 'Sync failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ── Recalculate campaign aggregate metrics from all campaign-level snapshots ─
async function recalcAggregates(campaignId: string) {
  const snaps = await db.adPerformanceSnapshot.findMany({
    where: { adCampaignId: campaignId, adSetId: null, adId: null },
  })
  if (snaps.length === 0) return

  const totalSpend = snaps.reduce((s: number, r: { spend: number }) => s + (r.spend || 0), 0)
  const totalImpressions = snaps.reduce((s: number, r: { impressions: number }) => s + (r.impressions || 0), 0)
  const totalClicks = snaps.reduce((s: number, r: { clicks: number }) => s + (r.clicks || 0), 0)
  const totalConversions = snaps.reduce((s: number, r: { conversions: number }) => s + (r.conversions || 0), 0)
  const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
  const avgCPC = totalClicks > 0 ? totalSpend / totalClicks : 0

  const roasSnaps = snaps.filter((r: { roas: number | null }) => (r.roas || 0) > 0)
  const avgROAS = roasSnaps.length > 0
    ? roasSnaps.reduce((s: number, r: { roas: number }) => s + r.roas, 0) / roasSnaps.length
    : 0

  await db.adCampaign.update({
    where: { id: campaignId },
    data: { totalSpend, totalImpressions, totalClicks, totalConversions, avgCTR, avgCPC, avgROAS },
  })
}
