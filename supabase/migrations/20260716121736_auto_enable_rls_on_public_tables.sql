-- Nexus keeps application tables behind authenticated server routes and Prisma.
-- Supabase's public schema is still exposed by the Data API, so every table
-- created there must be deny-by-default even when a future Prisma migration
-- forgets to enable RLS explicitly.
CREATE SCHEMA IF NOT EXISTS security;

REVOKE ALL ON SCHEMA security FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION security.enable_rls_on_new_public_tables()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  created_object record;
BEGIN
  FOR created_object IN
    SELECT object_identity
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND schema_name = 'public'
  LOOP
    EXECUTE format(
      'ALTER TABLE IF EXISTS %s ENABLE ROW LEVEL SECURITY',
      created_object.object_identity
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION security.enable_rls_on_new_public_tables()
  FROM PUBLIC, anon, authenticated;

DROP EVENT TRIGGER IF EXISTS nexus_enable_rls_on_public_table;

CREATE EVENT TRIGGER nexus_enable_rls_on_public_table
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION security.enable_rls_on_new_public_tables();

-- Reassert the current boundary as part of the same migration so applying it
-- is safe even if another migration created a table immediately beforehand.
DO $$
DECLARE
  table_record record;
BEGIN
  FOR table_record IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
      table_record.schema_name,
      table_record.table_name
    );
  END LOOP;
END
$$;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
