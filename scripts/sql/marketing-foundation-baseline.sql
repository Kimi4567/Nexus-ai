\set ON_ERROR_STOP on

-- Minimal pre-feature baseline for the isolated migration contract database.
-- This is intentionally not a production baseline and contains no customer data.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Simulate legacy Supabase projects where new public tables may receive Data
-- API grants automatically. Every server-only feature migration must revoke it.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLES TO anon, authenticated;

CREATE TABLE "Workspace" (
  "id" TEXT PRIMARY KEY
);

CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY
);

CREATE TABLE "Campaign" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  CONSTRAINT "Campaign_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Campaign_workspaceId_idx" ON "Campaign" ("workspaceId");
