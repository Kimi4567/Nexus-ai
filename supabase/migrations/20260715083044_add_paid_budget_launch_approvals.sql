-- Durable, immutable paid-media approvals. The actual decision payloads live
-- in the RLS-protected, append-only CampaignSnapshot ledger; AdCampaign only
-- holds the currently effective budget and launch approval references.
ALTER TABLE "AdCampaign"
  ADD COLUMN IF NOT EXISTS "budgetApprovalSnapshotId" TEXT,
  ADD COLUMN IF NOT EXISTS "launchApprovalSnapshotId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'AdCampaign_budgetApprovalSnapshotId_fkey'
  ) THEN
    ALTER TABLE "AdCampaign"
      ADD CONSTRAINT "AdCampaign_budgetApprovalSnapshotId_fkey"
      FOREIGN KEY ("budgetApprovalSnapshotId") REFERENCES "CampaignSnapshot"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'AdCampaign_launchApprovalSnapshotId_fkey'
  ) THEN
    ALTER TABLE "AdCampaign"
      ADD CONSTRAINT "AdCampaign_launchApprovalSnapshotId_fkey"
      FOREIGN KEY ("launchApprovalSnapshotId") REFERENCES "CampaignSnapshot"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS "AdCampaign_budgetApprovalSnapshotId_key"
  ON "AdCampaign"("budgetApprovalSnapshotId");
CREATE UNIQUE INDEX IF NOT EXISTS "AdCampaign_launchApprovalSnapshotId_key"
  ON "AdCampaign"("launchApprovalSnapshotId");
