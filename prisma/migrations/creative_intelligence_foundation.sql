-- NEXUS Creative Intelligence foundation.
-- Additive and backwards-compatible: existing media and posts remain valid,
-- and no content, approval, schedule, or publishing state is changed.

ALTER TABLE "Media"
  ADD COLUMN IF NOT EXISTS "intelligenceStatus" TEXT NOT NULL DEFAULT 'UNANALYZED',
  ADD COLUMN IF NOT EXISTS "intelligence" JSONB,
  ADD COLUMN IF NOT EXISTS "intelligenceVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "intelligenceAnalyzedAt" TIMESTAMP(3);

ALTER TABLE "SocialPost"
  ADD COLUMN IF NOT EXISTS "creativeMatch" JSONB,
  ADD COLUMN IF NOT EXISTS "creativeMatchedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Media_workspaceId_intelligenceStatus_idx"
  ON "Media" ("workspaceId", "intelligenceStatus");

CREATE INDEX IF NOT EXISTS "SocialPost_campaignId_creativeMatchedAt_idx"
  ON "SocialPost" ("campaignId", "creativeMatchedAt");

-- These tables already exist in the exposed public schema. Keep their current
-- ownership policies intact and assert RLS remains enabled after this DDL.
ALTER TABLE "Media" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SocialPost" ENABLE ROW LEVEL SECURITY;
