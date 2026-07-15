-- Credit operations are holds first, final charges only after a usable output,
-- and source-aware refunds on failure. Existing history remains settled unless
-- an exact linked refund proves that the original debit was refunded.
ALTER TABLE public."CreditTransaction"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'SETTLED',
  ADD COLUMN IF NOT EXISTS "creditCost" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "operationKey" TEXT,
  ADD COLUMN IF NOT EXISTS "reservedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "settledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "refundedAt" TIMESTAMP(3);

UPDATE public."CreditTransaction"
SET
  "creditCost" = ABS("amount")
WHERE "creditCost" = 0
  AND "amount" < 0;

UPDATE public."CreditTransaction"
SET "settledAt" = COALESCE("settledAt", "createdAt")
WHERE "status" = 'SETTLED';

UPDATE public."CreditTransaction" AS debit
SET
  "status" = 'REFUNDED',
  "refundedAt" = COALESCE(debit."refundedAt", refund."createdAt")
FROM public."CreditTransaction" AS refund
WHERE refund."action" = 'REFUND'
  AND refund."entityType" = 'credit_transaction'
  AND refund."entityId" = debit."id"
  AND debit."amount" < 0;

ALTER TABLE public."CreditTransaction"
  DROP CONSTRAINT IF EXISTS "CreditTransaction_status_check";
ALTER TABLE public."CreditTransaction"
  ADD CONSTRAINT "CreditTransaction_status_check"
  CHECK ("status" IN ('RESERVED', 'SETTLED', 'REFUNDED'));

ALTER TABLE public."CreditTransaction"
  DROP CONSTRAINT IF EXISTS "CreditTransaction_creditCost_check";
ALTER TABLE public."CreditTransaction"
  ADD CONSTRAINT "CreditTransaction_creditCost_check"
  CHECK ("creditCost" >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS "CreditTransaction_userId_operationKey_key"
  ON public."CreditTransaction" ("userId", "operationKey");
CREATE INDEX IF NOT EXISTS "CreditTransaction_status_createdAt_idx"
  ON public."CreditTransaction" ("status", "createdAt");

-- This remains a trusted-server-only ledger. Reassert both security layers so
-- the new lifecycle metadata cannot become reachable through the Data API.
ALTER TABLE public."CreditTransaction" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."CreditTransaction" FROM anon, authenticated;
