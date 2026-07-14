/**
 * Nexus AI — CreditGrant write helpers (flag-gated wallet migration)
 * ─────────────────────────────────────────────────────────────────────────────
 * Idempotent helpers for creating, renewing, cancelling, and fulfilling wallet
 * grants. Runtime billing, cron, admin, referral, and debit paths use this
 * ledger while User.aiCredits remains a derived compatibility cache.
 *
 * Strict boundaries (enforced by design + tests):
 *   - Grant builders/writers never mutate unrelated billing/subscription data.
 *   - `syncCachedWalletBalance` is the only helper here allowed to update the
 *     derived User.aiCredits cache.
 *   - Fulfilment writes one CreditTransaction only when a grant is newly created.
 *   - NEVER touches Subscription / billing data.
 *   - Only inserts/updates CreditGrant rows.
 *   - Idempotency rides on the existing @@unique([userId, source]) constraint —
 *     NO new schema/SQL is introduced here.
 *
 * Flag-independent: these build the ledger regardless of CREDIT_WALLET_ENABLED;
 * callers choose when to invoke them. The spend/read path remains gated by the
 * wallet feature flag.
 *
 * Design reference: docs/CREDIT_WALLET_LEDGER_POLICY.md
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { prisma } from '@/lib/prisma'
import { FREE_TRIAL_CREDITS } from '@/lib/commercialPlans'

// CreditGrant enums are kept as plain string unions so this module never has to
// import the generated Prisma client types (consistent with wallet.ts).
export type CreditGrantTypeName =
  | 'MONTHLY'
  | 'PURCHASED'
  | 'TRIAL'
  | 'REFERRAL'
  | 'REFUND'
  | 'MANUAL'
  | 'MIGRATED'
  | 'UNLIMITED'

export type CreditGrantStatusName = 'ACTIVE' | 'EXPIRED' | 'RESET' | 'VOID'

const DAY_MS = 24 * 60 * 60 * 1000

/** Free/trial starter allowance + its expiry window (policy: trial expires in 14 days). */
export const STARTER_CREDITS = FREE_TRIAL_CREDITS
export const STARTER_EXPIRY_DAYS = 14
export const PURCHASED_VALIDITY_MONTHS = 12

/** A transaction client (or the base prisma) — helpers run inside or outside a txn. */
type GrantClient = {
  creditGrant: {
    createMany: Function
    updateMany: Function
    findMany?: Function
  }
}
function client(tx?: unknown): GrantClient {
  return (tx ?? prisma) as unknown as GrantClient
}

// ── Deterministic grant sources ─────────────────────────────────────────────
// `source` is the idempotency key (CreditGrant @@unique([userId, source])). The
// SAME inputs must always produce the SAME source so a Stripe retry, or the
// webhook and the monthly cron both firing, resolve to ONE grant.

/**
 * Monthly grant source for one billing cycle. Stable across the webhook and the
 * cron because both derive it from the subscription id + currentPeriodStart.
 */
export function monthlySource(
  stripeSubscriptionId: string,
  currentPeriodStart: Date | string,
): string {
  const iso =
    currentPeriodStart instanceof Date
      ? currentPeriodStart.toISOString()
      : new Date(currentPeriodStart).toISOString()
  return `monthly:${stripeSubscriptionId}:${iso}`
}

/** The one-time starter/free grant source. */
export function starterSource(): string {
  return 'starter:initial'
}

/** Referral bonus source — unique per (referrer, referred) pair. */
export function referralSource(referrerId: string, referredId: string): string {
  return `referral:${referrerId}:${referredId}`
}

/**
 * Manual/admin grant source. Deterministic when an explicit action id is given
 * (so re-running the same admin action is idempotent). Callers that have no
 * stable id should pass a unique one they generate.
 */
export function manualSource(actionId: string): string {
  return `manual:${actionId}`
}

/** Stripe Checkout session IDs are globally unique and safe idempotency keys. */
export function purchaseSource(checkoutSessionId: string): string {
  return `stripe:checkout:${checkoutSessionId}`
}

