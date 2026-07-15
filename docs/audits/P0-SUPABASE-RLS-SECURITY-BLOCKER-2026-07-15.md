# P0 Supabase RLS Security Blocker

Status: **RESOLVED AND VERIFIED — 2026-07-15**  
Project: `nexus-ai Project`  
Supabase project ref: `qabttahvjhgzwfzqnxew`  
Alert date: 2026-07-12  
Recorded: 2026-07-15

## Reported critical findings

Supabase reported both of the following security advisor findings:

1. `rls_disabled_in_public` — at least one table in an API-exposed schema is publicly accessible because Row-Level Security is disabled.
2. `sensitive_columns_exposed` — at least one API-accessible table contains columns likely to hold sensitive or identifying data without sufficient access restrictions.

Until the exact affected relations and policies are verified, assume anonymous callers may be able to read, create, update, or delete affected records through the Supabase Data API.

## Resolution evidence

The production project was inspected directly after the email alert:

- Every `public` table has RLS enabled; the query for tables with RLS disabled returned no rows.
- `anon` and `authenticated` have no table grants in `public`.
- Only `service_role` retains explicit table privileges for trusted server operations.
- There are no views, materialized views, or functions in `public` that expose a separate bypass path.
- Supabase Security Advisor no longer reports `rls_disabled_in_public` or `sensitive_columns_exposed`.
- The active migration `20260713150000_lock_down_public_tables.sql` enables RLS for all current public tables and revokes current and default table/sequence privileges from `anon` and `authenticated`.

The alert was dated 2026-07-12 and predates the production lock-down migration applied on 2026-07-13.

## Release decision

The two critical findings in the email are closed. Leaked-password protection remains a separate Supabase Auth hardening warning and should be enabled before public launch.

## Live advisor recheck — 2026-07-15

The production Security Advisor was queried again after the application release:

- `rls_disabled_in_public`: not reported.
- `sensitive_columns_exposed`: not reported.
- No `ERROR` or critical table-exposure finding is present.
- `rls_enabled_no_policy` appears at `INFO` for the server-only Prisma tables. This is expected in the current design because `anon` and `authenticated` have no table grants; trusted server operations use `service_role`.
- The only remaining `WARN` is `auth_leaked_password_protection`. It is separate from the reported table-exposure incident and remains a public-launch hardening action. See [Supabase password security guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Remediation checklist applied

- Identify every table/view named by the Supabase Security Advisor, including the exact exposed columns and grants.
- Enable RLS on every table in an exposed schema, including `public` by default.
- Add least-privilege policies based on the real ownership model (`user_id`, `workspace_id`, membership, or server-only access). `TO authenticated` alone is not authorization.
- Give `UPDATE` policies both `USING` and `WITH CHECK`, and ensure required `SELECT` policies exist.
- Revoke `anon`/`authenticated` access from tables that should be server-only; do not rely on RLS alone when the Data API does not need to expose a relation.
- Review views for `security_invoker = true` or remove their access from API roles.
- Review `SECURITY DEFINER` functions, default `PUBLIC` execute grants, Storage policies, and any frontend exposure of service-role/secret keys.
- Verify that one workspace cannot read or mutate another workspace's records.
- Re-run Supabase security advisors and record the clean result.

## Verification evidence used for closure

- Anonymous requests cannot select/insert/update/delete protected data.
- Authenticated user A cannot read or mutate user/workspace B data.
- Valid same-workspace operations still work through the application.
- Service-only operations still work only from trusted server code.
- Authentication, uploads, campaign creation, billing ledger, content operations, and deployment build pass after policy changes.
- Supabase no longer reports `rls_disabled_in_public` or `sensitive_columns_exposed` for the project.

## Important constraint

Do not apply a blanket policy without mapping table ownership first. The fix must close unauthorized access without silently breaking valid application workflows.
