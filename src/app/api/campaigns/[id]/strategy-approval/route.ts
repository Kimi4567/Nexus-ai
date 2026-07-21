import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import {
  approveCampaignStrategy,
  getStrategyApprovalContract,
  revokeCampaignStrategyApproval,
  StrategyApprovalError,
} from '@/lib/strategyApprovalService'

type Params = { params: Promise<{ id: string }> }

function errorResponse(error: unknown) {
  if (error instanceof StrategyApprovalError) {
    const message = error.code === 'STRATEGY_REVIEW_STALE'
      ? 'The strategy changed after this review was opened. Reload and review the current revision before approval.'
      : error.code === 'STRATEGY_APPROVAL_CONCURRENT_CHANGE'
        ? 'The strategy changed during approval. Reload and review the current revision.'
        : undefined
    return NextResponse.json({
      error: error.code,
      ...(message ? { message } : {}),
      blockers: error.blockers,
    }, { status: error.status })
  }
  console.error('[strategy-approval]', error)
  return NextResponse.json({ error: 'STRATEGY_APPROVAL_FAILED' }, { status: 500 })
}

export async function GET(req: NextRequest, props: Params) {
  const { id } = await props.params
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    return NextResponse.json({ approval: await getStrategyApprovalContract(id, userId) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(req: NextRequest, props: Params) {
  const { id } = await props.params
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json().catch(() => ({})) as {
      action?: unknown
      reason?: unknown
      expectedStrategyUpdatedAt?: unknown
    }
    if (body.action === 'approve') {
      const result = await approveCampaignStrategy(
        id,
        userId,
        'CAMPAIGN_REVIEW',
        typeof body.expectedStrategyUpdatedAt === 'string' ? body.expectedStrategyUpdatedAt : null,
      )
      return NextResponse.json({ approval: result.contract, unchanged: result.unchanged })
    }
    if (body.action === 'revoke') {
      const result = await revokeCampaignStrategyApproval(
        id,
        userId,
        typeof body.reason === 'string' ? body.reason : null,
      )
      return NextResponse.json({ approval: result.contract, unchanged: result.unchanged })
    }
    return NextResponse.json({ error: 'action must be approve or revoke' }, { status: 400 })
  } catch (error) {
    return errorResponse(error)
  }
}
