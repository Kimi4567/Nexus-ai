-- Durable Stripe webhook idempotency + retry audit.
-- SAFE TO RERUN. Apply and verify in Test Mode before enabling billing flags.

CREATE TABLE IF NOT EXISTS "BillingWebhookEvent" (
  "id"             TEXT NOT NULL,
  "type"           TEXT NOT NULL,
  "status"         TEXT NOT NULL DEFAULT 'PROCESSING',
  "attemptCount"   INTEGER NOT NULL DEFAULT 1,
  "eventCreatedAt" TIMESTAMP(3),
  "processedAt"    TIMESTAMP(3),
  "error"          TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BillingWebhookEvent_status_updatedAt_idx"
  ON "BillingWebhookEvent" ("status", "updatedAt");

-- Billing evidence is server-only. Supabase Data API roles must never read or
-- mutate signed provider-event state directly.
ALTER TABLE "BillingWebhookEvent" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "BillingWebhookEvent" FROM anon, authenticated;
