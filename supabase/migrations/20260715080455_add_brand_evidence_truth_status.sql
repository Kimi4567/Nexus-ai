-- Evidence truth classification is intentionally separate from the human
-- review workflow status. A claim may be pending review and also flagged as a
-- deterministic conflict; only an explicit user decision can confirm it.
ALTER TABLE "BrandEvidenceClaim"
  ADD COLUMN IF NOT EXISTS "truthStatus" TEXT NOT NULL DEFAULT 'PROPOSED',
  ADD COLUMN IF NOT EXISTS "conflictClaimId" TEXT,
  ADD COLUMN IF NOT EXISTS "conflictReason" TEXT;

UPDATE "BrandEvidenceClaim"
SET "truthStatus" = 'CONFIRMED'
WHERE "status" = 'APPROVED'
  AND "truthStatus" = 'PROPOSED';

CREATE INDEX IF NOT EXISTS "BrandEvidenceClaim_workspaceId_truthStatus_idx"
  ON "BrandEvidenceClaim"("workspaceId", "truthStatus");

-- Preserve the existing server-only Data API boundary after the schema change.
ALTER TABLE "BrandEvidenceClaim" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "BrandEvidenceClaim" FROM anon, authenticated;
