# Supabase security audit — 2026-07-15

Project: `qabttahvjhgzwfzqnxew`

## Live findings

- The live security advisor reports **no critical findings**.
- All 44 current `public` tables have Row-Level Security enabled.
- Direct SQL privilege checks confirm `anon` and `authenticated` have no
  SELECT, INSERT, UPDATE, or DELETE privileges on any current public table.
- No functions are currently exposed in the live `public` schema.
- Anonymous PostgREST probes against `User`, `Integration`, `AdAccount`,
  `CreditTransaction`, and `BrandEvidenceDocument` all returned HTTP `401`
  with PostgreSQL `42501` (`permission denied`), confirming the browser
  boundary from outside the database as well as in the grant catalog.
- Both Supabase Storage buckets (`brand-evidence` and `nexus-exports`) are
  private; no `storage` or `public` policies grant browser access. Server
  routes issue time-limited signed URLs only after workspace authorization.
- The underlying `storage.buckets` and `storage.objects` relations also have
  RLS enabled.
- Live credential columns are encrypted at rest: all 4 populated integration
  access tokens, 2 integration refresh tokens, and the populated AdAccount
  access/refresh pair use the `nexus_enc:` AES-GCM format; no plaintext legacy
  token was found.
- Tables with RLS and no policies are intentional: NEXUS uses authenticated
  server routes plus Prisma, while the Supabase Data API is deny-by-default.
- One Auth warning remains: leaked-password protection is disabled. It must be
  enabled in Supabase Auth settings before public launch.

## Local hardening

- `20260715091427_reassert_public_data_api_lockdown.sql` reasserts RLS and
  removes table, sequence, and function privileges from browser roles.
- Default privileges are also revoked to protect future schema additions.
- `supabasePublicSecurity.test.ts` prevents new table migrations from shipping
  without explicit RLS and browser-role revocation.

## Deployment note

This audit did not apply local migrations to production. Apply the pending
migration set only through the normal reviewed deployment procedure, then rerun
the Supabase security advisor and the direct grants query.
