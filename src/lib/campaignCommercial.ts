import type { Prisma } from '@prisma/client'
import { getCampaignLimit } from '@/lib/commercialPlans'

export interface CampaignAllowance {
  limit: number
  current: number
  periodStart: Date
  periodEnd: Date
  plan: string
}

export function getUtcMonthlyWindow(now = new Date()): { periodStart: Date; periodEnd: Date } {
  return {
    periodStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    periodEnd: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  }
}

/**
 * Serialize and read the account-wide campaign allowance inside the caller's
 * transaction. Campaigns are a monthly creation allowance, not a lifetime cap.
 */
export async function readLockedCampaignAllowance(
  tx: Prisma.TransactionClient,
  ownerId: string,
  now = new Date(),
): Promise<CampaignAllowance> {
  await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `campaign-limit:${ownerId}`)

  const [user, subscription] = await Promise.all([
    tx.user.findUnique({
      where: { id: ownerId },
      select: { subscriptionStatus: true, role: true },
    }),
    tx.subscription.findUnique({
      where: { userId: ownerId },
      select: { plan: true, status: true, currentPeriodStart: true, currentPeriodEnd: true },
    }),
  ])

  const hasActiveSubscription = subscription?.status === 'ACTIVE'
  const plan = String(hasActiveSubscription ? subscription.plan : (user?.subscriptionStatus || 'FREE')).toUpperCase()
  const limit = getCampaignLimit(plan, user?.role)
  const subscriptionWindowIsCurrent = Boolean(
    hasActiveSubscription
      && subscription?.currentPeriodStart
      && subscription?.currentPeriodEnd
      && subscription.currentPeriodStart <= now
      && subscription.currentPeriodEnd > now,
  )
  const { periodStart, periodEnd } = subscriptionWindowIsCurrent
    ? {
        periodStart: subscription!.currentPeriodStart!,
        periodEnd: subscription!.currentPeriodEnd!,
      }
    : getUtcMonthlyWindow(now)

  const current = limit === 999
    ? 0
    : await tx.campaign.count({
        where: {
          workspace: { ownerId },
          createdAt: { gte: periodStart, lt: periodEnd },
        },
      })

  return { limit, current, periodStart, periodEnd, plan }
}
