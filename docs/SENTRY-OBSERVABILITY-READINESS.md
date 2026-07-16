# Sentry observability readiness

The Sentry SDK is installed for the browser, Node.js runtime, Edge runtime, App Router request errors, router transitions, and React error boundaries.

## Safe default state

- `SENTRY_ENABLED=false`
- `NEXT_PUBLIC_SENTRY_ENABLED=false`
- `SENTRY_SOURCE_MAPS_ENABLED=false`
- No event is sent unless the matching runtime gate is explicitly enabled and the DSN is valid.
- No source map is uploaded unless the source-map gate is enabled and the organization, project, and auth token are all present.
- Session Replay and Sentry Logs are disabled.
- Default PII, request bodies, cookies, query strings, user identity, secret headers, and common token fields are removed.
- Production trace sampling defaults to 5% to limit cost.

## Final activation checklist

1. Create or confirm the Sentry Next.js project.
2. Verify the project DSN and set `SENTRY_DSN` plus `NEXT_PUBLIC_SENTRY_DSN` in the correct Vercel environments.
3. Create an organization CI token for source-map uploads and set `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` as server-only variables.
4. Set an environment-specific release name if Vercel commit SHA detection is not sufficient.
5. Enable `SENTRY_ENABLED` and `NEXT_PUBLIC_SENTRY_ENABLED` in Preview first.
6. Trigger one controlled browser error and one controlled server error, then confirm that payloads contain no customer content or credentials.
7. Enable `SENTRY_SOURCE_MAPS_ENABLED` and verify one de-minified Preview stack trace.
8. Apply issue alerts, ownership rules, retention, and team access before enabling Production.
9. Enable the three gates in Production and run the same browser/server verification.

Do not commit any DSN replacement, auth token, organization secret, or project credential to the repository.
