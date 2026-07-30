-- Durable, low-cost Postgres queue for long AI and Autopilot work.
-- SAFE TO RERUN. Browser roles never access these operational records directly.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AutomationJobStatus') THEN
    CREATE TYPE "AutomationJobStatus" AS ENUM (
      'PREPARING',
      'QUEUED',
      'RUNNING',
      'RETRY_SCHEDULED',
      'WAITING_FOR_APPROVAL',
      'COMPLETED',
      'FAILED',
      'CANCELLED'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AutomationJobStepStatus') THEN
    CREATE TYPE "AutomationJobStepStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "AutomationJob" (
  "id"                TEXT NOT NULL,
  "workspaceId"       TEXT NOT NULL,
  "campaignId"        TEXT,
  "requestedByUserId" TEXT NOT NULL,
  "kind"              TEXT NOT NULL,
  "status"            "AutomationJobStatus" NOT NULL DEFAULT 'PREPARING',
  "idempotencyKey"    TEXT NOT NULL,
  "priority"          INTEGER NOT NULL DEFAULT 0,
  "input"             JSONB NOT NULL,
  "output"            JSONB,
  "currentStep"       TEXT,
  "progress"          INTEGER NOT NULL DEFAULT 0,
  "attemptCount"      INTEGER NOT NULL DEFAULT 0,
  "maxAttempts"       INTEGER NOT NULL DEFAULT 3,
  "nextAttemptAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseToken"        TEXT,
  "leaseExpiresAt"    TIMESTAMP(3),
  "errorCode"         TEXT,
  "lastError"         TEXT,
  "startedAt"         TIMESTAMP(3),
  "completedAt"       TIMESTAMP(3),
  "cancelledAt"       TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AutomationJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AutomationJobStep" (
  "id"          TEXT NOT NULL,
  "jobId"       TEXT NOT NULL,
  "stepKey"     TEXT NOT NULL,
  "attempt"     INTEGER NOT NULL,
  "status"      "AutomationJobStepStatus" NOT NULL DEFAULT 'RUNNING',
  "input"       JSONB,
  "output"      JSONB,
  "error"       TEXT,
  "startedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AutomationJobStep_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'AutomationJob_workspaceId_fkey'
      AND conrelid = '"AutomationJob"'::regclass
  ) THEN
    ALTER TABLE "AutomationJob"
      ADD CONSTRAINT "AutomationJob_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'AutomationJob_campaignId_fkey'
      AND conrelid = '"AutomationJob"'::regclass
  ) THEN
    ALTER TABLE "AutomationJob"
      ADD CONSTRAINT "AutomationJob_campaignId_fkey"
      FOREIGN KEY ("campaignId", "workspaceId") REFERENCES "Campaign"("id", "workspaceId")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'AutomationJobStep_jobId_fkey'
      AND conrelid = '"AutomationJobStep"'::regclass
  ) THEN
    ALTER TABLE "AutomationJobStep"
      ADD CONSTRAINT "AutomationJobStep_jobId_fkey"
      FOREIGN KEY ("jobId") REFERENCES "AutomationJob"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'AutomationJob_progress_check'
      AND conrelid = '"AutomationJob"'::regclass
  ) THEN
    ALTER TABLE "AutomationJob"
      ADD CONSTRAINT "AutomationJob_progress_check"
      CHECK ("progress" >= 0 AND "progress" <= 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'AutomationJob_attempts_check'
      AND conrelid = '"AutomationJob"'::regclass
  ) THEN
    ALTER TABLE "AutomationJob"
      ADD CONSTRAINT "AutomationJob_attempts_check"
      CHECK ("attemptCount" >= 0 AND "maxAttempts" BETWEEN 1 AND 10);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'AutomationJobStep_attempt_check'
      AND conrelid = '"AutomationJobStep"'::regclass
  ) THEN
    ALTER TABLE "AutomationJobStep"
      ADD CONSTRAINT "AutomationJobStep_attempt_check"
      CHECK ("attempt" >= 1);
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS "AutomationJob_workspaceId_kind_idempotencyKey_key"
  ON "AutomationJob" ("workspaceId", "kind", "idempotencyKey");

-- Only one active worker-owned flow may mutate a campaign package at a time.
CREATE UNIQUE INDEX IF NOT EXISTS "AutomationJob_one_active_campaign_kind_key"
  ON "AutomationJob" ("workspaceId", "kind", "campaignId")
  WHERE "campaignId" IS NOT NULL
    AND "status" IN (
      'PREPARING',
      'QUEUED',
      'RUNNING',
      'RETRY_SCHEDULED',
      'WAITING_FOR_APPROVAL'
    );

CREATE INDEX IF NOT EXISTS "AutomationJob_status_nextAttemptAt_priority_createdAt_idx"
  ON "AutomationJob" ("status", "nextAttemptAt", "priority" DESC, "createdAt");
CREATE INDEX IF NOT EXISTS "AutomationJob_workspaceId_createdAt_idx"
  ON "AutomationJob" ("workspaceId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "AutomationJob_campaignId_createdAt_idx"
  ON "AutomationJob" ("campaignId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "AutomationJob_campaignId_kind_status_createdAt_idx"
  ON "AutomationJob" ("campaignId", "kind", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "AutomationJob_leaseExpiresAt_idx"
  ON "AutomationJob" ("leaseExpiresAt");

CREATE UNIQUE INDEX IF NOT EXISTS "AutomationJobStep_jobId_stepKey_attempt_key"
  ON "AutomationJobStep" ("jobId", "stepKey", "attempt");
CREATE INDEX IF NOT EXISTS "AutomationJobStep_jobId_createdAt_idx"
  ON "AutomationJobStep" ("jobId", "createdAt");
CREATE INDEX IF NOT EXISTS "AutomationJobStep_status_createdAt_idx"
  ON "AutomationJobStep" ("status", "createdAt");

ALTER TABLE "AutomationJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AutomationJobStep" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "AutomationJob" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "AutomationJobStep" FROM anon, authenticated;
