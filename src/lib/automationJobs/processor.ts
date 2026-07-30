import { Prisma, type AutomationJob } from '@prisma/client'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runCampaignEngine } from '@/lib/campaign-engine'
import {
  finalizeCreditDeduction,
  refundCreditDeduction,
  type CreditProviderEconomics,
} from '@/lib/credits'
import { createOpenAIProviderUsageCollector } from '@/lib/ai/providerUsageContext'
import { summarizeOpenAITextUsage } from '@/lib/ai/providerEconomics'
import {
  AiProviderCircuitOpenError,
  AiProviderRequestError,
} from '@/lib/ai/providerFetch'
import {
  claimAutomationJobById,
  claimNextAutomationJob,
} from './repository'
import {
  CAMPAIGN_APPROVAL_PACKAGE_JOB_KIND,
  CAMPAIGN_ENGINE_JOB_KIND,
  deserializeCreditDeduction,
  isCampaignApprovalPackageJobInput,
  isCampaignEngineJobInput,
  type CampaignApprovalPackageJobOutput,
  type CampaignApprovalPackageSummary,
  type CampaignEngineJobOutput,
} from './types'

const MAX_ERROR_LENGTH = 2_000

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Automation job failed'
  return message.replace(/\s+/g, ' ').trim().slice(0, MAX_ERROR_LENGTH)
}

function automationErrorCode(error: unknown): string {
  if (error instanceof AiProviderCircuitOpenError) return error.code
  if (error instanceof AiProviderRequestError) return error.code
  if (error && typeof error === 'object' && typeof (error as { code?: unknown }).code === 'string') {
    return String((error as { code: string }).code).slice(0, 120)
  }
  return 'AUTOMATION_JOB_FAILED'
}

export function isRetryableAutomationError(error: unknown): boolean {
  if (error instanceof AiProviderCircuitOpenError) return true
  if (error instanceof AiProviderRequestError) return error.retryable

  const code = error && typeof error === 'object'
    ? String((error as { code?: unknown }).code || '')
    : ''
  if (['P1001', 'P1002', 'P1008', 'P2024', 'ECONNRESET', 'ETIMEDOUT'].includes(code)) {
    return true
  }

  const message = safeErrorMessage(error).toLowerCase()
  return message.includes('connection pool')
    || message.includes('timed out')
    || message.includes('timeout')
    || message.includes('temporarily unavailable')
}

function retryDelayMs(attempt: number): number {
  return Math.min(30_000 * (2 ** Math.max(0, attempt - 1)), 5 * 60_000)
}

async function markRecoveredStepFailed(job: AutomationJob): Promise<void> {
  if (job.attemptCount <= 1) return
  await prisma.automationJobStep.updateMany({
    where: {
      jobId: job.id,
      status: 'RUNNING',
      attempt: { lt: job.attemptCount },
    },
    data: {
      status: 'FAILED',
      error: 'Worker lease expired before the attempt recorded a terminal state.',
      completedAt: new Date(),
    },
  })
}

function providerEconomicsFrom(
  calls: ReturnType<ReturnType<typeof createOpenAIProviderUsageCollector>['snapshot']>,
): CreditProviderEconomics | undefined {
  if (calls.length === 0) return undefined
  const usage = summarizeOpenAITextUsage('gpt-4o', calls)
  return {
    providerCostUsd: usage.estimatedProviderCostUsd,
    providerPricingVersion: usage.pricingVersion,
    providerUsage: usage,
  }
}

