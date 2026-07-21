\set ON_ERROR_STOP on

DO $$
DECLARE
  required_tables TEXT[] := ARRAY[
    'BillingWebhookEvent', 'Lead', 'LeadActivity', 'LeadTask',
    'LeadCaptureForm', 'ContactSuppression', 'LifecycleMessage',
    'LandingPage', 'LandingPageRevision', 'ConversionEvent',
    'LandingPageExperiment'
  ];
  required_indexes TEXT[] := ARRAY[
    'Lead_assignedToId_idx',
    'LeadTask_createdById_idx',
    'LeadCaptureForm_createdById_idx',
    'LandingPageExperiment_one_running_per_page_idx',
    'LandingPage_public_sitemap_idx',
    'Campaign_tenant_ref_key',
    'Lead_tenant_ref_key',
    'LeadCaptureForm_tenant_campaign_ref_key',
    'LandingPage_tenant_campaign_ref_key',
    'LandingPageExperiment_tenant_context_ref_key',
    'Lead_campaign_tenant_idx',
    'LeadCaptureForm_campaign_tenant_idx',
    'LandingPage_campaign_tenant_idx',
    'LandingPage_capture_form_context_idx',
    'ContactSuppression_lead_tenant_idx',
    'LifecycleMessage_lead_tenant_idx',
    'LandingPageExperiment_page_context_idx',
    'ConversionEvent_page_context_idx',
    'ConversionEvent_lead_tenant_idx',
    'ConversionEvent_experiment_context_idx'
  ];
  missing_objects TEXT[];
  table_name TEXT;
  role_name TEXT;
BEGIN
  SELECT array_agg(name ORDER BY name)
    INTO missing_objects
  FROM unnest(required_tables) AS name
  WHERE to_regclass(format('%I.%I', 'public', name)) IS NULL;

  IF missing_objects IS NOT NULL THEN
    RAISE EXCEPTION 'Missing marketing tables: %', missing_objects;
  END IF;

  SELECT array_agg(c.relname ORDER BY c.relname)
    INTO missing_objects
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = ANY(required_tables)
    AND c.relkind = 'r'
    AND NOT c.relrowsecurity;

  IF missing_objects IS NOT NULL THEN
    RAISE EXCEPTION 'RLS is disabled on server-only tables: %', missing_objects;
  END IF;

  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    FOREACH table_name IN ARRAY required_tables LOOP
      IF has_table_privilege(role_name, format('%I.%I', 'public', table_name), 'SELECT')
        OR has_table_privilege(role_name, format('%I.%I', 'public', table_name), 'INSERT')
        OR has_table_privilege(role_name, format('%I.%I', 'public', table_name), 'UPDATE')
        OR has_table_privilege(role_name, format('%I.%I', 'public', table_name), 'DELETE')
      THEN
        RAISE EXCEPTION 'Browser role % still has direct privileges on %', role_name, table_name;
      END IF;
    END LOOP;
  END LOOP;

  SELECT array_agg(name ORDER BY name)
    INTO missing_objects
  FROM unnest(required_indexes) AS name
  WHERE to_regclass(format('%I.%I', 'public', name)) IS NULL;

  IF missing_objects IS NOT NULL THEN
    RAISE EXCEPTION 'Missing required marketing indexes: %', missing_objects;
  END IF;
END
$$;

INSERT INTO "Workspace" ("id") VALUES ('workspace-a'), ('workspace-b');
INSERT INTO "User" ("id") VALUES ('user-a'), ('user-b');
INSERT INTO "Campaign" ("id", "workspaceId")
VALUES ('campaign-a', 'workspace-a'), ('campaign-b', 'workspace-b');

INSERT INTO "LeadCaptureForm" (
  "id", "publicId", "workspaceId", "campaignId", "createdById", "name", "title"
) VALUES
  ('form-a', 'public-form-a', 'workspace-a', 'campaign-a', 'user-a', 'Form A', 'Form A'),
  ('form-b', 'public-form-b', 'workspace-b', 'campaign-b', 'user-b', 'Form B', 'Form B');

