/**
 * One-time production-safe CreditGrant reconciliation.
 *
 * User.aiCredits remains authoritative until CREDIT_WALLET_ENABLED is enabled.
 * This script makes the eligible grant sum match that balance. It is dry-run by
 * default and requires --apply to write. It prints aggregate counts only.
 *
 * Usage:
 *   node --env-file=.env scripts/reconcile-credit-wallet-cutover.mjs
 *   node --env-file=.env scripts/reconcile-credit-wallet-cutover.mjs --apply
 */

import { PrismaClient } from '@prisma/client'
import { planWalletCutover } from '../src/lib/credits/walletCutover.ts'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')
const SOURCE_PREFIX = 'migration:wallet-cutover:v1'
const PAGE_SIZE = 250

function emptyStats() {
  return {
    scanned: 0,
    alreadyAligned: 0,
    grantsCreated: 0,
    creditsAdded: 0,
    grantsReduced: 0,
    creditsReduced: 0,
    cancelledReconciled: 0,
    nonPurchasedVoided: 0,
    unlimitedSkipped: 0,
  }
}

async function loadUser(db, userId) {
  return db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      aiCredits: true,
      subscriptionStatus: true,
      creditGrants: {
        select: {
          id: true,
          type: true,
          remaining: true,
          expiresAt: true,
          status: true,
          createdAt: true,
        },
      },
    },
  })
}

function addPlanToStats(stats, plan) {
  if (plan.kind === 'SKIP_UNLIMITED') {
    stats.unlimitedSkipped++
    return
  }
  if (plan.kind === 'CANCELLED_PURCHASED_ONLY') stats.cancelledReconciled++
  if (
    plan.targetBalance === plan.eligibleBefore &&
    !plan.voidActiveNonPurchased &&
    plan.migratedGrantAmount === 0 &&
    plan.reductions.length === 0
  ) {
    stats.alreadyAligned++
  }
  if (plan.migratedGrantAmount > 0) {
    stats.grantsCreated++
    stats.creditsAdded += plan.migratedGrantAmount
  }
  stats.grantsReduced += plan.reductions.length
  stats.creditsReduced += plan.reductions.reduce((sum, item) => sum + item.amount, 0)
  if (plan.voidActiveNonPurchased) stats.nonPurchasedVoided++
}

async function applyPlan(tx, user, plan, now) {
  if (plan.kind === 'SKIP_UNLIMITED') return

  if (plan.voidActiveNonPurchased) {
    await tx.creditGrant.updateMany({
      where: { userId: user.id, status: 'ACTIVE', type: { not: 'PURCHASED' } },
      data: { status: 'VOID', remaining: 0 },
    })
  }

  for (const reduction of plan.reductions) {
    const result = await tx.creditGrant.updateMany({
      where: {
        id: reduction.grantId,
        userId: user.id,
        status: 'ACTIVE',
        remaining: { gte: reduction.amount },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      data: { remaining: { decrement: reduction.amount } },
    })
    if (result.count !== 1) throw new Error('Concurrent credit grant update detected')
  }

  if (plan.migratedGrantAmount > 0) {
    const source = `${SOURCE_PREFIX}:${user.aiCredits}:${plan.eligibleBefore}`
    const result = await tx.creditGrant.createMany({
      data: [
        {
          userId: user.id,
          type: 'MIGRATED',
          amount: plan.migratedGrantAmount,
          remaining: plan.migratedGrantAmount,
          expiresAt: null,
          source,
          status: 'ACTIVE',
        },
      ],
      skipDuplicates: true,
    })
    if (result.count !== 1) throw new Error('Wallet cutover grant already exists but balance is mismatched')
  }

  await tx.user.update({
    where: { id: user.id, aiCredits: user.aiCredits },
    data: { aiCredits: plan.targetBalance },
  })

  const aggregate = await tx.creditGrant.aggregate({
    where: {
      userId: user.id,
      status: 'ACTIVE',
      remaining: { gt: 0 },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    _sum: { remaining: true },
  })
  const reconciledBalance = aggregate._sum.remaining ?? 0
  if (reconciledBalance !== plan.targetBalance) {
    throw new Error('Wallet cutover invariant failed')
  }
}

async function main() {
  const stats = emptyStats()
  const now = new Date()
  let cursor

  for (;;) {
    const users = await prisma.user.findMany({
      take: PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: { id: true },
    })
    if (users.length === 0) break
    cursor = users.at(-1).id

    for (const item of users) {
      const user = await loadUser(prisma, item.id)
      const plan = planWalletCutover({
        legacyBalance: user.aiCredits,
        subscriptionStatus: user.subscriptionStatus,
        grants: user.creditGrants,
        now,
      })
      stats.scanned++
      addPlanToStats(stats, plan)

      if (APPLY && plan.kind !== 'SKIP_UNLIMITED') {
        await prisma.$transaction(
          async (tx) => {
            const current = await loadUser(tx, user.id)
            const currentPlan = planWalletCutover({
              legacyBalance: current.aiCredits,
              subscriptionStatus: current.subscriptionStatus,
              grants: current.creditGrants,
              now,
            })
            await applyPlan(tx, current, currentPlan, now)
          },
          { isolationLevel: 'Serializable' },
        )
      }
    }
  }

  console.log(`[credit-wallet-cutover] mode=${APPLY ? 'APPLY' : 'DRY_RUN'}`)
  for (const [key, value] of Object.entries(stats)) console.log(`${key}=${value}`)
  if (!APPLY) console.log('No data was written. Re-run with --apply after reviewing these totals.')
}

main()
  .catch((error) => {
    console.error('[credit-wallet-cutover] FAILED:', error instanceof Error ? error.message : 'unknown error')
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
