-- Social Publishing Migration
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard → SQL Editor

-- 1. Add GOOGLE to IntegrationType enum
ALTER TYPE "IntegrationType" ADD VALUE IF NOT EXISTS 'GOOGLE';

-- 2. Create SocialPostStatus enum
DO $$ BEGIN
  CREATE TYPE "SocialPostStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 3. Create SocialPost table
CREATE TABLE IF NOT EXISTS "SocialPost" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workspaceId"     TEXT NOT NULL,
  "campaignId"      TEXT,
  "integrationId"   TEXT NOT NULL,
  "platform"        "IntegrationType" NOT NULL,
  "pageId"          TEXT,
  "pageName"        TEXT,
  "caption"         TEXT NOT NULL,
  "imageUrl"        TEXT,
  "link"            TEXT,
  "platformPostId"  TEXT,
  "platformUrl"     TEXT,
  "status"          "SocialPostStatus" NOT NULL DEFAULT 'DRAFT',
  "errorMessage"    TEXT,
  "scheduledAt"     TIMESTAMP(3),
  "publishedAt"     TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SocialPost_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE,
  CONSTRAINT "SocialPost_integrationId_fkey"
    FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS "SocialPost_workspaceId_idx"   ON "SocialPost"("workspaceId");
CREATE INDEX IF NOT EXISTS "SocialPost_campaignId_idx"    ON "SocialPost"("campaignId");
CREATE INDEX IF NOT EXISTS "SocialPost_integrationId_idx" ON "SocialPost"("integrationId");
CREATE INDEX IF NOT EXISTS "SocialPost_status_idx"        ON "SocialPost"("status");

-- 5. Auto-update updatedAt trigger
CREATE OR REPLACE FUNCTION update_social_post_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW."updatedAt" = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS social_post_updated_at ON "SocialPost";
CREATE TRIGGER social_post_updated_at
  BEFORE UPDATE ON "SocialPost"
  FOR EACH ROW EXECUTE FUNCTION update_social_post_updated_at();