async function processCampaignEngineJob(job: AutomationJob): Promise<AutomationJob> {
  const input = job.input
  if (!isCampaignEngineJobInput(input)) {
    throw Object.assign(new Error('Campaign engine job input is invalid.'), {
      code: 'AUTOMATION_JOB_INPUT_INVALID',
    })
  }

  await markRecoveredStepFailed(job)
  const step = await prisma.automationJobStep.create({
    data: {
      jobId: job.id,
      stepKey: 'campaign_engine',
      attempt: job.attemptCount,
      status: 'RUNNING',
      input: {
        campaignId: input.campaignId,
        force: input.force,
        language: input.language,
      },
    },
  })

  const credit = deserializeCreditDeduction(input.credit)
  const usageCollector = createOpenAIProviderUsageCollector()

  try {
    const result = await usageCollector.run(() => runCampaignEngine({
      userId: input.userId,
      campaignId: input.campaignId,
      language: input.language,
      force: input.force,
    }))
    const economics = providerEconomicsFrom(usageCollector.snapshot())
    const finalization = await finalizeCreditDeduction({
      userId: input.userId,
      action: 'RUN_FULL_STRATEGY',
      deduction: credit,
      providerEconomics: economics,
    })
    if (!finalization.ok) {
      throw Object.assign(
        new Error('Campaign output was created, but its credit reservation could not be finalized.'),
        { code: 'CREDIT_FINALIZATION_FAILED' },
      )
    }

    const output: CampaignEngineJobOutput = {
      schemaVersion: 1,
      campaignId: result.campaign.id,
      engine: result.engine,
      creditsRemaining: credit.creditsRemaining,
      creditsUsed: credit.creditsUsed,
      creditFinalization: finalization.status,
    }
    const completedAt = new Date()
    await prisma.$transaction([
      prisma.automationJobStep.update({
        where: { id: step.id },
        data: {
          status: 'COMPLETED',
          output: {
            campaignId: result.campaign.id,
            engineStatus: result.engine.status,
            readinessScore: result.engine.score,
          },
          completedAt,
        },
      }),
      prisma.automationJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          progress: 100,
          currentStep: 'completed',
          output: output as unknown as Prisma.InputJsonValue,
          completedAt,
          leaseToken: null,
          leaseExpiresAt: null,
          errorCode: null,
          lastError: null,
        },
      }),
    ])
    return (await prisma.automationJob.findUnique({ where: { id: job.id } }))!
  } catch (error) {
    const message = safeErrorMessage(error)
    const errorCode = automationErrorCode(error)
    const retryable = isRetryableAutomationError(error)
    const canRetry = retryable && job.attemptCount < job.maxAttempts
    const now = new Date()

    await prisma.automationJobStep.updateMany({
      where: { id: step.id, status: 'RUNNING' },
      data: { status: 'FAILED', error: message, completedAt: now },
    })

    if (canRetry) {
      return prisma.automationJob.update({
        where: { id: job.id },
        data: {
          status: 'RETRY_SCHEDULED',
          currentStep: 'waiting_to_retry',
          nextAttemptAt: new Date(now.getTime() + retryDelayMs(job.attemptCount)),
          leaseToken: null,
          leaseExpiresAt: null,
          errorCode,
          lastError: message,
        },
      })
    }

    const economics = providerEconomicsFrom(usageCollector.snapshot())
    const refund = await refundCreditDeduction({
      userId: input.userId,
      action: 'RUN_FULL_STRATEGY',
      deduction: credit,
      reason: 'Campaign engine automation job failed before creating usable output',
      providerEconomics: economics,
    })
    return prisma.automationJob.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        currentStep: 'failed',
        completedAt: now,
        leaseToken: null,
        leaseExpiresAt: null,
        errorCode,
        lastError: message,
        output: {
          schemaVersion: 1,
          campaignId: input.campaignId,
          creditsUsed: refund.ok && refund.status === 'refunded' ? 0 : credit.creditsUsed,
          refunded: refund.ok && refund.status === 'refunded',
        },
      },
    })
  }
}

function normalizeApprovalPackageSummary(value: unknown): CampaignApprovalPackageSummary {
  const summary = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  const platforms = Array.isArray(summary.platforms)
    ? [...new Set(summary.platforms.filter((item): item is string => typeof item === 'string'))]
    : []
  return {
    total: Math.max(0, Number(summary.total) || 0),
    imagePosts: Math.max(0, Number(summary.imagePosts) || 0),
    videoSlots: Math.max(0, Number(summary.videoSlots) || 0),
    uploadSlots: Math.max(0, Number(summary.uploadSlots) || 0),
    platforms,
  }
}

