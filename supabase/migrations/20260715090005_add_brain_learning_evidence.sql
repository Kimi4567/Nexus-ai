-- Learning proposals must carry machine-readable provenance and rollback
-- context instead of hiding sample size and confidence inside prose.
ALTER TABLE "BrainLearning"
  ADD COLUMN IF NOT EXISTS "evidence" JSONB;
