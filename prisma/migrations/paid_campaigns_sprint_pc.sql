-- ============================================================================
-- NEXUS AI — Production Migration
-- Sprint PC: Paid Campaigns + Sprint BL/Gap fixes
-- Run in Supabase SQL Editor
-- 100% safe to re-run — uses IF NOT EXISTS + pg_constraint checks everywhere
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. ENUMS
-- ──────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "AdPlatform" AS ENUM ('META', 'GOOGLE', 'TIKTOK', 'LINKEDIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AdAccountStatus" AS ENUM ('ACTIVE', 'DISCONNECTED', 'ERROR', 'PENDING');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AdCampaignStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AdObjective" AS ENUM ('BRAND_AWARENESS', 'REACH', 'TRAFFIC', 'ENGAGEMENT', 'APP_INSTALLS', 'VIDEO_VIEWS', 'LEAD_GENERATION', 'MESSAGES', 'CONVERSIONS', 'CATALOG_SALES', 'STORE_VISITS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "BidStrategy" AS ENUM ('LOWEST_COST', 'COST_CAP', 'BID_CAP', 'TARGET_COST', 'MINIMUM_ROAS', 'MANUAL_CPC', 'MANUAL_CPM', 'MAXIMIZE_CONVERSIONS', 'TARGET_CPA', 'TARGET_ROAS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AdFormat" AS ENUM ('SINGLE_IMAGE', 'SINGLE_VIDEO', 'CAROUSEL', 'COLLECTION', 'STORIES', 'REELS', 'SEARCH', 'DISPLAY', 'PERFORMANCE_MAX', 'RESPONSIVE_DISPLAY', 'SPARK_ADS', 'TOP_VIEW', 'IN_FEED', 'SPONSORED_CONTENT', 'MESSAGE_ADS', 'LEAD_GEN_FORM', 'DYNAMIC');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AdStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'PAUSED', 'ARCHIVED', 'DISAPPROVED', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. AdAccount
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "AdAccount" (
  "id"                   TEXT              NOT NULL,
  "workspaceId"          TEXT              NOT NULL,
  "platform"             "AdPlatform"      NOT NULL,
  "status"               "AdAccountStatus" NOT NULL DEFAULT 'DISCONNECTED',
  "platformAccountId"    TEXT              NOT NULL,
  "platformAccountName"  TEXT,
  "businessId"           TEXT,
  "businessName"         TEXT,
  "accessToken"          TEXT,
  "refreshToken"         TEXT,
  "tokenExpiresAt"       TIMESTAMP(3),
  "currency"             TEXT              NOT NULL DEFAULT 'USD',
  "timeZone"             TEXT              DEFAULT 'UTC',
  "country"              TEXT,
  "isVerified"           BOOLEAN           NOT NULL DEFAULT false,
  "hasApiAccess"         BOOLEAN           NOT NULL DEFAULT false,
  "permissionScopes"     TEXT[]            NOT NULL DEFAULT ARRAY[]::TEXT[],
  "pageId"               TEXT,
  "pageName"             TEXT,
  "pixelId"              TEXT,
  "instagramAccountId"   TEXT,
  "loginCustomerId"      TEXT,
  "spendLimit"           DOUBLE PRECISION,
  "totalSpent"           DOUBLE PRECISION  NOT NULL DEFAULT 0,
  "lastSyncAt"           TIMESTAMP(3),
  "lastErrorAt"          TIMESTAMP(3),
  "lastError"            TEXT,
  "createdAt"            TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdAccount_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdAccount_workspaceId_fkey') THEN
    ALTER TABLE "AdAccount" ADD CONSTRAINT "AdAccount_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'AdAccount_workspaceId_platform_platformAccountId_key') THEN
    ALTER TABLE "AdAccount" ADD CONSTRAINT "AdAccount_workspaceId_platform_platformAccountId_key"
      UNIQUE ("workspaceId", "platform", "platformAccountId");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "AdAccount_workspaceId_idx" ON "AdAccount"("workspaceId");
CREATE INDEX IF NOT EXISTS "AdAccount_platform_idx"    ON "AdAccount"("platform");
CREATE INDEX IF NOT EXISTS "AdAccount_status_idx"      ON "AdAccount"("status");

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. AdCampaign
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "AdCampaign" (
  "id"                   TEXT                NOT NULL,
  "workspaceId"          TEXT                NOT NULL,
  "adAccountId"          TEXT,
  "organicCampaignId"    TEXT,
  "platform"             "AdPlatform"        NOT NULL,
  "platformCampaignId"   TEXT,
  "platformStatus"       TEXT,
  "name"                 TEXT                NOT NULL,
  "objective"            "AdObjective"       NOT NULL DEFAULT 'TRAFFIC',
  "status"               "AdCampaignStatus"  NOT NULL DEFAULT 'DRAFT',
  "budgetType"           TEXT                NOT NULL DEFAULT 'DAILY',
  "dailyBudget"          DOUBLE PRECISION,
  "lifetimeBudget"       DOUBLE PRECISION,
  "currency"             TEXT                NOT NULL DEFAULT 'USD',
  "startDate"            TIMESTAMP(3),
  "endDate"              TIMESTAMP(3),
  "isBoosted"            BOOLEAN             NOT NULL DEFAULT false,
  "isAbTest"             BOOLEAN             NOT NULL DEFAULT false,
  "aiStrategy"           JSONB,
  "aiAudienceBrief"      JSONB,
  "aiBudgetPlan"         JSONB,
  "brandBrainSnapshot"   JSONB,
  "utmSource"            TEXT,
  "utmMedium"            TEXT                DEFAULT 'paid_social',
  "utmCampaign"          TEXT,
  "trackingUrls"         JSONB,
  "totalImpressions"     INTEGER             NOT NULL DEFAULT 0,
  "totalClicks"          INTEGER             NOT NULL DEFAULT 0,
  "totalSpend"           DOUBLE PRECISION    NOT NULL DEFAULT 0,
  "totalConversions"     INTEGER             NOT NULL DEFAULT 0,
  "avgCTR"               DOUBLE PRECISION,
  "avgCPC"               DOUBLE PRECISION,
  "avgROAS"              DOUBLE PRECISION,
  "lastSyncAt"           TIMESTAMP(3),
  "lastSyncError"        TEXT,
  "createdAt"            TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdCampaign_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdCampaign_workspaceId_fkey') THEN
    ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdCampaign_adAccountId_fkey') THEN
    ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_adAccountId_fkey"
      FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "AdCampaign_workspaceId_idx"         ON "AdCampaign"("workspaceId");
CREATE INDEX IF NOT EXISTS "AdCampaign_adAccountId_idx"         ON "AdCampaign"("adAccountId");
CREATE INDEX IF NOT EXISTS "AdCampaign_platform_idx"            ON "AdCampaign"("platform");
CREATE INDEX IF NOT EXISTS "AdCampaign_status_idx"              ON "AdCampaign"("status");
CREATE INDEX IF NOT EXISTS "AdCampaign_organicCampaignId_idx"   ON "AdCampaign"("organicCampaignId");
CREATE INDEX IF NOT EXISTS "AdCampaign_platformCampaignId_idx"  ON "AdCampaign"("platformCampaignId");
CREATE INDEX IF NOT EXISTS "AdCampaign_startDate_idx"           ON "AdCampaign"("startDate");

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. AdSet
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "AdSet" (
  "id"                TEXT          NOT NULL,
  "adCampaignId"      TEXT          NOT NULL,
  "platformAdSetId"   TEXT,
  "name"              TEXT          NOT NULL,
  "status"            "AdStatus"    NOT NULL DEFAULT 'DRAFT',
  "dailyBudget"       DOUBLE PRECISION,
  "lifetimeBudget"    DOUBLE PRECISION,
  "bidStrategy"       "BidStrategy" NOT NULL DEFAULT 'LOWEST_COST',
  "bidAmount"         DOUBLE PRECISION,
  "startDate"         TIMESTAMP(3),
  "endDate"           TIMESTAMP(3),
  "targeting"         JSONB,
  "placements"        JSONB,
  "optimizationGoal"  TEXT,
  "billingEvent"      TEXT,
  "totalImpressions"  INTEGER          NOT NULL DEFAULT 0,
  "totalClicks"       INTEGER          NOT NULL DEFAULT 0,
  "totalSpend"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalConversions"  INTEGER          NOT NULL DEFAULT 0,
  "avgCTR"            DOUBLE PRECISION,
  "createdAt"         TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdSet_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdSet_adCampaignId_fkey') THEN
    ALTER TABLE "AdSet" ADD CONSTRAINT "AdSet_adCampaignId_fkey"
      FOREIGN KEY ("adCampaignId") REFERENCES "AdCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "AdSet_adCampaignId_idx"   ON "AdSet"("adCampaignId");
CREATE INDEX IF NOT EXISTS "AdSet_status_idx"          ON "AdSet"("status");
CREATE INDEX IF NOT EXISTS "AdSet_platformAdSetId_idx" ON "AdSet"("platformAdSetId");

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. Ad
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Ad" (
  "id"                 TEXT        NOT NULL,
  "adSetId"            TEXT        NOT NULL,
  "platformAdId"       TEXT,
  "platformCreativeId" TEXT,
  "name"               TEXT        NOT NULL,
  "status"             "AdStatus"  NOT NULL DEFAULT 'DRAFT',
  "format"             "AdFormat"  NOT NULL DEFAULT 'SINGLE_IMAGE',
  "primaryText"        TEXT,
  "headline"           TEXT,
  "description"        TEXT,
  "callToAction"       TEXT,
  "displayUrl"         TEXT,
  "destinationUrl"     TEXT,
  "imageUrl"           TEXT,
  "videoUrl"           TEXT,
  "thumbnailUrl"       TEXT,
  "carouselCards"      JSONB,
  "creativeSpecs"      JSONB,
  "specsValidated"     BOOLEAN     NOT NULL DEFAULT false,
  "specsErrors"        TEXT[]      NOT NULL DEFAULT ARRAY[]::TEXT[],
  "variantGroup"       TEXT,
  "variantLabel"       TEXT,
  "isWinner"           BOOLEAN     NOT NULL DEFAULT false,
  "aiGenerated"        BOOLEAN     NOT NULL DEFAULT false,
  "aiAngle"            TEXT,
  "aiHook"             TEXT,
  "generationPrompt"   TEXT,
  "impressions"        INTEGER          NOT NULL DEFAULT 0,
  "clicks"             INTEGER          NOT NULL DEFAULT 0,
  "spend"              DOUBLE PRECISION NOT NULL DEFAULT 0,
  "conversions"        INTEGER          NOT NULL DEFAULT 0,
  "ctr"                DOUBLE PRECISION,
  "cpc"                DOUBLE PRECISION,
  "cpm"                DOUBLE PRECISION,
  "roas"               DOUBLE PRECISION,
  "reviewStatus"       TEXT,
  "reviewFeedback"     TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Ad_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Ad_adSetId_fkey') THEN
    ALTER TABLE "Ad" ADD CONSTRAINT "Ad_adSetId_fkey"
      FOREIGN KEY ("adSetId") REFERENCES "AdSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Ad_adSetId_idx"      ON "Ad"("adSetId");
CREATE INDEX IF NOT EXISTS "Ad_status_idx"        ON "Ad"("status");
CREATE INDEX IF NOT EXISTS "Ad_platformAdId_idx"  ON "Ad"("platformAdId");
CREATE INDEX IF NOT EXISTS "Ad_variantGroup_idx"  ON "Ad"("variantGroup");

-- ──────────────────────────────────────────────────────────────────────────────
-- 6. AdPerformanceSnapshot
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "AdPerformanceSnapshot" (
  "id"               TEXT             NOT NULL,
  "adCampaignId"     TEXT             NOT NULL,
  "adSetId"          TEXT,
  "adId"             TEXT,
  "date"             TIMESTAMP(3)     NOT NULL,
  "impressions"      INTEGER          NOT NULL DEFAULT 0,
  "reach"            INTEGER          NOT NULL DEFAULT 0,
  "frequency"        DOUBLE PRECISION,
  "clicks"           INTEGER          NOT NULL DEFAULT 0,
  "linkClicks"       INTEGER          NOT NULL DEFAULT 0,
  "videoViews"       INTEGER          NOT NULL DEFAULT 0,
  "videoViewRate"    DOUBLE PRECISION,
  "videoCompletions" INTEGER          NOT NULL DEFAULT 0,
  "postEngagements"  INTEGER          NOT NULL DEFAULT 0,
  "conversions"      INTEGER          NOT NULL DEFAULT 0,
  "leads"            INTEGER          NOT NULL DEFAULT 0,
  "purchases"        INTEGER          NOT NULL DEFAULT 0,
  "addToCarts"       INTEGER          NOT NULL DEFAULT 0,
  "registrations"    INTEGER          NOT NULL DEFAULT 0,
  "spend"            DOUBLE PRECISION NOT NULL DEFAULT 0,
  "cpm"              DOUBLE PRECISION,
  "cpc"              DOUBLE PRECISION,
  "ctr"              DOUBLE PRECISION,
  "cpa"              DOUBLE PRECISION,
  "roas"             DOUBLE PRECISION,
  "relevanceScore"   DOUBLE PRECISION,
  "dataSource"       TEXT             NOT NULL DEFAULT 'api',
  "syncedAt"         TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"        TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdPerformanceSnapshot_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdPerformanceSnapshot_adCampaignId_fkey') THEN
    ALTER TABLE "AdPerformanceSnapshot" ADD CONSTRAINT "AdPerformanceSnapshot_adCampaignId_fkey"
      FOREIGN KEY ("adCampaignId") REFERENCES "AdCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'AdPerformanceSnapshot_adCampaignId_adSetId_adId_date_key') THEN
    ALTER TABLE "AdPerformanceSnapshot"
      ADD CONSTRAINT "AdPerformanceSnapshot_adCampaignId_adSetId_adId_date_key"
      UNIQUE ("adCampaignId", "adSetId", "adId", "date");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "AdPerformanceSnapshot_adCampaignId_idx" ON "AdPerformanceSnapshot"("adCampaignId");
CREATE INDEX IF NOT EXISTS "AdPerformanceSnapshot_adSetId_idx"       ON "AdPerformanceSnapshot"("adSetId");
CREATE INDEX IF NOT EXISTS "AdPerformanceSnapshot_adId_idx"          ON "AdPerformanceSnapshot"("adId");
CREATE INDEX IF NOT EXISTS "AdPerformanceSnapshot_date_idx"          ON "AdPerformanceSnapshot"("date");

-- ──────────────────────────────────────────────────────────────────────────────
-- 7. CampaignMemory
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "CampaignMemory" (
  "id"           TEXT         NOT NULL,
  "workspaceId"  TEXT         NOT NULL,
  "campaignId"   TEXT,
  "goal"         TEXT,
  "tone"         TEXT,
  "industry"     TEXT,
  "audienceHint" TEXT,
  "learnings"    JSONB        NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignMemory_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CampaignMemory_workspaceId_fkey') THEN
    ALTER TABLE "CampaignMemory" ADD CONSTRAINT "CampaignMemory_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "CampaignMemory_workspaceId_idx"           ON "CampaignMemory"("workspaceId");
CREATE INDEX IF NOT EXISTS "CampaignMemory_workspaceId_goal_idx"      ON "CampaignMemory"("workspaceId", "goal");
CREATE INDEX IF NOT EXISTS "CampaignMemory_workspaceId_createdAt_idx" ON "CampaignMemory"("workspaceId", "createdAt");

-- ──────────────────────────────────────────────────────────────────────────────
-- 8. BrainLearning
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "BrainLearning" (
  "id"           TEXT         NOT NULL,
  "workspaceId"  TEXT         NOT NULL,
  "campaignId"   TEXT,
  "trigger"      TEXT         NOT NULL,
  "field"        TEXT         NOT NULL,
  "displayName"  TEXT         NOT NULL,
  "icon"         TEXT,
  "current"      JSONB,
  "proposed"     JSONB        NOT NULL,
  "reason"       TEXT         NOT NULL,
  "status"       TEXT         NOT NULL DEFAULT 'pending',
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BrainLearning_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BrainLearning_workspaceId_fkey') THEN
    ALTER TABLE "BrainLearning" ADD CONSTRAINT "BrainLearning_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "BrainLearning_workspaceId_status_idx"    ON "BrainLearning"("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "BrainLearning_workspaceId_createdAt_idx" ON "BrainLearning"("workspaceId", "createdAt");

-- ──────────────────────────────────────────────────────────────────────────────
-- 9. BrainScoreSnapshot
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "BrainScoreSnapshot" (
  "id"           TEXT         NOT NULL,
  "workspaceId"  TEXT         NOT NULL,
  "score"        INTEGER      NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BrainScoreSnapshot_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BrainScoreSnapshot_workspaceId_fkey') THEN
    ALTER TABLE "BrainScoreSnapshot" ADD CONSTRAINT "BrainScoreSnapshot_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "BrainScoreSnapshot_workspaceId_createdAt_idx"
  ON "BrainScoreSnapshot"("workspaceId", "createdAt");

-- ──────────────────────────────────────────────────────────────────────────────
-- 10. New columns on existing tables
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE "BrandProfile" ADD COLUMN IF NOT EXISTS "websiteUrl"      TEXT;
ALTER TABLE "BrandProfile" ADD COLUMN IF NOT EXISTS "contentSamples"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "SocialPost"   ADD COLUMN IF NOT EXISTS "sourceType"            TEXT DEFAULT 'AI_GENERATED';
ALTER TABLE "SocialPost"   ADD COLUMN IF NOT EXISTS "sourceMediaId"         TEXT;
ALTER TABLE "SocialPost"   ADD COLUMN IF NOT EXISTS "variantGroup"          TEXT;
ALTER TABLE "SocialPost"   ADD COLUMN IF NOT EXISTS "performanceAnalyzedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "SocialPost_variantGroup_idx" ON "SocialPost"("variantGroup");

-- ──────────────────────────────────────────────────────────────────────────────
-- Done.
-- ──────────────────────────────────────────────────────────────────────────────
SELECT 'Migration complete ✓' AS result;
