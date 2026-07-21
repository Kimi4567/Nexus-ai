-- First-party outcome evidence. A WON stage is already the conversion fact;
-- these columns add an optional, operator-confirmed timestamp and value without
-- pretending that platform permissions or automated revenue attribution exist.

ALTER TABLE "Lead"
  ADD COLUMN IF NOT EXISTS "convertedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "conversionValue" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "conversionCurrency" TEXT,
  ADD COLUMN IF NOT EXISTS "conversionValueSource" TEXT;

ALTER TABLE "Lead"
  DROP CONSTRAINT IF EXISTS "Lead_conversion_value_non_negative",
  ADD CONSTRAINT "Lead_conversion_value_non_negative"
    CHECK ("conversionValue" IS NULL OR "conversionValue" >= 0),
  DROP CONSTRAINT IF EXISTS "Lead_conversion_currency_valid",
  ADD CONSTRAINT "Lead_conversion_currency_valid"
    CHECK ("conversionCurrency" IS NULL OR "conversionCurrency" ~ '^[A-Z]{3}$'),
  DROP CONSTRAINT IF EXISTS "Lead_conversion_value_evidence_coherent",
  ADD CONSTRAINT "Lead_conversion_value_evidence_coherent"
    CHECK (
      ("conversionValue" IS NULL AND "conversionCurrency" IS NULL AND "conversionValueSource" IS NULL)
      OR
      ("conversionValue" IS NOT NULL AND "conversionCurrency" IS NOT NULL AND "conversionValueSource" = 'MANUAL_CONFIRMED')
    );

CREATE INDEX IF NOT EXISTS "Lead_workspaceId_convertedAt_idx"
  ON "Lead" ("workspaceId", "convertedAt");

COMMENT ON COLUMN "Lead"."convertedAt" IS
  'Timestamp at which a workspace operator confirmed the lead as WON.';
COMMENT ON COLUMN "Lead"."conversionValue" IS
  'Optional operator-confirmed outcome value; never AI-estimated.';
COMMENT ON COLUMN "Lead"."conversionValueSource" IS
  'Evidence provenance. This release accepts MANUAL_CONFIRMED only.';
