import { prisma } from '@/lib/prisma'
import { resolveBillingStatusPlan } from '@/lib/billingStatusPlan'
import { FREE_STARTER_CREDITS } from '@/lib/credits'
import { isCreditWalletEnabled } from '@/lib/credits/wallet'
import { PLAN_CREDITS } from '@/lib/stripe'

export interface CreditGrantBalanceInput {
  type: string
  remaining: number
  expiresAt: Date | null
}

export interface CreditBreakdown {
  monthly: number
  purchased: number
  trial: number
  referral: number
  refund: number
  manual: number
  migrated: number
  other: number
  nextPurchasedExpiry: Date | null
}

interface CreditDisplayInput {
  subscriptionStatus: string | null
  aiCredits: number | null
  monthlyGenerations: number | null
  planName: string
  hasActiveSubscription: boolean
  walletEnabled: boolean
  grants: CreditGrantBalanceInput[]
}

export function resolveCreditDisplay(input: CreditDisplayInput) {
  const maxCredits = PLAN_CREDITS[input.planName] ?? FREE_STARTER_CREDITS
  const storedCredits = input.aiCredits ?? 0
  const isUnlimited = storedCredits === -1
  const isFreeStarterEligible =
    !input.hasActiveSubscription &&
    String(input.subscriptionStatus ?? '').toUpperCase() === 'FREE' &&
    storedCredits === 0 &&
    (input.monthlyGenerations ?? 0) === 0

  if (isUnlimited) {
    return {
      remaining: -1,
      used: 0,
      max: -1,
      isUnlimited: true,
      creditBreakdown: null,
      pendingStarterCredits: false,
    }
  }

  let remaining = storedCredits > 0
    ? storedCredits
    : isFreeStarterEligible
      ? FREE_STARTER_CREDITS
      : 0
  let used = maxCredits === -1 ? 0 : Math.max(0, maxCredits - remaining)
  let creditBreakdown: CreditBreakdown | null = null
  let pendingStarterCredits = false

  if (input.walletEnabled) {
    creditBreakdown = input.grants.reduce((summary, grant) => {
      const amount = Math.max(0, grant.remaining)
      if (grant.type === 'MONTHLY') summary.monthly += amount
      else if (grant.type === 'PURCHASED') {
        summary.purchased += amount
        if (grant.expiresAt && (!summary.nextPurchasedExpiry || grant.expiresAt < summary.nextPurchasedExpiry)) {
          summary.nextPurchasedExpiry = grant.expiresAt
        }
      } else if (grant.type === 'TRIAL') summary.trial += amount
      else if (grant.type === 'REFERRAL') summary.referral += amount
      else if (grant.type === 'REFUND') summary.refund += amount
      else if (grant.type === 'MANUAL') summary.manual += amount
      else if (grant.type === 'MIGRATED') summary.migrated += amount
      else summary.other += amount
      return summary
    }, {
      monthly: 0,
      purchased: 0,
      trial: 0,
      referral: 0,
      refund: 0,
      manual: 0,
      migrated: 0,
      other: 0,
      nextPurchasedExpiry: null,
    } as CreditBreakdown)

    const ledgerBalance =
      creditBreakdown.monthly +
      creditBreakdown.purchased +
      creditBreakdown.trial +
      creditBreakdown.referral +
      creditBreakdown.refund +
      creditBreakdown.manual +
      creditBreakdown.migrated +
      creditBreakdown.other

    pendingStarterCredits = isFreeStarterEligible && ledgerBalance === 0
    remaining = pendingStarterCredits ? FREE_STARTER_CREDITS : ledgerBalance
    const renewableRemaining = pendingStarterCredits
      ? FREE_STARTER_CREDITS
      : input.hasActiveSubscription
        ? creditBreakdown.monthly
        : creditBreakdown.trial
    used = maxCredits === -1 ? 0 : Math.max(0, maxCredits - renewableRemaining)

    // The first AI action creates the starter grant. Until then, show the
    // spendable pending allowance but do not claim a ledger bucket exists.
    if (pendingStarterCredits) creditBreakdown = null
  }

  return {
    remaining,
    used,
    max: maxCredits,
    isUnlimited: false,
    creditBreakdown,
    pendingStarterCredits,
  }
}

export async function getCreditAccountSnapshot(userId: string) {
  const [dbUser, subscription] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        subscriptionStatus: true,
        aiCredits: true,
        monthlyGenerations: true,
        stripeCustomerId: true,
      },
    }),
    prisma.subscription.findUnique({
      where: { userId },
      select: {
        plan: true,
        status: true,
        currentPeriodEnd: true,
        monthlyCredits: true,
        cancelledAt: true,
      },
    }),
  ])

  if (!dbUser) return null

  const planStatus = resolveBillingStatusPlan({
    subscriptionPlan: subscription?.plan,
    subscriptionStatus: subscription?.status,
    userSubscriptionStatus: dbUser.subscriptionStatus,
  })
  const walletEnabled = isCreditWalletEnabled()
  const now = new Date()
  const grants = walletEnabled
    ? await prisma.creditGrant.findMany({
        where: {
          userId,
          status: 'ACTIVE',
          remaining: { gt: 0 },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        select: { type: true, remaining: true, expiresAt: true },
      })
    : []

  const credits = resolveCreditDisplay({
    subscriptionStatus: dbUser.subscriptionStatus,
    aiCredits: dbUser.aiCredits,
    monthlyGenerations: dbUser.monthlyGenerations,
    planName: planStatus.plan,
    hasActiveSubscription: planStatus.hasActiveSubscription,
    walletEnabled,
    grants,
  })

  return {
    user: dbUser,
    subscription,
    planName: planStatus.plan,
    hasActiveSubscription: planStatus.hasActiveSubscription,
    walletEnabled,
    credits,
  }
}
