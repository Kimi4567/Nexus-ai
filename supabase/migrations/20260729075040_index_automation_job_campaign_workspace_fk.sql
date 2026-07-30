-- Cover the composite campaign/workspace foreign key for cascade/update checks.
CREATE INDEX IF NOT EXISTS "AutomationJob_campaignId_workspaceId_idx"
  ON "AutomationJob" ("campaignId", "workspaceId");
