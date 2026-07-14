-- Credit Wallet Ledger — CreditGrant foundation (B1b)
-- Design reference: docs/CREDIT_WALLET_LEDGER_POLICY.md
--
-- HOW TO APPLY: paste into the Supabase SQL Editor and run
--   (https://supabase.com/dashboard → SQL Editor).
--   This repo does NOT use `prisma migrate` for production.
--
-- SAFE TO RERUN: every statement is idempotent (guarded enum creation +
--   IF NOT EXISTS table/indexes). Running it twice changes nothing.
--
-- THIS FILE DOES NOT BACKFILL DATA. It only creates the enums, the CreditGrant
--   table, and its indexes. Populating grants from the legacy User.aiCredits
--   balance is a SEPARATE manual step:
--     npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/backfill-credit-grants.ts --apply
--
-- Runtime reads/writes are feature-flagged. With CREDIT_WALLET_ENABLED unset or
-- false, User.aiCredits remains the legacy authoritative path; enabling the flag
-- requires this table plus the idempotent backfill to be present first.

-- 1. Enums (guarded — CREATE TYPE has no IF NOT EXISTS) -----------------------
DO $$ BEGIN
  CREATE TYPE "CreditGrantType" AS ENUM (
    'MONTHLY', 'PURCHASED', 'TRIAL', 'REFERRAL', 'REFUND', 'MANUAL', 'MIGRATED', 'UNLIMITED'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CreditGrantStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'RESET', 'VOID');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. CreditGrant table --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "CreditGrant" (
  "id"             TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId"         TEXT NOT NULL,
  "type"           "CreditGrantType" NOT NULL,
  "amount"         INTEGER NOT NULL,
  "remaining"      INTEGER NOT NULL,
  "expiresAt"      TIMESTAMP(3),
  "source"         TEXT,
  "billingCycleId" TEXT,
  "status"         "CreditGrantStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditGrant_pkey" PRIMARY KEY ("id")
);

-- 3. Foreign key to User (cascade on delete) — guarded -----------------------
DO $$ BEGIN
  ALTER TABLE "CreditGrant"
    ADD CONSTRAINT "CreditGrant_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 4. Indexes + unique constraint (names match Prisma's defaults) -------------
-- Idempotency key: at most one grant per (userId, source). NULL source rows are
-- distinct in Postgres, so multiple null-source grants per user remain allowed.
CREATE UNIQUE INDEX IF NOT EXISTS "CreditGrant_userId_source_key"
  ON "CreditGrant" ("userId", "source");

-- Primary spend query (B1c): a user's ACTIVE grants ordered by soonest expiry.
CREATE INDEX IF NOT EXISTS "CreditGrant_userId_status_expiresAt_idx"
  ON "CreditGrant" ("userId", "status", "expiresAt");

CREATE INDEX IF NOT EXISTS "CreditGrant_userId_type_status_idx"
  ON "CreditGrant" ("userId", "type", "status");

CREATE INDEX IF NOT EXISTS "CreditGrant_source_idx"
  ON "CreditGrant" ("source");

CREATE INDEX IF NOT EXISTS "CreditGrant_billingCycleId_idx"
  ON "CreditGrant" ("billingCycleId");
