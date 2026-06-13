-- Publishing & Campaign Calendar Sprint — PR 1: status foundation
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard → SQL Editor
--
-- 100% ADDITIVE & BACKWARD-COMPATIBLE. No data loss, no destructive change.
-- Existing DRAFT / SCHEDULED / PUBLISHED / FAILED posts keep working unchanged.
-- New rows/columns default so nothing falsely claims a post was published.
-- Apply this BEFORE deploying the matching Prisma client to a shared environment
-- (the Preview shares the production database, and the generated client SELECTs the
--  new columns — they must exist first).

-- 1. Add APPROVED to the SocialPostStatus enum (lifecycle: DRAFT → APPROVED → SCHEDULED → PUBLISHED/FAILED)
ALTER TYPE "SocialPostStatus" ADD VALUE IF NOT EXISTS 'APPROVED';

-- 2. Create the PublishMode enum (MANUAL = user posts by hand; AUTO = real-API cron)
DO $$ BEGIN
  CREATE TYPE "PublishMode" AS ENUM ('MANUAL', 'AUTO');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 3. Add the additive lifecycle columns to SocialPost
ALTER TABLE "SocialPost"
  ADD COLUMN IF NOT EXISTS "publishMode"         "PublishMode" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS "approvedAt"          TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "manuallyPublishedAt" TIMESTAMP(3);

-- 4. Index for the future cron filter (publishMode = AUTO)
CREATE INDEX IF NOT EXISTS "SocialPost_publishMode_idx" ON "SocialPost"("publishMode");

-- 5. Append-only audit trail of post lifecycle transitions
CREATE TABLE IF NOT EXISTS "PostStatusHistory" (
  "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "socialPostId"  TEXT NOT NULL,
  "workspaceId"   TEXT NOT NULL,
  "fromStatus"    TEXT,
  "toStatus"      TEXT NOT NULL,
  "actor"         TEXT NOT NULL DEFAULT 'USER',   -- USER | SYSTEM | CRON
  "note"          TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PostStatusHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PostStatusHistory_socialPostId_fkey"
    FOREIGN KEY ("socialPostId") REFERENCES "SocialPost"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "PostStatusHistory_socialPostId_idx" ON "PostStatusHistory"("socialPostId");
CREATE INDEX IF NOT EXISTS "PostStatusHistory_workspaceId_idx"  ON "PostStatusHistory"("workspaceId");
CREATE INDEX IF NOT EXISTS "PostStatusHistory_createdAt_idx"    ON "PostStatusHistory"("createdAt");

-- 6. Backfill: existing posts are MANUAL-mode by default (already handled by the column
--    default above; this is a no-op safety net for any pre-existing NULLs).
UPDATE "SocialPost" SET "publishMode" = 'MANUAL' WHERE "publishMode" IS NULL;

-- Verify
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'SocialPost'
  AND column_name IN ('publishMode','approvedAt','manuallyPublishedAt')
ORDER BY column_name;