// ── Grant shape builders (pure) ─────────────────────────────────────────────

export interface GrantInput {
  userId: string
  type: CreditGrantTypeName
  amount: number
  /** Defaults to `amount` when omitted. */
  remaining?: number
  expiresAt: Date | null
  source: string
  billingCycleId?: string | null
  /** Defaults to ACTIVE. */
  status?: CreditGrantStatusName
}

/**
 * Starter/free grant: a 14-day TRIAL bucket of STARTER_CREDITS. `now` is injected
 * for deterministic tests.
 */
export function buildStarterGrant(userId: string, now: Date = new Date()): GrantInput {
  return {
    userId,
    type: 'TRIAL',
    amount: STARTER_CREDITS,
    remaining: STARTER_CREDITS,
    expiresAt: new Date(now.getTime() + STARTER_EXPIRY_DAYS * DAY_MS),
    source: starterSource(),
    status: 'ACTIVE',
  }
}

export interface MonthlyGrantArgs {
  stripeSubscriptionId: string
  currentPeriodStart: Date
  /** null = open-ended; otherwise the grant expires at period end (no rollover). */
  currentPeriodEnd: Date | null
  /** Plan allowance for the cycle (caller computes from PLAN_CREDITS in B1d-c). */
  amount: number
}

/**
 * Monthly plan grant for one billing cycle. Expires at period end (credits do
 * not roll over). `source` + `billingCycleId` are the deterministic cycle key.
 */
export function buildMonthlyGrant(userId: string, sub: MonthlyGrantArgs): GrantInput {
  const source = monthlySource(sub.stripeSubscriptionId, sub.currentPeriodStart)
  return {
    userId,
    type: 'MONTHLY',
    amount: sub.amount,
    remaining: sub.amount,
    expiresAt: sub.currentPeriodEnd ?? null,
    source,
    billingCycleId: source,
    status: 'ACTIVE',
  }
}

/**
 * Referral / manual bonus grant. These balances are independent of a monthly
 * subscription cycle, so renewal never wipes them. Purchased credit has its
 * own 12-month builder below.
 */
export function buildBonusGrant(
  userId: string,
  type: 'REFERRAL' | 'MANUAL',
  amount: number,
  source: string,
): GrantInput {
  return {
    userId,
    type,
    amount,
    remaining: amount,
    expiresAt: null,
    source,
    status: 'ACTIVE',
  }
}

/** One-time purchased credits, valid for 12 calendar months. */
export function buildPurchasedGrant(
  userId: string,
  checkoutSessionId: string,
  amount: number,
  purchasedAt: Date = new Date(),
): GrantInput {
  const expiresAt = new Date(purchasedAt)
  expiresAt.setUTCMonth(expiresAt.getUTCMonth() + PURCHASED_VALIDITY_MONTHS)
  return {
    userId,
    type: 'PURCHASED',
    amount,
    remaining: amount,
    expiresAt,
    source: purchaseSource(checkoutSessionId),
    status: 'ACTIVE',
  }
}

// ── Idempotent writes ────────────────────────────────────────────────────────

/**
 * Create a CreditGrant if one with this (userId, source) doesn't already exist.
 * Idempotent via `createMany({ skipDuplicates })` + the existing unique index, so
 * calling it twice (Stripe retry, webhook+cron overlap) creates at most one row.
 *
 * Returns `{ created }` — true when a new row was inserted, false when the grant
 * already existed. Never reads or writes User.aiCredits or CreditTransaction.
 */
export async function ensureGrant(
  input: GrantInput,
  tx?: unknown,
): Promise<{ created: boolean }> {
  const res = await client(tx).creditGrant.createMany({
    data: [
      {
        userId: input.userId,
        type: input.type,
        amount: input.amount,
        remaining: input.remaining ?? input.amount,
        expiresAt: input.expiresAt ?? null,
        source: input.source,
        billingCycleId: input.billingCycleId ?? null,
        status: input.status ?? 'ACTIVE',
      },
    ],
    skipDuplicates: true,
  })
  return { created: ((res as { count?: number })?.count ?? 0) > 0 }
}