async function recoveredApprovalPackageSummary(
  job: AutomationJob,
): Promise<CampaignApprovalPackageSummary | null> {
  if (job.attemptCount <= 1 || !job.campaignId) return null
  const posts = await prisma.socialPost.findMany({
    where: {
      workspaceId: job.workspaceId,
      campaignId: job.campaignId,
      status: 'DRAFT',
      autoGenerated: true,
      publishedAt: null,
      createdAt: { gte: job.createdAt },
    },
    select: {
      platform: true,
      isVideoPost: true,
      mediaSource: true,
    },
  })
  if (posts.length === 0) return null
  return {
    total: posts.length,
    imagePosts: posts.filter(post => !post.isVideoPost).length,
    videoSlots: posts.filter(post => post.isVideoPost).length,
    uploadSlots: posts.filter(post => !post.isVideoPost && post.mediaSource === 'UPLOAD').length,
    platforms: [...new Set(posts.map(post => String(post.platform)))],
  }
}

async function markApprovalPackageWaiting(
  job: AutomationJob,
  stepId: string,
  summary: CampaignApprovalPackageSummary,
): Promise<AutomationJob> {
  const output: CampaignApprovalPackageJobOutput = {
    schemaVersion: 1,
    campaignId: job.campaignId!,
    packageType: 'CONTENT_AND_MEDIA_DIRECTION',
    summary,
    reviewUrl: `/campaigns/${job.campaignId}/content-hub`,
    publishAuthorized: false,
    spendAuthorized: false,
  }
  const now = new Date()
  await prisma.$transaction([
    prisma.automationJobStep.update({
      where: { id: stepId },
      data: {
        status: 'COMPLETED',
        output: {
          totalDrafts: summary.total,
          imagePosts: summary.imagePosts,
          videoSlots: summary.videoSlots,
          uploadSlots: summary.uploadSlots,
          approvalRequired: true,
        },
        completedAt: now,
      },
    }),
    prisma.automationJob.update({
      where: { id: job.id },
      data: {
        status: 'WAITING_FOR_APPROVAL',
        progress: 100,
        currentStep: 'waiting_for_approval',
        output: output as unknown as Prisma.InputJsonValue,
        leaseToken: null,
        leaseExpiresAt: null,
        errorCode: null,
        lastError: null,
      },
    }),
  ])
  return (await prisma.automationJob.findUnique({ where: { id: job.id } }))!
}

