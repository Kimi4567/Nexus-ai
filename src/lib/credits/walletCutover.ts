/**
 * Pure planner for the one-time legacy balance -> CreditGrant wallet cutover.
 *
 * Before CREDIT_WALLET_ENABLED is turned on, User.aiCredits is authoritative.
 * This planner produces the minimum grant changes needed to make the spendable
 * grant total equal that legacy balance. Cancelled accounts are the exception:
 * only unexpired PURCHASED credits survive cancellation.
 */

export interface CutoverGrant {
  id: string
  type: string
  remaining: number
  expiresAt: Date | null
  status: string
  createdAt: Date
}

export interface WalletCutoverInput {
  legacyBalance: number
  subscriptionStatus: string
  grants: CutoverGrant[]
  now?: Date
}

export type WalletCutoverPlan =
  | {
      kind: 'SKIP_UNLIMITED'
      targetBalance: number
      eligibleBefore: number
      reductions: []
      migratedGrantAmount: 0
      voidActiveNonPurchased: false
    }
  | {
      kind: 'RECONCILE' | 'CANCELLED_PURCHASED_ONLY'
      targetBalance: number
      eligibleBefore: number
      reductions: Array<{ grantId: string; amount: number }>
      migratedGrantAmount: number
      voidActiveNonPurchased: boolean
    }

const TYPE_PRIORITY: Record<string, number> = {
  TRIAL: 0,
  MONTHLY: 1,
  REFERRAL: 2,
  MIGRATED: 3,
  MANUAL: 4,
  REFUND: 5,
  PURCHASED: 6,
}

function isEligible(grant: CutoverGrant, now: Date): boolean {
  return (
    grant.status === 'ACTIVE' &&
    grant.remaining > 0 &&
    (grant.expiresAt === null || grant.expiresAt.getTime() > now.getTime())
  )
}

function compareSpendOrder(a: CutoverGrant, b: CutoverGrant): number {
  const aExpiry = a.expiresAt?.getTime() ?? null
  const bExpiry = b.expiresAt?.getTime() ?? null
  if (aExpiry !== bExpiry) {
    if (aExpiry === null) return 1
    if (bExpiry === null) return -1
    return aExpiry - bExpiry
  }

  const typeDifference = (TYPE_PRIORITY[a.type] ?? 99) - (TYPE_PRIORITY[b.type] ?? 99)
  if (typeDifference !== 0) return typeDifference
  return a.createdAt.getTime() - b.createdAt.getTime()
}

function planReductions(grants: CutoverGrant[], amount: number): Array<{ grantId: string; amount: number }> {
  if (amount <= 0) return []

  const reductions: Array<{ grantId: string; amount: number }> = []
  let remaining = amount
  for (const grant of [...grants].sort(compareSpendOrder)) {
    if (remaining <= 0) break
    const reduction = Math.min(grant.remaining, remaining)
    if (reduction > 0) {
      reductions.push({ grantId: grant.id, amount: reduction })
      remaining -= reduction
    }
  }

  if (remaining !== 0) {
    throw new Error('Wallet cutover reduction plan is underfunded')
  }
  return reductions
}

export function planWalletCutover(input: WalletCutoverInput): WalletCutoverPlan {
  const now = input.now ?? new Date()
  const eligible = input.grants.filter((grant) => isEligible(grant, now))
  const eligibleBefore = eligible.reduce((sum, grant) => sum + grant.remaining, 0)

  // Negative values are legacy unlimited sentinels and must not be converted.
  if (input.legacyBalance < 0) {
    return {
      kind: 'SKIP_UNLIMITED',
      targetBalance: input.legacyBalance,
      eligibleBefore,
      reductions: [],
      migratedGrantAmount: 0,
      voidActiveNonPurchased: false,
    }
  }

  if (input.subscriptionStatus === 'CANCELLED') {
    const purchased = eligible.filter((grant) => grant.type === 'PURCHASED')
    const purchasedBalance = purchased.reduce((sum, grant) => sum + grant.remaining, 0)
    return {
      kind: 'CANCELLED_PURCHASED_ONLY',
      targetBalance: purchasedBalance,
      eligibleBefore,
      reductions: [],
      migratedGrantAmount: 0,
      voidActiveNonPurchased: input.grants.some(
        (grant) => grant.status === 'ACTIVE' && grant.type !== 'PURCHASED',
      ),
    }
  }

  const difference = input.legacyBalance - eligibleBefore
  return {
    kind: 'RECONCILE',
    targetBalance: input.legacyBalance,
    eligibleBefore,
    reductions: difference < 0 ? planReductions(eligible, Math.abs(difference)) : [],
    migratedGrantAmount: difference > 0 ? difference : 0,
    voidActiveNonPurchased: false,
  }
}
