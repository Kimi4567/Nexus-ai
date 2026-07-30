import { randomUUID } from 'node:crypto'
import {
  Prisma,
  type AutomationJob,
  type AutomationJobStatus,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  ACTIVE_AUTOMATION_JOB_STATUSES,
  CAMPAIGN_APPROVAL_PACKAGE_JOB_KIND,
  CAMPAIGN_ENGINE_JOB_KIND,
  type CampaignApprovalPackageJobInput,
  type CampaignEngineJobInput,
} from './types'

// The longest worker route is capped at five minutes. Keep the lease safely
// beyond that ceiling so a slow, still-live AI call is never claimed twice.
const DEFAULT_LEASE_MS = 10 * 60_000

function isUniqueConflict(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === 'object'
    && (error as { code?: string }).code === 'P2002',
  )
}

export async function findCampaignEngineJob(input: {
  workspaceId: string
  campaignId: string
  idempotencyKey?: string
}): Promise<AutomationJob | null> {
  if (input.idempotencyKey) {
    const replay = await prisma.automationJob.findUnique({
      where: {
        workspaceId_kind_idempotencyKey: {
          workspaceId: input.workspaceId,
          kind: CAMPAIGN_ENGINE_JOB_KIND,
          idempotencyKey: input.idempotencyKey,
        },
      },
    })
    if (replay) return replay
  }

  return prisma.automationJob.findFirst({
    where: {
      workspaceId: input.workspaceId,
      campaignId: input.campaignId,
      kind: CAMPAIGN_ENGINE_JOB_KIND,
      status: { in: ACTIVE_AUTOMATION_JOB_STATUSES },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function enqueueCampaignEngineJob(input: {
  workspaceId: string
  campaignId: string
  requestedByUserId: string
  idempotencyKey: string
  language: string
  force: boolean
  credit: CampaignEngineJobInput['credit']
}): Promise<{ job: AutomationJob; created: boolean }> {
  const existing = await findCampaignEngineJob(input)
  if (existing) return { job: existing, created: false }

  const payload: CampaignEngineJobInput = {
    schemaVersion: 1,
    userId: input.requestedByUserId,
    campaignId: input.campaignId,
    language: input.language,
    force: input.force,
    credit: input.credit,
  }

  try {
    const job = await prisma.automationJob.create({
      data: {
        workspaceId: input.workspaceId,
        campaignId: input.campaignId,
        requestedByUserId: input.requestedByUserId,
        kind: CAMPAIGN_ENGINE_JOB_KIND,
        status: 'QUEUED',
        idempotencyKey: input.idempotencyKey,
        input: payload as unknown as Prisma.InputJsonValue,
        currentStep: 'queued',
        progress: 10,
        steps: {
          create: {
            stepKey: 'validate_and_reserve',
            attempt: 1,
            status: 'COMPLETED',
            output: {
              ownershipVerified: true,
              brandReadinessVerified: true,
              creditsReserved: true,
            },
            completedAt: new Date(),
          },
        },
      },
    })
    return { job, created: true }
  } catch (error) {
    if (!isUniqueConflict(error)) throw error
    const raced = await findCampaignEngineJob(input)
    if (!raced) throw error
    return { job: raced, created: false }
  }
}

export async function findCampaignApprovalPackageJob(input: {
  workspaceId: string
  campaignId: string
  idempotencyKey?: string
}): Promise<AutomationJob | null> {
  if (input.idempotencyKey) {
    const replay = await prisma.automationJob.findUnique({
      where: {
        workspaceId_kind_idempotencyKey: {
          workspaceId: input.workspaceId,
          kind: CAMPAIGN_APPROVAL_PACKAGE_JOB_KIND,
          idempotencyKey: input.idempotencyKey,
        },
      },
    })
    if (replay) return replay
  }

  return prisma.automationJob.findFirst({
    where: {
      workspaceId: input.workspaceId,
      campaignId: input.campaignId,
      kind: CAMPAIGN_APPROVAL_PACKAGE_JOB_KIND,
      status: { in: ACTIVE_AUTOMATION_JOB_STATUSES },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function enqueueCampaignApprovalPackageJob(input: {
  workspaceId: string
  campaignId: string
  requestedByUserId: string
  idempotencyKey: string
  language: string
  mediaSource: CampaignApprovalPackageJobInput['mediaSource']
  selectedMediaIds: string[] | null
  credit: CampaignApprovalPackageJobInput['credit']
}): Promise<{ job: AutomationJob; created: boolean }> {
  const existing = await findCampaignApprovalPackageJob(input)
  if (existing) return { job: existing, created: false }

  const payload: CampaignApprovalPackageJobInput = {
    schemaVersion: 1,
    userId: input.requestedByUserId,
    campaignId: input.campaignId,
    language: input.language,
    mediaSource: input.mediaSource,
    selectedMediaIds: input.selectedMediaIds,
    credit: input.credit,
  }

  try {
    const job = await prisma.automationJob.create({
      data: {
        workspaceId: input.workspaceId,
        campaignId: input.campaignId,
        requestedByUserId: input.requestedByUserId,
        kind: CAMPAIGN_APPROVAL_PACKAGE_JOB_KIND,
        status: 'QUEUED',
        idempotencyKey: input.idempotencyKey,
        input: payload as unknown as Prisma.InputJsonValue,
        currentStep: 'queued',
        progress: 10,
        steps: {
          create: {
            stepKey: 'validate_and_reserve',
            attempt: 1,
            status: 'COMPLETED',
            output: {
              ownershipVerified: true,
              strategyApprovalVerified: true,
              contentScopeVerified: true,
              creditsReserved: true,
            },
            completedAt: new Date(),
          },
        },
      },
    })
    return { job, created: true }
  } catch (error) {
    if (!isUniqueConflict(error)) throw error
    const raced = await findCampaignApprovalPackageJob(input)
    if (!raced) throw error
    return { job: raced, created: false }
  }
}

export async function getAutomationJobForOwner(
  jobId: string,
  userId: string,
): Promise<AutomationJob | null> {
  return prisma.automationJob.findFirst({
    where: {
      id: jobId,
      workspace: { ownerId: userId },
    },
  })
}

export async function getLatestCampaignAutomationJob(input: {
  userId: string
  campaignId: string
  kind?: string
  activeOnly?: boolean
}): Promise<AutomationJob | null> {
  return prisma.automationJob.findFirst({
    where: {
      campaignId: input.campaignId,
      kind: input.kind || CAMPAIGN_ENGINE_JOB_KIND,
      workspace: { ownerId: input.userId },
      ...(input.activeOnly ? { status: { in: ACTIVE_AUTOMATION_JOB_STATUSES } } : {}),
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function claimAutomationJobById(
  jobId: string,
  options: { now?: Date; leaseMs?: number } = {},
): Promise<AutomationJob | null> {
  const now = options.now ?? new Date()
  const leaseToken = randomUUID()
  const leaseExpiresAt = new Date(now.getTime() + (options.leaseMs ?? DEFAULT_LEASE_MS))
  const claimableStatuses: AutomationJobStatus[] = ['QUEUED', 'RETRY_SCHEDULED']

  const claimed = await prisma.automationJob.updateMany({
    where: {
      id: jobId,
      OR: [
        {
          status: { in: claimableStatuses },
          nextAttemptAt: { lte: now },
        },
        {
          status: 'RUNNING',
          leaseExpiresAt: { lte: now },
        },
      ],
    },
    data: {
      status: 'RUNNING',
      leaseToken,
      leaseExpiresAt,
      currentStep: 'processing',
      progress: 20,
      attemptCount: { increment: 1 },
      errorCode: null,
      lastError: null,
    },
  })
  if (claimed.count !== 1) return null

  await prisma.automationJob.updateMany({
    where: { id: jobId, leaseToken, startedAt: null },
    data: { startedAt: now },
  })
  return prisma.automationJob.findFirst({ where: { id: jobId, leaseToken } })
}

/**
 * Claims the next due job in one short transaction. SKIP LOCKED lets cron and
 * response-tail workers coexist without waiting on the same queue row.
 */
export async function claimNextAutomationJob(
  options: { now?: Date; leaseMs?: number } = {},
): Promise<AutomationJob | null> {
  const now = options.now ?? new Date()
  const leaseToken = randomUUID()
  const leaseExpiresAt = new Date(now.getTime() + (options.leaseMs ?? DEFAULT_LEASE_MS))

  const rows = await prisma.$queryRaw<AutomationJob[]>(Prisma.sql`
    WITH candidate AS (
      SELECT "id"
      FROM "AutomationJob"
      WHERE (
        (
          "status" IN (
            CAST('QUEUED' AS "AutomationJobStatus"),
            CAST('RETRY_SCHEDULED' AS "AutomationJobStatus")
          )
          AND "nextAttemptAt" <= ${now}
        )
        OR (
          "status" = CAST('RUNNING' AS "AutomationJobStatus")
          AND "leaseExpiresAt" <= ${now}
        )
      )
      ORDER BY "priority" DESC, "nextAttemptAt" ASC, "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE "AutomationJob" AS job
    SET
      "status" = CAST('RUNNING' AS "AutomationJobStatus"),
      "leaseToken" = ${leaseToken},
      "leaseExpiresAt" = ${leaseExpiresAt},
      "startedAt" = COALESCE(job."startedAt", ${now}),
      "currentStep" = CASE
        WHEN job."kind" = ${CAMPAIGN_ENGINE_JOB_KIND} THEN 'campaign_engine'
        WHEN job."kind" = ${CAMPAIGN_APPROVAL_PACKAGE_JOB_KIND} THEN 'content_plan'
        ELSE 'processing'
      END,
      "progress" = GREATEST(job."progress", 20),
      "attemptCount" = job."attemptCount" + 1,
      "errorCode" = NULL,
      "lastError" = NULL,
      "updatedAt" = ${now}
    FROM candidate
    WHERE job."id" = candidate."id"
    RETURNING job.*
  `)

  return rows[0] ?? null
}
