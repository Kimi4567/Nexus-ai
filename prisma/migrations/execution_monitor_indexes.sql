-- Execution monitor hot-path indexes.
-- Additive and safe to run repeatedly on existing Supabase/Postgres projects.

CREATE INDEX IF NOT EXISTS "Campaign_workspaceId_status_updatedAt_idx"
  ON "Campaign" ("workspaceId", "status", "updatedAt");

CREATE INDEX IF NOT EXISTS "SocialPost_workspaceId_status_analyticsFetched_idx"
  ON "SocialPost" ("workspaceId", "status", "analyticsFetched");
