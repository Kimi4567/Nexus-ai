-- Atomic publish-worker lease.
--
-- The cron publisher can be invoked concurrently by Vercel retries, a second
-- scheduler, or an operator. A short lease lets exactly one worker claim a
-- due post before it calls a provider, while still allowing a crashed worker
-- to be recovered automatically after the lease expires.

ALTER TABLE "SocialPost"
  ADD COLUMN IF NOT EXISTS "publishLeaseUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "publishLeaseToken" TEXT;

CREATE INDEX IF NOT EXISTS "SocialPost_publishLeaseUntil_idx"
  ON "SocialPost"("publishLeaseUntil");
