import { after, NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'
import { aiRateLimitDb } from '@/lib/dbRateLimit'
import {
  checkAndDeductCredits,
  creditCheckHttpStatus,
  finalizeCreditDeduction,
  getCreditActionPolicy,
  refundCreditDeduction,
  type CreditDeductionOk,
} from '@/lib/credits'
import { deriveCampaignEngineState, runCampaignEngine } from '@/lib/campaign-engine'
import { getBrandBrainReadiness } from '@/lib/brandReadiness'
import {
  deriveEngineRebuildAvailability,
  ENGINE_REBUILD_CREDIT_COST,
} from '@/lib/campaignDangerActions'
import { getAiProviderUnavailablePayload, isAiProviderConfigured } from '@/lib/ai/provider'
import { reviewBrandTruthConsistency } from '@/lib/ai/marketingQualityGate'
import { enforceBillableAiRateLimit } from '@/lib/billableAiRateLimit'
import { getCreditOperationKey } from '@/lib/creditOperationKey.server'
import { createOpenAIProviderUsageCollector } from '@/lib/ai/providerUsageContext'
import { summarizeOpenAITextUsage } from '@/lib/ai/providerEconomics'
import {
  enqueueCampaignEngineJob,
  findCampaignEngineJob,
} from '@/lib/automationJobs/repository'
import { processAutomationJobById } from '@/lib/automationJobs/processor'
import {
  serializeCreditDeduction,
  toPublicAutomationJob,
} from '@/lib/automationJobs/types'

// Strategy generation makes two bounded provider calls in parallel. Production
// evidence shows valid, contract-compliant Arabic packages can take longer than
// 60 seconds, so keep this aligned with the full-strategy route and the provider
// timeout instead of letting Vercel kill the request before credits can settle.
export const maxDuration = 180

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
  const asyncRequested = req.headers?.get?.('prefer')
    ?.split(',')
    .some(value => value.trim().toLowerCase() === 'respond-async') === true

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
  if (campaign.status === 'ACTIVE') {
    return NextResponse.json({
      error: 'REVOKE_STRATEGY_APPROVAL_FIRST',
      message: 'The approved strategy snapshot is immutable. Revoke approval before rebuilding or rewriting the campaign strategy.',
      creditsUsed: 0,
    }, { status: 409 })
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

  const brandTruthReview = reviewBrandTruthConsistency(brandProfile as any)
  if (brandTruthReview.status === 'blocked') {
    return NextResponse.json({
      error: 'BRAND_TRUTH_CONFLICT',
      message: 'Brand Brain contains conflicting facts. Resolve the flagged fields before generating a campaign package.',
      blockers: brandTruthReview.blockers,
      warnings: brandTruthReview.warnings,
      creditsUsed: 0,
      redirectUrl: '/brand',
    }, { status: 422 })
  }

  if (force) {
    const confirmation = {
      explicitEngineRebuildConfirmed: body.explicitEngineRebuildConfirmed,
      acknowledgedCreditCost: body.acknowledgedCreditCost,
      acknowledgedOutputOverwrite: body.acknowledgedOutputOverwrite,
    }
    const confirmationCheck = deriveEngineRebuildAvailability({
      ...confirmation,
      postStatuses: [],
    })

    if (confirmationCheck.reason === 'CONFIRMATION_REQUIRED') {
      return NextResponse.json(
        {
          error: 'ENGINE_REBUILD_CONFIRMATION_REQUIRED',
          message: 'Engine rebuild requires explicit confirmation. No credits were spent.',
          required: {
            explicitEngineRebuildConfirmed: true,
            acknowledgedCreditCost: ENGINE_REBUILD_CREDIT_COST,
            acknowledgedOutputOverwrite: true,
          },
        },
        { status: 400 },
      )
    }

    const progressedPostCount = await prisma.socialPost.count({
      where: {
        campaignId: params.id,
        workspaceId: campaign.workspaceId,
        status: { in: ['APPROVED', 'SCHEDULED', 'PUBLISHED'] },
      },
    })

    if (progressedPostCount > 0) {
      return NextResponse.json(
        {
          error: 'ENGINE_REBUILD_LOCKED_BY_PROGRESS',
          message: 'Campaign package rebuild is locked because this campaign already has approved, scheduled, or published posts. Create a new draft plan instead.',
          progressedPostCount,
        },
        { status: 409 },
      )
    }
  }

  const existingOutput = campaign.aiOutput && typeof campaign.aiOutput === 'object'
    ? campaign.aiOutput as Record<string, unknown>
    : {}
  const needsAiGeneration = force || !existingOutput.strategy

  if (needsAiGeneration && !isAiProviderConfigured()) {
    return NextResponse.json(getAiProviderUnavailablePayload(language), { status: 503 })
  }

  let credit: CreditDeductionOk | null = null
  const operationKey = getCreditOperationKey(
    req,
    'RUN_FULL_STRATEGY',
    'campaign_strategy_rebuild',
    params.id,
  )

  if (needsAiGeneration && asyncRequested) {
    const existingJob = await findCampaignEngineJob({
      workspaceId: campaign.workspaceId,
      campaignId: params.id,
      idempotencyKey: operationKey,
    })
    if (existingJob) {
      const publicJob = toPublicAutomationJob(existingJob)
      if (publicJob.canResume) {
        after(async () => {
          await processAutomationJobById(existingJob.id).catch((error) => {
            console.error('[campaign-engine-job-replay]', existingJob.id, error)
          })
        })
      }
      return NextResponse.json({
        accepted: !publicJob.terminal,
        reused: true,
        jobId: existingJob.id,
        job: publicJob,
      }, {
        status: publicJob.status === 'COMPLETED' ? 200 : 202,
        headers: {
          'Cache-Control': 'private, no-store',
          'Retry-After': '2',
          'Location': `/api/automation/jobs/${existingJob.id}`,
        },
      })
    }
  }

  if (needsAiGeneration) {
    const rateLimitResponse = await enforceBillableAiRateLimit(userId, 'RUN_FULL_STRATEGY')
    if (rateLimitResponse) return rateLimitResponse
    const creditCheck = await checkAndDeductCredits(
      userId,
      'RUN_FULL_STRATEGY',
      undefined,
      {
        entityId: params.id,
        entityType: 'campaign_strategy_rebuild',
        operationKey,
      },
    )
    if (!creditCheck.ok) return NextResponse.json(creditCheck, { status: creditCheckHttpStatus(creditCheck) })
    credit = creditCheck
  }

  if (needsAiGeneration && asyncRequested && credit) {
    try {
      const queued = await enqueueCampaignEngineJob({
        workspaceId: campaign.workspaceId,
        campaignId: params.id,
        requestedByUserId: userId,
        idempotencyKey: operationKey,
        language,
        force,
        credit: serializeCreditDeduction(credit),
      })

      if (!queued.created) {
        const duplicateRelease = await refundCreditDeduction({
          userId,
          action: 'RUN_FULL_STRATEGY',
          deduction: credit,
          reason: 'A campaign engine job was already active; duplicate reservation released.',
        })
        if (!duplicateRelease.ok) {
          return NextResponse.json({
            error: 'NEXUS found an existing job but could not verify release of the duplicate reservation.',
            code: 'DUPLICATE_RESERVATION_RELEASE_FAILED',
            jobId: queued.job.id,
            creditsUsed: credit.creditsUsed,
          }, { status: 503 })
        }
      }

      const publicJob = toPublicAutomationJob(queued.job)
      if (publicJob.canResume) {
        after(async () => {
          await processAutomationJobById(queued.job.id).catch((error) => {
            console.error('[campaign-engine-job]', queued.job.id, error)
          })
        })
      }

      return NextResponse.json({
        accepted: true,
        reused: !queued.created,
        jobId: queued.job.id,
        job: publicJob,
        creditReservation: {
          creditsReserved: queued.created ? credit.creditsUsed : 0,
          creditsRemaining: credit.creditsRemaining,
          transactionId: queued.created ? credit.transactionId ?? null : null,
          status: queued.created ? 'RESERVED' : 'RELEASED_DUPLICATE',
        },
        message: 'NEXUS is preparing the campaign in the background. You can leave this page safely.',
      }, {
        status: 202,
        headers: {
          'Cache-Control': 'private, no-store',
          'Retry-After': '2',
          'Location': `/api/automation/jobs/${queued.job.id}`,
        },
      })
    } catch (error) {
      const refund = await refundCreditDeduction({
        userId,
        action: 'RUN_FULL_STRATEGY',
        deduction: credit,
        reason: 'Campaign engine job could not be queued.',
      })
      console.error('[campaign-engine-job-enqueue]', error)
      return NextResponse.json({
        error: 'NEXUS could not safely queue this work. Reserved credits were returned.',
        code: 'AUTOMATION_JOB_ENQUEUE_FAILED',
        refunded: refund.ok && refund.status === 'refunded',
        creditsUsed: refund.ok && ['refunded', 'noop'].includes(refund.status) ? 0 : credit.creditsUsed,
      }, { status: 503 })
    }
  }

  const usageCollector = createOpenAIProviderUsageCollector()
  const currentProviderEconomics = () => {
    const calls = usageCollector.snapshot()
    if (calls.length === 0) return undefined
    const usage = summarizeOpenAITextUsage('gpt-4o', calls)
    return { providerCostUsd: usage.estimatedProviderCostUsd, providerPricingVersion: usage.pricingVersion, providerUsage: usage }
  }

  try {
    const result = await usageCollector.run(() => runCampaignEngine({
      userId,
      campaignId: params.id,
      language,
      force,
    }))

    if (credit) {
      const finalization = await finalizeCreditDeduction({
        userId,
        action: 'RUN_FULL_STRATEGY',
        deduction: credit,
        providerEconomics: currentProviderEconomics(),
      })
      if (!finalization.ok) {
        credit = null
        return NextResponse.json({
          error: 'Campaign engine output could not be finalized. Reserved credits were returned.',
          code: 'CREDIT_FINALIZATION_FAILED',
          refunded: finalization.refundStatus === 'refunded',
        }, { status: 503 })
      }
    }

    return NextResponse.json({
      campaign: result.campaign,
      engine: result.engine,
      creditsRemaining: credit?.creditsRemaining,
      creditsUsed: credit?.creditsUsed ?? 0,
      creditCharge: needsAiGeneration
        ? { ...getCreditActionPolicy('RUN_FULL_STRATEGY'), creditsUsed: credit?.creditsUsed ?? 0 }
        : {
            action: null,
            cost: 0,
            label: 'Campaign state validation',
            reason: 'Revalidates saved output without calling an AI provider.',
            includedWork: 'Deterministic validation and state rebuild only.',
            providerCallLimit: 0,
            refundableOnNoUsableOutput: false,
            creditsUsed: 0,
          },
    })
  } catch (err: any) {
    console.error('[campaign-engine POST]', err)
    await refundCreditDeduction({
      userId,
      action: 'RUN_FULL_STRATEGY',
      deduction: credit,
      reason: 'Campaign engine failed before creating a usable strategy',
      providerEconomics: currentProviderEconomics(),
    })
    return NextResponse.json({
      error: err?.message || 'NEXUS Engine failed',
      refunded: Boolean(credit?.creditsUsed),
      creditsUsed: 0,
      stage: 'strategy',
    }, { status: 500 })
  }
}
