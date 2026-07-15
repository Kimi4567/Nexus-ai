ALTER TABLE public."CreditTransaction"
  ADD COLUMN IF NOT EXISTS "pricingVersion" TEXT;

COMMENT ON COLUMN public."CreditTransaction"."pricingVersion" IS
  'Immutable commercial credit schedule identifier. NULL means legacy/unversioned transaction.';
