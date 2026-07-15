-- Immutable, versioned campaign decisions. Nexus reads and writes this ledger
-- through authenticated server routes and Prisma only; the Supabase Data API is
-- deliberately denied to browser roles.
ALTER TABLE "Campaign"
  ADD COLUMN IF NOT EXISTS "snapshotVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "CampaignSnapshot" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "scope" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignSnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CampaignSnapshot_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CampaignSnapshot_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CampaignSnapshot_campaignId_version_key"
  ON "CampaignSnapshot"("campaignId", "version");
CREATE INDEX IF NOT EXISTS "CampaignSnapshot_workspaceId_createdAt_idx"
  ON "CampaignSnapshot"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "CampaignSnapshot_campaignId_scope_createdAt_idx"
  ON "CampaignSnapshot"("campaignId", "scope", "createdAt");
CREATE INDEX IF NOT EXISTS "CampaignSnapshot_payloadHash_idx"
  ON "CampaignSnapshot"("payloadHash");

ALTER TABLE "SocialPost"
  ADD COLUMN IF NOT EXISTS "approvedSnapshotId" TEXT,
  ADD COLUMN IF NOT EXISTS "scheduledSnapshotId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'SocialPost_approvedSnapshotId_fkey'
  ) THEN
    ALTER TABLE "SocialPost"
      ADD CONSTRAINT "SocialPost_approvedSnapshotId_fkey"
      FOREIGN KEY ("approvedSnapshotId") REFERENCES "CampaignSnapshot"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'SocialPost_scheduledSnapshotId_fkey'
  ) THEN
    ALTER TABLE "SocialPost"
      ADD CONSTRAINT "SocialPost_scheduledSnapshotId_fkey"
      FOREIGN KEY ("scheduledSnapshotId") REFERENCES "CampaignSnapshot"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "SocialPost_approvedSnapshotId_idx"
  ON "SocialPost"("approvedSnapshotId");
CREATE INDEX IF NOT EXISTS "SocialPost_scheduledSnapshotId_idx"
  ON "SocialPost"("scheduledSnapshotId");

-- Historical decisions are append-only. Deletion remains available for the
-- explicit workspace reset and cascade cleanup paths.
CREATE OR REPLACE FUNCTION public.prevent_campaign_snapshot_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'CampaignSnapshot rows are immutable';
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_campaign_snapshot_update() FROM PUBLIC;

DROP TRIGGER IF EXISTS "CampaignSnapshot_immutable_update" ON "CampaignSnapshot";
CREATE TRIGGER "CampaignSnapshot_immutable_update"
BEFORE UPDATE ON "CampaignSnapshot"
FOR EACH ROW EXECUTE FUNCTION public.prevent_campaign_snapshot_update();

ALTER TABLE "CampaignSnapshot" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "CampaignSnapshot" FROM anon, authenticated;
