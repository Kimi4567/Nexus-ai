-- META-ADS-AUDIT-LEDGER1 — AdAccountApiAccessReview
--
-- HOW TO APPLY: paste into the Supabase SQL Editor and run.
-- This repo does not rely on `prisma migrate deploy` for production.
--
-- SAFE TO RERUN: all table, constraint, and index statements are guarded.
--
-- PURPOSE:
-- Records each admin/operator decision that marks a Meta Ads account as reviewed
-- for API execution after Meta App Review / Business Verification evidence.
--
-- THIS MIGRATION DOES NOT:
-- - submit Meta App Review
-- - call Meta APIs
-- - create campaigns/ad sets/ads/creatives
-- - activate ads or spend budget
-- - change credits
-- - mutate SocialPost, Media, GeneratedVisual, or campaign output rows

CREATE TABLE IF NOT EXISTS "AdAccountApiAccessReview" (
  "id"                   TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "adAccountId"          TEXT NOT NULL,
  "workspaceId"          TEXT NOT NULL,
  "reviewedById"         TEXT NOT NULL,
  "reviewedByEmail"      TEXT,
  "platform"             "AdPlatform" NOT NULL,
  "platformAccountId"    TEXT NOT NULL,
  "platformAccountName"  TEXT,
  "businessId"           TEXT,
  "businessName"         TEXT,
  "pageId"               TEXT,
  "pageName"             TEXT,
  "previousHasApiAccess" BOOLEAN NOT NULL,
  "nextHasApiAccess"     BOOLEAN NOT NULL,
  "confirmation"         TEXT NOT NULL,
  "evidenceUrl"          TEXT,
  "reason"               TEXT,
  "missingScopes"        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdAccountApiAccessReview_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AdAccountApiAccessReview" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'AdAccountApiAccessReview_adAccountId_fkey'
  ) THEN
    ALTER TABLE "AdAccountApiAccessReview"
      ADD CONSTRAINT "AdAccountApiAccessReview_adAccountId_fkey"
      FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "AdAccountApiAccessReview_adAccountId_createdAt_idx"
  ON "AdAccountApiAccessReview" ("adAccountId", "createdAt");

CREATE INDEX IF NOT EXISTS "AdAccountApiAccessReview_workspaceId_createdAt_idx"
  ON "AdAccountApiAccessReview" ("workspaceId", "createdAt");

CREATE INDEX IF NOT EXISTS "AdAccountApiAccessReview_reviewedById_createdAt_idx"
  ON "AdAccountApiAccessReview" ("reviewedById", "createdAt");

CREATE INDEX IF NOT EXISTS "AdAccountApiAccessReview_nextHasApiAccess_idx"
  ON "AdAccountApiAccessReview" ("nextHasApiAccess");
