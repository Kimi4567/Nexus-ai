-- Truth-preserving single-variable landing-page experiments. The public route
-- assigns an immutable CONTROL or CHALLENGER snapshot. Browser events remain
-- CLIENT_REPORTED; only successful lead intake can create SERVER_CONFIRMED
-- form evidence. Keep LANDING_PAGE_EXPERIMENTS_ENABLED=false until Preview is
-- migrated and the full publish -> form -> conversion path is verified.

CREATE TABLE "LandingPageExperiment" (
  "id"                           TEXT NOT NULL,
  "workspaceId"                  TEXT NOT NULL,
  "campaignId"                   TEXT NOT NULL,
  "landingPageId"                TEXT NOT NULL,
  "status"                       TEXT NOT NULL DEFAULT 'DRAFT',
  "hypothesis"                   TEXT NOT NULL,
  "variable"                     TEXT NOT NULL,
  "successMetric"                TEXT NOT NULL DEFAULT 'FORM_SUBMITTED',
  "decisionRule"                 TEXT NOT NULL DEFAULT 'MANUAL_REVIEW_AFTER_MINIMUM_EVIDENCE',
  "minimumVisitorsPerVariant"    INTEGER NOT NULL DEFAULT 100,
  "minimumConversionsPerVariant" INTEGER NOT NULL DEFAULT 10,
  "challengerAllocationPercent"  INTEGER NOT NULL DEFAULT 50,
  "controlSnapshot"              JSONB NOT NULL,
  "controlHash"                  TEXT NOT NULL,
  "challengerSnapshot"           JSONB NOT NULL,
  "challengerHash"               TEXT NOT NULL,
  "version"                      INTEGER NOT NULL DEFAULT 1,
  "startedAt"                    TIMESTAMP(3),
  "pausedAt"                     TIMESTAMP(3),
  "endedAt"                      TIMESTAMP(3),
  "decision"                     TEXT,
  "decisionNote"                 TEXT,
  "decisionEvidence"             JSONB,
  "createdById"                  TEXT,
  "decidedById"                  TEXT,
  "createdAt"                    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LandingPageExperiment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LandingPageExperiment_status_valid" CHECK ("status" IN ('DRAFT', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED')),
  CONSTRAINT "LandingPageExperiment_variable_valid" CHECK ("variable" IN ('HEADLINE', 'SUBHEADLINE', 'CTA_LABEL')),
  CONSTRAINT "LandingPageExperiment_metric_valid" CHECK ("successMetric" = 'FORM_SUBMITTED'),
  CONSTRAINT "LandingPageExperiment_rule_valid" CHECK ("decisionRule" = 'MANUAL_REVIEW_AFTER_MINIMUM_EVIDENCE'),
  CONSTRAINT "LandingPageExperiment_visitors_valid" CHECK ("minimumVisitorsPerVariant" BETWEEN 50 AND 1000000),
  CONSTRAINT "LandingPageExperiment_conversions_valid" CHECK ("minimumConversionsPerVariant" BETWEEN 1 AND 100000),
  CONSTRAINT "LandingPageExperiment_allocation_valid" CHECK ("challengerAllocationPercent" BETWEEN 10 AND 90),
  CONSTRAINT "LandingPageExperiment_version_positive" CHECK ("version" > 0),
  CONSTRAINT "LandingPageExperiment_snapshots_are_objects" CHECK (
    jsonb_typeof("controlSnapshot") = 'object' AND jsonb_typeof("challengerSnapshot") = 'object'
  ),
  CONSTRAINT "LandingPageExperiment_running_started" CHECK ("status" <> 'RUNNING' OR "startedAt" IS NOT NULL),
  CONSTRAINT "LandingPageExperiment_completed_decided" CHECK (
    "status" <> 'COMPLETED' OR ("endedAt" IS NOT NULL AND "decision" IS NOT NULL)
  ),
  CONSTRAINT "LandingPageExperiment_decision_valid" CHECK (
    "decision" IS NULL OR "decision" IN ('KEEP_CONTROL', 'APPLY_CHALLENGER_DRAFT', 'INCONCLUSIVE')
  ),
  CONSTRAINT "LandingPageExperiment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LandingPageExperiment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LandingPageExperiment_landingPageId_fkey" FOREIGN KEY ("landingPageId") REFERENCES "LandingPage"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "ConversionEvent"
  ADD COLUMN "experimentId" TEXT,
  ADD COLUMN "experimentVariant" TEXT,
  ADD CONSTRAINT "ConversionEvent_experiment_assignment_valid" CHECK (
    ("experimentId" IS NULL AND "experimentVariant" IS NULL)
    OR
    ("experimentId" IS NOT NULL AND "experimentVariant" IN ('CONTROL', 'CHALLENGER'))
  ),
  ADD CONSTRAINT "ConversionEvent_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "LandingPageExperiment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "LandingPageExperiment_workspaceId_status_updatedAt_idx"
  ON "LandingPageExperiment" ("workspaceId", "status", "updatedAt");
CREATE INDEX "LandingPageExperiment_campaignId_status_idx"
  ON "LandingPageExperiment" ("campaignId", "status");
CREATE INDEX "LandingPageExperiment_landingPageId_status_createdAt_idx"
  ON "LandingPageExperiment" ("landingPageId", "status", "createdAt");
CREATE UNIQUE INDEX "LandingPageExperiment_one_running_per_page_idx"
  ON "LandingPageExperiment" ("landingPageId") WHERE "status" = 'RUNNING';
CREATE INDEX "ConversionEvent_experimentId_experimentVariant_eventType_occurredAt_idx"
  ON "ConversionEvent" ("experimentId", "experimentVariant", "eventType", "occurredAt");

ALTER TABLE "LandingPageExperiment" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "LandingPageExperiment" FROM anon, authenticated;
