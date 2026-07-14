import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { inspectPaidStrategySource } from '@/lib/paidStrategySource'
import { decisionEvent, sourceSelect } from '@/lib/paidStrategySourceServer'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const campaigns = await prisma.campaign.findMany({
    where: { workspace: { ownerId: user.id } },
    orderBy: { updatedAt: 'desc' },
    select: sourceSelect,
  })
  if (campaigns.length === 0) return NextResponse.json({ sources: [] })

  const decisions = await prisma.marketingLearningEvent.findMany({
    where: {
      campaignId: { in: campaigns.map(campaign => campaign.id) },
      eventType: { in: ['STRATEGY_APPROVED', 'STRATEGY_APPROVAL_REVOKED'] },
    },
    orderBy: { createdAt: 'desc' },
    select: { campaignId: true, eventType: true, createdAt: true, source: true },
  })
  const latestByCampaign = new Map<string, typeof decisions[number]>()
  decisions.forEach(decision => {
    if (decision.campaignId && !latestByCampaign.has(decision.campaignId)) {
      latestByCampaign.set(decision.campaignId, decision)
    }
  })

  return NextResponse.json({
    sources: campaigns.map(campaign => inspectPaidStrategySource(
      campaign,
      decisionEvent(latestByCampaign.get(campaign.id) ?? null),
    )),
  })
}