/**
 * Mark a user's ACTIVE subscription-cycle grants as spent: status RESET,
 * remaining 0. This covers MONTHLY plus the transitional MIGRATED grant from
 * the scalar-balance backfill, so enabling the wallet cannot double-count a
 * legacy balance alongside the first monthly grant. Purchased, referral,
 * trial, refund, and manual grants remain untouched. Never touches User.aiCredits.
 *
 * `exceptSource` (B1d-c): when given, the grant with that source is EXCLUDED from
 * the reset — used by `ensureMonthlyGrant` so the just-created MONTHLY grant for
 * the current cycle is not itself reset. (In Postgres, `source != x` also
 * excludes NULL-source rows; every grant we create carries a source.)
 *
 * Returns `{ resetCount }` (rows affected).
 */
export async function resetMonthlyGrants(
  userId: string,
  tx?: unknown,
  exceptSource?: string,
): Promise<{ resetCount: number }> {
  const where: Record<string, unknown> = {
    userId,
    status: 'ACTIVE',
    type: { in: ['MONTHLY', 'MIGRATED'] },
  }
  if (exceptSource) where.source = { not: exceptSource }
  const res = await client(tx).creditGrant.updateMany({
    where,
    data: { status: 'RESET', remaining: 0 },
  })
  return { resetCount: ((res as { count?: number })?.count ?? 0) }
}

/**
 * @deprecated Use resetMonthlyGrants. Kept as a compatibility alias for
 * migration scripts and older callers; the implementation resets only
 * subscription-cycle grants (MONTHLY/MIGRATED), never every non-purchased grant.
 */
export const resetNonPurchasedGrants = resetMonthlyGrants

/**
 * Provision one billing cycle's MONTHLY grant (B1d-c). Idempotent per cycle:
 *
 *   1. Create the cycle's MONTHLY grant (idempotent via @@unique([userId, source])).
 *   2. ONLY if it was newly created, RESET prior ACTIVE subscription-cycle
 *      grants (MONTHLY and transitional MIGRATED; excluding this cycle).
 *      Other grant types are independent balances and are never reset by
 *      subscription renewal.
 *
 * Create-first + the `created` flag (decided atomically by the unique constraint)
 * mean a duplicate webhook / Stripe retry / same-cycle re-provision neither
 * duplicates the grant nor resets a second time, and the new grant is never wiped.
 * Never touches User.aiCredits. Caller passes the plan allowance as `amount`.
 */
export async function ensureMonthlyGrant(
  userId: string,
  args: MonthlyGrantArgs,
  tx?: unknown,
): Promise<{ created: boolean }> {
  const source = monthlySource(args.stripeSubscriptionId, args.currentPeriodStart)
  const { created } = await ensureGrant(buildMonthlyGrant(userId, args), tx)
  if (created) {
    await resetMonthlyGrants(userId, tx, source)
  } else {
    // The migration and runtime rollout can be ordered either way. If this
    // cycle already exists (for example the webhook ran before backfill),
    // retire any still-active transitional MIGRATED balance as well; otherwise
    // enabling the wallet would sum it on top of the existing monthly grant.
    await client(tx).creditGrant.updateMany({
      where: { userId, status: 'ACTIVE', type: 'MIGRATED' },
      data: { status: 'RESET', remaining: 0 },
    })
  }
  return { created }
}

/**
 * Cancellation primitive (B1d-c-3): VOID a user's ACTIVE subscription-cycle
 * grants (MONTHLY plus transitional MIGRATED) (status VOID, remaining 0).
 * Purchased credits survive cancellation, and referral/trial/manual/refund
 * balances remain available. Never touches User.aiCredits.
 *
 * Idempotent: re-running on an already-cancelled user matches no ACTIVE
 * cycle grants and voids nothing. Distinct status (VOID) from the
 * monthly-renewal RESET so credit history can tell cancellation apart.
 *
 * Returns `{ voidCount }` (rows affected).
 */
