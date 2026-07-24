-- NEXUS competitor intelligence foundation.
-- Public web sources only; baseline-first; no automatic Brand Brain mutation.

CREATE TABLE IF NOT EXISTS "Competitor" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "websiteUrl" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "baselineStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
  "baselineAt" TIMESTAMP(3),
  "lastScanAt" TIMESTAMP(3),
  "nextScanAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Competitor_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Competitor_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Competitor_status_check" CHECK ("status" IN ('ACTIVE', 'PAUSED')),
  CONSTRAINT "Competitor_baselineStatus_check" CHECK ("baselineStatus" IN ('NOT_STARTED', 'RUNNING', 'READY', 'FAILED'))
);

CREATE TABLE IF NOT EXISTS "CompetitorSource" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workspaceId" TEXT NOT NULL,
  "competitorId" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'HOME',
  "url" TEXT NOT NULL,
  "normalizedUrl" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "cadenceHours" INTEGER NOT NULL DEFAULT 24,
  "nextScanAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastCheckedAt" TIMESTAMP(3),
  "lastSuccessAt" TIMESTAMP(3),
  "lastStatusCode" INTEGER,
  "etag" TEXT,
  "lastModified" TEXT,
  "lastHash" TEXT,
  "robotsAllowed" BOOLEAN,
  "lastError" TEXT,
  "leaseUntil" TIMESTAMP(3),
  "leaseToken" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompetitorSource_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CompetitorSource_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CompetitorSource_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CompetitorSource_type_check" CHECK ("type" IN ('HOME', 'PRICING', 'PRODUCT', 'BLOG', 'NEWSROOM', 'CUSTOM')),
  CONSTRAINT "CompetitorSource_cadenceHours_check" CHECK ("cadenceHours" BETWEEN 1 AND 168)
);

CREATE TABLE IF NOT EXISTS "CompetitorSnapshot" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workspaceId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "title" TEXT,
  "normalizedText" TEXT NOT NULL,
  "extracted" JSONB NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompetitorSnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CompetitorSnapshot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CompetitorSnapshot_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CompetitorSource"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "CompetitorSignal" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workspaceId" TEXT NOT NULL,
  "competitorId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "previousSnapshotId" TEXT,
  "currentSnapshotId" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "beforeText" TEXT,
  "afterText" TEXT,
  "evidence" JSONB NOT NULL,
  "confidence" INTEGER NOT NULL DEFAULT 70,
  "importance" INTEGER NOT NULL DEFAULT 2,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "proposalId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompetitorSignal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CompetitorSignal_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CompetitorSignal_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CompetitorSignal_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CompetitorSource"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CompetitorSignal_previousSnapshotId_fkey" FOREIGN KEY ("previousSnapshotId") REFERENCES "CompetitorSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "CompetitorSignal_currentSnapshotId_fkey" FOREIGN KEY ("currentSnapshotId") REFERENCES "CompetitorSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CompetitorSignal_type_check" CHECK ("type" IN ('MESSAGE_CHANGE', 'PRICE_CHANGE', 'OFFER_CHANGE', 'CTA_CHANGE', 'PAGE_CHANGE')),
  CONSTRAINT "CompetitorSignal_status_check" CHECK ("status" IN ('NEW', 'REVIEWED', 'DISMISSED', 'PROPOSED')),
  CONSTRAINT "CompetitorSignal_confidence_check" CHECK ("confidence" BETWEEN 0 AND 100),
  CONSTRAINT "CompetitorSignal_importance_check" CHECK ("importance" BETWEEN 1 AND 3)
);

CREATE TABLE IF NOT EXISTS "CompetitorResearchRun" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workspaceId" TEXT NOT NULL,
  "trigger" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "sourcesSelected" INTEGER NOT NULL DEFAULT 0,
  "sourcesChecked" INTEGER NOT NULL DEFAULT 0,
  "changesDetected" INTEGER NOT NULL DEFAULT 0,
  "signalsCreated" INTEGER NOT NULL DEFAULT 0,
  "errors" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "CompetitorResearchRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CompetitorResearchRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CompetitorResearchRun_trigger_check" CHECK ("trigger" IN ('BASELINE', 'MANUAL', 'CRON')),
  CONSTRAINT "CompetitorResearchRun_status_check" CHECK ("status" IN ('RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED')),
  CONSTRAINT "CompetitorResearchRun_counts_check" CHECK ("sourcesSelected" >= 0 AND "sourcesChecked" >= 0 AND "changesDetected" >= 0 AND "signalsCreated" >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "Competitor_workspaceId_domain_key" ON "Competitor"("workspaceId", "domain");
CREATE INDEX IF NOT EXISTS "Competitor_workspaceId_status_idx" ON "Competitor"("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "Competitor_workspaceId_updatedAt_idx" ON "Competitor"("workspaceId", "updatedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "CompetitorSource_competitorId_normalizedUrl_key" ON "CompetitorSource"("competitorId", "normalizedUrl");
CREATE INDEX IF NOT EXISTS "CompetitorSource_workspaceId_enabled_nextScanAt_idx" ON "CompetitorSource"("workspaceId", "enabled", "nextScanAt");
CREATE INDEX IF NOT EXISTS "CompetitorSource_competitorId_enabled_idx" ON "CompetitorSource"("competitorId", "enabled");
CREATE INDEX IF NOT EXISTS "CompetitorSource_leaseUntil_idx" ON "CompetitorSource"("leaseUntil");
CREATE UNIQUE INDEX IF NOT EXISTS "CompetitorSnapshot_sourceId_contentHash_key" ON "CompetitorSnapshot"("sourceId", "contentHash");
CREATE INDEX IF NOT EXISTS "CompetitorSnapshot_workspaceId_capturedAt_idx" ON "CompetitorSnapshot"("workspaceId", "capturedAt");
CREATE INDEX IF NOT EXISTS "CompetitorSnapshot_sourceId_capturedAt_idx" ON "CompetitorSnapshot"("sourceId", "capturedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "CompetitorSignal_fingerprint_key" ON "CompetitorSignal"("fingerprint");
CREATE INDEX IF NOT EXISTS "CompetitorSignal_workspaceId_status_createdAt_idx" ON "CompetitorSignal"("workspaceId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "CompetitorSignal_competitorId_createdAt_idx" ON "CompetitorSignal"("competitorId", "createdAt");
CREATE INDEX IF NOT EXISTS "CompetitorSignal_sourceId_createdAt_idx" ON "CompetitorSignal"("sourceId", "createdAt");
CREATE INDEX IF NOT EXISTS "CompetitorResearchRun_workspaceId_startedAt_idx" ON "CompetitorResearchRun"("workspaceId", "startedAt");
CREATE INDEX IF NOT EXISTS "CompetitorResearchRun_status_startedAt_idx" ON "CompetitorResearchRun"("status", "startedAt");

ALTER TABLE "Competitor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CompetitorSource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CompetitorSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CompetitorSignal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CompetitorResearchRun" ENABLE ROW LEVEL SECURITY;

-- These tables are server-only. The application re-checks workspace ownership
-- in every route and uses its server database role; no direct Data API access.
REVOKE ALL ON TABLE "Competitor", "CompetitorSource", "CompetitorSnapshot", "CompetitorSignal", "CompetitorResearchRun" FROM anon, authenticated;
