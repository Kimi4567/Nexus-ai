-- ============================================================================
-- Nexus AI — Missing Tables Migration
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/qabttahvjhgzwfzqnxew/sql
-- Safe to run multiple times (uses CREATE IF NOT EXISTS / DO $$ patterns)
-- ============================================================================

-- ── Enums ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "AgentType" AS ENUM ('STRATEGIST', 'CONTENT_DIRECTOR', 'CAMPAIGN_MANAGER', 'REPORTING');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AgentRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXECUTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SuggestionType" AS ENUM (
    'STRATEGY', 'CONTENT_SWAP', 'BUDGET_CHANGE', 'AUDIENCE_SHIFT',
    'PLATFORM_ADD', 'PLATFORM_PAUSE', 'CAMPAIGN_PAUSE', 'CAMPAIGN_LAUNCH'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ReportType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "VisualStatus" AS ENUM ('PENDING', 'GENERATING', 'COMPLETED', 'FAILED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "VisualType" AS ENUM ('HERO', 'SOCIAL_PREVIEW', 'AD_CREATIVE', 'THUMBNAIL', 'ALTERNATE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── BrandProfile ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "BrandProfile" (
  "id"                TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workspaceId"       TEXT NOT NULL,

  -- Core identity
  "brandName"         TEXT,
  "industry"          TEXT,
  "description"       TEXT,

  -- Voice & tone
  "toneKeywords"      TEXT[] NOT NULL DEFAULT '{}',
  "avoidKeywords"     TEXT[] NOT NULL DEFAULT '{}',
  "writingStyle"      TEXT,

  -- Audience
  "targetAudience"    TEXT,
  "audienceAge"       TEXT,
  "audienceLocation"  TEXT,
  "audiencePainPoints" TEXT[] NOT NULL DEFAULT '{}',
  "audienceDesires"   TEXT[] NOT NULL DEFAULT '{}',

  -- Offer
  "primaryOffer"      TEXT,
  "secondaryOffers"   TEXT[] NOT NULL DEFAULT '{}',
  "pricePoint"        TEXT,
  "uniqueAdvantages"  TEXT[] NOT NULL DEFAULT '{}',

  -- Visual
  "visualStyle"       TEXT,
  "colorPalette"      TEXT[] NOT NULL DEFAULT '{}',
  "logoUrl"           TEXT,

  -- Campaign memory
  "winningHooks"      TEXT[] NOT NULL DEFAULT '{}',
  "winningAngles"     TEXT[] NOT NULL DEFAULT '{}',
  "failedAngles"      TEXT[] NOT NULL DEFAULT '{}',
  "topPlatforms"      TEXT[] NOT NULL DEFAULT '{}',

  -- Strategic notes
  "strategicNotes"    TEXT,
  "competitorNotes"   TEXT,
  "aiInsights"        JSONB,

  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT NOW(),

  CONSTRAINT "BrandProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BrandProfile_workspaceId_key" ON "BrandProfile"("workspaceId");
CREATE INDEX IF NOT EXISTS "BrandProfile_workspaceId_idx" ON "BrandProfile"("workspaceId");

ALTER TABLE "BrandProfile"
  DROP CONSTRAINT IF EXISTS "BrandProfile_workspaceId_fkey";
ALTER TABLE "BrandProfile"
  ADD CONSTRAINT "BrandProfile_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE;

-- ── AgentRun ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "AgentRun" (
  "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workspaceId"   TEXT NOT NULL,
  "agent"         "AgentType" NOT NULL,
  "status"        "AgentRunStatus" NOT NULL DEFAULT 'RUNNING',
  "triggeredBy"   TEXT,
  "inputData"     JSONB,
  "outputData"    JSONB,
  "error"         TEXT,
  "durationMs"    INTEGER,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "completedAt"   TIMESTAMP(3),

  CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AgentRun_workspaceId_idx" ON "AgentRun"("workspaceId");
CREATE INDEX IF NOT EXISTS "AgentRun_agent_idx" ON "AgentRun"("agent");
CREATE INDEX IF NOT EXISTS "AgentRun_status_idx" ON "AgentRun"("status");
CREATE INDEX IF NOT EXISTS "AgentRun_createdAt_idx" ON "AgentRun"("createdAt");

ALTER TABLE "AgentRun"
  DROP CONSTRAINT IF EXISTS "AgentRun_workspaceId_fkey";
ALTER TABLE "AgentRun"
  ADD CONSTRAINT "AgentRun_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE;

-- ── AgentSuggestion ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "AgentSuggestion" (
  "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workspaceId"   TEXT NOT NULL,
  "agentRunId"    TEXT,
  "campaignId"    TEXT,

  "type"          "SuggestionType" NOT NULL,
  "status"        "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
  "title"         TEXT NOT NULL,
  "description"   TEXT NOT NULL,
  "reasoning"     TEXT,
  "data"          JSONB,
  "priority"      INTEGER NOT NULL DEFAULT 5,

  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "reviewedAt"    TIMESTAMP(3),

  CONSTRAINT "AgentSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AgentSuggestion_workspaceId_idx" ON "AgentSuggestion"("workspaceId");
CREATE INDEX IF NOT EXISTS "AgentSuggestion_status_idx" ON "AgentSuggestion"("status");

ALTER TABLE "AgentSuggestion"
  DROP CONSTRAINT IF EXISTS "AgentSuggestion_workspaceId_fkey";
ALTER TABLE "AgentSuggestion"
  ADD CONSTRAINT "AgentSuggestion_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE;

ALTER TABLE "AgentSuggestion"
  DROP CONSTRAINT IF EXISTS "AgentSuggestion_agentRunId_fkey";
ALTER TABLE "AgentSuggestion"
  ADD CONSTRAINT "AgentSuggestion_agentRunId_fkey"
  FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE SET NULL;

-- ── AgentReport ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "AgentReport" (
  "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workspaceId"   TEXT NOT NULL,
  "agentRunId"    TEXT,

  "type"          "ReportType" NOT NULL,
  "title"         TEXT NOT NULL,
  "summary"       TEXT NOT NULL,
  "data"          JSONB,
  "sentAt"        TIMESTAMP(3),

  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT NOW(),

  CONSTRAINT "AgentReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AgentReport_workspaceId_idx" ON "AgentReport"("workspaceId");

ALTER TABLE "AgentReport"
  DROP CONSTRAINT IF EXISTS "AgentReport_workspaceId_fkey";
ALTER TABLE "AgentReport"
  ADD CONSTRAINT "AgentReport_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE;

ALTER TABLE "AgentReport"
  DROP CONSTRAINT IF EXISTS "AgentReport_agentRunId_fkey";
ALTER TABLE "AgentReport"
  ADD CONSTRAINT "AgentReport_agentRunId_fkey"
  FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE SET NULL;

-- ── GeneratedVisual ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "GeneratedVisual" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workspaceId"     TEXT NOT NULL,
  "campaignId"      TEXT,

  "visualType"      "VisualType" NOT NULL DEFAULT 'HERO',
  "visualStyle"     TEXT NOT NULL,
  "prompt"          TEXT NOT NULL,
  "enhancedPrompt"  TEXT,

  "campaignName"    TEXT,
  "campaignGoal"    TEXT,
  "campaignTone"    TEXT,
  "audience"        TEXT,
  "brandName"       TEXT,
  "brandToneWords"  TEXT[] NOT NULL DEFAULT '{}',

  "status"          "VisualStatus" NOT NULL DEFAULT 'PENDING',
  "imageUrl"        TEXT,
  "thumbnailUrl"    TEXT,
  "errorMessage"    TEXT,
  "retryCount"      INTEGER NOT NULL DEFAULT 0,

  "isPrimary"       BOOLEAN NOT NULL DEFAULT false,
  "isArchived"      BOOLEAN NOT NULL DEFAULT false,
  "version"         INTEGER NOT NULL DEFAULT 1,
  "parentId"        TEXT,

  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT NOW(),

  CONSTRAINT "GeneratedVisual_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GeneratedVisual_workspaceId_idx" ON "GeneratedVisual"("workspaceId");
CREATE INDEX IF NOT EXISTS "GeneratedVisual_campaignId_idx" ON "GeneratedVisual"("campaignId");
CREATE INDEX IF NOT EXISTS "GeneratedVisual_status_idx" ON "GeneratedVisual"("status");

ALTER TABLE "GeneratedVisual"
  DROP CONSTRAINT IF EXISTS "GeneratedVisual_workspaceId_fkey";
ALTER TABLE "GeneratedVisual"
  ADD CONSTRAINT "GeneratedVisual_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE;

ALTER TABLE "GeneratedVisual"
  DROP CONSTRAINT IF EXISTS "GeneratedVisual_campaignId_fkey";
ALTER TABLE "GeneratedVisual"
  ADD CONSTRAINT "GeneratedVisual_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL;

-- ── Usage ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Usage" (
  "id"                TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId"            TEXT NOT NULL,
  "month"             INTEGER NOT NULL,
  "year"              INTEGER NOT NULL,
  "aiCreditsUsed"     INTEGER NOT NULL DEFAULT 0,
  "generationsCount"  INTEGER NOT NULL DEFAULT 0,
  "exportsCount"      INTEGER NOT NULL DEFAULT 0,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT NOW(),

  CONSTRAINT "Usage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Usage_userId_month_year_key"
  ON "Usage"("userId", "month", "year");

-- ── Patch User table — add missing columns ────────────────────────────────────

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "aiCredits"          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "monthlyGenerations"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "subscriptionId"      TEXT,
  ADD COLUMN IF NOT EXISTS "subscriptionStatus"  TEXT NOT NULL DEFAULT 'FREE',
  ADD COLUMN IF NOT EXISTS "stripeCustomerId"    TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_stripeCustomerId_key"
  ON "User"("stripeCustomerId") WHERE "stripeCustomerId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "User_subscriptionStatus_idx"
  ON "User"("subscriptionStatus");

-- ── Done ──────────────────────────────────────────────────────────────────────
-- All tables created. Verify with:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
