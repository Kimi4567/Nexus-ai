-- Content Hub Migration
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard → SQL Editor

-- 1. Make integrationId optional (NULL = post exists in plan but not yet linked to a platform account)
ALTER TABLE "SocialPost" ALTER COLUMN "integrationId" DROP NOT NULL;

-- 2. Add Content Hub fields
ALTER TABLE "SocialPost"
  ADD COLUMN IF NOT EXISTS "isVideoPost"      BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "videoPrompt"      TEXT,
  ADD COLUMN IF NOT EXISTS "generationStatus" TEXT        NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "mediaSource"      TEXT        NOT NULL DEFAULT 'GENERATE',
  ADD COLUMN IF NOT EXISTS "uploadedMediaId"  TEXT,
  ADD COLUMN IF NOT EXISTS "contentPlanIndex" INTEGER;

-- 3. Indexes for Content Hub queries
CREATE INDEX IF NOT EXISTS "SocialPost_generationStatus_idx" ON "SocialPost"("generationStatus");
CREATE INDEX IF NOT EXISTS "SocialPost_contentPlanIndex_idx" ON "SocialPost"("contentPlanIndex");
CREATE INDEX IF NOT EXISTS "SocialPost_isVideoPost_idx"      ON "SocialPost"("isVideoPost");

-- Verify
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'SocialPost'
  AND column_name IN ('integrationId','isVideoPost','videoPrompt','generationStatus','mediaSource','uploadedMediaId','contentPlanIndex')
ORDER BY column_name;
