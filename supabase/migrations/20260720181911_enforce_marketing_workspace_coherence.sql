-- Enforce tenant coherence at the database boundary. Route handlers already
-- scope these writes by workspace, but a production SaaS must also reject
-- cross-workspace relationships if a future code path, import, or operator
-- action misses an application-level check.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Lead" lead
    JOIN "Campaign" campaign ON campaign."id" = lead."campaignId"
    WHERE lead."campaignId" IS NOT NULL
      AND campaign."workspaceId" <> lead."workspaceId"
  ) THEN
    RAISE EXCEPTION 'Cannot enforce tenant coherence: Lead has a campaign from another workspace';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "LeadCaptureForm" form
    JOIN "Campaign" campaign ON campaign."id" = form."campaignId"
    WHERE form."campaignId" IS NOT NULL
      AND campaign."workspaceId" <> form."workspaceId"
  ) THEN
    RAISE EXCEPTION 'Cannot enforce tenant coherence: LeadCaptureForm has a campaign from another workspace';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "LandingPage" page
    JOIN "Campaign" campaign ON campaign."id" = page."campaignId"
    WHERE campaign."workspaceId" <> page."workspaceId"
  ) THEN
    RAISE EXCEPTION 'Cannot enforce tenant coherence: LandingPage has a campaign from another workspace';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "LandingPage" page
    JOIN "LeadCaptureForm" form ON form."id" = page."captureFormId"
    WHERE page."captureFormId" IS NOT NULL
      AND (
        form."workspaceId" <> page."workspaceId"
        OR form."campaignId" IS DISTINCT FROM page."campaignId"
      )
  ) THEN
    RAISE EXCEPTION 'Cannot enforce tenant coherence: LandingPage has a capture form outside its campaign context';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "ContactSuppression" suppression
    JOIN "Lead" lead ON lead."id" = suppression."leadId"
    WHERE suppression."leadId" IS NOT NULL
      AND lead."workspaceId" <> suppression."workspaceId"
  ) THEN
    RAISE EXCEPTION 'Cannot enforce tenant coherence: ContactSuppression has a lead from another workspace';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "LifecycleMessage" message
    JOIN "Lead" lead ON lead."id" = message."leadId"
    WHERE lead."workspaceId" <> message."workspaceId"
  ) THEN
    RAISE EXCEPTION 'Cannot enforce tenant coherence: LifecycleMessage has a lead from another workspace';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "LandingPageExperiment" experiment
    JOIN "LandingPage" page ON page."id" = experiment."landingPageId"
    WHERE page."workspaceId" <> experiment."workspaceId"
      OR page."campaignId" <> experiment."campaignId"
  ) THEN
    RAISE EXCEPTION 'Cannot enforce tenant coherence: LandingPageExperiment is outside its page context';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "ConversionEvent" event
    JOIN "LandingPage" page ON page."id" = event."landingPageId"
    WHERE page."workspaceId" <> event."workspaceId"
      OR page."campaignId" <> event."campaignId"
  ) THEN
    RAISE EXCEPTION 'Cannot enforce tenant coherence: ConversionEvent is outside its page context';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "ConversionEvent" event
    JOIN "Lead" lead ON lead."id" = event."leadId"
    WHERE event."leadId" IS NOT NULL
      AND lead."workspaceId" <> event."workspaceId"
  ) THEN
    RAISE EXCEPTION 'Cannot enforce tenant coherence: ConversionEvent has a lead from another workspace';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "ConversionEvent" event
    JOIN "LandingPageExperiment" experiment ON experiment."id" = event."experimentId"
    WHERE event."experimentId" IS NOT NULL
      AND (
        experiment."workspaceId" <> event."workspaceId"
        OR experiment."campaignId" <> event."campaignId"
        OR experiment."landingPageId" <> event."landingPageId"
      )
  ) THEN
    RAISE EXCEPTION 'Cannot enforce tenant coherence: ConversionEvent is outside its experiment context';
  END IF;
END
$$;

ALTER TABLE "Campaign"
  ADD CONSTRAINT "Campaign_tenant_ref_key" UNIQUE ("id", "workspaceId");
ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_tenant_ref_key" UNIQUE ("id", "workspaceId");
ALTER TABLE "LeadCaptureForm"
  ADD CONSTRAINT "LeadCaptureForm_tenant_campaign_ref_key"
  UNIQUE ("id", "workspaceId", "campaignId");
ALTER TABLE "LandingPage"
  ADD CONSTRAINT "LandingPage_tenant_campaign_ref_key"
  UNIQUE ("id", "workspaceId", "campaignId");
