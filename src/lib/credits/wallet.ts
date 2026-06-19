/**
 * Nexus AI — Credit Wallet (grant-based deduction) — B1c-b
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure, side-effect-free building blocks for spending credits from the
 * CreditGrant ledger (instead of the single User.aiCredits integer).
 *
 * NOTHING here touches the database. The only impure surface is reading one
 * environment variable in `isCreditWalletEnabled()`. The actual transactional
 * deduction (load grants FOR UPDATE → decrement → write allocations) lives in
 * src/lib/credits.ts (`_deductFromGrants`) and only runs when the flag is ON.
 *
 * FEATURE FLAG: CREDIT_WALLET_ENABLED === "true" turns the grant path on.
 *   - Default (unset / anything else) = OFF = legacy scalar User.aiCredits path.
 *   - Production keeps this UNSET, so behaviour is byte-identical to before.
 *
 * Design reference: docs/CREDIT_WALLET_LEDGER_POLICY.md
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Grant-based deduction is ON only when the env flag is exactly "true".
 * Anything else (unset, "false", "1", "yes", …) means OFF — the safe default.
 */
export function isCreditWalletEnabled(): boolean {
  return process.env.CREDIT_WALLET_ENABLED === 'true'
}

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * The minimal projection of a CreditGrant row needed to decide spend order.
 * `type`/`status` are kept as plain strings so this helper never has to import
 * Prisma enums (and stays trivially unit-testable without the generated client).
 */
export interface SpendableGrant {
  id: string
  type: string // CreditGrantType: MONTHLY | PURCHASED | TRIAL | REFERRAL | REFUND | MANUAL | MIGRATED | UNLIMITED
  remaining: number
  expiresAt: Date | null // null = never expires
  status: string // CreditGrantStatus: ACTIVE | EXPIRED | RESET | VOID
  createdAt: Date
}

/** One slice of a debit: how much was drawn from a specific grant. */
export interface GrantAllocation {
  grantId: string
  amount: number
}

export type SelectGrantsResult =
  | { ok: true; allocations: GrantAllocation[]; totalSpent: number }
  | { ok: false; eligibleRemaining: number }

// ── Spend ordering ─────────────────────────────────────────────────────────────
// Tie-break priority when two grants share the same expiry: spend the most
// "perishable"/promotional credit first, hold the most durable (PURCHASED, valid
// 12 months) for last. Lower number = spent earlier.

const TYPE_PRIORITY: Record<string, number> = {
  TRIAL: 0,
  MONTHLY: 1,
  REFERRAL: 2,
  MIGRATED: 3,
  MANUAL: 4,
  REFUND: 5,
  PURCHASED: 6,
}
const UNKNOWN_TYPE_PRIORITY = 99

/**
 * A grant is eligible to spend from when it is ACTIVE, has credits left, and is
 * not past its expiry. `now` is injected so the rule is deterministic in tests.
 */
export function isGrantEligible(g: SpendableGrant, now: Date): boolean {
  return (
    g.status === 'ACTIVE' &&
    g.remaining > 0 &&
    (g.expiresAt === null || g.expiresAt.getTime() > now.getTime())
  )
}

/**
 * Order eligible grants for spending:
 *   1. soonest expiry first,
 *   2. never-expiring (null) grants last,
 *   3. tie-break by type priority (TRIAL → MONTHLY → REFERRAL → MIGRATED →
 *      MANUAL → REFUND → PURCHASED),
 *   4. then oldest createdAt first.
 */
function compareSpendOrder(a: SpendableGrant, b: SpendableGrant): number {
  // 1 + 2 — expiry (nulls last)
  const ae = a.expiresAt ? a.expiresAt.getTime() : null
  const be = b.expiresAt ? b.expiresAt.getTime() : null
  if (ae !== be) {
    if (ae === null) return 1 // a never expires → after b
    if (be === null) return -1 // b never expires → after a
    return ae - be // both dated → soonest first
  }
  // 3 — type priority
  const ap = TYPE_PRIORITY[a.type] ?? UNKNOWN_TYPE_PRIORITY
  const bp = TYPE_PRIORITY[b.type] ?? UNKNOWN_TYPE_PRIORITY
  if (ap !== bp) return ap - bp
  // 4 — oldest first
  return a.createdAt.getTime() - b.createdAt.getTime()
}

/**
 * Pure planner: decide which grants to draw `cost` credits from, and how much
 * from each, WITHOUT touching the database.
 *
 * - Filters to eligible grants (ACTIVE, remaining > 0, not expired at `now`).
 * - If the eligible total is less than `cost`, returns { ok: false } with the
 *   eligible remaining — the caller must NOT write anything (no partial spend).
 * - Otherwise returns the allocation slices in spend order. A single debit can
 *   span multiple grants (hence an array, never a single grantId).
 *
 * `cost` of 0 returns an empty allocation with ok:true (nothing is spent),
 * mirroring the scalar path's decrement-by-0 behaviour.
 */
export function selectGrantsToSpend(
  grants: SpendableGrant[],
  cost: number,
  now: Date = new Date(),
): SelectGrantsResult {
  const eligible = grants.filter((g) => isGrantEligible(g, now))
  const eligibleRemaining = eligible.reduce((sum, g) => sum + g.remaining, 0)

  if (eligibleRemaining < cost) {
    return { ok: false, eligibleRemaining }
  }

  const ordered = [...eligible].sort(compareSpendOrder)
  const allocations: GrantAllocation[] = []
  let outstanding = cost

  for (const g of ordered) {
    if (outstanding <= 0) break
    const take = Math.min(g.remaining, outstanding)
    if (take > 0) {
      allocations.push({ grantId: g.id, amount: take })
      outstanding -= take
    }
  }

  return { ok: true, allocations, totalSpent: cost - outstanding }
}
