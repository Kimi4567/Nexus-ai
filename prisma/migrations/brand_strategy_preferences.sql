-- Brand Brain strategy-order defaults.
-- Production uses manually applied, idempotent SQL migrations.
ALTER TABLE "BrandProfile" ADD COLUMN IF NOT EXISTS "strategyType"       TEXT;
ALTER TABLE "BrandProfile" ADD COLUMN IF NOT EXISTS "strategyDuration"   TEXT;
ALTER TABLE "BrandProfile" ADD COLUMN IF NOT EXISTS "strategyCustomDays" INTEGER;
ALTER TABLE "BrandProfile" ADD COLUMN IF NOT EXISTS "campaignObjective"  TEXT;