ALTER TABLE "LandingPageExperiment"
  ADD CONSTRAINT "LandingPageExperiment_tenant_context_ref_key"
  UNIQUE ("id", "workspaceId", "campaignId", "landingPageId");

-- Cover every composite foreign key on its referencing side. Besides keeping
-- the Supabase advisor clean, these indexes prevent parent deletes/updates and
-- tenant-scoped integrity checks from degrading into full-table scans.
CREATE INDEX "Lead_campaign_tenant_idx"
  ON "Lead" ("campaignId", "workspaceId");
CREATE INDEX "LeadCaptureForm_campaign_tenant_idx"
  ON "LeadCaptureForm" ("campaignId", "workspaceId");
CREATE INDEX "LandingPage_campaign_tenant_idx"
  ON "LandingPage" ("campaignId", "workspaceId");
CREATE INDEX "LandingPage_capture_form_context_idx"
  ON "LandingPage" ("captureFormId", "workspaceId", "campaignId");
CREATE INDEX "ContactSuppression_lead_tenant_idx"
  ON "ContactSuppression" ("leadId", "workspaceId");
CREATE INDEX "LifecycleMessage_lead_tenant_idx"
  ON "LifecycleMessage" ("leadId", "workspaceId");
CREATE INDEX "LandingPageExperiment_page_context_idx"
  ON "LandingPageExperiment" ("landingPageId", "workspaceId", "campaignId");
CREATE INDEX "ConversionEvent_page_context_idx"
  ON "ConversionEvent" ("landingPageId", "workspaceId", "campaignId");
CREATE INDEX "ConversionEvent_lead_tenant_idx"
  ON "ConversionEvent" ("leadId", "workspaceId");
CREATE INDEX "ConversionEvent_experiment_context_idx"
  ON "ConversionEvent" ("experimentId", "workspaceId", "campaignId", "landingPageId");

ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_campaign_tenant_fkey"
  FOREIGN KEY ("campaignId", "workspaceId")
  REFERENCES "Campaign" ("id", "workspaceId")
  ON DELETE SET NULL ("campaignId") ON UPDATE CASCADE;

ALTER TABLE "LeadCaptureForm"
  ADD CONSTRAINT "LeadCaptureForm_campaign_tenant_fkey"
  FOREIGN KEY ("campaignId", "workspaceId")
  REFERENCES "Campaign" ("id", "workspaceId")
  ON DELETE SET NULL ("campaignId") ON UPDATE CASCADE;

ALTER TABLE "LandingPage"
  ADD CONSTRAINT "LandingPage_campaign_tenant_fkey"
  FOREIGN KEY ("campaignId", "workspaceId")
  REFERENCES "Campaign" ("id", "workspaceId")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "LandingPage_capture_form_context_fkey"
  FOREIGN KEY ("captureFormId", "workspaceId", "campaignId")
  REFERENCES "LeadCaptureForm" ("id", "workspaceId", "campaignId")
  ON DELETE SET NULL ("captureFormId") ON UPDATE CASCADE;

ALTER TABLE "ContactSuppression"
  ADD CONSTRAINT "ContactSuppression_lead_tenant_fkey"
  FOREIGN KEY ("leadId", "workspaceId")
  REFERENCES "Lead" ("id", "workspaceId")
  ON DELETE SET NULL ("leadId") ON UPDATE CASCADE;

ALTER TABLE "LifecycleMessage"
  ADD CONSTRAINT "LifecycleMessage_lead_tenant_fkey"
  FOREIGN KEY ("leadId", "workspaceId")
  REFERENCES "Lead" ("id", "workspaceId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LandingPageExperiment"
  ADD CONSTRAINT "LandingPageExperiment_page_context_fkey"
  FOREIGN KEY ("landingPageId", "workspaceId", "campaignId")
  REFERENCES "LandingPage" ("id", "workspaceId", "campaignId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversionEvent"
  ADD CONSTRAINT "ConversionEvent_page_context_fkey"
  FOREIGN KEY ("landingPageId", "workspaceId", "campaignId")
  REFERENCES "LandingPage" ("id", "workspaceId", "campaignId")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ConversionEvent_lead_tenant_fkey"
  FOREIGN KEY ("leadId", "workspaceId")
  REFERENCES "Lead" ("id", "workspaceId")
  ON DELETE SET NULL ("leadId") ON UPDATE CASCADE,
  ADD CONSTRAINT "ConversionEvent_experiment_context_fkey"
  FOREIGN KEY ("experimentId", "workspaceId", "campaignId", "landingPageId")
  REFERENCES "LandingPageExperiment" ("id", "workspaceId", "campaignId", "landingPageId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
