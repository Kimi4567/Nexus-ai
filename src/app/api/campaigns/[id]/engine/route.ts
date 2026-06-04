import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import { aiRateLimitDb } from '@/lib/dbRateLimit'
import { checkAndDeductCredits } from '@/lib/credits'
import { deriveCampaignEngineState, runCampaignEngine } from '@/lib/campaign-engine'

type Params = { params: { id: string } }

export async function GET(req: NextRequest, { params }: Params) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const campaign = await prisma.campaign.findFirst({
    where: { id: params.id, workspace: { ownerId: userId } },
  })
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  return NextResponse.json({ engine: deriveCampaignEngineState(campaign) })
}

export async function POST(req: NextRequest, { params }: Params) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await aiRateLimitDb(userId)
  if (!rl.ok) return NextResponse.json({ error: rl.message }, { status: 429 })

  const body = await req.json().catch(() => ({}))
  const force = body.force === true
  const language = body.language || 'ar'

  const credit = await checkAndDeductCredits(userId, 'RUN_FULL_STRATEGY')
  if (!credit.ok) return NextResponse.json(credit, { status: 402 })

  try {
    const result = await runCampaignEngine({
      userId,
      campaignId: params.id,
      language,
      force,
    })

    return NextResponse.json({
      campaign: result.campaign,
      engine: result.engine,
      creditsRemaining: credit.creditsRemaining,
      creditsUsed: credit.creditsUsed,
    })
  } catch (err: any) {
    console.error('[campaign-engine POST]', err)
    return NextResponse.json({ error: err?.message || 'NEXUS Engine failed' }, { status: 500 })
  }
}
