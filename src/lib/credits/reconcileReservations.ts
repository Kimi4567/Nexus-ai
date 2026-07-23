import { prisma } from '@/lib/prisma'
import { refundCreditsForTransaction } from '@/lib/credits'

export const CREDIT_RESERVATION_STALE_AFTER_MS = 30 * 60 * 1000
export const CREDIT_RESERVATION_RECONCILE_LIMIT = 100

export interface CreditReservationReconciliationResult {
  scanned: number
  refunded: number
  alreadyResolved: number
  artifactsRepaired: number
  failed: number
  failures: Array<{ transactionId: string; error: string }>
}

const ABANDONED_IMAGE_MESSAGE = 'Image generation was interrupted before a usable asset was produced. Reserved credits were restored automatically.'

async function repairAbandonedGeneratedVisual(reservation: {
  id: string
  entityId: string | null
  entityType: string | null
}): Promise<boolean> {
  if (reservation.entityType !== 'generated_visual_image' || !reservation.entityId) return false

  const visual = await prisma.generatedVisual.findUnique({
    where: { id: reservation.entityId },
    select: {
      id: true,
      workspaceId: true,
      campaignId: true,
      parentId: true,
      status: true,
    },
  })
  if (!visual || visual.status !== 'GENERATING') return false

  const repaired = await prisma.generatedVisual.updateMany({
    where: { id: visual.id, status: 'GENERATING' },
    data: {
      status: 'FAILED',
      errorMessage: ABANDONED_IMAGE_MESSAGE,
      creditTransactionId: reservation.id,
      qualityStatus: 'ERROR',
    },
  })
  if (repaired.count === 0) return false

  const socialPostId = visual.parentId?.startsWith('social-post:')
    ? visual.parentId.slice('social-post:'.length)
    : null
  if (socialPostId) {
    await prisma.socialPost.updateMany({
      where: {
        id: socialPostId,
        workspaceId: visual.workspaceId,
        campaignId: visual.campaignId,
        imageUrl: null,
        uploadedMediaId: null,
        generationStatus: { in: ['PENDING', 'GENERATING', 'FAILED', 'REFUND_PENDING'] },
      },
      data: {
        generationStatus: 'FAILED',
        errorMessage: ABANDONED_IMAGE_MESSAGE,
      },
    })
  }
  return true
}

/**
 * Returns abandoned reservations to their exact source grant/scalar balance.
 *
 * A reservation older than 30 minutes is outside every synchronous NEXUS AI
 * route timeout, including professional video. The operation therefore failed
 * to close its billing lifecycle even if a provider later produced an orphaned
 * artifact. NEXUS favours the user and refunds once; the transaction lock and
 * linked REFUND row in refundCreditsForTransaction make retries idempotent.
 */
export async function reconcileStaleCreditReservations(
  now = new Date(),
): Promise<CreditReservationReconciliationResult> {
  const cutoff = new Date(now.getTime() - CREDIT_RESERVATION_STALE_AFTER_MS)
  const stale = await prisma.creditTransaction.findMany({
    where: { status: 'RESERVED', createdAt: { lt: cutoff } },
    orderBy: { createdAt: 'asc' },
    take: CREDIT_RESERVATION_RECONCILE_LIMIT,
    select: { id: true, userId: true, entityId: true, entityType: true },
  })

  const result: CreditReservationReconciliationResult = {
    scanned: stale.length,
    refunded: 0,
    alreadyResolved: 0,
    artifactsRepaired: 0,
    failed: 0,
    failures: [],
  }

  for (const reservation of stale) {
    const refund = await refundCreditsForTransaction({
      userId: reservation.userId,
      transactionId: reservation.id,
      reason: 'Automatic reconciliation for an abandoned AI credit reservation',
    })
    if (!refund.ok) {
      result.failed++
      result.failures.push({
        transactionId: reservation.id,
        error: refund.error || 'credit_refund_failed',
      })
    } else if (refund.status === 'refunded') {
      result.refunded++
    } else {
      result.alreadyResolved++
    }

    try {
      if (await repairAbandonedGeneratedVisual(reservation)) result.artifactsRepaired++
    } catch (error) {
      result.failed++
      result.failures.push({
        transactionId: reservation.id,
        error: error instanceof Error ? error.message : 'artifact_repair_failed',
      })
    }
  }

  return result
}
