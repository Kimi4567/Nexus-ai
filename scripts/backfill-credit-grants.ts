/**
 * B1b — One-time Credit Wallet ledger backfill.
 *
 * Creates exactly ONE `MIGRATED` CreditGrant per user with a positive legacy
 * `User.aiCredits` balance, so no existing balance is lost when grant-based
 * spending goes live (B1c). Design: docs/CREDIT_WALLET_LEDGER_POLICY.md
 *
 * SAFETY:
 *   - DRY-RUN BY DEFAULT — prints the plan and writes nothing.
 *   - Requires the explicit `--apply` flag to write.
 *   - IDEMPOTENT — uses source="migration:initial-aiCredits" + the
 *     CreditGrant @@unique([userId, source]) constraint (createMany skipDuplicates),
 *     so re-running creates no duplicates.
 *   - NEVER alters User.aiCredits. NEVER deducts/expires credits. NEVER changes
 *     live balance. Only creates MIGRATED grant rows.
 *   - Skips aiCredits === 0 and aiCredits < 0 (unlimited stays -1).
 *
 * PREREQUISITE: apply prisma/migrations/credit_grant_ledger.sql in Supabase first.
 *
 * USAGE:
 *   Dry run: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/backfill-credit-grants.ts
 *   Apply:   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/backfill-credit-grants.ts --apply
 *
 * Do NOT run on build/deploy. Do NOT run in production without explicit approval.
 */

import { PrismaClient } from '@prisma/client'
import {
  classifyUserForBackfill,
  buildMigratedGrant,
  MIGRATION_SOURCE,
} from '../src/lib/credits/backfillClassify'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')
const PAGE = 500

async function main() {
  const mode = APPLY ? 'APPLY (writing grants)' : 'DRY-RUN (no writes)'
  console.log(`\n[backfill-credit-grants] mode: ${mode}`)
  console.log(`[backfill-credit-grants] source: "${MIGRATION_SOURCE}"\n`)

  let scanned = 0
  let created = 0
  let skippedZero = 0
  let skippedUnlimited = 0
  let skippedAlreadyMigrated = 0

  let cursor: string | undefined
  // Keyset pagination by id so the scan is stable on large tables.
  for (;;) {
    const users = await prisma.user.findMany({
      take: PAGE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: { id: true, aiCredits: true },
    })
    if (users.length === 0) break
    cursor = users[users.length - 1].id

    // Which of these users already have a migration grant?
    const ids = users.map((u) => u.id)
    const existing = await (prisma as any).creditGrant.findMany({
      where: { userId: { in: ids }, source: MIGRATION_SOURCE },
      select: { userId: true },
    })
    const migratedSet = new Set<string>(existing.map((g: { userId: string }) => g.userId))

    const toCreate: Array<{ userId: string } & ReturnType<typeof buildMigratedGrant>> = []

    for (const u of users) {
      scanned++
      const decision = classifyUserForBackfill(u.aiCredits, migratedSet.has(u.id))
      switch (decision) {
        case 'CREATE':
          toCreate.push({ userId: u.id, ...buildMigratedGrant(u.aiCredits) })
          break
        case 'SKIP_ZERO':
          skippedZero++
          break
        case 'SKIP_UNLIMITED':
          skippedUnlimited++
          break
        case 'SKIP_MIGRATED':
          skippedAlreadyMigrated++
          break
      }
    }

    if (toCreate.length > 0) {
      if (APPLY) {
        // skipDuplicates + the unique (userId, source) index = belt-and-suspenders idempotency.
        const res = await (prisma as any).creditGrant.createMany({
          data: toCreate,
          skipDuplicates: true,
        })
        created += res.count
      } else {
        created += toCreate.length
        for (const g of toCreate.slice(0, 5)) {
          console.log(`  [dry-run] would create MIGRATED grant: user=${g.userId} amount=${g.amount}`)
        }
        if (toCreate.length > 5) console.log(`  [dry-run] …and ${toCreate.length - 5} more in this page`)
      }
    }
  }

  console.log('\n[backfill-credit-grants] summary')
  console.log(`  users scanned:            ${scanned}`)
  console.log(`  grants ${APPLY ? 'created ' : 'to create'}:        ${created}`)
  console.log(`  skipped (zero balance):   ${skippedZero}`)
  console.log(`  skipped (unlimited <0):   ${skippedUnlimited}`)
  console.log(`  skipped (already migrated): ${skippedAlreadyMigrated}`)
  console.log(
    APPLY
      ? '\n[backfill-credit-grants] done. User.aiCredits was NOT modified.\n'
      : '\n[backfill-credit-grants] DRY-RUN only — nothing written. Re-run with --apply to write.\n',
  )
}

main()
  .catch((e) => {
    console.error('[backfill-credit-grants] FAILED:', e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
