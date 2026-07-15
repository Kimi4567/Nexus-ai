-- Copy, final media, and scheduling are three separate user decisions.
-- Pin the final-media decision to the immutable CampaignSnapshot ledger so a
-- media replacement cannot inherit an earlier approval or publish silently.
ALTER TABLE "SocialPost"
  ADD COLUMN IF NOT EXISTS "mediaApprovalSnapshotId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'SocialPost_mediaApprovalSnapshotId_fkey'
  ) THEN
    ALTER TABLE "SocialPost"
      ADD CONSTRAINT "SocialPost_mediaApprovalSnapshotId_fkey"
      FOREIGN KEY ("mediaApprovalSnapshotId")
      REFERENCES "CampaignSnapshot"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "SocialPost_mediaApprovalSnapshotId_idx"
  ON "SocialPost"("mediaApprovalSnapshotId");
