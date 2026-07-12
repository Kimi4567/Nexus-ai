/**
 * GET  /api/ad-campaigns  — List all paid ad campaigns for the workspace
 * POST /api/ad-campaigns  — Create a new paid ad campaign
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/apiAuth'
import {
  buildTrackedPaidDestinationUrl,
  normalizePaidDestinationUrl,
} from '@/lib/paidExecutionReadiness'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspace = await prisma.workspace.findFirst({ where: { ownerId: user.id } })
    if (!workspace) return NextResponse.json({ campaigns: [] })

    const campaigns = await db.adCampaign.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: 'desc' },
      include: {
        adAccount: {
          select: {
            id: true,
            platform: true,
            platformAccountName: true,
            currency: true,
            status: true,
          },
        },
        adSets: {
          select: { id: true, name: true, status: true, totalSpend: true },
        },
        _count: {
          select: { adSets: true },
        },
      },
    })

    return NextResponse.json({ campaigns })
  } catch (err) {
    console.error('[ad-campaigns GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspace = await prisma.workspace.findFirst({ where: { ownerId: user.id } })
    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

    const body = await req.json()
    const {
      name,
      platform,
      adAccountId,
      organicCampaignId,
      objective,
      budgetType = 'DAILY',
      dailyBudget,
      lifetimeBudget,
      currency = 'USD',
      startDate,
      endDate,
      utmCampaign,
      utmMedium,
      destinationUrl,
      isAbTest = false,
    } = body

    if (!name || !platform) {
      return NextResponse.json({ error: 'name and platform are required' }, { status: 400 })
    }

    const baseDestinationUrl = normalizePaidDestinationUrl(destinationUrl)
    if (!baseDestinationUrl) {
      return NextResponse.json({
        error: 'A public HTTPS conversion destination is required. Placeholder, local, and non-HTTPS URLs are not allowed.',
        code: 'INVALID_PAID_DESTINATION',
      }, { status: 400 })
    }

    const campaignSlug = typeof utmCampaign === 'string' && utmCampaign.trim()
      ? utmCampaign.trim()
      : name
    const trackedDestinationUrl = buildTrackedPaidDestinationUrl({
      destinationUrl: baseDestinationUrl,
      platform,
      campaignSlug,
    })
    if (!trackedDestinationUrl) {
      return NextResponse.json({ error: 'Could not create a tracked conversion destination.' }, { status: 400 })
    }
    const trackedUrl = new URL(trackedDestinationUrl)

    // Validate ad account belongs to this workspace if provided
    if (adAccountId) {
      const account = await db.adAccount.findFirst({
        where: { id: adAccountId, workspaceId: workspace.id },
      })
      if (!account) {
        return NextResponse.json({ error: 'Ad account not found' }, { status: 404 })
      }
    }

    const campaign = await db.adCampaign.create({
      data: {
        workspaceId: workspace.id,
        adAccountId: adAccountId || null,
        organicCampaignId: organicCampaignId || null,
        platform,
        name,
        objective: objective || 'TRAFFIC',
        status: 'DRAFT',
        budgetType,
        dailyBudget: dailyBudget ? parseFloat(dailyBudget) : null,
        lifetimeBudget: lifetimeBudget ? parseFloat(lifetimeBudget) : null,
        currency,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        utmSource: trackedUrl.searchParams.get('utm_source'),
        utmCampaign: trackedUrl.searchParams.get('utm_campaign'),
        utmMedium: utmMedium || trackedUrl.searchParams.get('utm_medium') || 'paid_social',
        trackingUrls: {
          baseDestinationUrl,
          [String(platform).toLowerCase()]: trackedDestinationUrl,
        },
        isAbTest,
      },
      include: {
        adAccount: {
          select: { id: true, platform: true, platformAccountName: true, currency: true },
        },
      },
    })

    return NextResponse.json({ campaign }, { status: 201 })
  } catch (err) {
    console.error('[ad-campaigns POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