-- The same normalized destination is valid in two isolated workspaces.
INSERT INTO "Lead" (
  "id", "workspaceId", "campaignId", "email", "emailNormalized", "source"
) VALUES
  ('lead-a', 'workspace-a', 'campaign-a', 'lead@example.com', 'lead@example.com', 'FORM'),
  ('lead-b', 'workspace-b', 'campaign-b', 'lead@example.com', 'lead@example.com', 'FORM');

DO $$
BEGIN
  BEGIN
    INSERT INTO "Lead" (
      "id", "workspaceId", "campaignId", "email", "emailNormalized", "source"
    ) VALUES (
      'cross-tenant-lead', 'workspace-a', 'campaign-b',
      'cross-tenant@example.com', 'cross-tenant@example.com', 'FORM'
    );
    RAISE EXCEPTION 'Expected a cross-workspace lead campaign to be rejected';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO "Lead" (
      "id", "workspaceId", "campaignId", "email", "emailNormalized", "source"
    ) VALUES (
      'lead-a-duplicate', 'workspace-a', 'campaign-a', 'LEAD@example.com', 'lead@example.com', 'FORM'
    );
    RAISE EXCEPTION 'Expected workspace-scoped lead deduplication to reject a duplicate';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
END
$$;

INSERT INTO "LeadTask" (
  "id", "leadId", "assignedToId", "createdById", "title", "dueAt"
) VALUES (
  'task-a', 'lead-a', 'user-a', 'user-a', 'Review the qualified lead', CURRENT_TIMESTAMP + INTERVAL '1 hour'
);

INSERT INTO "ContactSuppression" (
  "id", "workspaceId", "leadId", "channel", "destinationHash", "reason"
) VALUES (
  'suppression-a', 'workspace-a', 'lead-a', 'EMAIL', 'destination-hash-a', 'Recipient requested no contact'
);

INSERT INTO "LifecycleMessage" (
  "id", "workspaceId", "leadId", "channel", "purpose", "subject", "body"
) VALUES (
  'message-a', 'workspace-a', 'lead-a', 'EMAIL', 'FOLLOW_UP',
  'Your requested follow-up', 'A reviewed draft that remains blocked from delivery.'
);

DO $$
BEGIN
  BEGIN
    INSERT INTO "LifecycleMessage" (
      "id", "workspaceId", "leadId", "channel", "purpose", "body"
    ) VALUES (
      'cross-tenant-message', 'workspace-a', 'lead-b', 'SMS', 'FOLLOW_UP',
      'This cross-workspace message must be rejected.'
    );
    RAISE EXCEPTION 'Expected a cross-workspace lifecycle lead to be rejected';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;

  BEGIN
    UPDATE "LifecycleMessage"
    SET "providerState" = 'SENT'
    WHERE "id" = 'message-a';
    RAISE EXCEPTION 'Expected lifecycle provider delivery to remain blocked';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END
$$;

INSERT INTO "LandingPage" (
  "id", "publicId", "workspaceId", "campaignId", "captureFormId",
  "name", "headline", "primaryCtaLabel"
) VALUES (
  'page-a', 'public-page-a', 'workspace-a', 'campaign-a', 'form-a',
  'Page A', 'A reviewed acquisition offer', 'Start now'
);

DO $$
BEGIN
  BEGIN
    INSERT INTO "LandingPage" (
      "id", "publicId", "workspaceId", "campaignId", "captureFormId",
      "name", "headline", "primaryCtaLabel"
    ) VALUES (
      'cross-tenant-page', 'cross-tenant-page', 'workspace-a', 'campaign-b', 'form-b',
      'Invalid page', 'This page must not cross tenant boundaries', 'Reject'
    );
    RAISE EXCEPTION 'Expected a cross-workspace landing-page context to be rejected';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;
END
$$;