export async function voidMonthlyGrants(
  userId: string,
  tx?: unknown,
): Promise<{ voidCount: number }> {
  const res = await client(tx).creditGrant.updateMany({
    where: { userId, status: 'ACTIVE', type: { in: ['MONTHLY', 'MIGRATED'] } },
    data: { status: 'VOID', remaining: 0 },
  })
  return { voidCount: ((res as { count?: number })?.count ?? 0) }
}

/**
 * @deprecated Use voidMonthlyGrants. Kept for callers during the additive
 * wallet migration; only subscription-cycle grants are voided.
 */
export const voidNonPurchasedGrants = voidMonthlyGrants

/**
 * Mark every expired ACTIVE grant as EXPIRED and clear its remaining balance.
 * Expiry is enforced by spend/status queries immediately, but this sweep keeps
 * ledger status and the cached User.aiCredits value auditable. The caller should
 * run it inside a transaction and sync each returned userId's cache afterwards.
 *
 * Returns the affected user ids so callers can recompute only those caches.
 */
export async function expireCreditGrants(
  now: Date = new Date(),
  tx?: unknown,
): Promise<{ expiredCount: number; userIds: string[] }> {
  const db = client(tx) as any
  if (typeof db.creditGrant.findMany !== 'function') {
    throw new Error('CreditGrant.findMany is unavailable; apply the wallet migration first')
  }
  const expired = await db.creditGrant.findMany({
    where: {
      status: 'ACTIVE',
      expiresAt: { lte: now },
    },
    select: { id: true, userId: true },
  }) as Array<{ id: string; userId: string }>
  if (expired.length === 0) return { expiredCount: 0, userIds: [] }

  const ids = expired.map((grant) => grant.id)
  await db.creditGrant.updateMany({
    where: { id: { in: ids }, status: 'ACTIVE' },
    data: { status: 'EXPIRED', remaining: 0 },
  })
  return {
    expiredCount: expired.length,
    userIds: Array.from(new Set(expired.map((grant) => grant.userId))),
  }
}

/**
 * Recompute the legacy User.aiCredits cache from valid wallet grants. This must
 * run inside the same transaction as renewal, cancellation, or pack fulfilment.
 */
export async function syncCachedWalletBalance(
  userId: string,
  tx: unknown,
  now: Date = new Date(),
): Promise<number> {
  const db = tx as any
  const aggregate = await db.creditGrant.aggregate({
    where: {
      userId,
      status: 'ACTIVE',
      remaining: { gt: 0 },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    _sum: { remaining: true },
  })
  const balance = Math.max(0, aggregate?._sum?.remaining ?? 0)
  await db.user.update({ where: { id: userId }, data: { aiCredits: balance } })
  return balance
}

/** Idempotently fulfil one verified Stripe credit-pack checkout. */
export async function fulfilPurchasedCreditPack(
  args: {
    userId: string
    checkoutSessionId: string
    credits: number
    purchasedAt?: Date
  },
  tx: unknown,
): Promise<{ created: boolean; balance: number }> {
  if (!Number.isInteger(args.credits) || args.credits <= 0) {
    throw new Error('Purchased credit amount must be a positive integer')
  }
  const { created } = await ensureGrant(
    buildPurchasedGrant(
      args.userId,
      args.checkoutSessionId,
      args.credits,
      args.purchasedAt ?? new Date(),
    ),
    tx,
  )
  if (created) {
    const db = tx as any
    await db.creditTransaction.create({
      data: {
        userId: args.userId,
        action: 'CREDIT_PACK_PURCHASE',
        description: `${args.credits} purchased credits`,
        amount: args.credits,
        entityId: args.checkoutSessionId,
        entityType: 'credit_pack',
      },
    })
  }
  const balance = await syncCachedWalletBalance(args.userId, tx)
  return { created, balance }
}
