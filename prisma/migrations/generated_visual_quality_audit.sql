-- Durable audit evidence for professional image generation.
-- Additive and backward-compatible: historical rows remain readable.
ALTER TABLE "GeneratedVisual"
  ADD COLUMN IF NOT EXISTS "provider" TEXT,
  ADD COLUMN IF NOT EXISTS "referenceMediaId" TEXT,
  ADD COLUMN IF NOT EXISTS "creditTransactionId" TEXT,
  ADD COLUMN IF NOT EXISTS "qualityStatus" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "qualityReview" JSONB;

CREATE INDEX IF NOT EXISTS "GeneratedVisual_qualityStatus_idx"
  ON "GeneratedVisual"("qualityStatus");
