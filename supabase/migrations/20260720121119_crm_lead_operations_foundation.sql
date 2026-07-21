-- Workspace-isolated CRM foundation for real lead operations.
-- Apply first in a recoverable Preview/Test database. The application remains
-- fail-closed behind LEADS_CRM_ENABLED until this schema probe succeeds.

CREATE TABLE IF NOT EXISTS "Lead" (
  "id"              TEXT NOT NULL,
  "workspaceId"     TEXT NOT NULL,
  "campaignId"      TEXT,
  "fullName"        TEXT,
  "email"           TEXT,
  "emailNormalized" TEXT,
  "phone"           TEXT,
  "phoneNormalized" TEXT,
  "company"         TEXT,
  "jobTitle"        TEXT,
  "source"          TEXT NOT NULL DEFAULT 'MANUAL',
  "sourceDetail"    TEXT,
  "stage"           TEXT NOT NULL DEFAULT 'NEW',
  "score"           INTEGER NOT NULL DEFAULT 0,
  "lostReason"      TEXT,
  "consentStatus"   TEXT NOT NULL DEFAULT 'UNKNOWN',
  "consentSource"   TEXT,
  "consentAt"       TIMESTAMP(3),
  "attribution"     JSONB NOT NULL DEFAULT '{}'::jsonb,
  "lastActivityAt"  TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Lead_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Lead_contact_required" CHECK ("emailNormalized" IS NOT NULL OR "phoneNormalized" IS NOT NULL),
  CONSTRAINT "Lead_score_range" CHECK ("score" BETWEEN 0 AND 100),
  CONSTRAINT "Lead_source_valid" CHECK ("source" IN ('MANUAL', 'FORM', 'IMPORT', 'SOCIAL', 'PAID_AD', 'REFERRAL', 'OTHER')),
  CONSTRAINT "Lead_stage_valid" CHECK ("stage" IN ('NEW', 'CONTACTED', 'QUALIFIED', 'NURTURING', 'OPPORTUNITY', 'WON', 'LOST', 'DISQUALIFIED')),
  CONSTRAINT "Lead_consent_valid" CHECK ("consentStatus" IN ('UNKNOWN', 'GRANTED', 'DENIED', 'REVOKED')),
  CONSTRAINT "Lead_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Lead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "LeadActivity" (
  "id"         TEXT NOT NULL,
  "leadId"     TEXT NOT NULL,
  "type"       TEXT NOT NULL,
  "actor"      TEXT NOT NULL DEFAULT 'USER',
  "note"       TEXT,
  "metadata"   JSONB NOT NULL DEFAULT '{}'::jsonb,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Lead_workspaceId_emailNormalized_key"
  ON "Lead" ("workspaceId", "emailNormalized");
CREATE UNIQUE INDEX IF NOT EXISTS "Lead_workspaceId_phoneNormalized_key"
  ON "Lead" ("workspaceId", "phoneNormalized");
CREATE INDEX IF NOT EXISTS "Lead_workspaceId_stage_updatedAt_idx"
  ON "Lead" ("workspaceId", "stage", "updatedAt");
CREATE INDEX IF NOT EXISTS "Lead_workspaceId_source_createdAt_idx"
  ON "Lead" ("workspaceId", "source", "createdAt");
CREATE INDEX IF NOT EXISTS "Lead_campaignId_idx" ON "Lead" ("campaignId");
CREATE INDEX IF NOT EXISTS "Lead_lastActivityAt_idx" ON "Lead" ("lastActivityAt");
CREATE INDEX IF NOT EXISTS "LeadActivity_leadId_occurredAt_idx"
  ON "LeadActivity" ("leadId", "occurredAt");
CREATE INDEX IF NOT EXISTS "LeadActivity_type_occurredAt_idx"
  ON "LeadActivity" ("type", "occurredAt");

-- CRM contains customer PII. It is intentionally server-only; authenticated
-- browser users reach it through workspace-authorized Route Handlers, not the
-- Data API. RLS remains enabled as defense in depth.
ALTER TABLE "Lead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeadActivity" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "Lead" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "LeadActivity" FROM anon, authenticated;
