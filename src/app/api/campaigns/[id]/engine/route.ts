import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import { aiRateLimitDb } from '@/lib/dbRateLimit'
import { checkAndDeductCredits, refundCredits } from '@/lib/credits'
import { deriveCampaignEngineState, runCampaignEngine } from '@/lib/campaign-engine'
import { getBrandBrainReadiness } from '@/lib/brandReadiness'

// Strategy generation makes two GPT-4o-mini calls; give the function headroom so
// a slower-but-valid Arabic response completes instead of being killed mid-run.
export const maxDuration = 60

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, props: Params) {
  const params = await props.params;
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const campaign = await prisma.campaign.findFirst({
    where: { id: params.id, workspace: { ownerId: userId } },
  })
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  return NextResponse.json({ engine: deriveCampaignEngineState(campaign) })
}

export async function POST(req: NextRequest, props: Params) {
  const params = await props.params;
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await aiRateLimitDb(userId)
  if (!rl.ok) return NextResponse.json({ error: rl.message }, { status: 429 })

  const body = await req.json().catch(() => ({}))
  const force = body.force === true
  const language = body.language || 'ar'

  const campaign = await prisma.campaign.findFirst({
    where: { id: params.id, workspace: { ownerId: userId } },
    include: {
      workspace: {
        include: {
          brandProfile: true,
        },
      },
    },
  })

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  const brandProfile = campaign.workspace?.brandProfile
  if (!brandProfile) {
    return NextResponse.json(
      {
        error: 'NO_BRAND_PROFILE',
        message: 'Brand Brain not set up. Please complete your brand profile first.',
        redirectUrl: '/brand',
      },
      { status: 422 },
    )
  }

  const readiness = getBrandBrainReadiness(brandProfile as any)
  if (!readiness.ready) {
    return NextResponse.json(
      {
        error: 'BRAND_BRAIN_INCOMPLETE',
        message: `Brand Brain is missing required fields: ${readiness.missingRequired.join(', ')}.`,
        missingRequired: readiness.missingRequired,
        score: readiness.score,
        redirectUrl: '/brand',
      },
      { status: 422 },
    )
  }

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
    // Refund — a failed engine run must not charge the user (skip unlimited plans)
    if (credit.creditsUsed > 0) await refundCredits(userId, 'RUN_FULL_STRATEGY')
    return NextResponse.json({ error: err?.message || 'NEXUS Engine failed', refunded: credit.creditsUsed > 0, stage: 'strategy' }, { status: 500 })
  }
}
