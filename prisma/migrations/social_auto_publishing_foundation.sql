-- Social auto-publishing foundation
-- Additive and backward-compatible. Apply before deploying the matching client.

ALTER TYPE "SocialPostStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';

ALTER TABLE "SocialPost"
  ADD COLUMN IF NOT EXISTS "publishTarget" TEXT,
  ADD COLUMN IF NOT EXISTS "platformOptions" JSONB,
  ADD COLUMN IF NOT EXISTS "autoPublishConsentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "publishAttemptedAt" TIMESTAMP(3);

-- Provider-only legacy rows cannot distinguish Facebook from Instagram. Keep
-- those as META (ambiguous) so the product forces a user selection instead of
-- guessing a destination. Unambiguous providers are safe to backfill.
UPDATE "SocialPost"
SET "publishTarget" = CASE
  WHEN "platform"::text IN ('LINKEDIN', 'TIKTOK', 'YOUTUBE') THEN "platform"::text
  ELSE 'META'
END
WHERE "publishTarget" IS NULL;

CREATE INDEX IF NOT EXISTS "SocialPost_publishTarget_idx"
  ON "SocialPost"("publishTarget");
CREATE INDEX IF NOT EXISTS "SocialPost_status_publishAttemptedAt_idx"
  ON "SocialPost"("status", "publishAttemptedAt");
