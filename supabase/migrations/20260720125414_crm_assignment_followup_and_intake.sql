-- CRM operational layer: accountable ownership, response SLA, follow-up tasks,
-- and write-only public lead capture forms. This remains feature-gated by
-- LEADS_CRM_ENABLED and must be verified in Preview before production use.

ALTER TABLE "Lead"
  ADD COLUMN IF NOT EXISTS "assignedToId" TEXT,
  ADD COLUMN IF NOT EXISTS "firstContactedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "responseDueAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "nextFollowUpAt" TIMESTAMP(3);

ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "LeadTask" (
  "id"             TEXT NOT NULL,
  "leadId"         TEXT NOT NULL,
  "assignedToId"   TEXT,
  "createdById"    TEXT,
  "title"          TEXT NOT NULL,
  "note"           TEXT,
  "status"         TEXT NOT NULL DEFAULT 'OPEN',
  "priority"       TEXT NOT NULL DEFAULT 'MEDIUM',
  "dueAt"          TIMESTAMP(3) NOT NULL,
  "completedAt"    TIMESTAMP(3),
  "completionNote" TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadTask_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LeadTask_status_valid" CHECK ("status" IN ('OPEN', 'COMPLETED', 'CANCELLED')),
  CONSTRAINT "LeadTask_priority_valid" CHECK ("priority" IN ('LOW', 'MEDIUM', 'HIGH')),
  CONSTRAINT "LeadTask_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LeadTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "LeadTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "LeadCaptureForm" (
  "id"               TEXT NOT NULL,
  "publicId"         TEXT NOT NULL,
  "workspaceId"      TEXT NOT NULL,
  "campaignId"       TEXT,
  "createdById"      TEXT,
  "name"             TEXT NOT NULL,
  "title"            TEXT NOT NULL,
  "description"      TEXT,
  "status"           TEXT NOT NULL DEFAULT 'ACTIVE',
  "allowedOrigin"    TEXT,
  "consentStatement" TEXT,
  "submissionCount"  INTEGER NOT NULL DEFAULT 0,
  "lastSubmissionAt" TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadCaptureForm_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LeadCaptureForm_publicId_key" UNIQUE ("publicId"),
  CONSTRAINT "LeadCaptureForm_status_valid" CHECK ("status" IN ('ACTIVE', 'PAUSED', 'ARCHIVED')),
  CONSTRAINT "LeadCaptureForm_submission_count_nonnegative" CHECK ("submissionCount" >= 0),
  CONSTRAINT "LeadCaptureForm_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LeadCaptureForm_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "LeadCaptureForm_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Lead_workspaceId_assignedToId_stage_idx"
  ON "Lead" ("workspaceId", "assignedToId", "stage");
CREATE INDEX IF NOT EXISTS "Lead_assignedToId_idx"
  ON "Lead" ("assignedToId");
CREATE INDEX IF NOT EXISTS "Lead_workspaceId_responseDueAt_idx"
  ON "Lead" ("workspaceId", "responseDueAt");
CREATE INDEX IF NOT EXISTS "Lead_workspaceId_nextFollowUpAt_idx"
  ON "Lead" ("workspaceId", "nextFollowUpAt");
CREATE INDEX IF NOT EXISTS "LeadTask_leadId_status_dueAt_idx"
  ON "LeadTask" ("leadId", "status", "dueAt");
CREATE INDEX IF NOT EXISTS "LeadTask_assignedToId_status_dueAt_idx"
  ON "LeadTask" ("assignedToId", "status", "dueAt");
CREATE INDEX IF NOT EXISTS "LeadTask_createdById_idx"
  ON "LeadTask" ("createdById");
CREATE INDEX IF NOT EXISTS "LeadCaptureForm_workspaceId_status_updatedAt_idx"
  ON "LeadCaptureForm" ("workspaceId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "LeadCaptureForm_campaignId_idx"
  ON "LeadCaptureForm" ("campaignId");
CREATE INDEX IF NOT EXISTS "LeadCaptureForm_createdById_idx"
  ON "LeadCaptureForm" ("createdById");

-- Customer data remains server-only. Public capture uses a narrow Route Handler
-- that accepts writes but never returns workspace or lead records.
ALTER TABLE "LeadTask" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeadCaptureForm" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "LeadTask" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "LeadCaptureForm" FROM anon, authenticated;
