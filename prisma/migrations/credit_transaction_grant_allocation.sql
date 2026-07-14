-- Credit Wallet Ledger — CreditTransactionGrantAllocation foundation (B1c-a)
-- Design reference: docs/CREDIT_WALLET_LEDGER_POLICY.md
--
-- HOW TO APPLY: paste into the Supabase SQL Editor and run
--   (https://supabase.com/dashboard → SQL Editor).
--   This repo does NOT use `prisma migrate` for production.
--
-- SAFE TO RERUN: every statement is idempotent (IF NOT EXISTS table/indexes +
--   guarded foreign keys). Running it twice changes nothing.
--
-- ADDS THE ALLOCATION TABLE ONLY. It links one CreditTransaction (debit) to the
--   CreditGrant row(s) it drew from, with the amount taken from each — so one
--   debit can span multiple grants. NO single CreditTransaction.grantId is used.
--
-- DOES NOT BACKFILL DATA. DOES NOT change User.aiCredits. DOES NOT change any
--   CreditTransaction row. DOES NOT change any CreditGrant row.
--
-- Runtime writes are gated by CREDIT_WALLET_ENABLED (default OFF). Keep the
-- legacy User.aiCredits path available until the wallet migration is enabled.

-- 1. Allocation table -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS "CreditTransactionGrantAllocation" (
  "id"                  TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "creditTransactionId" TEXT NOT NULL,
  "creditGrantId"       TEXT NOT NULL,
  "amount"              INTEGER NOT NULL,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditTransactionGrantAllocation_pkey" PRIMARY KEY ("id")
);

-- 2. Foreign key to CreditTransaction (cascade on delete) — guarded ------------
DO $$ BEGIN
  ALTER TABLE "CreditTransactionGrantAllocation"
    ADD CONSTRAINT "CreditTransactionGrantAllocation_creditTransactionId_fkey"
    FOREIGN KEY ("creditTransactionId") REFERENCES "CreditTransaction"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 3. Foreign key to CreditGrant (cascade on delete) — guarded ------------------
DO $$ BEGIN
  ALTER TABLE "CreditTransactionGrantAllocation"
    ADD CONSTRAINT "CreditTransactionGrantAllocation_creditGrantId_fkey"
    FOREIGN KEY ("creditGrantId") REFERENCES "CreditGrant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 4. Indexes (names match Prisma's defaults) -----------------------------------
CREATE INDEX IF NOT EXISTS "CreditTransactionGrantAllocation_creditTransactionId_idx"
  ON "CreditTransactionGrantAllocation" ("creditTransactionId");

CREATE INDEX IF NOT EXISTS "CreditTransactionGrantAllocation_creditGrantId_idx"
  ON "CreditTransactionGrantAllocation" ("creditGrantId");
