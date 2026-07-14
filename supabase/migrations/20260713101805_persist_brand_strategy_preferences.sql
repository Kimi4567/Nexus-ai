-- Persist the user's reviewed strategy defaults in Brand Brain.
-- Additive and safe to rerun: no existing rows, constraints, or policies change.
ALTER TABLE "BrandProfile" ADD COLUMN IF NOT EXISTS "strategyType"       TEXT;
ALTER TABLE "BrandProfile" ADD COLUMN IF NOT EXISTS "strategyDuration"   TEXT;
ALTER TABLE "BrandProfile" ADD COLUMN IF NOT EXISTS "strategyCustomDays" INTEGER;
ALTER TABLE "BrandProfile" ADD COLUMN IF NOT EXISTS "campaignObjective"  TEXT;
