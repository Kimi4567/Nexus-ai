/**
 * B1b — Credit Wallet ledger backfill classifier (pure, deterministic).
 *
 * Decides what the one-time migration backfill should do for a single user,
 * based ONLY on their legacy `User.aiCredits` and whether a migration grant
 * already exists. No I/O, no Prisma, no side effects — unit-testable in isolation
 * and shared by scripts/backfill-credit-grants.ts.
 *
 * Policy (see docs/CREDIT_WALLET_LEDGER_POLICY.md):
 *   - aiCredits > 0 and not yet migrated → create ONE MIGRATED grant.
 *   - aiCredits === 0                    → skip (nothing to migrate).
 *   - aiCredits < 0  (e.g. -1 unlimited) → skip; User.aiCredits stays -1.
 *   - already migrated                   → skip (idempotent re-run).
 *
 * The backfill NEVER alters User.aiCredits and NEVER changes live balance.
 */

export type BackfillDecision = 'CREATE' | 'SKIP_ZERO' | 'SKIP_UNLIMITED' | 'SKIP_MIGRATED'

/** Stable, constant source string — re-running the backfill is a no-op. */
export const MIGRATION_SOURCE = 'migration:initial-aiCredits'

/**
 * Classify a user for the initial credit-grant backfill.
 * @param aiCredits      the user's current legacy balance (`-1` = unlimited)
 * @param alreadyMigrated true if a CreditGrant with source=MIGRATION_SOURCE exists for this user
 */
export function classifyUserForBackfill(aiCredits: number, alreadyMigrated: boolean): BackfillDecision {
  // Idempotency takes precedence — never create a second migration grant.
  if (alreadyMigrated) return 'SKIP_MIGRATED'
  // Unlimited (or any negative sentinel) is represented by aiCredits, not a grant.
  if (aiCredits < 0) return 'SKIP_UNLIMITED'
  // Nothing to migrate.
  if (aiCredits === 0) return 'SKIP_ZERO'
  // Positive balance → one MIGRATED grant.
  return 'CREATE'
}

/** Shape of the MIGRATED grant the backfill should create for a CREATE decision. */
export interface MigratedGrantInput {
  type: 'MIGRATED'
  amount: number
  remaining: number
  expiresAt: null
  status: 'ACTIVE'
  source: string
}

/**
 * Build the exact grant payload for a positive-balance user. `amount` and
 * `remaining` both equal the legacy balance; the grant never expires and is
 * tagged with the constant migration source.
 */
export function buildMigratedGrant(aiCredits: number): MigratedGrantInput {
  return {
    type: 'MIGRATED',
    amount: aiCredits,
    remaining: aiCredits,
    expiresAt: null,
    status: 'ACTIVE',
    source: MIGRATION_SOURCE,
  }
}
