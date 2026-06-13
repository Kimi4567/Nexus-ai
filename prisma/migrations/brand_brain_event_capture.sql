-- Brand Brain Sprint — PR 1: execution-workflow event capture foundation
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard → SQL Editor
--
-- 100% ADDITIVE & BACKWARD-COMPATIBLE. Creates ONE new, empty table. No existing
-- table, column, enum, row, or index is touched. Nothing in current production code
-- reads or writes this table, so applying it changes no behaviour — it just makes the
-- table exist so the new (non-blocking) event writes have somewhere to land.
--
-- Apply this BEFORE deploying the matching Prisma client to a shared environment
-- (the Preview shares the production database). If it is NOT applied, event writes are
-- caught and ignored (the user's approve/schedule/publish action still succeeds) — but
-- no learning events will be recorded until the table exists.
--
-- This table is an append-only WHAT-happened log of execution actions
-- (approve / schedule / manual-publish / unschedule / revert). It NEVER stores
-- performance metrics, inferred results, or full sensitive URLs.

CREATE TABLE IF NOT EXISTS "MarketingLearningEvent" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workspaceId"  TEXT NOT NULL,
  "campaignId"   TEXT,
  "socialPostId" TEXT,
  "eventType"    TEXT NOT NULL,                              -- POST_APPROVED | POST_SCHEDULED | POST_MANUALLY_PUBLISHED | POST_UNSCHEDULED | POST_REVERTED_TO_DRAFT | POST_FAILED | POST_AUTO_PUBLISHED
  "source"       TEXT NOT NULL DEFAULT 'EXECUTION_WORKFLOW',
  "actor"        TEXT NOT NULL DEFAULT 'USER',               -- USER | SYSTEM | CRON
  "metadata"     JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MarketingLearningEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MarketingLearningEvent_workspaceId_createdAt_idx" ON "MarketingLearningEvent"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "MarketingLearningEvent_workspaceId_eventType_idx" ON "MarketingLearningEvent"("workspaceId", "eventType");
CREATE INDEX IF NOT EXISTS "MarketingLearningEvent_socialPostId_idx"          ON "MarketingLearningEvent"("socialPostId");
CREATE INDEX IF NOT EXISTS "MarketingLearningEvent_campaignId_idx"            ON "MarketingLearningEvent"("campaignId");

-- Verify
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'MarketingLearningEvent'
ORDER BY ordinal_position;
