import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migrationsDirectory = 'supabase/migrations'
const lockdown = readFileSync(`${migrationsDirectory}/20260713105211_lock_down_public_tables.sql`, 'utf8')
const reassertion = readFileSync(`${migrationsDirectory}/20260715091427_reassert_public_data_api_lockdown.sql`, 'utf8')
const automaticRls = readFileSync(`${migrationsDirectory}/20260716121736_auto_enable_rls_on_public_tables.sql`, 'utf8')

function executableSql(sql: string): string {
  return sql
    .replace(/--.*$/gm, '')
    .replace(/'(?:''|[^'])*'/g, "''")
}

describe('Supabase public schema security boundary', () => {
  it.each([
    ['initial lockdown', lockdown],
    ['latest reassertion', reassertion],
  ])('%s enables RLS for every public table and revokes browser-role DML', (_label, sql) => {
    expect(sql).toContain("WHERE n.nspname = 'public'")
    expect(sql).toContain("c.relkind IN ('r', 'p')")
    expect(sql).toContain("'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY'")
    expect(sql).toContain('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated')
    expect(sql).toContain('REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated')
    expect(sql).toContain('ALTER DEFAULT PRIVILEGES IN SCHEMA public')
  })

  it('also denies public RPC execution by default', () => {
    expect(reassertion).toContain('REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated')
    expect(reassertion).toContain('REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated')
  })

  it('automatically enables RLS for future public tables without exposing the trigger function', () => {
    expect(automaticRls).toContain('CREATE EVENT TRIGGER nexus_enable_rls_on_public_table')
    expect(automaticRls).toContain("schema_name = 'public'")
    expect(automaticRls).toContain("'ALTER TABLE IF EXISTS %s ENABLE ROW LEVEL SECURITY'")
    expect(automaticRls).toContain('REVOKE ALL ON SCHEMA security FROM PUBLIC, anon, authenticated')
    expect(automaticRls).toContain('REVOKE ALL ON FUNCTION security.enable_rls_on_new_public_tables()')
  })

  it('requires every post-lockdown table-creating migration to lock its tables immediately', () => {
    const migrationFiles = readdirSync(migrationsDirectory)
      .filter(file => file.endsWith('.sql') && file > '20260713105211_lock_down_public_tables.sql')

    for (const file of migrationFiles) {
      const sql = readFileSync(`${migrationsDirectory}/${file}`, 'utf8')
      const code = executableSql(sql)
      // Keep this guard broad enough to catch both idempotent and first-run
      // table declarations. A future migration must not bypass the lockdown
      // merely by omitting IF NOT EXISTS or quoting style.
      const createdTables = [...code.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"([^"]+)"|([A-Za-z_][\w$]*))/gi)]
        .map(match => match[1] || match[2])

      for (const table of createdTables) {
        expect(sql, `${file} must enable RLS on ${table}`).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`)
        expect(sql, `${file} must revoke Data API access to ${table}`).toContain(`REVOKE ALL PRIVILEGES ON TABLE "${table}" FROM anon, authenticated`)
      }
    }
  })
})
