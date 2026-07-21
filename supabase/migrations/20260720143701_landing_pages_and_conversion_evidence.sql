-- Landing pages and truth-preserving conversion evidence. Browser events are
-- explicitly CLIENT_REPORTED; only a successful server-side lead intake may
-- create a SERVER_CONFIRMED form submission. The feature remains gated by
-- LANDING_PAGES_ENABLED until this migration is verified in Preview.

CREATE TABLE IF NOT EXISTS "LandingPage" (
  "id"                TEXT NOT NULL,
  "publicId"          TEXT NOT NULL,
  "workspaceId"       TEXT NOT NULL,
  "campaignId"        TEXT NOT NULL,
  "captureFormId"     TEXT,
  "name"              TEXT NOT NULL,
  "locale"            TEXT NOT NULL DEFAULT 'AR',
  "status"            TEXT NOT NULL DEFAULT 'DRAFT',
  "headline"          TEXT NOT NULL,
  "subheadline"       TEXT,
  "body"              TEXT,
  "benefits"          JSONB NOT NULL DEFAULT '[]'::jsonb,
  "proof"             TEXT,
  "primaryCtaLabel"   TEXT NOT NULL,
  "primaryCtaUrl"     TEXT,
  "theme"             JSONB NOT NULL DEFAULT '{}'::jsonb,
  "version"           INTEGER NOT NULL DEFAULT 1,
  "publishedVersion"  INTEGER,
  "publishedSnapshot" JSONB,
  "publishedHash"     TEXT,
  "createdById"       TEXT,
  "publishedById"     TEXT,
  "publishedAt"       TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LandingPage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LandingPage_publicId_key" UNIQUE ("publicId"),
  CONSTRAINT "LandingPage_locale_valid" CHECK ("locale" IN ('AR', 'EN', 'BILINGUAL')),
  CONSTRAINT "LandingPage_status_valid" CHECK ("status" IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  CONSTRAINT "LandingPage_version_positive" CHECK ("version" > 0),
  CONSTRAINT "LandingPage_published_version_valid" CHECK ("publishedVersion" IS NULL OR ("publishedVersion" > 0 AND "publishedVersion" <= "version")),
  CONSTRAINT "LandingPage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LandingPage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LandingPage_captureFormId_fkey" FOREIGN KEY ("captureFormId") REFERENCES "LeadCaptureForm"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "LandingPageRevision" (
  "id"            TEXT NOT NULL,
  "landingPageId" TEXT NOT NULL,
  "version"       INTEGER NOT NULL,
  "snapshot"      JSONB NOT NULL,
  "changeNote"    TEXT,
  "createdById"   TEXT,
  "publishedById" TEXT,
  "publishedAt"   TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LandingPageRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LandingPageRevision_version_positive" CHECK ("version" > 0),
  CONSTRAINT "LandingPageRevision_landingPageId_fkey" FOREIGN KEY ("landingPageId") REFERENCES "LandingPage"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ConversionEvent" (
  "id"                TEXT NOT NULL,
  "workspaceId"       TEXT NOT NULL,
  "campaignId"        TEXT NOT NULL,
  "landingPageId"     TEXT NOT NULL,
  "leadId"            TEXT,
  "eventType"         TEXT NOT NULL,
  "verificationState" TEXT NOT NULL,
  "source"            TEXT NOT NULL DEFAULT 'LANDING_PAGE',
  "attribution"       JSONB NOT NULL DEFAULT '{}'::jsonb,
  "fingerprintHash"   TEXT,
  "dedupeKey"         TEXT NOT NULL,
  "occurredAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConversionEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ConversionEvent_dedupeKey_key" UNIQUE ("dedupeKey"),
  CONSTRAINT "ConversionEvent_type_valid" CHECK ("eventType" IN ('PAGE_VIEW', 'CTA_CLICK', 'FORM_SUBMITTED')),
  CONSTRAINT "ConversionEvent_verification_valid" CHECK ("verificationState" IN ('CLIENT_REPORTED', 'SERVER_CONFIRMED')),
  CONSTRAINT "ConversionEvent_source_valid" CHECK ("source" = 'LANDING_PAGE'),
  CONSTRAINT "ConversionEvent_truth_invariant" CHECK (
    -- leadId may become NULL after a privacy deletion; verificationState keeps
    -- the server-side intake fact without retaining the deleted identity.
    ("eventType" = 'FORM_SUBMITTED' AND "verificationState" = 'SERVER_CONFIRMED')
    OR
    ("eventType" IN ('PAGE_VIEW', 'CTA_CLICK') AND "verificationState" = 'CLIENT_REPORTED')
  ),
  CONSTRAINT "ConversionEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ConversionEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ConversionEvent_landingPageId_fkey" FOREIGN KEY ("landingPageId") REFERENCES "LandingPage"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ConversionEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "LandingPage_workspaceId_status_updatedAt_idx"
  ON "LandingPage" ("workspaceId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "LandingPage_campaignId_idx" ON "LandingPage" ("campaignId");
CREATE INDEX IF NOT EXISTS "LandingPage_captureFormId_idx" ON "LandingPage" ("captureFormId");
CREATE UNIQUE INDEX IF NOT EXISTS "LandingPageRevision_landingPageId_version_key"
  ON "LandingPageRevision" ("landingPageId", "version");
CREATE INDEX IF NOT EXISTS "LandingPageRevision_landingPageId_createdAt_idx"
  ON "LandingPageRevision" ("landingPageId", "createdAt");
CREATE INDEX IF NOT EXISTS "ConversionEvent_workspaceId_eventType_occurredAt_idx"
  ON "ConversionEvent" ("workspaceId", "eventType", "occurredAt");
CREATE INDEX IF NOT EXISTS "ConversionEvent_campaignId_occurredAt_idx"
  ON "ConversionEvent" ("campaignId", "occurredAt");
CREATE INDEX IF NOT EXISTS "ConversionEvent_landingPageId_eventType_occurredAt_idx"
  ON "ConversionEvent" ("landingPageId", "eventType", "occurredAt");
CREATE INDEX IF NOT EXISTS "ConversionEvent_leadId_occurredAt_idx"
  ON "ConversionEvent" ("leadId", "occurredAt");

-- All tables are server-only. Public rendering and event intake happen through
-- narrow Route Handlers; Supabase browser roles receive no direct table access.
ALTER TABLE "LandingPage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LandingPageRevision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConversionEvent" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "LandingPage" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "LandingPageRevision" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "ConversionEvent" FROM anon, authenticated;
