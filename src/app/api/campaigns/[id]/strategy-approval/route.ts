import { NextRequest, NextResponse } from 'next/server'
import { getServerUserId } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { getCreditActionPolicy } from '@/lib/credits'
import { isSupportedLocale } from '@/lib/locale'
import { parseIdempotencyKey } from '@/lib/idempotencyKey.server'
import {
  approveCampaignStrategy,
  getStrategyApprovalContract,
  revokeCampaignStrategyApproval,
  StrategyApprovalError,
} from '@/lib/strategyApprovalService'

type Params = { params: Promise<{ id: string }> }
type ContentPlanConsent = {
  authorized?: unknown
  expectedCreditCost?: unknown
  language?: unknown
  mediaSource?: unknown
}

function forwardedHandoffHeaders(response: Response): Headers {
  const headers = new Headers({ 'Cache-Control': 'private, no-store' })
  for (const name of ['Location', 'Retry-After']) {
    const value = response.headers.get(name)
    if (value) headers.set(name, value)
  }
  return headers
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

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
      contentPlanConsent?: ContentPlanConsent
    }
    if (body.action === 'approve' || body.action === 'approve_and_prepare_content') {
      const prepareContent = body.action === 'approve_and_prepare_content'
      const contentPolicy = getCreditActionPolicy('CONTENT_PLAN_GENERATION')
      const operationKey = prepareContent ? parseIdempotencyKey(req) : null
      const consent = body.contentPlanConsent

      // Validate the complete economic decision before recording strategy
      // approval. A stale UI price or a request without replay protection must
      // never turn into a partially-authorized content charge.
      if (prepareContent && !operationKey) {
        return NextResponse.json({
          error: 'IDEMPOTENCY_KEY_REQUIRED',
          message: 'A valid Idempotency-Key is required for the strategy-to-content handoff.',
        }, { status: 400 })
      }
      if (prepareContent && consent?.authorized !== true) {
        return NextResponse.json({
          error: 'CONTENT_PLAN_CONSENT_REQUIRED',
          message: 'Explicit content-plan credit consent is required before strategy approval.',
          currentCost: contentPolicy.cost,
        }, { status: 400 })
      }
      if (prepareContent && consent?.expectedCreditCost !== contentPolicy.cost) {
        return NextResponse.json({
          error: 'CREDIT_PRICE_CHANGED',
          message: 'The content-plan price changed. Review the current price before approving.',
          currentCost: contentPolicy.cost,
        }, { status: 409 })
      }

      const result = await approveCampaignStrategy(
        id,
        userId,
        'CAMPAIGN_REVIEW',
        typeof body.expectedStrategyUpdatedAt === 'string' ? body.expectedStrategyUpdatedAt : null,
      )
      if (!prepareContent) {
        return NextResponse.json({ approval: result.contract, unchanged: result.unchanged })
      }

      try {
        const campaign = await prisma.campaign.findFirst({
          where: { id, workspace: { ownerId: userId } },
          select: { workspaceId: true },
        })
        if (!campaign) throw new StrategyApprovalError('CAMPAIGN_NOT_FOUND', 404)

        // A repeated owner command must retain an existing review package.
        // Regeneration remains a separate explicit action after the owner
        // clears the old drafts.
        const existingContentCount = await prisma.socialPost.count({
          where: { campaignId: id, workspaceId: campaign.workspaceId },
        })
        if (existingContentCount > 0) {
          return NextResponse.json({
            approval: result.contract,
            unchanged: result.unchanged,
            approvalRecorded: true,
            contentHandoff: {
              state: 'EXISTING_CONTENT_RETAINED',
              existingContentCount,
              creditsAuthorized: 0,
              publishAuthorized: false,
              spendAuthorized: false,
            },
          }, {
            headers: { 'Cache-Control': 'private, no-store' },
          })
        }

        const language = isSupportedLocale(consent?.language) ? consent.language : 'en'
        const mediaSource = ['GENERATE', 'UPLOAD', 'MIXED'].includes(String(consent?.mediaSource))
          ? String(consent?.mediaSource)
          : 'MIXED'
        const handoffRequest = new NextRequest(
          new URL(`/api/campaigns/${encodeURIComponent(id)}/generate-content-plan`, req.url),
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': operationKey!,
              Prefer: 'respond-async',
            },
            body: JSON.stringify({ language, mediaSource }),
          },
        )
        const { executeContentPlanGeneration } = await import(
          '@/app/api/campaigns/[id]/generate-content-plan/route'
        )
        const response = await executeContentPlanGeneration(handoffRequest, id, userId)
        const contentPayload = asRecord(await response.json().catch(() => ({})))
        return NextResponse.json({
          ...(!response.ok ? contentPayload : {}),
          approval: result.contract,
          unchanged: result.unchanged,
          approvalRecorded: true,
          contentHandoff: {
            ...contentPayload,
            state: response.ok ? 'QUEUED_OR_REUSED' : 'NEEDS_RETRY',
            creditsAuthorized: contentPolicy.cost,
            publishAuthorized: false,
            spendAuthorized: false,
          },
        }, {
          status: response.status,
          headers: forwardedHandoffHeaders(response),
        })
      } catch (error) {
        if (error instanceof StrategyApprovalError) throw error
        console.error('[strategy-content-handoff]', error)
        return NextResponse.json({
          error: 'CONTENT_HANDOFF_FAILED',
          message: 'Strategy approval was recorded, but the content handoff needs a safe retry.',
          approval: result.contract,
          unchanged: result.unchanged,
          approvalRecorded: true,
          contentHandoff: {
            state: 'NEEDS_RETRY',
            retryable: true,
            creditsAuthorized: contentPolicy.cost,
            publishAuthorized: false,
            spendAuthorized: false,
          },
        }, {
          status: 503,
          headers: { 'Cache-Control': 'private, no-store', 'Retry-After': '2' },
        })
      }
    }
    if (body.action === 'revoke') {
      const result = await revokeCampaignStrategyApproval(
        id,
        userId,
        typeof body.reason === 'string' ? body.reason : null,
      )
      return NextResponse.json({ approval: result.contract, unchanged: result.unchanged })
    }
    return NextResponse.json({
      error: 'action must be approve, approve_and_prepare_content, or revoke',
    }, { status: 400 })
  } catch (error) {
    return errorResponse(error)
  }
}
