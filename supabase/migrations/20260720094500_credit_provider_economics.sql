ALTER TABLE public."CreditTransaction"
  ADD COLUMN IF NOT EXISTS "providerCostUsd" NUMERIC(12, 6),
  ADD COLUMN IF NOT EXISTS "providerPricingVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "providerUsage" JSONB;

ALTER TABLE public."CreditTransaction"
  DROP CONSTRAINT IF EXISTS "CreditTransaction_providerCostUsd_check";
ALTER TABLE public."CreditTransaction"
  ADD CONSTRAINT "CreditTransaction_providerCostUsd_check"
  CHECK ("providerCostUsd" IS NULL OR "providerCostUsd" >= 0);

COMMENT ON COLUMN public."CreditTransaction"."providerCostUsd" IS
  'Internal provider cost captured when a reserved AI operation settles; not customer-facing price or recognized revenue.';
COMMENT ON COLUMN public."CreditTransaction"."providerPricingVersion" IS
  'Version of the provider-rate catalog or estimate used for providerCostUsd.';
COMMENT ON COLUMN public."CreditTransaction"."providerUsage" IS
  'Sanitized provider usage/cost components used to reproduce the internal estimate.';

ALTER TABLE public."CreditTransaction" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."CreditTransaction" FROM anon, authenticated;