async function processCampaignApprovalPackageJob(job: AutomationJob): Promise<AutomationJob> {
  const input = job.input
  if (!isCampaignApprovalPackageJobInput(input)) {
    throw Object.assign(new Error('Campaign approval package job input is invalid.'), {
      code: 'AUTOMATION_JOB_INPUT_INVALID',
    })
  }

  await markRecoveredStepFailed(job)
  const step = await prisma.automationJobStep.create({
    data: {
      jobId: job.id,
      stepKey: 'content_plan_and_media_direction',
      attempt: job.attemptCount,
      status: 'RUNNING',
      input: {
        campaignId: input.campaignId,
        language: input.language,
        mediaSource: input.mediaSource,
        selectedMediaCount: input.selectedMediaIds?.length ?? 0,
        automaticMediaSelection: input.selectedMediaIds === null,
      },
    },
  })
  const credit = deserializeCreditDeduction(input.credit)

  try {
    const recovered = await recoveredApprovalPackageSummary(job)
    if (recovered) {
      const finalization = await finalizeCreditDeduction({
        userId: input.userId,
        action: 'CONTENT_PLAN_GENERATION',
        deduction: credit,
      })
      if (!finalization.ok) {
        throw Object.assign(
          new Error('Recovered content drafts exist, but their credit reservation could not be finalized.'),
          { code: 'CREDIT_FINALIZATION_FAILED', nonRetryable: true },
        )
      }
      return markApprovalPackageWaiting(job, step.id, recovered)
    }

    const internalRequest = new NextRequest(
      `http://nexus.internal/api/campaigns/${encodeURIComponent(input.campaignId)}/generate-content-plan`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: input.language,
          mediaSource: input.mediaSource,
          ...(input.selectedMediaIds === null ? {} : { selectedMediaIds: input.selectedMediaIds }),
          enableABTesting: false,
        }),
      },
    )
    // Dynamic loading avoids a static route/worker import cycle: the public
    // route queues this worker, while the worker reuses its guarded execution
    // seam without storing browser credentials.
    const { executeContentPlanGeneration } = await import(
      '@/app/api/campaigns/[id]/generate-content-plan/route'
    )
    const response = await executeContentPlanGeneration(
      internalRequest,
      input.campaignId,
      input.userId,
      { reservedCredit: credit },
    )
    const body = await response.json().catch(() => null) as {
      summary?: unknown
      error?: string
      message?: string
      code?: string
    } | null
    if (!response.ok || !body?.summary) {
      throw Object.assign(
        new Error(body?.message || body?.error || `Content package generation failed (${response.status}).`),
        {
          code: body?.code || body?.error || 'CONTENT_APPROVAL_PACKAGE_FAILED',
          nonRetryable: true,
        },
      )
    }
    return markApprovalPackageWaiting(job, step.id, normalizeApprovalPackageSummary(body.summary))
  } catch (error) {
    const message = safeErrorMessage(error)
    const errorCode = automationErrorCode(error)
    const explicitlyPermanent = Boolean(
      error
      && typeof error === 'object'
      && (error as { nonRetryable?: unknown }).nonRetryable,
    )
    const canRetry = !explicitlyPermanent
      && isRetryableAutomationError(error)
      && job.attemptCount < job.maxAttempts
    const now = new Date()

    await prisma.automationJobStep.updateMany({
      where: { id: step.id, status: 'RUNNING' },
      data: { status: 'FAILED', error: message, completedAt: now },
    })

    if (canRetry) {
      return prisma.automationJob.update({
        where: { id: job.id },
        data: {
          status: 'RETRY_SCHEDULED',
          currentStep: 'waiting_to_retry',
          nextAttemptAt: new Date(now.getTime() + retryDelayMs(job.attemptCount)),
          leaseToken: null,
          leaseExpiresAt: null,
          errorCode,
          lastError: message,
        },
      })
    }

    const refund = await refundCreditDeduction({
      userId: input.userId,
      action: 'CONTENT_PLAN_GENERATION',
      deduction: credit,
      reason: 'Content approval package automation failed before a reviewable package was available',
    })
    const refunded = refund.ok && refund.status === 'refunded'
    return prisma.automationJob.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        currentStep: 'failed',
        completedAt: now,
        leaseToken: null,
        leaseExpiresAt: null,
        errorCode,
        lastError: message,
        output: {
          schemaVersion: 1,
          campaignId: input.campaignId,
          creditsUsed: refunded ? 0 : credit.creditsUsed,
          refunded,
          publishAuthorized: false,
          spendAuthorized: false,
        },
      },
    })
  }
}

export async function processClaimedAutomationJob(job: AutomationJob): Promise<AutomationJob> {
  if (job.kind === CAMPAIGN_ENGINE_JOB_KIND) return processCampaignEngineJob(job)
  if (job.kind === CAMPAIGN_APPROVAL_PACKAGE_JOB_KIND) {
    return processCampaignApprovalPackageJob(job)
  }

  const message = `Unsupported automation job kind: ${job.kind}`.slice(0, MAX_ERROR_LENGTH)
  return prisma.automationJob.update({
    where: { id: job.id },
    data: {
      status: 'FAILED',
      currentStep: 'failed',
      completedAt: new Date(),
      leaseToken: null,
      leaseExpiresAt: null,
      errorCode: 'AUTOMATION_JOB_KIND_UNSUPPORTED',
      lastError: message,
    },
  })
}

export async function processAutomationJobById(jobId: string): Promise<AutomationJob | null> {
  const claimed = await claimAutomationJobById(jobId)
  if (!claimed) return null
  return processClaimedAutomationJob(claimed)
}

export async function processNextAutomationJob(): Promise<AutomationJob | null> {
  const claimed = await claimNextAutomationJob()
  if (!claimed) return null
  return processClaimedAutomationJob(claimed)
}
