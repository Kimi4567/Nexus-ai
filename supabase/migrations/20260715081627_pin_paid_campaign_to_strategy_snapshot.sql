-- Pin every newly created paid campaign to the exact immutable strategy
-- approval revision that authorized it. Existing rows remain NULL and fail
-- closed in execution routes until they are rebuilt from a reviewed strategy.
ALTER TABLE "AdCampaign"
  ADD COLUMN IF NOT EXISTS "strategySnapshotId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AdCampaign_strategySnapshotId_fkey'
  ) THEN
    ALTER TABLE "AdCampaign"
      ADD CONSTRAINT "AdCampaign_strategySnapshotId_fkey"
      FOREIGN KEY ("strategySnapshotId") REFERENCES "CampaignSnapshot"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "AdCampaign_strategySnapshotId_idx"
  ON "AdCampaign"("strategySnapshotId");