DO $$
BEGIN
  BEGIN
    INSERT INTO "ConversionEvent" (
      "id", "workspaceId", "campaignId", "landingPageId", "eventType",
      "verificationState", "dedupeKey"
    ) VALUES (
      'invalid-click', 'workspace-a', 'campaign-a', 'page-a', 'CTA_CLICK',
      'SERVER_CONFIRMED', 'invalid-click'
    );
    RAISE EXCEPTION 'Expected a browser click to reject SERVER_CONFIRMED state';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    UPDATE "LandingPage" SET "seoIndexable" = true WHERE "id" = 'page-a';
    RAISE EXCEPTION 'Expected indexable page without metadata to be rejected';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    UPDATE "LandingPage" SET "publishedSeoIndexable" = true WHERE "id" = 'page-a';
    RAISE EXCEPTION 'Expected published indexability without a snapshot to be rejected';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END
$$;

UPDATE "LandingPage"
SET
  "seoTitle" = 'A reviewed acquisition offer for measurable campaigns',
  "seoDescription" = 'Review a focused acquisition offer, a clear call to action, and server-confirmed lead intake before publishing the campaign.',
  "seoIndexable" = true,
  "status" = 'PUBLISHED',
  "publishedVersion" = 1,
  "publishedSnapshot" = '{"schemaVersion":1,"seo":{"indexable":true}}'::jsonb,
  "publishedHash" = 'published-hash-a',
  "publishedSeoIndexable" = true,
  "publishedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'page-a';

INSERT INTO "ConversionEvent" (
  "id", "workspaceId", "campaignId", "landingPageId", "leadId",
  "eventType", "verificationState", "dedupeKey"
) VALUES (
  'confirmed-form-a', 'workspace-a', 'campaign-a', 'page-a', 'lead-a',
  'FORM_SUBMITTED', 'SERVER_CONFIRMED', 'confirmed-form-a'
);

DO $$
BEGIN
  BEGIN
    INSERT INTO "ConversionEvent" (
      "id", "workspaceId", "campaignId", "landingPageId", "leadId",
      "eventType", "verificationState", "dedupeKey"
    ) VALUES (
      'cross-tenant-conversion', 'workspace-b', 'campaign-b', 'page-a', 'lead-b',
      'FORM_SUBMITTED', 'SERVER_CONFIRMED', 'cross-tenant-conversion'
    );
    RAISE EXCEPTION 'Expected a cross-workspace conversion context to be rejected';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;
END
$$;

INSERT INTO "LandingPageExperiment" (
  "id", "workspaceId", "campaignId", "landingPageId", "status",
  "hypothesis", "variable", "controlSnapshot", "controlHash",
  "challengerSnapshot", "challengerHash", "startedAt"
) VALUES (
  'experiment-a', 'workspace-a', 'campaign-a', 'page-a', 'RUNNING',
  'A clearer headline may improve confirmed form intake.', 'HEADLINE',
  '{}'::jsonb, 'control-a', '{}'::jsonb, 'challenger-a', CURRENT_TIMESTAMP
);

DO $$
BEGIN
  BEGIN
    INSERT INTO "LandingPageExperiment" (
      "id", "workspaceId", "campaignId", "landingPageId", "status",
      "hypothesis", "variable", "controlSnapshot", "controlHash",
      "challengerSnapshot", "challengerHash", "startedAt"
    ) VALUES (
      'experiment-b', 'workspace-a', 'campaign-a', 'page-a', 'RUNNING',
      'A second simultaneous experiment must be rejected.', 'CTA_LABEL',
      '{}'::jsonb, 'control-b', '{}'::jsonb, 'challenger-b', CURRENT_TIMESTAMP
    );
    RAISE EXCEPTION 'Expected one-running-experiment invariant to reject a second experiment';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
END
$$;

SELECT
  'marketing_migration_contract_passed' AS result,
  (SELECT count(*) FROM "Lead") AS isolated_leads,
  (SELECT count(*) FROM "ConversionEvent" WHERE "verificationState" = 'SERVER_CONFIRMED') AS confirmed_events,
  (SELECT count(*) FROM "LandingPageExperiment" WHERE "status" = 'RUNNING') AS running_experiments,
  (SELECT count(*) FROM "LeadTask" WHERE "status" = 'OPEN') AS open_follow_up_tasks,
  (SELECT count(*) FROM "ContactSuppression" WHERE "status" = 'ACTIVE') AS active_suppressions,
  (SELECT count(*) FROM "LifecycleMessage" WHERE "providerState" = 'NOT_CONNECTED') AS delivery_blocked_messages;
