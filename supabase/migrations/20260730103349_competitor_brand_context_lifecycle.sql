-- Competitor observations must never silently carry over when the user changes
-- the Brand Brain identity. Existing history is preserved, but legacy monitors
-- are paused once and require an explicit review against the current brand.

ALTER TABLE public."Competitor"
  ADD COLUMN IF NOT EXISTS "brandContextFingerprint" TEXT,
  ADD COLUMN IF NOT EXISTS "contextReviewRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "contextInvalidatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "contextReviewedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Competitor_workspaceId_contextReviewRequired_status_idx"
  ON public."Competitor" ("workspaceId", "contextReviewRequired", "status");

UPDATE public."Competitor"
SET
  "status" = 'PAUSED',
  "contextReviewRequired" = true,
  "contextInvalidatedAt" = NOW(),
  "nextScanAt" = NULL
WHERE "contextReviewRequired" = false;

UPDATE public."CompetitorSignal"
SET
  "status" = 'DISMISSED',
  "reviewedAt" = NOW(),
  "reviewedBy" = 'SYSTEM:BRAND_CONTEXT_MIGRATION'
WHERE "status" IN ('NEW', 'REVIEWED', 'PROPOSED');

UPDATE public."BrainLearning"
SET "status" = 'dismissed'
WHERE "trigger" = 'competitor_monitor'
  AND "status" = 'pending';

UPDATE public."CompetitorSource"
SET
  "leaseUntil" = NULL,
  "leaseToken" = NULL;
