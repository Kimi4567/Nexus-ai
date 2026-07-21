-- Customer lifecycle control plane. This migration deliberately creates no
-- delivery queue and no provider message identifier: copy approval must never
-- be mistaken for an email/SMS send before provider and webhook verification.

CREATE TABLE IF NOT EXISTS "ContactSuppression" (
  "id"              TEXT NOT NULL,
  "workspaceId"     TEXT NOT NULL,
  "leadId"          TEXT,
  "channel"         TEXT NOT NULL,
  "destinationHash" TEXT NOT NULL,
  "status"          TEXT NOT NULL DEFAULT 'ACTIVE',
  "reason"          TEXT NOT NULL,
  "source"          TEXT NOT NULL DEFAULT 'USER',
  "createdById"     TEXT,
  "revokedById"     TEXT,
  "revokedAt"       TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContactSuppression_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ContactSuppression_channel_valid" CHECK ("channel" IN ('EMAIL', 'SMS')),
  CONSTRAINT "ContactSuppression_status_valid" CHECK ("status" IN ('ACTIVE', 'REVOKED')),
  CONSTRAINT "ContactSuppression_source_valid" CHECK ("source" IN ('USER', 'UNSUBSCRIBE_LINK', 'PROVIDER_WEBHOOK')),
  CONSTRAINT "ContactSuppression_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ContactSuppression_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "LifecycleMessage" (
  "id"                    TEXT NOT NULL,
  "workspaceId"           TEXT NOT NULL,
  "leadId"                TEXT NOT NULL,
  "channel"               TEXT NOT NULL,
  "purpose"               TEXT NOT NULL,
  "subject"               TEXT,
  "body"                  TEXT NOT NULL,
  "status"                TEXT NOT NULL DEFAULT 'DRAFT',
  "providerState"         TEXT NOT NULL DEFAULT 'NOT_CONNECTED',
  "deliveryBlockedReason" TEXT NOT NULL DEFAULT 'PROVIDER_NOT_CONNECTED',
  "version"               INTEGER NOT NULL DEFAULT 1,
  "createdById"           TEXT,
  "approvedById"          TEXT,
  "approvedAt"            TIMESTAMP(3),
  "cancelledById"         TEXT,
  "cancelledAt"           TIMESTAMP(3),
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LifecycleMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LifecycleMessage_channel_valid" CHECK ("channel" IN ('EMAIL', 'SMS')),
  CONSTRAINT "LifecycleMessage_purpose_valid" CHECK ("purpose" IN ('DOUBLE_OPT_IN', 'FOLLOW_UP', 'NURTURE', 'WIN_BACK')),
  CONSTRAINT "LifecycleMessage_status_valid" CHECK ("status" IN ('DRAFT', 'APPROVED', 'CANCELLED')),
  CONSTRAINT "LifecycleMessage_provider_state_valid" CHECK ("providerState" = 'NOT_CONNECTED'),
  CONSTRAINT "LifecycleMessage_version_positive" CHECK ("version" > 0),
  CONSTRAINT "LifecycleMessage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LifecycleMessage_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ContactSuppression_workspaceId_channel_destinationHash_key"
  ON "ContactSuppression" ("workspaceId", "channel", "destinationHash");
CREATE INDEX IF NOT EXISTS "ContactSuppression_workspaceId_status_channel_updatedAt_idx"
  ON "ContactSuppression" ("workspaceId", "status", "channel", "updatedAt");
CREATE INDEX IF NOT EXISTS "ContactSuppression_leadId_status_idx"
  ON "ContactSuppression" ("leadId", "status");
CREATE INDEX IF NOT EXISTS "LifecycleMessage_workspaceId_status_updatedAt_idx"
  ON "LifecycleMessage" ("workspaceId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "LifecycleMessage_leadId_createdAt_idx"
  ON "LifecycleMessage" ("leadId", "createdAt");

-- These tables contain customer PII-derived controls and message content.
-- They are server-only; the public unsubscribe route is a narrow Route Handler.
ALTER TABLE "ContactSuppression" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LifecycleMessage" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "ContactSuppression" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "LifecycleMessage" FROM anon, authenticated;
