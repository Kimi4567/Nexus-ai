-- Strategy PR-2A — Brand Brain strategy data requirements
--
-- ⚠️ THIS IS A MANUAL SQL MIGRATION. This project does NOT use Prisma's managed
-- migration flow (no _prisma_migrations history table; the Vercel build runs only
-- `prisma generate`, never `prisma migrate deploy`). Prisma will NOT apply this file
-- automatically. You must run it yourself in the Supabase SQL Editor
-- (https://supabase.com/dashboard → SQL Editor). It matches the other manual .sql files
-- already in this folder (e.g. brand_brain_event_capture.sql).
--
-- ⛔ APPLY THIS BEFORE deploying/QA-ing the matching Prisma client (the Vercel Preview
-- shares the production database). The generated client will include these 12 fields, so
-- if the columns are absent, brand-profile reads/writes that reference them will error.
-- The brand API wraps its upsert in try/catch so the page won't hard-crash, but saves
-- will NOT persist until this SQL is applied. Order: run this SQL → then push/build.
--
-- 100% ADDITIVE & BACKWARD-COMPATIBLE:
--   • 12 NEW columns only — no DROP, no RENAME, no type change, no destructive constraint.
--   • Every column is nullable (or an array defaulting to '{}').
--   • No existing column, row, enum, index, or default is touched.
--   • OLD production code (the current client, before this deploy) is unaffected by the
--     presence of new nullable columns — it neither selects nor writes them.
--
-- Safe to run multiple times: every statement uses IF NOT EXISTS.

ALTER TABLE "BrandProfile" ADD COLUMN IF NOT EXISTS "businessGoal"          TEXT;
ALTER TABLE "BrandProfile" ADD COLUMN IF NOT EXISTS "marketingBudget"       TEXT;
ALTER TABLE "BrandProfile" ADD COLUMN IF NOT EXISTS "conversionDestination" TEXT;
ALTER TABLE "BrandProfile" ADD COLUMN IF NOT EXISTS "leadHandling"          TEXT;
ALTER TABLE "BrandProfile" ADD COLUMN IF NOT EXISTS "customerObjections"    TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "BrandProfile" ADD COLUMN IF NOT EXISTS "complianceNotes"       TEXT;
ALTER TABLE "BrandProfile" ADD COLUMN IF NOT EXISTS "averageOrderValue"     TEXT;
ALTER TABLE "BrandProfile" ADD COLUMN IF NOT EXISTS "grossMargin"           TEXT;
ALTER TABLE "BrandProfile" ADD COLUMN IF NOT EXISTS "customerLifetimeValue" TEXT;
ALTER TABLE "BrandProfile" ADD COLUMN IF NOT EXISTS "salesCycleLength"      TEXT;
ALTER TABLE "BrandProfile" ADD COLUMN IF NOT EXISTS "seasonality"           TEXT;
ALTER TABLE "BrandProfile" ADD COLUMN IF NOT EXISTS "pastAdResults"         TEXT;

-- Note: "customerObjections" mirrors Prisma `String[] @default([])`. The other 11 are
-- nullable TEXT mirroring Prisma `String?`. No NOT NULL added to any nullable column.
