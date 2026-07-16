# Sentry observability readiness

The Sentry SDK is installed for the browser, Node.js runtime, Edge runtime, App Router request errors, router transitions, React error boundaries, and explicitly caught failures in the critical billing, publishing, OAuth, AI, and credit routes.

## Safe default state

- `SENTRY_ENABLED=false`
- `NEXT_PUBLIC_SENTRY_ENABLED=false`
- `SENTRY_SOURCE_MAPS_ENABLED=false`
- No event is sent unless the matching runtime gate is explicitly enabled and the DSN is valid.
- SDK initialization is skipped while a runtime gate is disabled.
- No source map is uploaded unless the source-map gate is enabled and the organization, project, and auth token are all present.
- Session Replay and Sentry Logs are disabled.
- Default PII, request bodies, cookies, query strings, user identity, secret headers, and common token fields are removed.
- Console breadcrumbs are dropped. Navigation and fetch breadcrumbs keep only sanitized metadata without query strings.
- Operational errors use a fixed context schema and a redacted exception message; arbitrary route context is not accepted.
- Production trace sampling defaults to 5% to limit cost.

## Environment isolation

Configure Preview and Production independently. Do not reuse a hardcoded
`production` label in Preview.

| Vercel scope | `SENTRY_ENVIRONMENT` | `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | Runtime gates |
| --- | --- | --- | --- |
| Preview | `preview` | `preview` | Enable first for controlled verification |
| Production | `production` | `production` | Keep disabled until Preview verification passes |

`SENTRY_ENABLED` controls server/Edge reporting. `NEXT_PUBLIC_SENTRY_ENABLED`
controls browser reporting. They do not implicitly enable one another.

## Verified Preview state (2026-07-16)

- Reused the existing `nexus-ai-ud/javascript-nextjs` project instead of
  creating a duplicate project or DSN.
- Added the server DSN, independent runtime gates, stable environment labels,
  and source-map settings to the Vercel Preview scope only. Production runtime
  gates remain unset.
- Created a least-privilege `org:ci` organization token for build-time artifact
  uploads. It is stored as a sensitive Vercel Preview variable and is not kept
  in the repository.
- Vercel Preview deployment `dpl_7dWNYVpPSBxexoDeQVKkXULybJHx` completed and
  uploaded Edge and browser source maps to release
  `b6c399a869e8d2b8967b3c2bc55684df4b4d0503`.
- `scripts/sentry-smoke.mts` delivered and flushed a controlled operational
  event through `captureOperationalError`. Sentry recorded the expected
  environment and `nexus.*` tags without a JWT, Bearer credential, or DSN in
  the event view. The test issue was resolved after verification.
- The Preview-only `/internal/observability-smoke` route delivered controlled
  browser issue `JAVASCRIPT-NEXTJS-4`. Sentry recorded `environment=preview`,
  `nexus.error_code=SENTRY_BROWSER_SMOKE_TEST`, and a de-minified stack frame
  at `BrowserSentrySmoke.tsx`. The event contained no application user,
  customer content, credential, or token and was resolved after verification.
- The final Preview landing page loaded without browser console errors or
  warnings.
- Ownership rules assign billing, credit, publishing, platform integration,
  AI generation, and observability failures to the project owner. The existing
  high-priority issue alert remains enabled and will be restricted to the
  `production` environment as soon as that environment is created by the first
  Production event.

## Production preparation (2026-07-16)

- Added Production-only server and browser runtime gates, stable `production`
  environment labels, the server DSN, and source-map upload configuration in
  Vercel without changing the Preview values.
- Created a separate least-privilege `org:ci` token named
  `Vercel Source Maps - Nexus AI Production`; the token is stored only as a
  sensitive Vercel Production variable.
- `NEXT_PUBLIC_SENTRY_DSN` is available in both Preview and Production. All
  other environment-specific settings use separate records so Preview and
  Production cannot overwrite one another.
- Production code deployment and the post-deploy verification remain pending.

## Final activation checklist

1. Create or confirm the Sentry Next.js project.
2. Verify the project DSN and set `SENTRY_DSN` plus `NEXT_PUBLIC_SENTRY_DSN` in the correct Vercel environments.
3. Create an organization CI token for source-map uploads and set `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` as server-only variables.
4. Set an environment-specific release name if Vercel commit SHA detection is not sufficient.
5. Set both environment labels to `preview`, then enable `SENTRY_ENABLED` and `NEXT_PUBLIC_SENTRY_ENABLED` in Preview first.
6. Trigger one controlled browser error and one controlled server error, then confirm that payloads contain no customer content or credentials.
7. Enable `SENTRY_SOURCE_MAPS_ENABLED` and verify one de-minified Preview stack trace.
8. Apply issue alerts, ownership rules, retention, and team access before enabling Production.
9. Set both environment labels to `production`, enable the three gates in Production, and run the same browser/server verification.

Preview browser/server delivery, privacy filtering, and source-map upload are
proven. Production variables, ownership, and the alert foundation are ready;
the remaining activation work is the Production deployment, post-deploy smoke
verification, and restricting the high-priority alert to `production`.

Do not commit any DSN replacement, auth token, organization secret, or project credential to the repository.
