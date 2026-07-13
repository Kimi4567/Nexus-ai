-- Nexus reads and writes application data through authenticated server routes
-- and Prisma. The browser does not query public application tables directly.
-- Keep the Supabase Data API deny-by-default so an accidental client query can
-- never bypass workspace authorization enforced by the server.
DO $$
DECLARE
  table_record RECORD;
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

-- Preserve least-privilege defaults for tables and sequences created later by
-- the migration owner. Server database roles retain their explicit privileges.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated;
