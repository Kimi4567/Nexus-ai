/**
 * Nexus AI — CreditGrant write helpers (B1d-a foundation)
 * ─────────────────────────────────────────────────────────────────────────────
 * Idempotent helpers for CREATING and RESETTING CreditGrant rows, so that — in a
 * later step (B1d-b/c/d) — every place that writes User.aiCredits can create a
 * matching grant. THIS MODULE IS NOT WIRED INTO ANY RUNTIME PATH YET.
 *
 * Strict boundaries (enforced by design + tests):
 *   - NEVER mutates User.aiCredits.
 *   - NEVER writes a CreditTransaction.
 *   - NEVER touches Subscription / billing data.
 *   - Only inserts/updates CreditGrant rows.
 *   - Idempotency rides on the existing @@unique([userId, source]) constraint —
 *     NO new schema/SQL is introduced here.
 *
 * Flag-independent: these build the ledger regardless of CREDIT_WALLET_ENABLED.
 * They have no effect on production until a caller invokes them (B1d-b onward).
 *
 * Design reference: docs/CREDIT_WALLET_LEDGER_POLICY.md
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { prisma } from '@/lib/prisma'

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
export const STARTER_CREDITS = 10
export const STARTER_EXPIRY_DAYS = 14

/** A transaction client (or the base prisma) — helpers run inside or outside a txn. */
type GrantClient = { creditGrant: { createMany: Function; updateMany: Function } }
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
 * Referral / manual bonus grant. Policy decision (B1d): REFERRAL and MANUAL are
 * non-expiring but are treated as NON-PURCHASED, so they are RESET on the next
 * monthly renewal — matching today's aiCredits-overwrite semantics. PURCHASED is
 * deliberately NOT supported here (that's B1e).
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
 * Mark a user's ACTIVE, NON-PURCHASED grants as spent: status RESET, remaining 0.
 * This is the "monthly reset / no rollover" primitive — PURCHASED grants are left
 * untouched (they survive renewals). Used by B1d-c later; NOT called at runtime
 * in B1d-a. Never touches User.aiCredits.
 *
 * Returns `{ resetCount }` (rows affected).
 */
export async function resetNonPurchasedGrants(
  userId: string,
  tx?: unknown,
): Promise<{ resetCount: number }> {
  const res = await client(tx).creditGrant.updateMany({
    where: { userId, status: 'ACTIVE', type: { not: 'PURCHASED' } },
    data: { status: 'RESET', remaining: 0 },
  })
  return { resetCount: ((res as { count?: number })?.count ?? 0) }
}
